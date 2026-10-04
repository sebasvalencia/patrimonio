from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.funds.routers.summary import build_fund_summary
from app.reserves.routers.summary import build_reserve_summary
from app.routers.summary import build_equity_summary
from app.schemas import WealthOut
from app.services.valuation import combine_native_totals

router = APIRouter(tags=["wealth"])


@router.get("/wealth", response_model=WealthOut)
def wealth(db: Session = Depends(get_db)) -> WealthOut:
    equities = build_equity_summary(db)
    funds = build_fund_summary(db)
    reserves = build_reserve_summary(db)
    return WealthOut(
        equities=equities,
        funds=funds,
        reserves=reserves,
        total=combine_native_totals(equities, funds, reserves),
    )
