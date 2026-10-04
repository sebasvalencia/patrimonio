import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("DATABASE_URL", "sqlite://")

from app.database import Base, get_db
from app.main import app
from app.models import Broker, FxRate, Instrument, MonthlyPrice, PriceTarget, Trade  # noqa: F401
from app.funds.models import Fiduciary, Fund, FundTarget, FundTrade, FundUnitValue  # noqa: F401
from app.reserves.models import Institution, ReserveAccount, ReserveBalance  # noqa: F401
from app.seed import seed

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)


@pytest.fixture()
def db() -> Generator[Session, None, None]:
    Base.metadata.create_all(engine)
    session = TestingSession()
    seed(session)
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


@pytest.fixture()
def client(db: Session) -> Generator[TestClient, None, None]:
    def _override() -> Generator[Session, None, None]:
        yield db

    app.dependency_overrides[get_db] = _override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
