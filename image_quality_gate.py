"""Shared image validation used by every NOVA render provider."""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageStat


class ImageQualityGate:
    """Preserves the validated ComfyUI output rules without provider coupling."""

    @staticmethod
    def validate(path: Path) -> dict:
        stats = {
            "exists": path.is_file(),
            "fileSize": path.stat().st_size if path.is_file() else 0,
            "imageSize": [0, 0],
            "mean": [0.0, 0.0, 0.0],
            "extrema": [[0, 0], [0, 0], [0, 0]],
            "isAllBlack": False,
            "isAllWhite": False,
            "isSingleColor": False,
            "hasNonFinite": False,
            "canOpen": False,
            "valid": False,
        }
        if not stats["exists"]:
            return stats
        try:
            with Image.open(path) as source:
                image = source.convert("RGB")
                image.load()
                stats["canOpen"] = True
                stats["imageSize"] = [image.width, image.height]
                stats["mean"] = [float(value) for value in ImageStat.Stat(image).mean]
                stats["extrema"] = [[int(low), int(high)] for low, high in image.getextrema()]
                stats["hasNonFinite"] = not all(math.isfinite(value) for value in stats["mean"])
                stats["isAllBlack"] = all(pair == [0, 0] for pair in stats["extrema"])
                stats["isAllWhite"] = all(pair == [255, 255] for pair in stats["extrema"])
                stats["isSingleColor"] = all(low == high for low, high in stats["extrema"])
                stats["valid"] = bool(
                    stats["fileSize"] > 10 * 1024
                    and image.width > 0
                    and image.height > 0
                    and not stats["isAllBlack"]
                    and not stats["isAllWhite"]
                    and not stats["isSingleColor"]
                    and not stats["hasNonFinite"]
                )
        except Exception as exc:
            stats["openError"] = f"{type(exc).__name__}: {exc}"
        return stats
