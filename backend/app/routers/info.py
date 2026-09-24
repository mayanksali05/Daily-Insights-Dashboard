import logging
from typing import Optional

import httpx

from fastapi import APIRouter, HTTPException, Query

from ..services import brief, markets, news, notion, notion_expenses, weather

router = APIRouter(prefix="/api", tags=["live-info"])
log = logging.getLogger("uvicorn.error")


@router.get("/weather")
async def get_weather(city: Optional[str] = None):
    try:
        return await weather.get_weather(city)
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception:
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
        raise HTTPException(401, "Notion token is invalid or lacks access")
    except Exception:
        raise HTTPException(502, "Notion is unavailable")


@router.get("/notion/expenses")
async def get_notion_expenses():
    try:
        return await notion_expenses.get_month_total()
    except notion.NotionNotConfigured:
        return {"configured": False}
    except notion.NotionAuthError:
        raise HTTPException(401, "Notion token is invalid or lacks access")
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
