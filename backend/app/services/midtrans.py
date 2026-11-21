"""Integrasi Midtrans Snap + verifikasi notifikasi."""

from __future__ import annotations

import base64
import hashlib
import hmac

import httpx

from app.core.config import settings
from app.models import Order


class MidtransError(Exception):
    """Gagal berkomunikasi dengan Midtrans."""


def is_configured() -> bool:
    key = settings.MIDTRANS_SERVER_KEY or ""
    return bool(key) and "xxxxxxxx" not in key


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
            "id": str(item.product_id or item.sku)[:50],
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
            "finish": f"{settings.FRONTEND_URL}/orders",
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
    """signature_key = sha512(order_id + status_code + gross_amount + server_key)."""
    received = payload.get("signature_key") or ""
    if not received:
        return False

    raw = (
        f"{payload.get('order_id', '')}"
        f"{payload.get('status_code', '')}"
        f"{payload.get('gross_amount', '')}"
        f"{settings.MIDTRANS_SERVER_KEY}"
    )
    expected = hashlib.sha512(raw.encode()).hexdigest()
    return hmac.compare_digest(expected, received)
