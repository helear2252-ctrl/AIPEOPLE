import os
import json

class AIProvider:
    def __init__(self, demo_mode=True):
        self.demo_mode = demo_mode
        self.default_reply = (
            "我是 NOVA AI，目前正在 Demo Mode。未來我可以整合 "
            "Gemini、OpenAI、語音、嘴型同步與真人數位人動畫。"
        )

    def generate_response(self, prompt: str, provider: str = "gemini") -> str:
        """
        Generates text response using selected provider (Gemini or OpenAI).
        """
        if self.demo_mode:
            return self.default_reply
        
        # Placeholder logic for API integration
        if provider.lower() == "gemini":
            return f"[Gemini Mock Response to: '{prompt}'] This is where Gemini API will respond."
        elif provider.lower() == "openai":
            return f"[OpenAI Mock Response to: '{prompt}'] This is where OpenAI API will respond."
        else:
            return f"[Mock Response to: '{prompt}'] Unknown provider."

    def connect_gemini(self, api_key: str) -> bool:
        """
        Validates Gemini API connectivity.
        """
        if not api_key:
            return False
        # Mock connection validation
        return True

    def connect_openai(self, api_key: str) -> bool:
        """
        Validates OpenAI API connectivity.
        """
        if not api_key:
            return False
        # Mock connection validation
        return True
