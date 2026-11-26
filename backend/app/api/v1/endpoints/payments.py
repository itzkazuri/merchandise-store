from __future__ import annotations

import logging
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import APIRouter, HTTPException
from fastapi import status as http_status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, DbSession
from app.api.v1.endpoints.orders import restock_order, serialize_order
from app.core.config import settings
from app.models import Order
from app.schemas.order import MidtransPaymentOut, PaymentMethodOut, PaymentSyncOut
from app.services.midtrans import (
    MidtransError,
    create_snap_transaction,
    get_transaction_status,
    is_configured,
    verify_amount,
    verify_signature,
)

logger = logging.getLogger("payments.midtrans")

router = APIRouter(prefix="/payments", tags=["payments"])


def apply_payment_transition(
    db: Session,
    order: Order,
    data: dict,
    source: str = "webhook",
) -> dict:
    """Terapkan transisi status pembayaran berdasarkan data Midtrans yang telah diverifikasi.

    Hanya mengubah status dari pending_payment -> paid jika settlement/capture (accept).
    Mengembalikan ringkasan tindakan untuk audit/logging.
    """
    transaction_status = str(data.get("transaction_status") or "").lower()
    fraud_status = str(data.get("fraud_status") or "").lower()
    transaction_id = str(data.get("transaction_id") or "").strip() or None
    payment_type = data.get("payment_type")

    settled = (
        transaction_status == "settlement"
        or (transaction_status == "capture" and fraud_status == "accept")
    )
    is_challenge = (transaction_status == "capture" and fraud_status == "challenge")
    failed = transaction_status in {"deny", "cancel", "expire", "failure"}
    is_pending = transaction_status == "pending"

    action = "none"

    if settled:
        if order.status == "pending_payment":
            order.status = "paid"
            order.paid_at = datetime.now(UTC).replace(tzinfo=None)
            if transaction_id:
                order.midtrans_transaction_id = transaction_id
            db.commit()
            action = "marked_paid"
            logger.info(
                "[PAYMENT SUCCESS] Pesanan %s terverifikasi LUNAS via Midtrans (%s, tx_id: %s, source: %s)",
                order.order_number,
                payment_type,
                transaction_id,
                source,
            )
        elif order.status == "paid":
            # Idempotent: jika sudah lunas, simpan transaction_id jika belum ada
            if transaction_id and not order.midtrans_transaction_id:
                order.midtrans_transaction_id = transaction_id
                db.commit()
            action = "already_paid"
        else:
            action = f"ignored_status_{order.status}"
    elif failed:
        if order.status == "pending_payment":
            restock_order(db, order)
            order.status = "cancelled"
            if transaction_id:
                order.midtrans_transaction_id = transaction_id
            db.commit()
            action = "cancelled_and_restocked"
            logger.info(
                "[PAYMENT FAILED] Pesanan %s dibatalkan karena pembayaran Midtrans berstatus %s (source: %s)",
                order.order_number,
                transaction_status,
                source,
            )
        else:
            action = f"ignored_status_{order.status}"
    elif is_challenge:
        action = "fraud_challenge_pending"
        logger.warning(
            "[SECURITY ALERT] Pesanan %s ditandai FRAUD CHALLENGE oleh Midtrans FDS! Pembayaran ditahan (source: %s).",
            order.order_number,
            source,
        )
    elif is_pending:
        action = "waiting_payment"

    return {
        "action": action,
        "order_status": order.status,
        "transaction_status": transaction_status,
        "fraud_status": fraud_status,
        "transaction_id": transaction_id,
        "payment_type": payment_type,
        "settled": settled,
    }


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


@router.get(
    "/midtrans/notification",
    summary="Cek URL webhook Midtrans",
    include_in_schema=False,
)
def midtrans_notification_health() -> dict:
    """Health check for browsers and dashboard URL validation; notifications use POST."""
    return {"status": "ok", "endpoint": "midtrans-notification", "method": "POST"}


@router.post(
    "/midtrans/notification",
    summary="Webhook notifikasi Midtrans (dipanggil Midtrans dengan verifikasi ketat)",
)
async def midtrans_notification(payload: dict, db: DbSession) -> dict:
    if not is_configured():
        raise HTTPException(http_status.HTTP_503_SERVICE_UNAVAILABLE, "Midtrans belum dikonfigurasi")

    # 1. Validasi signature secara kriptografis (SHA-512)
    if not verify_signature(payload):
        logger.warning(
            "[SECURITY ALERT] Webhook Midtrans ditolak: Signature tidak valid! Payload: %s",
            payload,
        )
        raise HTTPException(http_status.HTTP_401_UNAUTHORIZED, "Signature notifikasi tidak valid")

    order_number = str(payload.get("order_id") or "").strip()
    if not order_number:
        raise HTTPException(http_status.HTTP_400_BAD_REQUEST, "Field order_id tidak ditemukan")

    # Kunci row order di DB untuk mencegah race condition (mis. webhook duplikat / sync paralel)
    order = db.scalar(
        select(Order)
        .where(Order.order_number == order_number)
        .with_for_update()
    )
    if order is None:
        logger.warning(
            "[SECURITY ALERT] Webhook Midtrans untuk order %s diabaikan: Pesanan tidak ditemukan",
            order_number,
        )
        return {"status": "ignored", "message": "Pesanan tidak ditemukan"}

    if order.payment_method != "midtrans":
        logger.warning(
            "[SECURITY ALERT] Webhook Midtrans untuk order %s ditolak: Metode pembayaran pesanan adalah %s",
            order_number,
            order.payment_method,
        )
        raise HTTPException(
            http_status.HTTP_400_BAD_REQUEST,
            "Pesanan ini bukan pembayaran Midtrans",
        )

    # 2. Verifikasi ketat nominal (Gross Amount) vs order.total di database
    payload_gross = payload.get("gross_amount")
    if not verify_amount(payload_gross, order.total):
        logger.critical(
            "[SECURITY ALERT] Pembayaran palsu/nominal manipulasi terdeteksi untuk order %s! Total pesanan: %s, nominal dibayar: %s",
            order_number,
            order.total,
            payload_gross,
        )
        raise HTTPException(
            http_status.HTTP_400_BAD_REQUEST,
            f"Nominal pembayaran ({payload_gross}) tidak cocok dengan total pesanan ({order.total})",
        )

    # 3. Double-Verification: Verifikasi server-to-server langsung ke Midtrans API
    verified_data = payload
    try:
        remote_status = await get_transaction_status(order_number)
        status_code = str(remote_status.get("status_code") or "")

        if status_code == "404":
            logger.critical(
                "[SECURITY ALERT] Webhook Midtrans palsu untuk order %s: Midtrans API menyatakan transaksi tidak ada!",
                order_number,
            )
            raise HTTPException(
                http_status.HTTP_401_UNAUTHORIZED,
                "Transaksi tidak terdaftar di server Midtrans",
            )

        # Pastikan nominal di server Midtrans juga cocok persis dengan database
        remote_gross = remote_status.get("gross_amount")
        if not verify_amount(remote_gross, order.total):
            logger.critical(
                "[SECURITY ALERT] Nominal di server Midtrans (%s) tidak cocok dengan order %s (%s)",
                remote_gross,
                order_number,
                order.total,
            )
            raise HTTPException(
                http_status.HTTP_400_BAD_REQUEST,
                "Nominal di server Midtrans tidak cocok dengan total pesanan",
            )

        verified_data = remote_status
    except MidtransError as exc:
        logger.warning(
            "Verifikasi server-to-server Midtrans gagal (%s), melanjutkan dengan signature terverifikasi",
            exc,
        )

    transition_result = apply_payment_transition(db, order, verified_data, source="webhook")

    return {
        "status": "ok",
        "order": order.order_number,
        "order_status": order.status,
        "detail": transition_result,
    }


@router.post(
    "/midtrans/{order_id}/sync",
    response_model=PaymentSyncOut,
    summary="Sinkronkan & verifikasi status pembayaran langsung dari Midtrans (server-to-server)",
)
async def sync_midtrans_payment(
    order_id: int,
    user: CurrentUser,
    db: DbSession,
) -> PaymentSyncOut:
    """Periksa status pembayaran langsung ke Midtrans API dan update database jika status berubah."""
    if not is_configured():
        raise HTTPException(
            http_status.HTTP_503_SERVICE_UNAVAILABLE,
            "Midtrans belum dikonfigurasi (isi MIDTRANS_SERVER_KEY di .env)",
        )

    order = db.scalar(select(Order).where(Order.id == order_id).with_for_update())
    if order is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Pesanan tidak ditemukan")

    is_owner = (order.user_id == user.id)
    is_staff = (user.role in ("admin", "staff"))
    if not (is_owner or is_staff):
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Pesanan tidak ditemukan")

    if order.payment_method != "midtrans":
        raise HTTPException(
            http_status.HTTP_400_BAD_REQUEST,
            "Pesanan ini menggunakan metode pembayaran tunai (cash), bukan Midtrans",
        )

    # Jika order sudah lunas / diproses, kembalikan status terverifikasi langsung
    if order.status in ("paid", "processing", "shipped", "completed"):
        return PaymentSyncOut(
            order_number=order.order_number,
            status=order.status,
            payment_method=order.payment_method,
            is_settled=True,
            transaction_id=order.midtrans_transaction_id,
            message="Pesanan sudah lunas terverifikasi.",
            order=serialize_order(order),
        )

    if order.status == "cancelled":
        return PaymentSyncOut(
            order_number=order.order_number,
            status=order.status,
            payment_method=order.payment_method,
            is_settled=False,
            transaction_id=order.midtrans_transaction_id,
            message="Pesanan telah dibatalkan.",
            order=serialize_order(order),
        )

    # Hubungi Midtrans API untuk status realtime
    try:
        remote_status = await get_transaction_status(order.order_number)
    except MidtransError as exc:
        raise HTTPException(http_status.HTTP_502_BAD_GATEWAY, str(exc)) from exc

    status_code = str(remote_status.get("status_code") or "")
    if status_code == "404":
        return PaymentSyncOut(
            order_number=order.order_number,
            status=order.status,
            payment_method=order.payment_method,
            is_settled=False,
            transaction_status="not_found",
            message="Belum ada transaksi di Midtrans. Silakan lakukan pembayaran.",
            order=serialize_order(order),
        )

    # Validasi nominal dari server Midtrans
    remote_gross = remote_status.get("gross_amount")
    if not verify_amount(remote_gross, order.total):
        logger.critical(
            "[SECURITY ALERT] Nominal transaksi Midtrans (%s) tidak sama dengan total pesanan (%s) untuk order %s",
            remote_gross,
            order.total,
            order.order_number,
        )
        raise HTTPException(
            http_status.HTTP_400_BAD_REQUEST,
            "Nominal transaksi di Midtrans tidak cocok dengan total pesanan! Kemungkinan pembayaran palsu.",
        )

    transition_result = apply_payment_transition(db, order, remote_status, source="sync_endpoint")
    db.refresh(order)

    if transition_result["settled"]:
        message = "Pembayaran terverifikasi lunas oleh Midtrans."
    elif transition_result["transaction_status"] == "pending":
        message = "Pembayaran belum diselesaikan atau masih menunggu transfer/scan QRIS."
    elif transition_result["fraud_status"] == "challenge":
        message = "Pembayaran sedang ditinjau oleh sistem fraud Midtrans."
    else:
        message = f"Status transaksi Midtrans: {transition_result['transaction_status']}."

    return PaymentSyncOut(
        order_number=order.order_number,
        status=order.status,
        payment_method=order.payment_method,
        is_settled=transition_result["settled"],
        transaction_status=transition_result["transaction_status"],
        fraud_status=transition_result["fraud_status"],
        transaction_id=transition_result["transaction_id"],
        payment_type=transition_result["payment_type"],
        gross_amount=Decimal(str(remote_gross)) if remote_gross else None,
        message=message,
        order=serialize_order(order),
    )


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

    # Cek apakah transaksi sudah pernah dibuat & sudah dibayar di Midtrans
    try:
        remote_status = await get_transaction_status(order.order_number)
        if remote_status.get("status_code") != "404":
            t_status = str(remote_status.get("transaction_status") or "").lower()
            f_status = str(remote_status.get("fraud_status") or "").lower()
            if t_status == "settlement" or (t_status == "capture" and f_status == "accept"):
                # Transaksi sudah lunas di Midtrans, sinkronkan langsung
                apply_payment_transition(db, order, remote_status, source="create_payment_check")
                raise HTTPException(
                    http_status.HTTP_409_CONFLICT,
                    "Pesanan ini sudah lunas terverifikasi di Midtrans",
                )
    except MidtransError:
        pass

    try:
        data = await create_snap_transaction(order, user.email)
    except MidtransError as exc:
        # Jika Midtrans menolak karena token sudah dibuat sebelumnya (order_id already taken)
        # dan kita masih memiliki snap_token yang tersimpan, gunakan kembali token tersebut.
        if "already" in str(exc).lower() and order.snap_token:
            return MidtransPaymentOut(
                order_number=order.order_number,
                token=order.snap_token,
                redirect_url=None,
                client_key=settings.MIDTRANS_CLIENT_KEY,
                snap_js_url=settings.MIDTRANS_SNAP_JS_URL,
            )
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
