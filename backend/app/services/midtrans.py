"""Integrasi Midtrans Snap + verifikasi notifikasi ketat (Anti-Fraud)."""

from __future__ import annotations

import base64
import hashlib
import hmac
import logging
from decimal import Decimal

import httpx

from app.core.config import settings
from app.models import Order

logger = logging.getLogger("app.services.midtrans")


class MidtransError(Exception):
    """Gagal berkomunikasi dengan Midtrans."""


def is_configured() -> bool:
    key = settings.MIDTRANS_SERVER_KEY or ""
    return bool(key) and "xxxxxxxx" not in key


def get_api_base_url() -> str:
    """Midtrans Core API base URL."""
    if settings.MIDTRANS_IS_PRODUCTION:
        return "https://api.midtrans.com/v2"
    return "https://api.sandbox.midtrans.com/v2"


def _headers() -> dict[str, str]:
    raw = f"{settings.MIDTRANS_SERVER_KEY}:".encode()
    token = base64.b64encode(raw).decode()
    return {
        "Authorization": f"Basic {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def build_snap_payload(order: Order, email: str | None) -> dict:
    items = [
        {
            "id": str(item.product_id or item.sku or item.id)[:50],
            "price": int(item.price),
            "quantity": item.quantity,
            "name": item.product_name[:50],
        }
        for item in order.items
    ]

    if order.shipping_cost and order.shipping_cost > 0:
        items.append(
            {
                "id": "SHIPPING",
                "price": int(order.shipping_cost),
                "quantity": 1,
                "name": "Ongkos Kirim",
            }
        )

    return {
        "transaction_details": {
            "order_id": order.order_number,
            "gross_amount": int(order.total),
        },
        "item_details": items,
        "customer_details": {
            "first_name": order.recipient_name[:50],
            "email": email,
            "phone": order.recipient_phone,
        },
        "callbacks": {
            "finish": f"{settings.FRONTEND_URL}/pesanan/{order.order_number}?bayar=verifikasi",
        },
    }


async def create_snap_transaction(order: Order, email: str | None) -> dict:
    async with httpx.AsyncClient(timeout=httpx.Timeout(20.0)) as client:
        response = await client.post(
            settings.MIDTRANS_SNAP_API_URL,
            json=build_snap_payload(order, email),
            headers=_headers(),
        )

    if response.status_code >= 400:
        raise MidtransError(
            f"Midtrans menolak transaksi ({response.status_code}): {response.text[:300]}"
        )

    return response.json()


def verify_signature(payload: dict) -> bool:
    """Verifikasi SHA512 signature key yang dikirim Midtrans webhook.

    signature_key = sha512(order_id + status_code + gross_amount + server_key)
    """
    received = str(payload.get("signature_key") or "").strip()
    if not received or not is_configured():
        return False

    raw = (
        f"{str(payload.get('order_id', '')).strip()}"
        f"{str(payload.get('status_code', '')).strip()}"
        f"{str(payload.get('gross_amount', '')).strip()}"
        f"{settings.MIDTRANS_SERVER_KEY.strip()}"
    )
    expected = hashlib.sha512(raw.encode("utf-8")).hexdigest()
    return hmac.compare_digest(expected.lower(), received.lower())


def verify_amount(payload_amount: str | float | int | Decimal | None, expected_total: Decimal | float | int) -> bool:
    """Verifikasi ketat bahwa nominal yang dibayar di Midtrans persis sama dengan total pesanan.

    Mencegah manipulasi harga / underpayment (misal order Rp 500.000 dibayar Rp 1.000).
    """
    if payload_amount is None:
        return False
    try:
        # Midtrans mengirim gross_amount sebagai "150000.00" atau "150000"
        p_dec = Decimal(str(payload_amount).strip()).quantize(Decimal("1"))
        e_dec = Decimal(str(expected_total).strip()).quantize(Decimal("1"))
        return p_dec == e_dec and p_dec > 0
    except Exception:
        return False


async def get_transaction_status(order_number: str) -> dict:
    """Ambil status transaksi langsung dari Midtrans Core API (Server-to-Server).

    Dipakai untuk verifikasi ganda (double-check) terhadap webhook dan sinkronisasi realtime.
    """
    if not is_configured():
        raise MidtransError("Midtrans belum dikonfigurasi")

    url = f"{get_api_base_url()}/{order_number}/status"
    async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
        response = await client.get(url, headers=_headers())

    if response.status_code == 404:
        return {
            "status_code": "404",
            "status_message": "Transaction doesn't exist.",
            "order_id": order_number,
        }

    if response.status_code >= 400:
        raise MidtransError(
            f"Midtrans status check error ({response.status_code}): {response.text[:200]}"
        )

    return response.json()


async def cancel_midtrans_transaction(order_number: str) -> dict | None:
    """Batalkan transaksi di Midtrans jika pesanan dibatalkan."""
    if not is_configured():
        return None
    url = f"{get_api_base_url()}/{order_number}/cancel"
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
            res = await client.post(url, headers=_headers())
        if res.status_code < 400:
            return res.json()
    except Exception as exc:
        logger.warning("Gagal membatalkan transaksi Midtrans untuk %s: %s", order_number, exc)
    return None
