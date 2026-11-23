from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status
from fastapi import status as http_status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError

from app.api.deps import AdminUser, CurrentUser, DbSession
from app.core.security import hash_password, verify_password
from app.models import Role, User
from app.schemas.common import Page
from app.schemas.user import (
    UserCreate,
    UserOut,
    UserProfileUpdate,
    UserRolesUpdate,
    UserStatusUpdate,
)

router = APIRouter(prefix="/users", tags=["users (admin)"])

# Endpoint admin/staff tidak meng-index akun customer.
MANAGED_ROLES = {"admin", "staff"}


@router.get("", response_model=Page[UserOut], summary="Daftar user (admin)")
def list_users(
    admin: AdminUser,
    db: DbSession,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    q: str | None = Query(None, max_length=100, description="Cari nama atau email"),
    role: str | None = Query(None, description="Filter role: admin / staff"),
    is_active: bool | None = Query(None),
) -> Page[UserOut]:
    stmt = select(User).where(User.roles.any(Role.name.in_(MANAGED_ROLES)))

    if q:
        keyword = f"%{q.strip()}%"
        stmt = stmt.where(or_(User.name.ilike(keyword), User.email.ilike(keyword)))

    if role:
        if role not in MANAGED_ROLES:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Endpoint ini hanya mengelola akun admin/staff",
            )
        stmt = stmt.where(User.roles.any(Role.name == role))

    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = db.scalars(
        stmt.order_by(User.id.desc()).offset((page - 1) * size).limit(size)
    ).all()

    return Page[UserOut].build(
        items=[UserOut.model_validate(item) for item in items],
        total=total,
        page=page,
        size=size,
    )


@router.post(
    "",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Buat user admin atau staff baru",
)
def create_user(
    payload: UserCreate,
    admin: AdminUser,
    db: DbSession,
) -> User:
    email = payload.email.lower()
    if payload.role not in MANAGED_ROLES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Role harus salah satu dari: {', '.join(MANAGED_ROLES)}",
        )

    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email sudah terdaftar")

    role = db.scalar(select(Role).where(Role.name == payload.role))
    if role is None:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"Role '{payload.role}' tidak ditemukan di sistem",
        )

    new_user = User(
        name=payload.name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        is_active=True,
    )
    new_user.roles.append(role)
    db.add(new_user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Email sudah terdaftar") from exc

    db.refresh(new_user)
    return new_user


@router.get("/me", response_model=UserOut, summary="Profil user yang sedang login")
def get_my_profile(current_user: CurrentUser) -> User:
    return current_user


@router.patch("/me", response_model=UserOut, summary="Update profil user sendiri (nama & password)")
def update_my_profile(
    payload: UserProfileUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> User:
    updated = False

    if payload.name is not None:
        clean_name = payload.name.strip()
        if len(clean_name) < 2:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nama minimal 2 karakter")
        current_user.name = clean_name
        updated = True

    if payload.new_password is not None:
        if not payload.current_password:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Harap masukkan kata sandi saat ini untuk mengganti kata sandi",
            )
        if not verify_password(payload.current_password, current_user.password_hash):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Kata sandi saat ini tidak cocok",
            )
        if len(payload.new_password) < 8:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Kata sandi baru minimal 8 karakter",
            )
        current_user.password_hash = hash_password(payload.new_password)
        updated = True

    if not updated:
        return current_user

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/{user_id}", response_model=UserOut, summary="Detail user (admin)")
def get_user(user_id: int, admin: AdminUser, db: DbSession) -> User:
    user = db.get(User, user_id)
    if user is None or not ({role.name for role in user.roles} & MANAGED_ROLES):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Akun admin/staff tidak ditemukan")
    return user


@router.patch("/{user_id}/roles", response_model=UserOut, summary="Ganti role user (admin)")
def update_user_roles(
    user_id: int,
    payload: UserRolesUpdate,
    admin: AdminUser,
    db: DbSession,
) -> User:
    target = db.get(User, user_id)
    if target is None or not ({role.name for role in target.roles} & MANAGED_ROLES):
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Akun admin/staff tidak ditemukan")

    requested = list(dict.fromkeys(payload.roles))
    invalid = sorted(set(requested) - MANAGED_ROLES)
    if invalid:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Role yang boleh diatur hanya admin/staff: {', '.join(invalid)} tidak diizinkan",
        )

    roles = list(db.scalars(select(Role).where(Role.name.in_(requested))).all())

    if target.id == admin.id and "admin" not in requested:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Tidak bisa menghapus role admin dari akun sendiri",
        )

    target.roles = roles
    db.commit()
    db.refresh(target)
    return target


@router.patch("/{user_id}/status", response_model=UserOut, summary="Aktif/nonaktifkan user (admin)")
def update_user_status(
    user_id: int,
    payload: UserStatusUpdate,
    admin: AdminUser,
    db: DbSession,
) -> User:
    target = db.get(User, user_id)
    if target is None or not ({role.name for role in target.roles} & MANAGED_ROLES):
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Akun admin/staff tidak ditemukan")

    if target.id == admin.id and not payload.is_active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Tidak bisa menonaktifkan akun sendiri")

    target.is_active = payload.is_active
    db.commit()
    db.refresh(target)
    return target
