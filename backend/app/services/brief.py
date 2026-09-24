"""AI Daily Brief - modular provider design.

To plug in an LLM later:
  1. Implement `LLMBriefProvider.generate` (call your model with `headlines`).
  2. Set BRIEF_PROVIDER=llm and LLM_API_KEY in backend/.env.
The router and frontend need no changes: they only consume the dict returned
by `get_brief`.
"""
from datetime import datetime, timezone
from typing import Protocol

from ..cache import ttl_cache
from ..config import settings
from . import news

CATEGORY_LABELS = {"world": "World", "india": "India", "tech": "Tech", "ai": "AI"}


class BriefProvider(Protocol):
    name: str

    async def generate(self, headlines: dict[str, list[dict]]) -> dict: ...


class ExtractiveBriefProvider:
    """No-LLM fallback: surfaces the top headline(s) per category."""

    name = "extractive"

    async def generate(self, headlines: dict[str, list[dict]]) -> dict:
        bullets = []
        for cat, items in headlines.items():
            for item in items[:1]:
                bullets.append(
                    {
                        "category": CATEGORY_LABELS.get(cat, cat),
                        "text": item["title"],
                        "url": item["url"],
                        "source": item["source"],
                    }
                )
        summary = (
            f"{len(bullets)} top stories across {len(headlines)} topics today."
            if bullets
            else "No headlines available right now."
        )
        return {"summary": summary, "bullets": bullets}


class LLMBriefProvider:
    """Placeholder - connect your LLM here."""

    name = "llm"

    async def generate(self, headlines: dict[str, list[dict]]) -> dict:
        # Example: build a prompt from `headlines`, call the model using
        # settings.llm_api_key, and return {"summary": str, "bullets": [...]}.
        raise NotImplementedError("LLM brief provider is not implemented yet")


def _provider() -> BriefProvider:
    return LLMBriefProvider() if settings.brief_provider == "llm" else ExtractiveBriefProvider()


@ttl_cache(lambda: settings.cache_ttl_news)
async def get_brief() -> dict:
    headlines = {c: await news.get_news(c, 2) for c in CATEGORY_LABELS}
    provider = _provider()
    try:
        body = await provider.generate(headlines)
    except NotImplementedError:
        provider = ExtractiveBriefProvider()
        body = await provider.generate(headlines)
    return {
        **body,
        "provider": provider.name,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
