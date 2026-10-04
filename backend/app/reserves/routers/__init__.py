from fastapi import APIRouter

from app.reserves.routers import accounts, balances, institutions

router = APIRouter(prefix="/reserves")
router.include_router(institutions.router)
router.include_router(accounts.router)
router.include_router(balances.router)
