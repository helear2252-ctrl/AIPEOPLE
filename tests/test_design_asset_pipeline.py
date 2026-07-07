import json
import time
from pathlib import Path

from conftest import image_bytes
from design_asset_pipeline import ProfessionalAssetPipelineTool
from design_quality_gate import DesignQualityGateTool


def write_manifest(root: Path):
    path = root / "assets" / "designs" / "cafe_pro" / "manifest.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({
        "title": "Professional Cafe Interior Proposal",
        "plans": {"floor": "assets/designs/cafe_pro/plans/floor_plan.png"},
        "model": {"glb": "assets/designs/cafe_pro/models/cafe_showroom.glb"},
        "renders": {
            "hero": "assets/designs/cafe_pro/renders/hero.jpg",
            "interior": "assets/designs/cafe_pro/renders/interior_bar.jpg",
            "exterior": "assets/designs/cafe_pro/renders/exterior.jpg",
            "detail": "assets/designs/cafe_pro/renders/detail_lighting.jpg",
        },
        "orbit": {"pattern": "assets/designs/cafe_pro/orbit/frame_####.jpg", "count": 36},
    }), encoding="utf-8")
    return path


def write_render(root: Path, name: str):
    path = root / "assets" / "designs" / "cafe_pro" / "renders" / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(image_bytes())
    return path


def test_pipeline_uses_render_assets_without_plan_model_or_orbit(tmp_path):
    write_manifest(tmp_path)
    write_render(tmp_path, "hero.jpg")
    write_render(tmp_path, "interior_bar.jpg")
    write_render(tmp_path, "exterior.jpg")
    payload = ProfessionalAssetPipelineTool(tmp_path).inspect_assets("warm cafe interior")
    assert payload["presentationReady"] is True
    assert payload["defaultView"] == "render"
    assert {"render", "interior", "exterior"}.issubset(set(payload["availableViews"]))
    assert "plans.floor" in payload["missingAssets"]
    assert "model.glb" in payload["missingAssets"]
    assert "orbit.frame_0001" in payload["missingAssets"]
    assert payload["provider"] == "ProfessionalAssetPipelineTool"
    assert payload["usingPrimitiveFallback"] is False


def test_pipeline_never_uses_primitive_fallback_when_glb_missing(tmp_path):
    write_manifest(tmp_path)
    write_render(tmp_path, "hero.jpg")
    payload = ProfessionalAssetPipelineTool(tmp_path).inspect_assets("cafe")
    assert payload["presentationReady"] is True
    assert payload["details"]["assetStatus"]["model"] is False
    assert payload["usingPrimitiveFallback"] is False
    assert payload.get("usingPrimitiveFallback") is not True


def test_pipeline_all_assets_missing_returns_pending_without_crashing(tmp_path):
    write_manifest(tmp_path)
    payload = ProfessionalAssetPipelineTool(tmp_path).inspect_assets("cafe")
    assert payload["presentationReady"] is False
    assert payload["defaultView"] == "pending"
    assert payload["availableViews"] == []
    assert "renders.hero" in payload["missingAssets"]


def test_design_quality_gate_warns_when_render_exists_but_optional_assets_missing(tmp_path):
    write_manifest(tmp_path)
    write_render(tmp_path, "hero.jpg")
    result = DesignQualityGateTool(tmp_path).check()
    assert result["qualityStatus"] == "warning"
    assert result["warning"] is True
    assert result["failed"] is False
    assert result["missingOptionalAssets"]["model"] is True


def test_agent_task_interior_design_completes_without_colab(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setenv("NOVA_RENDER_PROVIDER", "colab")
    from agent_runtime import TaskRequest, create_task, stream, tasks

    created = create_task(TaskRequest(userMessage="professional cafe interior design render proposal"))
    task_id = created["taskId"]
    task = {}
    for _ in range(60):
        task = tasks[task_id]
        if task["status"] in {"completed", "failed"}:
            break
        time.sleep(0.1)
    assert task["status"] == "completed"
    output = task["output"]
    assert output["presentationReady"] is True
    assert output["assetManifestUrl"] == "/assets/designs/cafe_pro/manifest.json"
    assert output["defaultView"] == "render"
    assert {"render", "interior", "exterior"}.issubset(set(output["availableViews"]))
    assert output["provider"] == "ProfessionalAssetPipelineTool"
    events = [event["type"] for event in stream.since(task_id, 0)]
    assert "professional_asset_check_started" in events
    assert "professional_asset_ready" in events
    assert "design_quality_checked" in events
    assert "presentation_ready" in events
