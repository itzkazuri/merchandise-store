"""Redis client + denylist token (logout / refresh rotation).

Kalau Redis tidak tersedia, aplikasi tetap jalan: token yang di-revoke tidak
tercatat dan hanya mengandalkan masa berlaku JWT. Kegagalan Redis dicatat di log.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from functools import lru_cache

import redis

from app.core.config import settings

logger = logging.getLogger(__name__)

_DENYLIST_PREFIX = "jwt:denylist:"


@lru_cache
def get_redis() -> redis.Redis:
    return redis.from_url(
        settings.REDIS_URL,
        decode_responses=True,
        socket_connect_timeout=3,
        socket_timeout=3,
    )


def _ttl_seconds(expires_at: datetime | int | float) -> int:
    if isinstance(expires_at, datetime):
        moment = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=UTC)
        return int((moment - datetime.now(UTC)).total_seconds())
    return int(expires_at - datetime.now(UTC).timestamp())


def revoke_token(jti: str, expires_at: datetime | int | float) -> None:
    ttl = _ttl_seconds(expires_at)
    if ttl <= 0:
        return
    try:
        get_redis().set(f"{_DENYLIST_PREFIX}{jti}", "1", ex=ttl)
    except redis.RedisError as exc:  # pragma: no cover - hanya saat Redis down
        logger.warning("Gagal menyimpan token ke denylist Redis: %s", exc)


def is_token_revoked(jti: str) -> bool:
    try:
        return bool(get_redis().exists(f"{_DENYLIST_PREFIX}{jti}"))
    except redis.RedisError as exc:  # pragma: no cover - hanya saat Redis down
        logger.warning("Gagal mengecek denylist Redis: %s", exc)
        return False
