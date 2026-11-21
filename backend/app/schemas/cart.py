from decimal import Decimal

from pydantic import BaseModel, Field


class CartItemAdd(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(default=1, ge=1, le=999)


class CartItemUpdate(BaseModel):
    quantity: int = Field(ge=1, le=999)


class CartItemOut(BaseModel):
    id: int
    product_id: int
    name: str
    slug: str
    sku: str
    price: Decimal
    quantity: int
    stock: int
    image_key: str | None = None
    is_available: bool
    subtotal: Decimal


class CartOut(BaseModel):
    items: list[CartItemOut]
    item_count: int
    subtotal: Decimal
