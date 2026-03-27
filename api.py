from __future__ import annotations

from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from db.supbase_client import get_supabase
from models.bids_and_tendors import BidsAndTenders
from models.meetings import Document
from models.signals import Signal, SignalCategory, PDFDocument

app = FastAPI(
    title="Meridian API",
    description="NorthSignal — Canadian municipal procurement intelligence",
    version="0.2.0",
)

import time
from functools import wraps

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    query = get_supabase().table("bids").select("*")
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
        .select("*")
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
    query = get_supabase().table("meetings").select("*")
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
    query = get_supabase().table("signals").select("*")
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
    query = get_supabase().table("pdf_documents").select("*")
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
    bids = sb.table("bids").select("*").eq("city", city).order("bid_closing_date", desc=True).limit(50).execute().data
    signals = sb.table("signals").select("*").eq("city", city).order("score", desc=True).limit(50).execute().data
    meetings = sb.table("meetings").select("*").eq("city", city).order("meeting_date", desc=True).limit(50).execute().data
    docs = sb.table("pdf_documents").select("*").eq("city", city).order("created_at", desc=True).limit(50).execute().data

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


# ── Contracts Expiring ──

@app.get("/contracts/expiring")
def expiring_contracts(
    days: int = Query(90, ge=1, le=365, description="Contracts expiring within N days"),
    city: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    """Bids with closing dates in the near future — proxy for contract expiration."""
    from datetime import datetime, timedelta
    cutoff = (datetime.utcnow() + timedelta(days=days)).strftime("%Y-%m-%d")
    today = datetime.utcnow().strftime("%Y-%m-%d")

    query = get_supabase().table("bids").select("*")
    query = query.gte("bid_closing_date", today).lte("bid_closing_date", cutoff)
    if city:
        query = query.eq("city", city)
    query = query.order("bid_closing_date", desc=False).limit(limit)
    return query.execute().data
