from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from fastapi import APIRouter, HTTPException
from fastapi import status as http_status
from sqlalchemy import select

from app.api.deps import DbSession, StaffUser
from app.api.v1.endpoints.orders import generate_order_number, serialize_order
from app.models import Order, OrderItem, Product
from app.schemas.order import OrderOut, PosOrderCreate

router = APIRouter(prefix="/admin/pos", tags=["pos (kasir)"])


@router.post(
    "/orders",
    response_model=OrderOut,
    status_code=http_status.HTTP_201_CREATED,
    summary="Mode kasir: penjualan langsung di event (cash, lunas)",
)
def create_pos_order(payload: PosOrderCreate, staff: StaffUser, db: DbSession) -> OrderOut:
    quantities: dict[int, int] = {}
    for item in payload.items:
        quantities[item.product_id] = quantities.get(item.product_id, 0) + item.quantity

    products = {
        product.id: product
        for product in db.scalars(
            select(Product)
            .where(Product.id.in_(sorted(quantities)))
            .order_by(Product.id)
            .with_for_update()
        )
    }

    subtotal = Decimal("0.00")
    order_items: list[OrderItem] = []

    for product_id, quantity in quantities.items():
        product = products.get(product_id)
        if product is None:
            raise HTTPException(
                http_status.HTTP_404_NOT_FOUND,
                f"Produk id {product_id} tidak ditemukan",
            )
        if product.status != "active":
            raise HTTPException(
                http_status.HTTP_409_CONFLICT,
                f"Produk {product.name} sedang tidak aktif",
            )
        if product.stock < quantity:
            raise HTTPException(
                http_status.HTTP_409_CONFLICT,
                f"Stok {product.name} tidak cukup, tersisa {product.stock}",
            )

        product.stock -= quantity
        product.sold_count += quantity

        line_total = product.price * quantity
        subtotal += line_total
        order_items.append(
            OrderItem(
                product_id=product.id,
                product_name=product.name,
                product_slug=product.slug,
                sku=product.sku,
                price=product.price,
                quantity=quantity,
                subtotal=line_total,
            )
        )

    order = Order(
        order_number=generate_order_number(db),
        user_id=None,
        status="paid",
        payment_method="cash",
        paid_at=datetime.now(UTC).replace(tzinfo=None),
        cashier_id=staff.id,
        delivery_method=payload.delivery_method,
        delivery_note=(payload.delivery_note or "").strip() or None,
        recipient_name=payload.customer_name.strip() or "Walk-in Customer",
        recipient_phone=payload.customer_phone.strip(),
        shipping_address=None,
        subtotal=subtotal,
        shipping_cost=Decimal("0.00"),
        total=subtotal,
    )
    order.items.extend(order_items)

    db.add(order)
    db.commit()
    db.refresh(order)
    return serialize_order(order)
