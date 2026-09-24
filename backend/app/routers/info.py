import logging
from typing import Optional

import httpx

from fastapi import APIRouter, HTTPException, Query

from pymongo import errors as mongo_errors

from ..config import settings
from ..db import get_db
from ..services import brief, markets, news, notion, notion_expenses, weather

router = APIRouter(prefix="/api", tags=["live-info"])
log = logging.getLogger("uvicorn.error")


@router.get("/weather")
async def get_weather(city: Optional[str] = None):
    try:
        return await weather.get_weather(city)
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        log.error("Weather failed: %s: %s", type(e).__name__, e)
        raise HTTPException(502, "Weather service unavailable")


@router.get("/markets")
async def get_markets(symbols: str = Query(",".join(markets.INSTRUMENTS))):
    """Comma-separated instrument keys, e.g. nifty50,sensex,btc"""
    return await markets.get_markets([s.strip() for s in symbols.split(",")])


@router.get("/news/{category}")
async def get_news(category: str, limit: int = Query(4, ge=1, le=12)):
    if category not in news.CATEGORIES:
        raise HTTPException(404, "Unknown news category")
    return await news.get_news(category, limit)


@router.get("/notion/recent")
async def get_notion_recent(limit: int = Query(10, ge=1, le=25)):
    try:
        return {"configured": True, "pages": await notion.get_recent(limit)}
    except notion.NotionNotConfigured:
        return {"configured": False, "pages": []}
    except notion.NotionAuthError:
        raise HTTPException(502, "Notion token is invalid or lacks access")  # not 401: that means "signed out"
    except Exception:
        raise HTTPException(502, "Notion is unavailable")


@router.get("/notion/expenses")
async def get_notion_expenses():
    try:
        return await notion_expenses.get_month_total()
    except notion.NotionNotConfigured:
        return {"configured": False}
    except notion.NotionAuthError:
        raise HTTPException(502, "Notion token is invalid or lacks access")  # not 401: that means "signed out"
    except httpx.HTTPStatusError as e:
        msg = e.response.text[:300]
        log.error("Notion API error %s on %s: %s", e.response.status_code, e.request.url, msg)
        raise HTTPException(502, f"Notion API error {e.response.status_code}: {msg}")
    except Exception as e:
        log.exception("Notion expenses failed")
        raise HTTPException(502, f"Notion expenses failed: {type(e).__name__}: {e}")


@router.get("/brief")
async def get_brief():
    return await brief.get_brief()


def _explain_db_error(e: Exception) -> str:
    msg = str(e)[:300]
    if isinstance(e, mongo_errors.OperationFailure) and ("auth" in msg.lower() or e.code in (8000, 18)):
        return "Wrong database username or password in MONGODB_URI (Atlas → Database Access)."
    if isinstance(e, mongo_errors.ServerSelectionTimeoutError):
        return ("Can't reach the database. In Atlas → Network Access, allow 0.0.0.0/0 and wait until it's "
                f"Active; also check the host in MONGODB_URI. Details: {msg}")
    if isinstance(e, (mongo_errors.ConfigurationError, mongo_errors.InvalidURI)):
        return ("MONGODB_URI is malformed or its host doesn't exist. If the password has special characters "
                f"(@ : / ? # %), URL-encode them or use a letters-and-numbers password. Details: {msg}")
    return f"{type(e).__name__}: {msg}"


@router.get("/diagnostics")
async def diagnostics():
    """Signed-in only: explains why a section isn't loading. Never returns secrets."""
    uri = settings.mongodb_uri
    report: dict = {
        "config": {
            "mongodb_uri_set": uri != "mongodb://localhost:27017",
            "mongodb_uri_still_has_placeholder": "<" in uri or ">" in uri,
            "mongodb_database": settings.mongodb_db,
            "notion_token_set": bool(settings.notion_token),
            "weather_city": settings.weather_city,
        }
    }
    try:
        await get_db().command("ping")
        report["database"] = {"ok": True}
    except Exception as e:
        report["database"] = {"ok": False, "error": _explain_db_error(e)}
    try:
        w = await weather.get_weather()
        report["weather"] = {"ok": True, "city": w["city"], "temperature": w["temperature"]}
    except Exception as e:
        report["weather"] = {"ok": False, "error": f"{type(e).__name__}: {str(e)[:300]}"}
    return report
