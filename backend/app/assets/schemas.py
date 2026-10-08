from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas import VisibleDecimal


class AssetIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    currency: Literal["COP", "USD"] = "COP"
    value: Decimal = Field(gt=0)
    year: int = Field(ge=1900, le=2100)
    month: int = Field(ge=1, le=12)
    active: bool = True


class AssetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    currency: Literal["COP", "USD"] | None = None
    value: Decimal | None = Field(default=None, gt=0)
    year: int | None = Field(default=None, ge=1900, le=2100)
    month: int | None = Field(default=None, ge=1, le=12)
    active: bool | None = None


class AssetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    currency: str
    value: VisibleDecimal
    year: int
    month: int
    active: bool
