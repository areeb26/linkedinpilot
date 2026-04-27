import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        print("1. Navigating to http://localhost:5174/")
        try:
            await page.goto("http://localhost:5174/", timeout=10000)
            await page.wait_for_load_state("networkidle")
            
            # 2. Check if login page or dashboard is visible
            content = await page.content()
            title = await page.title()
            print(f"Page Title: {title}")
            
            # Check for common dashboard or login elements
            if "login" in content.lower() or "sign in" in content.lower():
                print("2. Login page is visible.")
                # We might need to login to proceed to Campaigns page
            elif "dashboard" in content.lower():
                print("2. Dashboard is visible.")
            else:
                print("2. Neither login nor dashboard clearly visible. Page content length: ", len(content))
                
            # Take a snapshot of text to see what is rendered
            text = await page.evaluate("document.body.innerText")
            print(f"Body text preview: {text[:500]}")
            
            # If login page, we can't proceed to Campaigns without auth, but we can check if there are links
            # Let's see if there's a link to Campaigns
            campaign_link = await page.query_selector('a:has-text("Campaigns"), a[href*="campaigns"]')
            if campaign_link:
                print("3. Found Campaigns link. Navigating...")
                await campaign_link.click()
                await page.wait_for_load_state("networkidle")
                print("On Campaigns page.")
            else:
                print("3. Could not find Campaigns link.")
                # Try navigating directly
                print("Navigating directly to http://localhost:5174/campaigns")
                await page.goto("http://localhost:5174/campaigns", timeout=10000)
                await page.wait_for_load_state("networkidle")
            
            # 4. Verify campaigns list
            text_campaigns = await page.evaluate("document.body.innerText")
            print("4. Checking campaigns list functionality...")
            print(f"Campaigns page text: {text_campaigns[:500]}")
            
            # 5. Try to click on a campaign
            # Find elements that look like campaign cards or rows
            cards = await page.query_selector_all('tr, .campaign-card, [role="row"], a[href*="/campaigns/"]')
            if cards and len(cards) > 0:
                print(f"5. Found {len(cards)} possible campaign elements. Trying to click one...")
                for card in cards:
                    if await card.is_visible():
                        await card.click()
                        await page.wait_for_load_state("networkidle")
                        print("Clicked successfully.")
                        text_detail = await page.evaluate("document.body.innerText")
                        print(f"Campaign detail page text: {text_detail[:200]}")
                        break
            else:
                print("5. No campaigns found to click.")
                
        except Exception as e:
            print(f"Error: {e}")
        finally:
            await browser.close()

asyncio.run(run())