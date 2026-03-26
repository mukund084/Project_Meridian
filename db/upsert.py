from __future__ import annotations
from typing import List

from db.supbase_client import get_supabase
from models.bids_and_tendors import BidsAndTenders
from models.meetings import Document
from models.signals import Signal, PDFDocument


# ── helpers ──

def _serialize(model, exclude_none: bool = True) -> dict:
    data = model.model_dump(exclude_none=exclude_none)
    # Convert datetime objects to ISO strings for Supabase
    for k, v in data.items():
        if hasattr(v, "isoformat"):
            data[k] = v.isoformat()
    return data


def _batch(items: list, size: int = 500):
    for i in range(0, len(items), size):
        yield items[i : i + size]


# ── bids ──

def upsert_bid(bid: BidsAndTenders, city: str = "") -> dict:
    data = _serialize(bid)
    if city:
        data["city"] = city
    return (
        get_supabase()
        .table("bids")
        .upsert(data, on_conflict="bid_url")
        .execute()
    )


def upsert_bids(bids: List[BidsAndTenders], city: str = "") -> List[dict]:
    results = []
    rows = []
    for b in bids:
        d = _serialize(b)
        if city:
            d["city"] = city
        rows.append(d)
    for chunk in _batch(rows):
        res = (
            get_supabase()
            .table("bids")
            .upsert(chunk, on_conflict="bid_url")
            .execute()
        )
        results.append(res)
    return results


# ── meetings ──

def upsert_meeting(doc: Document, city: str = "") -> dict:
    data = _serialize(doc)
    if city:
        data["city"] = city
    return (
        get_supabase()
        .table("meetings")
        .upsert(data, on_conflict="pdf_url")
        .execute()
    )


def upsert_meetings(docs: List[Document], city: str = "") -> List[dict]:
    results = []
    rows = []
    for d in docs:
        row = _serialize(d)
        if city:
            row["city"] = city
        rows.append(row)
    for chunk in _batch(rows):
        res = (
            get_supabase()
            .table("meetings")
            .upsert(chunk, on_conflict="pdf_url")
            .execute()
        )
        results.append(res)
    return results


# ── signals ──

def upsert_signal(signal: Signal) -> dict:
    data = _serialize(signal)
    # Flatten nested entities to JSONB
    if "entities" in data:
        data["entities"] = [
            e if isinstance(e, dict) else e for e in data["entities"]
        ]
    return (
        get_supabase()
        .table("signals")
        .upsert(data, on_conflict="source_url,signal_type,raw_excerpt")
        .execute()
    )


def upsert_signals(signals: List[Signal]) -> List[dict]:
    results = []
    rows = []
    seen_keys = set()
    for s in signals:
        data = _serialize(s)
        if "entities" in data:
            data["entities"] = [
                e if isinstance(e, dict) else e for e in data["entities"]
            ]
        # Deduplicate within the batch to avoid Supabase ON CONFLICT error
        dedup_key = (data.get("source_url", ""), data.get("signal_type", ""), data.get("raw_excerpt", "")[:300])
        if dedup_key in seen_keys:
            continue
        seen_keys.add(dedup_key)
        rows.append(data)
    for chunk in _batch(rows):
        res = (
            get_supabase()
            .table("signals")
            .upsert(chunk, on_conflict="source_url,signal_type,raw_excerpt")
            .execute()
        )
        results.append(res)
    return results


# ── pdf_documents ──

def upsert_pdf_document(doc: PDFDocument) -> dict:
    data = _serialize(doc)
    return (
        get_supabase()
        .table("pdf_documents")
        .upsert(data, on_conflict="source_url")
        .execute()
    )


def upsert_pdf_documents(docs: List[PDFDocument]) -> List[dict]:
    results = []
    rows = [_serialize(d) for d in docs]
    for chunk in _batch(rows):
        res = (
            get_supabase()
            .table("pdf_documents")
            .upsert(chunk, on_conflict="source_url")
            .execute()
        )
        results.append(res)
    return results


# ── queries ──

def get_pending_pdfs(limit: int = 50) -> list:
    return (
        get_supabase()
        .table("pdf_documents")
        .select("*")
        .eq("status", "pending")
        .limit(limit)
        .execute()
        .data
    )


def get_signals_by_city(city: str) -> list:
    return (
        get_supabase()
        .table("signals")
        .select("*")
        .eq("city", city)
        .order("confidence", desc=True)
        .execute()
        .data
    )


def get_signals_by_category(category: str, min_confidence: float = 0.0) -> list:
    return (
        get_supabase()
        .table("signals")
        .select("*")
        .eq("signal_category", category)
        .gte("confidence", min_confidence)
        .order("confidence", desc=True)
        .execute()
        .data
    )
