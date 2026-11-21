from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, HTTPException, Response
from fastapi import status as http_status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.models import Cart, CartItem, Product, User
from app.schemas.cart import CartItemAdd, CartItemOut, CartItemUpdate, CartOut

router = APIRouter(prefix="/cart", tags=["cart"])


def _get_or_create_cart(db, user: User) -> Cart:
    cart = db.scalar(select(Cart).where(Cart.user_id == user.id))
    if cart is None:
        cart = Cart(user_id=user.id)
        db.add(cart)
        db.commit()
        db.refresh(cart)
    return cart


def _primary_image_key(product: Product) -> str | None:
    for image in product.images:
        if image.is_primary:
            return image.object_key
    return product.images[0].object_key if product.images else None


def _cart_out(cart: Cart) -> CartOut:
    items: list[CartItemOut] = []
    subtotal = Decimal("0.00")
    item_count = 0

    for item in cart.items:
        product = item.product
        if product is None:
            continue

        line_total = product.price * item.quantity
        subtotal += line_total
        item_count += item.quantity

        items.append(
            CartItemOut(
                id=item.id,
                product_id=product.id,
                name=product.name,
                slug=product.slug,
                sku=product.sku,
                price=product.price,
                quantity=item.quantity,
                stock=product.stock,
                image_key=_primary_image_key(product),
                is_available=product.status == "active" and product.stock >= item.quantity,
                subtotal=line_total,
            )
        )

    return CartOut(items=items, item_count=item_count, subtotal=subtotal)


@router.get("", response_model=CartOut, summary="Isi keranjang")
def get_cart(user: CurrentUser, db: DbSession) -> CartOut:
    cart = _get_or_create_cart(db, user)
    return _cart_out(cart)


@router.post(
    "/items",
    response_model=CartOut,
    status_code=http_status.HTTP_201_CREATED,
    summary="Tambah produk ke keranjang",
)
def add_cart_item(payload: CartItemAdd, user: CurrentUser, db: DbSession) -> CartOut:
    product = db.get(Product, payload.product_id)
    if product is None or product.status != "active":
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Produk tidak tersedia")

    cart = _get_or_create_cart(db, user)
    existing = next((item for item in cart.items if item.product_id == product.id), None)
    new_quantity = (existing.quantity if existing else 0) + payload.quantity

    if new_quantity > product.stock:
        raise HTTPException(
            http_status.HTTP_409_CONFLICT,
            f"Stok tidak cukup, tersisa {product.stock}",
        )

    if existing is not None:
        existing.quantity = new_quantity
    else:
        db.add(CartItem(cart_id=cart.id, product_id=product.id, quantity=new_quantity))

    db.commit()
    db.refresh(cart)
    return _cart_out(cart)


@router.patch(
    "/items/{item_id}",
    response_model=CartOut,
    summary="Ubah jumlah item keranjang",
)
def update_cart_item(
    item_id: int,
    payload: CartItemUpdate,
    user: CurrentUser,
    db: DbSession,
) -> CartOut:
    cart = _get_or_create_cart(db, user)
    item = next((entry for entry in cart.items if entry.id == item_id), None)
    if item is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Item keranjang tidak ditemukan")

    if payload.quantity > item.product.stock:
        raise HTTPException(
            http_status.HTTP_409_CONFLICT,
            f"Stok tidak cukup, tersisa {item.product.stock}",
        )

    item.quantity = payload.quantity
    db.commit()
    db.refresh(cart)
    return _cart_out(cart)


@router.delete(
    "/items/{item_id}",
    status_code=http_status.HTTP_204_NO_CONTENT,
    summary="Hapus item dari keranjang",
)
def remove_cart_item(item_id: int, user: CurrentUser, db: DbSession) -> Response:
    cart = _get_or_create_cart(db, user)
    item = next((entry for entry in cart.items if entry.id == item_id), None)
    if item is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Item keranjang tidak ditemukan")

    db.delete(item)
    db.commit()
    return Response(status_code=http_status.HTTP_204_NO_CONTENT)


@router.delete("", status_code=http_status.HTTP_204_NO_CONTENT, summary="Kosongkan keranjang")
def clear_cart(user: CurrentUser, db: DbSession) -> Response:
    cart = _get_or_create_cart(db, user)
    for item in list(cart.items):
        db.delete(item)
    db.commit()
    return Response(status_code=http_status.HTTP_204_NO_CONTENT)
