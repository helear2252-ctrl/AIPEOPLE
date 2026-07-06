"""Remote render provider backed by an authenticated Google Colab service."""
from __future__ import annotations

import time
from pathlib import Path

from colab_render_client import ColabRenderClient, ColabRenderError
from colab_render_schema import RemoteRenderRequest
from render_provider_base import RenderProviderBase, RenderRequest, RenderResult


class ColabRenderProvider(RenderProviderBase):
    name = "ColabRenderProvider"
    is_production = True
    is_remote = True

    def __init__(self, root: Path, client: ColabRenderClient | None = None):
        self.root = root
        self.client = client or ColabRenderClient()

    def check(self) -> RenderResult:
        try:
            health = self.client.health()
            available = health.available and health.gpu_available and health.model_loaded
            return self.make_result("available" if available else "unavailable", health.detail or ("Colab render backend is ready." if available else "Colab render backend is not ready."), metadata={"health": health.to_dict()})
        except (ColabRenderError, ValueError) as exc:
            failure = exc.failure.to_dict() if isinstance(exc, ColabRenderError) else {"provider": self.name, "code": "COLAB_CONFIG_MISSING", "message": str(exc), "retryable": False, "detail": {}}
            return self.make_result("unavailable", failure["message"], metadata={"failure": failure, "reason": failure["code"]})

    def render(self, request: RenderRequest, emit) -> RenderResult:
        try:
            remote_request = RemoteRenderRequest(request.task_id, request.prompt, request.negative_prompt, request.width, request.height)
            job = self.client.submit_render(remote_request)
            emit("render_job_submitted", {"provider": self.name, "promptId": job.job_id, "progress": 0, "stage": job.status})
            deadline = time.monotonic() + self.client.max_poll_seconds
            progress = None
            while time.monotonic() < deadline:
                progress = self.client.get_job(job.job_id)
                emit("beauty_render_progress", {"provider": self.name, "promptId": job.job_id, "progress": progress.progress, "stage": progress.status, "visibleAction": progress.current_step})
                if progress.status == "completed": break
                if progress.status in {"failed", "cancelled"}:
                    code = "COLAB_JOB_FAILED"
                    return self.make_result("failed", progress.error or "Colab render job failed.", metadata={"reason": code, "jobId": job.job_id, "remoteStatus": progress.status})
                time.sleep(self.client.poll_interval)
            else:
                return self.make_result("render_timeout", "Colab render job timed out.", metadata={"reason": "COLAB_JOB_TIMEOUT", "jobId": job.job_id, "timeoutSeconds": self.client.max_poll_seconds})

            remote_result = self.client.get_result(job.job_id)
            image_bytes = self.client.download_result(job.job_id, progress.result_url or remote_result.image_url)
            output_dir = self.root / "generated_assets" / "interior_renders" / request.task_id
            output_dir.mkdir(parents=True, exist_ok=True)
            output_path = output_dir / "final_render.png"
            output_path.write_bytes(image_bytes)
            image_stats = self.validate_output_image(output_path)
            relative_path = f"generated_assets/interior_renders/{request.task_id}/final_render.png"
            if not image_stats["valid"]:
                reason = "invalid_black_output" if image_stats["isAllBlack"] else "invalid_image_output"
                return self.make_result("failed", "Colab returned an invalid image output.", metadata={"reason": reason, "jobId": job.job_id, "imageStats": image_stats})
            emit("render_image_saved", {"provider": self.name, "promptId": job.job_id, "progress": 1, "artifact": relative_path, "visibleAction": "Saved validated remote final_render.png"})
            return self.make_result("ready", "Final Render Ready", relative_path, {"jobId": job.job_id, "seed": remote_result.seed, "imageStats": image_stats, "remoteMetadata": remote_result.metadata})
        except ColabRenderError as exc:
            failure = exc.failure
            status = "render_timeout" if failure.code == "COLAB_JOB_TIMEOUT" else "failed"
            return self.make_result(status, failure.message, metadata={"reason": failure.code, "failure": failure.to_dict()})
