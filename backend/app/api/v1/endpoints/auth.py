from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, DbSession, _resolve_user, bearer_scheme
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
ACCESS_COOKIE = "merch_access"
REFRESH_COOKIE = "merch_refresh"


def _set_auth_cookies(response: Response, tokens: TokenResponse) -> None:
    common = {"secure": settings.auth_cookie_secure, "httponly": True, "samesite": settings.cookie_samesite, "path": "/"}
    response.set_cookie(ACCESS_COOKIE, tokens.access_token, max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60, **common)
    response.set_cookie(REFRESH_COOKIE, tokens.refresh_token, max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400, **common)


def _clear_auth_cookies(response: Response) -> None:
    for name in (ACCESS_COOKIE, REFRESH_COOKIE):
        response.delete_cookie(name, path="/", secure=settings.auth_cookie_secure, httponly=True, samesite=settings.cookie_samesite)


def _check_origin(request: Request, *, required: bool = False) -> None:
    origin = request.headers.get("origin")
    if (required and not origin) or (origin and origin not in settings.cors_origins):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Origin tidak diizinkan")


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


def _authenticate_admin(payload: LoginRequest, db: Session) -> User:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))

    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email atau password salah")

    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Akun tidak aktif")

    role_names = {r.name for r in user.roles}
    if not role_names.intersection({"admin", "staff"}):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Akses ditolak. Pengguna reguler silakan masuk menggunakan Google OAuth. Form ini khusus akun administrator dan staf.",
        )

    if user.password_hash and password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)
        db.commit()

    return user


@router.post(
    "/register",
    response_model=Message,
    status_code=status.HTTP_403_FORBIDDEN,
    summary="Registrasi manual customer (dinonaktifkan)",
)
def register(payload: RegisterRequest | None = None) -> Message:
    raise HTTPException(
        status.HTTP_403_FORBIDDEN,
        "Pendaftaran manual dinonaktifkan. Pengguna reguler dapat langsung masuk menggunakan akun Google.",
    )


@router.post("/login", response_model=Message, summary="Login kredensial admin/staff")
def login(payload: LoginRequest, request: Request, response: Response, db: DbSession) -> Message:
    _check_origin(request, required=True)
    user = _authenticate_admin(payload, db)
    tokens = _issue_tokens(user)
    _set_auth_cookies(response, tokens)
    return Message(detail="Login administrator berhasil")


@router.post("/admin/login", response_model=Message, summary="Endpoint khusus login admin/staff")
def admin_login(payload: LoginRequest, request: Request, response: Response, db: DbSession) -> Message:
    return login(payload, request, response, db)


@router.post("/refresh", response_model=Message, summary="Perbarui sesi")
def refresh(request: Request, response: Response, db: DbSession) -> Message:
    _check_origin(request, required=True)
    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token tidak dikirim")
    try:
        token_payload = decode_token(token, TokenType.REFRESH)
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
    tokens = _issue_tokens(user)
    _set_auth_cookies(response, tokens)
    return Message(detail="Sesi diperbarui")


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Logout (cabut token)")
def logout(
    request: Request,
    response: Response,
    _: CurrentUser,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> Response:
    _check_origin(request, required=True)
    if credentials is not None:
        try:
            access_payload = decode_token(credentials.credentials, TokenType.ACCESS)
            revoke_token(access_payload["jti"], access_payload["exp"])
        except TokenError:
            pass

    refresh_token = request.cookies.get(REFRESH_COOKIE)
    if refresh_token:
        try:
            refresh_payload = decode_token(refresh_token, TokenType.REFRESH)
            revoke_token(refresh_payload["jti"], refresh_payload["exp"])
        except TokenError:
            pass

    _clear_auth_cookies(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me", response_model=UserOut, summary="Profil user yang sedang login")
def me(user: CurrentUser) -> User:
    return user


@router.post("/session", response_model=UserOut | None, summary="Muat sesi tanpa error untuk pengunjung anonim")
def load_session(request: Request, response: Response, db: DbSession) -> User | None:
    """Validasi atau perbarui cookie sesi; pengunjung anonim mendapat 200 + null."""
    _check_origin(request, required=True)

    access_token = request.cookies.get(ACCESS_COOKIE)
    if access_token:
        try:
            user = _resolve_user(access_token, db)
            if user.is_active:
                return user
        except HTTPException:
            pass

    refresh_token = request.cookies.get(REFRESH_COOKIE)
    if not refresh_token:
        _clear_auth_cookies(response)
        return None

    try:
        token_payload = decode_token(refresh_token, TokenType.REFRESH)
    except TokenError:
        _clear_auth_cookies(response)
        return None

    if is_token_revoked(token_payload["jti"]):
        _clear_auth_cookies(response)
        return None

    try:
        user_id = int(token_payload["sub"])
    except (TypeError, ValueError):
        _clear_auth_cookies(response)
        return None

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        _clear_auth_cookies(response)
        return None

    # Rotasi refresh hanya untuk sesi yang masih valid.
    revoke_token(token_payload["jti"], token_payload["exp"])
    _set_auth_cookies(response, _issue_tokens(user))
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
    response = RedirectResponse(settings.GOOGLE_FRONTEND_REDIRECT_URI, status_code=status.HTTP_302_FOUND)
    _set_auth_cookies(response, tokens)
    return response


@router.get("/session-check", response_model=Message, summary="Cek token masih berlaku")
def session_check(_: CurrentUser) -> Message:
    return Message(detail="Token valid")
