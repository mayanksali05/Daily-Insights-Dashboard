"""Gold & silver prices in INR (no API key).

International futures (COMEX gold GC=F, silver SI=F, in USD per troy ounce) come
from Yahoo Finance's public chart endpoint (unofficial), are converted to INR
using USDINR=X, and marked up by India's import duty (IMPORT_DUTY_PERCENT in
.env) to approximate the Indian market rate. GST and local jeweller premiums
are NOT included, so treat it as an indicative price, not a bullion quote.

If the source breaks, replace `_chart` / INSTRUMENTS without touching routers
or the frontend.
"""
import asyncio

import httpx

from ..cache import ttl_cache
from ..config import settings

CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
GRAMS_PER_TROY_OZ = 31.1035

# key -> display name, Yahoo symbol, unit label, grams per displayed unit
INSTRUMENTS = {
    "gold": {"name": "Gold 24K", "symbol": "GC=F", "unit": "per 10 g", "grams": 10},
    "silver": {"name": "Silver", "symbol": "SI=F", "unit": "per kg", "grams": 1000},
}
FX_SYMBOL = "USDINR=X"


@ttl_cache(lambda: settings.cache_ttl_markets)
async def _chart(symbol: str) -> dict:
    async with httpx.AsyncClient(timeout=10, headers={"User-Agent": "Mozilla/5.0"}) as client:
        res = await client.get(
            CHART_URL.format(symbol=symbol),
            params={"range": "5d", "interval": "1h"},
        )
        res.raise_for_status()
    result = res.json()["chart"]["result"][0]
    meta = result["meta"]
    stamps = result.get("timestamp") or []
    raw = result["indicators"]["quote"][0]["close"]
    offset = meta.get("gmtoffset", 0)
    points = [(t + offset, c) for t, c in zip(stamps, raw) if c is not None]
    price = meta["regularMarketPrice"]
    # Previous close = last hourly close on an earlier calendar day (exchange time).
    prev_close = price
    if points:
        last_day = points[-1][0] // 86400
        earlier = [c for t, c in points if t // 86400 < last_day]
        prev_close = earlier[-1] if earlier else points[0][1]
    return {"price": price, "prev_close": prev_close, "closes": [c for _, c in points]}


async def _fetch_one(key: str, fx: dict) -> dict:
    spec = INSTRUMENTS[key]
    usd = await _chart(spec["symbol"])
    # USD/oz -> INR per displayed unit, plus import duty
    factor = spec["grams"] / GRAMS_PER_TROY_OZ * (1 + settings.import_duty_percent / 100)
    price = usd["price"] * fx["price"] * factor
    prev = usd["prev_close"] * fx["prev_close"] * factor
    change = price - prev
    return {
        "key": key,
        "name": spec["name"],
        "unit": spec["unit"],
        "prefix": "₹",
        "price": price,
        "change": change,
        "change_percent": (change / prev * 100) if prev else 0,
        "sparkline": [c * fx["price"] * factor for c in usd["closes"][-40:]],
    }


async def get_markets(keys: list[str]) -> list[dict]:
    keys = [k for k in keys if k in INSTRUMENTS]
    if not keys:
        return []
    try:
        fx = await _chart(FX_SYMBOL)
    except Exception:
        return [{"key": k, "name": INSTRUMENTS[k]["name"], "error": True} for k in keys]
    results = await asyncio.gather(*(_fetch_one(k, fx) for k in keys), return_exceptions=True)
    return [
        {"key": k, "name": INSTRUMENTS[k]["name"], "error": True} if isinstance(r, Exception) else r
        for k, r in zip(keys, results)
    ]
