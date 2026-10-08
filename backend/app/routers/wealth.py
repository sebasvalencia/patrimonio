from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.assets.routers.summary import build_asset_summary
from app.cdts.routers.summary import build_cdt_summary
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
    cdts = build_cdt_summary(db)
    assets = build_asset_summary(db)
    return WealthOut(
        equities=equities,
        funds=funds,
        reserves=reserves,
        cdts=cdts,
        assets=assets,
        total=combine_native_totals(equities, funds, reserves, cdts, assets),
    )
