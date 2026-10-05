from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.cdts.models import Cdt
from app.cdts.services import value as cdt_value
from app.schemas import CdtPositionOut, CdtSummaryOut
from app.services.valuation import assign_native_total


def build_cdt_summary(db: Session) -> CdtSummaryOut:
    rows = db.scalars(select(Cdt).options(joinedload(Cdt.bank)).order_by(Cdt.name)).unique().all()
    today = cdt_value.clock()
    positions: list[CdtPositionOut] = []
    for row in rows:
        if not row.active:
            continue
        quoted = cdt_value.quote(row.principal, row.annual_rate, row.opened_on, row.matures_on, today)
        positions.append(
            CdtPositionOut(
                instrument_id=row.id,
                instrument_name=row.name,
                broker_id=row.bank_id,
                broker_name=row.bank.name,
                balance=row.principal,
                last_price=None,
                price_year=quoted.price_year,
                price_month=quoted.price_month,
                value=quoted.value,
                weight_pct=None,
                missing_price=quoted.value is None,
                instrument_currency=row.currency,
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
                status=quoted.status,
                liquid=quoted.liquid,
            )
        )
    total = assign_native_total(positions)
    return CdtSummaryOut(total=total, positions=positions)
