import io
import json
import threading
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from PIL import Image


def image_bytes(black=False):
    image = Image.new("RGB", (128, 128))
    if not black:
        pixels = image.load()
        for y in range(128):
            for x in range(128):
                pixels[x, y] = ((x * 17 + y * 3) % 256, (x * 5 + y * 11) % 256, (x * 13 + y * 7) % 256)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", compress_level=0)
    return buffer.getvalue()


class MockState:
    token = "secret-token"
    health_status = 200
    health_invalid_json = False
    job_states = ["queued", "loading_model", "sampling", "decoding", "completed"]
    image = image_bytes()
    image_content_type = "image/png"
    result_status = 200
    health_payload = {"provider":"ColabRenderProvider","available":True,"gpu_available":True,"model_loaded":True,"detail":"ready"}

    def __init__(self): self.job_index = 0; self.seen_authorization = []


@contextmanager
def mock_colab_server(configure=None):
    state = MockState()
    if configure: configure(state)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args): pass

        def send_payload(self, status, value, content_type="application/json"):
            body = value if isinstance(value, bytes) else json.dumps(value).encode()
            self.send_response(status); self.send_header("Content-Type", content_type); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)

        def authorized(self):
            value = self.headers.get("Authorization", ""); state.seen_authorization.append(value)
            if value != f"Bearer {state.token}": self.send_payload(401, {"error": "unauthorized"}); return False
            return True

        def do_GET(self):
            if not self.authorized(): return
            if self.path == "/health":
                if state.health_invalid_json: return self.send_payload(200, b"not-json", "application/json")
                return self.send_payload(state.health_status, state.health_payload)
            if self.path == "/expired": return self.send_payload(410, {"error":"expired"})
            if self.path == "/image.png": return self.send_payload(200, state.image, state.image_content_type)
            if self.path == "/html-result": return self.send_payload(200, b"<html>expired</html>", "text/html")
            if self.path == "/jobs/job-1/result":
                return self.send_payload(state.result_status, {"job_id":"job-1","task_id":"task-1","status":"completed","image_url":f"http://127.0.0.1:{self.server.server_port}/image.png","width":128,"height":128,"seed":42,"metadata":{"model":"mock"}})
            if self.path == "/jobs/job-1":
                status = state.job_states[min(state.job_index, len(state.job_states)-1)]; state.job_index += 1
                progress = {"queued":0,"loading_model":.1,"sampling":.5,"decoding":.9,"saving":.95,"completed":1,"failed":.5,"cancelled":.5}[status]
                return self.send_payload(200, {"job_id":"job-1","status":status,"progress":progress,"current_step":status,"result_url":f"http://127.0.0.1:{self.server.server_port}/image.png" if status=="completed" else None,"error":"worker failed" if status=="failed" else None})
            return self.send_payload(404, {"error":"missing"})

        def do_POST(self):
            if not self.authorized(): return
            if self.path != "/render": return self.send_payload(404, {"error":"missing"})
            length = int(self.headers.get("Content-Length", 0)); json.loads(self.rfile.read(length))
            return self.send_payload(202, {"job_id":"job-1","task_id":"task-1","status":"queued","created_at":"2026-01-01T00:00:00Z"})

        def do_DELETE(self):
            if not self.authorized(): return
            return self.send_payload(200, {"job_id":"job-1","status":"cancelled","progress":0,"current_step":"cancelled"})

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
    try: yield f"http://127.0.0.1:{server.server_port}", state
    finally: server.shutdown(); server.server_close(); thread.join(timeout=2)
