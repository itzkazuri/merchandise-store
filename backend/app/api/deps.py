"""Dependency FastAPI: sesi DB, autentikasi JWT, dan otorisasi berbasis role."""

from __future__ import annotations

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.redis import is_token_revoked
from app.core.security import TokenError, TokenType, decode_token
from app.db.session import get_db
from app.models import User

bearer_scheme = HTTPBearer(
    auto_error=False,
    description="JWT access token dari endpoint login",
)

DbSession = Annotated[Session, Depends(get_db)]

# admin otomatis punya akses staff & customer, staff punya akses customer.
ROLE_HIERARCHY: dict[str, set[str]] = {
    "admin": {"admin", "staff", "customer"},
    "staff": {"staff", "customer"},
    "customer": {"customer"},
}


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _resolve_user(token: str, db: Session, expected: TokenType = TokenType.ACCESS) -> User:
    try:
        payload = decode_token(token, expected)
    except TokenError as exc:
        raise _unauthorized(str(exc)) from exc

    if is_token_revoked(payload["jti"]):
        raise _unauthorized("Token sudah tidak berlaku, silakan login ulang")

    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError) as exc:
        raise _unauthorized("Token tidak valid") from exc

    user = db.get(User, user_id)
    if user is None:
        raise _unauthorized("User tidak ditemukan")
    return user


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: DbSession,
) -> User:
    if credentials is None or not credentials.credentials:
        raise _unauthorized("Token akses tidak dikirim")
    return _resolve_user(credentials.credentials, db)


def get_current_active_user(user: Annotated[User, Depends(get_current_user)]) -> User:
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akun tidak aktif",
        )
    return user


def get_optional_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: DbSession,
) -> User | None:
    """Untuk endpoint publik: token invalid dianggap sebagai tamu."""
    if credentials is None or not credentials.credentials:
        return None
    try:
        user = _resolve_user(credentials.credentials, db)
    except HTTPException:
        return None
    return user if user.is_active else None


def user_role_names(user: User) -> set[str]:
    return {role.name for role in user.roles}


def effective_roles(user: User) -> set[str]:
    granted: set[str] = set()
    for role_name in user_role_names(user):
        granted |= ROLE_HIERARCHY.get(role_name, {role_name})
    return granted


def require_roles(*required: str) -> Callable[..., User]:
    """Buat dependency yang hanya lolos untuk role tertentu (dengan hierarki)."""
    allowed = set(required)

    def dependency(user: Annotated[User, Depends(get_current_active_user)]) -> User:
        if allowed and not (effective_roles(user) & allowed):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Anda tidak punya akses ke resource ini",
            )
        return user

    return dependency


CurrentUser = Annotated[User, Depends(get_current_active_user)]
OptionalUser = Annotated[User | None, Depends(get_optional_user)]
AdminUser = Annotated[User, Depends(require_roles("admin"))]
StaffUser = Annotated[User, Depends(require_roles("staff"))]
