from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import FxRate
from app.schemas import FxRateIn, FxRateOut
from app.services.trm_source import TrmSourceError, fetch_series, months_due, rate_on, today

router = APIRouter(prefix="/fx-rates", tags=["fx"])


@router.get("", response_model=list[FxRateOut])
def list_rates(
    year: int | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[FxRate]:
    q = select(FxRate)
    if year is not None:
        q = q.where(FxRate.year == year)
    return list(db.scalars(q.order_by(FxRate.year, FxRate.month)).all())


def _store_if_missing(db: Session, year: int, month: int, cop_per_usd: Decimal) -> None:
    existing = db.scalar(select(FxRate).where(FxRate.year == year, FxRate.month == month))
    if existing is not None:
        return
    db.add(FxRate(year=year, month=month, cop_per_usd=cop_per_usd))


@router.post("/official", response_model=list[FxRateOut])
def import_official(
    year: int = Query(ge=1900, le=2100),
    db: Session = Depends(get_db),
) -> list[FxRate]:
    try:
        records = fetch_series(year)
    except TrmSourceError:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "fx_source_unavailable") from None
    on = today()
    for month in months_due(year, on):
        rate = rate_on(records, date(year, month, 1))
        if rate is None:
            continue
        _store_if_missing(db, year, month, rate)
    db.commit()
    return list_rates(year=year, db=db)


@router.put("", response_model=FxRateOut)
def upsert(body: FxRateIn, db: Session = Depends(get_db)) -> FxRate:
    row = db.scalar(
        select(FxRate).where(FxRate.year == body.year, FxRate.month == body.month)
    )
    if row is None:
        row = FxRate(year=body.year, month=body.month, cop_per_usd=body.cop_per_usd)
        db.add(row)
    else:
        row.cop_per_usd = body.cop_per_usd
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{rate_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(rate_id: int, db: Session = Depends(get_db)) -> None:
    row = db.get(FxRate, rate_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "fx_rate_not_found")
    db.delete(row)
    db.commit()
