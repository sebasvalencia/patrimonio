"""Physical goods: one current value each

Revision ID: 012_assets
Revises: 011_cdt_certificate
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "012_assets"
down_revision: str | None = "011_cdt_certificate"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "asset",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False, unique=True),
        sa.Column("currency", sa.String(3), nullable=False, server_default="COP"),
        sa.Column("value", sa.Numeric(18, 2), nullable=False),
        sa.Column("year", sa.SmallInteger(), nullable=False),
        sa.Column("month", sa.SmallInteger(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.CheckConstraint("currency IN ('COP', 'USD')", name="ck_asset_currency"),
        sa.CheckConstraint("value > 0", name="ck_asset_value"),
        sa.CheckConstraint("year >= 1900 AND year <= 2100", name="ck_asset_year"),
        sa.CheckConstraint("month >= 1 AND month <= 12", name="ck_asset_month"),
    )


def downgrade() -> None:
    op.drop_table("asset")
