import io
import json
from decimal import Decimal
from urllib.error import URLError

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.funds.services.balances import fund_balance
from app.services.balances import instrument_balance

MISSING = 999_999


def _ids(client: TestClient) -> tuple[int, int, int]:
    instruments = {row["name"]: row["id"] for row in client.get("/instruments").json()}
    brokers = {row["name"]: row["id"] for row in client.get("/brokers").json()}
    return instruments["Ecopetrol"], brokers["D Corredores"], brokers["Trii"]


def _buy(client: TestClient, instrument_id: int, broker_id: int, quantity: int) -> dict:
    response = client.post(
        "/trades",
        json={
            "instrument_id": instrument_id,
            "broker_id": broker_id,
            "type": "buy",
            "year": 2020,
            "quantity": quantity,
        },
    )
    assert response.status_code == 201
    return response.json()


def _fund(client: TestClient, name: str = "FIC Borde") -> tuple[int, int]:
    fiduciary = client.post("/funds/fiduciaries", json={"name": f"Fid {name}"}).json()
    fund = client.post(
        "/funds/funds",
        json={"name": name, "active": True, "currency": "COP"},
    ).json()
    return fund["id"], fiduciary["id"]


def _subscribe(client: TestClient, fund_id: int, fiduciary_id: int, quantity: int) -> dict:
    response = client.post(
        "/funds/trades",
        json={
            "fund_id": fund_id,
            "fiduciary_id": fiduciary_id,
            "type": "subscribe",
            "year": 2024,
            "quantity": quantity,
        },
    )
    assert response.status_code == 201
    return response.json()


def _boom() -> None:
    raise IntegrityError("DELETE", {}, Exception("fk"))


def test_catalog_missing_ids_and_name_collisions(client: TestClient) -> None:
    assert client.get(f"/brokers/{MISSING}").status_code == 404
    assert client.put(f"/brokers/{MISSING}", json={"name": "Nadie"}).status_code == 404
    assert client.delete(f"/brokers/{MISSING}").status_code == 404
    assert client.get(f"/instruments/{MISSING}").status_code == 404
    assert client.put(f"/instruments/{MISSING}", json={"name": "Nadie"}).status_code == 404
    assert client.delete(f"/instruments/{MISSING}").status_code == 404

    first = client.post("/brokers", json={"name": "Uno"}).json()
    second = client.post("/brokers", json={"name": "Dos"}).json()
    clash = client.put(f"/brokers/{second['id']}", json={"name": "Uno"})
    assert clash.status_code == 409
    assert clash.json()["detail"] == "broker_exists"

    kept = client.post("/instruments", json={"name": "Libre A", "currency": "COP"}).json()
    other = client.post("/instruments", json={"name": "Libre B", "currency": "COP"}).json()
    clash = client.put(f"/instruments/{other['id']}", json={"name": "Libre A"})
    assert clash.status_code == 409
    assert clash.json()["detail"] == "instrument_exists"

    gone = client.delete(f"/brokers/{first['id']}")
    assert gone.status_code == 204
    assert client.delete(f"/instruments/{kept['id']}").status_code == 204


def test_delete_broker_or_instrument_with_relations_conflicts(
    client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    eco, dcor, _ = _ids(client)
    _buy(client, eco, dcor, 1)
    monkeypatch.setattr(db, "commit", _boom)
    blocked = client.delete(f"/brokers/{dcor}")
    assert blocked.status_code == 409
    assert blocked.json()["detail"] == "cannot_delete_broker"
    blocked = client.delete(f"/instruments/{eco}")
    assert blocked.status_code == 409
    assert blocked.json()["detail"] == "cannot_delete_instrument"


def test_trade_lookup_delete_and_inactive(client: TestClient) -> None:
    eco, dcor, _ = _ids(client)
    missing = client.get(f"/trades/{MISSING}")
    assert missing.status_code == 404
    assert missing.json()["detail"] == "trade_not_found"
    unknown_broker = client.post(
        "/trades",
        json={"instrument_id": eco, "broker_id": MISSING, "type": "buy", "year": 2020, "quantity": 1},
    )
    assert unknown_broker.status_code == 404
    assert unknown_broker.json()["detail"] == "broker_not_found"
    unknown_instrument = client.post(
        "/trades",
        json={"instrument_id": MISSING, "broker_id": dcor, "type": "buy", "year": 2020, "quantity": 1},
    )
    assert unknown_instrument.status_code == 404
    assert unknown_instrument.json()["detail"] == "instrument_not_found"

    cover = _buy(client, eco, dcor, 10)
    extra = _buy(client, eco, dcor, 4)
    client.post(
        "/trades",
        json={"instrument_id": eco, "broker_id": dcor, "type": "sell", "year": 2025, "quantity": 6},
    )
    assert client.get(f"/trades/{cover['id']}").status_code == 200
    removed = client.delete(f"/trades/{extra['id']}")
    assert removed.status_code == 204
    blocked = client.delete(f"/trades/{cover['id']}")
    assert blocked.status_code == 400
    assert blocked.json()["detail"] == "cannot_delete_trade"

    dormant = client.post(
        "/instruments", json={"name": "Dormido", "active": False, "currency": "COP"}
    ).json()
    rejected = client.post(
        "/trades",
        json={
            "instrument_id": dormant["id"],
            "broker_id": dcor,
            "type": "buy",
            "year": 2020,
            "quantity": 1,
        },
    )
    assert rejected.status_code == 400
    assert rejected.json()["detail"] == "cannot_buy_inactive"
    moved = client.put(
        f"/trades/{cover['id']}",
        json={
            "instrument_id": dormant["id"],
            "broker_id": dcor,
            "type": "buy",
            "year": 2020,
            "quantity": 10,
        },
    )
    assert moved.status_code == 400
    assert moved.json()["detail"] == "cannot_buy_inactive"


def test_prices_targets_and_fx_edges(client: TestClient) -> None:
    eco, _, _ = _ids(client)
    missing_price = client.put(
        "/prices", json={"instrument_id": MISSING, "year": 2026, "month": 1, "price": 10}
    )
    assert missing_price.status_code == 404
    created = client.put(
        "/prices", json={"instrument_id": eco, "year": 2026, "month": 1, "price": 10}
    )
    updated = client.put(
        "/prices", json={"instrument_id": eco, "year": 2026, "month": 1, "price": 12}
    )
    assert updated.status_code == 200
    assert Decimal(updated.json()["price"]) == Decimal("12")
    listed = client.get("/prices", params={"year": 2026, "instrument_id": eco}).json()
    assert listed[0]["month"] == 1
    assert client.delete(f"/prices/{created.json()['id']}").status_code == 204
    assert client.delete(f"/prices/{MISSING}").status_code == 404

    missing_target = client.put(
        "/targets", json={"instrument_id": MISSING, "year": 2026, "month": 1, "price": 20}
    )
    assert missing_target.status_code == 404
    target = client.put(
        "/targets", json={"instrument_id": eco, "year": 2026, "month": 1, "price": 20}
    ).json()
    client.put("/targets", json={"instrument_id": eco, "year": 2026, "month": 1, "price": 22})
    assert client.get("/targets", params={"instrument_id": eco}).json()
    assert client.delete(f"/targets/{target['id']}").status_code == 204
    assert client.delete(f"/targets/{MISSING}").status_code == 404
    assert client.get("/target-progress", params={"instrument_id": MISSING}).status_code == 404
    assert client.get("/price-variation", params={"instrument_id": MISSING}).status_code == 404

    rate = client.put("/fx-rates", json={"year": 2024, "month": 5, "cop_per_usd": "4000"}).json()
    assert client.delete(f"/fx-rates/{rate['id']}").status_code == 204
    missing_fx = client.delete(f"/fx-rates/{MISSING}")
    assert missing_fx.status_code == 404
    assert missing_fx.json()["detail"] == "fx_rate_not_found"


def test_currency_same_value_is_kept_and_price_or_target_blocks_a_change(client: TestClient) -> None:
    same = client.post("/instruments", json={"name": "Misma Moneda", "currency": "COP"}).json()
    kept = client.put(f"/instruments/{same['id']}", json={"currency": "COP"})
    assert kept.status_code == 200
    assert kept.json()["currency"] == "COP"

    priced = client.post("/instruments", json={"name": "Solo Precio", "currency": "COP"}).json()
    client.put("/prices", json={"instrument_id": priced["id"], "year": 2026, "month": 2, "price": 5})
    blocked = client.put(f"/instruments/{priced['id']}", json={"currency": "USD"})
    assert blocked.status_code == 400
    assert blocked.json()["detail"] == "cannot_change_currency"

    targeted = client.post("/instruments", json={"name": "Solo Objetivo", "currency": "COP"}).json()
    client.put("/targets", json={"instrument_id": targeted["id"], "year": 2026, "month": 2, "price": 9})
    blocked = client.put(f"/instruments/{targeted['id']}", json={"currency": "USD"})
    assert blocked.status_code == 400
    assert blocked.json()["detail"] == "cannot_change_currency"


def test_zero_value_has_zero_weight_and_wealth_mix(client: TestClient) -> None:
    eco, dcor, _ = _ids(client)
    _buy(client, eco, dcor, 5)
    client.post(
        "/trades",
        json={"instrument_id": eco, "broker_id": dcor, "type": "sell", "year": 2025, "quantity": 5},
    )
    client.put("/prices", json={"instrument_id": eco, "year": 2026, "month": 3, "price": 100})
    assert client.get("/wealth").json()["equities"]["total"] == "0"
    row = client.get("/summary").json()["positions"][0]
    assert Decimal(row["value"]) == Decimal("0")
    assert Decimal(row["weight_pct"]) == Decimal("0")

    usd = client.post("/instruments", json={"name": "AAPL Borde", "currency": "USD"}).json()
    _buy(client, usd["id"], dcor, 2)
    client.put("/prices", json={"instrument_id": usd["id"], "year": 2026, "month": 3, "price": 10})
    client.put("/prices", json={"instrument_id": eco, "year": 2026, "month": 4, "price": 50})
    _buy(client, eco, dcor, 1)
    fund_id, fiduciary_id = _fund(client, "FIC Mezcla")
    _subscribe(client, fund_id, fiduciary_id, 3)
    client.put("/funds/unit-values", json={"fund_id": fund_id, "year": 2026, "month": 3, "value": 10})
    wealth = client.get("/wealth").json()
    assert wealth["total"] is None


def test_balances_skip_a_missing_instrument(
    client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    eco, dcor, _ = _ids(client)
    _buy(client, eco, dcor, 1)
    real_get = db.get

    def fake_get(model, ident, *args, **kwargs):
        if getattr(model, "__name__", "") == "Instrument":
            return None
        return real_get(model, ident, *args, **kwargs)

    monkeypatch.setattr(db, "get", fake_get)
    assert client.get("/balances").json() == []


def test_instrument_balance_can_exclude_a_trade(client: TestClient, db: Session) -> None:
    eco, dcor, _ = _ids(client)
    trade = _buy(client, eco, dcor, 7)
    assert instrument_balance(db, eco, exclude_id=trade["id"]) == Decimal("0")
    assert instrument_balance(db, eco) == Decimal("7")


def test_empty_wealth_has_no_valued_currency(client: TestClient) -> None:
    wealth = client.get("/wealth").json()
    assert wealth["total"] == "0"
    assert wealth["equities"]["positions"] == []
    assert wealth["funds"]["positions"] == []


def test_fund_catalog_trades_and_values(client: TestClient, db: Session) -> None:
    assert client.get(f"/funds/funds/{MISSING}").status_code == 404
    assert client.put(f"/funds/funds/{MISSING}", json={"name": "Nadie"}).status_code == 404
    assert client.delete(f"/funds/funds/{MISSING}").status_code == 404
    assert client.get(f"/funds/fiduciaries/{MISSING}").status_code == 404
    assert client.put(f"/funds/fiduciaries/{MISSING}", json={"name": "Nadie"}).status_code == 404
    assert client.delete(f"/funds/fiduciaries/{MISSING}").status_code == 404
    assert client.get(f"/funds/trades/{MISSING}").status_code == 404

    created = client.post("/funds/funds", json={"name": "FIC Uno", "currency": "COP"})
    assert created.status_code == 201
    duplicate = client.post("/funds/funds", json={"name": "FIC Uno", "currency": "COP"})
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "fund_exists"
    other = client.post("/funds/funds", json={"name": "FIC Dos", "currency": "COP"}).json()
    clash = client.put(f"/funds/funds/{other['id']}", json={"name": "FIC Uno"})
    assert clash.status_code == 409

    fiduciary = client.post("/funds/fiduciaries", json={"name": "Fid Uno"}).json()
    duplicate_fid = client.post("/funds/fiduciaries", json={"name": "Fid Uno"})
    assert duplicate_fid.status_code == 409
    spare = client.post("/funds/fiduciaries", json={"name": "Fid Libre"}).json()
    assert client.delete(f"/funds/fiduciaries/{spare['id']}").status_code == 204
    assert client.delete(f"/funds/funds/{other['id']}").status_code == 204

    same = client.put(f"/funds/funds/{created.json()['id']}", json={"currency": "COP"})
    assert same.status_code == 200

    fund_id = created.json()["id"]
    unknown = client.post(
        "/funds/trades",
        json={
            "fund_id": fund_id,
            "fiduciary_id": MISSING,
            "type": "subscribe",
            "year": 2024,
            "quantity": 1,
        },
    )
    assert unknown.status_code == 404
    assert unknown.json()["detail"] == "fiduciary_not_found"
    unknown = client.post(
        "/funds/trades",
        json={
            "fund_id": MISSING,
            "fiduciary_id": fiduciary["id"],
            "type": "subscribe",
            "year": 2024,
            "quantity": 1,
        },
    )
    assert unknown.json()["detail"] == "fund_not_found"

    cover = _subscribe(client, fund_id, fiduciary["id"], 10)
    extra = _subscribe(client, fund_id, fiduciary["id"], 4)
    assert client.get("/funds/trades").json()
    assert client.get(f"/funds/trades/{cover['id']}").status_code == 200
    edited = client.put(
        f"/funds/trades/{extra['id']}",
        json={
            "fund_id": fund_id,
            "fiduciary_id": fiduciary["id"],
            "type": "subscribe",
            "year": 2024,
            "quantity": 3,
        },
    )
    assert edited.status_code == 200
    client.post(
        "/funds/trades",
        json={
            "fund_id": fund_id,
            "fiduciary_id": fiduciary["id"],
            "type": "redeem",
            "year": 2025,
            "quantity": 6,
        },
    )
    assert client.delete(f"/funds/trades/{extra['id']}").status_code == 204
    blocked = client.delete(f"/funds/trades/{cover['id']}")
    assert blocked.status_code == 400
    assert blocked.json()["detail"] == "cannot_delete_fund_trade"
    assert fund_balance(db, fund_id, exclude_id=cover["id"]) == Decimal("-6")

    dormant = client.post(
        "/funds/funds", json={"name": "FIC Dormido", "active": False, "currency": "COP"}
    ).json()
    rejected = client.post(
        "/funds/trades",
        json={
            "fund_id": dormant["id"],
            "fiduciary_id": fiduciary["id"],
            "type": "subscribe",
            "year": 2024,
            "quantity": 1,
        },
    )
    assert rejected.json()["detail"] == "cannot_subscribe_inactive"
    moved = client.put(
        f"/funds/trades/{cover['id']}",
        json={
            "fund_id": dormant["id"],
            "fiduciary_id": fiduciary["id"],
            "type": "subscribe",
            "year": 2024,
            "quantity": 10,
        },
    )
    assert moved.json()["detail"] == "cannot_subscribe_inactive"

    closed_fund, closed_fid = _fund(client, "FIC Cerrado")
    _subscribe(client, closed_fund, closed_fid, 2)
    client.post(
        "/funds/trades",
        json={
            "fund_id": closed_fund,
            "fiduciary_id": closed_fid,
            "type": "redeem",
            "year": 2025,
            "quantity": 2,
        },
    )
    assert client.put(f"/funds/funds/{closed_fund}", json={"active": False}).status_code == 200
    names = {row["instrument_name"] for row in client.get("/funds/summary").json()["positions"]}
    assert "FIC Cerrado" not in names

    only_value = client.post("/funds/funds", json={"name": "FIC Valor", "currency": "COP"}).json()
    client.put(
        "/funds/unit-values",
        json={"fund_id": only_value["id"], "year": 2026, "month": 1, "value": 8},
    )
    blocked = client.put(f"/funds/funds/{only_value['id']}", json={"currency": "USD"})
    assert blocked.json()["detail"] == "cannot_change_fund_currency"
    only_target = client.post("/funds/funds", json={"name": "FIC Objetivo", "currency": "COP"}).json()
    client.put(
        "/funds/targets",
        json={"fund_id": only_target["id"], "year": 2026, "month": 1, "price": 9},
    )
    blocked = client.put(f"/funds/funds/{only_target['id']}", json={"currency": "USD"})
    assert blocked.status_code == 400

    missing_value = client.put(
        "/funds/unit-values",
        json={"fund_id": MISSING, "year": 2026, "month": 1, "value": 1},
    )
    assert missing_value.status_code == 404
    value = client.put(
        "/funds/unit-values",
        json={"fund_id": fund_id, "year": 2026, "month": 1, "value": 10},
    ).json()
    client.put(
        "/funds/unit-values",
        json={"fund_id": fund_id, "year": 2026, "month": 1, "value": 11},
    )
    client.put(
        "/funds/unit-values",
        json={"fund_id": fund_id, "year": 2026, "month": 2, "value": 12},
    )
    assert client.get("/funds/unit-values", params={"year": 2026, "fund_id": fund_id}).json()
    assert client.delete(f"/funds/unit-values/{value['id']}").status_code == 204
    assert client.delete(f"/funds/unit-values/{MISSING}").status_code == 404

    missing_target = client.put(
        "/funds/targets", json={"fund_id": MISSING, "year": 2026, "month": 1, "price": 1}
    )
    assert missing_target.status_code == 404
    target = client.put(
        "/funds/targets", json={"fund_id": fund_id, "year": 2026, "month": 1, "price": 20}
    ).json()
    client.put("/funds/targets", json={"fund_id": fund_id, "year": 2026, "month": 1, "price": 21})
    assert client.get("/funds/targets", params={"fund_id": fund_id}).json()
    assert client.delete(f"/funds/targets/{target['id']}").status_code == 204
    assert client.delete(f"/funds/targets/{MISSING}").status_code == 404
    assert client.get("/funds/target-progress", params={"fund_id": MISSING}).status_code == 404
    empty = client.get("/funds/target-progress", params={"fund_id": dormant["id"]})
    assert empty.status_code == 200
    assert empty.json()["last_price"] is None

    assert client.get("/funds/price-variation", params={"fund_id": MISSING}).status_code == 404
    points = client.get("/funds/price-variation", params={"fund_id": fund_id}).json()["points"]
    assert len(points) == 1

    held = client.delete(f"/funds/fiduciaries/{fiduciary['id']}")
    assert held.status_code == 409
    assert held.json()["detail"] == "cannot_delete_fiduciary"
    held = client.delete(f"/funds/funds/{fund_id}")
    assert held.status_code == 409
    assert held.json()["detail"] == "cannot_delete_fund"


def test_delete_conflict_when_commit_fails(
    client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    fund = client.post("/funds/funds", json={"name": "FIC Suelto", "currency": "COP"}).json()
    fiduciary = client.post("/funds/fiduciaries", json={"name": "Fid Suelto"}).json()
    monkeypatch.setattr(db, "commit", _boom)
    blocked = client.delete(f"/funds/funds/{fund['id']}")
    assert blocked.status_code == 409
    assert blocked.json()["detail"] == "cannot_delete_fund"
    blocked = client.delete(f"/funds/fiduciaries/{fiduciary['id']}")
    assert blocked.status_code == 409
    assert blocked.json()["detail"] == "cannot_delete_fiduciary"
    blocked = client.post("/funds/funds", json={"name": "FIC Nuevo", "currency": "COP"})
    assert blocked.status_code == 409
    assert blocked.json()["detail"] == "fund_exists"
