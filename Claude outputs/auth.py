"""Accounts: email + password sign-up / sign-in with a signed 30-day session cookie.

* The FIRST account can be created without an invite code and becomes the admin.
  Any tasks/notes created before accounts existed are given to that account, and
  the NOTION_TOKEN / NOTION_EXPENSES_PAGE env vars (if set) are copied into it.
* Everyone after that needs SIGNUP_CODE (an invite code you share). If SIGNUP_CODE
  is empty, sign-ups are closed.
* Every /api/* route except /api/auth/* and /api/health needs a valid session;
  the signed-in user is available as request.state.user.
"""
import hmac
import re
import time
from collections import defaultdict, deque
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from . import security
from .config import settings
from .db import get_db

COOKIE = "dcc_session"
MAX_AGE = 30 * 24 * 3600  # 30 days
PUBLIC_API = ("/api/auth/", "/api/health")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Brute-force protection: at most 5 failed attempts per IP per 15 minutes.
MAX_FAILS, WINDOW = 5, 15 * 60
_fails: dict[str, deque] = defaultdict(deque)

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ---------- helpers ----------

def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "?")


def _is_https(request: Request) -> bool:
    return request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"


def _check_rate(request: Request) -> deque:
    attempts, now = _fails[_client_ip(request)], time.time()
    while attempts and now - attempts[0] > WINDOW:
        attempts.popleft()
    if len(attempts) >= MAX_FAILS:
        raise HTTPException(429, "Too many attempts. Try again in 15 minutes.")
    return attempts


def _set_session(request: Request, response: Response, user: dict) -> None:
    token = security.sign_session(str(user["_id"]), user.get("session_version", 0), int(time.time()) + MAX_AGE)
    response.set_cookie(
        COOKIE, token, max_age=MAX_AGE, httponly=True, secure=_is_https(request), samesite="lax", path="/"
    )


def public_user(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user.get("name", ""),
        "is_admin": user.get("is_admin", False),
        "settings": user.get("settings", {}),
        "notion": {
            "connected": bool(security.decrypt(user.get("notion_token_enc"))),
            "page": user.get("notion_page") or "Expenses",
        },
    }


async def current_user(request: Request) -> dict | None:
    session = security.read_session(request.cookies.get(COOKIE), time.time())
    if not session:
        return None
    user_id, version = session
    try:
        oid = ObjectId(user_id)
    except InvalidId:
        return None
    user = await get_db().users.find_one({"_id": oid})
    if not user or user.get("session_version", 0) != version:
        return None
    return user


async def signup_mode() -> str:
    """"first" (no accounts yet, no code needed), "invite" (code required) or "closed"."""
    if await get_db().users.estimated_document_count() == 0:
        return "first"
    return "invite" if settings.signup_code else "closed"


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path.startswith("/api/") and not path.startswith(PUBLIC_API):
            user = await current_user(request)
            if not user:
                return JSONResponse({"detail": "Not signed in"}, status_code=401)
            request.state.user = user
        return await call_next(request)


def user_id_of(request: Request) -> ObjectId:
    return request.state.user["_id"]


# ---------- routes ----------

class SignupBody(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=8, max_length=200)
    name: str = Field(default="", max_length=60)
    invite_code: str = Field(default="", max_length=200)


class LoginBody(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=200)


@router.get("/status")
async def status(request: Request):
    user = await current_user(request)
    return {
        "authenticated": bool(user),
        "user": public_user(user) if user else None,
        "signup": await signup_mode(),
    }


@router.post("/signup")
async def signup(body: SignupBody, request: Request, response: Response):
    attempts = _check_rate(request)
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "Enter a valid email address.")

    users = get_db().users
    mode = await signup_mode()
    if mode == "closed":
        raise HTTPException(403, "Sign-ups are closed. Ask the owner for an invite code.")
    if mode == "invite" and not hmac.compare_digest(body.invite_code.strip().encode(), settings.signup_code.encode()):
        attempts.append(time.time())
        raise HTTPException(403, "Invalid invite code.")

    first = mode == "first"
    doc = {
        "email": email,
        "name": body.name.strip() or email.split("@")[0],
        "password_hash": security.hash_password(body.password),
        "is_admin": first,
        "session_version": 0,
        "settings": {},
        "created_at": datetime.now(timezone.utc),
    }
    if first and settings.notion_token:  # carry over the single-user Notion setup
        doc["notion_token_enc"] = security.encrypt(settings.notion_token)
        doc["notion_page"] = settings.notion_expenses_page
    try:
        res = await users.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(409, "An account with this email already exists. Sign in instead.")
    doc["_id"] = res.inserted_id

    if first:  # data created before accounts existed belongs to the owner
        for coll in ("tasks", "notes"):
            await get_db()[coll].update_many({"user_id": {"$exists": False}}, {"$set": {"user_id": res.inserted_id}})

    _set_session(request, response, doc)
    return {"ok": True, "user": public_user(doc)}


@router.post("/login")
async def login(body: LoginBody, request: Request, response: Response):
    attempts = _check_rate(request)
    user = await get_db().users.find_one({"email": body.email.strip().lower()})
    ok = security.verify_password(body.password, user["password_hash"] if user else security.DUMMY_HASH)
    if not user or not ok:
        attempts.append(time.time())
        raise HTTPException(401, "Wrong email or password.")
    attempts.clear()
    _set_session(request, response, user)
    return {"ok": True, "user": public_user(user)}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}
