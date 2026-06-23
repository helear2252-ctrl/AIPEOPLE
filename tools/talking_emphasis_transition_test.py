import subprocess
from pathlib import Path

import cv2
import imageio_ffmpeg
import numpy as np


WIDTH = 1280
HEIGHT = 720
FPS = 24


def read_clip(path: Path, start_sec: float, duration_sec: float):
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or FPS
    start = int(round(start_sec * fps))
    count = int(round(duration_sec * FPS))
    frames = []
    for out_idx in range(count):
        src_idx = start + int(round(out_idx * fps / FPS))
        cap.set(cv2.CAP_PROP_POS_FRAMES, src_idx)
        ok, frame = cap.read()
        if not ok:
            break
        frames.append(cv2.resize(frame, (WIDTH, HEIGHT), interpolation=cv2.INTER_AREA))
    cap.release()
    if not frames:
        raise RuntimeError(f"No frames read from {path}")
    return frames


def read_boundary(path: Path, mode: str, count: int):
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {path}")
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    start = 0 if mode == "start" else max(0, total - count)
    frames = []
    for idx in range(start, min(total, start + count)):
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ok, frame = cap.read()
        if ok:
            frames.append(cv2.resize(frame, (WIDTH, HEIGHT), interpolation=cv2.INTER_AREA))
    cap.release()
    return frames


def stats(frames):
    ys = []
    sats = []
    rgbs = []
    for frame in frames:
        ycrcb = cv2.cvtColor(frame, cv2.COLOR_BGR2YCrCb)
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        ys.append(ycrcb[:, :, 0].astype(np.float32).reshape(-1))
        sats.append(hsv[:, :, 1].astype(np.float32).reshape(-1))
        rgbs.append(frame[:, :, ::-1].reshape(-1, 3).mean(axis=0))
    y = np.concatenate(ys)
    sat = np.concatenate(sats)
    return {
        "brightness": float(y.mean()),
        "contrast": float(y.std()),
        "saturation": float(sat.mean()),
        "rgb": np.vstack(rgbs).mean(axis=0).astype(np.float32),
    }


def build_correction(source_stats, target_stats):
    contrast_scale = float(np.clip(target_stats["contrast"] / max(source_stats["contrast"], 1.0), 0.90, 1.10))
    saturation_scale = float(np.clip(target_stats["saturation"] / max(source_stats["saturation"], 1.0), 0.90, 1.10))
    raw_gains = target_stats["rgb"] / np.maximum(source_stats["rgb"], 1.0)
    raw_gains = raw_gains / max(float(raw_gains.mean()), 0.001)
    rgb_gains = 1.0 + (np.clip(raw_gains, 0.96, 1.04) - 1.0) * 0.20
    return {
        "source_brightness": source_stats["brightness"],
        "target_brightness": target_stats["brightness"],
        "contrast_scale": contrast_scale,
        "saturation_scale": saturation_scale,
        "rgb_gains": np.clip(rgb_gains, 0.992, 1.008).astype(np.float32),
    }


def apply_correction(frame, correction, strength):
    original = frame
    rgb = frame[:, :, ::-1].astype(np.float32)
    rgb *= (1.0 + (correction["rgb_gains"] - 1.0) * strength).reshape(1, 1, 3)
    frame = np.clip(rgb, 0, 255).astype(np.uint8)[:, :, ::-1]

    ycrcb = cv2.cvtColor(frame, cv2.COLOR_BGR2YCrCb).astype(np.float32)
    y = ycrcb[:, :, 0]
    contrast = 1.0 + (correction["contrast_scale"] - 1.0) * strength
    target = correction["source_brightness"] + (correction["target_brightness"] - correction["source_brightness"]) * strength
    y = (y - correction["source_brightness"]) * contrast + target
    ycrcb[:, :, 0] = np.clip(y, 0, 255)
    frame = cv2.cvtColor(ycrcb.astype(np.uint8), cv2.COLOR_YCrCb2BGR)

    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV).astype(np.float32)
    sat_scale = 1.0 + (correction["saturation_scale"] - 1.0) * strength
    hsv[:, :, 1] = np.clip(hsv[:, :, 1] * sat_scale, 0, 255)
    corrected = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
    return cv2.addWeighted(original, 1.0 - strength, corrected, strength, 0)


def progressive_tail(frames, correction, tail_frames):
    out = list(frames)
    start = max(0, len(out) - tail_frames)
    span = max(1, len(out) - start - 1)
    for idx in range(start, len(out)):
        t = (idx - start) / span
        # Smoothstep keeps early talking frames unchanged and converges only at the boundary.
        strength = t * t * (3.0 - 2.0 * t)
        out[idx] = apply_correction(out[idx], correction, strength)
    return out


def crossfade(prep_frames, entry_frames, fade_frames):
    keep = prep_frames[:-fade_frames]
    faded = []
    for i in range(fade_frames):
        alpha = (i + 1) / (fade_frames + 1)
        faded.append(cv2.addWeighted(prep_frames[-fade_frames + i], 1.0 - alpha, entry_frames[i], alpha, 0))
    return keep + faded + entry_frames[fade_frames:]


def write_video(frames, output: Path):
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
    try:
        for frame in frames:
            proc.stdin.write(frame.tobytes())
    finally:
        if proc.stdin:
            proc.stdin.close()
    code = proc.wait()
    if code != 0:
        raise RuntimeError(f"ffmpeg failed with exit code {code}")


def main():
    source_001 = Path("assets/avatar/AIPEOPLE/001.mp4")
    source_002 = Path("assets/avatar/AIPEOPLE/002.mp4")
    output = Path("assets/avatar/talking_transition_test/TALKING_TO_EMPHASIS_TEST.mp4")

    source_stats = stats(read_boundary(source_001, "end", 10))
    target_stats = stats(read_boundary(source_002, "start", 10))
    correction = build_correction(source_stats, target_stats)

    prep = read_clip(source_001, 5.50, 2.50)
    entry = read_clip(source_002, 0.00, 1.50)
    prep = progressive_tail(prep, correction, int(round(0.8 * FPS)))
    frames = crossfade(prep, entry, int(round(0.4 * FPS)))
    write_video(frames, output)
    gains = ",".join(f"{v:.4f}" for v in correction["rgb_gains"])
    print(
        f"wrote {output} ({len(frames)} frames); "
        f"contrast_scale={correction['contrast_scale']:.4f}; "
        f"saturation_scale={correction['saturation_scale']:.4f}; "
        f"rgb_gains={gains}"
    )


if __name__ == "__main__":
    main()
