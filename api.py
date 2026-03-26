from __future__ import annotations

from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from db.supbase_client import get_supabase
from models.bids_and_tendors import BidsAndTenders
from models.meetings import Document
from models.signals import Signal, SignalCategory, PDFDocument

app = FastAPI(
    title="Crawling Agent API",
    description="Municipal public-sector data — bids, tenders, meetings, and signals",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ──

@app.get("/health")
def health():
    return {"status": "ok"}


# ── Bids ──

@app.get("/bids", response_model=list[dict])
def list_bids(
    city: Optional[str] = Query(None, description="Filter by city name"),
    status: Optional[str] = Query(None, description="Filter by bid status"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    query = get_supabase().table("bids").select("*")
    if city:
        query = query.eq("city", city)
    if status:
        query = query.eq("bid_status", status)
    query = query.order("bid_closing_date", desc=True).range(offset, offset + limit - 1)
    return query.execute().data


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

@app.get("/meetings", response_model=list[dict])
def list_meetings(
    city: Optional[str] = Query(None, description="Filter by city name"),
    document_type: Optional[str] = Query(None, description="Filter by document type (e.g. Agenda, Minutes)"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    query = get_supabase().table("meetings").select("*")
    if city:
        query = query.eq("city", city)
    if document_type:
        query = query.eq("document_type", document_type)
    query = query.order("meeting_date", desc=True).range(offset, offset + limit - 1)
    return query.execute().data


# ── Signals ──

@app.get("/signals", response_model=list[dict])
def list_signals(
    city: Optional[str] = Query(None, description="Filter by city"),
    category: Optional[SignalCategory] = Query(None, description="Filter by signal category"),
    min_confidence: float = Query(0.0, ge=0.0, le=1.0, description="Minimum confidence threshold"),
    min_score: float = Query(0.0, ge=0.0, le=1.0, description="Minimum signal score"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    query = get_supabase().table("signals").select("*")
    if city:
        query = query.eq("city", city)
    if category:
        query = query.eq("signal_category", category.value)
    if min_confidence > 0:
        query = query.gte("confidence", min_confidence)
    if min_score > 0:
        query = query.gte("score", min_score)
    query = query.order("score", desc=True).range(offset, offset + limit - 1)
    return query.execute().data


@app.get("/signals/categories")
def list_signal_categories():
    return [{"value": c.value, "label": c.value.replace("_", " ").title()} for c in SignalCategory]


@app.get("/signals/stats")
def signal_stats(city: Optional[str] = Query(None)):
    query = get_supabase().table("signals").select("signal_category, score, confidence")
    if city:
        query = query.eq("city", city)
    rows = query.execute().data

    by_category: dict[str, dict] = {}
    for r in rows:
        cat = r.get("signal_category", "unknown")
        if cat not in by_category:
            by_category[cat] = {"count": 0, "total_score": 0.0, "total_confidence": 0.0}
        by_category[cat]["count"] += 1
        by_category[cat]["total_score"] += r.get("score", 0)
        by_category[cat]["total_confidence"] += r.get("confidence", 0)

    stats = []
    for cat, vals in by_category.items():
        n = vals["count"]
        stats.append({
            "category": cat,
            "count": n,
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
def list_cities():
    """Return distinct cities from the bids table."""
    rows = get_supabase().table("bids").select("city").execute().data
    cities = sorted({r["city"] for r in rows if r.get("city")})
    return cities
