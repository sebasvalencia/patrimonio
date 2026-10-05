"""CDT certificate fields from the bank statement

Revision ID: 011_cdt_certificate
Revises: 010_cdts
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "011_cdt_certificate"
down_revision: str | None = "010_cdts"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("cdt", sa.Column("term_days", sa.Integer(), nullable=True))
    op.execute("UPDATE cdt SET term_days = (matures_on - opened_on) WHERE term_days IS NULL")
    op.alter_column("cdt", "term_days", nullable=False)
    op.add_column(
        "cdt",
        sa.Column("yield_payment", sa.String(16), nullable=False, server_default="at_maturity"),
    )
    op.add_column(
        "cdt",
        sa.Column("payment_frequency", sa.String(16), nullable=False, server_default="single"),
    )
    op.add_column("cdt", sa.Column("capitalize", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("cdt", sa.Column("gross_yield", sa.Numeric(18, 2), nullable=False, server_default="0"))
    op.add_column("cdt", sa.Column("net_yield", sa.Numeric(18, 2), nullable=False, server_default="0"))
    op.add_column("cdt", sa.Column("withholding", sa.Numeric(18, 2), nullable=False, server_default="0"))
    op.create_check_constraint("ck_cdt_term_days", "cdt", "term_days > 0")
    op.create_check_constraint(
        "ck_cdt_yield_payment",
        "cdt",
        "yield_payment IN ('at_maturity', 'in_advance')",
    )
    op.create_check_constraint(
        "ck_cdt_frequency",
        "cdt",
        "payment_frequency IN ('single', 'monthly', 'quarterly', 'semiannual', 'annual')",
    )
    op.create_check_constraint("ck_cdt_gross_yield", "cdt", "gross_yield >= 0")
    op.create_check_constraint("ck_cdt_net_yield", "cdt", "net_yield >= 0")
    op.create_check_constraint("ck_cdt_withholding", "cdt", "withholding >= 0")


def downgrade() -> None:
    op.drop_constraint("ck_cdt_withholding", "cdt", type_="check")
    op.drop_constraint("ck_cdt_net_yield", "cdt", type_="check")
    op.drop_constraint("ck_cdt_gross_yield", "cdt", type_="check")
    op.drop_constraint("ck_cdt_frequency", "cdt", type_="check")
    op.drop_constraint("ck_cdt_yield_payment", "cdt", type_="check")
    op.drop_constraint("ck_cdt_term_days", "cdt", type_="check")
    op.drop_column("cdt", "withholding")
    op.drop_column("cdt", "net_yield")
    op.drop_column("cdt", "gross_yield")
    op.drop_column("cdt", "capitalize")
    op.drop_column("cdt", "payment_frequency")
    op.drop_column("cdt", "yield_payment")
    op.drop_column("cdt", "term_days")
