import json
import os

class AvatarInterface:
    """
    Encapsulates Digital Human settings reading, writing, and state validation.
    Keeps the Digital Human Layer isolated from backend logic.
    """
    DEFAULT_SETTINGS = {
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
        "avatar_engine": "image",
        "avatar_static_image": "assets/new_nova.png",
        "avatar_idle_video": "",
        "avatar_talking_video": "",
        "avatar_images": {
            "Female": "assets/new_nova.png",
            "Male": "assets/avatar_male.png"
        },
        "avatar_fallback_images": {
            "Female": [
                "assets/avatar_female.png",
                "assets/nova_avatar.png"
            ],
            "Male": [
                "assets/avatar_male.png"
            ]
        }
    }

    def __init__(self, config_path: str):
        self.config_path = config_path

    def load_settings(self) -> dict:
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, "r", encoding="utf-8") as f:
                    settings = json.load(f)
                    return self.normalize_settings(settings)
        except Exception as e:
            print(f"Error loading avatar settings: {e}")
        
        return self.DEFAULT_SETTINGS.copy()

    def normalize_settings(self, settings: dict) -> dict:
        normalized = self.DEFAULT_SETTINGS.copy()
        normalized.update(settings)

        avatar_images = normalized.get("avatar_images") or {}
        avatar_images.setdefault("Female", normalized["avatar_static_image"])
        avatar_images.setdefault("Male", "assets/avatar_male.png")
        normalized["avatar_images"] = avatar_images

        normalized.setdefault("avatar_engine", "image")
        normalized.setdefault("avatar_static_image", avatar_images.get("Female", "assets/new_nova.png"))
        normalized.setdefault("avatar_idle_video", "")
        normalized.setdefault("avatar_talking_video", "")
        normalized.setdefault("avatar_fallback_images", self.DEFAULT_SETTINGS["avatar_fallback_images"])

        return normalized

    def save_settings(self, settings: dict) -> bool:
        try:
            os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
            with open(self.config_path, "w", encoding="utf-8") as f:
                json.dump(self.normalize_settings(settings), f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"Error saving avatar settings: {e}")
            return False
