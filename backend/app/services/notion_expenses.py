"""This month's total spend from a Notion "Expenses" page.

The page is found by title (NOTION_EXPENSES_PAGE, default "Expenses") or by a
Notion page/database URL or ID in the same setting. Its layout is detected
automatically:

  * a database (full-page, or inline inside the page): sums the number column
    (Amount/Price/Cost...) for rows whose date column falls in this month, or
    rows created this month if there is no date column
  * a simple /table block: finds the amount and date columns from the header or
    the cell contents; rows without a date count by when they were added
  * lines of text ("Groceries - 850", "Rapido ₹120"): the amount is the number
    after ₹/Rs, else the last number; a date in the line wins, else a month
    heading above it ("September 2026"), else when the line was added
  * sub-pages named after months ("September 2026"): everything in the current
    month's sub-page is counted

Rows/lines starting with "Total" are skipped so a running total isn't double counted.
"""
import re
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import httpx

from ..cache import ttl_cache
from ..config import settings
from .notion import NOTION_VERSION, NotionAuthError, NotionNotConfigured

API = "https://api.notion.com/v1"
MAX_PAGES = 10  # pagination guard (100 items per page)

MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}
MONTH_WORD = r"(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
AMOUNT_HEADER = re.compile(r"amount|amt|price|cost|spent|spend|expense|paid|money|rupees|\brs\b|inr|₹|value|total", re.I)
DATE_HEADER = re.compile(r"date|\bday\b|when", re.I)
TOTAL_ROW = re.compile(r"^\s*(grand\s+)?total\b", re.I)
TEXT_BLOCKS = {"paragraph", "bulleted_list_item", "numbered_list_item", "to_do", "quote", "callout", "toggle"}

_DATE_PATTERNS = [
    # 2026-09-24
    (re.compile(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b"), lambda m: (int(m[1]), int(m[2]), int(m[3]))),
    # 24/09/2026, 24-09-26, 24.09 (Indian day-first order)
    (re.compile(r"\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b"),
     lambda m: (_year(m[3]), int(m[2]), int(m[1]))),
    # 24 Sep 2026, 24th September
    (re.compile(r"\b(\d{1,2})(?:st|nd|rd|th)?\s+" + MONTH_WORD + r"\.?,?(?:\s+(\d{4}))?\b", re.I),
     lambda m: (_year(m[3]), MONTHS[m[2][:3].lower()], int(m[1]))),
    # Sep 24, 2026
    (re.compile(r"\b" + MONTH_WORD + r"\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?(?:\s+(\d{4}))?\b", re.I),
     lambda m: (_year(m[3]), MONTHS[m[1][:3].lower()], int(m[2]))),
]
_CURRENCY_AMOUNT = re.compile(r"(?:₹|\brs\.?|\binr)\s*(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s*(?:₹|rs\b|inr\b|/-)", re.I)
_ANY_NUMBER = re.compile(r"(?<![\w.])(\d[\d,]*(?:\.\d+)?)(k)?(?![\w])", re.I)


def _year(text: str | None) -> int:
    if not text:
        return _now().year
    y = int(text)
    return y + 2000 if y < 100 else y


def _tz():
    # Windows has no built-in timezone database; without the `tzdata` package
    # ZoneInfo fails, so fall back to a fixed offset (IST has no daylight saving).
    try:
        return ZoneInfo(settings.timezone)
    except Exception:
        if settings.timezone in ("Asia/Kolkata", "Asia/Calcutta"):
            return timezone(timedelta(hours=5, minutes=30))
        return timezone.utc


def _now() -> datetime:
    return datetime.now(_tz())


# ---------- text helpers ----------

def _plain(rich: list[dict]) -> str:
    return "".join(r.get("plain_text", "") for r in rich or []).strip()


def _mention_date(rich: list[dict]) -> date | None:
    for r in rich or []:
        if r.get("type") == "mention" and (r.get("mention") or {}).get("type") == "date":
            start = (r["mention"].get("date") or {}).get("start")
            if start:
                return _iso_to_local_date(start)
    return None


def _iso_to_local_date(value: str) -> date:
    if len(value) == 10:
        return date.fromisoformat(value)
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(_tz()).date()


def _find_date(text: str) -> tuple[date | None, str]:
    """Return (date found in text, text with the date removed)."""
    for pattern, build in _DATE_PATTERNS:
        m = pattern.search(text)
        if not m:
            continue
        try:
            y, mo, d = build(m)
            return date(y, mo, d), text[: m.start()] + " " + text[m.end():]
        except (ValueError, KeyError):
            continue
    return None, text


def _to_number(raw: str, k: str | None = None) -> float | None:
    try:
        n = float(raw.replace(",", ""))
    except ValueError:
        return None
    return n * 1000 if k else n


def _amount_from_text(text: str) -> float | None:
    _, text = _find_date(text)  # so "24/09" isn't read as an amount
    m = _CURRENCY_AMOUNT.search(text)
    if m:
        return _to_number(m[1] or m[2])
    numbers = _ANY_NUMBER.findall(text)
    return _to_number(*numbers[-1]) if numbers else None


def _month_heading(text: str) -> tuple[int, int] | None:
    """'September 2026' / 'Sept expenses' -> (year, month); None if not a month heading."""
    if _find_date(text)[0]:
        return None
    m = re.search(r"\b" + MONTH_WORD + r"\b\.?(?:\s*[,'-]?\s*(\d{2,4}))?", text, re.I)
    if not m:
        return None
    return _year(m[2]), MONTHS[m[1][:3].lower()]


# ---------- Notion API ----------

class _Client:
    def __init__(self, http: httpx.AsyncClient):
        self.http = http

    async def call(self, method: str, path: str, **kw) -> dict:
        res = await self.http.request(method, API + path, **kw)
        if res.status_code in (401, 403):
            raise NotionAuthError()
        res.raise_for_status()
        return res.json()

    async def paginate(self, method: str, path: str, body: dict | None = None) -> list[dict]:
        out, cursor = [], None
        for _ in range(MAX_PAGES):
            if method == "GET":
                params = {"page_size": 100, **({"start_cursor": cursor} if cursor else {})}
                data = await self.call("GET", path, params=params)
            else:
                payload = {**(body or {}), "page_size": 100, **({"start_cursor": cursor} if cursor else {})}
                data = await self.call("POST", path, json=payload)
            out += data.get("results", [])
            if not data.get("has_more"):
                break
            cursor = data.get("next_cursor")
        return out


def _title_of(obj: dict) -> str:
    if "title" in obj and isinstance(obj["title"], list):
        return _plain(obj["title"])
    for prop in (obj.get("properties") or {}).values():
        if prop.get("type") == "title":
            return _plain(prop.get("title"))
    return ""


async def _find_target(api: _Client) -> dict | None:
    ref = settings.notion_expenses_page.strip()
    ids = re.findall(r"[0-9a-f]{32}", ref.replace("-", "").lower())
    if ids:
        for kind in ("databases", "pages"):
            try:
                return await api.call("GET", f"/{kind}/{ids[-1]}")
            except httpx.HTTPStatusError:
                continue
        return None
    data = await api.call("POST", "/search", json={"query": ref, "page_size": 20})
    matches = [o for o in data.get("results", []) if _title_of(o).strip().lower() == ref.lower()
               and not o.get("archived") and not o.get("in_trash")]
    matches.sort(key=lambda o: o.get("object") != "database")  # prefer a database
    return matches[0] if matches else None


# ---------- summing ----------

def _latest(*values: str | None) -> str | None:
    """Most recent Notion timestamp (they are all UTC ISO strings, so they sort as text)."""
    vals = [v for v in values if v]
    return max(vals) if vals else None


def _in_month(d: date | None, ym: tuple[int, int]) -> bool:
    return d is not None and (d.year, d.month) == ym


def _prop_number(prop: dict) -> float | None:
    t = prop.get("type")
    if t == "number":
        return prop.get("number")
    if t == "formula":
        return (prop.get("formula") or {}).get("number")
    if t == "rollup":
        return (prop.get("rollup") or {}).get("number")
    if t in ("rich_text", "title"):
        return _amount_from_text(_plain(prop.get(t)))
    return None


async def _sum_database(api: _Client, db: dict, ym: tuple[int, int]) -> dict:
    if "properties" not in db or db.get("object") != "database":
        db = await api.call("GET", f"/databases/{db['id']}")
    props = db.get("properties", {})

    numeric = [n for n, p in props.items() if p["type"] in ("number", "formula", "rollup")]
    amount_prop = next((n for n in numeric if AMOUNT_HEADER.search(n)), numeric[0] if numeric else None)
    if amount_prop is None:  # amounts typed as text, e.g. title "Groceries 850"
        texts = [n for n, p in props.items() if p["type"] in ("rich_text", "title")]
        amount_prop = next((n for n in texts if AMOUNT_HEADER.search(n)), None) or next(
            n for n, p in props.items() if p["type"] == "title"
        )
    dates = [n for n, p in props.items() if p["type"] == "date"]
    date_prop = next((n for n in dates if DATE_HEADER.search(n)), dates[0] if dates else None)

    start = date(ym[0], ym[1], 1)
    end = date(ym[0] + (ym[1] == 12), ym[1] % 12 + 1, 1)
    tz = _now().strftime("%z")
    tz = f"{tz[:3]}:{tz[3:]}"
    if date_prop:
        flt = {"and": [
            {"property": date_prop, "date": {"on_or_after": start.isoformat()}},
            {"property": date_prop, "date": {"before": end.isoformat()}},
        ]}
    else:
        flt = {"and": [
            {"timestamp": "created_time", "created_time": {"on_or_after": f"{start.isoformat()}T00:00:00{tz}"}},
            {"timestamp": "created_time", "created_time": {"before": f"{end.isoformat()}T00:00:00{tz}"}},
        ]}
    rows = await api.paginate("POST", f"/databases/{db['id']}/query", {"filter": flt})

    total, count = 0.0, 0
    for row in rows:
        p = row.get("properties", {})
        if TOTAL_ROW.match(_title_of(row)):
            continue
        n = _prop_number(p.get(amount_prop, {}))
        if n:
            total += n
            count += 1
    how = f"database · “{amount_prop}”" + (f" by “{date_prop}”" if date_prop else " by date added")
    last = _latest(*(r.get("last_edited_time") for r in rows))
    return {"total": total, "count": count, "method": how, "last": last}


def _pick_column(rows: list[list[str]], header: list[str] | None, header_re: re.Pattern, test) -> int | None:
    if header:
        for i, h in enumerate(header):
            # the header must match AND the column must actually hold such values
            if header_re.search(h) and (not rows or any(i < len(r) and r[i] and test(r[i]) for r in rows)):
                return i
    width = max((len(r) for r in rows), default=0)
    best, best_hits = None, 0
    for i in range(width):
        hits = sum(1 for r in rows if i < len(r) and r[i] and test(r[i]))
        if hits > best_hits and hits >= max(1, len(rows) // 2):
            best, best_hits = i, hits
    return best


async def _sum_table(api: _Client, block: dict, ym, forced: bool) -> tuple[float, int, str | None]:
    raw_rows = await api.paginate("GET", f"/blocks/{block['id']}/children")
    last = _latest(block.get("last_edited_time"), *(r.get("last_edited_time") for r in raw_rows))
    rows = [r for r in raw_rows if r.get("type") == "table_row"]
    cells = [[_plain(c) for c in r["table_row"]["cells"]] for r in rows]
    rich = [r["table_row"]["cells"] for r in rows]
    header = None
    if block["table"].get("has_column_header") and cells:
        header, cells, rich, rows = cells[0], cells[1:], rich[1:], rows[1:]

    date_col = _pick_column(cells, header, DATE_HEADER, lambda t: _find_date(t)[0] is not None)
    is_amount = lambda t: bool(re.fullmatch(r"\s*(?:₹|rs\.?|inr)?\s*\d[\d,]*(?:\.\d+)?\s*(?:₹|rs|inr|/-)?\s*", t, re.I))
    amount_col = _pick_column(
        [[c if i != date_col else "" for i, c in enumerate(r)] for r in cells],
        [h if i != date_col else "" for i, h in enumerate(header)] if header else None,
        AMOUNT_HEADER, is_amount,
    )

    total, count = 0.0, 0
    for row, texts, rt in zip(rows, cells, rich):
        if any(TOTAL_ROW.match(t) for t in texts[:2]):
            continue
        if not forced:
            d = None
            if date_col is not None and date_col < len(texts):
                d = _mention_date(rt[date_col]) or _find_date(texts[date_col])[0]
            if d is None:
                d = _iso_to_local_date(row["created_time"])
            if not _in_month(d, ym):
                continue
        text = texts[amount_col] if amount_col is not None and amount_col < len(texts) else " ".join(texts)
        n = _amount_from_text(text)
        if n:
            total += n
            count += 1
    return total, count, last


async def _sum_blocks(api: _Client, parent_id: str, ym, forced: bool = False) -> dict:
    blocks = await api.paginate("GET", f"/blocks/{parent_id}/children")
    total, count, kinds = 0.0, 0, set()
    last = _latest(*(b.get("last_edited_time") for b in blocks))
    section: tuple[int, int] | None = None  # month from the nearest month heading

    for b in blocks:
        t = b.get("type")
        if t in ("heading_1", "heading_2", "heading_3") or (t == "toggle" and b.get("has_children")):
            month = _month_heading(_plain(b[t].get("rich_text")))
            if b.get("has_children"):  # toggle heading / toggle holding that month's entries
                if month is None or month == ym or forced:
                    r = await _sum_blocks(api, b["id"], ym, forced=forced or month == ym)
                    total, count, last = total + r["total"], count + r["count"], _latest(last, r["last"])
                    kinds.update(k for k in r["method"].split(", ") if k != "nothing recognised")
                continue
            section = month
            continue
        if t == "child_database":
            r = await _sum_database(api, {"id": b["id"]}, ym)
            total, count, last = total + r["total"], count + r["count"], _latest(last, r["last"])
            kinds.add("database")
        elif t == "child_page":
            if _month_heading(b["child_page"].get("title", "")) == ym:
                r = await _sum_blocks(api, b["id"], ym, forced=True)
                total, count, last = total + r["total"], count + r["count"], _latest(last, r["last"])
                kinds.add("monthly page")
        elif t == "table":
            in_section = section is not None
            if in_section and section != ym and not forced:
                continue
            s, c, tl = await _sum_table(api, b, ym, forced or in_section)
            total, count, last = total + s, count + c, _latest(last, tl)
            kinds.add("table")
        elif t in TEXT_BLOCKS:
            rich = b[t].get("rich_text")
            text = _plain(rich)
            if not text or TOTAL_ROW.match(text):
                continue
            n = _amount_from_text(text)
            if not n:
                continue
            if not forced:
                d = _mention_date(rich) or _find_date(text)[0]
                if d is not None:
                    ok = _in_month(d, ym)
                elif section is not None:
                    ok = section == ym
                else:
                    ok = _in_month(_iso_to_local_date(b["created_time"]), ym)
                if not ok:
                    continue
            total += n
            count += 1
            kinds.add("text lines")

    return {"total": total, "count": count, "method": ", ".join(sorted(kinds)) or "nothing recognised", "last": last}


@ttl_cache(lambda: settings.cache_ttl_notion)
async def get_month_total() -> dict:
    if not settings.notion_token:
        raise NotionNotConfigured()
    now = _now()
    ym = (now.year, now.month)
    headers = {
        "Authorization": f"Bearer {settings.notion_token}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=15, headers=headers) as http:
        api = _Client(http)
        target = await _find_target(api)
        if not target:
            return {"configured": True, "found": False, "page": settings.notion_expenses_page}
        if target.get("object") == "database":
            result = await _sum_database(api, target, ym)
        else:
            result = await _sum_blocks(api, target["id"], ym)

    return {
        "configured": True,
        "found": True,
        "page": _title_of(target) or settings.notion_expenses_page,
        "url": target.get("url"),
        "month": now.strftime("%B %Y"),
        "total": round(result["total"], 2),
        "count": result["count"],
        "method": result["method"],
        # newest edit of any entry; the page's own timestamp doesn't change when rows are added
        "last_edited": _latest(target.get("last_edited_time"), result.get("last")),
    }
