from decimal import Decimal

from app.schemas import CdtSummaryOut, PositionOut, ReserveSummaryOut, SummaryOut

_MIXED = "mixed"


def assign_native_total(positions: list[PositionOut]) -> Decimal | None:
    """Sum values only when every valued position shares one currency.

    A mixed book has no single total and no weight %. Positions keep their native value.
    """
    valued = [p for p in positions if p.value is not None]
    if not valued:
        total: Decimal | None = Decimal(0)
    else:
        currencies = {p.instrument_currency for p in valued}
        total = None if len(currencies) != 1 else sum((p.value for p in valued), Decimal(0))

    for p in positions:
        if total is not None and p.value is not None and total > 0:
            p.weight_pct = (p.value / total) * Decimal(100)
        elif total is not None and p.value is not None:
            p.weight_pct = Decimal(0)

    positions.sort(
        key=lambda r: (
            r.instrument_currency,
            -(r.value if r.value is not None else Decimal(0)),
            r.instrument_name,
        )
    )
    return total


def _valued_currency(positions: list[PositionOut]) -> str | None:
    currencies = {p.instrument_currency for p in positions if p.value is not None}
    if not currencies:
        return None
    if len(currencies) > 1:
        return _MIXED
    return next(iter(currencies))


def combine_native_totals(*parts: SummaryOut | ReserveSummaryOut | CdtSummaryOut) -> Decimal | None:
    currencies: list[str] = []
    for part in parts:
        cur = _valued_currency(part.positions)
        if cur == _MIXED:
            return None
        if cur is not None:
            currencies.append(cur)
    if len(set(currencies)) > 1:
        return None
    return sum((part.total or Decimal(0) for part in parts), Decimal(0))
