from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.cdts.models import Bank, Cdt
from app.cdts.schemas import BankIn, BankOut
from app.database import get_db

router = APIRouter(prefix="/cdts/banks", tags=["cdts"])


@router.get("", response_model=list[BankOut])
def list_banks(db: Session = Depends(get_db)) -> list[Bank]:
    return list(db.scalars(select(Bank).order_by(Bank.name)).all())


@router.post("", response_model=BankOut, status_code=status.HTTP_201_CREATED)
def create(body: BankIn, db: Session = Depends(get_db)) -> Bank:
    row = Bank(name=body.name.strip())
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "bank_exists")
    db.refresh(row)
    return row


@router.put("/{bank_id}", response_model=BankOut)
def update(bank_id: int, body: BankIn, db: Session = Depends(get_db)) -> Bank:
    row = db.get(Bank, bank_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "bank_not_found")
    row.name = body.name.strip()
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "bank_exists")
    db.refresh(row)
    return row


@router.delete("/{bank_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(bank_id: int, db: Session = Depends(get_db)) -> None:
    row = db.get(Bank, bank_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "bank_not_found")
    if db.scalar(select(Cdt.id).where(Cdt.bank_id == bank_id).limit(1)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "cannot_delete_bank")
    db.delete(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "cannot_delete_bank")
