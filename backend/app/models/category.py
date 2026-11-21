from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import MYSQL_TABLE_ARGS, Base


class Category(Base):
    """Taksonomi produk dalam satu tabel.

    - kind="anime"   : asal seri anime (Naruto, One Piece, ...)
    - kind="product" : jenis barang (figure, gantungan kunci, plush, ...)

    Satu tabel dipakai untuk keduanya supaya CRUD, validasi, dan filter
    cukup satu mekanisme. Produk menyimpan satu anime_id dan satu category_id.
    """

    __tablename__ = "categories"
    __table_args__ = (
        CheckConstraint("kind IN ('anime', 'product')", name="kind"),
        UniqueConstraint("kind", "slug", name="uq_categories_kind_slug"),
        Index("ix_categories_kind", "kind"),
        MYSQL_TABLE_ARGS,
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(140), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("1"),
    )
    sort_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
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

    def __repr__(self) -> str:
        return f"<Category id={self.id} kind={self.kind!r} slug={self.slug!r}>"
