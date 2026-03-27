"""
PDF Extractor — downloads municipal PDFs and extracts text for signal analysis.

Usage:
    from extractors.pdf_extractor import extract_text_from_url, process_pending_pdfs

    # Single PDF
    result = await extract_text_from_url("https://..../FileStream.ashx?...", city="Markham")

    # Batch: pull pending rows from Supabase, download + extract, update status
    results = await process_pending_pdfs(limit=20)
"""

from __future__ import annotations

import asyncio
import hashlib
import os
from pathlib import Path
from typing import List

import httpx
import pymupdf

from network_security import ALLOWED_PDF_HOSTS, PDF_REDIRECT_LIMIT, resolve_redirect_url, validate_pdf_url
from models.signals import PDFDocument, DocumentExtractionStatus, SourceType
from db.upsert import upsert_pdf_document, get_pending_pdfs

# ── config ──

DOWNLOAD_DIR = Path(os.environ.get("PDF_DOWNLOAD_DIR", "storage/pdfs"))
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

TEXT_CACHE_DIR = Path(os.environ.get("PDF_TEXT_CACHE_DIR", "storage/text_cache"))
TEXT_CACHE_DIR.mkdir(parents=True, exist_ok=True)

MAX_PDF_SIZE_MB = 50
DOWNLOAD_TIMEOUT = 60  # seconds
CHUNK_SIZE = 2000  # tokens ≈ chars for chunking


# ── helpers ──


def _url_hash(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:16]


def _safe_filename(url: str, city: str) -> str:
    h = _url_hash(url)
    return f"{city.lower().replace(' ', '_')}_{h}.pdf"


# ── core functions ──


def _fix_escribemeetings_url(url: str) -> str:
    """
    Fix escribemeetings.com PDF URLs.

    The meetings crawler produces URLs like:
      .../meetingscalendarview.aspx/FileStream.ashx?DocumentId=123
    But the server only serves the actual PDF at:
      .../FileStream.ashx?DocumentId=123
    The extra meetingscalendarview.aspx/ prefix causes the server to return HTML.
    """
    if "escribemeetings.com" in url and "meetingscalendarview.aspx/FileStream" in url:
        url = url.replace("meetingscalendarview.aspx/FileStream", "FileStream")
    return url


async def _fetch_pdf_response(url: str) -> tuple[str, httpx.Response]:
    current_url = validate_pdf_url(_fix_escribemeetings_url(url), allowed_hosts=ALLOWED_PDF_HOSTS)

    async with httpx.AsyncClient(follow_redirects=False, timeout=DOWNLOAD_TIMEOUT) as client:
        for _ in range(PDF_REDIRECT_LIMIT + 1):
            response = await client.get(current_url)
            if response.is_redirect:
                location = response.headers.get("location")
                if not location:
                    raise ValueError("PDF redirect response was missing a Location header")
                current_url = resolve_redirect_url(current_url, location, allowed_hosts=ALLOWED_PDF_HOSTS)
                continue

            response.raise_for_status()
            return current_url, response

    raise ValueError(f"PDF download exceeded the redirect limit ({PDF_REDIRECT_LIMIT})")


async def download_pdf(url: str, city: str) -> Path:
    """Download a PDF to local storage. Returns the local file path."""
    url = _fix_escribemeetings_url(url)
    filename = _safe_filename(url, city)
    dest = DOWNLOAD_DIR / filename

    # Use cached file only if it's a real PDF (starts with %PDF)
    if dest.exists() and dest.stat().st_size > 0:
        with open(dest, "rb") as f:
            header = f.read(4)
        if header == b"%PDF":
            return dest
        else:
            dest.unlink()  # Delete fake HTML file

    final_url, resp = await _fetch_pdf_response(url)
    declared_length = resp.headers.get("content-length")
    if declared_length:
        try:
            declared_length_int = int(declared_length)
        except ValueError:
            declared_length_int = None
        if declared_length_int and declared_length_int > MAX_PDF_SIZE_MB * 1024 * 1024:
            raise ValueError(
                f"PDF too large: {declared_length_int / 1024 / 1024:.1f}MB "
                f"(max {MAX_PDF_SIZE_MB}MB)"
            )

    content = resp.content
    content_length = len(content)
    if content_length > MAX_PDF_SIZE_MB * 1024 * 1024:
        raise ValueError(f"PDF too large: {content_length / 1024 / 1024:.1f}MB (max {MAX_PDF_SIZE_MB}MB)")

    # Validate it's actually a PDF
    if content[:4] != b"%PDF":
        raise ValueError(
            "Downloaded file is not a PDF "
            f"(got {content_length} bytes, content-type: {resp.headers.get('content-type', '?')}, "
            f"final-url: {final_url})"
        )

    dest.write_bytes(content)

    return dest


def _text_cache_path(pdf_path: Path) -> Path:
    """Get the .txt sidecar cache path for a given PDF."""
    return TEXT_CACHE_DIR / f"{pdf_path.stem}.txt"


def _page_count_cache_path(pdf_path: Path) -> Path:
    """Get the .pages cache path for a given PDF (stores page count)."""
    return TEXT_CACHE_DIR / f"{pdf_path.stem}.pages"


def extract_text(pdf_path: Path) -> tuple[str, int]:
    """
    Extract text from a local PDF. Returns (full_text, page_count).

    Uses a .txt sidecar cache file so repeated calls (download_and_extract,
    read_pdf_text, run_chunk_sweep) don't re-parse the PDF with PyMuPDF.
    """
    cache = _text_cache_path(pdf_path)
    pages_cache = _page_count_cache_path(pdf_path)

    # Return cached text if available and PDF hasn't changed
    if cache.exists() and pages_cache.exists():
        if cache.stat().st_mtime >= pdf_path.stat().st_mtime:
            return cache.read_text(encoding="utf-8"), int(pages_cache.read_text().strip())

    # Extract from PDF
    doc = pymupdf.open(str(pdf_path))
    page_count = len(doc)
    pages = []
    for page in doc:
        text = page.get_text()
        if text.strip():
            pages.append(text)
    doc.close()
    full_text = "\n\n".join(pages)

    # Write cache
    cache.write_text(full_text, encoding="utf-8")
    pages_cache.write_text(str(page_count))

    return full_text, page_count


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = 200) -> List[str]:
    """
    Split text into overlapping chunks for LLM analysis.
    Uses paragraph boundaries when possible.
    """
    if len(text) <= chunk_size:
        return [text]

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size

        # Try to break at a paragraph boundary
        if end < len(text):
            newline_pos = text.rfind("\n\n", start + chunk_size // 2, end)
            if newline_pos != -1:
                end = newline_pos + 2
            else:
                # Fall back to sentence boundary
                period_pos = text.rfind(". ", start + chunk_size // 2, end)
                if period_pos != -1:
                    end = period_pos + 2

        chunks.append(text[start:end].strip())
        start = end - overlap

    return [c for c in chunks if c]


def classify_source_type(document_type: str) -> SourceType:
    """Map the document_type string from meetings crawler to a SourceType."""
    dt = document_type.lower()
    if "minute" in dt:
        return SourceType.MEETING_MINUTES
    elif "agenda" in dt:
        return SourceType.AGENDA
    elif "budget" in dt:
        return SourceType.BUDGET
    elif "staff" in dt or "report" in dt:
        return SourceType.STAFF_REPORT
    elif "bylaw" in dt:
        return SourceType.BYLAW
    else:
        return SourceType.COMMITTEE_REPORT


# ── high-level pipeline ──


async def extract_text_from_url(
    url: str,
    city: str,
    source_type: SourceType = SourceType.MEETING_MINUTES,
) -> PDFDocument:
    """
    Download a PDF, extract text, update Supabase tracking.
    Returns the PDFDocument with status and metadata.
    """
    doc = PDFDocument(source_url=url, city=city, source_type=source_type)

    try:
        # Download
        doc.status = DocumentExtractionStatus.DOWNLOADING
        upsert_pdf_document(doc)

        local_path = await download_pdf(url, city)
        doc.local_path = str(local_path)

        # Extract text
        doc.status = DocumentExtractionStatus.EXTRACTING_TEXT
        upsert_pdf_document(doc)

        full_text, page_count = extract_text(local_path)
        doc.page_count = page_count
        doc.extracted_text_length = len(full_text)

        # Mark ready for analysis
        doc.status = DocumentExtractionStatus.ANALYZING
        upsert_pdf_document(doc)

    except Exception as e:
        doc.status = DocumentExtractionStatus.FAILED
        doc.error_message = str(e)[:500]
        upsert_pdf_document(doc)

    return doc


async def process_pending_pdfs(limit: int = 20) -> List[PDFDocument]:
    """
    Pull pending PDFs from Supabase, download + extract text for each.
    Returns list of updated PDFDocuments.
    """
    pending = get_pending_pdfs(limit=limit)
    if not pending:
        print("No pending PDFs to process.")
        return []

    print(f"Processing {len(pending)} pending PDFs...")

    tasks = []
    for row in pending:
        tasks.append(
            extract_text_from_url(
                url=row["source_url"],
                city=row["city"],
                source_type=SourceType(row["source_type"]),
            )
        )

    results = await asyncio.gather(*tasks, return_exceptions=True)

    docs = []
    for r in results:
        if isinstance(r, Exception):
            print(f"  ERROR: {r}")
        else:
            print(f"  {r.city} | {r.page_count or 0} pages | {r.status.value}")
            docs.append(r)

    return docs


def get_text_and_chunks(pdf_path: str | Path, chunk_size: int = CHUNK_SIZE) -> tuple[str, List[str]]:
    """
    Convenience: extract text and chunk it in one call.
    Used by the signal extractor.
    """
    full_text, _ = extract_text(Path(pdf_path))
    chunks = chunk_text(full_text, chunk_size=chunk_size)
    return full_text, chunks
