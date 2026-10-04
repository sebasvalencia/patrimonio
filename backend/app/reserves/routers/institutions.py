from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.reserves.models import Institution, ReserveAccount
from app.reserves.schemas import InstitutionIn, InstitutionOut

router = APIRouter(prefix="/institutions", tags=["reserves"])


@router.get("", response_model=list[InstitutionOut])
def list_institutions(db: Session = Depends(get_db)) -> list[Institution]:
    return list(db.scalars(select(Institution).order_by(Institution.name)).all())


@router.get("/{institution_id}", response_model=InstitutionOut)
def get_one(institution_id: int, db: Session = Depends(get_db)) -> Institution:
    row = db.get(Institution, institution_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "institution_not_found")
    return row


@router.post("", response_model=InstitutionOut, status_code=status.HTTP_201_CREATED)
def create(body: InstitutionIn, db: Session = Depends(get_db)) -> Institution:
    row = Institution(name=body.name.strip())
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "institution_exists")
    db.refresh(row)
    return row


@router.put("/{institution_id}", response_model=InstitutionOut)
def update(institution_id: int, body: InstitutionIn, db: Session = Depends(get_db)) -> Institution:
    row = db.get(Institution, institution_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "institution_not_found")
    row.name = body.name.strip()
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "institution_exists")
    db.refresh(row)
    return row


@router.delete("/{institution_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(institution_id: int, db: Session = Depends(get_db)) -> None:
    row = db.get(Institution, institution_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "institution_not_found")
    if db.scalar(select(ReserveAccount.id).where(ReserveAccount.institution_id == institution_id).limit(1)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "cannot_delete_institution")
    db.delete(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "cannot_delete_institution")
