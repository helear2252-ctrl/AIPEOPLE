"""Authenticated HTTP client for an ephemeral NOVA Colab render backend."""
from __future__ import annotations

import json
import os
import socket
import urllib.error
import urllib.parse
import urllib.request

from colab_render_schema import RenderProviderHealth, RemoteRenderFailure, RemoteRenderJob, RemoteRenderProgress, RemoteRenderRequest, RemoteRenderResult


class ColabRenderError(RuntimeError):
    def __init__(self, failure: RemoteRenderFailure):
        super().__init__(failure.message)
        self.failure = failure


class ColabRenderClient:
    provider = "ColabRenderProvider"

    def __init__(self, base_url: str | None = None, token: str | None = None, *, connect_timeout: float | None = None, read_timeout: float | None = None, poll_interval: float | None = None, max_poll_seconds: float | None = None, max_download_bytes: int | None = None):
        self.base_url = self._normalize_url(base_url if base_url is not None else os.getenv("NOVA_COLAB_BASE_URL", ""))
        self.token = token if token is not None else os.getenv("NOVA_COLAB_TOKEN", "")
        self.connect_timeout = float(connect_timeout if connect_timeout is not None else os.getenv("NOVA_COLAB_CONNECT_TIMEOUT_SECONDS", "5"))
        self.read_timeout = float(read_timeout if read_timeout is not None else os.getenv("NOVA_COLAB_READ_TIMEOUT_SECONDS", "30"))
        self.poll_interval = float(poll_interval if poll_interval is not None else os.getenv("NOVA_COLAB_POLL_INTERVAL_SECONDS", "2"))
        self.max_poll_seconds = float(max_poll_seconds if max_poll_seconds is not None else os.getenv("NOVA_COLAB_MAX_POLL_SECONDS", "480"))
        self.max_download_bytes = int(max_download_bytes if max_download_bytes is not None else os.getenv("NOVA_COLAB_MAX_RESULT_BYTES", str(25 * 1024 * 1024)))

    @staticmethod
    def _normalize_url(value: str) -> str:
        value = value.strip().rstrip("/")
        if not value: return ""
        parsed = urllib.parse.urlsplit(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc: raise ValueError("NOVA_COLAB_BASE_URL must be an absolute HTTP(S) URL")
        return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path.rstrip("/"), "", ""))

    def _failure(self, code: str, message: str, retryable: bool = False, detail: dict | None = None):
        return ColabRenderError(RemoteRenderFailure(self.provider, code, message, retryable, detail or {}))

    def _require_config(self):
        missing = [name for name, value in (("NOVA_COLAB_BASE_URL", self.base_url), ("NOVA_COLAB_TOKEN", self.token)) if not value]
        if missing: raise self._failure("COLAB_CONFIG_MISSING", "Missing Colab render configuration.", False, {"missing": missing})

    def _request(self, method: str, path_or_url: str, *, payload: dict | None = None, expect_image: bool = False):
        self._require_config()
        url = path_or_url if urllib.parse.urlsplit(path_or_url).scheme in {"http", "https"} else self.base_url + "/" + path_or_url.lstrip("/")
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        headers = {"Accept": "image/*" if expect_image else "application/json", "Authorization": f"Bearer {self.token}"}
        if body is not None: headers["Content-Type"] = "application/json"
        request = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=self.connect_timeout) as response:
                try: response.fp.raw._sock.settimeout(self.read_timeout)
                except AttributeError: pass
                content_type = response.headers.get_content_type()
                if expect_image:
                    if not content_type.startswith("image/"): raise self._failure("COLAB_RESULT_INVALID", "Colab result is not an image.", False, {"contentType": content_type})
                    declared = response.headers.get("Content-Length")
                    if declared and int(declared) > self.max_download_bytes: raise self._failure("COLAB_RESULT_INVALID", "Colab result exceeds the download limit.")
                    data = response.read(self.max_download_bytes + 1)
                    if len(data) > self.max_download_bytes: raise self._failure("COLAB_RESULT_INVALID", "Colab result exceeds the download limit.")
                    return data
                if content_type not in {"application/json", "text/json"}: raise self._failure("COLAB_BAD_RESPONSE", "Colab response is not JSON.", False, {"contentType": content_type})
                try: return json.loads(response.read().decode("utf-8"))
                except (UnicodeDecodeError, json.JSONDecodeError) as exc: raise self._failure("COLAB_BAD_RESPONSE", "Colab returned invalid JSON.", False, {"error": type(exc).__name__})
        except ColabRenderError: raise
        except urllib.error.HTTPError as exc:
            if exc.code in {401, 403}: raise self._failure("COLAB_AUTH_FAILED", "Colab authentication failed.")
            if exc.code in {404, 410}: raise self._failure("COLAB_URL_EXPIRED", "Colab URL or job endpoint has expired.", True, {"status": exc.code})
            raise self._failure("COLAB_BAD_RESPONSE", f"Colab returned HTTP {exc.code}.", exc.code >= 500, {"status": exc.code})
        except (urllib.error.URLError, TimeoutError, socket.timeout, OSError) as exc:
            raise self._failure("COLAB_UNREACHABLE", "Colab render backend is unreachable.", True, {"error": type(exc).__name__})

    def _parse(self, parser, payload, label):
        try: return parser(payload)
        except (KeyError, TypeError, ValueError) as exc:
            raise self._failure("COLAB_BAD_RESPONSE", f"Colab returned an invalid {label} schema.", False, {"error": type(exc).__name__})

    def health(self) -> RenderProviderHealth:
        return self._parse(RenderProviderHealth.from_dict, self._request("GET", "/health"), "health")

    def submit_render(self, request: RemoteRenderRequest) -> RemoteRenderJob:
        return self._parse(RemoteRenderJob.from_dict, self._request("POST", "/render", payload=request.to_dict()), "job")

    def get_job(self, job_id: str) -> RemoteRenderProgress:
        return self._parse(RemoteRenderProgress.from_dict, self._request("GET", f"/jobs/{urllib.parse.quote(job_id, safe='')}"), "progress")

    def get_result(self, job_id: str) -> RemoteRenderResult:
        return self._parse(RemoteRenderResult.from_dict, self._request("GET", f"/jobs/{urllib.parse.quote(job_id, safe='')}/result"), "result")

    def download_result(self, job_id: str | None = None, result_url: str | None = None) -> bytes:
        if not result_url:
            if not job_id: raise ValueError("job_id or result_url is required")
            result = self.get_result(job_id)
            result_url = result.image_url or f"/jobs/{urllib.parse.quote(job_id, safe='')}/result/image"
        try: return self._request("GET", result_url, expect_image=True)
        except ColabRenderError as exc:
            if exc.failure.code in {"COLAB_AUTH_FAILED", "COLAB_URL_EXPIRED", "COLAB_RESULT_INVALID"}: raise
            raise self._failure("COLAB_RESULT_DOWNLOAD_FAILED", "Unable to download Colab render result.", exc.failure.retryable, {"cause": exc.failure.code})

    def cancel_job(self, job_id: str) -> RemoteRenderProgress:
        return self._parse(RemoteRenderProgress.from_dict, self._request("DELETE", f"/jobs/{urllib.parse.quote(job_id, safe='')}"), "progress")
