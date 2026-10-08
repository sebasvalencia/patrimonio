from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.assets.models import Asset
from app.schemas import PositionOut, SummaryOut
from app.services.valuation import assign_native_total


def build_asset_summary(db: Session) -> SummaryOut:
    rows = db.scalars(select(Asset).order_by(Asset.name)).all()
    positions: list[PositionOut] = []
    for row in rows:
        if not row.active:
            continue
        positions.append(
            PositionOut(
                instrument_id=row.id,
                instrument_name=row.name,
                broker_id=row.id,
                broker_name="",
                balance=Decimal(row.value),
                last_price=None,
                price_year=row.year,
                price_month=row.month,
                value=Decimal(row.value),
                weight_pct=None,
                missing_price=False,
                instrument_currency=row.currency,
            )
        )
    return SummaryOut(total=assign_native_total(positions), positions=positions)
