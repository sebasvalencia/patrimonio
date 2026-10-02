from collections import defaultdict
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.funds.models import Fiduciary, Fund, FundTrade, FundUnitValue
from app.funds.schemas import FundVariationOut, FundVariationPointOut
from app.funds.services.balances import pair_balance
from app.funds.services.variation import unit_value_variation_points
from app.schemas import PositionOut, SummaryOut
from app.services.valuation import assign_native_total

router = APIRouter(tags=["funds"])


def _last_value(values: list[FundUnitValue]) -> FundUnitValue | None:
    if not values:
        return None
    return max(values, key=lambda p: (p.year, p.month))


def build_fund_summary(db: Session) -> SummaryOut:
    pairs = db.execute(select(FundTrade.fund_id, FundTrade.fiduciary_id).distinct()).all()
    values_by_fund: dict[int, list[FundUnitValue]] = defaultdict(list)
    for p in db.scalars(select(FundUnitValue)).all():
        values_by_fund[p.fund_id].append(p)

    positions: list[PositionOut] = []
    for fund_id, fiduciary_id in pairs:
        fund = db.get(Fund, fund_id)
        fid = db.get(Fiduciary, fiduciary_id)
        if fund is None or fid is None or not fund.active:
            continue
        balance = pair_balance(db, fund.id, fid.id)
        latest = _last_value(values_by_fund.get(fund.id, []))
        missing_price = latest is None
        value = None
        if latest is not None:
            value = balance * Decimal(latest.value)
        positions.append(
            PositionOut(
                instrument_id=fund.id,
                instrument_name=fund.name,
                broker_id=fid.id,
                broker_name=fid.name,
                balance=balance,
                last_price=Decimal(latest.value) if latest else None,
                price_year=latest.year if latest else None,
                price_month=latest.month if latest else None,
                value=value,
                weight_pct=None,
                missing_price=missing_price,
                instrument_currency=fund.currency,
            )
        )

    total = assign_native_total(positions)
    return SummaryOut(total=total, positions=positions)


@router.get("/summary", response_model=SummaryOut)
def summary(db: Session = Depends(get_db)) -> SummaryOut:
    return build_fund_summary(db)


@router.get("/price-variation", response_model=FundVariationOut)
def variation(
    fund_id: int = Query(...),
    db: Session = Depends(get_db),
) -> FundVariationOut:
    fund = db.get(Fund, fund_id)
    if fund is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "fund_not_found")
    values = list(
        db.scalars(
            select(FundUnitValue)
            .where(FundUnitValue.fund_id == fund_id)
            .options(joinedload(FundUnitValue.fund))
        ).all()
    )
    points = [
        FundVariationPointOut(
            year=p["year"],
            month=p["month"],
            price=p["price"],
            variation_pct=p["variation_pct"],
        )
        for p in unit_value_variation_points(values)
    ]
    return FundVariationOut(
        fund_id=fund.id,
        fund_name=fund.name,
        fund_currency=fund.currency,
        points=points,
    )
