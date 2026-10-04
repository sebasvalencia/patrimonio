from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas import VisibleDecimal

Purpose = Literal["official_pension", "severance", "voluntary_pension", "emergency"]


class InstitutionIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class InstitutionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class ReserveAccountIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    institution_id: int
    currency: Literal["COP", "USD"] = "COP"
    purpose: Purpose
    liquid: bool | None = None
    active: bool = True


class ReserveAccountUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    institution_id: int | None = None
    currency: Literal["COP", "USD"] | None = None
    purpose: Purpose | None = None
    liquid: bool | None = None
    active: bool | None = None


class ReserveAccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    institution_id: int
    institution_name: str
    currency: str
    purpose: str
    liquid: bool
    active: bool


class ReserveBalanceIn(BaseModel):
    account_id: int
    year: int = Field(ge=1900, le=2100)
    month: int = Field(ge=1, le=12)
    balance: Decimal = Field(ge=0)


class ReserveBalanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    year: int
    month: int
    balance: VisibleDecimal
    account_name: str
    institution_name: str
    currency: str
    purpose: str
    liquid: bool
