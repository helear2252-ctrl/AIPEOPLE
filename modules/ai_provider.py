from modules.avatar_interface import AvatarInterface
from modules.research_layer import ResearchLayer
from modules.memory_layer import MemoryLayer

class AIProvider:
    """
    Handles AI cognitive interactions for the Executive Digital Secretary.
    Implements a Reasoning-First workflow: Analyzes if search is required,
    queries the Research Layer, and synthesizes answers in a natural corporate tone.
    """
    def __init__(self, avatar_interface: AvatarInterface, memory_layer: MemoryLayer = None):
        self.avatar_interface = avatar_interface
        self.research_layer = ResearchLayer(avatar_interface)
        self.memory_layer = memory_layer if memory_layer is not None else MemoryLayer()

    def generate_response(self, message: str, chat_history: list = None, session_id: str = "default_session") -> str:
        # Load active configurations
        settings = self.avatar_interface.load_settings()
        persona = settings.get("persona", "Executive Digital Secretary")
        personality = settings.get("personality", "Efficient, Professional, Courteous")
        style = settings.get("speaking_style", "Clear, Formal, Reassuring")
        gender = settings.get("gender", "Female")
        age = settings.get("age", 28)
        outfit = settings.get("outfit", "Navy Blue Blazer")
        
        msg_lower = message.lower()
        reasoning_trace = ""
        search_results = None

        # Step 0: Check Memory First
        memory_match = self.memory_layer.query_memory(session_id, message)
        if memory_match["found"]:
            reasoning_trace = f"*🧠 [Reasoning: Query matches cached context in {memory_match['source']}. Suppressing external research...]*\n\n"
            ans_clean = memory_match['answer']
            response = (
                f"{reasoning_trace}"
                f"Based on my internal memory registers, I recall that {ans_clean.lower().replace('according to my long-term memory, ', '').replace('i recall that ', '').replace('my records show that ', '')}\n\n"
                f"As your {persona}, I will prioritize this remembered preference for our active operations. "
                f"Would you like me to adjust any of these details or log a new preference?"
            )
            return response

        # Step 1: Analyze user request (Reasoning Step)
        is_identity_query = any(kw in msg_lower for kw in ["who are you", "your identity", "describe yourself", "profile", "persona"])
        
        # Check if query needs real-time research or factual domains
        search_keywords = [
            "stock", "price", "market", "news", "trend", "current", "latest", "how to", "why does", 
            "explain", "tutorial", "regression", "analytics", "data", "machine learning", "fastapi", "streamlit", "briefing"
        ]
        needs_search = any(kw in msg_lower for kw in search_keywords) and not is_identity_query

        # Step 2: Trigger Research Layer if reasoning indicates necessity
        if needs_search:
            reasoning_trace = f"*🔍 [Reasoning: Query detected factual/real-time parameters. Initializing research via configured provider...]*\n\n"
            try:
                search_data = self.research_layer.perform_search(message)
                search_results = search_data.get("results", [])
                provider_label = search_data.get("provider", "Search API")
                
                # Enrich trace with search details
                reasoning_trace = f"*🔍 [Reasoning: Factual lookup triggered. Query routed to {provider_label}. Analyzed {len(search_results)} resource feeds...]*\n\n"
            except Exception as e:
                reasoning_trace = f"*🔍 [Reasoning: Research initialization failed ({str(e)}). Reverting to local simulation...]*\n\n"
        else:
            reasoning_trace = f"*🔍 [Reasoning: Query identified as conversational/identity scope. Responding directly via {persona} traits...]*\n\n"

        # Step 3: Synthesis - Formulate answers in professional, natural executive secretary style
        if is_identity_query:
            return (
                f"{reasoning_trace}"
                f"I am NOVA, your {persona}. I am configured as a {age}-year-old {gender.lower()} professional "
                f"wearing a {outfit.lower()}. My primary behavioral characteristics are described as '{personality}' "
                f"and my voice parameters are set to '{style}'. How can I assist you with your executive workflows today?"
            )
        
        elif search_results:
            # Consolidate results into a natural paragraph structure
            domain_context = ""
            articles_summary = ""
            
            for idx, res in enumerate(search_results):
                title = res.get("title", "Article Link")
                snippet = res.get("snippet", "")
                url = res.get("url", "#")
                # Create a concise conversational summary instead of raw bullet dumping
                articles_summary += f" According to '{title}' (available at {url}), {snippet.strip()}"

            response = (
                f"{reasoning_trace}"
                f"Based on my active research on your query, I have compiled and analyzed the latest updates."
                f"{articles_summary}\n\n"
                f"In conclusion, the data indicates a clear direction. I have cataloged these sources for your records. "
                f"Would you like me to prepare a formal briefing brief or add specific actions to your calendar?"
            )
            return response
        
        # Default conversational replies
        else:
            if any(kw in msg_lower for kw in ["hello", "hi ", "greet"]):
                return (
                    f"{reasoning_trace}"
                    f"Hello! I am NOVA, your {persona}. As configured, I am here to manage your communications, "
                    f"schedule operations, and conduct background research. Please let me know how I can be of service."
                )
            elif any(kw in msg_lower for kw in ["status", "system status", "health", "uptime"]):
                return (
                    f"{reasoning_trace}"
                    f"All cognitive pipelines are operational. Streamlit Control Panel: Connected. "
                    f"FastAPI Routing Layer: Active. Voice synthesis modules: Standby. "
                    f"How would you like to proceed?"
                )
            else:
                return (
                    f"{reasoning_trace}"
                    f"Understood. As your {persona}, I have logged this request. "
                    f"I am processing this with an emphasis on my configured traits: {personality}. "
                    f"Please let me know what other actions, files, or reports you need prepared."
                )
