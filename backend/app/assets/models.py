from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, Integer, Numeric, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Asset(Base):
    __tablename__ = "asset"
    __table_args__ = (
        CheckConstraint("currency IN ('COP', 'USD')", name="ck_asset_currency"),
        CheckConstraint("value > 0", name="ck_asset_value"),
        CheckConstraint("year >= 1900 AND year <= 2100", name="ck_asset_year"),
        CheckConstraint("month >= 1 AND month <= 12", name="ck_asset_month"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="COP", server_default="COP")
    value: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    month: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
