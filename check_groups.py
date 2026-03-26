import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        print("Navigating...")
        await page.goto("https://pub-brampton.escribemeetings.com/meetingscalendarview.aspx?Year=2025", wait_until="networkidle")
        
        # Expand all toggles correctly using wait_for_response to ensure we don't proceed too fast
        toggles = page.locator(".PastMeetingTypesName")
        count = await toggles.count()
        print(f"Total toggles: {count}")
        for i in range(count):
            try:
                await toggles.nth(i).click()
                await page.wait_for_load_state("networkidle", timeout=2000)
            except:
                pass
                
        items = page.locator(".calendar-item")
        total_items = await items.count()
        print(f"Total items: {total_items}")
        
        all_links = await page.locator("a").evaluate_all(
            "els => els.map(el => ({href: el.href, text: el.innerText}))"
        )
        suspicious_links = []
        for link in all_links:
            href = link['href'].lower()
            if 'pdf' in href or 'pdf' in link['text'].lower() or 'document' in href or 'filestream' in href:
                suspicious_links.append(link)
                
        # Group by unique href to reduce noise
        unique_links = {l['href']: l['text'] for l in suspicious_links}
        print(f"Found {len(unique_links)} potential PDF links.")
        for href, text in list(unique_links.items())[:20]:
            print(f"- {text}: {href}")
            
        await browser.close()
        
asyncio.run(main())
