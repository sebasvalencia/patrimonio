from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.funds.models import Fiduciary, Fund, FundTarget, FundTrade, FundUnitValue
from app.funds.services.balances import fund_balance, pair_balance
from app.services.rules import BusinessRule


def get_fiduciary(db: Session, fiduciary_id: int) -> Fiduciary:
    row = db.get(Fiduciary, fiduciary_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "fiduciary_not_found")
    return row


def get_fund(db: Session, fund_id: int) -> Fund:
    row = db.get(Fund, fund_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "fund_not_found")
    return row


def get_fund_trade(db: Session, trade_id: int) -> FundTrade:
    row = db.get(FundTrade, trade_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "fund_trade_not_found")
    return row


def validate_inactivate(db: Session, fund: Fund, active: bool) -> None:
    if active is False and fund.active is True:
        if fund_balance(db, fund.id) > 0:
            raise BusinessRule("cannot_inactivate_fund")


def validate_currency_change(db: Session, fund: Fund, currency: str) -> None:
    if currency == fund.currency:
        return
    has_data = (
        db.scalar(select(FundTrade.id).where(FundTrade.fund_id == fund.id).limit(1)) is not None
        or db.scalar(select(FundUnitValue.id).where(FundUnitValue.fund_id == fund.id).limit(1))
        is not None
        or db.scalar(select(FundTarget.id).where(FundTarget.fund_id == fund.id).limit(1)) is not None
    )
    if has_data:
        raise BusinessRule("cannot_change_fund_currency")


def _lock_pair(db: Session, fund_id: int, fiduciary_id: int) -> None:
    if db.get_bind().dialect.name != "postgresql":
        return
    db.execute(
        select(FundTrade.id)
        .where(FundTrade.fund_id == fund_id, FundTrade.fiduciary_id == fiduciary_id)
        .with_for_update()
    ).all()


def ensure_projected_balance(
    db: Session,
    *,
    fund_id: int,
    fiduciary_id: int,
    exclude_id: int | None = None,
    incoming_type: str | None = None,
    incoming_quantity: Decimal | None = None,
    removed_error: str = "negative_balance",
) -> None:
    _lock_pair(db, fund_id, fiduciary_id)
    balance = pair_balance(db, fund_id, fiduciary_id, exclude_id=exclude_id)
    if incoming_type is not None and incoming_quantity is not None:
        balance += incoming_quantity if incoming_type == "subscribe" else -incoming_quantity
    if balance >= 0:
        return
    if incoming_type == "redeem":
        raise BusinessRule("redeem_exceeds_balance")
    if incoming_type is None:
        raise BusinessRule(removed_error)
    raise BusinessRule("negative_balance")


def validate_trade(
    db: Session,
    *,
    fund_id: int,
    fiduciary_id: int,
    type: str,
    quantity: Decimal,
    exclude_id: int | None = None,
) -> None:
    get_fiduciary(db, fiduciary_id)
    fund = get_fund(db, fund_id)
    if type == "subscribe" and not fund.active:
        raise BusinessRule("cannot_subscribe_inactive")
    ensure_projected_balance(
        db,
        fund_id=fund_id,
        fiduciary_id=fiduciary_id,
        exclude_id=exclude_id,
        incoming_type=type,
        incoming_quantity=quantity,
    )


def validate_replacement(
    db: Session,
    *,
    old_fund_id: int,
    old_fiduciary_id: int,
    fund_id: int,
    fiduciary_id: int,
    type: str,
    quantity: Decimal,
    exclude_id: int,
) -> None:
    get_fiduciary(db, fiduciary_id)
    fund = get_fund(db, fund_id)
    if type == "subscribe" and not fund.active:
        raise BusinessRule("cannot_subscribe_inactive")
    old = (old_fund_id, old_fiduciary_id)
    new = (fund_id, fiduciary_id)
    for pair in sorted({old, new}):
        landing = pair == new
        ensure_projected_balance(
            db,
            fund_id=pair[0],
            fiduciary_id=pair[1],
            exclude_id=exclude_id,
            incoming_type=type if landing else None,
            incoming_quantity=quantity if landing else None,
        )
