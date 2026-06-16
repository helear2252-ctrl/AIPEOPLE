class AvatarInterface:
    def __init__(self, settings_path="config/avatar_settings.json"):
        self.settings_path = settings_path
        self.active_model = "Wav2Lip"

    def generate_lipsync_video(self, audio_data: bytes, base_video_path: str) -> str:
        """
        Mock LipSync generator.
        Takes audio and base video, returns path to generated lip-synced video.
        """
        print(f"[AvatarInterface] Performing {self.active_model} lip sync on {base_video_path}")
        # Return mock path
        return "assets/avatar/generated_lipsync_output.mp4"

    def drive_portrait(self, image_path: str, driver_video_path: str) -> str:
        """
        Mock LivePortrait generator.
        Drives static image with motion of driver video.
        """
        print(f"[AvatarInterface] Driving portrait {image_path} with {driver_video_path} using LivePortrait")
        return "assets/avatar/generated_portrait_output.mp4"

    def get_supported_models(self) -> list:
        return ["Wav2Lip", "LivePortrait", "SadTalker", "Easy-Wav2Lip"]
