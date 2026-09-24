"""Market data via Yahoo Finance's public chart endpoint (no API key).

This is an unofficial endpoint; if it ever breaks, swap the fetch function here
without touching routers or the frontend.
"""
import asyncio

import httpx

from ..cache import ttl_cache
from ..config import settings

CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"

# key -> (Yahoo symbol, display name, currency prefix)
INSTRUMENTS = {
    "nifty50": ("^NSEI", "NIFTY 50", ""),
    "sensex": ("^BSESN", "SENSEX", ""),
    "sp500": ("^GSPC", "S&P 500", ""),
    "nasdaq": ("^IXIC", "NASDAQ", ""),
    "usdinr": ("USDINR=X", "USD/INR", "₹"),
    "btc": ("BTC-USD", "BTC", "$"),
}


@ttl_cache(lambda: settings.cache_ttl_markets)
async def _fetch_one(key: str) -> dict:
    symbol, name, prefix = INSTRUMENTS[key]
    async with httpx.AsyncClient(
        timeout=10, headers={"User-Agent": "Mozilla/5.0"}
    ) as client:
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
    closes = [c for _, c in points]
    price = meta["regularMarketPrice"]
    # Previous close = last hourly close on an earlier calendar day (exchange time).
    prev_close = price
    if points:
        last_day = points[-1][0] // 86400
        earlier = [c for t, c in points if t // 86400 < last_day]
        prev_close = earlier[-1] if earlier else points[0][1]
    change = price - prev_close
    return {
        "key": key,
        "name": name,
        "symbol": symbol,
        "prefix": prefix,
        "price": price,
        "change": change,
        "change_percent": (change / prev_close * 100) if prev_close else 0,
        "sparkline": closes[-40:],
    }


async def get_markets(keys: list[str]) -> list[dict]:
    keys = [k for k in keys if k in INSTRUMENTS]
    results = await asyncio.gather(*(_fetch_one(k) for k in keys), return_exceptions=True)
    out = []
    for key, r in zip(keys, results):
        if isinstance(r, Exception):
            out.append({"key": key, "name": INSTRUMENTS[key][1], "error": True})
        else:
            out.append(r)
    return out
