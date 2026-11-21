from __future__ import annotations

from datetime import datetime
from decimal import Decimal

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


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("product_type IN ('imported', 'handmade')", name="product_type"),
        CheckConstraint("status IN ('draft', 'active', 'archived')", name="status"),
        Index("ix_products_status", "status"),
        MYSQL_TABLE_ARGS,
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    sku: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    product_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="imported",
        server_default=text("'imported'"),
    )
    price: Mapped[Decimal] = mapped_column(
        Numeric(15, 2),
        nullable=False,
        default=Decimal("0.00"),
        server_default=text("0.00"),
    )
    stock: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=text("0"))
    sold_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=text("0"))
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="draft",
        server_default=text("'draft'"),
    )

    # Taksonomi: satu seri anime + satu jenis produk (opsional).
    anime_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
    )
    category_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
    )

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

    images: Mapped[list[ProductImage]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductImage.sort_order",
        lazy="selectin",
    )
    anime: Mapped["Category | None"] = relationship(
        foreign_keys=[anime_id],
        lazy="joined",
    )
    category: Mapped["Category | None"] = relationship(
        foreign_keys=[category_id],
        lazy="joined",
    )

    def __repr__(self) -> str:
        return f"<Product id={self.id} slug={self.slug!r}>"


from app.models.category import Category  # noqa: E402
from app.models.product_image import ProductImage  # noqa: E402
