import logging

import pytest

from colab_render_client import ColabRenderClient, ColabRenderError
from colab_render_schema import RemoteRenderRequest
from conftest import mock_colab_server


def client(url, token="secret-token"): return ColabRenderClient(url, token, connect_timeout=.2, read_timeout=1, poll_interval=.01, max_poll_seconds=.2)


def test_health_success():
    with mock_colab_server() as (url, _): assert client(url).health().available


def test_health_unauthorized():
    with mock_colab_server() as (url, _), pytest.raises(ColabRenderError) as error: client(url, "wrong").health()
    assert error.value.failure.code == "COLAB_AUTH_FAILED"


def test_missing_config():
    with pytest.raises(ColabRenderError) as error: ColabRenderClient("", "").health()
    assert error.value.failure.code == "COLAB_CONFIG_MISSING"


def test_max_result_bytes_loads_from_environment(monkeypatch):
    monkeypatch.setenv("NOVA_COLAB_MAX_RESULT_BYTES", "12345")
    assert ColabRenderClient("", "").max_download_bytes == 12345


def test_submit_and_poll_state_sequence():
    with mock_colab_server() as (url, _):
        value = client(url); job = value.submit_render(RemoteRenderRequest("task-1","prompt","",128,128)); states=[value.get_job(job.job_id).status for _ in range(5)]
    assert states == ["queued","loading_model","sampling","decoding","completed"]


def test_url_expired():
    with mock_colab_server() as (url, _), pytest.raises(ColabRenderError) as error: client(url).download_result(result_url=url+"/expired")
    assert error.value.failure.code == "COLAB_URL_EXPIRED"


def test_invalid_json():
    with mock_colab_server(lambda state: setattr(state,"health_invalid_json",True)) as (url, _), pytest.raises(ColabRenderError) as error: client(url).health()
    assert error.value.failure.code == "COLAB_BAD_RESPONSE"


@pytest.mark.parametrize("path,content_type", [("/html-result","text/html"),("/image.png","application/octet-stream")])
def test_result_must_be_image(path, content_type):
    configure = (lambda state: setattr(state,"image_content_type",content_type)) if path.endswith("png") else None
    with mock_colab_server(configure) as (url, _), pytest.raises(ColabRenderError) as error: client(url).download_result(result_url=url+path)
    assert error.value.failure.code == "COLAB_RESULT_INVALID"


def test_token_never_appears_in_logs(caplog):
    caplog.set_level(logging.DEBUG)
    with mock_colab_server() as (url, state): client(url).health()
    assert state.seen_authorization == ["Bearer secret-token"] and "secret-token" not in caplog.text


def test_notebook_or_tunnel_unreachable_maps_cleanly():
    with pytest.raises(ColabRenderError) as error:
        ColabRenderClient("http://127.0.0.1:1", "temporary", connect_timeout=.05).health()
    assert error.value.failure.code == "COLAB_UNREACHABLE" and error.value.failure.retryable
