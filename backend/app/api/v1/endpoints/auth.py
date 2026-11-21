from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, DbSession, bearer_scheme
from app.core.config import settings
from app.core.redis import is_token_revoked, revoke_token
from app.core.security import (
    TokenError,
    TokenType,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    password_needs_rehash,
    verify_password,
)
from app.models import Role, User
from app.schemas.auth import (
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.common import Message
from app.schemas.user import UserOut
from app.services.google_oauth import (
    GoogleOAuthError,
    build_authorization_url,
    exchange_code,
    fetch_userinfo,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue_tokens(user: User) -> TokenResponse:
    access_token, _, _ = create_access_token(user.id)
    refresh_token, _, _ = create_refresh_token(user.id)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


def _get_customer_role(db: Session) -> Role | None:
    return db.scalar(select(Role).where(Role.name == "customer"))


@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Registrasi customer baru",
)
def register(payload: RegisterRequest, db: DbSession) -> User:
    email = payload.email.lower()

    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email sudah terdaftar")

    user = User(
        name=payload.name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
    )

    customer_role = _get_customer_role(db)
    if customer_role is not None:
        user.roles.append(customer_role)

    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Email sudah terdaftar") from exc

    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse, summary="Login email + password")
def login(payload: LoginRequest, db: DbSession) -> TokenResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))

    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email atau password salah")

    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Akun tidak aktif")

    if user.password_hash and password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)
        db.commit()

    return _issue_tokens(user)


@router.post("/refresh", response_model=TokenResponse, summary="Tukar refresh token")
def refresh(payload: RefreshRequest, db: DbSession) -> TokenResponse:
    try:
        token_payload = decode_token(payload.refresh_token, TokenType.REFRESH)
    except TokenError as exc:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    if is_token_revoked(token_payload["jti"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token sudah dipakai atau dicabut")

    user = db.get(User, int(token_payload["sub"]))
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User tidak valid atau tidak aktif")

    # Rotasi: refresh token lama langsung dicabut.
    revoke_token(token_payload["jti"], token_payload["exp"])
    return _issue_tokens(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Logout (cabut token)")
def logout(
    _: CurrentUser,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    payload: LogoutRequest | None = None,
) -> Response:
    if credentials is not None:
        try:
            access_payload = decode_token(credentials.credentials, TokenType.ACCESS)
            revoke_token(access_payload["jti"], access_payload["exp"])
        except TokenError:
            pass

    if payload and payload.refresh_token:
        try:
            refresh_payload = decode_token(payload.refresh_token, TokenType.REFRESH)
            revoke_token(refresh_payload["jti"], refresh_payload["exp"])
        except TokenError:
            pass

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserOut, summary="Profil user yang sedang login")
def me(user: CurrentUser) -> User:
    return user


@router.get("/google/login", summary="Mulai login Google (redirect ke Google)")
def google_login() -> RedirectResponse:
    if not settings.google_oauth_enabled:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Login Google belum dikonfigurasi")
    return RedirectResponse(build_authorization_url(), status_code=status.HTTP_307_TEMPORARY_REDIRECT)


@router.get("/google/callback", summary="Callback Google OAuth")
async def google_callback(code: str, state: str, db: DbSession) -> RedirectResponse:
    if not settings.google_oauth_enabled:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Login Google belum dikonfigurasi")

    try:
        decode_token(state, TokenType.GOOGLE_STATE)
    except TokenError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"State OAuth tidak valid: {exc}") from exc

    if not code:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Authorization code tidak ada")

    try:
        token_data = await exchange_code(code)
        profile = await fetch_userinfo(token_data["access_token"])
    except (GoogleOAuthError, KeyError) as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Login Google gagal: {exc}") from exc

    email = str(profile.get("email", "")).lower()
    if not email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Akun Google tidak memiliki email")

    if not profile.get("email_verified", True):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email Google belum diverifikasi")

    google_id = profile.get("sub")

    user = db.scalar(select(User).where(User.google_id == google_id)) if google_id else None
    if user is None:
        user = db.scalar(select(User).where(User.email == email))

    if user is None:
        user = User(
            name=profile.get("name") or email.split("@")[0],
            email=email,
            avatar_url=profile.get("picture"),
            google_id=google_id,
            is_active=True,
        )
        customer_role = _get_customer_role(db)
        if customer_role is not None:
            user.roles.append(customer_role)
        db.add(user)
    else:
        user.google_id = user.google_id or google_id
        user.avatar_url = user.avatar_url or profile.get("picture")

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Akun Google gagal disimpan") from exc

    db.refresh(user)

    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Akun tidak aktif")

    tokens = _issue_tokens(user)
    separator = "&" if "?" in settings.GOOGLE_FRONTEND_REDIRECT_URI else "?"
    redirect_url = (
        f"{settings.GOOGLE_FRONTEND_REDIRECT_URI}{separator}"
        f"access_token={tokens.access_token}&refresh_token={tokens.refresh_token}"
        f"&token_type={tokens.token_type}&expires_in={tokens.expires_in}"
    )
    return RedirectResponse(redirect_url, status_code=status.HTTP_302_FOUND)


@router.get("/session-check", response_model=Message, summary="Cek token masih berlaku")
def session_check(_: CurrentUser) -> Message:
    return Message(detail="Token valid")
