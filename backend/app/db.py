import re
from urllib.parse import quote_plus

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import settings

_client: AsyncIOMotorClient | None = None


def _escape_credentials(uri: str) -> str:
    """URL-encode the username/password in a MongoDB URI.

    Atlas passwords often contain @ : / ? # %, which must be percent-encoded
    (RFC 3986) or pymongo rejects the URI with InvalidURI. Parts that already
    contain %XX escapes are left alone so an encoded URI still works.
    """
    m = re.match(r"^(mongodb(?:\+srv)?://)(.*)$", uri.strip())
    if not m or "@" not in m.group(2):
        return uri
    scheme, rest = m.groups()
    userinfo, hosts = rest.rsplit("@", 1)  # host part never contains "@"
    user, sep, password = userinfo.partition(":")

    def enc(part: str) -> str:
        return part if re.search(r"%[0-9A-Fa-f]{2}", part) else quote_plus(part)

    return f"{scheme}{enc(user)}{sep}{enc(password) if sep else ''}@{hosts}"


def get_db() -> AsyncIOMotorDatabase:
    global _client
    if _client is None:
        # tz_aware: return UTC-aware datetimes so the API sends "...+00:00" and browsers
        # don't mistake UTC for local time (which showed new notes as "6h ago" in IST).
        # serverSelectionTimeoutMS: fail in 5 s (not 30 s) when the database is unreachable.
        _client = AsyncIOMotorClient(
            _escape_credentials(settings.mongodb_uri), tz_aware=True, serverSelectionTimeoutMS=5000
        )
    return _client[settings.mongodb_db]
