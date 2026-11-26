"""Pemeriksaan dependency yang wajib dan opsional sebelum API menerima request."""

from __future__ import annotations

import logging
from urllib.error import URLError
from urllib.request import urlopen

import redis
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.redis import get_redis
from app.db.session import engine

logger = logging.getLogger(__name__)


def _check_mysql() -> bool:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        logger.error("MySQL tidak tersedia (%s:%s): %s", settings.DB_HOST, settings.DB_PORT, exc.orig)
        return False
    logger.info("MySQL tersedia.")
    return True


def _check_rustfs() -> bool:
    endpoint = f"{settings.S3_ENDPOINT_URL.rstrip('/')}/minio/health/ready"
    try:
        with urlopen(endpoint, timeout=3) as response:
            if response.status < 200 or response.status >= 300:
                logger.error("RustFS tidak tersedia di %s (HTTP %s).", settings.S3_ENDPOINT_URL, response.status)
                return False
    except (OSError, URLError) as exc:
        logger.error("RustFS tidak tersedia di %s: %s", settings.S3_ENDPOINT_URL, exc)
        return False
    logger.info("RustFS tersedia.")
    return True


def _check_redis() -> None:
    try:
        get_redis().ping()
    except redis.RedisError as exc:
        logger.warning("Redis tidak tersedia; API tetap berjalan dan denylist JWT dinonaktifkan: %s", exc)
    else:
        logger.info("Redis tersedia.")


def check_startup_dependencies() -> bool:
    """Gagalkan startup untuk MySQL/RustFS, tetapi lanjutkan jika Redis mati."""
    mysql_ready = _check_mysql()
    rustfs_ready = _check_rustfs()
    _check_redis()
    return mysql_ready and rustfs_ready
