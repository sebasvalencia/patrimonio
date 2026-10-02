from collections import defaultdict
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Broker, Instrument, MonthlyPrice, Trade
from app.schemas import BalanceOut, PositionOut, SummaryOut, VariationOut, VariationPointOut
from app.services.balances import pair_balance
from app.services.valuation import assign_native_total
from app.services.variation import variation_points

router = APIRouter(tags=["summary"])


def _last_price(prices: list[MonthlyPrice]) -> MonthlyPrice | None:
    if not prices:
        return None
    return max(prices, key=lambda p: (p.year, p.month))


@router.get("/balances", response_model=list[BalanceOut])
def balances(db: Session = Depends(get_db)) -> list[BalanceOut]:
    pairs = db.execute(select(Trade.instrument_id, Trade.broker_id).distinct()).all()
    out: list[BalanceOut] = []
    for instrument_id, broker_id in pairs:
        inst = db.get(Instrument, instrument_id)
        brk = db.get(Broker, broker_id)
        if inst is None or brk is None:
            continue
        out.append(
            BalanceOut(
                instrument_id=inst.id,
                instrument_name=inst.name,
                broker_id=brk.id,
                broker_name=brk.name,
                active=inst.active,
                balance=pair_balance(db, inst.id, brk.id),
                instrument_currency=inst.currency,
            )
        )
    out.sort(key=lambda r: (r.instrument_name, r.broker_name))
    return out


def build_equity_summary(db: Session) -> SummaryOut:
    pairs = db.execute(select(Trade.instrument_id, Trade.broker_id).distinct()).all()
    prices_by_inst: dict[int, list[MonthlyPrice]] = defaultdict(list)
    for p in db.scalars(select(MonthlyPrice)).all():
        prices_by_inst[p.instrument_id].append(p)

    positions: list[PositionOut] = []
    for instrument_id, broker_id in pairs:
        inst = db.get(Instrument, instrument_id)
        brk = db.get(Broker, broker_id)
        if inst is None or brk is None or not inst.active:
            continue
        balance = pair_balance(db, inst.id, brk.id)
        latest = _last_price(prices_by_inst.get(inst.id, []))
        missing_price = latest is None
        value = None
        if latest is not None:
            value = balance * Decimal(latest.price)
        positions.append(
            PositionOut(
                instrument_id=inst.id,
                instrument_name=inst.name,
                broker_id=brk.id,
                broker_name=brk.name,
                balance=balance,
                last_price=Decimal(latest.price) if latest else None,
                price_year=latest.year if latest else None,
                price_month=latest.month if latest else None,
                value=value,
                weight_pct=None,
                missing_price=missing_price,
                instrument_currency=inst.currency,
            )
        )

    total = assign_native_total(positions)
    return SummaryOut(total=total, positions=positions)


@router.get("/summary", response_model=SummaryOut)
def summary(db: Session = Depends(get_db)) -> SummaryOut:
    return build_equity_summary(db)


@router.get("/price-variation", response_model=VariationOut)
def variation(
    instrument_id: int = Query(...),
    db: Session = Depends(get_db),
) -> VariationOut:
    inst = db.get(Instrument, instrument_id)
    if inst is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "instrument_not_found")
    prices = list(
        db.scalars(
            select(MonthlyPrice)
            .where(MonthlyPrice.instrument_id == instrument_id)
            .options(joinedload(MonthlyPrice.instrument))
        ).all()
    )
    points = [
        VariationPointOut(
            year=p["year"],
            month=p["month"],
            price=p["price"],
            variation_pct=p["variation_pct"],
        )
        for p in variation_points(prices)
    ]
    return VariationOut(
        instrument_id=inst.id,
        instrument_name=inst.name,
        instrument_currency=inst.currency,
        points=points,
    )
