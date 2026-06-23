import argparse
import subprocess
import sys
from pathlib import Path

import cv2
import imageio_ffmpeg
import numpy as np


def ffmpeg_exe() -> str:
    return imageio_ffmpeg.get_ffmpeg_exe()


def sample_lab_stats(video_path: Path, max_samples: int = 48):
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open reference: {video_path}")

    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if frame_count <= 0:
        raise RuntimeError(f"Reference has no frames: {video_path}")

    indices = np.linspace(0, frame_count - 1, min(max_samples, frame_count), dtype=int)
    pixels = []
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
        ok, frame = cap.read()
        if not ok:
            continue
        frame = cv2.resize(frame, (1280, 720), interpolation=cv2.INTER_AREA)
        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB).astype(np.float32)
        pixels.append(lab.reshape(-1, 3))
    cap.release()

    if not pixels:
        raise RuntimeError(f"Could not sample reference frames: {video_path}")

    stacked = np.concatenate(pixels, axis=0)
    mean = stacked.mean(axis=0)
    std = stacked.std(axis=0)
    std = np.maximum(std, 1.0)
    return mean, std


def match_frame_to_lab(frame, ref_mean, ref_std, strength: float):
    frame = cv2.resize(frame, (1280, 720), interpolation=cv2.INTER_AREA)
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB).astype(np.float32)
    mean = lab.reshape(-1, 3).mean(axis=0)
    std = lab.reshape(-1, 3).std(axis=0)
    std = np.maximum(std, 1.0)

    matched = (lab - mean) * (ref_std / std) + ref_mean
    channel_strength = np.array([strength, strength * 0.28, strength * 0.28], dtype=np.float32)
    blended = lab * (1.0 - channel_strength) + matched * channel_strength
    blended = np.clip(blended, 0, 255).astype(np.uint8)
    return cv2.cvtColor(blended, cv2.COLOR_LAB2BGR)


def convert(source: Path, reference: Path, output: Path, strength: float):
    ref_mean, ref_std = sample_lab_stats(reference)

    cap = cv2.VideoCapture(str(source))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open source: {source}")

    output.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        ffmpeg_exe(),
        "-y",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "bgr24",
        "-s",
        "1280x720",
        "-r",
        "24",
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
        "24",
        "-vf",
        "scale=1280:720",
        "-movflags",
        "+faststart",
        str(output),
    ]

    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    frame_count = 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            matched = match_frame_to_lab(frame, ref_mean, ref_std, strength)
            proc.stdin.write(matched.tobytes())
            frame_count += 1
    finally:
        cap.release()
        if proc.stdin:
            proc.stdin.close()

    return_code = proc.wait()
    if return_code != 0:
        raise RuntimeError(f"ffmpeg failed with exit code {return_code}")
    return frame_count


def main():
    parser = argparse.ArgumentParser(description="Match source video color statistics to a reference video.")
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--reference", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--strength", type=float, default=0.62)
    args = parser.parse_args()

    frames = convert(args.source, args.reference, args.output, np.clip(args.strength, 0.0, 1.0))
    print(f"wrote {args.output} ({frames} frames)")


if __name__ == "__main__":
    main()
