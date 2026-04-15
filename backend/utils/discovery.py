import yfinance as yf
from duckduckgo_search import DDGS

def get_financial_info(symbol: str):
    """
    Retrieves financial info for a stock symbol using yfinance.
    """
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        return {
            "symbol": symbol,
            "currentPrice": info.get("currentPrice"),
            "marketCap": info.get("marketCap"),
            "sector": info.get("sector")
        }
    except Exception as e:
        print(f"yfinance error: {e}")
        return None

def find_procurement_portals(company_name: str):
    """
    Finds recruitment/procurement portal URLs using DuckDuckGo.
    """
    try:
        with DDGS() as ddgs:
            query = f"{company_name} procurement portal supplier login"
            results = list(ddgs.text(query, max_results=5))
            return [res['href'] for res in results]
    except Exception as e:
        print(f"DuckDuckGo search error: {e}")
        return []
