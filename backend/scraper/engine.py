import os
import asyncio
from playwright.async_api import async_playwright
from dotenv import load_dotenv

load_dotenv()

SCRAPER_API_KEY = os.getenv("SCRAPER_API_KEY")

from utils.exceptions import (
    LinkedInError, ProfileNotFoundError, AccountRestrictedError, 
    SessionExpiredError, ActionTimeoutError, ProxyError
)
from utils.logger import logger

class LinkedInScraper:
    def __init__(self, headless=True):
        self.headless = headless
        self.browser = None
        self.context = None

    async def init_browser(self, proxy_url=None):
        try:
            playwright = await async_playwright().start()
            
            # Use ScraperAPI proxy if provided or available in env
            proxy = None
            if proxy_url:
                proxy = {"server": proxy_url}
            elif SCRAPER_API_KEY:
                proxy = {"server": f"http://scraperapi:{SCRAPER_API_KEY}@proxy-server.scraperapi.com:8001"}

            self.browser = await playwright.chromium.launch(
                headless=self.headless,
                proxy=proxy
            )
            self.context = await self.browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            )
            logger.info("Playwright browser and context initialized.")
        except Exception as e:
            logger.error(f"Failed to initialize browser: {e}")
            raise ProxyError(f"Browser initialization failed: {e}")

    async def _check_page_errors(self, page):
        """Internal helper to check for common LinkedIn blocking/errors."""
        url = page.url
        content = await page.content()

        if "linkedin.com/login" in url:
            logger.warning("Redirected to login page. Session expired.")
            raise SessionExpiredError("Session has expired or is invalid.")

        if "checkpoint/lg/login-submit" in url or "checkpoint/rm/checkpoint-submit" in url:
            logger.error("Account restricted or checkpoint hit.")
            raise AccountRestrictedError("LinkedIn account restricted or security checkpoint encountered.")

        if "Page not found" in content or "This profile is not available" in content:
            logger.warning(f"Profile not found: {url}")
            raise ProfileNotFoundError(f"LinkedIn profile not found: {url}")

    async def set_cookies(self, cookie_str):
        cookies = []
        for cookie in cookie_str.split(";"):
            if "=" in cookie:
                name, value = cookie.strip().split("=", 1)
                cookies.append({
                    "name": name,
                    "value": value,
                    "domain": ".linkedin.com",
                    "path": "/"
                })
        await self.context.add_cookies(cookies)
        logger.info("Injected session cookies.")

    async def login_with_credentials(self, email, password):
        page = await self.context.new_page()
        try:
            await page.goto("https://www.linkedin.com/login")
            await page.fill("#username", email)
            await page.fill("#password", password)
            await page.click("button[type='submit']")
            await page.wait_for_load_state("networkidle")
            
            if "checkpoint" in page.url:
                logger.error("2FA or checkpoint required for login.")
                return {"success": False, "error": "2FA_REQUIRED"}
            
            cookies = await self.context.cookies()
            logger.info(f"Successful login for {email}")
            return {"success": True, "cookies": cookies}
        finally:
            await page.close()

    async def scrape_profile(self, profile_url):
        page = await self.context.new_page()
        try:
            logger.info(f"Scraping profile: {profile_url}")
            await page.goto(profile_url, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_load_state("networkidle", timeout=15000)
            
            await self._check_page_errors(page)

            full_name = "Unknown"
            headline = ""
            
            # Try multiple name selectors (LinkedIn A/B tests these)
            name_selectors = [
                "h1.text-heading-xlarge",
                "h1.inline.t-24",
                "h1.top-card-layout__title",
                "h1.profile-topcard__name",
                "h1[data-test-id='profile-name']"
            ]
            
            for selector in name_selectors:
                el = await page.query_selector(selector)
                if el:
                    text = await el.inner_text()
                    if text and text.strip():
                        full_name = text.strip()
                        break
            
            # Try multiple headline selectors
            headline_selectors = [
                "div.text-body-medium",
                "div[data-test-id='headline']",
                "div.profile-topcard__headline",
                "div.top-card-layout__headline",
                "h2.text-heading-medium"
            ]
            
            for selector in headline_selectors:
                el = await page.query_selector(selector)
                if el:
                    text = await el.inner_text()
                    if text and text.strip():
                        headline = text.strip()
                        break

            # Also try to get company and title if available
            company = ""
            title = ""

            title_selectors = [
                "div[data-test-id='experience-section'] li:first-child .experience-item__title",
                "div[data-test-id='experience-section'] li:first-child .t-bold span[aria-hidden]",
                "section[data-section='experience'] li:first-child .t-bold span",
                ".pv-profile-section__list-item:first-child .pv-entity__summary-info h3",
                "div.pvs-list__item--line-separated:first-child .t-bold span",
            ]
            for selector in title_selectors:
                el = await page.query_selector(selector)
                if el:
                    text = await el.inner_text()
                    if text and text.strip():
                        title = text.strip()
                        break

            company_selectors = [
                "div[data-test-id='experience-section'] li:first-child .experience-item__subtitle",
                "div[data-test-id='experience-section'] li:first-child .t-14",
                "section[data-section='experience'] li:first-child .t-14.t-normal span[aria-hidden]",
                ".pv-profile-section__list-item:first-child .pv-entity__secondary-title",
                "div.pvs-list__item--line-separated:first-child .t-14 span[aria-hidden]",
            ]
            for selector in company_selectors:
                el = await page.query_selector(selector)
                if el:
                    text = await el.inner_text()
                    if text and text.strip():
                        company = text.strip()
                        break

            return {
                "full_name": full_name,
                "headline": headline,
                "title": title,
                "company": company,
                "profile_url": profile_url
            }
        except LinkedInError:
            raise
        except Exception as e:
            logger.error(f"Unexpected error scraping {profile_url}: {e}")
            raise LinkedInError(f"Scraping failed: {e}")
        finally:
            await page.close()

    async def send_connection_request(self, profile_url: str, message: str = None) -> dict:
        page = await self.context.new_page()
        try:
            logger.info(f"Sending connection request to: {profile_url}")
            await page.goto(profile_url, wait_until="domcontentloaded", timeout=30000)
            # Use a shorter networkidle wait — LinkedIn pages are heavy
            try:
                await page.wait_for_load_state("networkidle", timeout=8000)
            except Exception:
                pass  # Continue even if networkidle times out

            await self._check_page_errors(page)

            # LinkedIn renders Connect button with aria-label="Invite <Name> to connect"
            # or plain text "Connect" — try both
            connect_btn = page.locator(
                "button[aria-label*='Invite'][aria-label*='connect'], "
                "button[aria-label*='Connect'], "
                "button:has-text('Connect'), "
                "button[data-test-connect-button]"
            ).first

            if not await connect_btn.is_visible(timeout=5000):
                # Try "More" button dropdown (button is hidden behind "...")
                more_btn = page.locator(
                    "button[aria-label='More actions'], "
                    "button:has-text('More')"
                ).first

                if await more_btn.is_visible(timeout=3000):
                    await more_btn.click()
                    await page.wait_for_timeout(800)

                    connect_btn = page.locator(
                        "[role='menuitem']:has-text('Connect'), "
                        "div[role='button']:has-text('Connect'), "
                        ".artdeco-dropdown__item:has-text('Connect')"
                    ).first

            if not await connect_btn.is_visible(timeout=5000):
                logger.warning(f"Connect button not found for {profile_url}. Already connected or pending?")
                return {"success": False, "error": "CONNECT_BUTTON_NOT_FOUND"}

            await connect_btn.click()
            await page.wait_for_timeout(1500)

            if message:
                add_note_btn = page.locator(
                    "button:has-text('Add a note'), "
                    "button[aria-label*='note'], "
                    "button[data-test-add-note-button]"
                ).first

                if await add_note_btn.is_visible(timeout=3000):
                    await add_note_btn.click()
                    await page.wait_for_timeout(500)

                    note_box = page.locator(
                        "textarea#custom-message, "
                        "textarea[name='message'], "
                        "textarea.artdeco-text-input__input"
                    ).first

                    await note_box.wait_for(state="visible", timeout=5000)
                    await note_box.fill(message[:300])

            # Send button — LinkedIn uses "Send without a note" or "Send invitation"
            send_btn = page.locator(
                "button[aria-label='Send without a note'], "
                "button:has-text('Send without a note'), "
                "button:has-text('Send invitation'), "
                "button[aria-label='Send invitation'], "
                "button.artdeco-button--primary:has-text('Send')"
            ).first

            await send_btn.wait_for(state="visible", timeout=5000)
            await send_btn.click()
            await page.wait_for_timeout(2000)

            logger.info(f"Connection request sent to {profile_url}")
            return {"success": True}
        except LinkedInError:
            raise
        except Exception as e:
            logger.error(f"Failed to send connection to {profile_url}: {e}")
            raise ActionTimeoutError(f"Connection request action failed: {e}")
        finally:
            await page.close()

    async def send_message(self, profile_url: str, message: str) -> dict:
        page = await self.context.new_page()
        try:
            logger.info(f"Sending message to: {profile_url}")
            await page.goto(profile_url, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_load_state("networkidle", timeout=15000)
            
            await self._check_page_errors(page)

            # Message button selectors (updated 2024)
            msg_btn = page.locator(
                "button[aria-label^='Message '], "
                "button:has-text('Message'), "
                "button.msg-overlay-bubble-header__button, "
                "button[data-test-message-button]"
            ).first
            
            if not await msg_btn.is_visible(timeout=5000):
                # Check if already connected (message button only shows for 1st degree)
                connect_btn = page.locator("button:has-text('Connect')").first
                if await connect_btn.is_visible(timeout=2000):
                    raise LinkedInError("Profile not connected. Send connection request first.")
                else:
                    raise LinkedInError("Message button not found. Profile might not be a first-degree connection or LinkedIn UI changed.")
            
            await msg_btn.click()
            await page.wait_for_timeout(1000)

            # Compose area selectors (LinkedIn uses multiple patterns)
            compose = page.locator(
                "div.msg-form__contenteditable[contenteditable='true'], "
                "div[role='textbox'][data-placeholder], "
                "div.msg-form__msg-content-container [contenteditable], "
                "div[data-test-message-compose-area] [contenteditable], "
                "textarea.msg-form__textarea"
            ).first
            
            try:
                await compose.wait_for(state="visible", timeout=10000)
            except:
                # Try clicking the message button again (modal might need focus)
                await msg_btn.click()
                await page.wait_for_timeout(500)
                await compose.wait_for(state="visible", timeout=10000)
            
            await compose.click()
            await page.wait_for_timeout(300)
            
            # Clear any existing text and type
            await compose.fill("")  # Clear first
            await page.keyboard.type(message)
            await page.wait_for_timeout(500)

            # Send button selectors
            send_btn = page.locator(
                "button.msg-form__send-button, "
                "button[aria-label='Send'], "
                "button[type='submit'].msg-form__send-button, "
                "button[data-test-send-message], "
                "button.artdeco-button--primary:has-text('Send')"
            ).first
            
            # Wait for button to be enabled (not disabled due to empty message)
            for i in range(10):  # Try for 5 seconds
                is_enabled = await send_btn.is_enabled()
                if is_enabled:
                    break
                await page.wait_for_timeout(500)
            
            await send_btn.click()
            await page.wait_for_timeout(2500)

            logger.info(f"Message sent to {profile_url}")
            return {"success": True}
        except LinkedInError:
            raise
        except Exception as e:
            logger.error(f"Failed to send message to {profile_url}: {e}")
            raise ActionTimeoutError(f"Message action failed: {e}")
        finally:
            await page.close()

    async def scrape_leads_batch(self, search_url: str, max_leads: int = 50) -> dict:
        """Scrape leads from a LinkedIn search URL (Sales Navigator or regular search)."""
        page = await self.context.new_page()
        leads = []
        try:
            logger.info(f"Scraping leads from: {search_url}, max: {max_leads}")
            await page.goto(search_url, wait_until="domcontentloaded", timeout=60000)
            await page.wait_for_load_state("networkidle", timeout=30000)
            
            await self._check_page_errors(page)

            # Handle both regular search and Sales Navigator
            is_sales_navigator = "sales/navigator" in page.url or "linkedin.com/sales" in search_url
            
            scroll_count = 0
            max_scrolls = min(max_leads // 10 + 5, 50)  # Estimate: ~10 leads per scroll
            
            while len(leads) < max_leads and scroll_count < max_scrolls:
                if is_sales_navigator:
                    # Sales Navigator selectors
                    result_items = await page.query_selector_all("div[data-x-search-result='LEAD']")
                    for item in result_items[len(leads):max_leads]:
                        try:
                            name_el = await item.query_selector("span[data-analytics-control-name='name']")
                            title_el = await item.query_selector("span[data-analytics-control-name='title']")
                            company_el = await item.query_selector("span[data-analytics-control-name='company']")
                            link_el = await item.query_selector("a[href*='/sales/lead/']")
                            
                            name = await name_el.inner_text() if name_el else ""
                            title = await title_el.inner_text() if title_el else ""
                            company = await company_el.inner_text() if company_el else ""
                            profile_url = await link_el.get_attribute("href") if link_el else ""
                            
                            if name and profile_url:
                                leads.append({
                                    "full_name": name.strip(),
                                    "title": title.strip(),
                                    "company": company.strip(),
                                    "profile_url": f"https://www.linkedin.com{profile_url}" if profile_url.startswith("/") else profile_url,
                                    "source": "sales_navigator"
                                })
                        except Exception as e:
                            logger.warning(f"Error parsing lead item: {e}")
                            continue
                else:
                    # Regular LinkedIn search selectors (updated 2024)
                    # Try multiple selector patterns as LinkedIn A/B tests layouts
                    result_items = await page.query_selector_all(
                        "li.reusable-search__result-container, "
                        "div[data-chameleon-result-urn], "
                        "div.search-results__cluster-content > div, "
                        "div.entity-result"
                    )
                    
                    if not result_items:
                        # Fallback: try broader selector
                        result_items = await page.query_selector_all("div[data-test-search-results-container] > div > div")
                    
                    for item in result_items[len(leads):max_leads]:
                        try:
                            # Try multiple link patterns
                            link_el = await item.query_selector(
                                "a[href*='/in/'], "
                                "a.app-aware-link[href*='/in/'], "
                                "span.entity-result__title-text a"
                            )
                            
                            # Name selectors (LinkedIn uses various patterns)
                            name_el = await item.query_selector(
                                "span[dir='ltr'], "
                                "span[data-anonymize='name'], "
                                "a[href*='/in/'] span, "
                                ".entity-result__title-line span[aria-hidden]"
                            )
                            
                            # Headline/primary subtitle
                            headline_el = await item.query_selector(
                                "div.entity-result__primary-subtitle, "
                                "div.base-search-card__subtitle, "
                                "div[data-anonymize='headline'], "
                                "span[data-anonymize='headline']"
                            )
                            
                            name = await name_el.inner_text() if name_el else ""
                            headline = await headline_el.inner_text() if headline_el else ""
                            profile_url = await link_el.get_attribute("href") if link_el else ""
                            
                            # Clean up the data
                            name = name.replace("\\n", " ").strip()
                            headline = headline.replace("\\n", " ").strip()
                            
                            if name and profile_url:
                                leads.append({
                                    "full_name": name.strip(),
                                    "headline": headline.strip(),
                                    "profile_url": profile_url.split("?")[0] if profile_url else "",
                                    "source": "search"
                                })
                        except Exception as e:
                            logger.warning(f"Error parsing lead item: {e}")
                            continue

                # Scroll to load more
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await page.wait_for_timeout(2000)
                scroll_count += 1
                
                # Check if we've reached the end
                new_count = len(await page.query_selector_all(
                    "div[data-x-search-result='LEAD']" if is_sales_navigator else "div[data-chameleon-result-urn]"
                ))
                if new_count == len(leads):
                    break

            logger.info(f"Scraped {len(leads)} leads from search")
            return {
                "success": True,
                "leads_scraped": len(leads),
                "leads": leads,
                "search_url": search_url
            }
        except LinkedInError:
            raise
        except Exception as e:
            logger.error(f"Failed to scrape leads from {search_url}: {e}")
            raise ActionTimeoutError(f"Lead scraping failed: {e}")
        finally:
            await page.close()

    async def close(self):
        if self.browser:
            await self.browser.close()
            logger.info("Browser closed.")

