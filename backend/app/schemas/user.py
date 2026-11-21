from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    avatar_url: str | None = None
    is_active: bool
    roles: list[RoleOut] = []
    created_at: datetime
    updated_at: datetime


class UserRolesUpdate(BaseModel):
    roles: list[str] = Field(
        min_length=1,
        examples=[["admin", "staff"]],
        description="Daftar nama role pengganti (admin, staff, customer)",
    )


class UserStatusUpdate(BaseModel):
    is_active: bool
