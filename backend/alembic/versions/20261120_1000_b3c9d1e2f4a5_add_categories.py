"""add categories (anime & jenis produk) and seed defaults

Revision ID: b3c9d1e2f4a5
Revises: ae3d0ed6d0d6
Create Date: 2026-11-20 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b3c9d1e2f4a5"
down_revision: str | Sequence[str] | None = "ae3d0ed6d0d6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

categories_table = sa.table(
    "categories",
    sa.column("kind", sa.String),
    sa.column("name", sa.String),
    sa.column("slug", sa.String),
    sa.column("sort_order", sa.Integer),
    sa.column("is_active", sa.Boolean),
)

DEFAULT_ANIME = [
    "Naruto",
    "One Piece",
    "Jujutsu Kaisen",
    "Demon Slayer",
    "Spy x Family",
    "Chainsaw Man",
    "Solo Leveling",
    "Frieren",
    "Oshi no Ko",
    "Bocchi the Rock",
    "Blue Lock",
    "Attack on Titan",
    "Lainnya",
]

DEFAULT_PRODUCT_CATEGORIES = [
    "Merchandise",
    "Gantungan kunci",
    "Figure",
    "Acrylic stand",
    "Plush",
    "Poster",
    "Sticker",
    "Aksesori",
    "Kaos",
]


def upgrade() -> None:
    op.create_table(
        "categories",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("slug", sa.String(length=140), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("1"), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint("kind IN ('anime', 'product')", name=op.f("ck_categories_kind")),
        sa.UniqueConstraint("kind", "slug", name=op.f("uq_categories_kind_slug")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_categories")),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index(op.f("ix_categories_slug"), "categories", ["slug"], unique=False)
    op.create_index("ix_categories_kind", "categories", ["kind"], unique=False)

    op.add_column("products", sa.Column("anime_id", sa.BigInteger(), nullable=True))
    op.add_column("products", sa.Column("category_id", sa.BigInteger(), nullable=True))
    op.create_foreign_key(
        op.f("fk_products_anime_id_categories"),
        "products",
        "categories",
        ["anime_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        op.f("fk_products_category_id_categories"),
        "products",
        "categories",
        ["category_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_products_anime_id"), "products", ["anime_id"], unique=False)
    op.create_index(op.f("ix_products_category_id"), "products", ["category_id"], unique=False)

    rows = [
        {
            "kind": "anime",
            "name": name,
            "slug": _slug(name),
            "sort_order": index,
            "is_active": True,
        }
        for index, name in enumerate(DEFAULT_ANIME)
    ] + [
        {
            "kind": "product",
            "name": name,
            "slug": _slug(name),
            "sort_order": index,
            "is_active": True,
        }
        for index, name in enumerate(DEFAULT_PRODUCT_CATEGORIES)
    ]
    op.bulk_insert(categories_table, rows)


def downgrade() -> None:
    op.drop_index(op.f("ix_products_category_id"), table_name="products")
    op.drop_index(op.f("ix_products_anime_id"), table_name="products")
    op.drop_constraint(
        op.f("fk_products_category_id_categories"), "products", type_="foreignkey"
    )
    op.drop_constraint(op.f("fk_products_anime_id_categories"), "products", type_="foreignkey")
    op.drop_column("products", "category_id")
    op.drop_column("products", "anime_id")

    op.drop_index("ix_categories_kind", table_name="categories")
    op.drop_index(op.f("ix_categories_slug"), table_name="categories")
    op.drop_table("categories")


def _slug(value: str) -> str:
    import re
    import unicodedata

    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    normalized = re.sub(r"[^\w\s-]", "", normalized).strip().lower()
    return re.sub(r"[-\s]+", "-", normalized)
