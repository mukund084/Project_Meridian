import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        print("Navigating...")
        await page.goto("https://pub-brampton.escribemeetings.com/meetingscalendarview.aspx?Year=2025", wait_until="networkidle")
        
        # Click the first toggle
        toggles = page.locator(".PastMeetingTypesName")
        count = await toggles.count()
        print(f"Toggles: {count}")
        if count > 0:
            await toggles.nth(0).evaluate("el => el.click()")
            try:
                await page.wait_for_load_state("networkidle", timeout=5000)
            except:
                pass
                
        # Find calendar items
        items = page.locator(".calendar-item")
        count = await items.count()
        print(f"Total items: {count}")
        
        for i in range(min(5, count)):
            item = items.nth(i)
            # Find all links
            links = await item.locator("a").evaluate_all(
                "els => els.map(el => ({href: el.href, text: el.innerText}))"
            )
            print(f"--- Item {i} Links ---")
            for link in links:
                print(link)
                
        await browser.close()
        
asyncio.run(main())
