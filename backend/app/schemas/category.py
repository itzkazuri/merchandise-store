from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

CategoryKind = Literal["anime", "product"]


class CategoryCreate(BaseModel):
    kind: CategoryKind = Field(description="anime = seri asal, product = jenis barang")
    name: str = Field(min_length=1, max_length=120, examples=["Jujutsu Kaisen", "Gantungan kunci"])
    slug: str | None = Field(default=None, max_length=140, description="Kosongkan untuk auto-generate dari nama")
    description: str | None = None
    is_active: bool = True
    sort_order: int = Field(default=0, ge=0)

    @field_validator("slug")
    @classmethod
    def empty_slug_to_none(cls, value: str | None) -> str | None:
        return value or None

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        return value.strip()


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    slug: str | None = Field(default=None, max_length=140)
    description: str | None = None
    is_active: bool | None = None
    sort_order: int | None = Field(default=None, ge=0)

    @field_validator("slug")
    @classmethod
    def empty_slug_to_none(cls, value: str | None) -> str | None:
        return value or None

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: CategoryKind
    name: str
    slug: str
    description: str | None = None
    is_active: bool
    sort_order: int
    product_count: int = 0
    created_at: datetime
    updated_at: datetime
