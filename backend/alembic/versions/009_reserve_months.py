"""Reserve balances are one row per account, year and month

Revision ID: 009_reserve_months
Revises: 008_reserves
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "009_reserve_months"
down_revision: str | None = "008_reserves"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("reserve_balance", sa.Column("month", sa.SmallInteger(), nullable=True))
    op.execute("UPDATE reserve_balance SET month = 12 WHERE month IS NULL")
    op.alter_column("reserve_balance", "month", nullable=False)
    op.drop_constraint("uq_reserve_balance_year", "reserve_balance", type_="unique")
    op.create_unique_constraint("uq_reserve_balance_period", "reserve_balance", ["account_id", "year", "month"])
    op.drop_constraint("ck_reserve_balance_contribution", "reserve_balance", type_="check")
    op.drop_column("reserve_balance", "monthly_contribution")
    op.create_check_constraint("ck_reserve_balance_month", "reserve_balance", "month >= 1 AND month <= 12")


def downgrade() -> None:
    op.drop_constraint("ck_reserve_balance_month", "reserve_balance", type_="check")
    op.add_column(
        "reserve_balance",
        sa.Column("monthly_contribution", sa.Numeric(18, 2), nullable=False, server_default="0"),
    )
    op.drop_constraint("uq_reserve_balance_period", "reserve_balance", type_="unique")
    op.create_unique_constraint("uq_reserve_balance_year", "reserve_balance", ["account_id", "year"])
    op.drop_column("reserve_balance", "month")
    op.create_check_constraint("ck_reserve_balance_contribution", "reserve_balance", "monthly_contribution >= 0")
