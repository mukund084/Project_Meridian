from __future__ import annotations

import os
import threading
import time
from collections import defaultdict, deque
from functools import wraps
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse

from db.supbase_client import get_supabase
from models.bids_and_tendors import BidsAndTenders
from models.meetings import Document
from models.signals import Signal, SignalCategory, PDFDocument


def _split_env_list(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name, "")
    if raw.strip():
        return [item.strip() for item in raw.split(",") if item.strip()]
    return default


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


APP_ENV = (os.getenv("APP_ENV") or os.getenv("ENVIRONMENT") or "development").strip().lower()
IS_PRODUCTION = APP_ENV in {"prod", "production"}
ENABLE_API_DOCS = _env_bool("ENABLE_API_DOCS", default=not IS_PRODUCTION)
IS_VERCEL = os.getenv("VERCEL") == "1"
VERCEL_URL = os.getenv("VERCEL_URL", "").strip()

default_allowed_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
if IS_VERCEL and "ALLOWED_ORIGINS" not in os.environ:
    # Demo-friendly default for separate Vercel frontend/backend previews.
    default_allowed_origins = ["*"]
ALLOWED_ORIGINS = _split_env_list("ALLOWED_ORIGINS", default_allowed_origins)

DEFAULT_ALLOWED_HOSTS = [] if IS_PRODUCTION else ["localhost", "127.0.0.1", "::1", "testserver"]
if IS_VERCEL:
    DEFAULT_ALLOWED_HOSTS = ["*.vercel.app"]
    if VERCEL_URL:
        DEFAULT_ALLOWED_HOSTS.append(VERCEL_URL)
ALLOWED_HOSTS = _split_env_list("ALLOWED_HOSTS", DEFAULT_ALLOWED_HOSTS)
if IS_PRODUCTION and not ALLOWED_HOSTS:
    raise RuntimeError("ALLOWED_HOSTS must be configured when APP_ENV=production")

RATE_LIMIT_ENABLED = _env_bool("RATE_LIMIT_ENABLED", default=True)
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "120"))
EXPENSIVE_RATE_LIMIT_REQUESTS = int(os.getenv("EXPENSIVE_RATE_LIMIT_REQUESTS", "20"))
EXPENSIVE_PUBLIC_PATHS = {
    "/accounts",
    "/bids/closing-soon",
    "/bids/stats",
    "/cities",
    "/meetings/stats",
    "/signals/pipeline",
    "/signals/stats",
}
_RATE_LIMIT_STATE: dict[tuple[str, str], deque[float]] = defaultdict(deque)
_RATE_LIMIT_LOCK = threading.Lock()

app = FastAPI(
    title="Meridian API",
    description="NorthSignal — Canadian municipal procurement intelligence",
    version="0.2.0",
    docs_url="/docs" if ENABLE_API_DOCS else None,
    redoc_url="/redoc" if ENABLE_API_DOCS else None,
    openapi_url="/openapi.json" if ENABLE_API_DOCS else None,
)

BID_PUBLIC_COLUMNS = ",".join(
    [
        "bid_name",
        "bid_status",
        "bid_closing_date",
        "bid_url",
        "city",
        "year",
        "days_left",
        "bid_classification",
        "bid_type",
        "bid_number",
        "published_date",
        "description",
        "categories",
        "purchasing_representive",
        "bids_submitted",
        "plan_takers",
    ]
)
MEETING_PUBLIC_COLUMNS = ",".join(
    ["meeting_title", "meeting_date", "document_type", "pdf_url", "city", "year"]
)
SIGNAL_PUBLIC_COLUMNS = ",".join(
    [
        "source_type",
        "source_url",
        "city",
        "signal_type",
        "signal_category",
        "confidence",
        "score",
        "summary",
        "raw_excerpt",
        "estimated_value",
        "estimated_timeline",
        "procurement_stage",
        "extracted_at",
        "year",
    ]
)
PDF_PUBLIC_COLUMNS = ",".join(
    [
        "source_url",
        "city",
        "source_type",
        "status",
        "page_count",
        "signals_extracted",
        "created_at",
        "year",
    ]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials="*" not in ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(TrustedHostMiddleware, allowed_hosts=ALLOWED_HOSTS)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    rate_limit = None
    rate_remaining = None

    if RATE_LIMIT_ENABLED and request.method == "GET":
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path
        bucket = path if path in EXPENSIVE_PUBLIC_PATHS else "default"
        rate_limit = EXPENSIVE_RATE_LIMIT_REQUESTS if bucket != "default" else RATE_LIMIT_REQUESTS
        now = time.time()

        with _RATE_LIMIT_LOCK:
            history = _RATE_LIMIT_STATE[(client_ip, bucket)]
            while history and now - history[0] >= RATE_LIMIT_WINDOW_SECONDS:
                history.popleft()
            if len(history) >= rate_limit:
                retry_after = max(1, int(RATE_LIMIT_WINDOW_SECONDS - (now - history[0])))
                response = JSONResponse(
                    status_code=429,
                    content={"detail": "Rate limit exceeded"},
                    headers={"Retry-After": str(retry_after)},
                )
                response.headers.setdefault("X-Content-Type-Options", "nosniff")
                response.headers.setdefault("X-Frame-Options", "DENY")
                response.headers.setdefault("Referrer-Policy", "same-origin")
                response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
                response.headers.setdefault("X-RateLimit-Limit", str(rate_limit))
                response.headers.setdefault("X-RateLimit-Remaining", "0")
                response.headers.setdefault("X-RateLimit-Window", str(RATE_LIMIT_WINDOW_SECONDS))
                return response
            history.append(now)
            rate_remaining = max(rate_limit - len(history), 0)

    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "same-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    if rate_limit is not None and rate_remaining is not None:
        response.headers.setdefault("X-RateLimit-Limit", str(rate_limit))
        response.headers.setdefault("X-RateLimit-Remaining", str(rate_remaining))
        response.headers.setdefault("X-RateLimit-Window", str(RATE_LIMIT_WINDOW_SECONDS))
    return response


# ── Helpers ──

def ttl_cache(maxsize: int = 128, ttl: int = 300):
    cache = {}
    
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            key = (args, frozenset(kwargs.items()))
            now = time.time()
            if key in cache:
                val, timestamp = cache[key]
                if now - timestamp < ttl:
                    return val
            if len(cache) >= maxsize:
                cache.clear()
            val = func(*args, **kwargs)
            cache[key] = (val, now)
            return val
        return wrapper
    return decorator

def fetch_all(query, page_size: int = 1000) -> list[dict]:
    """Paginate through a Supabase query to bypass the default 1 000-row cap."""
    all_rows: list[dict] = []
    offset = 0
    while True:
        page = query.range(offset, offset + page_size - 1).execute().data
        all_rows.extend(page)
        if len(page) < page_size:
            break
        offset += page_size
    return all_rows


# ── Health ──

@app.get("/health")
def health():
    return {"status": "ok"}


# ── Bids ──

@app.get("/bids", response_model=list[dict])
def list_bids(
    city: Optional[str] = Query(None, description="Filter by city name"),
    status: Optional[str] = Query(None, description="Filter by bid status"),
    year: Optional[int] = Query(None, description="Filter by year"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    query = get_supabase().table("bids").select(BID_PUBLIC_COLUMNS)
    if city:
        query = query.eq("city", city)
    if status:
        query = query.eq("bid_status", status)
    if year:
        query = query.eq("year", year)
    query = query.order("bid_closing_date", desc=True).range(offset, offset + limit - 1)
    return query.execute().data


@app.get("/bids/stats")
@ttl_cache(ttl=300)
def bid_stats(
    city: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
):
    sb = get_supabase()
    q = sb.table("bids").select("city, bid_status")
    if city:
        q = q.eq("city", city)
    if status:
        q = q.eq("bid_status", status)
    if year:
        q = q.eq("year", year)
    
    rows = fetch_all(q)
    total = len(rows)
    open_count = sum(1 for r in rows if "open" in (r.get("bid_status") or "").lower())
    municipalities = len(set(r.get("city") for r in rows if r.get("city")))
    
    return {"total": total, "open": open_count, "municipalities": municipalities}


@app.get("/bids/{bid_number}")
def get_bid(bid_number: str):
    data = (
        get_supabase()
        .table("bids")
        .select(BID_PUBLIC_COLUMNS)
        .eq("bid_number", bid_number)
        .execute()
        .data
    )
    if not data:
        raise HTTPException(status_code=404, detail="Bid not found")
    return data[0]


# ── Meetings ──

@app.get("/meetings/stats")
@ttl_cache(ttl=300)
def meeting_stats(year: Optional[int] = Query(None)):
    sb = get_supabase()
    meetings_q = sb.table("meetings").select("id")
    docs_q = sb.table("pdf_documents").select("status")
    
    if year:
        meetings_q = meetings_q.eq("year", year)
        docs_q = docs_q.eq("year", year)
        
    meetings = fetch_all(meetings_q)
    docs = fetch_all(docs_q)
    
    total_meetings = len(meetings)
    total_docs = len(docs)
    completed_docs = sum(1 for d in docs if d.get("status") == "completed")
    
    return {
        "total_meetings": total_meetings,
        "total_docs": total_docs,
        "completed_docs": completed_docs
    }

@app.get("/meetings", response_model=list[dict])
def list_meetings(
    city: Optional[str] = Query(None, description="Filter by city name"),
    document_type: Optional[str] = Query(None, description="Filter by document type"),
    year: Optional[int] = Query(None, description="Filter by year"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    query = get_supabase().table("meetings").select(MEETING_PUBLIC_COLUMNS)
    if city:
        query = query.eq("city", city)
    if document_type:
        query = query.eq("document_type", document_type)
    if year:
        query = query.eq("year", year)
    query = query.order("meeting_date", desc=True).range(offset, offset + limit - 1)
    return query.execute().data


# ── Signals ──

@app.get("/signals", response_model=list[dict])
def list_signals(
    city: Optional[str] = Query(None, description="Filter by city"),
    category: Optional[SignalCategory] = Query(None, description="Filter by signal category"),
    year: Optional[int] = Query(None, description="Filter by year"),
    min_confidence: float = Query(0.0, ge=0.0, le=1.0),
    min_score: float = Query(0.0, ge=0.0, le=1.0),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    query = get_supabase().table("signals").select(SIGNAL_PUBLIC_COLUMNS)
    if city:
        query = query.eq("city", city)
    if category:
        query = query.eq("signal_category", category.value)
    if year:
        query = query.eq("year", year)
    if min_confidence > 0:
        query = query.gte("confidence", min_confidence)
    if min_score > 0:
        query = query.gte("score", min_score)
    query = query.order("score", desc=True).range(offset, offset + limit - 1)
    return query.execute().data


@app.get("/signals/categories")
def list_signal_categories():
    return [{"value": c.value, "label": c.value.replace("_", " ").title()} for c in SignalCategory]


@app.get("/signals/pipeline")
@ttl_cache(ttl=300)
def signal_pipeline(city: Optional[str] = Query(None), year: Optional[int] = Query(None)):
    """Signal counts grouped by procurement stage for funnel visualization."""
    query = get_supabase().table("signals").select("procurement_stage, score, confidence")
    if city:
        query = query.eq("city", city)
    if year:
        query = query.eq("year", year)
    rows = fetch_all(query)

    by_stage: dict[str, dict] = {}
    for r in rows:
        stage = r.get("procurement_stage") or "unknown"
        if stage not in by_stage:
            by_stage[stage] = {"count": 0, "total_score": 0.0, "total_confidence": 0.0}
        by_stage[stage]["count"] += 1
        by_stage[stage]["total_score"] += r.get("score", 0)
        by_stage[stage]["total_confidence"] += r.get("confidence", 0)

    # Ordered by procurement lifecycle
    stage_order = [
        "needs_identified", "study_authorized", "budget_allocated",
        "market_research", "specification_development", "rfp_imminent",
        "rfp_published", "evaluation_in_progress", "shortlisted",
        "negotiation", "awarded", "contract_execution", "in_progress", "closeout",
    ]

    result = []
    for stage in stage_order:
        vals = by_stage.get(stage, {"count": 0, "total_score": 0.0, "total_confidence": 0.0})
        n = vals["count"]
        result.append({
            "stage": stage,
            "label": stage.replace("_", " ").title(),
            "count": n,
            "avg_score": round(vals["total_score"] / n, 3) if n else 0,
            "avg_confidence": round(vals["total_confidence"] / n, 3) if n else 0,
        })

    # Add unknown if present
    if "unknown" in by_stage:
        vals = by_stage["unknown"]
        n = vals["count"]
        result.append({
            "stage": "unknown",
            "label": "Unclassified",
            "count": n,
            "avg_score": round(vals["total_score"] / n, 3) if n else 0,
            "avg_confidence": round(vals["total_confidence"] / n, 3) if n else 0,
        })

    return result


@app.get("/signals/stats")
@ttl_cache(ttl=300)
def signal_stats(
    city: Optional[str] = Query(None), 
    year: Optional[int] = Query(None),
    min_confidence: float = Query(0.0, ge=0.0, le=1.0)
):
    query = get_supabase().table("signals").select("signal_category, score, confidence")
    if city:
        query = query.eq("city", city)
    if year:
        query = query.eq("year", year)
    if min_confidence > 0:
        query = query.gte("confidence", min_confidence)
    rows = fetch_all(query)

    by_category: dict[str, dict] = {}
    for r in rows:
        cat = r.get("signal_category", "unknown")
        if cat not in by_category:
            by_category[cat] = {"count": 0, "high_confidence_count": 0, "total_score": 0.0, "total_confidence": 0.0}
        by_category[cat]["count"] += 1
        if r.get("confidence", 0) >= 0.7:
            by_category[cat]["high_confidence_count"] += 1
        by_category[cat]["total_score"] += r.get("score", 0)
        by_category[cat]["total_confidence"] += r.get("confidence", 0)

    stats = []
    for cat, vals in by_category.items():
        n = vals["count"]
        stats.append({
            "category": cat,
            "count": n,
            "high_confidence_count": vals["high_confidence_count"],
            "avg_score": round(vals["total_score"] / n, 3) if n else 0,
            "avg_confidence": round(vals["total_confidence"] / n, 3) if n else 0,
        })
    stats.sort(key=lambda x: x["avg_score"], reverse=True)
    return stats


# ── PDF Documents ──

@app.get("/pdf-documents", response_model=list[dict])
def list_pdf_documents(
    city: Optional[str] = Query(None),
    status: Optional[str] = Query(None, description="Filter by extraction status"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    query = get_supabase().table("pdf_documents").select(PDF_PUBLIC_COLUMNS)
    if city:
        query = query.eq("city", city)
    if status:
        query = query.eq("status", status)
    query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
    return query.execute().data


# ── Cities ──

@app.get("/cities")
@ttl_cache(ttl=300)
def list_cities(year: Optional[int] = Query(None)):
    sb = get_supabase()
    bids_q = sb.table("bids").select("city")
    signals_q = sb.table("signals").select("city")
    if year:
        bids_q = bids_q.eq("year", year)
        signals_q = signals_q.eq("year", year)
    bid_rows = fetch_all(bids_q)
    signal_rows = fetch_all(signals_q)
    cities = sorted({r["city"] for r in (bid_rows + signal_rows) if r.get("city")})
    return cities


# ── Accounts (City/Agency Profiles) ──

@app.get("/accounts")
@ttl_cache(ttl=300)
def list_accounts(year: Optional[int] = Query(None, description="Filter by year")):
    """Aggregated stats per city across all tables."""
    sb = get_supabase()
    bids_q = sb.table("bids").select("city, bid_status")
    signals_q = sb.table("signals").select("city, score, confidence")
    meetings_q = sb.table("meetings").select("city")
    docs_q = sb.table("pdf_documents").select("city, status, signals_extracted")
    if year:
        bids_q = bids_q.eq("year", year)
        signals_q = signals_q.eq("year", year)
        meetings_q = meetings_q.eq("year", year)
        docs_q = docs_q.eq("year", year)
    bids = fetch_all(bids_q)
    signals = fetch_all(signals_q)
    meetings = fetch_all(meetings_q)
    docs = fetch_all(docs_q)

    cities: dict[str, dict] = {}

    for b in bids:
        c = b.get("city", "")
        if not c:
            continue
        if c not in cities:
            cities[c] = {"city": c, "total_bids": 0, "open_bids": 0, "total_signals": 0,
                         "avg_score": 0.0, "total_meetings": 0, "total_docs": 0,
                         "signals_extracted": 0, "_scores": []}
        cities[c]["total_bids"] += 1
        if "open" in (b.get("bid_status") or "").lower():
            cities[c]["open_bids"] += 1

    for s in signals:
        c = s.get("city", "")
        if not c:
            continue
        if c not in cities:
            cities[c] = {"city": c, "total_bids": 0, "open_bids": 0, "total_signals": 0,
                         "avg_score": 0.0, "total_meetings": 0, "total_docs": 0,
                         "signals_extracted": 0, "_scores": []}
        cities[c]["total_signals"] += 1
        cities[c]["_scores"].append(s.get("score", 0))

    for m in meetings:
        c = m.get("city", "")
        if not c:
            continue
        if c not in cities:
            cities[c] = {"city": c, "total_bids": 0, "open_bids": 0, "total_signals": 0,
                         "avg_score": 0.0, "total_meetings": 0, "total_docs": 0,
                         "signals_extracted": 0, "_scores": []}
        cities[c]["total_meetings"] += 1

    for d in docs:
        c = d.get("city", "")
        if not c:
            continue
        if c not in cities:
            cities[c] = {"city": c, "total_bids": 0, "open_bids": 0, "total_signals": 0,
                         "avg_score": 0.0, "total_meetings": 0, "total_docs": 0,
                         "signals_extracted": 0, "_scores": []}
        cities[c]["total_docs"] += 1
        cities[c]["signals_extracted"] += d.get("signals_extracted", 0)

    result = []
    for c, data in cities.items():
        scores = data.pop("_scores")
        data["avg_score"] = round(sum(scores) / len(scores), 3) if scores else 0.0
        result.append(data)

    result.sort(key=lambda x: x["total_signals"], reverse=True)
    return result


@app.get("/accounts/{city}")
def get_account(city: str):
    """Detailed profile for a single city/agency."""
    sb = get_supabase()
    bids = sb.table("bids").select(BID_PUBLIC_COLUMNS).eq("city", city).order("bid_closing_date", desc=True).limit(50).execute().data
    signals = sb.table("signals").select(SIGNAL_PUBLIC_COLUMNS).eq("city", city).order("score", desc=True).limit(50).execute().data
    meetings = sb.table("meetings").select(MEETING_PUBLIC_COLUMNS).eq("city", city).order("meeting_date", desc=True).limit(50).execute().data
    docs = sb.table("pdf_documents").select(PDF_PUBLIC_COLUMNS).eq("city", city).order("created_at", desc=True).limit(50).execute().data

    # Extract contacts from bids
    contacts = []
    seen = set()
    for b in bids:
        rep = b.get("purchasing_representive")
        if rep and isinstance(rep, dict) and rep.get("name"):
            key = rep["name"].lower()
            if key not in seen:
                seen.add(key)
                contacts.append(rep)

    open_bids = [b for b in bids if "open" in (b.get("bid_status") or "").lower()]
    scores = [s.get("score", 0) for s in signals]

    return {
        "city": city,
        "summary": {
            "total_bids": len(bids),
            "open_bids": len(open_bids),
            "total_signals": len(signals),
            "avg_score": round(sum(scores) / len(scores), 3) if scores else 0.0,
            "total_meetings": len(meetings),
            "total_docs": len(docs),
            "contacts_found": len(contacts),
        },
        "bids": bids,
        "signals": signals,
        "meetings": meetings,
        "documents": docs,
        "contacts": contacts,
    }


# ── Search ──

@app.get("/search")
def global_search(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(20, ge=1, le=100),
):
    """Search across bids, signals, and meetings."""
    sb = get_supabase()
    results = []

    # Search bids by name
    bids = sb.table("bids").select("bid_name, bid_status, city, bid_url, bid_closing_date").ilike("bid_name", f"%{q}%").limit(limit).execute().data
    for b in bids:
        results.append({"type": "bid", "title": b["bid_name"], "city": b.get("city", ""),
                        "url": b.get("bid_url", ""), "meta": b.get("bid_status", "")})

    # Search signals by summary
    sigs = sb.table("signals").select("summary, signal_category, city, source_url, score").ilike("summary", f"%{q}%").limit(limit).execute().data
    for s in sigs:
        results.append({"type": "signal", "title": s["summary"], "city": s.get("city", ""),
                        "url": s.get("source_url", ""), "meta": s.get("signal_category", ""),
                        "score": s.get("score", 0)})

    # Search meetings by title
    mtgs = sb.table("meetings").select("meeting_title, city, meeting_date, pdf_url").ilike("meeting_title", f"%{q}%").limit(limit).execute().data
    for m in mtgs:
        results.append({"type": "meeting", "title": m["meeting_title"], "city": m.get("city", ""),
                        "url": m.get("pdf_url", ""), "meta": m.get("meeting_date", "")})

    return results


# ── Bids Closing Soon ──

def _parse_bid_date(raw: str) -> "datetime | None":
    """Parse human-readable bid closing dates like 'Fri Apr 10, 2026 2:00 PM (EDT)'."""
    from datetime import datetime
    import re
    if not raw:
        return None
    cleaned = re.sub(r"\(.*?\)", "", raw).strip()
    cleaned = re.sub(r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+", "", cleaned, flags=re.IGNORECASE)
    for fmt in (
        "%b %d, %Y %I:%M:%S %p",
        "%b %d, %Y %I:%M %p",
        "%B %d, %Y %I:%M:%S %p",
        "%B %d, %Y %I:%M %p",
        "%b %d, %Y",
        "%Y-%m-%d",
    ):
        try:
            return datetime.strptime(cleaned, fmt)
        except ValueError:
            continue
    return None


def _format_bid_countdown(parsed: "datetime", now: "datetime") -> str:
    """Return a short time-left label for urgency UI."""
    import math

    remaining_seconds = max((parsed - now).total_seconds(), 0)
    remaining_hours = max(math.ceil(remaining_seconds / 3600), 1)
    remaining_days = max(math.ceil(remaining_seconds / 86400), 1)

    if remaining_hours <= 24:
        return f"{remaining_hours}h left"
    return f"{remaining_days}d left"


def _bid_urgency_level(parsed: "datetime", now: "datetime") -> str:
    import math

    remaining_days = max(math.ceil((parsed - now).total_seconds() / 86400), 0)
    if remaining_days <= 3:
        return "critical"
    if remaining_days <= 7:
        return "high"
    return "medium"


@app.get("/bids/closing-soon")
@ttl_cache(ttl=300)
def bids_closing_soon(
    days: int = Query(90, ge=1, le=365, description="Bids closing within N days"),
    city: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    """Open bids with closing dates in the near future."""
    from datetime import datetime, timedelta
    import math

    now = datetime.utcnow()
    cutoff = now + timedelta(days=days)

    query = get_supabase().table("bids").select(BID_PUBLIC_COLUMNS)
    if city:
        query = query.eq("city", city)
    if year:
        query = query.eq("year", year)
    rows = fetch_all(query)

    results = []
    for row in rows:
        if "open" not in (row.get("bid_status") or "").lower():
            continue

        parsed = _parse_bid_date(row.get("bid_closing_date", ""))
        if parsed and now <= parsed <= cutoff:
            row["_parsed_date"] = parsed.isoformat()
            row["closing_at_iso"] = parsed.isoformat()
            row["days_until_close"] = max(math.ceil((parsed - now).total_seconds() / 86400), 0)
            row["days_left"] = _format_bid_countdown(parsed, now)
            row["urgency_level"] = _bid_urgency_level(parsed, now)
            results.append(row)

    results.sort(key=lambda r: r["_parsed_date"])
    for r in results:
        r.pop("_parsed_date", None)

    return results[:limit]
