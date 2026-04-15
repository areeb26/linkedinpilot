class LinkedInError(Exception):
    """Base exception for LinkedIn scraper errors."""
    pass

class ProfileNotFoundError(LinkedInError):
    """Raised when a profile URL returns 404 or page not found text."""
    pass

class AccountRestrictedError(LinkedInError):
    """Raised when LinkedIn flags the account as restricted."""
    pass

class SessionExpiredError(LinkedInError):
    """Raised when the session is no longer valid (redirected to login)."""
    pass

class ActionTimeoutError(LinkedInError):
    """Raised when a specific automation action times out."""
    pass

class ProxyError(LinkedInError):
    """Raised when ScraperAPI or proxy fails."""
    pass
