"""Backend-only providers for NOVA architectural interior rendering."""
from __future__ import annotations

import json
import os
import urllib.request
from abc import ABC, abstractmethod
from pathlib import Path


class InteriorRenderProvider(ABC):
    name = "provider"

    @abstractmethod
    def detectAvailability(self) -> dict: ...

    @abstractmethod
    def render(self, job: dict, output_dir: Path, progress) -> list[dict]: ...


class LocalMockRenderProvider(InteriorRenderProvider):
    name = "localMockRenderProvider"

    def detectAvailability(self) -> dict:
        return {"available": True, "status": "local_preview_ready", "production": False}

    def render(self, job: dict, output_dir: Path, progress) -> list[dict]:
        output_dir.mkdir(parents=True, exist_ok=True)
        views = [
            ("front", "Front view", 0, "#d79b57", "#6f4932"),
            ("wide", "Wide view", 80, "#e0b775", "#496d68"),
            ("side", "Side view", -85, "#c98c52", "#755247"),
            ("detail", "Material detail", 155, "#efc27b", "#3e6356"),
        ]
        outputs = []
        for index, (view, label, shift, glow, accent) in enumerate(views):
            svg = self._create_svg(label, shift, glow, accent, job)
            filename = f"render_{view}.svg"
            (output_dir / filename).write_text(svg, encoding="utf-8")
            outputs.append({"view": view, "label": label, "url": f"/{output_dir.as_posix()}/{filename}", "mimeType": "image/svg+xml", "width": 1600, "height": 900})
            progress(58 + index * 9, f"Rendering {label.lower()}")
        return outputs

    def _create_svg(self, label: str, shift: int, glow: str, accent: str, job: dict) -> str:
        # A deterministic architectural visualization placeholder: layered perspective,
        # light transport, material texture and depth cues make the fallback useful
        # without pretending that a production diffusion provider is connected.
        return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
<defs>
 <linearGradient id="sky" x2="0" y2="1"><stop stop-color="#d9f1f4"/><stop offset=".58" stop-color="#f6e8ca"/><stop offset="1" stop-color="#a9bdad"/></linearGradient>
 <linearGradient id="room" x2=".8" y2="1"><stop stop-color="#273333"/><stop offset=".55" stop-color="#172223"/><stop offset="1" stop-color="#0b1112"/></linearGradient>
 <linearGradient id="wood" x2="1" y2=".2"><stop stop-color="#9a6845"/><stop offset=".35" stop-color="#5d3928"/><stop offset=".7" stop-color="#b17b52"/><stop offset="1" stop-color="#42291e"/></linearGradient>
 <linearGradient id="stone" x2="1" y2="1"><stop stop-color="#ded8c9"/><stop offset=".45" stop-color="#8f8d85"/><stop offset="1" stop-color="#484a48"/></linearGradient>
 <linearGradient id="glass" x2="1" y2="1"><stop stop-color="#dff8fa" stop-opacity=".68"/><stop offset=".5" stop-color="#7da5a5" stop-opacity=".2"/><stop offset="1" stop-color="#1b3538" stop-opacity=".62"/></linearGradient>
 <radialGradient id="lamp"><stop stop-color="#fff7ca"/><stop offset=".22" stop-color="{glow}" stop-opacity=".9"/><stop offset="1" stop-color="{glow}" stop-opacity="0"/></radialGradient>
 <radialGradient id="sun"><stop stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
 <pattern id="floor" width="110" height="30" patternUnits="userSpaceOnUse" patternTransform="skewX(-24)"><rect width="110" height="29" fill="#68442f"/><path d="M0 2h110" stroke="#c18a5c" stroke-opacity=".35"/><path d="M108 0v30" stroke="#1b1512" stroke-opacity=".55"/></pattern>
 <filter id="shadow"><feGaussianBlur stdDeviation="18"/></filter><filter id="soft"><feGaussianBlur stdDeviation="5"/></filter>
 <filter id="grain"><feTurbulence baseFrequency=".8" numOctaves="2" result="n"/><feBlend in="SourceGraphic" in2="n" mode="soft-light"/></filter>
 <clipPath id="windows"><path d="M60 110H770V595H60z"/></clipPath>
</defs>
<rect width="1600" height="900" fill="#101718"/>
<path d="M0 0h1600v650L800 600 0 675z" fill="url(#room)"/>
<path d="M0 900V650l800-50 800 48v252z" fill="url(#floor)"/>
<path d="M0 0h70v680L0 708zM780 0h820v78H780z" fill="#141d1d"/>
<g transform="translate({shift} 0)">
 <rect x="62" y="112" width="706" height="480" rx="3" fill="url(#sky)"/>
 <g clip-path="url(#windows)" opacity=".72"><circle cx="215" cy="250" r="165" fill="#8ca990"/><circle cx="560" cy="235" r="190" fill="#78968a"/><path d="M0 490Q260 365 520 500T900 430V650H0z" fill="#b7c7ad"/><circle cx="620" cy="160" r="220" fill="url(#sun)"/></g>
 <g stroke="#243334" stroke-width="18"><path d="M62 110v490M300 110v490M535 110v490M770 110v490M58 108h718M58 595h718"/></g>
 <path d="M70 120h690v465H70z" fill="url(#glass)" opacity=".26"/>
</g>
<path d="M842 115h690v420H842z" fill="#8d8270"/><path d="M860 132h654v384H860z" fill="#b7aa92" filter="url(#grain)"/>
<path d="M875 170h250v300H875z" fill="{accent}" opacity=".34"/><path d="M1160 165h320v36h-320zM1160 230h265v20h-265z" fill="#e5d8bd" opacity=".42"/>
<ellipse cx="1040" cy="783" rx="510" ry="58" fill="#000" opacity=".45" filter="url(#shadow)"/>
<g transform="translate(30 10)">
 <path d="M820 525l565-20 120 155-610 35z" fill="url(#stone)"/>
 <path d="M894 680l612-34v154l-610 57z" fill="url(#wood)"/>
 <path d="M930 716l530-36v87l-530 45z" fill="#1d2928" opacity=".5"/>
 <g fill="#b9c0b8"><rect x="1010" y="570" width="112" height="78" rx="8"/><rect x="1026" y="548" width="80" height="32" rx="12"/></g>
 <g stroke="#33261e" stroke-width="9" fill="none"><path d="M1050 548q10-65 42-68q35 2 40 76"/><path d="M1240 545v90m45-96v95"/></g>
 <g fill="#eee8d7"><ellipse cx="1238" cy="545" rx="26" ry="9"/><ellipse cx="1288" cy="540" rx="26" ry="9"/></g>
</g>
<g>
 <ellipse cx="355" cy="762" rx="300" ry="65" fill="#000" opacity=".42" filter="url(#shadow)"/>
 <path d="M88 650q0-55 58-68h350q65 8 70 70v98H88z" fill="#31554d"/>
 <path d="M110 592q8-48 62-50h295q60 4 69 53v100H110z" fill="#496e63"/>
 <path d="M126 573h178v98H126zm198 0h186v98H324z" fill="#607f73"/>
 <g fill="#d5b784"><path d="M170 600q55-34 105 0v62H170z"/><path d="M360 600q55-34 106 0v62H360z"/></g>
 <path d="M72 724h510v46H72z" fill="#172321"/>
</g>
<g fill="url(#wood)" stroke="#2a1c16" stroke-width="5">
 <ellipse cx="670" cy="690" rx="128" ry="42"/><path d="M650 700h38l18 146h-78z"/>
 <ellipse cx="760" cy="790" rx="115" ry="35"/><path d="M742 798h34l15 89h-66z"/>
</g>
<g fill="#33413e"><path d="M565 735q70-42 130 0v42H565z"/><path d="M720 820q66-38 122 0v38H720z"/></g>
<g>
 <path d="M1400 610h70l26 190h-124z" fill="#655044"/><g fill="#3f7651"><ellipse cx="1432" cy="580" rx="48" ry="110" transform="rotate(-20 1432 580)"/><ellipse cx="1470" cy="570" rx="42" ry="120" transform="rotate(18 1470 570)"/><ellipse cx="1392" cy="596" rx="34" ry="90" transform="rotate(-38 1392 596)"/></g>
 <path d="M36 595h70l24 176H10z" fill="#765741"/><g fill="#477b52"><ellipse cx="62" cy="560" rx="38" ry="94" transform="rotate(-25 62 560)"/><ellipse cx="92" cy="550" rx="32" ry="100" transform="rotate(20 92 550)"/></g>
</g>
<g stroke="#201d19" stroke-width="6"><path d="M420 0v235M730 0v205M1080 0v235"/></g>
<g><ellipse cx="420" cy="270" rx="88" ry="100" fill="url(#lamp)"/><path d="M365 242q55-72 110 0l-22 48h-66z" fill="#292922"/><ellipse cx="730" cy="240" rx="82" ry="95" fill="url(#lamp)"/><path d="M677 215q53-70 106 0l-20 46h-66z" fill="#252822"/><ellipse cx="1080" cy="270" rx="90" ry="105" fill="url(#lamp)"/><path d="M1024 242q56-75 112 0l-22 49h-68z" fill="#292922"/></g>
<path d="M720 560L120 900H0V755z" fill="#fff6d6" opacity=".12"/>
<rect width="1600" height="900" fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="18"/>
<g font-family="Arial,sans-serif"><rect x="48" y="38" width="225" height="54" rx="27" fill="#071313" fill-opacity=".7"/><circle cx="78" cy="65" r="7" fill="#e9b96e"/><text x="98" y="72" fill="#f5eee2" font-size="22">{label}</text><text x="1540" y="860" text-anchor="end" fill="#fff" fill-opacity=".5" font-size="15">NOVA LOCAL RENDER · ARCHVIZ PREVIEW</text></g>
</svg>'''


class ComfyUIRenderProvider(InteriorRenderProvider):
    name = "comfyUIProvider"
    def __init__(self): self.url = os.getenv("COMFYUI_URL", "").rstrip("/")
    def detectAvailability(self) -> dict:
        if not self.url: return {"available": False, "status": "not_configured"}
        try:
            with urllib.request.urlopen(f"{self.url}/system_stats", timeout=1.2) as response:
                if response.status < 400: return {"available": True, "status": "provider_ready_but_workflow_missing"}
        except Exception as exc: return {"available": False, "status": "unreachable", "error": str(exc)}
        return {"available": False, "status": "unreachable"}
    def createWorkflow(self, prompt, negativePrompt): return {"status": "provider_ready_but_workflow_missing", "prompt": prompt, "negativePrompt": negativePrompt}
    def submitRenderJob(self): return {"status": "workflow_missing"}
    def pollRenderStatus(self): return {"status": "workflow_missing"}
    def collectOutputs(self): return []
    def returnImageUrls(self): return []
    def render(self, job, output_dir, progress): raise RuntimeError("provider_ready_but_workflow_missing")


class _PlaceholderProvider(InteriorRenderProvider):
    def detectAvailability(self): return {"available": False, "status": "backend_proxy_required"}
    def render(self, job, output_dir, progress): raise RuntimeError("backend_proxy_required")

class DalleRenderProvider(_PlaceholderProvider): name = "dalleProvider"
class StableDiffusionProvider(_PlaceholderProvider): name = "stableDiffusionProvider"
class FutureImageProvider(_PlaceholderProvider): name = "futureImageProvider"
