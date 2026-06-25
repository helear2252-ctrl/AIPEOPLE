import os
import sys
import time
import json
import uuid
import random
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = 8000
WORKSPACE_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(WORKSPACE_DIR, "assets", "cache")

# Set paths for importing the local module
sys.path.append(WORKSPACE_DIR)
from modules.landmark_driver import LandmarkMouthDriver

# Default audio asset for simulated TTS
DEFAULT_AUDIO_PATH = r"C:\Users\admin\AppData\Local\Temp\M11A_NOVA_MuseTalk\inputs\nova_m11a_test_zh_silence.wav"

# Global cached driver instance (Daemon Mode - in memory)
driver_instance = None

def get_driver():
    global driver_instance
    if driver_instance is None:
        print("[LandmarkAPI] Initializing Landmark Mouth Driver in memory...")
        # Path configuration can be loaded here if needed
        driver_instance = LandmarkMouthDriver()
    return driver_instance

class LandmarkAPIHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Prevent spamming the console
        pass

    def do_GET(self):
        # Map root path
        clean_path = self.path.split('?')[0]
        if clean_path == "/":
            clean_path = "/index.html"
            
        file_path = os.path.join(WORKSPACE_DIR, clean_path.lstrip("/"))
        
        # Verify safety (prevent directory traversal)
        abs_file_path = os.path.abspath(file_path)
        if not abs_file_path.startswith(os.path.abspath(WORKSPACE_DIR)):
            self.send_error(403, "Forbidden")
            return

        if os.path.exists(abs_file_path) and os.path.isfile(abs_file_path):
            content_type = "application/octet-stream"
            if abs_file_path.endswith(".html"):
                content_type = "text/html; charset=utf-8"
            elif abs_file_path.endswith(".css"):
                content_type = "text/css"
            elif abs_file_path.endswith(".js"):
                content_type = "application/javascript"
            elif abs_file_path.endswith(".png"):
                content_type = "image/png"
            elif abs_file_path.endswith(".jpg") or abs_file_path.endswith(".jpeg"):
                content_type = "image/jpeg"
            elif abs_file_path.endswith(".mp4"):
                content_type = "video/mp4"
            elif abs_file_path.endswith(".wav"):
                content_type = "audio/wav"
            elif abs_file_path.endswith(".json"):
                content_type = "application/json"

            # Use range serving for video files to support Chrome/Safari range requests
            if abs_file_path.endswith(".mp4"):
                self.serve_file_range(abs_file_path, content_type)
            else:
                self.send_response(200)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(os.path.getsize(abs_file_path)))
                self.end_headers()
                with open(abs_file_path, "rb") as f:
                    self.wfile.write(f.read())
        else:
            self.send_error(404, "File Not Found")

    def do_POST(self):
        if self.path == "/api/nova/talk":
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            # Parse query parameters or JSON
            user_msg = ""
            try:
                request_json = json.loads(post_data.decode('utf-8'))
                user_msg = request_json.get("message", "")
            except Exception:
                pass
                
            print(f"\n[LandmarkAPI] Received talk request: '{user_msg}'")
            
            # 1. Simulate GPT (300ms)
            time.sleep(0.3)
            gpt_latency = 0.3
            
            # 2. Simulate TTS (100ms)
            time.sleep(0.1)
            tts_latency = 0.1
            
            # 3. Generate mouth-sync video using the cached in-memory driver (Daemon Mode)
            # Create a unique filename in assets/cache
            os.makedirs(CACHE_DIR, exist_ok=True)
            unique_id = f"{int(time.time())}_{uuid.uuid4().hex[:6]}"
            video_filename = f"talking_landmark_{unique_id}.mp4"
            output_video_path = os.path.join(CACHE_DIR, video_filename)
            
            print(f"[LandmarkAPI] Generating video: assets/cache/{video_filename}...")
            start_gen = time.time()
            
            try:
                driver = get_driver()
                generation_time = driver.generate(DEFAULT_AUDIO_PATH, output_video_path)
            except Exception as e:
                print(f"[LandmarkAPI] Error: Landmark generator failed! {e}")
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode('utf-8'))
                return

            total_latency = gpt_latency + tts_latency + generation_time
            print(f"[LandmarkAPI] Generation complete. Total Latency: {total_latency:.2f}s")
            
            # Compile answers
            responses = [
                "已成功透過 Face Landmark 嘴型係數驅動開合，這項技術完全不需要 GPU 即可達到超即時速度！",
                "您好！這段說話影片是使用 MediaPipe 與 OpenCV 即時變形生成的，畫面完全沒有任何抖動與崩壞。",
                "透過我們規劃的常駐 Daemon 模式，我們省去了每次載入模型的延遲，讓語音互動體驗更為順暢。"
            ]
            response_text = random.choice(responses)
            
            response_data = {
                "success": True,
                "video_url": f"/assets/cache/{video_filename}?t={int(time.time()*1000)}",
                "response_text": response_text,
                "latencies": {
                    "gpt": gpt_latency,
                    "tts": tts_latency,
                    "landmark": generation_time,
                    "total": total_latency
                }
            }
            
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode('utf-8'))
            
            # Clean up old files in the cache to prevent disk build-up (keep last 10 files)
            self.cleanup_cache_folder()

    def serve_file_range(self, file_path, content_type):
        file_size = os.path.getsize(file_path)
        range_header = self.headers.get("Range")
        
        if not range_header:
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(file_size))
            self.send_header("Accept-Ranges", "bytes")
            self.end_headers()
            with open(file_path, "rb") as f:
                self.wfile.write(f.read())
            return

        try:
            range_val = range_header.strip().split("=")[1]
            parts = range_val.split("-")
            start = int(parts[0])
            end = int(parts[1]) if parts[1] else file_size - 1
        except Exception:
            self.send_error(400, "Bad Request (Invalid Range)")
            return

        if start >= file_size or end >= file_size or start > end:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{file_size}")
            self.end_headers()
            return

        chunk_size = end - start + 1
        self.send_response(206)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
        self.send_header("Content-Length", str(chunk_size))
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()

        with open(file_path, "rb") as f:
            f.seek(start)
            self.wfile.write(f.read(chunk_size))

    def cleanup_cache_folder(self):
        try:
            files = [os.path.join(CACHE_DIR, f) for f in os.listdir(CACHE_DIR) if f.startswith("talking_landmark_") and f.endswith(".mp4")]
            if len(files) > 10:
                # Sort by modification time (oldest first)
                files.sort(key=os.path.getmtime)
                # Delete files exceeding the limit
                for f in files[:-10]:
                    try:
                        os.remove(f)
                    except Exception:
                        pass
        except Exception as e:
            print(f"[LandmarkAPI] Cache cleanup error: {e}")

def run():
    # Warm up model to keep first request fast
    try:
        get_driver()
    except Exception as e:
        print(f"[LandmarkAPI] Warm-up error: {e}")
        
    print(f"[LandmarkAPI] Starting integration server on http://localhost:{PORT}")
    print("[LandmarkAPI] Press Ctrl+C to stop.")
    server = HTTPServer(("localhost", PORT), LandmarkAPIHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[LandmarkAPI] Stopping server.")
        server.server_close()

if __name__ == "__main__":
    run()
