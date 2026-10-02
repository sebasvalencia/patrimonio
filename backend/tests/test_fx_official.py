from datetime import date
from decimal import Decimal

from fastapi.testclient import TestClient

from app.services.trm_source import TrmSourceError, rate_on


def _window(start: str, end: str, valor: str) -> dict:
    return {
        "valor": valor,
        "unidad": "COP",
        "vigenciadesde": f"{start}T00:00:00.000",
        "vigenciahasta": f"{end}T00:00:00.000",
    }


def test_rate_on_uses_window_that_covers_the_first_from_the_previous_friday() -> None:
    records = [
        _window("2025-12-31", "2026-01-02", "4000.25"),
        _window("2026-01-03", "2026-01-05", "9999"),
    ]
    assert rate_on(records, date(2026, 1, 1)) == Decimal("4000.25")


def test_official_import_saves_first_of_month_and_skips_a_gap(client: TestClient, monkeypatch) -> None:
    records = [
        _window("2025-12-31", "2026-01-02", "4000.25"),
        _window("2026-02-01", "2026-02-01", "4100"),
        _window("2026-04-01", "2026-04-01", "4300"),
    ]
    monkeypatch.setattr("app.routers.fx.fetch_series", lambda year: records)
    monkeypatch.setattr("app.routers.fx.today", lambda: date(2026, 3, 15))

    response = client.post("/fx-rates/official", params={"year": 2026})
    assert response.status_code == 200
    by_month = {row["month"]: Decimal(str(row["cop_per_usd"])) for row in response.json()}
    assert by_month[1] == Decimal("4000.25")
    assert by_month[2] == Decimal("4100")
    assert 3 not in by_month
    assert 4 not in by_month


def test_official_import_keeps_a_rate_already_saved(client: TestClient, monkeypatch) -> None:
    saved = client.put("/fx-rates", json={"year": 2026, "month": 2, "cop_per_usd": "1111"})
    assert saved.status_code == 200
    records = [_window("2026-02-01", "2026-02-02", "2222")]
    monkeypatch.setattr("app.routers.fx.fetch_series", lambda year: records)
    monkeypatch.setattr("app.routers.fx.today", lambda: date(2026, 2, 10))

    response = client.post("/fx-rates/official", params={"year": 2026})
    assert response.status_code == 200
    february = next(row for row in response.json() if row["month"] == 2)
    assert Decimal(str(february["cop_per_usd"])) == Decimal("1111")


def test_official_import_writes_nothing_when_the_source_fails(client: TestClient, monkeypatch) -> None:
    def _boom(year: int) -> list[dict]:
        raise TrmSourceError("fx_source_unavailable")

    monkeypatch.setattr("app.routers.fx.fetch_series", _boom)
    response = client.post("/fx-rates/official", params={"year": 2026})
    assert response.status_code == 502
    assert response.json()["detail"] == "fx_source_unavailable"
    assert client.get("/fx-rates", params={"year": 2026}).json() == []
