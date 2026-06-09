import requests
import json
import random
import os

class ResearchLayer:
    """
    Unified Research Layer for NOVA AI.
    Analyzes queries, coordinates modular search sources (Tavily, SerpAPI, Google, etc.),
    and provides contextual responses or falls back to domain-specific Demo Mode.
    """
    def __init__(self, avatar_interface):
        self.avatar_interface = avatar_interface

    def perform_search(self, query: str) -> dict:
        """
        Main query research portal. Detects API config and queries the web
        or triggers simulated Demo Mode context.
        """
        settings = self.avatar_interface.load_settings()
        provider = settings.get("search_provider", "Tavily")
        api_key = settings.get("search_api_key", "").strip()

        # If API key is empty or placeholder, run in Demo Mode
        if not api_key or api_key.startswith("your_") or api_key == "placeholder":
            return self._perform_demo_search(query, provider)

        # Call live search provider APIs
        try:
            if provider == "Tavily":
                return self._query_tavily(query, api_key)
            elif provider == "SerpAPI":
                return self._query_serpapi(query, api_key)
            elif provider == "Google":
                return self._query_google(query, api_key)
            elif provider == "Brave":
                return self._query_brave(query, api_key)
            else:
                # Fallback to demo mode if unsupported or generic
                return self._perform_demo_search(query, f"{provider} (Mocked Live)")
        except Exception as e:
            # Prevent crashes by falling back to demo mode on network errors
            demo_results = self._perform_demo_search(query, f"{provider} (Error Fallback)")
            demo_results["error"] = str(e)
            return demo_results

    def _query_tavily(self, query: str, api_key: str) -> dict:
        url = "https://api.tavily.com/search"
        payload = {
            "api_key": api_key,
            "query": query,
            "search_depth": "basic",
            "include_answer": False
        }
        res = requests.post(url, json=payload, timeout=8)
        if res.ok:
            data = res.json()
            results = []
            for r in data.get("results", []):
                results.append({
                    "title": r.get("title", "No Title"),
                    "url": r.get("url", "#"),
                    "snippet": r.get("content", "")
                })
            return {
                "query": query,
                "provider": "Tavily",
                "results": results,
                "demo_mode": False
            }
        else:
            raise Exception(f"Tavily returned status {res.status_code}: {res.text}")

    def _query_serpapi(self, query: str, api_key: str) -> dict:
        url = "https://serpapi.com/search"
        params = {
            "q": query,
            "api_key": api_key,
            "engine": "google"
        }
        res = requests.get(url, params=params, timeout=8)
        if res.ok:
            data = res.json()
            results = []
            for r in data.get("organic_results", [])[:5]:
                results.append({
                    "title": r.get("title", "No Title"),
                    "url": r.get("link", "#"),
                    "snippet": r.get("snippet", "")
                })
            return {
                "query": query,
                "provider": "SerpAPI",
                "results": results,
                "demo_mode": False
            }
        else:
            raise Exception(f"SerpAPI returned status {res.status_code}")

    def _query_google(self, query: str, api_key: str) -> dict:
        # Standard Google Custom Search API
        # Requires Cx (Custom Search Engine ID) from settings or environment
        cx = os.environ.get("GOOGLE_CSE_ID", "")
        if not cx:
            raise Exception("Google CSE ID environment variable (GOOGLE_CSE_ID) is not set")
        url = "https://www.googleapis.com/customsearch/v1"
        params = {
            "q": query,
            "key": api_key,
            "cx": cx
        }
        res = requests.get(url, params=params, timeout=8)
        if res.ok:
            data = res.json()
            results = []
            for r in data.get("items", [])[:5]:
                results.append({
                    "title": r.get("title", "No Title"),
                    "url": r.get("link", "#"),
                    "snippet": r.get("snippet", "")
                })
            return {
                "query": query,
                "provider": "Google Custom Search",
                "results": results,
                "demo_mode": False
            }
        else:
            raise Exception(f"Google Search returned status {res.status_code}")

    def _query_brave(self, query: str, api_key: str) -> dict:
        url = "https://api.search.brave.com/res/v1/web/search"
        headers = {
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": api_key
        }
        params = {"q": query}
        res = requests.get(url, headers=headers, params=params, timeout=8)
        if res.ok:
            data = res.json()
            results = []
            for r in data.get("web", {}).get("results", [])[:5]:
                results.append({
                    "title": r.get("title", "No Title"),
                    "url": r.get("url", "#"),
                    "snippet": r.get("description", "")
                })
            return {
                "query": query,
                "provider": "Brave Search",
                "results": results,
                "demo_mode": False
            }
        else:
            raise Exception(f"Brave Search returned status {res.status_code}")

    def _perform_demo_search(self, query: str, provider_label: str) -> dict:
        """
        Research Demo Mode. Matches keywords to return realistic simulated articles.
        """
        lower = query.toLowerCase() if hasattr(query, "toLowerCase") else query.lower()
        results = []
        domain = "General Business & News"

        # Domain 1: Stocks & Finance
        if any(kw in lower for kw in ["stock", "price", "finance", "nasdaq", "dow", "market", "rate", "dividend", "financial"]):
            domain = "Financial Markets & Stocks"
            results = [
                {
                    "title": "NASDAQ Market Report: Tech Sectors Lead Gains",
                    "url": "https://finance-news-hub.mock/nasdaq-report",
                    "snippet": "Tech stocks rallied 1.8% today with semiconductors and AI infrastructure providers showing high volume. Investors remain focused on upcoming federal interest rate adjustments."
                },
                {
                    "title": "Stock Performance Indices and Dividend Yield Analysis",
                    "url": "https://financial-indices.mock/analysis",
                    "snippet": "Corporate earnings reports show high-tech assets yielding average dividends of 2.1%. Risk ratios have cooled slightly amid stable consumer data releases."
                }
            ]
        # Domain 2: AI Industry Trends
        elif any(kw in lower for kw in ["ai ", "artificial", "llm", "gpt", "assistant", "deep learning", "neural", "nvidia"]):
            domain = "AI Industry & Technology Trends"
            results = [
                {
                    "title": "Enterprise AI Assistant Adoption Reaches 48% Growth",
                    "url": "https://ai-insights.mock/enterprise-adoption",
                    "snippet": "Recent industry polls indicate corporate deployments of cognitive digital human systems and administrative assistants have grown at 48% CAGR, saving average executive hours by 30%."
                },
                {
                    "title": "NVIDIA Core Architecture and LLM Scalability Index",
                    "url": "https://gpu-architecture.mock/llm-scaling",
                    "snippet": "New tensor core infrastructure reports indicate a 4x reduction in inference latencies, streamlining local deployments of complex voice and digital human animations."
                }
            ]
        # Domain 3: Tech Documentation & Programming
        elif any(kw in lower for kw in ["code", "programming", "python", "javascript", "developer", "documentation", "api", "git", "fastapi", "streamlit"]):
            domain = "Software Engineering & Tech Docs"
            results = [
                {
                    "title": "FastAPI Background Threads: Best Practices",
                    "url": "https://fastapi-docs.mock/background-tasks",
                    "snippet": "When initializing background threads within async ASGI frameworks, utilize standard threading.Thread with daemon parameters to prevent application blocking during restarts."
                },
                {
                    "title": "Streamlit Layouts and Custom CSS Inject Guides",
                    "url": "https://streamlit-dev.mock/css-inject",
                    "snippet": "Apply custom HTML styling inside Streamlit via st.markdown(unsafe_allow_html=True) to override default primary colors, tab borders, and sidebars."
                }
            ]
        # Domain 4: Machine Learning & Data Analytics
        elif any(kw in lower for kw in ["machine learning", "regression", "analytics", "data analysis", "neural network", "dataset", "pandas", "numpy"]):
            domain = "Machine Learning & Analytics"
            results = [
                {
                    "title": "Practical Guides to Model Regression Evaluation Metrics",
                    "url": "https://ml-handbook.mock/regression-metrics",
                    "snippet": "Evaluate regression networks using Mean Squared Error (MSE) and R-squared values to assess residual variances and model accuracy indices."
                },
                {
                    "title": "Pandas Performance Hacks for Data Analytics Pipelines",
                    "url": "https://data-engineers.mock/pandas-perf",
                    "snippet": "Vectorizing column manipulations in python dataframes rather than iterating yields up to 100x speedups, optimizing live backend telemetry readings."
                }
            ]
        # Domain 5: Real-Time General News
        else:
            results = [
                {
                    "title": "Global Logistics Shift: Automated Supply Chains Expand",
                    "url": "https://world-logistics.mock/automation",
                    "snippet": "Major global transport networks report a 15% increase in automated terminal hand-offs, driven by automated IoT schedules and next-generation tracking grids."
                },
                {
                    "title": "Urban Infrastructure Developments: Eco-friendly Grids",
                    "url": "https://urban-futures.mock/green-infrastructure",
                    "snippet": "Municipal construction planning indices show smart grid and solar roadway integration schemes receiving increased capital budgets across metropolitan areas."
                }
            ]

        return {
            "query": query,
            "provider": f"{provider_label} (Demo Mode)",
            "domain": domain,
            "results": results,
            "demo_mode": True
        }
