from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..services import brief, markets, news, weather

router = APIRouter(prefix="/api", tags=["live-info"])


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
async def get_news(category: str, limit: int = Query(4, ge=1, le=8)):
    if category not in news.FEEDS:
        raise HTTPException(404, "Unknown news category")
    return await news.get_news(category, limit)


@router.get("/brief")
async def get_brief():
    return await brief.get_brief()
