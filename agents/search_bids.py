from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv())

from concurrent.futures import ThreadPoolExecutor, as_completed
from ddgs import DDGS
from ddgs.exceptions import DDGSException
from deepagents import create_deep_agent, SubAgent

GTA_MUNICIPALITIES = [
    "Toronto", "Mississauga", "Brampton", "Vaughan", "Markham",
    "Richmond Hill", "Oakville", "Burlington", "Pickering", "Ajax",
    "Whitby", "Oshawa", "Halton Hills", "Milton", "Newmarket",
    "Aurora", "King", "Caledon", "Georgina", "East Gwillimbury",
]


def _search_single_city_bids(city: str) -> str:
    """Search bidsandtenders.ca for a single city (thread-safe)."""
    ddgs = DDGS()
    output = f"=== {city} ===\n"
    try:
        results = ddgs.text(f"{city} Ontario site:bidsandtenders.ca", max_results=3)
        hits = [r for r in (results or []) if "bidsandtenders.ca" in r["href"]]
    except DDGSException:
        hits = []
    if hits:
        print(f"  [{city}] Found {len(hits)} result(s) on bidsandtenders.ca:")
        for r in hits:
            print(f"    - {r['href']}")
            output += f"- {r['title']}\n  URL: {r['href']}\n  {r['body'][:120]}\n\n"
    else:
        print(f"  [{city}] Not found on bidsandtenders.ca")
        output += "Not found on bidsandtenders.ca — must delegate to deep-search-agent.\n\n"
    return output


def search_bidsandtenders(cities: list[str]) -> str:
    """Search bidsandtenders.ca for a batch of cities in parallel."""
    print(f"\n[search_bidsandtenders] Searching for: {cities}")
    results = []
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {pool.submit(_search_single_city_bids, city): city for city in cities}
        for future in as_completed(futures):
            results.append(future.result())
    return "".join(results)


def search_procurement_broad(city: str) -> str:
    """Broad search for a single city's official procurement or tenders page across any source."""
    print(f"\n[search_procurement_broad] Deep searching for: {city}")
    ddgs = DDGS()
    output = f"=== {city} ===\n"
    queries = [
        f"{city} Ontario official tenders procurement portal",
        f"{city} Ontario bids RFP RFQ purchasing department",
        f"{city} Ontario municipal procurement homepage",
    ]
    seen = set()
    for query in queries:
        print(f"  Query: {query}")
        try:
            results = ddgs.text(query, max_results=3)
        except DDGSException:
            print(f"  No results for query.")
            continue
        for r in (results or []):
            if r["href"] not in seen:
                seen.add(r["href"])
                print(f"  Found: {r['href']}")
                output += f"- {r['title']}\n  URL: {r['href']}\n  {r['body'][:150]}\n\n"
    return output if seen else f"=== {city} ===\nNo results found.\n\n"


deep_search_subagent = SubAgent(
    name="deep-search-agent",
    description=(
        "Use this agent for any city where bidsandtenders.ca search returned no results "
        "or the result says 'must delegate to deep-search-agent'. "
        "Pass the city name and it will do a broader search across all sources."
    ),
    system_prompt=(
        "You are a specialist at finding municipal procurement pages. "
        "You will be given a single city name in Ontario, Canada that was not found on bidsandtenders.ca. "
        "Use the search tool to do a broad search — try official city websites, "
        "procurement portals, merx.com, or any other platform. "
        "Run multiple queries if the first doesn't find a clear result. "
        "Pick the single best, most official URL from the results. "
        "Do not fabricate URLs — only return URLs that appeared in search results."
    ),
    tools=[search_procurement_broad],
    model="grok-4-1-fast-reasoning",
)

find_bids_agent = create_deep_agent(
    model="grok-4-1-fast-non-reasoning",
    tools=[search_bidsandtenders],
    subagents=[deep_search_subagent],
    system_prompt=(
        "You are a procurement research agent for GTA municipalities. "
        "Step 1: Call search_bidsandtenders with all cities at once. "
        "Step 2: For every city whose result says 'Not found on bidsandtenders.ca' or "
        "'must delegate to deep-search-agent', you MUST delegate that city to the deep-search-agent. "
        "Do not skip any city — every city in the list must have a URL in the final output. "
        "Step 3: Return a clean final list in this format:\n"
        "City: <name>\nURL: <url>\n\n"
        "Do not guess or fabricate URLs — only include URLs found in search results."
    ),
)
