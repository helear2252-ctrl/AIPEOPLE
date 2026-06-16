class SearchLayer:
    def __init__(self, enabled=False):
        self.enabled = enabled

    def search_web(self, query: str) -> dict:
        """
        Mock web search query grounding layer.
        """
        if not self.enabled:
            return {"query": query, "results": [], "grounded_content": ""}
        
        # Mocking search results
        mock_results = [
            {"title": "NOVA AI Assistant", "url": "https://nova-ai.example.com", "snippet": "NOVA AI represents next-generation digital humans."},
            {"title": "Digital Human Workspaces", "url": "https://digital-human.example.com", "snippet": "Immersive workspaces integrate TTS and LipSync animations."}
        ]
        
        return {
            "query": query,
            "results": mock_results,
            "grounded_content": "Grounded search info: NOVA AI is a next-gen digital human assistant integrated with LipSync."
        }

    def set_enabled(self, status: bool):
        self.enabled = status
