import argparse
import subprocess
from pathlib import Path

import cv2
import imageio_ffmpeg
import numpy as np


WIDTH = 1280
HEIGHT = 720
FPS = 24


def read_boundary_frames(path: Path, mode: str, count: int):
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {path}")

    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total <= 0:
        raise RuntimeError(f"No frames in video: {path}")

    if mode == "start":
        indices = range(0, min(count, total))
    elif mode == "end":
        indices = range(max(0, total - count), total)
    else:
        raise ValueError(f"Unknown boundary mode: {mode}")

    frames = []
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
        ok, frame = cap.read()
        if ok:
            frames.append(cv2.resize(frame, (WIDTH, HEIGHT), interpolation=cv2.INTER_AREA))
    cap.release()

    if not frames:
        raise RuntimeError(f"Could not read boundary frames from: {path}")
    return frames


def boundary_stats(frames):
    ys = []
    sats = []
    rgbs = []
    for frame in frames:
        ycrcb = cv2.cvtColor(frame, cv2.COLOR_BGR2YCrCb)
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        ys.append(ycrcb[:, :, 0].astype(np.float32))
        sats.append(hsv[:, :, 1].astype(np.float32))
        rgbs.append(frame[:, :, ::-1].reshape(-1, 3).mean(axis=0))

    y = np.concatenate([v.reshape(-1) for v in ys])
    sat = np.concatenate([v.reshape(-1) for v in sats])
    rgb = np.vstack(rgbs).mean(axis=0)
    return {
        "brightness": float(y.mean()),
        "contrast": float(y.std()),
        "saturation": float(sat.mean()),
        "rgb": rgb.astype(np.float32),
    }


def correction_from_boundaries(source_stats, reference_stats):
    src_b = max(source_stats["brightness"], 1.0)
    ref_b = reference_stats["brightness"]
    src_c = max(source_stats["contrast"], 1.0)
    ref_c = reference_stats["contrast"]
    src_s = max(source_stats["saturation"], 1.0)
    ref_s = reference_stats["saturation"]

    contrast_scale = float(np.clip(ref_c / src_c, 0.85, 1.15))
    saturation_scale = float(np.clip(ref_s / src_s, 0.82, 1.18))

    raw_gains = reference_stats["rgb"] / np.maximum(source_stats["rgb"], 1.0)
    raw_gains = raw_gains / max(float(raw_gains.mean()), 0.001)
    # Keep color temperature correction deliberately subtle.
    rgb_gains = 1.0 + (np.clip(raw_gains, 0.94, 1.06) - 1.0) * 0.30
    rgb_gains = np.clip(rgb_gains, 0.985, 1.015).astype(np.float32)

    return {
        "brightness_target": ref_b,
        "brightness_source": src_b,
        "contrast_scale": contrast_scale,
        "saturation_scale": saturation_scale,
        "rgb_gains": rgb_gains,
    }


def calibrate_correction(source_frames, reference_stats, correction):
    calibrated = dict(correction)
    calibrated["rgb_gains"] = correction["rgb_gains"].copy()

    for _ in range(5):
        corrected_frames = [apply_correction(frame, calibrated) for frame in source_frames]
        measured = boundary_stats(corrected_frames)

        brightness_error = reference_stats["brightness"] - measured["brightness"]
        calibrated["brightness_target"] += brightness_error

        sat = max(measured["saturation"], 1.0)
        sat_scale = calibrated["saturation_scale"] * (reference_stats["saturation"] / sat)
        calibrated["saturation_scale"] = float(np.clip(sat_scale, 0.70, 1.25))

    return calibrated


def apply_correction(frame, correction):
    frame = cv2.resize(frame, (WIDTH, HEIGHT), interpolation=cv2.INTER_AREA)

    rgb = frame[:, :, ::-1].astype(np.float32)
    rgb *= correction["rgb_gains"].reshape(1, 1, 3)
    frame = np.clip(rgb, 0, 255).astype(np.uint8)[:, :, ::-1]

    ycrcb = cv2.cvtColor(frame, cv2.COLOR_BGR2YCrCb).astype(np.float32)
    y = ycrcb[:, :, 0]
    y = (y - correction["brightness_source"]) * correction["contrast_scale"] + correction["brightness_target"]
    ycrcb[:, :, 0] = np.clip(y, 0, 255)
    frame = cv2.cvtColor(ycrcb.astype(np.uint8), cv2.COLOR_YCrCb2BGR)

    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[:, :, 1] = np.clip(hsv[:, :, 1] * correction["saturation_scale"], 0, 255)
    return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)


def convert(source: Path, reference: Path, output: Path, frame_count: int):
    source_frames = read_boundary_frames(source, "end", frame_count)
    reference_frames = read_boundary_frames(reference, "start", frame_count)
    reference_stats = boundary_stats(reference_frames)
    correction = correction_from_boundaries(boundary_stats(source_frames), reference_stats)
    correction = calibrate_correction(source_frames, reference_stats, correction)

    cap = cv2.VideoCapture(str(source))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open source: {source}")

    output.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        imageio_ffmpeg.get_ffmpeg_exe(),
        "-y",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "bgr24",
        "-s",
        f"{WIDTH}x{HEIGHT}",
        "-r",
        str(FPS),
        "-i",
        "-",
        "-an",
        "-c:v",
        "libx264",
        "-profile:v",
        "high",
        "-pix_fmt",
        "yuv420p",
        "-r",
        str(FPS),
        "-movflags",
        "+faststart",
        str(output),
    ]

    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    written = 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            corrected = apply_correction(frame, correction)
            proc.stdin.write(corrected.tobytes())
            written += 1
    finally:
        cap.release()
        if proc.stdin:
            proc.stdin.close()

    code = proc.wait()
    if code != 0:
        raise RuntimeError(f"ffmpeg failed with exit code {code}")
    return written, correction


def main():
    parser = argparse.ArgumentParser(description="Boundary-based color match for one source video.")
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--reference", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--frames", type=int, default=10)
    args = parser.parse_args()

    written, correction = convert(args.source, args.reference, args.output, args.frames)
    gains = ",".join(f"{v:.4f}" for v in correction["rgb_gains"])
    print(
        f"wrote {args.output} ({written} frames); "
        f"contrast_scale={correction['contrast_scale']:.4f}; "
        f"saturation_scale={correction['saturation_scale']:.4f}; "
        f"rgb_gains={gains}"
    )


if __name__ == "__main__":
    main()
