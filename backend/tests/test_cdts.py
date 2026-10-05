from datetime import date
from decimal import ROUND_HALF_UP, Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.cdts.services.value import quote

MISSING = 99999


def _boom() -> None:
    raise IntegrityError("DELETE", {}, Exception("fk"))


def _freeze(monkeypatch: pytest.MonkeyPatch, day: date) -> None:
    monkeypatch.setattr("app.cdts.services.value.clock", lambda: day)


def _bank(client: TestClient, name: str = "Bancolombia") -> dict:
    response = client.post("/cdts/banks", json={"name": name})
    assert response.status_code == 201, response.text
    return response.json()


def _cdt(client: TestClient, bank_id: int, **extra: object) -> dict:
    body = {
        "name": "Plazo",
        "bank_id": bank_id,
        "currency": "COP",
        "principal": "1000",
        "annual_rate": "10",
        "opened_on": "2025-01-01",
        "matures_on": "2026-01-01",
    }
    body.update(extra)
    response = client.post("/cdts", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def _position(client: TestClient, name: str) -> dict:
    wealth = client.get("/wealth").json()
    return {row["instrument_name"]: row for row in wealth["cdts"]["positions"]}[name]


def test_quote_uses_effective_rate_and_stops_at_maturity() -> None:
    opened = date(2025, 1, 1)
    matures = date(2026, 1, 1)
    before = quote(Decimal("1000"), Decimal("10"), opened, matures, date(2024, 12, 31))
    assert before.value is None
    assert before.status == "upcoming"
    assert before.liquid is False
    assert before.price_year is None

    opening = quote(Decimal("1000"), Decimal("10"), opened, matures, opened)
    assert opening.value == Decimal("1000.00")
    assert opening.status == "accruing"
    assert opening.liquid is False
    assert (opening.price_year, opening.price_month) == (2025, 1)

    full = quote(Decimal("1000"), Decimal("10"), opened, matures, matures)
    assert full.value == Decimal("1100.00")
    assert full.status == "matured"
    assert full.liquid is True

    later = quote(Decimal("1000"), Decimal("10"), opened, matures, date(2026, 6, 15))
    assert later.value == Decimal("1100.00")
    assert (later.price_year, later.price_month) == (2026, 1)

    mid = date(2025, 4, 11)
    days = Decimal((mid - opened).days)
    expected = (Decimal("1000") * (Decimal("1.1") ** (days / Decimal(365)))).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    assert quote(Decimal("1000"), Decimal("10"), opened, matures, mid).value == expected
    assert quote(Decimal("1000"), Decimal("10"), opened, matures, mid).status == "accruing"


def test_catalog_404_and_409(client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    assert client.get("/cdts/banks").json() == []
    assert client.get("/cdts").json() == []
    assert client.put(f"/cdts/banks/{MISSING}", json={"name": "Nadie"}).status_code == 404
    assert client.delete(f"/cdts/banks/{MISSING}").status_code == 404
    assert client.put(f"/cdts/{MISSING}", json={"name": "Nadie"}).status_code == 404
    assert client.delete(f"/cdts/{MISSING}").status_code == 404
    assert client.post(
        "/cdts",
        json={
            "name": "Suelto",
            "bank_id": MISSING,
            "principal": "1",
            "annual_rate": "1",
            "opened_on": "2025-01-01",
            "matures_on": "2025-02-01",
        },
    ).status_code == 404

    first = _bank(client, " Banco ")
    assert first["name"] == "Banco"
    assert client.post("/cdts/banks", json={"name": "Banco"}).status_code == 409
    second = _bank(client, "Davivienda")
    assert client.put(f"/cdts/banks/{second['id']}", json={"name": "Banco"}).status_code == 409
    renamed = client.put(f"/cdts/banks/{second['id']}", json={"name": " Davivienda "})
    assert renamed.json()["name"] == "Davivienda"
    assert {row["name"] for row in client.get("/cdts/banks").json()} == {"Banco", "Davivienda"}

    same_day = client.post(
        "/cdts",
        json={
            "name": "Corto",
            "bank_id": first["id"],
            "principal": "10",
            "annual_rate": "1",
            "opened_on": "2025-01-01",
            "matures_on": "2025-01-01",
        },
    )
    assert same_day.status_code == 400
    assert same_day.json()["detail"] == "maturity_before_opening"

    plazo = _cdt(client, first["id"], name="  Plazo  ")
    assert plazo["name"] == "Plazo"
    assert plazo["bank_name"] == "Banco"
    assert plazo["term_days"] == 365
    assert plazo["yield_payment"] == "at_maturity"
    assert plazo["payment_frequency"] == "single"
    assert plazo["capitalize"] is False
    assert plazo["gross_yield"] == "0"
    assert plazo["net_yield"] == "0"
    assert plazo["withholding"] == "0"
    again = client.post(
        "/cdts",
        json={
            "name": "Plazo",
            "bank_id": first["id"],
            "principal": "10",
            "annual_rate": "1",
            "opened_on": "2025-01-01",
            "matures_on": "2025-06-01",
        },
    )
    assert again.status_code == 409
    assert again.json()["detail"] == "cdt_exists"

    early = client.put(f"/cdts/{plazo['id']}", json={"matures_on": "2024-01-01"})
    assert early.status_code == 400
    late = client.put(f"/cdts/{plazo['id']}", json={"opened_on": "2027-01-01"})
    assert late.status_code == 400
    assert client.get("/cdts").json()[0]["matures_on"] == "2026-01-01"

    missing_bank = client.put(f"/cdts/{plazo['id']}", json={"bank_id": MISSING})
    assert missing_bank.status_code == 404
    untouched = client.put(f"/cdts/{plazo['id']}", json={})
    assert untouched.status_code == 200
    assert untouched.json()["name"] == "Plazo"

    moved = client.put(
        f"/cdts/{plazo['id']}",
        json={
            "name": "Plazo largo",
            "bank_id": second["id"],
            "currency": "USD",
            "principal": "2500",
            "annual_rate": "8.5",
            "opened_on": "2025-02-01",
            "matures_on": "2026-02-01",
            "term_days": 180,
            "yield_payment": "in_advance",
            "payment_frequency": "monthly",
            "capitalize": True,
            "gross_yield": "186405",
            "net_yield": "178949",
            "withholding": "7456",
            "active": False,
        },
    )
    assert moved.status_code == 200
    body = moved.json()
    assert body["name"] == "Plazo largo"
    assert body["bank_id"] == second["id"]
    assert body["currency"] == "USD"
    assert body["principal"] == "2500"
    assert body["annual_rate"] == "8.5"
    assert body["term_days"] == 180
    assert body["yield_payment"] == "in_advance"
    assert body["payment_frequency"] == "monthly"
    assert body["capitalize"] is True
    assert body["gross_yield"] == "186405"
    assert body["net_yield"] == "178949"
    assert body["withholding"] == "7456"
    assert body["active"] is False

    other = _cdt(client, first["id"], name="Otro", term_days=180)
    assert other["term_days"] == 180
    clash = client.put(f"/cdts/{other['id']}", json={"name": "Plazo largo"})
    assert clash.status_code == 409

    held = client.delete(f"/cdts/banks/{first['id']}")
    assert held.status_code == 409
    assert held.json()["detail"] == "cannot_delete_bank"
    assert client.delete(f"/cdts/{other['id']}").status_code == 204
    empty = _bank(client, "Temporal")
    assert client.delete(f"/cdts/banks/{empty['id']}").status_code == 204

    spare = _bank(client, "Vacio")
    monkeypatch.setattr(db, "commit", _boom)
    blocked = client.delete(f"/cdts/banks/{spare['id']}")
    assert blocked.status_code == 409
    assert blocked.json()["detail"] == "cannot_delete_bank"


def test_value_is_principal_plus_accrued_interest(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    home = _bank(client)
    _cdt(client, home["id"])
    _cdt(
        client,
        home["id"],
        name="Futuro",
        principal="200",
        annual_rate="5",
        opened_on="2026-08-01",
        matures_on="2027-08-01",
    )
    closed = _cdt(
        client,
        home["id"],
        name="Cobrado",
        opened_on="2024-01-01",
        matures_on="2025-01-01",
    )
    client.put(f"/cdts/{closed['id']}", json={"active": False})

    _freeze(monkeypatch, date(2025, 1, 1))
    opening = _position(client, "Plazo")
    assert opening["value"] == "1000"
    assert opening["balance"] == "1000"
    assert opening["status"] == "accruing"
    assert opening["liquid"] is False
    assert opening["price_year"] == 2025
    assert opening["price_month"] == 1
    listed = {row["name"]: row for row in client.get("/cdts").json()}
    assert listed["Plazo"]["value"] == "1000"
    assert listed["Plazo"]["status"] == "accruing"

    _freeze(monkeypatch, date(2026, 1, 1))
    matured = _position(client, "Plazo")
    assert matured["value"] == "1100"
    assert matured["status"] == "matured"
    assert matured["liquid"] is True
    assert matured["price_year"] == 2026
    assert matured["price_month"] == 1
    assert matured["missing_price"] is False

    _freeze(monkeypatch, date(2026, 6, 15))
    later = _position(client, "Plazo")
    assert later["value"] == "1100"
    assert later["price_month"] == 1
    upcoming = _position(client, "Futuro")
    assert upcoming["value"] is None
    assert upcoming["status"] == "upcoming"
    assert upcoming["missing_price"] is True
    assert upcoming["price_month"] is None
    assert upcoming["liquid"] is False
    wealth = client.get("/wealth").json()
    names = {row["instrument_name"] for row in wealth["cdts"]["positions"]}
    assert "Cobrado" not in names
    assert Decimal(wealth["cdts"]["total"]) == Decimal("1100")
    assert Decimal(wealth["total"]) == Decimal("1100")


def test_wealth_total_is_null_when_cdts_use_two_currencies(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _freeze(monkeypatch, date(2026, 1, 1))
    home = _bank(client)
    _cdt(client, home["id"], name="Pesos")
    _cdt(client, home["id"], name="Dolares", currency="USD", principal="40")
    wealth = client.get("/wealth").json()
    assert wealth["cdts"]["total"] is None
    assert wealth["total"] is None
    pesos = _position(client, "Pesos")
    assert pesos["weight_pct"] is None
    assert pesos["value"] == "1100"
