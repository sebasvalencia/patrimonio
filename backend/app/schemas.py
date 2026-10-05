from datetime import date
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer


def _plain_decimal(v: Decimal) -> str:
    text = format(v, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text


VisibleDecimal = Annotated[Decimal, PlainSerializer(_plain_decimal, return_type=str)]


class BrokerIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class BrokerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class InstrumentIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    active: bool = True
    currency: Literal["COP", "USD"] = "COP"


class InstrumentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    active: bool | None = None
    currency: Literal["COP", "USD"] | None = None


class InstrumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    active: bool
    currency: str


class TradeIn(BaseModel):
    instrument_id: int
    broker_id: int
    type: Literal["buy", "sell"]
    year: int = Field(ge=1900, le=2100)
    month: int | None = Field(default=None, ge=1, le=12)
    quantity: Decimal = Field(gt=0)
    commission: Decimal = Field(default=Decimal("0"), ge=0)
    price: Decimal | None = Field(default=None, gt=0)


class TradeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    instrument_id: int
    broker_id: int
    type: str
    year: int
    month: int | None
    quantity: VisibleDecimal
    commission: VisibleDecimal
    price: VisibleDecimal | None = None
    instrument_name: str | None = None
    broker_name: str | None = None
    instrument_currency: str | None = None


class PriceIn(BaseModel):
    instrument_id: int
    year: int = Field(ge=1900, le=2100)
    month: int = Field(ge=1, le=12)
    price: Decimal = Field(gt=0)


class PriceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    instrument_id: int
    year: int
    month: int
    price: VisibleDecimal
    instrument_name: str | None = None
    instrument_currency: str | None = None


class MissingPriceOut(BaseModel):
    instrument_id: int
    instrument_name: str


class PendingPricesOut(BaseModel):
    year: int
    month: int
    total_active: int
    pending: int
    missing: list[MissingPriceOut]


class BalanceOut(BaseModel):
    instrument_id: int
    instrument_name: str
    broker_id: int
    broker_name: str
    active: bool
    balance: VisibleDecimal
    instrument_currency: str


class PositionOut(BaseModel):
    instrument_id: int
    instrument_name: str
    broker_id: int
    broker_name: str
    balance: VisibleDecimal
    last_price: VisibleDecimal | None
    price_year: int | None
    price_month: int | None
    value: VisibleDecimal | None
    weight_pct: VisibleDecimal | None
    missing_price: bool
    instrument_currency: str


class SummaryOut(BaseModel):
    total: VisibleDecimal | None
    positions: list[PositionOut]


class ReservePositionOut(PositionOut):
    purpose: str
    liquid: bool


class ReserveSummaryOut(BaseModel):
    total: VisibleDecimal | None
    positions: list[ReservePositionOut]


class CdtPositionOut(PositionOut):
    annual_rate: VisibleDecimal
    opened_on: date
    matures_on: date
    term_days: int
    yield_payment: str
    payment_frequency: str
    capitalize: bool
    gross_yield: VisibleDecimal
    net_yield: VisibleDecimal
    withholding: VisibleDecimal
    status: str
    liquid: bool


class CdtSummaryOut(BaseModel):
    total: VisibleDecimal | None
    positions: list[CdtPositionOut]


class WealthOut(BaseModel):
    equities: SummaryOut
    funds: SummaryOut
    reserves: ReserveSummaryOut
    cdts: CdtSummaryOut
    total: VisibleDecimal | None


class TargetIn(BaseModel):
    instrument_id: int
    year: int = Field(ge=1900, le=2100)
    month: int = Field(ge=1, le=12)
    price: Decimal = Field(gt=0)


class TargetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    instrument_id: int
    year: int
    month: int
    price: VisibleDecimal
    instrument_name: str | None = None
    instrument_currency: str | None = None


class TargetProgressOut(BaseModel):
    instrument_id: int
    instrument_name: str
    last_price: VisibleDecimal | None
    price_year: int | None
    price_month: int | None
    target: VisibleDecimal | None
    target_year: int | None
    target_month: int | None
    progress_pct: VisibleDecimal | None
    instrument_currency: str


class VariationPointOut(BaseModel):
    year: int
    month: int
    price: VisibleDecimal
    variation_pct: VisibleDecimal | None


class VariationOut(BaseModel):
    instrument_id: int
    instrument_name: str
    instrument_currency: str
    points: list[VariationPointOut]


class FxRateIn(BaseModel):
    year: int = Field(ge=1900, le=2100)
    month: int = Field(ge=1, le=12)
    cop_per_usd: Decimal = Field(gt=0)


class FxRateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    year: int
    month: int
    cop_per_usd: VisibleDecimal
