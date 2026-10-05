from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

_CENT = Decimal("0.01")
_YEAR = Decimal(365)


def clock() -> date:
    return date.today()


@dataclass(frozen=True)
class CdtQuote:
    value: Decimal | None
    status: str
    liquid: bool
    price_year: int | None
    price_month: int | None


def quote(
    principal: Decimal,
    annual_rate_pct: Decimal,
    opened_on: date,
    matures_on: date,
    today: date,
) -> CdtQuote:
    """Effective annual rate, 365-day year. Interest stops on the maturity date."""
    if today < opened_on:
        return CdtQuote(None, "upcoming", False, None, None)
    if today >= matures_on:
        end = matures_on
        status = "matured"
        liquid = True
    else:
        end = today
        status = "accruing"
        liquid = False
    days = Decimal((end - opened_on).days)
    growth = (Decimal(1) + annual_rate_pct / Decimal(100)) ** (days / _YEAR)
    value = (principal * growth).quantize(_CENT, rounding=ROUND_HALF_UP)
    return CdtQuote(value, status, liquid, end.year, end.month)
