import io
import json
from datetime import date
from decimal import Decimal
from pathlib import Path
from urllib.error import URLError

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.funds.services.rules import _lock_pair as lock_fund_pair
from app.services.rules import _lock_pair
from app.services.trm_source import TrmSourceError, fetch_series, months_due, rate_on, today


def test_create_rejects_a_duplicate_name(client: TestClient) -> None:
    assert client.post("/brokers", json={"name": "D Corredores"}).status_code == 409
    assert client.post("/instruments", json={"name": "Ecopetrol", "currency": "COP"}).status_code == 409
    fund = client.post("/funds/funds", json={"name": "FIC Visible", "currency": "COP"}).json()
    assert client.get(f"/funds/funds/{fund['id']}").status_code == 200


def test_get_db_closes_the_session(monkeypatch) -> None:
    closed: list[bool] = []

    class Dummy:
        def close(self) -> None:
            closed.append(True)

    monkeypatch.setattr("app.database.SessionLocal", lambda: Dummy())
    from app.database import get_db

    generator = get_db()
    next(generator)
    generator.close()
    assert closed == [True]


def test_seed_returns_when_the_catalog_exists_and_main_closes(db: Session, monkeypatch) -> None:
    from app.seed import main, seed

    seed(db)

    class NoClose:
        def __init__(self, inner: Session) -> None:
            self._inner = inner

        def close(self) -> None:
            return None

        def __getattr__(self, name: str):
            return getattr(self._inner, name)

    monkeypatch.setattr("app.seed.SessionLocal", lambda: NoClose(db))
    main()


def test_seed_module_runs_as_a_script(db: Session, monkeypatch) -> None:
    import app.seed as seed_mod

    class NoClose:
        def __init__(self, inner: Session) -> None:
            self._inner = inner

        def close(self) -> None:
            return None

        def __getattr__(self, name: str):
            return getattr(self._inner, name)

    monkeypatch.setattr("app.database.SessionLocal", lambda: NoClose(db))
    source = Path(seed_mod.__file__).read_text(encoding="utf-8")
    namespace = {"__name__": "__main__"}
    exec(compile(source, seed_mod.__file__, "exec"), namespace)


def test_seed_demo_main_prints_the_catalog(db: Session, monkeypatch, capsys) -> None:
    import app.seed_demo as seed_demo

    class NoClose:
        def __init__(self, inner: Session) -> None:
            self._inner = inner

        def close(self) -> None:
            return None

        def __getattr__(self, name: str):
            return getattr(self._inner, name)

    opener = lambda: NoClose(db)
    monkeypatch.setattr(seed_demo, "SessionLocal", opener)
    monkeypatch.setattr("app.database.SessionLocal", opener)
    seed_demo.main()
    assert "Demo catalog:" in capsys.readouterr().out

    source = Path(seed_demo.__file__).read_text(encoding="utf-8")
    exec(compile(source, seed_demo.__file__, "exec"), {"__name__": "__main__"})


def test_lock_pair_runs_on_postgresql(db: Session, monkeypatch) -> None:
    class Dialect:
        name = "postgresql"

    class Bind:
        dialect = Dialect()

    class Result:
        def all(self) -> list:
            return []

    monkeypatch.setattr(db, "get_bind", lambda: Bind())
    monkeypatch.setattr(db, "execute", lambda statement, *args, **kwargs: Result())
    _lock_pair(db, 1, 2)
    lock_fund_pair(db, 1, 2)


class _Body(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args) -> bool:
        return False


def _open(payload: bytes):
    def _urlopen(request, timeout):
        assert "32sa-8pi3" in request.full_url
        assert timeout == 10
        return _Body(payload)

    return _urlopen


def test_trm_helpers_skip_bad_rows_and_future_years(monkeypatch) -> None:
    assert isinstance(today(), date)
    assert months_due(2030, date(2026, 3, 1)) == []
    assert months_due(0, date(2026, 3, 1)) == []
    assert months_due(2020, date(2026, 3, 1)) == list(range(1, 13))

    day = date(2026, 1, 1)
    assert rate_on(["nope", {"valor": "1"}], day) is None
    assert rate_on([{"vigenciadesde": "2026-01", "vigenciahasta": "2026-01-02T00:00:00.000", "valor": "1"}], day) is None
    assert rate_on(
        [{"vigenciadesde": "not-a-dateT00:00:00.000", "vigenciahasta": "2026-01-02T00:00:00.000", "valor": "1"}],
        day,
    ) is None
    assert rate_on(
        [{"vigenciadesde": "2026-01-01T00:00:00.000", "vigenciahasta": "2026-01-02T00:00:00.000", "valor": 1}],
        day,
    ) is None
    assert rate_on(
        [{"vigenciadesde": "2026-01-01T00:00:00.000", "vigenciahasta": "2026-01-02T00:00:00.000", "valor": "nope"}],
        day,
    ) is None
    assert rate_on(
        [{"vigenciadesde": "2026-01-01T00:00:00.000", "vigenciahasta": "2026-01-02T00:00:00.000", "valor": "0"}],
        day,
    ) is None
    assert rate_on(
        [{"vigenciadesde": "2026-02-01T00:00:00.000", "vigenciahasta": "2026-02-02T00:00:00.000", "valor": "9"}],
        day,
    ) is None

    monkeypatch.setattr("app.services.trm_source.urlopen", _open(json.dumps([{"valor": "1"}, "skip"]).encode()))
    assert fetch_series(2026) == [{"valor": "1"}]

    monkeypatch.setattr("app.services.trm_source.urlopen", _open(json.dumps({"error": True}).encode()))
    with pytest.raises(TrmSourceError, match="fx_source_unavailable"):
        fetch_series(2026)

    def _down(request, timeout):
        raise URLError("down")

    monkeypatch.setattr("app.services.trm_source.urlopen", _down)
    with pytest.raises(TrmSourceError):
        fetch_series(2026)

    monkeypatch.setattr("app.services.trm_source.urlopen", _open(b"not-json"))
    with pytest.raises(TrmSourceError):
        fetch_series(2026)
