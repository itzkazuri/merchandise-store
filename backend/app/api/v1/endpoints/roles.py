from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import AdminUser, DbSession
from app.models import Role
from app.schemas.user import RoleOut

router = APIRouter(prefix="/roles", tags=["roles (admin)"])


class RoleCreate(BaseModel):
    name: str = Field(min_length=2, max_length=50, examples=["finance"])
    description: str | None = Field(default=None, max_length=255)


@router.get("", response_model=list[RoleOut], summary="Daftar role (admin)")
def list_roles(admin: AdminUser, db: DbSession) -> list[Role]:
    return list(db.scalars(select(Role).order_by(Role.id)).all())


@router.post("", response_model=RoleOut, status_code=status.HTTP_201_CREATED, summary="Tambah role (admin)")
def create_role(payload: RoleCreate, admin: AdminUser, db: DbSession) -> Role:
    name = payload.name.strip().lower()

    if db.scalar(select(Role.id).where(Role.name == name)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Role sudah ada")

    role = Role(name=name, description=payload.description)
    db.add(role)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Role sudah ada") from exc

    db.refresh(role)
    return role
