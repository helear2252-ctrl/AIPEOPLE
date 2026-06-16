class VoiceLayer:
    def __init__(self):
        self.tts_provider = "gTTS"
        self.stt_provider = "whisper"

    def text_to_speech(self, text: str, voice_id: str = "default") -> bytes:
        """
        Mock TTS conversion. Returns mock audio bytes.
        """
        print(f"[VoiceLayer] Converting text to speech: '{text[:20]}...' using {self.tts_provider}")
        # Return mock audio data (empty bytes for skeleton)
        return b"MOCK_AUDIO_DATA_FOR_" + text.encode("utf-8")[:30]

    def speech_to_text(self, audio_data: bytes) -> str:
        """
        Mock STT conversion. Converts audio bytes to string.
        """
        print(f"[VoiceLayer] Converting speech to text using {self.stt_provider}")
        return "語音輸入測試：你好 NOVA AI"

    def get_available_voices(self) -> list:
        return [
            {"id": "nova_zh", "name": "NOVA Standard Chinese (Female)", "lang": "zh-TW"},
            {"id": "nova_en", "name": "NOVA Standard English (Female)", "lang": "en-US"},
            {"id": "assistant_male", "name": "Deep Accent Male", "lang": "zh-TW"}
        ]
