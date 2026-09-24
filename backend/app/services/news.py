"""News via public RSS feeds (no API key). Edit FEEDS to change sources."""
import asyncio
import re
from calendar import timegm
from datetime import datetime, timezone
from html import unescape

import feedparser
import httpx

from ..cache import ttl_cache
from ..config import settings

FEEDS: dict[str, list[tuple[str, str]]] = {
    "world": [
        ("BBC News", "https://feeds.bbci.co.uk/news/world/rss.xml"),
        ("Al Jazeera", "https://www.aljazeera.com/xml/rss/all.xml"),
    ],
    "india": [
        ("The Hindu", "https://www.thehindu.com/news/national/feeder/default.rss"),
        ("Times of India", "https://timesofindia.indiatimes.com/rssfeedstopstories.cms"),
    ],
    "tech": [
        ("TechCrunch", "https://techcrunch.com/feed/"),
        ("The Verge", "https://www.theverge.com/rss/index.xml"),
    ],
    "ai": [
        ("TechCrunch AI", "https://techcrunch.com/category/artificial-intelligence/feed/"),
        ("VentureBeat", "https://venturebeat.com/category/ai/feed/"),
    ],
}

_TAG = re.compile(r"<[^>]+>")


def _clean(text: str, limit: int = 220) -> str:
    text = unescape(_TAG.sub("", text or "")).strip()
    text = re.sub(r"\s+", " ", text)
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def _parse(source: str, raw: str) -> list[dict]:
    items = []
    for e in feedparser.parse(raw).entries:
        ts = e.get("published_parsed") or e.get("updated_parsed")
        published = (
            datetime.fromtimestamp(timegm(ts), tz=timezone.utc).isoformat() if ts else None
        )
        if not e.get("title") or not e.get("link"):
            continue
        items.append(
            {
                "title": _clean(e["title"], 160),
                "description": _clean(e.get("summary", "")),
                "source": source,
                "url": e["link"],
                "published_at": published,
            }
        )
    return items


async def _fetch_feed(client: httpx.AsyncClient, source: str, url: str) -> list[dict]:
    res = await client.get(url)
    res.raise_for_status()
    return _parse(source, res.text)


@ttl_cache(lambda: settings.cache_ttl_news)
async def get_news(category: str, limit: int = 4) -> list[dict]:
    feeds = FEEDS.get(category)
    if not feeds:
        return []
    async with httpx.AsyncClient(
        timeout=10, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0"}
    ) as client:
        results = await asyncio.gather(
            *(_fetch_feed(client, s, u) for s, u in feeds), return_exceptions=True
        )
    # Interleave sources so one outlet doesn't dominate, keep newest first within each.
    per_source = [
        sorted((r for r in res), key=lambda i: i["published_at"] or "", reverse=True)
        for res in results
        if not isinstance(res, Exception)
    ]
    merged, seen = [], set()
    for i in range(max((len(p) for p in per_source), default=0)):
        for p in per_source:
            if i < len(p) and p[i]["url"] not in seen:
                seen.add(p[i]["url"])
                merged.append(p[i])
    return merged[:limit]
