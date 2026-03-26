import sys
import asyncio
import json
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv())

import nest_asyncio
nest_asyncio.apply()

sys.path.insert(0, str(Path(__file__).parent.parent))

from deepagents import create_deep_agent, SubAgent, CompiledSubAgent

# Import fully built discovery agents and their deep-search subagents
from search_bids import find_bids_agent, deep_search_subagent as bids_deep_search
from search_mins import find_mins_agent, deep_search_subagent as mins_deep_search

# Import signal extraction agents
from signal_extractor import (
    pdf_text_extractor_agent,
    signal_analyzer_agent,
    process_all_pdfs,
)

from crawlers.bids_tenders import run_markham_scraper
from crawlers.meetings import find_meetings


def _run_async(coro):
    """Safely run an async coroutine from sync context (handles nested event loops)."""
    try:
        loop = asyncio.get_running_loop()
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)

# GTA_MUNICIPALITIES = [
#     "Toronto", "Mississauga", "Brampton", "Vaughan", "Markham",
#     "Richmond Hill", "Oakville", "Burlington", "Pickering", "Ajax",
#     "Whitby", "Oshawa", "Halton Hills", "Milton", "Newmarket",
#     "Aurora", "King", "Caledon", "Georgina", "East Gwillimbury",
# ]

GTA_MUNICIPALITIES = ["Mississauga", "Vaughan", "Markham"]


# --- Crawler tools ---

def crawl_bids(city: str, url: str, year: int, status: str = "All") -> str:
    """
    Invoke the bids and tenders crawler for a city.
    ONLY works with bidsandtenders.ca URLs. Any other URL will be skipped.
    Extracts all bid listings, details, plan takers, and submitted bids.
    """
    if "bidsandtenders.ca" not in url:
        msg = f"SKIPPED {city}: URL '{url}' is not a bidsandtenders.ca link — crawler does not support this site."
        print(f"[crawl_bids] {msg}")
        return msg
    print(f"\n{'='*50}")
    print(f"[crawl_bids] Starting bids crawl")
    print(f"  City   : {city}")
    print(f"  URL    : {url}")
    print(f"  Year   : {year} | Status: {status}")
    print(f"{'='*50}")
    base_url = url.rstrip("/")
    if "/Module/Tenders/en" not in base_url:
        base_url = f"{base_url}/Module/Tenders/en"
    _run_async(run_markham_scraper(year, status=status, base_url=base_url, city=city))
    print(f"[crawl_bids] Done — {city}")
    return f"Bids crawl complete for {city}"


def crawl_meetings(city: str, url: str, year: int) -> str:
    """
    Invoke the council meetings crawler for a city.
    ONLY works with escribemeetings.com URLs. Any other URL will be skipped.
    Extracts all meeting titles, dates, agendas, and PDF document links.
    """
    if "escribemeetings.com" not in url:
        msg = f"SKIPPED {city}: URL '{url}' is not an escribemeetings.com link — crawler does not support this site."
        print(f"[crawl_meetings] {msg}")
        return msg
    print(f"\n{'='*50}")
    print(f"[crawl_meetings] Starting meetings crawl")
    print(f"  City   : {city}")
    print(f"  URL    : {url}")
    print(f"  Year   : {year}")
    print(f"{'='*50}")
    docs = _run_async(find_meetings(url.rstrip("/"), year, city=city))
    print(f"[crawl_meetings] Done — {city}, {len(docs)} PDFs found")
    return json.dumps({"city": city, "pdf_count": len(docs), "pdfs": docs})


def crawl_all_cities(city_data: list[dict], year: int, status: str = "All") -> str:
    """
    Crawl bids and meetings for multiple cities.
    city_data should be a list of dicts with keys: city, bids_url, meetings_url.
    Example: [{"city": "Markham", "bids_url": "https://markham.bidsandtenders.ca", "meetings_url": "https://pub-markham.escribemeetings.com"}]

    IMPORTANT: Only bidsandtenders.ca URLs are supported for bids. Only escribemeetings.com URLs are supported for meetings.
    Cities with unsupported URLs will be automatically skipped with a clear message.
    """
    # Build a list of (crawl_type, city, coroutine_factory) — factories, NOT live coroutines.
    # This avoids starting coroutines before we're ready to await them.
    task_specs = []
    skipped = []
    all_pdfs: list[dict] = []
    for entry in city_data:
        city = entry["city"]
        bids_url = entry.get("bids_url", "")
        meetings_url = entry.get("meetings_url", "")

        if bids_url and "bidsandtenders.ca" in bids_url:
            base = bids_url.rstrip("/")
            if "/Module/Tenders/en" not in base:
                base = f"{base}/Module/Tenders/en"
            # Lambda captures base/city by default arg to avoid late-binding gotcha
            task_specs.append(("bids", city, lambda b=base, c=city: run_markham_scraper(year, status=status, base_url=b, city=c)))
        elif bids_url:
            skipped.append(f"{city} bids: SKIPPED (unsupported site: {bids_url})")
            print(f"[crawl_all_cities] SKIPPED — {city} bids: not a bidsandtenders.ca URL")

        if meetings_url and "escribemeetings.com" in meetings_url:
            task_specs.append(("meetings", city, lambda u=meetings_url.rstrip("/"), c=city: find_meetings(u, year, city=c)))
        elif meetings_url:
            skipped.append(f"{city} meetings: SKIPPED (unsupported site: {meetings_url})")
            print(f"[crawl_all_cities] SKIPPED — {city} meetings: not an escribemeetings.com URL")

    async def _run_all():
        results = list(skipped)
        for crawl_type, city, make_coro in task_specs:
            try:
                print(f"\n[crawl_all_cities] Starting {crawl_type} crawl for {city}")
                result = await make_coro()
                if crawl_type == "meetings" and isinstance(result, list):
                    all_pdfs.extend(result)
                    results.append(f"{city} {crawl_type}: OK ({len(result)} PDFs)")
                else:
                    results.append(f"{city} {crawl_type}: OK")
                print(f"[crawl_all_cities] Done — {city} {crawl_type}")
            except Exception as e:
                results.append(f"{city} {crawl_type}: FAILED ({e})")
                print(f"[crawl_all_cities] FAILED — {city} {crawl_type}: {e}")
        return results

    results = _run_async(_run_all())
    summary = "\n".join(results)
    print(f"\n--- Crawl Summary ---\n{summary}")

    # Save PDFs list to file so process_pdfs_tool can read it without LLM relay
    pdfs_file = Path(__file__).parent.parent / "storage" / "crawl_pdfs.json"
    pdfs_file.parent.mkdir(parents=True, exist_ok=True)
    pdfs_file.write_text(json.dumps(all_pdfs, indent=2))
    print(f"[crawl_all_cities] Saved {len(all_pdfs)} PDFs to {pdfs_file}")

    return json.dumps({"summary": summary, "pdf_count": len(all_pdfs), "pdfs_file": str(pdfs_file)})


# --- Single crawler agent that reasons which crawler to invoke ---

crawler_agent = SubAgent(
    name="crawler-agent",
    description=(
        "Use this agent to crawl data for one or more cities once their URLs are known. "
        "Pass all cities at once using crawl_all_cities for batch crawling. "
        "Only bidsandtenders.ca and escribemeetings.com URLs are supported — others are auto-skipped."
    ),
    system_prompt=(
        "You are a crawler agent. You will be given city names, URLs, and a year.\n\n"
        "SUPPORTED SITES (only these two crawlers exist):\n"
        "- Bids: ONLY 'bidsandtenders.ca' URLs are supported\n"
        "- Meetings: ONLY 'escribemeetings.com' URLs are supported\n\n"
        "Any URL that is NOT on one of these two domains cannot be crawled and will be skipped.\n"
        "Do NOT attempt to crawl unsupported URLs — the tools will auto-skip them with a message.\n\n"
        "PREFERRED: Use crawl_all_cities to crawl all cities in one call. "
        "Pass a list of dicts with keys: city, bids_url, meetings_url.\n"
        "FALLBACK: For a single city, use crawl_bids or crawl_meetings individually.\n\n"
        "Report back with a summary of what was crawled and what was skipped."
    ),
    tools=[crawl_bids, crawl_meetings, crawl_all_cities],
)


# --- Deterministic PDF processing tool (exposed directly to orchestrator) ---

def process_pdfs_tool(pdfs_file: str, year: int) -> str:
    """
    Process ALL PDFs: download, extract text, and analyze for signals.
    This is a deterministic Python loop — every PDF is guaranteed to be processed.

    Args:
        pdfs_file: Path to the JSON file containing the PDFs list (from crawl_all_cities output).
                   The file contains a JSON array of dicts with keys: pdf_url, city, document_type.
        year: Year filter for signal extraction.

    Returns JSON summary with per-PDF results and totals.
    """
    pdfs_data = Path(pdfs_file).read_text()
    return process_all_pdfs(pdfs_data, year=year)


# --- Orchestrator ---

orchestrator = create_deep_agent(
    model="grok-4.20-0309-reasoning",
    subagents=[
        CompiledSubAgent(
            name="find-bids-agent",
            description=(
                "Delegate to this agent to discover bids and tenders URLs for all GTA cities. "
                "Pass the city list and it returns a City: URL: list."
            ),
            runnable=find_bids_agent,
        ),
        CompiledSubAgent(
            name="find-mins-agent",
            description=(
                "Delegate to this agent to discover council meeting minutes URLs for all GTA cities. "
                "Pass the city list and it returns a City: URL: list."
            ),
            runnable=find_mins_agent,
        ),
        crawler_agent,
    ],
    tools=[process_pdfs_tool],
    system_prompt=(
        "You are the orchestrator for GTA municipal data collection and signal extraction.\n\n"
        "IMPORTANT — SUPPORTED CRAWLERS:\n"
        "- Bids crawler ONLY works with bidsandtenders.ca URLs\n"
        "- Meetings crawler ONLY works with escribemeetings.com URLs\n"
        "Cities whose URLs are on other platforms (merx.com, city websites, etc.) must be skipped.\n\n"
        "PIPELINE (execute in order):\n\n"
        "Step 1 — DISCOVER: Delegate to find-bids-agent with the full city list to get all bids/tenders URLs.\n\n"
        "Step 2 — DISCOVER: Delegate to find-mins-agent with the full city list to get all council meetings URLs.\n\n"
        "Step 3 — CRAWL: Delegate to crawler-agent with ALL cities at once using crawl_all_cities. "
        "Pass a list of dicts with keys: city, bids_url, meetings_url, plus the year. "
        "Only include bidsandtenders.ca URLs as bids_url and escribemeetings.com URLs as meetings_url. "
        "For cities on unsupported platforms, set the URL to empty string. "
        "crawl_all_cities returns JSON with a 'pdfs' list — save this for Step 4.\n\n"
        "Step 4 — PROCESS ALL PDFs: Call process_pdfs_tool with the 'pdfs_file' path from Step 3 "
        "and the year. crawl_all_cities saves the PDFs list to a JSON file and returns the path "
        "in the 'pdfs_file' field. Just pass that file path — do NOT try to pass the PDFs as JSON.\n\n"
        "Step 5 — SUMMARY: Return a final summary table of all cities, their URLs, crawl status, "
        "PDFs processed, signals extracted, and which cities were skipped and why.\n\n"
        "CRITICAL RULES:\n"
        "- Always pass the year parameter to process_pdfs_tool.\n"
        "- Pass the pdfs_file PATH from crawl_all_cities — do NOT pass JSON data directly.\n"
        "- process_pdfs_tool handles everything: download, text extraction, signal analysis, Supabase upsert.\n"
        "- You do NOT need pdf-text-extractor-agent or signal-analyzer-agent — process_pdfs_tool replaces them."
    ),
)

if __name__ == "__main__":
    city_list = ", ".join(GTA_MUNICIPALITIES)
    year = 2026

    print(f"\n{'#'*50}")
    print(f"  GTA Municipal Data Collection + Signal Extraction")
    print(f"  Cities : {city_list}")
    print(f"  Year   : {year}")
    print(f"{'#'*50}\n")

    result = orchestrator.invoke({
        "messages": [{
            "role": "user",
            "content": (
                f"Collect all bids/tenders and council meeting minutes "
                f"for all GTA municipalities for the year {year}. "
                f"Then extract procurement signals from all collected PDF documents. "
                f"Cities: {city_list}"
            )
        }]
    })

    print(result["messages"][-1].content)
