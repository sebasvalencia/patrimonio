from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.funds.models import FundTrade
from app.funds.schemas import FundTradeIn, FundTradeOut
from app.funds.services.rules import ensure_projected_balance, get_fund_trade, validate_replacement, validate_trade

router = APIRouter(prefix="/trades", tags=["funds"])


def _out(row: FundTrade) -> FundTradeOut:
    return FundTradeOut(
        id=row.id,
        fund_id=row.fund_id,
        fiduciary_id=row.fiduciary_id,
        type=row.type,
        year=row.year,
        month=row.month,
        quantity=row.quantity,
        commission=row.commission,
        price=row.price,
        fund_name=row.fund.name if row.fund else None,
        fiduciary_name=row.fiduciary.name if row.fiduciary else None,
        fund_currency=row.fund.currency if row.fund else None,
    )


@router.get("", response_model=list[FundTradeOut])
def list_trades(db: Session = Depends(get_db)) -> list[FundTradeOut]:
    rows = db.scalars(
        select(FundTrade)
        .options(joinedload(FundTrade.fund), joinedload(FundTrade.fiduciary))
        .order_by(FundTrade.year.desc(), FundTrade.id.desc())
    ).all()
    return [_out(r) for r in rows]


@router.get("/{trade_id}", response_model=FundTradeOut)
def get_one(trade_id: int, db: Session = Depends(get_db)) -> FundTradeOut:
    row = get_fund_trade(db, trade_id)
    return _out(row)


@router.post("", response_model=FundTradeOut, status_code=status.HTTP_201_CREATED)
def create(body: FundTradeIn, db: Session = Depends(get_db)) -> FundTradeOut:
    validate_trade(
        db,
        fund_id=body.fund_id,
        fiduciary_id=body.fiduciary_id,
        type=body.type,
        quantity=body.quantity,
    )
    row = FundTrade(
        fund_id=body.fund_id,
        fiduciary_id=body.fiduciary_id,
        type=body.type,
        year=body.year,
        month=body.month,
        quantity=body.quantity,
        commission=body.commission,
        price=body.price,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    row = get_fund_trade(db, row.id)
    return _out(row)


@router.put("/{trade_id}", response_model=FundTradeOut)
def update(trade_id: int, body: FundTradeIn, db: Session = Depends(get_db)) -> FundTradeOut:
    row = get_fund_trade(db, trade_id)
    validate_replacement(
        db,
        old_fund_id=row.fund_id,
        old_fiduciary_id=row.fiduciary_id,
        fund_id=body.fund_id,
        fiduciary_id=body.fiduciary_id,
        type=body.type,
        quantity=body.quantity,
        exclude_id=row.id,
    )
    row.fund_id = body.fund_id
    row.fiduciary_id = body.fiduciary_id
    row.type = body.type
    row.year = body.year
    row.month = body.month
    row.quantity = body.quantity
    row.commission = body.commission
    row.price = body.price
    db.commit()
    db.refresh(row)
    row = get_fund_trade(db, row.id)
    return _out(row)


@router.delete("/{trade_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(trade_id: int, db: Session = Depends(get_db)) -> None:
    row = get_fund_trade(db, trade_id)
    ensure_projected_balance(
        db,
        fund_id=row.fund_id,
        fiduciary_id=row.fiduciary_id,
        exclude_id=row.id,
        removed_error="cannot_delete_fund_trade",
    )
    db.delete(row)
    db.commit()
