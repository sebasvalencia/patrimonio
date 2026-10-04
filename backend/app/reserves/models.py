from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, Numeric, SmallInteger, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Institution(Base):
    __tablename__ = "institution"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)

    accounts: Mapped[list["ReserveAccount"]] = relationship(back_populates="institution")


class ReserveAccount(Base):
    __tablename__ = "reserve_account"
    __table_args__ = (
        CheckConstraint("currency IN ('COP', 'USD')", name="ck_reserve_account_currency"),
        CheckConstraint(
            "purpose IN ('official_pension', 'severance', 'voluntary_pension', 'emergency')",
            name="ck_reserve_account_purpose",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    institution_id: Mapped[int] = mapped_column(ForeignKey("institution.id"), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="COP", server_default="COP")
    purpose: Mapped[str] = mapped_column(String(32), nullable=False)
    liquid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    institution: Mapped[Institution] = relationship(back_populates="accounts")
    balances: Mapped[list["ReserveBalance"]] = relationship(back_populates="account")


class ReserveBalance(Base):
    __tablename__ = "reserve_balance"
    __table_args__ = (
        UniqueConstraint("account_id", "year", "month", name="uq_reserve_balance_period"),
        CheckConstraint("balance >= 0", name="ck_reserve_balance_balance"),
        CheckConstraint("month >= 1 AND month <= 12", name="ck_reserve_balance_month"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("reserve_account.id"), nullable=False)
    year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    month: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)

    account: Mapped[ReserveAccount] = relationship(back_populates="balances")
