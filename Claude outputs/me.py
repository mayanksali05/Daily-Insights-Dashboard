import json
from typing import Any

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from .. import security
from ..auth import _set_session, public_user, user_id_of
from ..db import get_db
from ..services import notion

router = APIRouter(prefix="/api/me", tags=["account"])

MAX_SETTINGS_BYTES = 10_000


@router.get("")
async def me(request: Request):
    return public_user(request.state.user)


@router.put("/settings")
async def save_settings(body: dict[str, Any], request: Request):
    """Dashboard preferences (theme, sections, city...), synced across this user's devices."""
    if len(json.dumps(body)) > MAX_SETTINGS_BYTES:
        raise HTTPException(413, "Settings too large")
    await get_db().users.update_one({"_id": user_id_of(request)}, {"$set": {"settings": body}})
    return {"ok": True}


class NotionBody(BaseModel):
    token: str = Field(default="", max_length=500)  # empty = keep the saved token
    page: str = Field(default="Expenses", max_length=300)


@router.put("/notion")
async def connect_notion(body: NotionBody, request: Request):
    user = request.state.user
    token = body.token.strip() or security.decrypt(user.get("notion_token_enc"))
    if not token:
        raise HTTPException(400, "Paste your Notion integration secret.")
    try:
        await notion.get_recent.__wrapped__(token, 1)  # validate before saving (bypass cache)
    except notion.NotionAuthError:
        raise HTTPException(400, "Notion rejected that secret. Copy it again from notion.so/profile/integrations.")
    except Exception:
        raise HTTPException(502, "Couldn't reach Notion to check the secret. Try again.")
    update = {"notion_page": body.page.strip() or "Expenses"}
    if body.token.strip():
        update["notion_token_enc"] = security.encrypt(token)
    await get_db().users.update_one({"_id": user["_id"]}, {"$set": update})
    return {"ok": True}


@router.delete("/notion")
async def disconnect_notion(request: Request):
    await get_db().users.update_one(
        {"_id": user_id_of(request)}, {"$unset": {"notion_token_enc": "", "notion_page": ""}}
    )
    return {"ok": True}


class PasswordBody(BaseModel):
    current: str = Field(max_length=200)
    new: str = Field(min_length=8, max_length=200)


@router.post("/password")
async def change_password(body: PasswordBody, request: Request, response: Response):
    user = request.state.user
    if not security.verify_password(body.current, user["password_hash"]):
        raise HTTPException(400, "Current password is wrong.")
    # Bumping session_version signs out every other device; this one gets a fresh cookie.
    updated = await get_db().users.find_one_and_update(
        {"_id": user["_id"]},
        {"$set": {"password_hash": security.hash_password(body.new)}, "$inc": {"session_version": 1}},
        return_document=True,
    )
    _set_session(request, response, updated)
    return {"ok": True}
