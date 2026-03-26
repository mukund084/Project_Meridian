"""
Signal Extraction Pipeline
==========================

Two SubAgents that work in sequence:

1. pdf-text-extractor-agent
   - Model: non-reasoning (just coordinates download/extract calls)
   - Tools: download_pdf, extract_text → dumb I/O, no AI inside
   - Job: download PDFs, extract text, track status in Supabase

2. signal-analyzer-agent
   - Model: grok-4-1-fast-reasoning ← THIS IS THE BRAIN
   - Tools: read_pdf_text, save_signals, run_chunk_sweep → I/O helpers
   - Job: the agent's OWN model reads the text and extracts signals
   - For chunks, run_chunk_sweep does a batch pipeline (non-reasoning per chunk)

WHY THIS DESIGN:
- The agent's model IS the AI. Tools are just I/O.
- Pass 1 (full doc): The agent reads text via tool → thinks → returns signals
- Pass 2 (chunks): run_chunk_sweep is a batch pipeline tool that catches
  explicit signals the reasoning model may have summarized over
- No wasted model calls. Every LLM call does real work.

HOW IT FLOWS:
  orchestrator
    → pdf-text-extractor-agent
        → download_pdf(url) → local path
        → extract_text(path) → text + metadata
        → track_pdf(doc) → Supabase
    → signal-analyzer-agent
        → read_pdf_text(path) → agent SEES the text
        → agent's OWN reasoning model extracts signals
        → save_signals(signals) → Supabase
        → run_chunk_sweep(path) → catches missed explicit signals
"""

from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv())

import asyncio
import json
from pathlib import Path
from typing import List, Optional

import nest_asyncio
nest_asyncio.apply()

from xai_sdk import Client as XAIClient
from xai_sdk.chat import system, user
from pydantic import BaseModel, Field
from deepagents import SubAgent

from extractors.pdf_extractor import (
    download_pdf,
    extract_text,
    chunk_text,
    classify_source_type,
)
from models.signals import (
    Signal,
    SignalCategory,
    SignalType,
    SourceType,
    ProcurementStage,
    Entity,
    PDFDocument,
    DocumentExtractionStatus,
)
from db.upsert import upsert_signals, upsert_pdf_document


def _run_async(coro):
    """Safely run an async coroutine from sync context (handles nested event loops)."""
    try:
        loop = asyncio.get_running_loop()
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


# xAI client — used ONLY by run_chunk_sweep (batch pipeline)
_xai = XAIClient()


# ═══════════════════════════════════════════════════════════════
#  Pydantic models for structured xAI output
# ═══════════════════════════════════════════════════════════════


class ExtractedEntity(BaseModel):
    name: str
    entity_type: str  # person, organization, dollar_amount, date, project, contract_number
    role: Optional[str] = None


class ExtractedSignal(BaseModel):
    signal_type: str
    signal_category: str
    confidence: float = Field(ge=0.0, le=1.0)
    summary: str
    raw_excerpt: str = Field(max_length=300)
    entities: List[ExtractedEntity] = Field(default_factory=list)
    procurement_stage: Optional[str] = None
    estimated_value: Optional[float] = None
    estimated_timeline: Optional[str] = None
    related_bid_number: Optional[str] = None


class SignalExtractionResponse(BaseModel):
    signals: List[ExtractedSignal]


# ═══════════════════════════════════════════════════════════════
#  Shared helpers
# ═══════════════════════════════════════════════════════════════

SIGNAL_CATEGORIES = [c.value for c in SignalCategory]
SIGNAL_TYPES = [t.value for t in SignalType]
PROCUREMENT_STAGES = [p.value for p in ProcurementStage]

# Build a grouped taxonomy so the model sees which types belong to which category.
# This prevents the model from putting a signal_type value in the signal_category field.
_CATEGORY_TO_TYPES: dict[str, list[str]] = {
    "budget": ["budget_allocation", "budget_increase", "budget_decrease", "capital_plan_entry", "grant_received", "grant_application", "bond_approved", "budget_amendment", "supplemental_appropriation", "reserve_fund_draw", "development_charge_revenue", "fiscal_year_end_spending", "cost_overrun", "funding_source_change"],
    "timing": ["contract_expiring", "contract_renewal", "contract_extension", "contract_execution", "feasibility_study", "rfi_issued", "rfq_issued", "rfp_imminent", "rfp_published", "procurement_forecast", "option_not_exercised", "option_exercised", "draft_rfp_released", "solicitation_delayed", "solicitation_cancelled", "accelerated_timeline", "emergency_procurement", "seasonal_procurement"],
    "incumbent_competitor": ["current_vendor", "vendor_complaint", "vendor_performance_review", "vendor_praised", "sole_source", "sole_source_justification", "contract_modification", "change_order", "protest_filed", "contract_terminated", "vendor_default", "subcontractor_identified", "teaming_arrangement", "incumbent_advantage", "new_market_entrant", "purchase_order_issued"],
    "scope": ["project_description", "tech_requirement", "pain_point", "system_replacement", "system_upgrade", "compliance_requirement", "scope_expansion", "scope_reduction", "new_service_need", "maintenance_backlog", "capacity_constraint", "integration_requirement", "accessibility_requirement", "security_requirement", "data_migration", "multi_phase_project", "evaluation_criteria", "mandatory_qualification", "delivery_deadline"],
    "decision_maker": ["key_personnel", "leadership_change", "committee_assignment", "staff_report_author", "consultant_advisor", "council_champion", "department_reorganization", "new_procurement_officer", "external_reviewer", "voting_pattern"],
    "lifecycle": ["needs_discussion", "design_phase", "council_approval_to_solicit", "award_recommendation", "master_plan_reference", "strategic_plan_alignment", "environmental_assessment", "permitting_stage", "construction_commencement", "project_completion", "warranty_expiration", "post_implementation_review", "follow_on_opportunity"],
    "engagement": ["pre_bid_conference", "public_comment_period", "pilot_program", "interagency_collaboration", "industry_day", "vendor_demonstration", "site_visit_scheduled", "stakeholder_consultation", "public_hearing", "community_survey", "addendum_issued"],
    "risk": ["project_delay", "cost_escalation", "litigation_risk", "supply_chain_issue", "safety_incident", "insurance_claim", "audit_finding", "compliance_violation", "political_opposition", "community_opposition", "labour_dispute", "force_majeure", "fraud_allegation"],
    "policy_regulatory": ["bylaw_change", "policy_update", "procurement_policy_change", "threshold_change", "local_preference_policy", "dbe_mbe_wbe_requirement", "cooperative_purchasing", "standing_offer_agreement", "new_regulation", "federal_provincial_mandate", "trade_agreement_impact", "accessibility_legislation"],
    "technology": ["digital_transformation", "cloud_migration", "cybersecurity_initiative", "software_license_expiry", "erp_implementation", "gis_mapping_project", "smart_city_initiative", "iot_deployment", "ai_ml_initiative", "open_data_initiative", "network_infrastructure", "legacy_system_end_of_life"],
    "infrastructure": ["aging_infrastructure", "bridge_road_repair", "water_wastewater", "fleet_replacement", "facility_construction", "facility_renovation", "asset_condition_assessment", "utility_relocation", "transit_expansion", "park_recreation", "housing_development", "demolition"],
    "workforce": ["staffing_shortage", "consulting_need", "outsourcing_discussion", "insourcing_discussion", "training_requirement", "temporary_staffing", "collective_agreement_expiry", "new_position_created"],
    "environmental": ["climate_action_plan", "green_procurement", "emissions_reduction", "ev_fleet_transition", "renewable_energy", "building_retrofit", "waste_management", "stormwater_management", "contamination_remediation", "tree_canopy_initiative"],
    "contract_structure": ["multi_year_contract", "blanket_purchase_order", "joint_venture_required", "bonding_requirement", "insurance_requirement", "prequalification_required", "roster_panel_establishment", "framework_agreement", "performance_based_contract", "public_private_partnership"],
    "political": ["election_cycle", "new_council_priorities", "council_motion", "delegation_presentation", "petition_received", "media_coverage", "political_promise", "intergovernmental_agreement"],
    "geographic": ["ward_specific_project", "growth_area_designation", "zoning_change", "secondary_plan", "brownfield_redevelopment", "annexation_amalgamation", "regional_coordination"],
}


def _build_taxonomy_text() -> str:
    """Build a grouped taxonomy string for the prompt."""
    lines = []
    for cat, types in _CATEGORY_TO_TYPES.items():
        lines.append(f"  {cat}: {', '.join(types)}")
    return "\n".join(lines)


_TAXONOMY_TEXT = _build_taxonomy_text()


def _build_chunk_prompt(year: Optional[int] = None) -> str:
    """Build the system prompt for chunk-level extraction (Pass 2)."""
    year_filter = (
        f"Only extract signals relevant to {year}. Skip other years."
        if year else
        "Extract signals from all years."
    )
    return (
        "You are a procurement intelligence analyst for Canadian municipal government.\n"
        "Extract structured signals from the text chunk below.\n\n"
        "TAXONOMY — signal_category → signal_type (pick ONE category, then a type FROM that category):\n"
        f"{_TAXONOMY_TEXT}\n\n"
        f"PROCUREMENT STAGES (optional): {', '.join(PROCUREMENT_STAGES)}\n\n"
        "CRITICAL: signal_category must be one of the category names on the LEFT (e.g., 'scope', 'budget', 'timing').\n"
        "signal_type must be one of the types listed UNDER that category (e.g., 'accessibility_requirement' belongs under 'scope').\n"
        "Do NOT put a signal_type value into signal_category or vice versa.\n\n"
        "RULES:\n"
        "1. Only extract signals clearly supported by the text.\n"
        "2. raw_excerpt must be verbatim from the text (max 300 chars).\n"
        "3. Confidence: 0.9-1.0 explicit, 0.7-0.89 clear, 0.5-0.69 implied, 0.3-0.49 weak.\n"
        "4. Extract entities: people, orgs, amounts, dates, projects, contract numbers.\n"
        f"5. {year_filter}\n"
    )


# Reverse lookup: signal_type → its parent category
_TYPE_TO_CATEGORY: dict[str, str] = {}
for _cat, _types in _CATEGORY_TO_TYPES.items():
    for _t in _types:
        _TYPE_TO_CATEGORY[_t] = _cat

# Sets for fast membership checks
_VALID_CATEGORIES = {c.value for c in SignalCategory}
_VALID_TYPES = {t.value for t in SignalType}
_VALID_STAGES = {s.value for s in ProcurementStage}


_TYPO_FIXES = {
    "byaw_change": "bylaw_change",
    "by_law_change": "bylaw_change",
    "by law_change": "bylaw_change",
    "bike_road_repair": "bridge_road_repair",
    "grant_increase": "budget_increase",
}


def _auto_correct_signal(s: ExtractedSignal) -> ExtractedSignal:
    """
    Fix common model mistakes:
    1. Category value in signal_type field → look up correct category, skip type
    2. Type value in signal_category field → look up correct category
    3. SignalType value in procurement_stage field → clear it
    4. Common typos → correct spelling
    """
    sig_type = _TYPO_FIXES.get(s.signal_type, s.signal_type)
    sig_cat = s.signal_category
    stage = s.procurement_stage

    # Fix 1: signal_category contains a signal_type value (e.g., "accessibility_requirement")
    if sig_cat not in _VALID_CATEGORIES and sig_cat in _VALID_TYPES:
        sig_cat = _TYPE_TO_CATEGORY.get(sig_cat, sig_cat)

    # Fix 2: signal_type contains a category name (e.g., "scope", "infrastructure")
    if sig_type in _VALID_CATEGORIES and sig_type not in _VALID_TYPES:
        # Can't recover — we don't know which specific type they meant
        return None  # Will be filtered out

    # Fix 3: procurement_stage contains a signal_type (e.g., "design_phase", "needs_discussion")
    if stage and stage not in _VALID_STAGES:
        if stage in _VALID_TYPES:
            stage = None  # Clear invalid stage
        else:
            stage = None  # Unknown value, clear it

    return ExtractedSignal(
        signal_type=sig_type,
        signal_category=sig_cat,
        confidence=s.confidence,
        summary=s.summary,
        raw_excerpt=s.raw_excerpt,
        entities=s.entities,
        procurement_stage=stage,
        estimated_value=s.estimated_value,
        estimated_timeline=s.estimated_timeline,
        related_bid_number=s.related_bid_number,
    )


def _extracted_to_signals(
    extracted: list[ExtractedSignal],
    city: str,
    source_url: str,
    source_type: SourceType,
    year: Optional[int] = None,
    pdf_document_url: Optional[str] = None,
) -> list[Signal]:
    """Convert ExtractedSignal objects → validated Signal models for Supabase."""
    validated = []
    for s in extracted:
        try:
            # Auto-correct common model mistakes before validation
            corrected = _auto_correct_signal(s)
            if corrected is None:
                continue

            entities = [
                Entity(name=e.name, entity_type=e.entity_type, role=e.role)
                for e in corrected.entities
            ]
            signal = Signal(
                source_type=source_type,
                source_url=source_url,
                city=city,
                year=year,
                pdf_document_url=pdf_document_url or source_url,
                signal_type=SignalType(corrected.signal_type),
                signal_category=SignalCategory(corrected.signal_category),
                confidence=corrected.confidence,
                summary=corrected.summary,
                raw_excerpt=corrected.raw_excerpt[:300],
                entities=entities,
                procurement_stage=(
                    ProcurementStage(corrected.procurement_stage)
                    if corrected.procurement_stage else None
                ),
                estimated_value=corrected.estimated_value,
                estimated_timeline=corrected.estimated_timeline,
                related_bid_number=corrected.related_bid_number,
            )
            validated.append(signal)
        except (ValueError, KeyError) as e:
            print(f"  [validate] Skipped invalid signal: {e}")
    return validated


# ═══════════════════════════════════════════════════════════════
#  SubAgent 1: PDF Text Extractor
#
#  Model: non-reasoning (just decides which tool to call)
#  Tools: dumb I/O — download, extract text, track in Supabase
# ═══════════════════════════════════════════════════════════════


def download_and_extract(
    url: str,
    city: str,
    document_type: str = "meeting_minutes",
    year: Optional[int] = None,
) -> str:
    """
    Download a PDF and extract its text. Tracks status in Supabase.

    Args:
        url: PDF download URL (e.g., FileStream.ashx link)
        city: Municipality name (e.g., "Markham")
        document_type: e.g., "PDF Minutes", "PDF Agenda"
        year: Optional year for tracking in Supabase

    Returns JSON with: status, source_url, city, source_type,
    local_path, page_count, text_length
    """
    # Only process document types with procurement value
    _dt_lower = document_type.lower()
    _SKIP = ["post agenda", "revised agenda", "cancellation", "addendum", "order paper"]
    _ALLOWED = ["minute", "agenda", "summary of recommendation", "notice of decision", "budget"]
    if any(kw in _dt_lower for kw in _SKIP):
        print(f"  [{city}] SKIP — {document_type}")
        return json.dumps({"status": "skipped", "reason": f"Filtered document type: {document_type}", "url": url})
    if not any(kw in _dt_lower for kw in _ALLOWED):
        print(f"  [{city}] SKIP — {document_type}")
        return json.dumps({"status": "skipped", "reason": f"Filtered document type: {document_type}", "url": url})

    source_type = classify_source_type(document_type)
    pdf_doc = PDFDocument(source_url=url, city=city, source_type=source_type, year=year)

    # ── Download ──
    pdf_doc.status = DocumentExtractionStatus.DOWNLOADING
    upsert_pdf_document(pdf_doc)

    try:
        path = _run_async(download_pdf(url, city))
    except Exception as e:
        pdf_doc.status = DocumentExtractionStatus.FAILED
        pdf_doc.error_message = str(e)[:500]
        upsert_pdf_document(pdf_doc)
        return json.dumps({"status": "failed", "error": str(e)[:200], "url": url})

    # ── Extract text ──
    pdf_doc.local_path = str(path)
    pdf_doc.status = DocumentExtractionStatus.EXTRACTING_TEXT
    upsert_pdf_document(pdf_doc)

    try:
        full_text, page_count = extract_text(path)
    except Exception as e:
        pdf_doc.status = DocumentExtractionStatus.FAILED
        pdf_doc.error_message = str(e)[:500]
        upsert_pdf_document(pdf_doc)
        return json.dumps({"status": "failed", "error": str(e)[:200], "url": url})

    if not full_text.strip():
        pdf_doc.status = DocumentExtractionStatus.FAILED
        pdf_doc.error_message = "No text extracted (scanned/image PDF)"
        upsert_pdf_document(pdf_doc)
        return json.dumps({"status": "failed", "error": "No text (scanned PDF)", "url": url})

    # ── Mark ready ──
    pdf_doc.page_count = page_count
    pdf_doc.extracted_text_length = len(full_text)
    pdf_doc.status = DocumentExtractionStatus.ANALYZING
    upsert_pdf_document(pdf_doc)

    print(f"  [{city}] {page_count} pages, {len(full_text)} chars → {path.name}")

    return json.dumps({
        "status": "ok",
        "source_url": url,
        "city": city,
        "source_type": source_type.value,
        "local_path": str(path),
        "page_count": page_count,
        "text_length": len(full_text),
    })


def download_and_extract_batch(items: list[dict], year: Optional[int] = None) -> str:
    """
    Download + extract text from multiple PDFs.

    items: list of dicts with keys: url, city, document_type
    year: Optional year for tracking in Supabase
    Returns JSON array of results.
    """
    results = []
    for i, item in enumerate(items):
        print(f"\n[{i+1}/{len(items)}] {item.get('city', '?')}...")
        result = download_and_extract(
            url=item["url"],
            city=item.get("city", "Unknown"),
            document_type=item.get("document_type", "meeting_minutes"),
            year=item.get("year", year),
        )
        results.append(json.loads(result))
    return json.dumps(results, indent=2)


pdf_text_extractor_agent = SubAgent(
    name="pdf-text-extractor-agent",
    description=(
        "Downloads PDFs and extracts text. Pass PDF URLs from meetings/bids crawlers. "
        "Returns local_path for each PDF so signal-analyzer-agent can read it."
    ),
    system_prompt=(
        "You download and extract text from municipal PDFs.\n\n"
        "IMPORTANT: Process ALL documents passed to you — agendas, minutes, attachments, "
        "revised agendas, staff reports, everything. Do NOT filter by document type.\n\n"
        "Tools:\n"
        "- download_and_extract: Single PDF → returns JSON with local_path, page_count\n"
        "- download_and_extract_batch: Multiple PDFs → pass list of {url, city, document_type}\n\n"
        "Report: city, pages, text length, failures."
    ),
    tools=[download_and_extract, download_and_extract_batch],
    model="grok-4-1-fast-non-reasoning",
)


# ═══════════════════════════════════════════════════════════════
#  SubAgent 2: Signal Analyzer
#
#  Model: grok-4-1-fast-reasoning ← THIS IS THE BRAIN
#
#  How it works:
#    1. Agent calls read_pdf_text() → gets the document text
#    2. Agent's OWN model reads the text and thinks about it
#    3. Agent calls save_signals() with extracted signals
#    4. Agent calls run_chunk_sweep() to catch missed explicit signals
#
#  Tools are just I/O — the AI is the agent's model, not in the tools.
# ═══════════════════════════════════════════════════════════════


def read_pdf_text(local_path: str, max_chars: int = 500000) -> str:
    """
    Read extracted text from a local PDF file.
    Returns the text content so the agent can analyze it.

    Args:
        local_path: Path to the PDF file (from pdf-text-extractor-agent)
        max_chars: Truncate to this many chars (default 500K, fits in context)
    """
    try:
        full_text, page_count = extract_text(Path(local_path))
        text = full_text[:max_chars]
        return (
            f"[{page_count} pages, {len(full_text)} chars"
            f"{', truncated to ' + str(max_chars) if len(full_text) > max_chars else ''}]\n\n"
            f"{text}"
        )
    except Exception as e:
        return f"ERROR reading {local_path}: {e}"


def save_signals(
    signals_json: str,
    city: str,
    source_url: str,
    source_type: str = "meeting_minutes",
    year: Optional[int] = None,
) -> str:
    """
    Validate and save signals to Supabase.
    The agent extracts signals from text, then calls this tool to persist them.

    Args:
        signals_json: JSON array of signal objects. Each must have:
            signal_type, signal_category, confidence, summary, raw_excerpt,
            and optionally: entities, procurement_stage, estimated_value,
            estimated_timeline, related_bid_number
        city: Municipality name
        source_url: Original PDF URL
        source_type: One of: meeting_minutes, agenda, budget, staff_report, bid, etc.
        year: Optional year for signal attribution
    """
    try:
        raw_list = json.loads(signals_json)
    except json.JSONDecodeError as e:
        return f"Invalid JSON: {e}"

    st = SourceType(source_type)

    # Convert dicts → ExtractedSignal → Signal (validates both steps)
    extracted = []
    for item in raw_list:
        try:
            extracted.append(ExtractedSignal(**item))
        except Exception as e:
            print(f"  [save_signals] Skipped invalid: {e}")

    signals = _extracted_to_signals(extracted, city, source_url, st, year=year, pdf_document_url=source_url)

    if not signals:
        return "No valid signals to save."

    try:
        upsert_signals(signals)
        return f"Saved {len(signals)} signals to Supabase for {city}"
    except Exception as e:
        return f"Supabase error: {e}"


def run_chunk_sweep(
    local_path: str,
    city: str,
    source_url: str,
    source_type: str = "meeting_minutes",
    year: Optional[int] = None,
) -> str:
    """
    Pass 2: Sweep chunks with fast non-reasoning model to catch
    explicit signals the reasoning model may have summarized over.

    This is a batch pipeline — it calls xAI per chunk internally.
    The agent doesn't need to see each chunk; this tool handles it.

    Args:
        local_path: Path to local PDF file
        city: Municipality name
        source_url: Original PDF URL
        source_type: Document type string
        year: Optional year filter
    """
    try:
        full_text, page_count = extract_text(Path(local_path))
    except Exception as e:
        return f"ERROR reading {local_path}: {e}"

    chunks = chunk_text(full_text, chunk_size=4000, overlap=400)
    print(f"  [{city}] Chunk sweep: {len(chunks)} chunks → non-reasoning model...")

    st = SourceType(source_type)
    prompt = _build_chunk_prompt(year)
    all_signals: list[Signal] = []

    def _process_chunk(args: tuple[int, str]) -> list[Signal]:
        """Process a single chunk — called in parallel by ThreadPoolExecutor."""
        i, chunk = args
        try:
            chat = _xai.chat.create(
                model="grok-4-1-fast-non-reasoning",
                messages=[system(prompt), user(f"Source: {source_type} from {city}\n---\n{chunk}")],
                response_format=SignalExtractionResponse,
            )
            _, parsed = chat.parse(SignalExtractionResponse)
            return _extracted_to_signals(
                parsed.signals, city, source_url, st,
                year=year, pdf_document_url=source_url,
            )
        except Exception as e:
            print(f"  [{city}] Chunk {i+1}/{len(chunks)} failed: {e}")
            return []

    # Process chunks in parallel (5 concurrent xAI calls)
    # Use per-chunk timeout via as_completed + cancel to handle hung gRPC calls
    from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError as FuturesTimeout
    CHUNK_TIMEOUT = 120  # total timeout for all chunks in this PDF
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {pool.submit(_process_chunk, (i, chunk)): i for i, chunk in enumerate(chunks)}
        try:
            for future in as_completed(futures, timeout=CHUNK_TIMEOUT):
                try:
                    all_signals.extend(future.result(timeout=0))
                except Exception as e:
                    chunk_idx = futures[future]
                    print(f"  [{city}] Chunk {chunk_idx+1}/{len(chunks)} error: {e}")
        except FuturesTimeout:
            hung = sum(1 for f in futures if not f.done())
            print(f"  [{city}] CHUNK TIMEOUT — {hung}/{len(chunks)} chunks hung, skipping them")
            for f in futures:
                if not f.done():
                    f.cancel()

    if all_signals:
        try:
            upsert_signals(all_signals)
        except Exception as e:
            return f"Extracted {len(all_signals)} signals but Supabase error: {e}"

    # Update pdf_documents status — query existing count so we ADD to it, not overwrite
    try:
        from db.supbase_client import get_supabase
        existing = (
            get_supabase()
            .table("pdf_documents")
            .select("signals_extracted")
            .eq("source_url", source_url)
            .limit(1)
            .execute()
        )
        existing_count = existing.data[0]["signals_extracted"] if existing.data else 0

        pdf_doc = PDFDocument(
            source_url=source_url, city=city, source_type=st,
            local_path=local_path, page_count=page_count,
            extracted_text_length=len(full_text),
            status=DocumentExtractionStatus.COMPLETED,
            signals_extracted=existing_count + len(all_signals),
            year=year,
        )
        upsert_pdf_document(pdf_doc)
    except Exception:
        pass

    print(f"  [{city}] Chunk sweep done: {len(all_signals)} signals from {len(chunks)} chunks")
    return f"Chunk sweep: {len(all_signals)} signals from {len(chunks)} chunks → saved to Supabase"


signal_analyzer_agent = SubAgent(
    name="signal-analyzer-agent",
    description=(
        "Analyzes PDF text to extract procurement intelligence signals. "
        "Uses its own reasoning model to understand the document, then saves signals to Supabase. "
        "Pass it the local_path, city, source_url, and source_type from pdf-text-extractor-agent."
    ),
    system_prompt=(
        "You are a procurement intelligence analyst for Canadian municipal government.\n\n"
        "YOUR JOB: Read municipal documents and extract structured procurement signals.\n\n"
        "HOW TO WORK:\n"
        "1. Call read_pdf_text(local_path) to see the document text\n"
        "2. YOU analyze the text — look for procurement signals\n"
        "3. Call save_signals() with a JSON array of signals you found\n"
        "4. Call run_chunk_sweep() to catch explicit signals you may have missed\n\n"
        "WHAT TO LOOK FOR:\n"
        f"Signal categories: {', '.join(SIGNAL_CATEGORIES)}\n"
        f"Signal types: {', '.join(SIGNAL_TYPES)}\n"
        f"Procurement stages: {', '.join(PROCUREMENT_STAGES)}\n\n"
        "SIGNAL FORMAT (JSON array):\n"
        "[\n"
        '  {\n'
        '    "signal_type": "contract_expiring",\n'
        '    "signal_category": "timing",\n'
        '    "confidence": 0.95,\n'
        '    "summary": "Road maintenance contract expires March 2025",\n'
        '    "raw_excerpt": "verbatim text from document max 300 chars",\n'
        '    "entities": [{"name": "ABC Corp", "entity_type": "organization", "role": "incumbent"}],\n'
        '    "procurement_stage": "rfp_imminent",\n'
        '    "estimated_value": 500000,\n'
        '    "related_bid_number": "012-T-25"\n'
        "  }\n"
        "]\n\n"
        "CONFIDENCE SCALE:\n"
        "- 0.9-1.0: Explicit ('Contract awarded to XYZ for $500K')\n"
        "- 0.7-0.89: Clear but needs interpretation\n"
        "- 0.5-0.69: Implied, not stated directly\n"
        "- 0.3-0.49: Weak/tangential\n\n"
        "IMPORTANT:\n"
        "- Only extract signals supported by the text. Don't hallucinate.\n"
        "- raw_excerpt must be verbatim from the document.\n"
        "- Always call run_chunk_sweep() after your own analysis — it catches\n"
        "  explicit details (dollar amounts, bid numbers) you may have summarized over.\n"
        "- If given a year filter, only extract signals relevant to that year."
    ),
    tools=[read_pdf_text, save_signals, run_chunk_sweep],
    model="grok-4-1-fast-reasoning",
)


# ═══════════════════════════════════════════════════════════════
#  Deterministic batch processor
#
#  Replaces the LLM-driven Steps 4+5 with a Python loop.
#  The orchestrator calls this ONCE — every PDF gets processed.
#  No LLM fatigue, no truncation, no skipping.
# ═══════════════════════════════════════════════════════════════


def _process_single_pdf(i: int, total: int, pdf: dict, year: Optional[int]) -> dict:
    """Process one PDF: download, extract, analyze. Returns a result dict."""
    url = pdf.get("pdf_url", "")
    city = pdf.get("city", "Unknown")
    doc_type = pdf.get("document_type", "meeting_minutes")

    print(f"\n[{i+1}/{total}] {city} — {doc_type}")

    # ── Download + extract text ──
    extract_result_str = download_and_extract(
        url=url, city=city, document_type=doc_type, year=year,
    )
    extract_result = json.loads(extract_result_str)

    if extract_result.get("status") == "skipped":
        return {"url": url, "city": city, "status": "skipped", "reason": extract_result.get("reason", "")}

    if extract_result.get("status") != "ok":
        return {"url": url, "city": city, "status": "failed", "error": extract_result.get("error", "")}

    # ── Signal analysis ──
    print(f"  Analyzing signals...")
    sweep_result = run_chunk_sweep(
        local_path=extract_result["local_path"],
        city=city,
        source_url=url,
        source_type=extract_result["source_type"],
        year=year,
    )

    signal_count = 0
    if "signals from" in sweep_result:
        try:
            signal_count = int(sweep_result.split(" signals from")[0].split(": ")[-1])
        except (ValueError, IndexError):
            pass

    print(f"  Done — {signal_count} signals")
    return {
        "url": url, "city": city, "status": "ok",
        "pages": extract_result.get("page_count", 0),
        "text_length": extract_result.get("text_length", 0),
        "signals": signal_count,
    }


# How many PDFs to process at the same time.
# Each PDF spawns up to 5 xAI calls, so 3 PDFs = ~15 concurrent API calls.
PDF_CONCURRENCY = 3


def process_all_pdfs(pdfs_json: str, year: Optional[int] = None) -> str:
    """
    Deterministic pipeline: download, extract text, and analyze ALL PDFs.
    Processes PDF_CONCURRENCY PDFs at a time for speed.

    Args:
        pdfs_json: JSON string — list of dicts with keys:
            pdf_url, city, document_type (from crawl_all_cities output)
        year: Year filter for signal extraction

    Returns JSON summary with per-PDF results and totals.
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError as FuturesTimeout

    try:
        pdfs = json.loads(pdfs_json) if isinstance(pdfs_json, str) else pdfs_json
    except json.JSONDecodeError as e:
        return json.dumps({"error": f"Invalid JSON: {e}"})

    total = len(pdfs)
    results = []
    totals = {"processed": 0, "skipped": 0, "failed": 0, "signals": 0}

    print(f"\n{'='*60}")
    print(f"  BATCH PROCESSING: {total} PDFs ({PDF_CONCURRENCY} concurrent)")
    print(f"  Year filter: {year}")
    print(f"{'='*60}")

    # Process PDFs in batches of PDF_CONCURRENCY
    PDF_TIMEOUT = 180  # 3 min max per PDF
    for batch_start in range(0, total, PDF_CONCURRENCY):
        batch = pdfs[batch_start:batch_start + PDF_CONCURRENCY]
        with ThreadPoolExecutor(max_workers=PDF_CONCURRENCY) as pool:
            futures = {
                pool.submit(_process_single_pdf, batch_start + j, total, pdf, year): j
                for j, pdf in enumerate(batch)
            }
            try:
                done_iter = as_completed(futures, timeout=PDF_TIMEOUT * len(batch))
                for future in done_iter:
                    try:
                        result = future.result(timeout=0)
                    except Exception as e:
                        idx = futures[future]
                        pdf = batch[idx]
                        print(f"  [{pdf.get('city','?')}] TIMED OUT or errored: {e}")
                        result = {"url": pdf.get("pdf_url", ""), "city": pdf.get("city", "?"), "status": "failed", "error": str(e)[:200]}

                    status = result.get("status")
                    if status == "skipped":
                        totals["skipped"] += 1
                    elif status == "ok":
                        totals["processed"] += 1
                        totals["signals"] += result.get("signals", 0)
                    else:
                        totals["failed"] += 1
                    results.append(result)
                    continue  # keep iterating
            except FuturesTimeout:
                # Some futures in this batch hung — mark unfinished ones as failed
                for f, idx in futures.items():
                    if not f.done():
                        pdf = batch[idx]
                        print(f"  [{pdf.get('city','?')}] BATCH TIMEOUT — cancelling hung PDF")
                        f.cancel()
                        results.append({"url": pdf.get("pdf_url", ""), "city": pdf.get("city", "?"), "status": "failed", "error": "batch timeout"})
                        totals["failed"] += 1
                continue  # move to next batch

    # ── Summary ──
    print(f"\n{'='*60}")
    print(f"  BATCH COMPLETE")
    print(f"  Processed: {totals['processed']}")
    print(f"  Skipped:   {totals['skipped']}")
    print(f"  Failed:    {totals['failed']}")
    print(f"  Signals:   {totals['signals']}")
    print(f"{'='*60}")

    return json.dumps({
        "summary": totals,
        "details": results,
    }, indent=2)
