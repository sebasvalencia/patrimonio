from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.assets.routers import router as assets_router
from app.cdts.routers import router as cdts_router
from app.funds.routers import router as funds_router
from app.reserves.routers import router as reserves_router
from app.routers import brokers, fx, instruments, prices, summary, targets, trades, wealth

app = FastAPI(title="Stocks", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(brokers.router)
app.include_router(instruments.router)
app.include_router(trades.router)
app.include_router(prices.router)
app.include_router(targets.router)
app.include_router(summary.router)
app.include_router(fx.router)
app.include_router(funds_router)
app.include_router(reserves_router)
app.include_router(cdts_router)
app.include_router(assets_router)
app.include_router(wealth.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
