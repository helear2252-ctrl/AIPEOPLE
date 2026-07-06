from pathlib import Path

from colab_render_client import ColabRenderClient
from colab_render_provider import ColabRenderProvider
from conftest import image_bytes, mock_colab_server
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


def test_missing_config_health_and_render_fail_without_crash(tmp_path):
    provider=ColabRenderProvider(tmp_path,ColabRenderClient("","")); health=provider.check(); result=provider.render(request(),lambda *_:None)
    assert health.status=="unavailable" and result.status=="failed" and result.metadata["reason"]=="COLAB_CONFIG_MISSING"


def test_final_beauty_colab_failure_enters_failed_lifecycle(tmp_path, monkeypatch):
    import final_beauty_render_tool
    monkeypatch.setattr(final_beauty_render_tool, "ROOT", tmp_path)
    monkeypatch.setenv("NOVA_RENDER_PROVIDER", "colab")
    monkeypatch.delenv("NOVA_COLAB_BASE_URL", raising=False)
    monkeypatch.delenv("NOVA_COLAB_TOKEN", raising=False)
    events=[]
    provider=final_beauty_render_tool.FinalBeautyRenderTool()
    import pytest
    with pytest.raises(RuntimeError): provider.run("interior",lambda kind,payload:events.append(kind))
    assert "beauty_render_failed" in events and "beauty_render_completed" not in events
