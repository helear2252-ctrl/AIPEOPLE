from pathlib import Path

from colab_render_client import ColabRenderClient
from colab_render_provider import ColabRenderProvider
from conftest import image_bytes, mock_colab_server
from image_quality_gate import ImageQualityGate
from render_provider_base import RenderRequest


def make_provider(root, url, max_poll=.2): return ColabRenderProvider(root, ColabRenderClient(url,"secret-token",connect_timeout=.2,read_timeout=1,poll_interval=.01,max_poll_seconds=max_poll))
def request(): return RenderRequest("task-1","prompt","negative",128,128)


def test_completed_job_downloads_and_passes_quality_gate(tmp_path):
    events=[]
    with mock_colab_server() as (url, _): result=make_provider(tmp_path,url).render(request(),lambda kind,payload:events.append(kind))
    assert result.status=="ready" and result.image_path and "render_image_saved" in events


def test_failed_job_never_completes(tmp_path):
    with mock_colab_server(lambda state:setattr(state,"job_states",["failed"])) as (url, _): result=make_provider(tmp_path,url).render(request(),lambda *_:None)
    assert result.status=="failed" and result.metadata["reason"]=="COLAB_JOB_FAILED"


def test_job_timeout(tmp_path):
    with mock_colab_server(lambda state:setattr(state,"job_states",["sampling"])) as (url, _): result=make_provider(tmp_path,url,.03).render(request(),lambda *_:None)
    assert result.status=="render_timeout" and result.metadata["reason"]=="COLAB_JOB_TIMEOUT"


def test_black_image_is_rejected(tmp_path):
    with mock_colab_server(lambda state:setattr(state,"image",image_bytes(black=True))) as (url, _): result=make_provider(tmp_path,url).render(request(),lambda *_:None)
    assert result.status=="failed" and result.metadata["reason"]=="invalid_black_output"


def test_corrupt_image_is_rejected(tmp_path):
    def configure(state):
        state.image=b"not-a-decodable-image"
    with mock_colab_server(configure) as (url, _): result=make_provider(tmp_path,url).render(request(),lambda *_:None)
    assert result.status=="failed" and result.metadata["reason"]=="invalid_image_output"


def test_gpu_unavailable_health_never_reports_available(tmp_path):
    def configure(state):
        state.health_payload={"provider":"google_colab","available":False,"gpu_available":False,"model_loaded":False,"detail":"GPU unavailable"}
    with mock_colab_server(configure) as (url, _): health=make_provider(tmp_path,url).check()
    assert health.status=="unavailable" and health.metadata["health"]["gpu_available"] is False


def test_missing_config_health_and_render_fail_without_crash(tmp_path):
    provider=ColabRenderProvider(tmp_path,ColabRenderClient("","")); health=provider.check(); result=provider.render(request(),lambda *_:None)
    assert health.status=="unavailable" and result.status=="failed" and result.metadata["reason"]=="COLAB_CONFIG_MISSING"


def test_final_beauty_colab_failure_enters_failed_lifecycle(tmp_path, monkeypatch):
    import final_beauty_render_tool
    monkeypatch.setattr(final_beauty_render_tool, "ROOT", tmp_path)
    monkeypatch.setenv("NOVA_RENDER_PROVIDER", "colab")
    monkeypatch.delenv("NOVA_RENDER_FALLBACK_MODE", raising=False)
    monkeypatch.delenv("NOVA_COLAB_BASE_URL", raising=False)
    monkeypatch.delenv("NOVA_COLAB_TOKEN", raising=False)
    events=[]
    provider=final_beauty_render_tool.FinalBeautyRenderTool()
    import pytest
    with pytest.raises(RuntimeError): provider.run("interior",lambda kind,payload:events.append(kind))
    assert "beauty_render_failed" in events and "beauty_render_completed" not in events


def write_demo_source(root: Path):
    path = root / "assets" / "demo" / "phase2c_demo_fallback_render.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(image_bytes())
    return path


def test_final_beauty_demo_fallback_on_colab_job_failure(tmp_path, monkeypatch):
    import final_beauty_render_tool
    monkeypatch.setattr(final_beauty_render_tool, "ROOT", tmp_path)
    monkeypatch.setenv("NOVA_RENDER_PROVIDER", "colab")
    monkeypatch.setenv("NOVA_RENDER_FALLBACK_MODE", "demo")
    write_demo_source(tmp_path)
    events=[]
    payloads=[]
    with mock_colab_server(lambda state:setattr(state,"job_states",["failed"])) as (url, _):
        monkeypatch.setenv("NOVA_COLAB_BASE_URL", url)
        monkeypatch.setenv("NOVA_COLAB_TOKEN", "secret-token")
        output, files = final_beauty_render_tool.FinalBeautyRenderTool().run("interior", lambda kind,payload: (events.append(kind), payloads.append(payload)))
    final_path = tmp_path / "generated_assets" / "interior_renders" / output["renderMetadataUrl"].split("/")[-2] / "final_render.png"
    metadata_path = tmp_path / output["renderMetadataUrl"].lstrip("/")
    assert output["renderStatus"] == "ready"
    assert output["renderProvider"] == "DemoRenderFallbackProvider"
    assert output["isFinalRender"] is True
    assert output["finalRenderUrl"].endswith("/final_render.png")
    assert final_path.is_file() and ImageQualityGate.validate(final_path)["valid"]
    assert "beauty_render_ready" in events and "beauty_render_completed" in events
    metadata = __import__("json").loads(metadata_path.read_text(encoding="utf-8"))
    assert metadata["providerMetadata"]["fallbackUsed"] is True
    assert metadata["providerMetadata"]["fallbackMode"] == "demo"
    assert metadata["providerMetadata"]["originalProvider"] == "ColabRenderProvider"
    assert "generated_assets/interior_renders" in files[-1]


def test_final_beauty_colab_success_does_not_use_demo_fallback(tmp_path, monkeypatch):
    import final_beauty_render_tool
    monkeypatch.setattr(final_beauty_render_tool, "ROOT", tmp_path)
    monkeypatch.setenv("NOVA_RENDER_PROVIDER", "colab")
    monkeypatch.setenv("NOVA_RENDER_FALLBACK_MODE", "demo")
    write_demo_source(tmp_path)
    with mock_colab_server() as (url, _):
        monkeypatch.setenv("NOVA_COLAB_BASE_URL", url)
        monkeypatch.setenv("NOVA_COLAB_TOKEN", "secret-token")
        output, _ = final_beauty_render_tool.FinalBeautyRenderTool().run("interior", lambda *_: None)
    metadata = __import__("json").loads((tmp_path / output["renderMetadataUrl"].lstrip("/")).read_text(encoding="utf-8"))
    assert output["renderStatus"] == "ready"
    assert output["renderProvider"] == "ColabRenderProvider"
    assert metadata["providerMetadata"].get("fallbackUsed") is not True
