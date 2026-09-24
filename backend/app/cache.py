"""Tiny in-memory TTL cache. Good enough for a single-process MVP."""
import time
from functools import wraps
from typing import Any, Awaitable, Callable

_store: dict[str, tuple[float, Any]] = {}


def ttl_cache(ttl_getter: Callable[[], int]):
    """Cache an async function's result keyed by its arguments."""

    def decorator(fn: Callable[..., Awaitable[Any]]):
        @wraps(fn)
        async def wrapper(*args, **kwargs):
            key = f"{fn.__module__}.{fn.__name__}:{args}:{sorted(kwargs.items())}"
            hit = _store.get(key)
            now = time.monotonic()
            if hit and now - hit[0] < ttl_getter():
                return hit[1]
            value = await fn(*args, **kwargs)
            _store[key] = (now, value)
            return value

        return wrapper

    return decorator
