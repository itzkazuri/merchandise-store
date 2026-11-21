from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.category import CategoryOut

ProductType = Literal["imported", "handmade"]
ProductStatus = Literal["draft", "active", "archived"]


class ProductImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    object_key: str
    alt_text: str | None = None
    is_primary: bool
    sort_order: int
    created_at: datetime


class ProductImageCreate(BaseModel):
    object_key: str = Field(
        max_length=500,
        examples=["products/2026/11/figur-gojo.webp"],
        description="Path object di RustFS/S3",
    )
    alt_text: str | None = Field(default=None, max_length=255)
    is_primary: bool = False
    sort_order: int = Field(default=0, ge=0)


class ProductImageUpdate(BaseModel):
    alt_text: str | None = Field(default=None, max_length=255)
    is_primary: bool | None = None
    sort_order: int | None = Field(default=None, ge=0)


class ProductCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255, examples=["Figur Gojo Satoru 30cm"])
    slug: str | None = Field(default=None, max_length=255, description="Kosongkan untuk auto-generate dari nama")
    sku: str = Field(min_length=1, max_length=100, examples=["FIG-GOJO-30"])
    description: str | None = None
    product_type: ProductType = "imported"
    price: Decimal = Field(ge=0, max_digits=15, decimal_places=2, examples=["250000.00"])
    stock: int = Field(default=0, ge=0)
    status: ProductStatus = "draft"
    anime_id: int | None = Field(default=None, description="ID kategori kind=anime")
    category_id: int | None = Field(default=None, description="ID kategori kind=product")
    images: list[ProductImageCreate] = Field(default_factory=list)

    @field_validator("slug")
    @classmethod
    def empty_slug_to_none(cls, value: str | None) -> str | None:
        return value or None


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    slug: str | None = Field(default=None, max_length=255)
    sku: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    product_type: ProductType | None = None
    price: Decimal | None = Field(default=None, ge=0, max_digits=15, decimal_places=2)
    stock: int | None = Field(default=None, ge=0)
    status: ProductStatus | None = None
    anime_id: int | None = None
    category_id: int | None = None

    @field_validator("slug")
    @classmethod
    def empty_slug_to_none(cls, value: str | None) -> str | None:
        return value or None


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)


    id: int
    name: str
    slug: str
    sku: str
    description: str | None = None
    product_type: ProductType
    price: Decimal
    stock: int
    sold_count: int
    status: ProductStatus
    anime: CategoryOut | None = None
    category: CategoryOut | None = None
    images: list[ProductImageOut] = []
    like_count: int = 0
    is_liked: bool = False
    created_at: datetime
    updated_at: datetime


class LikeStatus(BaseModel):
    liked: bool
    like_count: int


class ProductFilters(BaseModel):
    product_types: list[str]
    sort_options: list[str]
    animes: list[CategoryOut]
    product_categories: list[CategoryOut]
    price_min: Decimal | None = None
    price_max: Decimal | None = None
