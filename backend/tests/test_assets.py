from decimal import Decimal

from fastapi.testclient import TestClient

MISSING = 99999


def _asset(client: TestClient, **extra: object) -> dict:
    body = {
        "name": "Apto",
        "currency": "COP",
        "value": "1000",
        "year": 2026,
        "month": 9,
    }
    body.update(extra)
    response = client.post("/assets", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def test_seed_does_not_invent_goods(client: TestClient) -> None:
    assert client.get("/assets").json() == []
    wealth = client.get("/wealth").json()
    assert wealth["assets"]["positions"] == []
    assert wealth["assets"]["total"] == "0"


def test_create_strips_the_name_and_replaces_the_value(client: TestClient) -> None:
    created = _asset(client, name="  Apto  ")
    assert created["name"] == "Apto"
    assert created["currency"] == "COP"
    assert created["value"] == "1000"
    assert created["year"] == 2026
    assert created["month"] == 9
    assert created["active"] is True

    replaced = client.put(
        f"/assets/{created['id']}",
        json={"value": "2500", "year": 2025, "month": 3, "currency": "USD", "name": " Apartamento "},
    )
    assert replaced.status_code == 200
    body = replaced.json()
    assert body["name"] == "Apartamento"
    assert body["value"] == "2500"
    assert body["year"] == 2025
    assert body["month"] == 3
    assert body["currency"] == "USD"

    paused = client.put(f"/assets/{created['id']}", json={"active": False})
    assert paused.json()["active"] is False
    assert paused.json()["value"] == "2500"


def test_duplicate_name_and_missing_good(client: TestClient) -> None:
    first = _asset(client)
    clash = client.post("/assets", json={"name": "Apto", "value": "2", "year": 2026, "month": 1})
    assert clash.status_code == 409
    assert clash.json()["detail"] == "asset_exists"

    other = _asset(client, name="Carro", value="800")
    rename = client.put(f"/assets/{other['id']}", json={"name": "Apto"})
    assert rename.status_code == 409
    assert rename.json()["detail"] == "asset_exists"

    assert client.put(f"/assets/{MISSING}", json={"value": "1"}).status_code == 404
    assert client.delete(f"/assets/{MISSING}").status_code == 404
    assert client.delete(f"/assets/{first['id']}").status_code == 204
    names = {row["name"] for row in client.get("/assets").json()}
    assert names == {"Carro"}


def test_inactive_good_leaves_the_total_and_reserves_are_not_retyped(client: TestClient) -> None:
    home = client.post("/reserves/institutions", json={"name": "Protección"}).json()
    apnea = client.post(
        "/reserves/accounts",
        json={"name": "Apnea", "institution_id": home["id"], "purpose": "emergency", "currency": "COP"},
    ).json()
    cesantias = client.post(
        "/reserves/accounts",
        json={"name": "Cesantías", "institution_id": home["id"], "purpose": "severance", "currency": "COP"},
    ).json()
    client.put("/reserves/balances", json={"account_id": apnea["id"], "year": 2026, "month": 6, "balance": "400"})
    client.put(
        "/reserves/balances",
        json={"account_id": cesantias["id"], "year": 2026, "month": 6, "balance": "250"},
    )

    kept = _asset(client, name="Apto", value="1000")
    parked = _asset(client, name="Carro", value="300")
    client.put(f"/assets/{parked['id']}", json={"active": False})

    wealth = client.get("/wealth").json()
    goods = {row["instrument_name"]: row for row in wealth["assets"]["positions"]}
    assert set(goods) == {"Apto"}
    assert goods["Apto"]["value"] == "1000"
    assert goods["Apto"]["price_year"] == 2026
    assert goods["Apto"]["price_month"] == 9
    assert goods["Apto"]["instrument_currency"] == "COP"
    assert Decimal(wealth["assets"]["total"]) == Decimal("1000")

    reserves = {row["instrument_name"]: row for row in wealth["reserves"]["positions"]}
    assert reserves["Apnea"]["value"] == "400"
    assert reserves["Cesantías"]["value"] == "250"
    assert Decimal(wealth["total"]) == Decimal("1650")
    assert kept["id"] == goods["Apto"]["instrument_id"]


def test_wealth_total_is_null_when_goods_use_two_currencies(client: TestClient) -> None:
    _asset(client, name="Apto", currency="COP", value="1000")
    _asset(client, name="Carro", currency="USD", value="10")
    wealth = client.get("/wealth").json()
    assert wealth["assets"]["total"] is None
    assert wealth["total"] is None
    weights = {row["instrument_name"]: row["weight_pct"] for row in wealth["assets"]["positions"]}
    assert weights == {"Apto": None, "Carro": None}
