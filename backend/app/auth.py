"""Single-user password login for the deployed dashboard.

Set DASHBOARD_PASSWORD (and ideally SECRET_KEY) in the environment. When
DASHBOARD_PASSWORD is empty, login is disabled — convenient for local dev.

A successful login sets an HttpOnly, signed session cookie valid for 30 days.
Every /api/* route except /api/auth/* and /api/health requires it.
"""
import hashlib
import hmac
import time
from collections import defaultdict, deque

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from .config import settings

COOKIE = "dcc_session"
MAX_AGE = 30 * 24 * 3600  # 30 days
PUBLIC_API = ("/api/auth/", "/api/health")

# Brute-force protection: at most 5 failed attempts per IP per 15 minutes.
MAX_FAILS, WINDOW = 5, 15 * 60
_fails: dict[str, deque] = defaultdict(deque)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def enabled() -> bool:
    return bool(settings.dashboard_password)


def _key() -> bytes:
    secret = settings.secret_key or ("derived:" + settings.dashboard_password)
    return hashlib.sha256(secret.encode()).digest()


def _sign(expires: int) -> str:
    sig = hmac.new(_key(), str(expires).encode(), hashlib.sha256).hexdigest()
    return f"{expires}.{sig}"


def _valid(token: str | None) -> bool:
    if not token or "." not in token:
        return False
    expires, _ = token.split(".", 1)
    if not expires.isdigit() or int(expires) < time.time():
        return False
    return hmac.compare_digest(token, _sign(int(expires)))


def is_authenticated(request: Request) -> bool:
    return not enabled() or _valid(request.cookies.get(COOKIE))


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "?")


def _is_https(request: Request) -> bool:
    return request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path.startswith("/api/") and not path.startswith(PUBLIC_API) and not is_authenticated(request):
            return JSONResponse({"detail": "Not signed in"}, status_code=401)
        return await call_next(request)


class LoginBody(BaseModel):
    password: str


@router.get("/status")
async def status(request: Request):
    return {"auth_required": enabled(), "authenticated": is_authenticated(request)}


@router.post("/login")
async def login(body: LoginBody, request: Request, response: Response):
    if not enabled():
        return {"ok": True}
    ip, now = _client_ip(request), time.time()
    attempts = _fails[ip]
    while attempts and now - attempts[0] > WINDOW:
        attempts.popleft()
    if len(attempts) >= MAX_FAILS:
        raise HTTPException(429, "Too many attempts. Try again in 15 minutes.")

    if not hmac.compare_digest(body.password.encode(), settings.dashboard_password.encode()):
        attempts.append(now)
        raise HTTPException(401, "Wrong password")

    attempts.clear()
    response.set_cookie(
        COOKIE,
        _sign(int(now) + MAX_AGE),
        max_age=MAX_AGE,
        httponly=True,
        secure=_is_https(request),
        samesite="lax",
        path="/",
    )
    return {"ok": True}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}
