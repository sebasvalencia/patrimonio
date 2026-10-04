from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.reserves.models import ReserveAccount, ReserveBalance
from app.reserves.schemas import ReserveBalanceIn, ReserveBalanceOut

router = APIRouter(prefix="/balances", tags=["reserves"])


def _out(row: ReserveBalance) -> ReserveBalanceOut:
    account = row.account
    return ReserveBalanceOut(
        id=row.id,
        account_id=row.account_id,
        year=row.year,
        month=row.month,
        balance=row.balance,
        account_name=account.name,
        institution_name=account.institution.name,
        currency=account.currency,
        purpose=account.purpose,
        liquid=account.liquid,
    )


@router.get("", response_model=list[ReserveBalanceOut])
def list_balances(year: int = Query(ge=1900, le=2100), db: Session = Depends(get_db)) -> list[ReserveBalanceOut]:
    rows = db.scalars(
        select(ReserveBalance)
        .where(ReserveBalance.year == year)
        .options(joinedload(ReserveBalance.account).joinedload(ReserveAccount.institution))
        .order_by(ReserveBalance.id)
    ).all()
    return [_out(row) for row in rows]


@router.put("", response_model=ReserveBalanceOut)
def upsert(body: ReserveBalanceIn, db: Session = Depends(get_db)) -> ReserveBalanceOut:
    account = db.get(ReserveAccount, body.account_id)
    if account is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "reserve_account_not_found")
    row = db.scalar(
        select(ReserveBalance).where(
            ReserveBalance.account_id == body.account_id,
            ReserveBalance.year == body.year,
            ReserveBalance.month == body.month,
        )
    )
    if row is None:
        row = ReserveBalance(account_id=body.account_id, year=body.year, month=body.month, balance=body.balance)
        db.add(row)
    else:
        row.balance = body.balance
    db.commit()
    db.refresh(row)
    account = db.scalar(
        select(ReserveAccount)
        .where(ReserveAccount.id == row.account_id)
        .options(joinedload(ReserveAccount.institution))
    )
    row.account = account
    return _out(row)
