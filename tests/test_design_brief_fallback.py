import pytest

import design_brief_agent
from design_brief_agent import DesignBriefGenerationError, generateDesignBriefResult


def force_codex_failure(monkeypatch, message="Codex CLI failed: stream disconnected"):
    monkeypatch.setattr(design_brief_agent, "detect_design_brief_cli", lambda: {"provider": "codex", "command": "codex"})
    monkeypatch.setattr(
        design_brief_agent,
        "_run_codex",
        lambda prompt, timeout: (_ for _ in ()).throw(DesignBriefGenerationError(message)),
    )


def test_codex_failure_returns_fallback_instead_of_raising(monkeypatch):
    force_codex_failure(monkeypatch)

    result = generateDesignBriefResult("3D render industrial cafe", timeout_seconds=1)

    assert result["provider"] == "DeterministicDesignBriefFallback"
    assert result["fallbackUsed"] is True
    assert result["source"] == "local_fallback"
    assert "stream disconnected" in result["fallbackReason"]
    assert result["brief"]["roomType"] == "cafe"


def test_industrial_cafe_prompt_maps_to_cafe_material_palette(monkeypatch):
    force_codex_failure(monkeypatch)

    prompt = "3D render \u5e6b\u6211\u8a2d\u8a08\u4e00\u500b\u5de5\u696d\u98a8\u5496\u5561\u5ef3"
    brief = generateDesignBriefResult(prompt, timeout_seconds=1)["brief"]

    assert brief["roomType"] == "cafe"
    assert brief["spaceType"] == "cafe"
    assert brief["stylePreset"] == "industrial"
    assert "black metal" in brief["palette"]
    assert "soft concrete" in brief["palette"]
    assert {"type": "bar counter", "quantity": 1} in brief["furniture"]
    assert any(item["type"] == "pendant light" for item in brief["furniture"])


@pytest.mark.parametrize(
    ("prompt", "room_type", "expected_furniture"),
    [
        ("\u65e5\u5f0f\u4f98\u5bc2\u98a8\u81e5\u5ba4\uff0c\u4f4e\u77ee\u5bb6\u5177\uff0c\u6696\u6728\u5730\u677f", "bedroom", "bed"),
        ("\u767d\u8272\u79d1\u6280\u98a8\u8fa6\u516c\u5ba4\u4f11\u606f\u5340 lounge", "office_lounge", "sofa"),
    ],
)
def test_room_type_specific_fallbacks(monkeypatch, prompt, room_type, expected_furniture):
    force_codex_failure(monkeypatch)

    brief = generateDesignBriefResult(prompt, timeout_seconds=1)["brief"]

    assert brief["roomType"] == room_type
    assert brief["spaceType"] == room_type
    assert any(item["type"] == expected_furniture for item in brief["furniture"])
    assert brief["fallbackUsed"] is True
    assert brief["renderPrompt"]
