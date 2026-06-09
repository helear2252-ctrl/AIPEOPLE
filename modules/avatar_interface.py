import json
import os

class AvatarInterface:
    """
    Encapsulates Digital Human settings reading, writing, and state validation.
    Keeps the Digital Human Layer isolated from backend logic.
    """
    def __init__(self, config_path: str):
        self.config_path = config_path

    def load_settings(self) -> dict:
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception as e:
            print(f"Error loading avatar settings: {e}")
        
        # Return default fallback settings
        return {
            "project_name": "NOVA AI",
            "subtitle": "Your Intelligent Digital Human Assistant",
            "persona": "Executive Digital Secretary",
            "gender": "Female",
            "age": 28,
            "hair_style": "Corporate Bun",
            "hair_color": "Dark Brown",
            "face_style": "Warm Professional",
            "outfit": "Navy Blue Blazer",
            "personality": "Efficient, Professional, Courteous",
            "speaking_style": "Clear, Formal, Reassuring",
            "voice_enabled": True,
            "system_mode": "Online",
            "avatar_images": {
                "Female": "assets/avatar_female.png",
                "Male": "assets/avatar_male.png"
            }
        }

    def save_settings(self, settings: dict) -> bool:
        try:
            os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
            with open(self.config_path, "w", encoding="utf-8") as f:
                json.dump(settings, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"Error saving avatar settings: {e}")
            return False
