"""seed default roles

Revision ID: 982273cf4199
Revises: 5a6b34921106
Create Date: 2026-11-19 21:28:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "982273cf4199"
down_revision: str | Sequence[str] | None = "5a6b34921106"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

roles_table = sa.table(
    "roles",
    sa.column("name", sa.String),
    sa.column("description", sa.String),
)

DEFAULT_ROLES = [
    {"name": "admin", "description": "Pengelola website"},
    {"name": "customer", "description": "Pembeli"},
    {"name": "staff", "description": "Pengelola produk"},
]


def upgrade() -> None:
    """Isi role default."""
    op.bulk_insert(roles_table, DEFAULT_ROLES)


def downgrade() -> None:
    """Hapus role default."""
    op.execute(
        sa.text("DELETE FROM roles WHERE name IN ('admin', 'customer', 'staff')")
    )
