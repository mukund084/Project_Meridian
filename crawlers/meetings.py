import asyncio
import re
from crawlee.configuration import Configuration
from crawlee.crawlers import PlaywrightCrawler, PlaywrightCrawlingContext
from models.meetings import Document
from db.upsert import upsert_meeting
from datetime import timedelta


async def find_meetings(base_url: str, year: int, city: str = "Markham") -> list[dict]:
    """
    Scrapes the Markham meetings calendar for a given year.
    Example: find_meetings(2025)
    """
    if not isinstance(year, int):
        raise ValueError("Year must be an integer, e.g. find_meetings(2025)")

    # The year is baked directly into the URL — this is where #PastMeetings lives
    start_url = f"{base_url}/?Year={year}"
    print(f"--- Starting Scraper --- Year='{year}' → {start_url}")

    collected: list[dict] = []

    crawler = PlaywrightCrawler(
        headless=True,
        max_requests_per_crawl=500,
        max_request_retries=3,
        request_handler_timeout=timedelta(minutes=3),
        configuration=Configuration(purge_on_start=True),
    )

    @crawler.router.default_handler
    async def meetings_handler(context: PlaywrightCrawlingContext) -> None:
        context.log.info(f"Meetings page: {context.request.url}")
        page = context.page

        # Wait for the Past Meeting group toggles to appear
        context.log.info("Waiting for Past Meeting toggles to appear...")
        try:
            await page.wait_for_selector(".PastMeetingTypesName", state="attached", timeout=10000)
        except Exception:
            # Some cities (e.g. Caledon) default to "Upcoming" view —
            # click the "Past" button to load the Past Meetings accordion.
            context.log.info("Past toggles not found — clicking #btnPastView...")
            try:
                await page.evaluate("document.getElementById('btnPastView')?.click()")
                await page.wait_for_load_state("networkidle", timeout=15000)
                await page.wait_for_selector(".PastMeetingTypesName", state="attached", timeout=15000)
            except Exception:
                context.log.warning("Could not load Past Meetings section — returning empty.")
                return
        context.log.info("Past Meeting toggles found!")

        # --- Step 1: Expand each past meeting group and scrape internally ---
        # Note: Escribe only keeps ONE group open at a time. Each click causes a server side reload.
        # We must click, wait for the reload, and then scrape the visible elements for THAT group.
        total_groups = await page.locator(".PastMeetingTypesName").count()
        print(f"Found {total_groups} meeting groups to explore.")

        seen_pdf_urls = set()

        for i in range(total_groups):
            meeting_group = page.locator(".PastMeetingTypesName").nth(i)
            # Use javascript click to completely bypass Playwright's visibility and scrolling checks!
            await meeting_group.evaluate("el => el.click()")
            
            # Wait for ASP.NET postback to complete.
            try:
                await page.wait_for_load_state("networkidle", timeout=5000)
            except Exception:
                pass
                
            # --- Step 2: Iterate over calendar items to extract title/date + PDF links ---
            total_items = await page.locator(".calendar-item").count()
            
            for j in range(total_items):
                item = page.locator(".calendar-item").nth(j)
                
                # Title might be inside an <a> tag or just inside the heading
                title_el = item.locator(".meeting-title-heading")
                date_el = item.locator(".meeting-date")

                meeting_title = (await title_el.inner_text()).strip() if await title_el.count() > 0 else ""
                meeting_date = (await date_el.inner_text()).strip() if await date_el.count() > 0 else ""
                
                # Skip items not in the requested year to fix the "Upcoming Meetings" bug
                if str(year) not in meeting_date:
                    continue

                total_links = await item.locator("a.link[href*='FileStream.ashx']").count()

                for k in range(total_links):
                    link = item.locator("a.link[href*='FileStream.ashx']").nth(k)
                    href = await link.get_attribute("href")
                    
                    if not href or href in seen_pdf_urls:
                        continue
                        
                    seen_pdf_urls.add(href)
                    
                    aria = await link.get_attribute("aria-label") or ""
                    document_type = ""
                    type_match = re.search(r"^(.*?)\s+for\s+", aria)
                    if type_match:
                        document_type = type_match.group(1).strip()
                    else:
                        document_type = aria.strip()

                    print(f"  📄 {meeting_title} | {meeting_date} | {document_type}")

                    try:
                        doc = Document(
                            city=city,
                            year=year,
                            meeting_title=meeting_title,
                            meeting_date=meeting_date,
                            document_type=document_type,
                            pdf_url=f"{base_url}/{href}" if not href.startswith("http") else href,
                        )
                        collected.append(doc.model_dump(mode="json"))
                        await context.push_data(doc.model_dump(mode="json"))
                        upsert_meeting(doc)
                    except Exception as e:
                        context.log.warning(f"Could not parse document: {e} | Raw label: {aria}")

    await crawler.run([start_url])
    return collected


if __name__ == "__main__":
    asyncio.run(find_meetings("https://pub-caledon.escribemeetings.com/", 2025))
