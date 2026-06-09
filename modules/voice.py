class VoiceLayer:
    """
    Manages voice configurations and TTS pre-rendering options.
    """
    def __init__(self, config_path):
        self.config_path = config_path

    def get_speech_parameters(self) -> dict:
        """
        Returns parameters for synthesis (rate, pitch, volume, gender-voice presets).
        """
        return {
            "rate": 1.0,
            "pitch": 1.0,
            "volume": 1.0,
            "language": "en-US",
            "provider": "WebSpeechAPI"
        }
