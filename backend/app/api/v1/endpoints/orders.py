from __future__ import annotations

import secrets
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query
from fastapi import status as http_status
from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, DbSession
from app.core.config import settings
from app.models import Cart, CartItem, Order, OrderItem, Product
from app.schemas.common import Page
from app.schemas.order import CheckoutRequest, OrderOut, OrderStatus
from app.services.midtrans import cancel_midtrans_transaction

router = APIRouter(prefix="/orders", tags=["orders"])


def serialize_order(order: Order) -> OrderOut:
    return OrderOut.model_validate(order).model_copy(
        update={"user_email": order.user.email if order.user else None}
    )


def generate_order_number(db: Session) -> str:
    day = datetime.now(UTC).strftime("%Y%m%d")
    for _ in range(5):
        candidate = f"{settings.ORDER_PREFIX}-{day}-{secrets.token_hex(4).upper()}"
        if db.scalar(select(Order.id).where(Order.order_number == candidate)) is None:
            return candidate
    raise HTTPException(
        http_status.HTTP_500_INTERNAL_SERVER_ERROR,
        "Gagal membuat nomor pesanan, coba lagi",
    )


def get_owned_order(db: Session, user_id: int, order_number: str) -> Order:
    """Ambil pesanan milik user berdasarkan nomor pesanan publik.

    Nomor pesanan dipakai di URL dan bersifat acak, bukan id berurutan.
    Pesanan milik akun lain selalu dijawab 404 supaya keberadaannya tidak bocor.
    """
    reference = (order_number or "").strip()
    if not reference or len(reference) > 50:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Pesanan tidak ditemukan")

    order = db.scalar(
        select(Order).where(Order.order_number == reference, Order.user_id == user_id)
    )
    if order is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Pesanan tidak ditemukan")
    return order


def restock_order(db: Session, order: Order) -> None:
    for item in order.items:
        if item.product_id is None:
            continue
        db.execute(
            update(Product)
            .where(Product.id == item.product_id)
            .values(
                stock=Product.stock + item.quantity,
                sold_count=func.greatest(Product.sold_count - item.quantity, 0),
            )
        )


@router.post(
    "/checkout",
    response_model=OrderOut,
    status_code=http_status.HTTP_201_CREATED,
    summary="Checkout keranjang",
)
def checkout(payload: CheckoutRequest, user: CurrentUser, db: DbSession) -> OrderOut:
    cart = db.scalar(select(Cart).where(Cart.user_id == user.id))
    if cart is None or not cart.items:
        raise HTTPException(http_status.HTTP_400_BAD_REQUEST, "Keranjang masih kosong")

    product_ids = sorted({item.product_id for item in cart.items})
    products = {
        product.id: product
        for product in db.scalars(
            select(Product)
            .where(Product.id.in_(product_ids))
            .order_by(Product.id)
            .with_for_update()
        )
    }

    subtotal = Decimal("0.00")
    order_items: list[OrderItem] = []

    for item in cart.items:
        product = products.get(item.product_id)
        if product is None or product.status != "active":
            raise HTTPException(
                http_status.HTTP_409_CONFLICT,
                f"Produk untuk item keranjang #{item.id} sudah tidak tersedia",
            )
        if product.stock < item.quantity:
            raise HTTPException(
                http_status.HTTP_409_CONFLICT,
                f"Stok {product.name} tidak cukup, tersisa {product.stock}",
            )

        product.stock -= item.quantity
        product.sold_count += item.quantity

        line_total = product.price * item.quantity
        subtotal += line_total
        order_items.append(
            OrderItem(
                product_id=product.id,
                product_name=product.name,
                product_slug=product.slug,
                sku=product.sku,
                price=product.price,
                quantity=item.quantity,
                subtotal=line_total,
            )
        )

    if payload.delivery_method == "store":
        shipping_cost = Decimal("0.00")
    elif payload.delivery_method == "courier" and payload.shipping_cost == 0:
        shipping_cost = settings.DEFAULT_SHIPPING_COST
    else:
        shipping_cost = payload.shipping_cost

    order = Order(
        order_number=generate_order_number(db),
        user_id=user.id,
        status="pending_payment",
        payment_method=payload.payment_method,
        delivery_method=payload.delivery_method,
        delivery_note=(payload.delivery_note or "").strip() or None,
        recipient_name=payload.recipient_name.strip(),
        recipient_phone=payload.recipient_phone.strip(),
        shipping_address=(payload.shipping_address or "").strip() or None,
        subtotal=subtotal,
        shipping_cost=shipping_cost,
        total=subtotal + shipping_cost,
    )
    order.items.extend(order_items)

    db.add(order)
    db.execute(delete(CartItem).where(CartItem.cart_id == cart.id))

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            http_status.HTTP_409_CONFLICT,
            "Gagal membuat pesanan, silakan coba lagi",
        ) from exc

    db.refresh(order)
    return serialize_order(order)


@router.get("", response_model=Page[OrderOut], summary="Riwayat belanja saya")
def my_orders(
    user: CurrentUser,
    db: DbSession,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: OrderStatus | None = None,
) -> Page[OrderOut]:
    stmt = select(Order).where(Order.user_id == user.id)
    if status:
        stmt = stmt.where(Order.status == status)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    orders = db.scalars(
        stmt.order_by(Order.created_at.desc(), Order.id.desc())
        .offset((page - 1) * size)
        .limit(size)
    ).all()

    return Page[OrderOut].build(
        items=[serialize_order(order) for order in orders],
        total=total,
        page=page,
        size=size,
    )


@router.get("/{order_number}", response_model=OrderOut, summary="Detail pesanan saya")
def my_order_detail(order_number: str, user: CurrentUser, db: DbSession) -> OrderOut:
    return serialize_order(get_owned_order(db, user.id, order_number))


@router.post(
    "/{order_number}/cancel",
    response_model=OrderOut,
    summary="Batalkan pesanan (belum dibayar)",
)
async def cancel_my_order(order_number: str, user: CurrentUser, db: DbSession) -> OrderOut:
    order = get_owned_order(db, user.id, order_number)

    if order.status != "pending_payment":
        raise HTTPException(
            http_status.HTTP_409_CONFLICT,
            "Pesanan hanya bisa dibatalkan saat belum dibayar",
        )

    order.status = "cancelled"
    restock_order(db, order)
    db.commit()
    db.refresh(order)

    if order.payment_method == "midtrans":
        await cancel_midtrans_transaction(order.order_number)

    return serialize_order(order)

