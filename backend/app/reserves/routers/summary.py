from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.reserves.models import ReserveAccount, ReserveBalance
from app.schemas import ReservePositionOut, ReserveSummaryOut
from app.services.valuation import assign_native_total


def build_reserve_summary(db: Session) -> ReserveSummaryOut:
    accounts = db.scalars(
        select(ReserveAccount).options(joinedload(ReserveAccount.institution)).order_by(ReserveAccount.name)
    ).unique().all()
    balances = list(db.scalars(select(ReserveBalance)).all())
    positions: list[ReservePositionOut] = []
    for account in accounts:
        if not account.active:
            continue
        own = [row for row in balances if row.account_id == account.id]
        latest = max(own, key=lambda row: (row.year, row.month)) if own else None
        value = None if latest is None else Decimal(latest.balance)
        positions.append(
            ReservePositionOut(
                instrument_id=account.id,
                instrument_name=account.name,
                broker_id=account.institution_id,
                broker_name=account.institution.name,
                balance=value if value is not None else Decimal(0),
                last_price=None,
                price_year=latest.year if latest else None,
                price_month=latest.month if latest else None,
                value=value,
                weight_pct=None,
                missing_price=latest is None,
                instrument_currency=account.currency,
                purpose=account.purpose,
                liquid=account.liquid,
            )
        )
    total = assign_native_total(positions)
    return ReserveSummaryOut(total=total, positions=positions)
