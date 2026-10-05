from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.cdts.models import Bank, Cdt
from app.cdts.schemas import CdtIn, CdtOut, CdtUpdate
from app.cdts.services import value as cdt_value
from app.database import get_db

router = APIRouter(prefix="/cdts", tags=["cdts"])


def _dates(opened_on, matures_on) -> None:
    if matures_on <= opened_on:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "maturity_before_opening")


def _term_days(stated: int | None, opened_on, matures_on) -> int:
    if stated is not None:
        return stated
    return (matures_on - opened_on).days


def _out(row: Cdt) -> CdtOut:
    quoted = cdt_value.quote(row.principal, row.annual_rate, row.opened_on, row.matures_on, cdt_value.clock())
    return CdtOut(
        id=row.id,
        name=row.name,
        bank_id=row.bank_id,
        bank_name=row.bank.name,
        currency=row.currency,
        principal=row.principal,
        annual_rate=row.annual_rate,
        opened_on=row.opened_on,
        matures_on=row.matures_on,
        term_days=row.term_days,
        yield_payment=row.yield_payment,
        payment_frequency=row.payment_frequency,
        capitalize=row.capitalize,
        gross_yield=row.gross_yield,
        net_yield=row.net_yield,
        withholding=row.withholding,
        active=row.active,
        value=quoted.value,
        status=quoted.status,
        liquid=quoted.liquid,
    )


def _get(db: Session, cdt_id: int) -> Cdt:
    row = db.scalar(select(Cdt).where(Cdt.id == cdt_id).options(joinedload(Cdt.bank)))
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "cdt_not_found")
    return row


@router.get("", response_model=list[CdtOut])
def list_cdts(db: Session = Depends(get_db)) -> list[CdtOut]:
    rows = db.scalars(select(Cdt).options(joinedload(Cdt.bank)).order_by(Cdt.name)).unique().all()
    return [_out(row) for row in rows]


@router.post("", response_model=CdtOut, status_code=status.HTTP_201_CREATED)
def create(body: CdtIn, db: Session = Depends(get_db)) -> CdtOut:
    if db.get(Bank, body.bank_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "bank_not_found")
    _dates(body.opened_on, body.matures_on)
    row = Cdt(
        name=body.name.strip(),
        bank_id=body.bank_id,
        currency=body.currency,
        principal=body.principal,
        annual_rate=body.annual_rate,
        opened_on=body.opened_on,
        matures_on=body.matures_on,
        term_days=_term_days(body.term_days, body.opened_on, body.matures_on),
        yield_payment=body.yield_payment,
        payment_frequency=body.payment_frequency,
        capitalize=body.capitalize,
        gross_yield=body.gross_yield,
        net_yield=body.net_yield,
        withholding=body.withholding,
        active=body.active,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "cdt_exists")
    return _out(_get(db, row.id))


@router.put("/{cdt_id}", response_model=CdtOut)
def update(cdt_id: int, body: CdtUpdate, db: Session = Depends(get_db)) -> CdtOut:
    row = _get(db, cdt_id)
    if body.bank_id is not None:
        if db.get(Bank, body.bank_id) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "bank_not_found")
        row.bank_id = body.bank_id
    if body.currency is not None:
        row.currency = body.currency
    if body.name is not None:
        row.name = body.name.strip()
    if body.principal is not None:
        row.principal = body.principal
    if body.annual_rate is not None:
        row.annual_rate = body.annual_rate
    opened_on = body.opened_on if body.opened_on is not None else row.opened_on
    matures_on = body.matures_on if body.matures_on is not None else row.matures_on
    _dates(opened_on, matures_on)
    if body.opened_on is not None:
        row.opened_on = body.opened_on
    if body.matures_on is not None:
        row.matures_on = body.matures_on
    if body.term_days is not None:
        row.term_days = body.term_days
    if body.yield_payment is not None:
        row.yield_payment = body.yield_payment
    if body.payment_frequency is not None:
        row.payment_frequency = body.payment_frequency
    if body.capitalize is not None:
        row.capitalize = body.capitalize
    if body.gross_yield is not None:
        row.gross_yield = body.gross_yield
    if body.net_yield is not None:
        row.net_yield = body.net_yield
    if body.withholding is not None:
        row.withholding = body.withholding
    if body.active is not None:
        row.active = body.active
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "cdt_exists")
    return _out(_get(db, cdt_id))


@router.delete("/{cdt_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(cdt_id: int, db: Session = Depends(get_db)) -> None:
    row = db.get(Cdt, cdt_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "cdt_not_found")
    db.delete(row)
    db.commit()
