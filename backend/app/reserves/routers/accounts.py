from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.reserves.models import Institution, ReserveAccount, ReserveBalance
from app.reserves.schemas import ReserveAccountIn, ReserveAccountOut, ReserveAccountUpdate

router = APIRouter(prefix="/accounts", tags=["reserves"])


def _out(row: ReserveAccount) -> ReserveAccountOut:
    return ReserveAccountOut(
        id=row.id,
        name=row.name,
        institution_id=row.institution_id,
        institution_name=row.institution.name,
        currency=row.currency,
        purpose=row.purpose,
        liquid=row.liquid,
        active=row.active,
    )


def _get(db: Session, account_id: int) -> ReserveAccount:
    row = db.scalar(
        select(ReserveAccount).where(ReserveAccount.id == account_id).options(joinedload(ReserveAccount.institution))
    )
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "reserve_account_not_found")
    return row


@router.get("", response_model=list[ReserveAccountOut])
def list_accounts(db: Session = Depends(get_db)) -> list[ReserveAccountOut]:
    rows = db.scalars(
        select(ReserveAccount).options(joinedload(ReserveAccount.institution)).order_by(ReserveAccount.name)
    ).all()
    return [_out(row) for row in rows]


@router.get("/{account_id}", response_model=ReserveAccountOut)
def get_one(account_id: int, db: Session = Depends(get_db)) -> ReserveAccountOut:
    return _out(_get(db, account_id))


@router.post("", response_model=ReserveAccountOut, status_code=status.HTTP_201_CREATED)
def create(body: ReserveAccountIn, db: Session = Depends(get_db)) -> ReserveAccountOut:
    if db.get(Institution, body.institution_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "institution_not_found")
    liquid = body.purpose == "emergency" if body.liquid is None else body.liquid
    row = ReserveAccount(
        name=body.name.strip(),
        institution_id=body.institution_id,
        currency=body.currency,
        purpose=body.purpose,
        liquid=liquid,
        active=body.active,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "reserve_account_exists")
    db.refresh(row)
    return _out(_get(db, row.id))


@router.put("/{account_id}", response_model=ReserveAccountOut)
def update(account_id: int, body: ReserveAccountUpdate, db: Session = Depends(get_db)) -> ReserveAccountOut:
    row = _get(db, account_id)
    if body.institution_id is not None:
        if db.get(Institution, body.institution_id) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "institution_not_found")
        row.institution_id = body.institution_id
    if body.currency is not None and body.currency != row.currency:
        has_balance = db.scalar(select(ReserveBalance.id).where(ReserveBalance.account_id == account_id).limit(1))
        if has_balance is not None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "cannot_change_reserve_currency")
        row.currency = body.currency
    if body.name is not None:
        row.name = body.name.strip()
    if body.purpose is not None:
        row.purpose = body.purpose
    if body.liquid is not None:
        row.liquid = body.liquid
    if body.active is not None:
        row.active = body.active
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "reserve_account_exists")
    return _out(_get(db, account_id))


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(account_id: int, db: Session = Depends(get_db)) -> None:
    row = db.get(ReserveAccount, account_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "reserve_account_not_found")
    if db.scalar(select(ReserveBalance.id).where(ReserveBalance.account_id == account_id).limit(1)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "cannot_delete_reserve_account")
    db.delete(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "cannot_delete_reserve_account")
