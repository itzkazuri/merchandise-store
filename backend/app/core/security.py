"""Password hashing (Argon2) dan JWT (python-jose)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from enum import Enum
from uuid import uuid4

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from jose import JWTError, jwt

from app.core.config import settings

_hasher = PasswordHasher()


class TokenError(Exception):
    """Token JWT tidak valid atau kedaluwarsa."""


class TokenType(str, Enum):
    ACCESS = "access"
    REFRESH = "refresh"
    GOOGLE_STATE = "google_state"


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    try:
        _hasher.verify(password_hash, password)
        return True
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def password_needs_rehash(password_hash: str) -> bool:
    try:
        return _hasher.check_needs_rehash(password_hash)
    except InvalidHashError:
        return False


def _create_token(
    subject: str,
    token_type: TokenType,
    expires_delta: timedelta,
) -> tuple[str, str, datetime]:
    now = datetime.now(UTC)
    expires_at = now + expires_delta
    jti = uuid4().hex

    payload = {
        "sub": subject,
        "type": token_type.value,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "jti": jti,
    }
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token, jti, expires_at


def create_access_token(user_id: int) -> tuple[str, str, datetime]:
    return _create_token(
        str(user_id),
        TokenType.ACCESS,
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(user_id: int) -> tuple[str, str, datetime]:
    return _create_token(
        str(user_id),
        TokenType.REFRESH,
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


def create_google_state() -> str:
    token, _, _ = _create_token("google-oauth", TokenType.GOOGLE_STATE, timedelta(minutes=10))
    return token


def decode_token(token: str, expected_type: TokenType) -> dict:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError as exc:
        raise TokenError("Token tidak valid atau sudah kedaluwarsa") from exc

    if payload.get("type") != expected_type.value:
        raise TokenError("Tipe token tidak sesuai")

    if not payload.get("sub") or not payload.get("jti"):
        raise TokenError("Token tidak lengkap")

    return payload
