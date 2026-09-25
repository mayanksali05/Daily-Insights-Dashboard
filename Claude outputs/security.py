"""Password hashing, secret encryption and session-token signing (stdlib + cryptography)."""
import base64
import hashlib
import hmac
import logging
import os

from cryptography.fernet import Fernet, InvalidToken

from .config import settings

log = logging.getLogger("uvicorn.error")

_DEV_SECRET = "dev-only-secret-change-me"
if not settings.secret_key:
    log.warning("SECRET_KEY is not set; using an insecure development key.")


def _secret() -> bytes:
    return (settings.secret_key or _DEV_SECRET).encode()


# ---------- passwords (scrypt) ----------

_N, _R, _P = 2**14, 8, 1


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=_N, r=_R, p=_P, dklen=32)
    return "scrypt${}${}${}${}${}".format(
        _N, _R, _P, base64.b64encode(salt).decode(), base64.b64encode(digest).decode()
    )


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, n, r, p, salt_b64, hash_b64 = stored.split("$")
        if algo != "scrypt":
            return False
        digest = hashlib.scrypt(
            password.encode(), salt=base64.b64decode(salt_b64), n=int(n), r=int(r), p=int(p), dklen=32
        )
        return hmac.compare_digest(digest, base64.b64decode(hash_b64))
    except (ValueError, TypeError):
        return False


# Used to spend the same time on unknown emails as on wrong passwords.
DUMMY_HASH = hash_password("timing-equaliser")


# ---------- encryption of stored secrets (each user's Notion token) ----------

def _fernet() -> Fernet:
    key = hashlib.sha256(b"notion-token:" + _secret()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(value: str | None) -> str:
    """Empty string if missing or undecryptable (e.g. SECRET_KEY was changed)."""
    if not value:
        return ""
    try:
        return _fernet().decrypt(value.encode()).decode()
    except (InvalidToken, ValueError):
        return ""


# ---------- signed session tokens: "<user_id>.<version>.<expires>.<signature>" ----------

def _sig(payload: str) -> str:
    key = hashlib.sha256(b"session:" + _secret()).digest()
    return hmac.new(key, payload.encode(), hashlib.sha256).hexdigest()


def sign_session(user_id: str, version: int, expires: int) -> str:
    payload = f"{user_id}.{version}.{expires}"
    return f"{payload}.{_sig(payload)}"


def read_session(token: str | None, now: float) -> tuple[str, int] | None:
    """(user_id, version) if the token is authentic and unexpired, else None."""
    if not token or token.count(".") != 3:
        return None
    user_id, version, expires, sig = token.split(".")
    if not (version.isdigit() and expires.isdigit()) or int(expires) < now:
        return None
    if not hmac.compare_digest(sig, _sig(f"{user_id}.{version}.{expires}")):
        return None
    return user_id, int(version)
