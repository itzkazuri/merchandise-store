from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

DeliveryMethod = Literal["store", "courier", "custom"]
PaymentMethod = Literal["midtrans", "cash"]
OrderStatus = Literal[
    "pending_payment",
    "paid",
    "processing",
    "shipped",
    "completed",
    "cancelled",
]

REVENUE_STATUSES = ("paid", "processing", "shipped", "completed")


class CheckoutRequest(BaseModel):
    delivery_method: DeliveryMethod = Field(
        default="store",
        description="store = ambil di toko, courier = dikirim, custom = event/khusus",
    )
    delivery_note: str | None = Field(
        default=None,
        max_length=1000,
        examples=["Ambil di booth Event Anime Expo, hall B no. 12"],
    )
    recipient_name: str = Field(min_length=2, max_length=150)
    recipient_phone: str = Field(min_length=6, max_length=30)
    shipping_address: str | None = Field(default=None, max_length=500)
    shipping_cost: Decimal = Field(
        default=Decimal("0.00"),
        ge=0,
        description="Ongkir ditanggung customer; otomatis 0 untuk ambil di toko",
    )
    payment_method: PaymentMethod = Field(
        default="midtrans",
        description="midtrans = bayar online; cash = bayar di tempat (toko/event)",
    )

    @model_validator(mode="after")
    def validate_delivery(self) -> "CheckoutRequest":
        if self.delivery_method == "custom" and not (self.delivery_note and self.delivery_note.strip()):
            raise ValueError("Catatan pengiriman wajib diisi untuk metode custom")
        if self.delivery_method == "courier" and not (self.shipping_address and self.shipping_address.strip()):
            raise ValueError("Alamat pengiriman wajib diisi untuk metode courier")
        if self.payment_method == "cash" and self.delivery_method == "courier":
            raise ValueError("Pembayaran cash hanya berlaku untuk ambil di toko/event")
        return self


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int | None = None
    product_name: str
    product_slug: str
    sku: str
    price: Decimal
    quantity: int
    subtotal: Decimal


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_number: str
    status: OrderStatus
    delivery_method: DeliveryMethod
    delivery_note: str | None = None
    tracking_number: str | None = None
    recipient_name: str
    recipient_phone: str
    shipping_address: str | None = None
    payment_method: PaymentMethod
    paid_at: datetime | None = None
    midtrans_transaction_id: str | None = None
    cashier_id: int | None = None
    subtotal: Decimal
    shipping_cost: Decimal
    total: Decimal
    items: list[OrderItemOut] = []
    user_id: int | None = None
    user_email: str | None = None
    created_at: datetime
    updated_at: datetime


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class TrackingUpdate(BaseModel):
    tracking_number: str = Field(min_length=3, max_length=100, examples=["JP1234567890"])


class RevenuePoint(BaseModel):
    period: str
    revenue: Decimal
    orders: int


class RevenueByMethod(BaseModel):
    delivery_method: DeliveryMethod
    revenue: Decimal
    orders: int


class RevenueOut(BaseModel):
    date_from: date
    date_to: date
    total_revenue: Decimal
    total_orders: int
    items_sold: int
    average_order_value: Decimal
    series: list[RevenuePoint]
    by_delivery_method: list[RevenueByMethod] = []


class PaymentMethodOut(BaseModel):
    code: PaymentMethod
    name: str
    online: bool
    description: str | None = None


class MidtransPaymentOut(BaseModel):
    order_number: str
    token: str
    redirect_url: str | None = None
    client_key: str
    snap_js_url: str


class PaymentSyncOut(BaseModel):
    order_number: str
    status: OrderStatus
    payment_method: PaymentMethod
    is_settled: bool
    transaction_status: str | None = None
    fraud_status: str | None = None
    transaction_id: str | None = None
    payment_type: str | None = None
    gross_amount: Decimal | None = None
    message: str
    order: OrderOut | None = None



class PosOrderItem(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(default=1, ge=1, le=999)


class PosOrderCreate(BaseModel):
    items: list[PosOrderItem] = Field(min_length=1)
    customer_name: str = Field(default="Walk-in Customer", max_length=150)
    customer_phone: str = Field(default="", max_length=30)
    delivery_method: Literal["store", "custom"] = Field(
        default="custom",
        description="custom untuk penjualan di event",
    )
    delivery_note: str | None = Field(default="Penjualan di event", max_length=1000)
