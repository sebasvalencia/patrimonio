import json
from datetime import date
from decimal import Decimal, InvalidOperation
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

TRM_URL = "https://www.datos.gov.co/resource/32sa-8pi3.json"
_TIMEOUT_SECONDS = 10


class TrmSourceError(Exception):
    """The official series could not be read. Nothing should be stored."""


def today() -> date:
    return date.today()


def months_due(year: int, on: date) -> list[int]:
    """Months whose first day has already arrived."""
    if year > on.year or year < 1:
        return []
    last = 12 if year < on.year else on.month
    return list(range(1, last + 1))


def _as_date(value: object) -> date | None:
    if not isinstance(value, str) or len(value) < 10:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def _as_rate(value: object) -> Decimal | None:
    if not isinstance(value, str):
        return None
    try:
        rate = Decimal(value)
    except InvalidOperation:
        return None
    if rate <= 0:
        return None
    return rate


def rate_on(records: list[dict], day: date) -> Decimal | None:
    """TRM whose validity window covers ``day``. The latest start wins."""
    chosen: tuple[date, Decimal] | None = None
    for row in records:
        if not isinstance(row, dict):
            continue
        start = _as_date(row.get("vigenciadesde"))
        end = _as_date(row.get("vigenciahasta"))
        rate = _as_rate(row.get("valor"))
        if start is None or end is None or rate is None:
            continue
        if start <= day <= end and (chosen is None or start >= chosen[0]):
            chosen = (start, rate)
    return None if chosen is None else chosen[1]


def fetch_series(year: int) -> list[dict]:
    """Rates whose window can cover any day of ``year``, including a window opened in the previous year."""
    where = (
        f"vigenciahasta >= '{year}-01-01T00:00:00.000' "
        f"AND vigenciadesde <= '{year}-12-31T00:00:00.000'"
    )
    query = urlencode(
        {"$where": where, "$limit": 5000, "$order": "vigenciadesde"},
    )
    request = Request(
        f"{TRM_URL}?{query}",
        headers={"Accept": "application/json", "User-Agent": "stocks-api"},
    )
    try:
        with urlopen(request, timeout=_TIMEOUT_SECONDS) as response:
            payload = json.load(response)
    except (URLError, TimeoutError, OSError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise TrmSourceError("fx_source_unavailable") from exc
    if not isinstance(payload, list):
        raise TrmSourceError("fx_source_unavailable")
    return [row for row in payload if isinstance(row, dict)]
