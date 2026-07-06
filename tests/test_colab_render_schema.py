import pytest

from colab_render_schema import REMOTE_JOB_STATUSES, RemoteRenderJob, RemoteRenderProgress, RemoteRenderRequest, RemoteRenderResult


def test_allowed_statuses_are_closed_set():
    assert REMOTE_JOB_STATUSES == {"queued","loading_model","sampling","decoding","saving","completed","failed","cancelled"}


def test_invalid_status_is_rejected():
    with pytest.raises(ValueError): RemoteRenderJob("job", "task", "done", "now")


def test_request_validates_dimensions():
    with pytest.raises(ValueError): RemoteRenderRequest("task", "prompt", "", 0, 512)


def test_progress_and_result_validate_json_schema():
    progress = RemoteRenderProgress.from_dict({"job_id":"job","status":"sampling","progress":.5})
    result = RemoteRenderResult.from_dict({"job_id":"job","task_id":"task","status":"completed","metadata":{}})
    assert progress.progress == .5 and result.status == "completed"
