from __future__ import annotations

from datetime import UTC, date, datetime, time
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi import status as http_status
from sqlalchemy import func, select

from app.api.deps import DbSession, StaffUser
from app.models import Order, OrderItem
from app.schemas.order import REVENUE_STATUSES, RevenueByMethod, RevenueOut, RevenuePoint

router = APIRouter(prefix="/admin/revenue", tags=["admin revenue"])


@router.get("", response_model=RevenueOut, summary="Rekap pendapatan (admin/staff)")
def revenue(
    staff: StaffUser,
    db: DbSession,
    date_from: date | None = Query(None, description="Default: awal bulan berjalan"),
    date_to: date | None = Query(None, description="Default: hari ini"),
    group_by: Literal["day", "month"] = "day",
) -> RevenueOut:
    today = datetime.now(UTC).date()
    start_date = date_from or today.replace(day=1)
    end_date = date_to or today

    if start_date > end_date:
        raise HTTPException(http_status.HTTP_400_BAD_REQUEST, "date_from tidak boleh setelah date_to")

    filters = [
        Order.status.in_(REVENUE_STATUSES),
        Order.created_at >= datetime.combine(start_date, time.min),
        Order.created_at <= datetime.combine(end_date, time.max),
    ]

    period_expr = (
        func.date(Order.created_at)
        if group_by == "day"
        else func.date_format(Order.created_at, "%Y-%m")
    )

    total_revenue = db.scalar(
        select(func.coalesce(func.sum(Order.subtotal), 0)).where(*filters)
    ) or Decimal("0.00")
    total_orders = db.scalar(select(func.count(Order.id)).where(*filters)) or 0
    items_sold = db.scalar(
        select(func.coalesce(func.sum(OrderItem.quantity), 0))
        .join(Order, OrderItem.order_id == Order.id)
        .where(*filters)
    ) or 0

    rows = db.execute(
        select(
            period_expr.label("period"),
            func.coalesce(func.sum(Order.subtotal), 0).label("revenue"),
            func.count(Order.id).label("orders"),
        )
        .where(*filters)
        .group_by(period_expr)
        .order_by(period_expr)
    ).all()

    average = (
        (Decimal(total_revenue) / total_orders).quantize(Decimal("0.01"))
        if total_orders
        else Decimal("0.00")
    )

    method_rows = db.execute(
        select(
            Order.delivery_method,
            func.coalesce(func.sum(Order.subtotal), 0),
            func.count(Order.id),
        )
        .where(*filters)
        .group_by(Order.delivery_method)
    ).all()

    return RevenueOut(
        date_from=start_date,
        date_to=end_date,
        total_revenue=Decimal(total_revenue),
        total_orders=total_orders,
        items_sold=items_sold,
        average_order_value=average,
        series=[
            RevenuePoint(
                period=str(period),
                revenue=Decimal(revenue),
                orders=orders,
            )
            for period, revenue, orders in rows
        ],
        by_delivery_method=[
            RevenueByMethod(
                delivery_method=method,
                revenue=Decimal(revenue),
                orders=orders,
            )
            for method, revenue, orders in method_rows
        ],
    )
