from fastapi import APIRouter

from app.cdts.routers import banks, deposits

router = APIRouter()
router.include_router(banks.router)
router.include_router(deposits.router)
