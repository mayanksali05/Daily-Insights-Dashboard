from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import settings

_client: AsyncIOMotorClient | None = None


def get_db() -> AsyncIOMotorDatabase:
    global _client
    if _client is None:
        # tz_aware: return UTC-aware datetimes so the API sends "...+00:00" and browsers
        # don't mistake UTC for local time (which showed new notes as "6h ago" in IST).
        _client = AsyncIOMotorClient(settings.mongodb_uri, tz_aware=True)
    return _client[settings.mongodb_db]
