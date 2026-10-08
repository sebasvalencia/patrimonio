from fastapi import APIRouter

from app.assets.routers import assets

router = APIRouter()
router.include_router(assets.router)
