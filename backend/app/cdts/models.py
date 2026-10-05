from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Bank(Base):
    __tablename__ = "bank"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)

    cdts: Mapped[list["Cdt"]] = relationship(back_populates="bank")


class Cdt(Base):
    __tablename__ = "cdt"
    __table_args__ = (
        CheckConstraint("currency IN ('COP', 'USD')", name="ck_cdt_currency"),
        CheckConstraint("principal > 0", name="ck_cdt_principal"),
        CheckConstraint("annual_rate > 0 AND annual_rate <= 100", name="ck_cdt_rate"),
        CheckConstraint("matures_on > opened_on", name="ck_cdt_term"),
        CheckConstraint("term_days > 0", name="ck_cdt_term_days"),
        CheckConstraint("yield_payment IN ('at_maturity', 'in_advance')", name="ck_cdt_yield_payment"),
        CheckConstraint(
            "payment_frequency IN ('single', 'monthly', 'quarterly', 'semiannual', 'annual')",
            name="ck_cdt_frequency",
        ),
        CheckConstraint("gross_yield >= 0", name="ck_cdt_gross_yield"),
        CheckConstraint("net_yield >= 0", name="ck_cdt_net_yield"),
        CheckConstraint("withholding >= 0", name="ck_cdt_withholding"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    bank_id: Mapped[int] = mapped_column(ForeignKey("bank.id"), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="COP", server_default="COP")
    principal: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    annual_rate: Mapped[Decimal] = mapped_column(Numeric(7, 4), nullable=False)
    opened_on: Mapped[date] = mapped_column(Date, nullable=False)
    matures_on: Mapped[date] = mapped_column(Date, nullable=False)
    term_days: Mapped[int] = mapped_column(Integer, nullable=False)
    yield_payment: Mapped[str] = mapped_column(String(16), nullable=False, default="at_maturity")
    payment_frequency: Mapped[str] = mapped_column(String(16), nullable=False, default="single")
    capitalize: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    gross_yield: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    net_yield: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    withholding: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    bank: Mapped[Bank] = relationship(back_populates="cdts")
