from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.assets.models import Asset
from app.assets.schemas import AssetIn, AssetOut, AssetUpdate
from app.database import get_db

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("", response_model=list[AssetOut])
def list_assets(db: Session = Depends(get_db)) -> list[Asset]:
    return list(db.scalars(select(Asset).order_by(Asset.name)).all())


@router.post("", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
def create(body: AssetIn, db: Session = Depends(get_db)) -> Asset:
    row = Asset(
        name=body.name.strip(),
        currency=body.currency,
        value=body.value,
        year=body.year,
        month=body.month,
        active=body.active,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "asset_exists")
    db.refresh(row)
    return row


@router.put("/{asset_id}", response_model=AssetOut)
def update(asset_id: int, body: AssetUpdate, db: Session = Depends(get_db)) -> Asset:
    row = db.get(Asset, asset_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "asset_not_found")
    if body.name is not None:
        row.name = body.name.strip()
    if body.currency is not None:
        row.currency = body.currency
    if body.value is not None:
        row.value = body.value
    if body.year is not None:
        row.year = body.year
    if body.month is not None:
        row.month = body.month
    if body.active is not None:
        row.active = body.active
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "asset_exists")
    db.refresh(row)
    return row


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(asset_id: int, db: Session = Depends(get_db)) -> None:
    row = db.get(Asset, asset_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "asset_not_found")
    db.delete(row)
    db.commit()
