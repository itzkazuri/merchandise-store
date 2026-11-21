from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import MYSQL_TABLE_ARGS, Base

if TYPE_CHECKING:
    from app.models.user import User


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending_payment', 'paid', 'processing', 'shipped', 'completed', 'cancelled')",
            name="status",
        ),
        CheckConstraint(
            "delivery_method IN ('store', 'courier', 'custom')",
            name="delivery_method",
        ),
        CheckConstraint(
            "payment_method IN ('midtrans', 'cash')",
            name="payment_method",
        ),
        Index("ix_orders_user_id", "user_id"),
        Index("ix_orders_status", "status"),
        Index("ix_orders_created_at", "created_at"),
        MYSQL_TABLE_ARGS,
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    order_number: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    user_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="pending_payment",
        server_default=text("'pending_payment'"),
    )

    # Pengiriman: ambil di toko / dikirim pengirim / custom (event)
    delivery_method: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="store",
        server_default=text("'store'"),
    )
    delivery_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    tracking_number: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Pembayaran: midtrans (online) atau cash (di toko / kasir event)
    payment_method: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="midtrans",
        server_default=text("'midtrans'"),
    )
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    midtrans_transaction_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    snap_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cashier_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    recipient_name: Mapped[str] = mapped_column(String(150), nullable=False)
    recipient_phone: Mapped[str] = mapped_column(String(30), nullable=False)
    shipping_address: Mapped[str | None] = mapped_column(Text, nullable=True)

    subtotal: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    shipping_cost: Mapped[Decimal] = mapped_column(
        Numeric(15, 2),
        nullable=False,
        default=Decimal("0.00"),
        server_default=text("0.00"),
    )
    total: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
        onupdate=func.now(),
    )

    user: Mapped["User | None"] = relationship(
        foreign_keys=[user_id],
        lazy="selectin",
    )
    cashier: Mapped["User | None"] = relationship(
        foreign_keys=[cashier_id],
        lazy="selectin",
    )
    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="OrderItem.id",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Order id={self.id} number={self.order_number!r} status={self.status!r}>"


class OrderItem(Base):
    """Snapshot item saat checkout, tetap aman walau produk kemudian diubah/dihapus."""

    __tablename__ = "order_items"
    __table_args__ = (
        Index("ix_order_items_order_id", "order_id"),
        MYSQL_TABLE_ARGS,
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
    )

    product_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("products.id", ondelete="SET NULL"),
        nullable=True,
    )
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    product_slug: Mapped[str] = mapped_column(String(255), nullable=False)
    sku: Mapped[str] = mapped_column(String(100), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)

    order: Mapped["Order"] = relationship(back_populates="items")
