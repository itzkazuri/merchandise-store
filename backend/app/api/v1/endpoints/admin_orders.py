from __future__ import annotations

from datetime import UTC, date, datetime, time

from fastapi import APIRouter, HTTPException, Query
from fastapi import status as http_status
from sqlalchemy import func, or_, select

from app.api.deps import DbSession, StaffUser
from app.api.v1.endpoints.orders import restock_order, serialize_order
from app.models import Order, User
from app.schemas.common import Page
from app.schemas.order import (
    DeliveryMethod,
    OrderOut,
    OrderStatus,
    OrderStatusUpdate,
    TrackingUpdate,
)
from app.services.midtrans import cancel_midtrans_transaction


router = APIRouter(prefix="/admin/orders", tags=["admin orders"])

# Transisi status yang diizinkan.
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "pending_payment": {"paid", "cancelled"},
    "paid": {"processing", "cancelled"},
    "processing": {"shipped", "cancelled"},
    "shipped": {"completed"},
    "completed": set(),
    "cancelled": set(),
}


@router.get("", response_model=Page[OrderOut], summary="Daftar semua pesanan (admin/staff)")
def list_orders(
    staff: StaffUser,
    db: DbSession,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: OrderStatus | None = None,
    delivery_method: DeliveryMethod | None = None,
    q: str | None = Query(None, max_length=100, description="Cari nomor pesanan, nama, telepon, email"),
    date_from: date | None = None,
    date_to: date | None = None,
) -> Page[OrderOut]:
    stmt = select(Order)

    if status:
        stmt = stmt.where(Order.status == status)

    if delivery_method:
        stmt = stmt.where(Order.delivery_method == delivery_method)

    if q:
        keyword = f"%{q.strip()}%"
        stmt = stmt.join(User, Order.user_id == User.id, isouter=True).where(
            or_(
                Order.order_number.ilike(keyword),
                Order.recipient_name.ilike(keyword),
                Order.recipient_phone.ilike(keyword),
                User.email.ilike(keyword),
            )
        )

    if date_from:
        stmt = stmt.where(Order.created_at >= datetime.combine(date_from, time.min))
    if date_to:
        stmt = stmt.where(Order.created_at <= datetime.combine(date_to, time.max))

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


@router.get("/{order_id}", response_model=OrderOut, summary="Detail pesanan (admin/staff)")
def get_order(order_id: int, staff: StaffUser, db: DbSession) -> OrderOut:
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Pesanan tidak ditemukan")
    return serialize_order(order)


@router.patch(
    "/{order_id}/status",
    response_model=OrderOut,
    summary="Ubah status pesanan (admin/staff)",
)
async def update_order_status(
    order_id: int,
    payload: OrderStatusUpdate,
    staff: StaffUser,
    db: DbSession,
) -> OrderOut:
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Pesanan tidak ditemukan")

    if payload.status == order.status:
        return serialize_order(order)

    allowed = ALLOWED_TRANSITIONS.get(order.status, set())
    if payload.status not in allowed:
        raise HTTPException(
            http_status.HTTP_409_CONFLICT,
            f"Status tidak bisa diubah dari '{order.status}' ke '{payload.status}'",
        )

    if payload.status == "cancelled":
        restock_order(db, order)
        if order.payment_method == "midtrans":
            await cancel_midtrans_transaction(order.order_number)

    order.status = payload.status
    db.commit()
    db.refresh(order)
    return serialize_order(order)



@router.patch(
    "/{order_id}/mark-paid",
    response_model=OrderOut,
    summary="Tandai pesanan cash sudah dibayar (admin/staff)",
)
def mark_paid(order_id: int, staff: StaffUser, db: DbSession) -> OrderOut:
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Pesanan tidak ditemukan")

    if order.payment_method != "cash":
        raise HTTPException(
            http_status.HTTP_409_CONFLICT,
            "Pesanan ini bukan pembayaran cash, gunakan Midtrans",
        )

    if order.status != "pending_payment":
        raise HTTPException(
            http_status.HTTP_409_CONFLICT,
            f"Pesanan berstatus '{order.status}', tidak bisa ditandai lunas",
        )

    order.status = "paid"
    order.paid_at = datetime.now(UTC).replace(tzinfo=None)
    order.cashier_id = staff.id
    db.commit()
    db.refresh(order)
    return serialize_order(order)


@router.patch(
    "/{order_id}/tracking",
    response_model=OrderOut,
    summary="Isi kode resi (admin/staff)",
)
def update_tracking(
    order_id: int,
    payload: TrackingUpdate,
    staff: StaffUser,
    db: DbSession,
) -> OrderOut:
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Pesanan tidak ditemukan")

    if order.status in {"pending_payment", "cancelled"}:
        raise HTTPException(
            http_status.HTTP_409_CONFLICT,
            "Kode resi hanya bisa diisi setelah pesanan dibayar",
        )

    order.tracking_number = payload.tracking_number.strip()
    db.commit()
    db.refresh(order)
    return serialize_order(order)
