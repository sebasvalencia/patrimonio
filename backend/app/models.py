from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Broker(Base):
    __tablename__ = "broker"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)

    trades: Mapped[list["Trade"]] = relationship(back_populates="broker")


class Instrument(Base):
    __tablename__ = "instrument"
    __table_args__ = (
        CheckConstraint("currency IN ('COP', 'USD')", name="ck_instrument_currency"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="COP", server_default="COP")

    trades: Mapped[list["Trade"]] = relationship(back_populates="instrument")
    prices: Mapped[list["MonthlyPrice"]] = relationship(back_populates="instrument")
    targets: Mapped[list["PriceTarget"]] = relationship(back_populates="instrument")


class Trade(Base):
    __tablename__ = "trade"
    __table_args__ = (
        CheckConstraint("type IN ('buy', 'sell')", name="ck_trade_type"),
        CheckConstraint("quantity > 0", name="ck_trade_quantity"),
        CheckConstraint("commission >= 0", name="ck_trade_commission"),
        CheckConstraint("price IS NULL OR price > 0", name="ck_trade_price"),
        CheckConstraint("month IS NULL OR (month >= 1 AND month <= 12)", name="ck_trade_month"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    instrument_id: Mapped[int] = mapped_column(ForeignKey("instrument.id"), nullable=False)
    broker_id: Mapped[int] = mapped_column(ForeignKey("broker.id"), nullable=False)
    type: Mapped[str] = mapped_column(String(10), nullable=False)
    year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    month: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    commission: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False, default=Decimal("0")
    )
    price: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)

    instrument: Mapped[Instrument] = relationship(back_populates="trades")
    broker: Mapped[Broker] = relationship(back_populates="trades")


class MonthlyPrice(Base):
    __tablename__ = "monthly_price"
    __table_args__ = (
        UniqueConstraint("instrument_id", "year", "month", name="uq_monthly_price_instrument_period"),
        CheckConstraint("month >= 1 AND month <= 12", name="ck_monthly_price_month"),
        CheckConstraint("price > 0", name="ck_monthly_price_value"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    instrument_id: Mapped[int] = mapped_column(ForeignKey("instrument.id"), nullable=False)
    year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    month: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)

    instrument: Mapped[Instrument] = relationship(back_populates="prices")


class PriceTarget(Base):
    __tablename__ = "price_target"
    __table_args__ = (
        UniqueConstraint("instrument_id", "year", "month", name="uq_price_target_instrument_period"),
        CheckConstraint("month >= 1 AND month <= 12", name="ck_price_target_month"),
        CheckConstraint("price > 0", name="ck_price_target_value"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    instrument_id: Mapped[int] = mapped_column(ForeignKey("instrument.id"), nullable=False)
    year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    month: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)

    instrument: Mapped[Instrument] = relationship(back_populates="targets")


class FxRate(Base):
    __tablename__ = "fx_rate"
    __table_args__ = (
        UniqueConstraint("year", "month", name="uq_fx_rate_period"),
        CheckConstraint("month >= 1 AND month <= 12", name="ck_fx_rate_month"),
        CheckConstraint("cop_per_usd > 0", name="ck_fx_rate_value"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    month: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    cop_per_usd: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)


from app.funds.models import Fiduciary, Fund, FundTarget, FundTrade, FundUnitValue  # noqa: E402, F401
from app.cdts.models import Bank, Cdt  # noqa: E402, F401
from app.reserves.models import Institution, ReserveAccount, ReserveBalance  # noqa: E402, F401
