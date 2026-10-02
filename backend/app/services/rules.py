from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Broker, Instrument, MonthlyPrice, PriceTarget, Trade
from app.services.balances import instrument_balance, pair_balance


class BusinessRule(HTTPException):
    def __init__(self, detail: str) -> None:
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def get_broker(db: Session, broker_id: int) -> Broker:
    row = db.get(Broker, broker_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "broker_not_found")
    return row


def get_instrument(db: Session, instrument_id: int) -> Instrument:
    row = db.get(Instrument, instrument_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "instrument_not_found")
    return row


def get_trade(db: Session, trade_id: int) -> Trade:
    row = db.get(Trade, trade_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "trade_not_found")
    return row


def validate_inactivate(db: Session, instrument: Instrument, active: bool) -> None:
    if active is False and instrument.active is True:
        if instrument_balance(db, instrument.id) > 0:
            raise BusinessRule("cannot_inactivate")


def validate_currency_change(db: Session, instrument: Instrument, currency: str) -> None:
    if currency == instrument.currency:
        return
    has_data = (
        db.scalar(select(Trade.id).where(Trade.instrument_id == instrument.id).limit(1)) is not None
        or db.scalar(select(MonthlyPrice.id).where(MonthlyPrice.instrument_id == instrument.id).limit(1))
        is not None
        or db.scalar(select(PriceTarget.id).where(PriceTarget.instrument_id == instrument.id).limit(1))
        is not None
    )
    if has_data:
        raise BusinessRule("cannot_change_currency")


def _lock_pair(db: Session, instrument_id: int, broker_id: int) -> None:
    if db.get_bind().dialect.name != "postgresql":
        return
    db.execute(
        select(Trade.id)
        .where(Trade.instrument_id == instrument_id, Trade.broker_id == broker_id)
        .with_for_update()
    ).all()


def ensure_projected_balance(
    db: Session,
    *,
    instrument_id: int,
    broker_id: int,
    exclude_id: int | None = None,
    incoming_type: str | None = None,
    incoming_quantity: Decimal | None = None,
    removed_error: str = "negative_balance",
) -> None:
    """Lock the pair, then reject a projected balance below zero.

    ``incoming_*`` is the trade being inserted or the replacement on this pair.
    Omit it when the trade is only leaving the pair (edit that moves it, or delete).
    """
    _lock_pair(db, instrument_id, broker_id)
    balance = pair_balance(db, instrument_id, broker_id, exclude_id=exclude_id)
    if incoming_type is not None and incoming_quantity is not None:
        balance += incoming_quantity if incoming_type == "buy" else -incoming_quantity
    if balance >= 0:
        return
    if incoming_type == "sell":
        raise BusinessRule("sell_exceeds_balance")
    if incoming_type is None:
        raise BusinessRule(removed_error)
    raise BusinessRule("negative_balance")


def validate_trade(
    db: Session,
    *,
    instrument_id: int,
    broker_id: int,
    type: str,
    quantity: Decimal,
    exclude_id: int | None = None,
) -> None:
    get_broker(db, broker_id)
    inst = get_instrument(db, instrument_id)
    if type == "buy" and not inst.active:
        raise BusinessRule("cannot_buy_inactive")
    ensure_projected_balance(
        db,
        instrument_id=instrument_id,
        broker_id=broker_id,
        exclude_id=exclude_id,
        incoming_type=type,
        incoming_quantity=quantity,
    )


def validate_replacement(
    db: Session,
    *,
    old_instrument_id: int,
    old_broker_id: int,
    instrument_id: int,
    broker_id: int,
    type: str,
    quantity: Decimal,
    exclude_id: int,
) -> None:
    """Check the pair the trade leaves and the pair it lands on.

    Pairs are locked in id order so two edits cannot deadlock.
    """
    get_broker(db, broker_id)
    inst = get_instrument(db, instrument_id)
    if type == "buy" and not inst.active:
        raise BusinessRule("cannot_buy_inactive")
    old = (old_instrument_id, old_broker_id)
    new = (instrument_id, broker_id)
    for pair in sorted({old, new}):
        landing = pair == new
        ensure_projected_balance(
            db,
            instrument_id=pair[0],
            broker_id=pair[1],
            exclude_id=exclude_id,
            incoming_type=type if landing else None,
            incoming_quantity=quantity if landing else None,
        )
