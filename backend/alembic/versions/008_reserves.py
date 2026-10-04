"""Reserve accounts: institution, reserve_account, reserve_balance

Revision ID: 008_reserves
Revises: 007_funds
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "008_reserves"
down_revision: str | None = "007_funds"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "institution",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False, unique=True),
    )
    op.create_table(
        "reserve_account",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False, unique=True),
        sa.Column("institution_id", sa.Integer(), sa.ForeignKey("institution.id"), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="COP"),
        sa.Column("purpose", sa.String(32), nullable=False),
        sa.Column("liquid", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.CheckConstraint("currency IN ('COP', 'USD')", name="ck_reserve_account_currency"),
        sa.CheckConstraint(
            "purpose IN ('official_pension', 'severance', 'voluntary_pension', 'emergency')",
            name="ck_reserve_account_purpose",
        ),
    )
    op.create_table(
        "reserve_balance",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("reserve_account.id"), nullable=False),
        sa.Column("year", sa.SmallInteger(), nullable=False),
        sa.Column("balance", sa.Numeric(18, 2), nullable=False),
        sa.Column("monthly_contribution", sa.Numeric(18, 2), nullable=False),
        sa.UniqueConstraint("account_id", "year", name="uq_reserve_balance_year"),
        sa.CheckConstraint("balance >= 0", name="ck_reserve_balance_balance"),
        sa.CheckConstraint("monthly_contribution >= 0", name="ck_reserve_balance_contribution"),
    )


def downgrade() -> None:
    op.drop_table("reserve_balance")
    op.drop_table("reserve_account")
    op.drop_table("institution")
