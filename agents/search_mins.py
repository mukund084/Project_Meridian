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


def _search_single_city_escribe(city: str) -> str:
    """Search escribemeetings.com for a single city (thread-safe)."""
    ddgs = DDGS()
    output = f"=== {city} ===\n"
    city_slug = city.lower().replace(" ", "")
    try:
        results = ddgs.text(f"{city} Ontario site:escribemeetings.com", max_results=5)
        hits = [
            r for r in (results or [])
            if "escribemeetings.com" in r["href"] and city_slug in r["href"].lower()
        ]
    except DDGSException:
        hits = []
    if hits:
        # Extract the base escribemeetings URL (e.g., https://pub-brampton.escribemeetings.com)
        # The crawler expects the base domain — it appends /?Year={year} itself.
        import re
        base_urls = set()
        for r in hits:
            match = re.match(r"(https?://[^/]*escribemeetings\.com)", r["href"])
            if match:
                base_urls.add(match.group(1))
        print(f"  [{city}] Found {len(hits)} result(s) on escribemeetings.com:")
        for r in hits:
            print(f"    - {r['href']}")
            output += f"- {r['title']}\n  URL: {r['href']}\n  {r['body'][:120]}\n\n"
        if base_urls:
            output += f"Base URL: {list(base_urls)[0]}\n\n"
    else:
        print(f"  [{city}] Not found on escribemeetings.com")
        output += "Not found on escribemeetings.com — must delegate to deep-search-agent.\n\n"
    return output


def search_escribe(cities: list[str]) -> str:
    """Search escribemeetings.com for a batch of cities in parallel."""
    print(f"\n[search_escribe] Searching for: {cities}")
    results = []
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {pool.submit(_search_single_city_escribe, city): city for city in cities}
        for future in as_completed(futures):
            results.append(future.result())
    return "".join(results)


def search_minutes_broad(city: str) -> str:
    """Broad search for a single city's council meeting minutes or agendas page."""
    print(f"\n[search_minutes_broad] Deep searching for: {city}")
    ddgs = DDGS()
    output = f"=== {city} ===\n"
    queries = [
        f"{city} Ontario escribemeetings.com council meetings",
        f"{city} Ontario council meeting minutes agendas portal",
        f"{city} Ontario municipal council minutes homepage",
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
        "Use this agent for any city where escribemeetings.com was not found "
        "or the result says 'must delegate to deep-search-agent'. "
        "Pass the city name and it will search for council meeting minutes or agendas."
    ),
    system_prompt=(
        "You are a specialist at finding municipal council meeting minutes and agenda pages. "
        "You will be given a single city name in Ontario, Canada not found on escribemeetings.com. "
        "Use the search tool to find its council meetings or minutes page — "
        "it may be on the city's official website or another portal. "
        "Run multiple queries if needed. "
        "Pick the single best, most official URL from the results. "
        "Do not fabricate URLs — only return URLs that appeared in search results."
    ),
    tools=[search_minutes_broad],
    model="grok-4.20-0309-reasoning",
)

find_mins_agent = create_deep_agent(
    model="grok-4-1-fast-non-reasoning",
    tools=[search_escribe],
    subagents=[deep_search_subagent],
    system_prompt=(
        "You are a council meeting minutes research agent for GTA municipalities. "
        "Your goal is to find the best link where council meeting minutes and agendas are published for each city. "
        "Most GTA cities use escribemeetings.com, but some use their own website or another portal — any source is valid. "
        "Step 1: Call search_escribe with all cities at once to check escribemeetings.com first. "
        "Step 2: For every city whose result says 'Not found on escribemeetings.com' or "
        "'must delegate to deep-search-agent', you MUST delegate that city to the deep-search-agent "
        "to find the best available council minutes link from any source. "
        "Do not skip any city — every city must have a URL in the final output. "
        "Step 3: Return a clean final list in this format:\n"
        "City: <name>\nURL: <url>\n\n"
        "Do not guess or fabricate URLs — only include URLs found in search results."
    ),
)
