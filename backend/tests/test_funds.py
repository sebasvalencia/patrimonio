from decimal import Decimal

from fastapi.testclient import TestClient


def _catalog(client: TestClient) -> tuple[int, int]:
    fid = client.post("/funds/fiduciaries", json={"name": "Fiduciaria Demo"}).json()
    fund = client.post(
        "/funds/funds",
        json={"name": "FIC Liquidez", "active": True, "currency": "COP"},
    ).json()
    return fund["id"], fid["id"]


def test_funds_catalog_starts_empty(client: TestClient) -> None:
    assert client.get("/funds/funds").json() == []
    assert client.get("/funds/fiduciaries").json() == []


def test_partial_full_and_excess_redeem(client: TestClient) -> None:
    fund_id, fid_id = _catalog(client)
    r = client.post(
        "/funds/trades",
        json={
            "fund_id": fund_id,
            "fiduciary_id": fid_id,
            "type": "subscribe",
            "year": 2024,
            "quantity": 1500,
        },
    )
    assert r.status_code == 201
    r = client.post(
        "/funds/trades",
        json={
            "fund_id": fund_id,
            "fiduciary_id": fid_id,
            "type": "redeem",
            "year": 2025,
            "month": 3,
            "quantity": 500,
        },
    )
    assert r.status_code == 201
    res = client.get("/funds/summary").json()
    assert Decimal(str(res["positions"][0]["balance"])) == Decimal("1000")

    r = client.post(
        "/funds/trades",
        json={
            "fund_id": fund_id,
            "fiduciary_id": fid_id,
            "type": "redeem",
            "year": 2025,
            "quantity": 1000,
        },
    )
    assert r.status_code == 201
    res = client.get("/funds/summary").json()
    assert Decimal(str(res["positions"][0]["balance"])) == Decimal("0")

    r = client.post(
        "/funds/trades",
        json={
            "fund_id": fund_id,
            "fiduciary_id": fid_id,
            "type": "redeem",
            "year": 2025,
            "quantity": 1,
        },
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "redeem_exceeds_balance"


def test_inactivate_fund_only_when_balance_zero(client: TestClient) -> None:
    fund_id, fid_id = _catalog(client)
    client.post(
        "/funds/trades",
        json={
            "fund_id": fund_id,
            "fiduciary_id": fid_id,
            "type": "subscribe",
            "year": 2024,
            "quantity": 100,
        },
    )
    r = client.put(f"/funds/funds/{fund_id}", json={"active": False})
    assert r.status_code == 400
    assert r.json()["detail"] == "cannot_inactivate_fund"
    client.post(
        "/funds/trades",
        json={
            "fund_id": fund_id,
            "fiduciary_id": fid_id,
            "type": "redeem",
            "year": 2025,
            "quantity": 100,
        },
    )
    r = client.put(f"/funds/funds/{fund_id}", json={"active": False})
    assert r.status_code == 200
    assert r.json()["active"] is False
    r = client.post(
        "/funds/trades",
        json={
            "fund_id": fund_id,
            "fiduciary_id": fid_id,
            "type": "subscribe",
            "year": 2026,
            "quantity": 10,
        },
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "cannot_subscribe_inactive"


def test_fund_commission_and_trade_price_do_not_change_total(client: TestClient) -> None:
    fund_id, fid_id = _catalog(client)
    r = client.post(
        "/funds/trades",
        json={
            "fund_id": fund_id,
            "fiduciary_id": fid_id,
            "type": "subscribe",
            "year": 2024,
            "quantity": 10,
            "commission": 12500,
            "price": 2480,
        },
    )
    assert r.status_code == 201
    assert Decimal(str(r.json()["commission"])) == Decimal("12500")
    assert Decimal(str(r.json()["price"])) == Decimal("2480")
    assert client.get("/funds/unit-values").json() == []
    r = client.put(
        "/funds/unit-values",
        json={"fund_id": fund_id, "year": 2026, "month": 9, "value": 100},
    )
    assert r.status_code == 200
    res = client.get("/funds/summary").json()
    assert Decimal(str(res["total"])) == Decimal("1000")


def test_fund_trade_does_not_write_equity_prices(client: TestClient) -> None:
    fund_id, fid_id = _catalog(client)
    client.post(
        "/funds/trades",
        json={
            "fund_id": fund_id,
            "fiduciary_id": fid_id,
            "type": "subscribe",
            "year": 2026,
            "month": 9,
            "quantity": 10,
            "price": 1500,
        },
    )
    client.put(
        "/funds/unit-values",
        json={"fund_id": fund_id, "year": 2026, "month": 9, "value": 1500},
    )
    assert client.get("/prices", params={"year": 2026}).json() == []
    eco = {r["name"]: r["id"] for r in client.get("/instruments").json()}["Ecopetrol"]
    assert client.get("/prices", params={"year": 2026, "instrument_id": eco}).json() == []


def test_delete_fund_with_data_conflicts(client: TestClient) -> None:
    fund_id, fid_id = _catalog(client)
    client.post(
        "/funds/trades",
        json={
            "fund_id": fund_id,
            "fiduciary_id": fid_id,
            "type": "subscribe",
            "year": 2024,
            "quantity": 10,
        },
    )
    r = client.delete(f"/funds/funds/{fund_id}")
    assert r.status_code == 409
    assert r.json()["detail"] == "cannot_delete_fund"
    r = client.delete(f"/funds/fiduciaries/{fid_id}")
    assert r.status_code == 409
    assert r.json()["detail"] == "cannot_delete_fiduciary"


def test_wealth_is_equities_plus_funds(client: TestClient) -> None:
    eco = {r["name"]: r["id"] for r in client.get("/instruments").json()}["Ecopetrol"]
    dcor = {r["name"]: r["id"] for r in client.get("/brokers").json()}["D Corredores"]
    client.post(
        "/trades",
        json={
            "instrument_id": eco,
            "broker_id": dcor,
            "type": "buy",
            "year": 2007,
            "quantity": 10,
        },
    )
    client.put("/prices", json={"instrument_id": eco, "year": 2026, "month": 9, "price": 100})
    equity_total = Decimal(str(client.get("/summary").json()["total"]))
    assert equity_total == Decimal("1000")

    fund_id, fid_id = _catalog(client)
    client.post(
        "/funds/trades",
        json={
            "fund_id": fund_id,
            "fiduciary_id": fid_id,
            "type": "subscribe",
            "year": 2024,
            "quantity": 5,
        },
    )
    client.put("/funds/unit-values", json={"fund_id": fund_id, "year": 2026, "month": 9, "value": 200})
    after_equity = Decimal(str(client.get("/summary").json()["total"]))
    assert after_equity == equity_total

    wealth = client.get("/wealth").json()
    assert Decimal(str(wealth["equities"]["total"])) == Decimal("1000")
    assert Decimal(str(wealth["funds"]["total"])) == Decimal("1000")
    assert Decimal(str(wealth["total"])) == Decimal("2000")
    assert wealth["funds"]["positions"][0]["instrument_name"] == "FIC Liquidez"


def test_fund_pending_only_active_without_value(client: TestClient) -> None:
    fund_id, _ = _catalog(client)
    other = client.post("/funds/funds", json={"name": "FIC Renta", "active": True, "currency": "COP"}).json()
    body = client.get("/funds/unit-values/pending", params={"year": 2026, "month": 9}).json()
    assert body["total_active"] == 2
    assert body["pending"] == 2
    client.put("/funds/unit-values", json={"fund_id": fund_id, "year": 2026, "month": 9, "value": 100})
    client.put(f"/funds/funds/{other['id']}", json={"active": False})
    body = client.get("/funds/unit-values/pending", params={"year": 2026, "month": 9}).json()
    names = {f["fund_name"] for f in body["missing"]}
    assert "FIC Liquidez" not in names
    assert "FIC Renta" not in names
    assert body["total_active"] == 1
    assert body["pending"] == 0


def test_rename_fiduciary_keeps_id_and_rejects_duplicate(client: TestClient) -> None:
    fund_id, fid_id = _catalog(client)
    other = client.post("/funds/fiduciaries", json={"name": "Otra Fiduciaria"}).json()
    client.post(
        "/funds/trades",
        json={
            "fund_id": fund_id,
            "fiduciary_id": fid_id,
            "type": "subscribe",
            "year": 2024,
            "quantity": 10,
        },
    )
    r = client.put(f"/funds/fiduciaries/{fid_id}", json={"name": "Fiduciaria Sur"})
    assert r.status_code == 200
    assert r.json()["id"] == fid_id
    assert r.json()["name"] == "Fiduciaria Sur"
    pos = next(p for p in client.get("/funds/summary").json()["positions"] if p["broker_id"] == fid_id)
    assert pos["broker_name"] == "Fiduciaria Sur"
    r = client.put(f"/funds/fiduciaries/{fid_id}", json={"name": "Otra Fiduciaria"})
    assert r.status_code == 409
    assert r.json()["detail"] == "fiduciary_exists"
    assert client.get(f"/funds/fiduciaries/{other['id']}").json()["name"] == "Otra Fiduciaria"


def test_fund_target_progress(client: TestClient) -> None:
    fund_id, _ = _catalog(client)
    client.put("/funds/targets", json={"fund_id": fund_id, "year": 2026, "month": 9, "price": 3100})
    client.put("/funds/unit-values", json={"fund_id": fund_id, "year": 2026, "month": 9, "value": 2480})
    av = client.get("/funds/target-progress", params={"fund_id": fund_id}).json()
    assert Decimal(str(av["target"])) == Decimal("3100")
    assert Decimal(str(av["last_price"])) == Decimal("2480")
    assert Decimal(str(av["progress_pct"])) == (Decimal("2480") / Decimal("3100")) * Decimal("100")


def test_reducing_subscribe_below_redemptions_is_rejected(client: TestClient) -> None:
    fund_id, fid_id = _catalog(client)
    opened = client.post(
        "/funds/trades",
        json={
            "fund_id": fund_id,
            "fiduciary_id": fid_id,
            "type": "subscribe",
            "year": 2024,
            "quantity": 10,
        },
    )
    assert opened.status_code == 201
    client.post(
        "/funds/trades",
        json={
            "fund_id": fund_id,
            "fiduciary_id": fid_id,
            "type": "redeem",
            "year": 2025,
            "quantity": 6,
        },
    )
    response = client.put(
        f"/funds/trades/{opened.json()['id']}",
        json={
            "fund_id": fund_id,
            "fiduciary_id": fid_id,
            "type": "subscribe",
            "year": 2024,
            "quantity": 3,
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "negative_balance"
    balance = client.get("/funds/summary").json()["positions"][0]["balance"]
    assert Decimal(str(balance)) == Decimal("4")


def test_moving_subscribe_off_a_pair_with_redemptions_is_rejected(client: TestClient) -> None:
    fund_id, fid_id = _catalog(client)
    other = client.post("/funds/fiduciaries", json={"name": "Otra Fiduciaria"}).json()
    opened = client.post(
        "/funds/trades",
        json={
            "fund_id": fund_id,
            "fiduciary_id": fid_id,
            "type": "subscribe",
            "year": 2024,
            "quantity": 10,
        },
    ).json()
    client.post(
        "/funds/trades",
        json={
            "fund_id": fund_id,
            "fiduciary_id": fid_id,
            "type": "redeem",
            "year": 2025,
            "quantity": 4,
        },
    )
    response = client.put(
        f"/funds/trades/{opened['id']}",
        json={
            "fund_id": fund_id,
            "fiduciary_id": other["id"],
            "type": "subscribe",
            "year": 2024,
            "quantity": 10,
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "negative_balance"


def test_wealth_total_is_null_when_modules_use_different_currencies(client: TestClient) -> None:
    eco = {row["name"]: row["id"] for row in client.get("/instruments").json()}["Ecopetrol"]
    dcor = {row["name"]: row["id"] for row in client.get("/brokers").json()}["D Corredores"]
    client.post(
        "/trades",
        json={
            "instrument_id": eco,
            "broker_id": dcor,
            "type": "buy",
            "year": 2007,
            "quantity": 10,
        },
    )
    client.put("/prices", json={"instrument_id": eco, "year": 2026, "month": 9, "price": 100})
    fid = client.post("/funds/fiduciaries", json={"name": "Fiduciaria Demo"}).json()
    fund = client.post(
        "/funds/funds",
        json={"name": "FIC Dolar", "active": True, "currency": "USD"},
    ).json()
    client.post(
        "/funds/trades",
        json={
            "fund_id": fund["id"],
            "fiduciary_id": fid["id"],
            "type": "subscribe",
            "year": 2024,
            "quantity": 5,
        },
    )
    client.put("/funds/unit-values", json={"fund_id": fund["id"], "year": 2026, "month": 9, "value": 100})
    wealth = client.get("/wealth").json()
    assert Decimal(str(wealth["equities"]["total"])) == Decimal("1000")
    assert Decimal(str(wealth["funds"]["total"])) == Decimal("500")
    assert wealth["total"] is None
