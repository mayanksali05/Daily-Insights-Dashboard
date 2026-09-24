"""Recently edited Notion pages via the official Notion API.

Setup (one time):
  1. Create an internal integration at https://www.notion.so/profile/integrations
     and copy its secret.
  2. Put it in backend/.env as NOTION_TOKEN=...
  3. In Notion, open each top-level page you want on the dashboard ->
     "..." menu -> Connections -> add your integration. Sub-pages are included.

The integration only sees pages you connect it to. The token stays on the
backend and is never sent to the browser.
"""
import httpx

from ..cache import ttl_cache
from ..config import settings

SEARCH_URL = "https://api.notion.com/v1/search"
NOTION_VERSION = "2022-06-28"


class NotionNotConfigured(Exception):
    pass


class NotionAuthError(Exception):
    pass


def _title(obj: dict) -> str:
    # Databases keep the title at the top level; pages keep it in their "title" property.
    parts = obj.get("title")
    if parts is None:
        for prop in (obj.get("properties") or {}).values():
            if prop.get("type") == "title":
                parts = prop.get("title")
                break
    text = "".join(p.get("plain_text", "") for p in (parts or [])).strip()
    return text or "Untitled"


def _icon(obj: dict) -> str | None:
    icon = obj.get("icon") or {}
    return icon.get("emoji") if icon.get("type") == "emoji" else None


@ttl_cache(lambda: settings.cache_ttl_notion)
async def get_recent(limit: int = 10) -> list[dict]:
    if not settings.notion_token:
        raise NotionNotConfigured()
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.post(
            SEARCH_URL,
            headers={
                "Authorization": f"Bearer {settings.notion_token}",
                "Notion-Version": NOTION_VERSION,
                "Content-Type": "application/json",
            },
            json={
                "sort": {"direction": "descending", "timestamp": "last_edited_time"},
                "page_size": limit,
            },
        )
    if res.status_code in (401, 403):
        raise NotionAuthError()
    res.raise_for_status()

    items = []
    for obj in res.json().get("results", []):
        if obj.get("archived") or obj.get("in_trash"):
            continue
        items.append(
            {
                "id": obj["id"],
                "type": obj.get("object"),  # "page" or "database"
                "title": _title(obj),
                "icon": _icon(obj),
                "url": obj.get("url"),
                "last_edited": obj.get("last_edited_time"),
            }
        )
    return items
