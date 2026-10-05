from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas import VisibleDecimal

YieldPayment = Literal["at_maturity", "in_advance"]
PaymentFrequency = Literal["single", "monthly", "quarterly", "semiannual", "annual"]


class BankIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class BankOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class CdtIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    bank_id: int
    currency: Literal["COP", "USD"] = "COP"
    principal: Decimal = Field(gt=0)
    annual_rate: Decimal = Field(gt=0, le=100)
    opened_on: date
    matures_on: date
    term_days: int | None = Field(default=None, gt=0, le=36500)
    yield_payment: YieldPayment = "at_maturity"
    payment_frequency: PaymentFrequency = "single"
    capitalize: bool = False
    gross_yield: Decimal = Field(default=Decimal("0"), ge=0)
    net_yield: Decimal = Field(default=Decimal("0"), ge=0)
    withholding: Decimal = Field(default=Decimal("0"), ge=0)
    active: bool = True


class CdtUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    bank_id: int | None = None
    currency: Literal["COP", "USD"] | None = None
    principal: Decimal | None = Field(default=None, gt=0)
    annual_rate: Decimal | None = Field(default=None, gt=0, le=100)
    opened_on: date | None = None
    matures_on: date | None = None
    term_days: int | None = Field(default=None, gt=0, le=36500)
    yield_payment: YieldPayment | None = None
    payment_frequency: PaymentFrequency | None = None
    capitalize: bool | None = None
    gross_yield: Decimal | None = Field(default=None, ge=0)
    net_yield: Decimal | None = Field(default=None, ge=0)
    withholding: Decimal | None = Field(default=None, ge=0)
    active: bool | None = None


class CdtOut(BaseModel):
    id: int
    name: str
    bank_id: int
    bank_name: str
    currency: str
    principal: VisibleDecimal
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
    active: bool
    value: VisibleDecimal | None
    status: str
    liquid: bool
