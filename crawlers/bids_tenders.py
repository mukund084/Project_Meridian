import asyncio
import json
import random
import re

from crawlee import ConcurrencySettings
from crawlee.configuration import Configuration
from crawlee.crawlers import PlaywrightCrawler, PlaywrightCrawlingContext
from models.bids_and_tendors import BidsAndTenders
from db.upsert import upsert_bid


async def run_markham_scraper(year_or_start_date, end_date=None, status="All", base_url="", city: str = "") -> None:
    """
    Main scraper execution.
    Examples:
        run_markham_scraper(2025, status="Closed") -> Filters 01/01/2025 to 12/31/2025
        run_markham_scraper("01/01/2026", "12/31/2026", "All")
    """
    # 1. Parse the dates based on exactly what you passed in!
    if isinstance(year_or_start_date, int) or (isinstance(year_or_start_date, str) and len(year_or_start_date) == 4):
        crawl_year = int(year_or_start_date)
        date_from = f"01/01/{year_or_start_date}"
        date_to = f"12/31/{year_or_start_date}"
    else:
        # Extract year from date string like "01/01/2026"
        crawl_year = int(year_or_start_date.split("/")[-1]) if year_or_start_date else 0
        date_from = year_or_start_date
        date_to = end_date

    print(f"--- Starting Scraper --- Filters: Status='{status}', Dates='{date_from}' to '{date_to}'")

    crawler = PlaywrightCrawler(
        headless=True,
        max_requests_per_crawl=500,
        max_request_retries=10,
        concurrency_settings=ConcurrencySettings(max_concurrency=5, desired_concurrency=5),
        configuration=Configuration(purge_on_start=True),
    )

    @crawler.router.default_handler
    async def listing_handler(context: PlaywrightCrawlingContext) -> None:
        """Handles the listing page — wait for JS to load, set filters, and paginate."""
        context.log.info(f"Listing page: {context.request.url}")
        page = context.page

        # Helper to safely wait for AJAX grid reloads. 
        # BidsAndTenders uses FuelUX Repeater. The easiest way to avoid races is a hard networkidle + short pause.
        async def wait_for_grid_reload():
            await page.wait_for_timeout(500)
            try:
                await page.wait_for_load_state("networkidle", timeout=8000)
            except Exception:
                pass
            await page.wait_for_selector(".repeater-canvas", state="visible")
            await page.wait_for_timeout(1000)

        # 1. Wait for initial table to load
        # Using a broader selector so it doesn't fail if the grid is initially empty
        await page.wait_for_selector(".repeater-canvas", state="visible")

        # 2. Apply Status Filter
        # NOTE: The site DEFAULTS to "Open", not "All". So we ALWAYS click the dropdown.
        if status:
            context.log.info(f"Switching status filter to: {status}")
            await page.locator("#searchfilter button.dropdown-toggle").click()
            # The "All" option has data-property="all" (lowercase), others match their label
            prop = "all" if status == "All" else status
            await page.locator(f'#searchfilter ul li[data-property="{prop}"] a').click(force=True)
            await page.wait_for_selector(".repeater-canvas", state="visible")

        # 3. Apply Dates (via Advanced Search)
        if date_from or date_to:
            context.log.info("Applying Date Filters...")
            if not await page.locator("#DateFrom").is_visible():
                await page.locator("a.advanced-link").click(force=True)
                await page.wait_for_selector("#DateFrom", state="visible")

            if date_from:
                await page.locator("#DateFrom").fill(date_from)
            if date_to:
                await page.locator("#DateTo").fill(date_to)
                
            # Click the main search (magnifying glass) to apply the dates! 
            # (Pressing Enter doesn't consistently trigger the AJAX repeater update).
            async with page.expect_response(re.compile(r".*", re.IGNORECASE), timeout=15000):
                await page.locator("#btnsearch").click(force=True)
            await wait_for_grid_reload()

        # 4. Expand to 100 items per page to speed things up
        context.log.info("Expanding to 100 results per page...")
        await page.locator(".repeater-itemization button.dropdown-toggle").click(force=True)
        async with page.expect_response(re.compile(r".*", re.IGNORECASE), timeout=15000):
            await page.locator('.repeater-itemization ul li[data-value="100"] a').click(force=True)
        await wait_for_grid_reload()

        # 5. PAGINATION LOOP (Scrape all pages)
        page_num = 1
        while True:
            context.log.info(f"Extracting links from Page {page_num}...")

            # Make sure grid is ready and not loading
            await page.wait_for_selector(".repeater-canvas", state="visible")

            # Enqueue all matching detail pages on the current page
            await context.enqueue_links(
                include=[re.compile(r".*/Tender/Detail/.*", re.IGNORECASE)],
                label="detail",
            )

            # Check if there is a 'Next' button and if it is disabled
            next_btn = page.locator("button.repeater-next")
            is_disabled = await next_btn.get_attribute("disabled")

            if is_disabled is not None:
                context.log.info("Reached the last page. Scraping initialized!")
                break  # Reached the end!

            # Click next and wait for the table to reload
            context.log.info("Moving to next page...")
            async with page.expect_response(re.compile(r".*", re.IGNORECASE), timeout=15000):
                await next_btn.click(force=True)
            await page.wait_for_selector(".repeater-canvas", state="visible")
            page_num += 1

    @crawler.router.handler("detail")
    async def detail_handler(context: PlaywrightCrawlingContext) -> None:
        """Handles individual bid detail pages and extracts info to Pydantic model."""
        context.log.info(f"Detail page: {context.request.url}")
        if context.response is None or context.response.status != 200:
            status = context.response.status if context.response else "None"
            await asyncio.sleep(random.uniform(3, 8))
            raise ValueError(f"HTTP {status} — retrying {context.request.url}")
        page = context.page
        await page.wait_for_selector('table[aria-label="Bid Details"]', state="visible", timeout=15000)
        bid_details = page.locator('table[aria-label="Bid Details"]')

        async def get_val(label: str) -> str | None:
            loc = bid_details.locator(f'tr:has(th:has-text("{label}")) td').first
            if await loc.count() > 0:
                text = await loc.inner_text()
                return text.strip() if text else None
            return None

        title = await page.title()
        html_content = await page.content()

        purchasing_rep = None
        rep_match = re.search(
            r"this\.PurchasingReps.*?proxy:new Ext\.data\.PagingMemoryProxy\((.*?),\s*false", html_content
        )
        if rep_match:
            try:
                rep_data = json.loads(rep_match.group(1))
                if rep_data:
                    purchasing_rep = {
                        "name": rep_data[0].get("FullName", ""),
                        "contact_email": rep_data[0].get("Email", ""),
                    }
            except json.JSONDecodeError:
                pass

        plan_takers = []
        pt_match = re.search(r"this\.PlanTakers.*?proxy:new Ext\.data\.PagingMemoryProxy\((.*?),\s*false", html_content)
        if pt_match:
            try:
                pt_data = json.loads(pt_match.group(1))
                plan_takers = [
                    {
                        "company_name": pt.get("CompanyName", ""),
                        "contact_address": f"{pt.get('Address1', '')}, {pt.get('City', '')}",
                    }
                    for pt in pt_data
                ]
            except json.JSONDecodeError:
                pass

        bids_submitted = []
        sub_match = re.search(r"this\.Submitted.*?proxy:new Ext\.data\.PagingMemoryProxy\((.*?),\s*false", html_content)
        if sub_match:
            try:
                sub_data = json.loads(sub_match.group(1))
                bids_submitted = [
                    {
                        "company_name": sub.get("CompanyName", ""),
                        "contact_address": f"{sub.get('Address1', '')}, {sub.get('City', '')}",
                        "result": sub.get("VerifiedValue", "").replace("<br>", "").strip(),
                    }
                    for sub in sub_data
                ]
            except json.JSONDecodeError:
                pass

        bid_data = BidsAndTenders(
            city=city,
            year=crawl_year,
            bid_name=await get_val("Bid Name:") or "Unknown",
            bid_status=await get_val("Bid Status:") or "Unknown",
            bid_closing_date=await get_val("Bid Closing Date:") or "Unknown",
            bid_url=context.request.url,
            bid_type=await get_val("Bid Type:"),
            bid_number=await get_val("Bid Number:"),
            published_date=await get_val("Published Date:"),
            question_deadline=await get_val("Question Deadline:"),
            bid_pricing=await get_val("Bid Pricing:"),
            electronic_auctions=await get_val("Electronic Auctions:"),
            language_for_bid_submissions=await get_val("Language for Bid Submissions:"),
            submission_type=await get_val("Submission Type:"),
            submission_address=await get_val("Submission Address:"),
            public_opening=await get_val("Public Opening:"),
            description=await get_val("Description:"),
            bid_document_access=await get_val("Bid Document Access:"),
            purchasing_representive=purchasing_rep,
            plan_takers=plan_takers if len(plan_takers) > 0 else None,
            bids_submitted=bids_submitted if len(bids_submitted) > 0 else None,
        )

        print(f"\n--- Extracted: {bid_data.bid_name} ---")
        print(bid_data.model_dump_json(indent=2, exclude_none=True))
        await context.push_data(bid_data.model_dump())
        upsert_bid(bid_data)

    # Start the crawl
    await crawler.run([base_url])


if __name__ == "__main__":
    # --- CHANGE THIS to control what gets scraped ---
    #
    # Pass a year:          run_markham_scraper(2025, status="Closed")
    # Pass specific dates:  run_markham_scraper("01/01/2026", "02/02/2026", status="All")
    # Status options: "All", "Open", "Closed", "Awarded", "Cancelled", "Planned", "Archived"
    asyncio.run(run_markham_scraper(2025, status="All", base_url="https://brampton.bidsandtenders.ca/Module/Tenders/en", city="Brampton"))

    # Example 2: Passing specific dates
    # asyncio.run(run_markham_scraper("01/01/2026", "02/02/2026", status="All"))

    # Default example (run on entire year so far)
    # asyncio.run(run_markham_scraper(2026, status="All"))
