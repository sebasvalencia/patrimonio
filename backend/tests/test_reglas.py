from decimal import Decimal

from fastapi.testclient import TestClient

from app.services.variation import variation_points


def _ids(client: TestClient) -> tuple[int, int, int]:
    inst = {r["name"]: r["id"] for r in client.get("/instruments").json()}
    corr = {r["name"]: r["id"] for r in client.get("/brokers").json()}
    return inst["Ecopetrol"], corr["D Corredores"], corr["Trii"]


def test_health(client: TestClient) -> None:
    assert client.get("/health").json() == {"status": "ok"}


def test_seed_catalog(client: TestClient) -> None:
    inst = client.get("/instruments").json()
    corr = client.get("/brokers").json()
    assert len(inst) == 11
    assert {c["name"] for c in corr} == {"D Corredores", "Trii"}
    assert {i["currency"] for i in inst} == {"COP"}


def test_partial_full_and_excess_sell(client: TestClient) -> None:
    eco, dcor, _ = _ids(client)
    r = client.post(
        "/trades",
        json={
            "instrument_id": eco,
            "broker_id": dcor,
            "type": "buy",
            "year": 2007,
            "quantity": 1500,
        },
    )
    assert r.status_code == 201
    r = client.post(
        "/trades",
        json={
            "instrument_id": eco,
            "broker_id": dcor,
            "type": "sell",
            "year": 2025,
            "month": 3,
            "quantity": 500,
        },
    )
    assert r.status_code == 201
    balances = client.get("/balances").json()
    eco_d = next(s for s in balances if s["broker_name"] == "D Corredores")
    assert Decimal(str(eco_d["balance"])) == Decimal("1000")

    r = client.post(
        "/trades",
        json={
            "instrument_id": eco,
            "broker_id": dcor,
            "type": "sell",
            "year": 2025,
            "quantity": 1000,
        },
    )
    assert r.status_code == 201
    balances = client.get("/balances").json()
    eco_d = next(s for s in balances if s["broker_name"] == "D Corredores")
    assert Decimal(str(eco_d["balance"])) == Decimal("0")

    r = client.post(
        "/trades",
        json={
            "instrument_id": eco,
            "broker_id": dcor,
            "type": "sell",
            "year": 2025,
            "quantity": 1,
        },
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "sell_exceeds_balance"


def test_sell_does_not_touch_other_broker(client: TestClient) -> None:
    eco, dcor, trii = _ids(client)
    client.post(
        "/trades",
        json={
            "instrument_id": eco,
            "broker_id": dcor,
            "type": "buy",
            "year": 2007,
            "quantity": 1500,
        },
    )
    client.post(
        "/trades",
        json={
            "instrument_id": eco,
            "broker_id": trii,
            "type": "buy",
            "year": 2025,
            "quantity": 447,
        },
    )
    client.post(
        "/trades",
        json={
            "instrument_id": eco,
            "broker_id": trii,
            "type": "sell",
            "year": 2025,
            "quantity": 447,
        },
    )
    balances = {s["broker_name"]: s["balance"] for s in client.get("/balances").json()}
    assert Decimal(str(balances["D Corredores"])) == Decimal("1500")
    assert Decimal(str(balances["Trii"])) == Decimal("0")


def test_inactivate_only_when_balance_zero(client: TestClient) -> None:
    eco, dcor, _ = _ids(client)
    client.post(
        "/trades",
        json={
            "instrument_id": eco,
            "broker_id": dcor,
            "type": "buy",
            "year": 2007,
            "quantity": 1500,
        },
    )
    r = client.put(f"/instruments/{eco}", json={"active": False})
    assert r.status_code == 400
    client.post(
        "/trades",
        json={
            "instrument_id": eco,
            "broker_id": dcor,
            "type": "sell",
            "year": 2025,
            "quantity": 1500,
        },
    )
    r = client.put(f"/instruments/{eco}", json={"active": False})
    assert r.status_code == 200
    assert r.json()["active"] is False
    r = client.post(
        "/trades",
        json={
            "instrument_id": eco,
            "broker_id": dcor,
            "type": "buy",
            "year": 2026,
            "quantity": 10,
        },
    )
    assert r.status_code == 400
    r = client.put(f"/instruments/{eco}", json={"active": True})
    assert r.status_code == 200
    r = client.post(
        "/trades",
        json={
            "instrument_id": eco,
            "broker_id": dcor,
            "type": "buy",
            "year": 2026,
            "quantity": 10,
        },
    )
    assert r.status_code == 201


def test_summary_qty_times_price_and_inactive_out(client: TestClient) -> None:
    eco, dcor, trii = _ids(client)
    client.post(
        "/trades",
        json={
            "instrument_id": eco,
            "broker_id": dcor,
            "type": "buy",
            "year": 2007,
            "quantity": 1500,
        },
    )
    client.post(
        "/trades",
        json={
            "instrument_id": eco,
            "broker_id": trii,
            "type": "buy",
            "year": 2025,
            "quantity": 447,
        },
    )
    r = client.put(
        "/prices",
        json={"instrument_id": eco, "year": 2026, "month": 9, "price": 2645},
    )
    assert r.status_code == 200
    res = client.get("/summary").json()
    assert Decimal(str(res["total"])) == Decimal("1500") * Decimal("2645") + Decimal("447") * Decimal(
        "2645"
    )
    assert len(res["positions"]) == 2
    client.post(
        "/trades",
        json={
            "instrument_id": eco,
            "broker_id": trii,
            "type": "sell",
            "year": 2026,
            "quantity": 447,
        },
    )
    client.post(
        "/trades",
        json={
            "instrument_id": eco,
            "broker_id": dcor,
            "type": "sell",
            "year": 2026,
            "quantity": 1500,
        },
    )
    client.put(f"/instruments/{eco}", json={"active": False})
    res = client.get("/summary").json()
    assert Decimal(str(res["total"])) == Decimal("0")
    assert res["positions"] == []


def test_missing_price_does_not_sum(client: TestClient) -> None:
    eco, dcor, _ = _ids(client)
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
    res = client.get("/summary").json()
    assert Decimal(str(res["total"])) == Decimal("0")
    assert res["positions"][0]["missing_price"] is True


def test_variation_gap_is_not_invented() -> None:
    class P:
        def __init__(self, year: int, month: int, price: str) -> None:
            self.year = year
            self.month = month
            self.price = Decimal(price)

    points = variation_points([P(2026, 1, "100"), P(2026, 3, "110")])
    jan = next(p for p in points if p["month"] == 1)
    mar = next(p for p in points if p["month"] == 3)
    assert jan["variation_pct"] is None
    assert mar["variation_pct"] is None
    points2 = variation_points([P(2026, 1, "100"), P(2026, 2, "110")])
    feb = next(p for p in points2 if p["month"] == 2)
    assert feb["variation_pct"] == Decimal("10")


def test_commission_is_stored_and_does_not_change_total(client: TestClient) -> None:
    eco, dcor, _ = _ids(client)
    r = client.post(
        "/trades",
        json={
            "instrument_id": eco,
            "broker_id": dcor,
            "type": "buy",
            "year": 2007,
            "quantity": 10,
            "commission": 12500,
        },
    )
    assert r.status_code == 201
    assert Decimal(str(r.json()["commission"])) == Decimal("12500")
    assert r.json()["price"] is None
    r = client.put(
        "/prices",
        json={"instrument_id": eco, "year": 2026, "month": 9, "price": 100},
    )
    assert r.status_code == 200
    res = client.get("/summary").json()
    assert Decimal(str(res["total"])) == Decimal("1000")


def test_trade_price_is_stored_and_does_not_change_total(client: TestClient) -> None:
    eco, dcor, _ = _ids(client)
    r = client.post(
        "/trades",
        json={
            "instrument_id": eco,
            "broker_id": dcor,
            "type": "buy",
            "year": 2007,
            "quantity": 10,
            "commission": 12500,
            "price": 2480,
        },
    )
    assert r.status_code == 201
    assert Decimal(str(r.json()["price"])) == Decimal("2480")
    r = client.put(
        "/prices",
        json={"instrument_id": eco, "year": 2026, "month": 9, "price": 100},
    )
    assert r.status_code == 200
    res = client.get("/summary").json()
    assert Decimal(str(res["total"])) == Decimal("1000")


def test_non_positive_trade_price_rejected(client: TestClient) -> None:
    eco, dcor, _ = _ids(client)
    r = client.post(
        "/trades",
        json={
            "instrument_id": eco,
            "broker_id": dcor,
            "type": "buy",
            "year": 2007,
            "quantity": 10,
            "price": 0,
        },
    )
    assert r.status_code == 422


def test_negative_commission_rejected(client: TestClient) -> None:
    eco, dcor, _ = _ids(client)
    r = client.post(
        "/trades",
        json={
            "instrument_id": eco,
            "broker_id": dcor,
            "type": "buy",
            "year": 2007,
            "quantity": 10,
            "commission": -1,
        },
    )
    assert r.status_code == 422


def test_target_history_and_progress(client: TestClient) -> None:
    eco, _, _ = _ids(client)
    r = client.put(
        "/targets",
        json={"instrument_id": eco, "year": 2025, "month": 1, "price": 2000},
    )
    assert r.status_code == 200
    r = client.put(
        "/targets",
        json={"instrument_id": eco, "year": 2026, "month": 9, "price": 3000},
    )
    assert r.status_code == 200
    r = client.put(
        "/targets",
        json={"instrument_id": eco, "year": 2026, "month": 9, "price": 3100},
    )
    assert r.status_code == 200
    hist = client.get(f"/targets?instrument_id={eco}").json()
    assert len(hist) == 2
    assert Decimal(str(hist[0]["price"])) == Decimal("3100")

    client.put("/prices", json={"instrument_id": eco, "year": 2026, "month": 9, "price": 2480})
    av = client.get(f"/target-progress?instrument_id={eco}").json()
    assert Decimal(str(av["target"])) == Decimal("3100")
    assert Decimal(str(av["last_price"])) == Decimal("2480")
    assert Decimal(str(av["progress_pct"])) == (Decimal("2480") / Decimal("3100")) * Decimal("100")


def test_progress_without_target_or_price(client: TestClient) -> None:
    eco, _, _ = _ids(client)
    av = client.get(f"/target-progress?instrument_id={eco}").json()
    assert av["target"] is None
    assert av["last_price"] is None
    assert av["progress_pct"] is None


def test_pending_prices_only_active_without_price(client: TestClient) -> None:
    inst = {r["name"]: r for r in client.get("/instruments").json()}
    eco = inst["Ecopetrol"]["id"]
    celsia = inst["Celsia"]["id"]
    r = client.get("/prices/pending", params={"year": 2026, "month": 9})
    assert r.status_code == 200
    body = r.json()
    assert body["total_active"] == 11
    assert body["pending"] == 11
    client.put("/prices", json={"instrument_id": eco, "year": 2026, "month": 9, "price": 2645})
    client.put(f"/instruments/{celsia}", json={"active": False})
    body = client.get("/prices/pending", params={"year": 2026, "month": 9}).json()
    names = {f["instrument_name"] for f in body["missing"]}
    assert "Ecopetrol" not in names
    assert "Celsia" not in names
    assert body["total_active"] == 10
    assert body["pending"] == 9


def test_fx_rate_upsert_and_conversion_math(client: TestClient) -> None:
    r = client.put("/fx-rates", json={"year": 2026, "month": 9, "cop_per_usd": 4000})
    assert r.status_code == 200
    assert Decimal(str(r.json()["cop_per_usd"])) == Decimal("4000")
    r = client.put("/fx-rates", json={"year": 2026, "month": 9, "cop_per_usd": 4100})
    assert r.status_code == 200
    rows = client.get("/fx-rates", params={"year": 2026}).json()
    assert len(rows) == 1
    assert Decimal(str(rows[0]["cop_per_usd"])) == Decimal("4100")
    assert Decimal("10000") / Decimal("4000") == Decimal("2.5")


def test_fx_rate_missing_month_is_not_invented(client: TestClient) -> None:
    client.put("/fx-rates", json={"year": 2026, "month": 1, "cop_per_usd": 4000})
    rows = client.get("/fx-rates", params={"year": 2026}).json()
    months = {r["month"] for r in rows}
    assert 1 in months
    assert 9 not in months


def test_rename_instrument_keeps_id_and_rejects_duplicate(client: TestClient) -> None:
    eco, dcor, _ = _ids(client)
    client.post(
        "/trades",
        json={
            "instrument_id": eco,
            "broker_id": dcor,
            "type": "buy",
            "year": 2007,
            "quantity": 1500,
        },
    )
    client.put("/prices", json={"instrument_id": eco, "year": 2026, "month": 9, "price": 2645})
    r = client.put(f"/instruments/{eco}", json={"name": "Ecopetrol SA"})
    assert r.status_code == 200
    assert r.json()["id"] == eco
    assert r.json()["name"] == "Ecopetrol SA"
    pos = next(p for p in client.get("/summary").json()["positions"] if p["instrument_id"] == eco)
    assert pos["instrument_name"] == "Ecopetrol SA"
    assert Decimal(str(pos["balance"])) == Decimal("1500")
    celsia = {r["name"]: r["id"] for r in client.get("/instruments").json()}["Celsia"]
    r = client.put(f"/instruments/{eco}", json={"name": "Celsia"})
    assert r.status_code == 409
    assert r.json()["detail"] == "instrument_exists"
    assert client.get(f"/instruments/{celsia}").json()["name"] == "Celsia"


def test_rename_broker_keeps_id_and_rejects_duplicate(client: TestClient) -> None:
    eco, dcor, trii = _ids(client)
    client.post(
        "/trades",
        json={
            "instrument_id": eco,
            "broker_id": dcor,
            "type": "buy",
            "year": 2007,
            "quantity": 1500,
        },
    )
    r = client.put(f"/brokers/{dcor}", json={"name": "Davivienda Corredores"})
    assert r.status_code == 200
    assert r.json()["id"] == dcor
    assert r.json()["name"] == "Davivienda Corredores"
    pos = next(p for p in client.get("/summary").json()["positions"] if p["broker_id"] == dcor)
    assert pos["broker_name"] == "Davivienda Corredores"
    r = client.put(f"/brokers/{dcor}", json={"name": "Trii"})
    assert r.status_code == 409
    assert r.json()["detail"] == "broker_exists"
    assert client.get(f"/brokers/{trii}").json()["name"] == "Trii"


def test_instrument_usd_currency_and_lock(client: TestClient) -> None:
    r = client.post("/instruments", json={"name": "AAPL", "active": True, "currency": "USD"})
    assert r.status_code == 201
    apple = r.json()
    assert apple["currency"] == "USD"
    dcor = {b["name"]: b["id"] for b in client.get("/brokers").json()}["D Corredores"]
    client.post(
        "/trades",
        json={
            "instrument_id": apple["id"],
            "broker_id": dcor,
            "type": "buy",
            "year": 2026,
            "month": 8,
            "quantity": 10,
            "commission": 1.5,
        },
    )
    r = client.put(f"/instruments/{apple['id']}", json={"currency": "COP"})
    assert r.status_code == 400
    assert r.json()["detail"] == "cannot_change_currency"


def test_summary_keeps_native_value_on_usd_holding(client: TestClient) -> None:
    dcor = {b["name"]: b["id"] for b in client.get("/brokers").json()}["D Corredores"]
    apple = client.post("/instruments", json={"name": "MSFT", "active": True, "currency": "USD"}).json()
    client.post(
        "/trades",
        json={
            "instrument_id": apple["id"],
            "broker_id": dcor,
            "type": "buy",
            "year": 2026,
            "month": 8,
            "quantity": 2,
            "commission": 0,
        },
    )
    client.put("/prices", json={"instrument_id": apple["id"], "year": 2026, "month": 8, "price": 400})
    row = next(p for p in client.get("/summary").json()["positions"] if p["instrument_name"] == "MSFT")
    assert row["instrument_currency"] == "USD"
    assert Decimal(str(row["last_price"])) == Decimal("400")
    assert Decimal(str(row["value"])) == Decimal("800")


def _buy(client: TestClient, instrument_id: int, broker_id: int, quantity: int) -> dict:
    response = client.post(
        "/trades",
        json={
            "instrument_id": instrument_id,
            "broker_id": broker_id,
            "type": "buy",
            "year": 2007,
            "quantity": quantity,
        },
    )
    assert response.status_code == 201
    return response.json()


def test_reducing_buy_below_sells_is_rejected(client: TestClient) -> None:
    eco, dcor, _ = _ids(client)
    buy = _buy(client, eco, dcor, 10)
    assert (
        client.post(
            "/trades",
            json={
                "instrument_id": eco,
                "broker_id": dcor,
                "type": "sell",
                "year": 2025,
                "quantity": 6,
            },
        ).status_code
        == 201
    )
    response = client.put(
        f"/trades/{buy['id']}",
        json={
            "instrument_id": eco,
            "broker_id": dcor,
            "type": "buy",
            "year": 2007,
            "quantity": 3,
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "negative_balance"
    balance = next(row["balance"] for row in client.get("/balances").json() if row["broker_id"] == dcor)
    assert Decimal(str(balance)) == Decimal("4")


def test_moving_buy_off_a_pair_with_sells_is_rejected(client: TestClient) -> None:
    eco, dcor, trii = _ids(client)
    buy = _buy(client, eco, dcor, 10)
    client.post(
        "/trades",
        json={
            "instrument_id": eco,
            "broker_id": dcor,
            "type": "sell",
            "year": 2025,
            "quantity": 4,
        },
    )
    response = client.put(
        f"/trades/{buy['id']}",
        json={
            "instrument_id": eco,
            "broker_id": trii,
            "type": "buy",
            "year": 2007,
            "quantity": 10,
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "negative_balance"
    balances = {row["broker_id"]: row["balance"] for row in client.get("/balances").json()}
    assert Decimal(str(balances[dcor])) == Decimal("6")


def test_reducing_buy_that_still_covers_sells_is_allowed(client: TestClient) -> None:
    eco, dcor, _ = _ids(client)
    buy = _buy(client, eco, dcor, 10)
    client.post(
        "/trades",
        json={
            "instrument_id": eco,
            "broker_id": dcor,
            "type": "sell",
            "year": 2025,
            "quantity": 6,
        },
    )
    response = client.put(
        f"/trades/{buy['id']}",
        json={
            "instrument_id": eco,
            "broker_id": dcor,
            "type": "buy",
            "year": 2007,
            "quantity": 8,
        },
    )
    assert response.status_code == 200
    balance = next(row["balance"] for row in client.get("/balances").json() if row["broker_id"] == dcor)
    assert Decimal(str(balance)) == Decimal("2")


def test_summary_total_is_null_when_currencies_mix(client: TestClient) -> None:
    eco, dcor, _ = _ids(client)
    _buy(client, eco, dcor, 10)
    client.put("/prices", json={"instrument_id": eco, "year": 2026, "month": 9, "price": 100})
    usd = client.post("/instruments", json={"name": "AAPL", "active": True, "currency": "USD"}).json()
    _buy(client, usd["id"], dcor, 2)
    client.put("/prices", json={"instrument_id": usd["id"], "year": 2026, "month": 8, "price": 400})
    summary = client.get("/summary").json()
    assert summary["total"] is None
    valued = [row for row in summary["positions"] if row["value"] is not None]
    assert {row["instrument_currency"] for row in valued} == {"COP", "USD"}
    assert all(row["weight_pct"] is None for row in valued)
    by_name = {row["instrument_name"]: Decimal(str(row["value"])) for row in valued}
    assert by_name["Ecopetrol"] == Decimal("1000")
    assert by_name["AAPL"] == Decimal("800")
