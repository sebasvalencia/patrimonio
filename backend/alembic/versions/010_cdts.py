"""CDTs: bank and term deposit

Revision ID: 010_cdts
Revises: 009_reserve_months
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "010_cdts"
down_revision: str | None = "009_reserve_months"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "bank",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False, unique=True),
    )
    op.create_table(
        "cdt",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False, unique=True),
        sa.Column("bank_id", sa.Integer(), sa.ForeignKey("bank.id"), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="COP"),
        sa.Column("principal", sa.Numeric(18, 2), nullable=False),
        sa.Column("annual_rate", sa.Numeric(7, 4), nullable=False),
        sa.Column("opened_on", sa.Date(), nullable=False),
        sa.Column("matures_on", sa.Date(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.CheckConstraint("currency IN ('COP', 'USD')", name="ck_cdt_currency"),
        sa.CheckConstraint("principal > 0", name="ck_cdt_principal"),
        sa.CheckConstraint("annual_rate > 0 AND annual_rate <= 100", name="ck_cdt_rate"),
        sa.CheckConstraint("matures_on > opened_on", name="ck_cdt_term"),
    )


def downgrade() -> None:
    op.drop_table("cdt")
    op.drop_table("bank")
