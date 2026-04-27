import asyncio
import random
import string
from playwright.async_api import async_playwright

def get_random_string(length):
    letters = string.ascii_lowercase
    return ''.join(random.choice(letters) for i in range(length))

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Use a persistent context or just stay in this session
        page = await browser.new_page()
        
        email = f"test_{get_random_string(5)}@example.com"
        password = "Password123!"
        
        print(f"1. Navigating to http://localhost:5174/ (using email: {email})")
        try:
            await page.goto("http://localhost:5174/", timeout=30000)
            await page.wait_for_load_state("networkidle")
            
            # Switch to Sign Up
            print("2. Switching to Sign Up...")
            create_account_btn = await page.query_selector("text=Create one")
            if create_account_btn:
                await create_account_btn.click()
                await asyncio.sleep(1)
            
            print("3. Filling in details...")
            await page.fill('input[type="email"]', email)
            await page.fill('input[type="password"]', password)
            
            print("4. Submitting...")
            await page.click('button[type="submit"]')
            
            # Wait for navigation to dashboard
            print("Waiting for dashboard...")
            await page.wait_for_url("**/dashboard", timeout=30000)
            print("Successfully logged in/signed up!")
            
            # Navigate to Campaigns
            print("5. Navigating to Campaigns...")
            await page.goto("http://localhost:5174/campaigns", timeout=10000)
            await page.wait_for_load_state("networkidle")
            
            # Verify campaigns list
            print("6. Verifying campaigns list...")
            text_campaigns = await page.evaluate("document.body.innerText")
            if "No campaigns found" in text_campaigns:
                print("No campaigns found (expected for new user).")
                
                # Create a test campaign
                print("7. Creating a test campaign...")
                create_btn = await page.query_selector('text="Create new Campaign"')
                if create_btn:
                    await create_btn.click()
                    await page.wait_for_url("**/campaigns/new", timeout=10000)
                    print("On Campaign Builder page.")
                    
                    # Fill campaign name (wait for it)
                    # The wizard might need a name first or it might be in a later step
                    # Let's check what's on the page
                    builder_text = await page.evaluate("document.body.innerText")
                    print(f"Builder text: {builder_text[:200]}")
                    
            else:
                print("Found existing campaigns!")
                # ... check campaign rows ...
                
            # Take a screenshot for confirmation
            await page.screenshot(path="campaigns_verify.png")
            print("Screenshot saved to campaigns_verify.png")
                
        except Exception as e:
            print(f"Error: {e}")
            # Capture error screenshot
            await page.screenshot(path="error_verify.png")
        finally:
            await browser.close()

asyncio.run(run())