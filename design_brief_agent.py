"""LLM-backed Design Brief generation for NOVA Workbench."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import time
from typing import Any


DESIGN_BRIEF_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "projectType",
        "roomType",
        "stylePreset",
        "mood",
        "palette",
        "furniture",
        "materials",
        "lighting",
        "spatialNotes",
    ],
    "properties": {
        "projectType": {"type": "string"},
        "roomType": {"type": "string"},
        "stylePreset": {"type": "string"},
        "mood": {"type": "string"},
        "palette": {
            "type": "array",
            "minItems": 3,
            "maxItems": 6,
            "items": {"type": "string"},
        },
        "furniture": {
            "type": "array",
            "minItems": 1,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["type", "quantity"],
                "properties": {
                    "type": {"type": "string"},
                    "quantity": {"type": "integer", "minimum": 1},
                },
            },
        },
        "materials": {
            "type": "array",
            "minItems": 2,
            "maxItems": 8,
            "items": {"type": "string"},
        },
        "lighting": {"type": "string"},
        "spatialNotes": {"type": "string"},
    },
}


class DesignBriefGenerationError(RuntimeError):
    pass


def _has_any(text: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in text for keyword in keywords)


def _resolve_fallback_style(text: str) -> tuple[str, list[str], list[str], str]:
    if _has_any(text, ("industrial", "工業", "loft", "cement", "concrete", "水泥")):
        return (
            "industrial",
            ["charcoal", "black metal", "soft concrete", "warm oak", "warm light"],
            ["black metal", "soft concrete", "reclaimed wood", "matte fixtures"],
            "Directional warm pendant lights with soft wall grazing on concrete textures",
        )
    if _has_any(text, ("forest", "森林", "green", "sage", "botanical", "植栽", "自然")):
        return (
            "forest glass",
            ["warm oak", "cream white", "black metal", "sage green", "glass blue"],
            ["oak wood", "cream plaster", "black metal", "clear glass", "living plants"],
            "Soft daylight through large glass panels with warm accent pendants",
        )
    if _has_any(text, ("white tech", "tech", "科技", "white", "白", "minimal", "極簡")):
        return (
            "white tech minimal",
            ["cream white", "soft concrete", "black metal", "linen beige", "cool glass"],
            ["white laminate", "soft concrete", "black metal", "frosted glass"],
            "Clean indirect LED strips with balanced cool-white ambient light",
        )
    if _has_any(text, ("luxury", "高級", "奢華", "premium", "精品")):
        return (
            "quiet luxury",
            ["walnut", "cream white", "brushed brass", "stone gray", "deep green"],
            ["walnut veneer", "brass accents", "stone slab", "textured plaster"],
            "Layered warm architectural lighting with subtle highlight spots",
        )
    if _has_any(text, ("wabi", "侘寂", "日式", "japanese", "禪")):
        return (
            "wabi sabi",
            ["rice paper white", "wabi sabi clay", "warm oak", "linen beige", "stone gray"],
            ["clay plaster", "warm oak", "linen fabric", "rice paper", "natural stone"],
            "Low warm lighting with diffused paper-lantern glow",
        )
    return (
        "interior concept",
        ["warm oak", "cream white", "black metal", "linen beige", "sage green"],
        ["warm wood", "painted plaster", "black metal", "soft fabric"],
        "Soft ambient daylight with warm decorative lights",
    )


def _fallback_furniture(room_type: str) -> list[dict[str, int | str]]:
    if room_type == "bedroom":
        return [
            {"type": "bed", "quantity": 1},
            {"type": "side table", "quantity": 2},
            {"type": "desk", "quantity": 1},
            {"type": "chair", "quantity": 1},
            {"type": "wardrobe shelf", "quantity": 1},
            {"type": "plant", "quantity": 2},
            {"type": "lamp", "quantity": 2},
            {"type": "window", "quantity": 1},
        ]
    if room_type == "office_lounge":
        return [
            {"type": "sofa", "quantity": 1},
            {"type": "coffee table", "quantity": 1},
            {"type": "chair", "quantity": 2},
            {"type": "shelf", "quantity": 1},
            {"type": "plant", "quantity": 3},
            {"type": "lamp", "quantity": 2},
            {"type": "glass window", "quantity": 1},
        ]
    return [
        {"type": "bar counter", "quantity": 1},
        {"type": "dining table", "quantity": 4},
        {"type": "chair", "quantity": 12},
        {"type": "shelf wall", "quantity": 2},
        {"type": "plant", "quantity": 4},
        {"type": "pendant light", "quantity": 6},
        {"type": "glass window", "quantity": 2},
    ]


def _fallback_zones(room_type: str) -> list[str]:
    if room_type == "bedroom":
        return ["bed wall", "side tables", "desk by window", "wardrobe wall", "soft corner lighting"]
    if room_type == "office_lounge":
        return ["sofa lounge", "coffee table center", "side chairs", "back shelf", "window plant corners"]
    return ["bar zone", "front seating", "back shelf wall", "corner plants", "counter pendant lights"]


def generateFallbackDesignBrief(prompt: str, fallback_reason: str = "CLI unavailable") -> dict[str, Any]:
    """Create a deterministic brief when local LLM CLI generation is unavailable."""
    raw_prompt = prompt.strip()
    text = raw_prompt.lower()
    if _has_any(text, ("bedroom", "臥室", "卧室", "bed", "睡房")):
        room_type = "bedroom"
    elif _has_any(text, ("office", "lounge", "辦公", "办公室", "休息區", "休息区")):
        room_type = "office_lounge"
    else:
        room_type = "cafe"
    style, palette, materials, lighting = _resolve_fallback_style(text)
    furniture = _fallback_furniture(room_type)
    furniture_names = ", ".join(str(item["type"]) for item in furniture[:5])
    title = f"{style.title()} {room_type.replace('_', ' ')}"
    summary = (
        f"Deterministic fallback brief for: {raw_prompt or 'interior concept'}. "
        f"Focus on {style} atmosphere, {palette[0]}, {palette[1]}, and {palette[2]}."
    )
    render_prompt = (
        f"Generate an isometric cutaway dollhouse-style interior render of a {style} {room_type.replace('_', ' ')}, "
        f"with {furniture_names}, palette {', '.join(palette)}, materials {', '.join(materials)}, "
        f"{lighting}, soft shadows, fixed 4:3 canvas, neutral warm gray studio background."
    )
    return {
        "projectType": "interior_design",
        "projectTitle": title,
        "title": title,
        "summary": summary,
        "roomType": room_type,
        "spaceType": room_type,
        "stylePreset": style,
        "style": style,
        "mood": f"{style} atmosphere with practical presentation-ready spatial planning",
        "palette": palette,
        "furniture": furniture,
        "materials": materials,
        "lighting": lighting,
        "spatialNotes": "; ".join(_fallback_zones(room_type)),
        "zones": _fallback_zones(room_type),
        "renderPrompt": render_prompt,
        "conceptPrompt": render_prompt,
        "fallbackUsed": True,
        "fallbackReason": fallback_reason,
        "source": "local_fallback",
    }


def detect_design_brief_cli() -> dict[str, str]:
    codex_path = shutil.which("codex")
    if codex_path:
        return {"provider": "codex", "command": codex_path}
    agy_path = shutil.which("agy")
    if agy_path:
        return {"provider": "antigravity", "command": agy_path}
    raise DesignBriefGenerationError("No local Codex or Antigravity CLI is available.")


def _extract_balanced_json(text: str) -> str | None:
    decoder = json.JSONDecoder()
    for index, char in enumerate(text):
        if char != "{":
            continue
        try:
            _, end = decoder.raw_decode(text[index:])
            return text[index:index + end]
        except json.JSONDecodeError:
            continue
    return None


def _extract_content_from_cli_stdout(stdout: str) -> str:
    messages: list[str] = []
    for line in stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            messages.append(line)
            continue
        for key in ("message", "content", "text", "output"):
            value = event.get(key)
            if isinstance(value, str):
                messages.append(value)
        item = event.get("item")
        if isinstance(item, dict):
            for key in ("message", "content", "text"):
                value = item.get(key)
                if isinstance(value, str):
                    messages.append(value)
            content = item.get("content")
            if isinstance(content, list):
                for part in content:
                    if isinstance(part, dict) and isinstance(part.get("text"), str):
                        messages.append(part["text"])
        data = event.get("data")
        if isinstance(data, dict):
            for key in ("message", "content", "text"):
                value = data.get(key)
                if isinstance(value, str):
                    messages.append(value)
    return "\n".join(messages) if messages else stdout


def _parse_json_content(content: str) -> dict[str, Any]:
    content = content.strip()
    try:
        value = json.loads(content)
    except json.JSONDecodeError as exc:
        extracted = _extract_balanced_json(content)
        if not extracted:
            raise DesignBriefGenerationError("CLI returned no valid JSON block.") from exc
        try:
            value = json.loads(extracted)
        except json.JSONDecodeError as second_exc:
            raise DesignBriefGenerationError("CLI returned malformed JSON.") from second_exc
    if not isinstance(value, dict):
        raise DesignBriefGenerationError("LLM returned JSON, but not an object.")
    return value


def _validate_design_brief(value: dict[str, Any]) -> dict[str, Any]:
    missing = [name for name in DESIGN_BRIEF_SCHEMA["required"] if name not in value]
    if missing:
        raise DesignBriefGenerationError("LLM JSON is missing required fields: " + ", ".join(missing))
    if not isinstance(value["palette"], list) or not all(isinstance(item, str) for item in value["palette"]):
        raise DesignBriefGenerationError("LLM JSON field palette must be an array of strings.")
    if not isinstance(value["furniture"], list) or not value["furniture"]:
        raise DesignBriefGenerationError("LLM JSON field furniture must be a non-empty array.")
    for item in value["furniture"]:
        if not isinstance(item, dict) or not isinstance(item.get("type"), str) or not isinstance(item.get("quantity"), int):
            raise DesignBriefGenerationError("LLM JSON furniture items must include type:string and quantity:number.")
    return value


def _build_design_brief_prompt(userPrompt: str) -> str:
    return (
        "You are NOVA's interior concept architect.\n"
        "Convert the user's design request into a concise Design Brief JSON object.\n"
        "Do not edit files. Do not run shell commands. Only answer the brief JSON.\n"
        "Return only JSON. Do not include markdown, commentary, or code fences.\n"
        "The JSON must match this schema exactly:\n"
        + json.dumps(DESIGN_BRIEF_SCHEMA, ensure_ascii=False, indent=2)
        + "\n\nUser design request:\n"
        + userPrompt.strip()
    )


def _run_codex(prompt: str, timeout_seconds: int) -> tuple[str, list[str], float]:
    command = ["codex", "exec", "--json", "--ephemeral", "--sandbox", "read-only", prompt]
    started = time.perf_counter()
    try:
        completed = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", timeout=timeout_seconds)
    except subprocess.TimeoutExpired as exc:
        raise DesignBriefGenerationError(f"Codex CLI timed out after {timeout_seconds} seconds.") from exc
    except (OSError, UnicodeError) as exc:
        raise DesignBriefGenerationError(f"Codex CLI execution failed: {type(exc).__name__}: {exc}") from exc
    elapsed = time.perf_counter() - started
    if completed.returncode != 0:
        message = (completed.stderr or completed.stdout or "Codex CLI failed.").strip()
        raise DesignBriefGenerationError("Codex CLI failed: " + message.splitlines()[-1])
    return completed.stdout, command[:-1] + ["<prompt>"], elapsed


def _run_antigravity(prompt: str, timeout_seconds: int) -> tuple[str, list[str], float]:
    command = ["agy", "-p", prompt, "--output-format", "json"]
    started = time.perf_counter()
    try:
        completed = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", timeout=timeout_seconds)
    except subprocess.TimeoutExpired as exc:
        raise DesignBriefGenerationError(f"Antigravity CLI timed out after {timeout_seconds} seconds.") from exc
    except (OSError, UnicodeError) as exc:
        raise DesignBriefGenerationError(f"Antigravity CLI execution failed: {type(exc).__name__}: {exc}") from exc
    elapsed = time.perf_counter() - started
    if completed.returncode != 0:
        message = (completed.stderr or completed.stdout or "Antigravity CLI failed.").strip()
        raise DesignBriefGenerationError("Antigravity CLI failed: " + message.splitlines()[-1])
    return completed.stdout, command[:2] + ["<prompt>", "--output-format", "json"], elapsed


def generateDesignBriefResult(userPrompt: str, *, model: str | None = None, retry_on_invalid_json: bool = True, timeout_seconds: int | None = None) -> dict[str, Any]:
    """Generate a structured interior design brief with CLI metadata."""
    timeout = timeout_seconds or int(os.getenv("NOVA_DESIGN_BRIEF_TIMEOUT_SECONDS", "60"))
    prompt = _build_design_brief_prompt(userPrompt)
    try:
        cli = detect_design_brief_cli()
        stdout, command, elapsed = _run_codex(prompt, timeout) if cli["provider"] == "codex" else _run_antigravity(prompt, timeout)
        content = _extract_content_from_cli_stdout(stdout)
        try:
            brief = _validate_design_brief(_parse_json_content(content))
        except DesignBriefGenerationError:
            if not retry_on_invalid_json:
                raise
            repair_prompt = (
                "Extract and repair the design brief below. Return only valid JSON matching the same schema.\n"
                + json.dumps(DESIGN_BRIEF_SCHEMA, ensure_ascii=False, indent=2)
                + "\n\nPrevious CLI output:\n"
                + content
            )
            stdout, command, elapsed = _run_codex(repair_prompt, timeout) if cli["provider"] == "codex" else _run_antigravity(repair_prompt, timeout)
            brief = _validate_design_brief(_parse_json_content(_extract_content_from_cli_stdout(stdout)))
        return {"brief": brief, "provider": cli["provider"], "command": command, "elapsedSeconds": round(elapsed, 2), "fallbackUsed": False}
    except DesignBriefGenerationError as exc:
        reason = str(exc)
        brief = _validate_design_brief(generateFallbackDesignBrief(userPrompt, reason))
        return {
            "brief": brief,
            "provider": "DeterministicDesignBriefFallback",
            "command": ["local", "deterministic-design-brief-fallback"],
            "elapsedSeconds": 0,
            "fallbackUsed": True,
            "fallbackReason": reason,
            "source": "local_fallback",
        }


def generateDesignBrief(userPrompt: str, *, model: str | None = None, retry_on_invalid_json: bool = True, timeout_seconds: int | None = None) -> dict[str, Any]:
    """Generate a structured interior design brief with a local logged-in CLI."""
    return generateDesignBriefResult(userPrompt, model=model, retry_on_invalid_json=retry_on_invalid_json, timeout_seconds=timeout_seconds)["brief"]
