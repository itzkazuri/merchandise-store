from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException
from fastapi import status as http_status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.api.v1.endpoints.orders import restock_order
from app.core.config import settings
from app.models import Order
from app.schemas.order import MidtransPaymentOut, PaymentMethodOut
from app.services.midtrans import (
    MidtransError,
    create_snap_transaction,
    is_configured,
    verify_signature,
)

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/methods", response_model=list[PaymentMethodOut], summary="Metode pembayaran tersedia")
def payment_methods() -> list[PaymentMethodOut]:
    return [
        PaymentMethodOut(
            code="midtrans",
            name="Midtrans (QRIS, Virtual Account, e-wallet)",
            online=True,
            description="Bayar online melalui halaman Midtrans Snap",
        ),
        PaymentMethodOut(
            code="cash",
            name="Bayar di tempat (toko / kasir event)",
            online=False,
            description="Bayar tunai saat ambil di toko atau di booth event",
        ),
    ]


@router.post(
    "/midtrans/notification",
    summary="Webhook notifikasi Midtrans (dipanggil Midtrans)",
)
async def midtrans_notification(payload: dict, db: DbSession) -> dict:
    if not is_configured():
        raise HTTPException(http_status.HTTP_503_SERVICE_UNAVAILABLE, "Midtrans belum dikonfigurasi")

    if not verify_signature(payload):
        raise HTTPException(http_status.HTTP_401_UNAUTHORIZED, "Signature notifikasi tidak valid")

    order_number = payload.get("order_id")
    order = db.scalar(select(Order).where(Order.order_number == order_number))
    if order is None:
        return {"status": "ignored", "message": "Pesanan tidak ditemukan"}

    transaction_status = payload.get("transaction_status")
    fraud_status = payload.get("fraud_status")
    transaction_id = payload.get("transaction_id")

    settled = transaction_status in {"settlement", "capture"} and fraud_status != "challenge"
    failed = transaction_status in {"deny", "cancel", "expire", "failure"}

    if settled and order.status in {"pending_payment", "paid"}:
        order.status = "paid"
        order.paid_at = datetime.now(UTC).replace(tzinfo=None)
        order.midtrans_transaction_id = transaction_id
    elif failed and order.status in {"pending_payment", "paid"}:
        restock_order(db, order)
        order.status = "cancelled"
        order.midtrans_transaction_id = transaction_id

    db.commit()
    return {"status": "ok", "order": order.order_number, "order_status": order.status}


@router.post(
    "/midtrans/{order_id}",
    response_model=MidtransPaymentOut,
    summary="Buat transaksi Midtrans Snap",
)
async def create_midtrans_payment(
    order_id: int,
    user: CurrentUser,
    db: DbSession,
) -> MidtransPaymentOut:
    if not is_configured():
        raise HTTPException(
            http_status.HTTP_503_SERVICE_UNAVAILABLE,
            "Midtrans belum dikonfigurasi (isi MIDTRANS_SERVER_KEY di .env)",
        )

    order = db.get(Order, order_id)
    if order is None or order.user_id != user.id:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Pesanan tidak ditemukan")

    if order.payment_method != "midtrans":
        raise HTTPException(
            http_status.HTTP_409_CONFLICT,
            "Pesanan ini menggunakan pembayaran cash",
        )

    if order.status != "pending_payment":
        raise HTTPException(
            http_status.HTTP_409_CONFLICT,
            f"Pesanan berstatus '{order.status}', tidak bisa dibayar",
        )

    try:
        data = await create_snap_transaction(order, user.email)
    except MidtransError as exc:
        raise HTTPException(http_status.HTTP_502_BAD_GATEWAY, str(exc)) from exc

    token = data.get("token")
    if not token:
        raise HTTPException(http_status.HTTP_502_BAD_GATEWAY, "Midtrans tidak mengembalikan token")

    order.snap_token = token
    db.commit()

    return MidtransPaymentOut(
        order_number=order.order_number,
        token=token,
        redirect_url=data.get("redirect_url"),
        client_key=settings.MIDTRANS_CLIENT_KEY,
        snap_js_url=settings.MIDTRANS_SNAP_JS_URL,
    )
