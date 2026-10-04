from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

MISSING = 99999


def _boom() -> None:
    raise IntegrityError("DELETE", {}, Exception("fk"))


def _institution(client: TestClient, name: str = "Protección") -> dict:
    response = client.post("/reserves/institutions", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _account(client: TestClient, institution_id: int, **extra: object) -> dict:
    body = {
        "name": "Ceiba",
        "institution_id": institution_id,
        "purpose": "official_pension",
        "currency": "COP",
    }
    body.update(extra)
    response = client.post("/reserves/accounts", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def test_catalog_404_and_409(client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    assert client.get(f"/reserves/institutions/{MISSING}").status_code == 404
    assert client.put(f"/reserves/institutions/{MISSING}", json={"name": "Nadie"}).status_code == 404
    assert client.delete(f"/reserves/institutions/{MISSING}").status_code == 404
    assert client.get(f"/reserves/accounts/{MISSING}").status_code == 404
    assert client.put(f"/reserves/accounts/{MISSING}", json={"name": "Nadie"}).status_code == 404
    assert client.delete(f"/reserves/accounts/{MISSING}").status_code == 404
    assert client.post("/reserves/accounts", json={"name": "Suelta", "institution_id": MISSING, "purpose": "severance"}).status_code == 404

    first = _institution(client)
    assert client.get(f"/reserves/institutions/{first['id']}").json()["name"] == "Protección"
    duplicate = client.post("/reserves/institutions", json={"name": "Protección"})
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "institution_exists"
    second = _institution(client, "Skandia")
    collision = client.put(f"/reserves/institutions/{second['id']}", json={"name": "Protección"})
    assert collision.status_code == 409
    assert collision.json()["detail"] == "institution_exists"
    renamed = client.put(f"/reserves/institutions/{second['id']}", json={"name": " Skandia Pensiones "})
    assert renamed.json()["name"] == "Skandia Pensiones"

    assert any(row["name"] == "Protección" for row in client.get("/reserves/institutions").json())
    pension = _account(client, first["id"])
    assert client.get(f"/reserves/accounts/{pension['id']}").json()["name"] == "Ceiba"
    assert pension["liquid"] is False
    assert pension["institution_name"] == "Protección"
    emergency = _account(
        client,
        first["id"],
        name="Apnea",
        purpose="emergency",
    )
    assert emergency["liquid"] is True
    forced = _account(
        client,
        first["id"],
        name="Caja",
        purpose="emergency",
        liquid=False,
    )
    assert forced["liquid"] is False
    again = client.post(
        "/reserves/accounts",
        json={"name": "Ceiba", "institution_id": first["id"], "purpose": "official_pension"},
    )
    assert again.status_code == 409
    assert again.json()["detail"] == "reserve_account_exists"
    missing_home = client.put(f"/reserves/accounts/{pension['id']}", json={"institution_id": MISSING})
    assert missing_home.status_code == 404

    moved = client.put(
        f"/reserves/accounts/{pension['id']}",
        json={"name": "Plan Ceiba", "institution_id": second["id"], "currency": "COP", "purpose": "voluntary_pension"},
    )
    assert moved.status_code == 200
    assert moved.json()["name"] == "Plan Ceiba"
    assert moved.json()["institution_id"] == second["id"]
    assert moved.json()["purpose"] == "voluntary_pension"
    assert moved.json()["liquid"] is False

    same_currency = client.put(f"/reserves/accounts/{emergency['id']}", json={"currency": "COP", "active": False})
    assert same_currency.status_code == 200
    assert same_currency.json()["active"] is False

    client.put(
        "/reserves/balances",
        json={"account_id": pension["id"], "year": 2024, "month": 6, "balance": "10"},
    )
    blocked_currency = client.put(f"/reserves/accounts/{pension['id']}", json={"currency": "USD"})
    assert blocked_currency.status_code == 400
    assert blocked_currency.json()["detail"] == "cannot_change_reserve_currency"
    open_currency = client.put(f"/reserves/accounts/{forced['id']}", json={"currency": "USD", "liquid": True})
    assert open_currency.status_code == 200
    assert open_currency.json()["currency"] == "USD"
    assert open_currency.json()["liquid"] is True

    name_clash = client.put(f"/reserves/accounts/{forced['id']}", json={"name": "Plan Ceiba"})
    assert name_clash.status_code == 409
    assert name_clash.json()["detail"] == "reserve_account_exists"

    held_account = client.delete(f"/reserves/accounts/{pension['id']}")
    assert held_account.status_code == 409
    assert held_account.json()["detail"] == "cannot_delete_reserve_account"
    held_institution = client.delete(f"/reserves/institutions/{first['id']}")
    assert held_institution.status_code == 409
    assert held_institution.json()["detail"] == "cannot_delete_institution"

    gone = _account(client, second["id"], name="Borrar", purpose="severance")
    assert client.delete(f"/reserves/accounts/{gone['id']}").status_code == 204
    temporary = _institution(client, "Temporal")
    assert client.delete(f"/reserves/institutions/{temporary['id']}").status_code == 204

    loose = _account(client, second["id"], name="Sin saldo", purpose="severance")
    empty_home = _institution(client, "Vacia")
    monkeypatch.setattr(db, "commit", _boom)
    blocked = client.delete(f"/reserves/accounts/{loose['id']}")
    assert blocked.status_code == 409
    assert blocked.json()["detail"] == "cannot_delete_reserve_account"
    blocked = client.delete(f"/reserves/institutions/{empty_home['id']}")
    assert blocked.status_code == 409
    assert blocked.json()["detail"] == "cannot_delete_institution"


def test_two_years_keep_the_older_row_and_value_the_newer(client: TestClient) -> None:
    home = _institution(client)
    pension = _account(client, home["id"])
    dormant = _account(client, home["id"], name="Yuxi", purpose="official_pension")
    client.put(f"/reserves/accounts/{dormant['id']}", json={"active": False})
    untouched = _account(client, home["id"], name="Cesantías", purpose="severance")

    first = client.put(
        "/reserves/balances",
        json={"account_id": pension["id"], "year": 2024, "month": 6, "balance": "100"},
    )
    assert first.status_code == 200
    client.put(
        "/reserves/balances",
        json={"account_id": pension["id"], "year": 2025, "month": 1, "balance": "200"},
    )
    second = client.put(
        "/reserves/balances",
        json={"account_id": pension["id"], "year": 2025, "month": 3, "balance": "250"},
    )
    assert second.status_code == 200
    updated = client.put(
        "/reserves/balances",
        json={"account_id": pension["id"], "year": 2025, "month": 3, "balance": "260"},
    )
    assert updated.json()["balance"] == "260"
    assert updated.json()["month"] == 3
    assert client.put(
        "/reserves/balances",
        json={"account_id": MISSING, "year": 2024, "month": 1, "balance": "1"},
    ).status_code == 404

    older = client.get("/reserves/balances", params={"year": 2024}).json()
    assert len(older) == 1
    assert older[0]["balance"] == "100"
    assert older[0]["month"] == 6
    same_year = client.get("/reserves/balances", params={"year": 2025}).json()
    assert {row["month"] for row in same_year} == {1, 3}
    assert older[0]["account_name"] == "Ceiba"
    assert client.get("/reserves/balances", params={"year": 2023}).json() == []
    listed = client.get("/reserves/accounts").json()
    assert {row["name"] for row in listed} == {"Ceiba", "Yuxi", "Cesantías"}

    wealth = client.get("/wealth").json()
    by_name = {row["instrument_name"]: row for row in wealth["reserves"]["positions"]}
    assert "Yuxi" not in by_name
    assert by_name["Ceiba"]["value"] == "260"
    assert by_name["Ceiba"]["price_year"] == 2025
    assert by_name["Ceiba"]["price_month"] == 3
    assert by_name["Ceiba"]["purpose"] == "official_pension"
    assert by_name["Ceiba"]["liquid"] is False
    assert by_name["Cesantías"]["value"] is None
    assert by_name["Cesantías"]["missing_price"] is True
    assert by_name["Cesantías"]["price_month"] is None
    assert Decimal(wealth["reserves"]["total"]) == Decimal("260")
    assert Decimal(wealth["total"]) == Decimal("260")


def test_wealth_total_is_null_when_a_reserve_uses_another_currency(client: TestClient) -> None:
    eco = {row["name"]: row["id"] for row in client.get("/instruments").json()}["Ecopetrol"]
    dcor = {row["name"]: row["id"] for row in client.get("/brokers").json()}["D Corredores"]
    client.post(
        "/trades",
        json={"instrument_id": eco, "broker_id": dcor, "type": "buy", "year": 2007, "quantity": 10},
    )
    client.put("/prices", json={"instrument_id": eco, "year": 2026, "month": 9, "price": 100})
    home = _institution(client)
    dollar = _account(client, home["id"], name="Fondo USD", purpose="voluntary_pension", currency="USD")
    saved = client.put(
        "/reserves/balances",
        json={"account_id": dollar["id"], "year": 2025, "month": 9, "balance": "40"},
    )
    assert saved.json()["currency"] == "USD"
    wealth = client.get("/wealth").json()
    assert wealth["reserves"]["total"] == "40"
    assert wealth["total"] is None
