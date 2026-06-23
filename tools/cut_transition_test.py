import argparse
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

    source_fps = cap.get(cv2.CAP_PROP_FPS) or FPS
    start = int(round(start_sec * source_fps))
    count = int(round(duration_sec * FPS))
    frames = []

    for out_idx in range(count):
        src_idx = start + int(round(out_idx * source_fps / FPS))
        cap.set(cv2.CAP_PROP_POS_FRAMES, src_idx)
        ok, frame = cap.read()
        if not ok:
            break
        frames.append(cv2.resize(frame, (WIDTH, HEIGHT), interpolation=cv2.INTER_AREA))

    cap.release()
    if not frames:
        raise RuntimeError(f"No frames read from {path}")
    return frames


def zoom_frame(frame, scale):
    h, w = frame.shape[:2]
    crop_w = max(2, int(w / scale))
    crop_h = max(2, int(h / scale))
    x1 = (w - crop_w) // 2
    y1 = (h - crop_h) // 2
    crop = frame[y1:y1 + crop_h, x1:x1 + crop_w]
    return cv2.resize(crop, (w, h), interpolation=cv2.INTER_LINEAR)


def motion_blur(frame, ksize=31):
    ksize = max(3, int(ksize) | 1)
    kernel = np.zeros((ksize, ksize), dtype=np.float32)
    kernel[ksize // 2, :] = 1.0 / ksize
    return cv2.filter2D(frame, -1, kernel)


def adjust_brightness(frame, delta):
    return np.clip(frame.astype(np.float32) + delta, 0, 255).astype(np.uint8)


def make_transition(prep, entry, style):
    if style == "soft_cut":
        # Tiny two-frame dissolve: enough to hide luminance discontinuity without feeling like an effect.
        return prep[:-1] + [
            cv2.addWeighted(prep[-1], 0.66, entry[0], 0.34, 0),
            cv2.addWeighted(prep[-1], 0.28, entry[0], 0.72, 0),
        ] + entry[1:]

    if style == "punch_zoom":
        tail = prep[:-4]
        trans = []
        scales = [1.035, 1.075, 1.115, 1.075]
        source = [prep[-4], prep[-3], entry[0], entry[1]]
        for frame, scale in zip(source, scales):
            trans.append(zoom_frame(frame, scale))
        return tail + trans + entry[2:]

    if style == "whip_blur":
        tail = prep[:-5]
        trans = [
            motion_blur(zoom_frame(prep[-5], 1.02), 21),
            motion_blur(zoom_frame(prep[-4], 1.06), 35),
            adjust_brightness(motion_blur(zoom_frame(prep[-3], 1.10), 45), 10),
            adjust_brightness(motion_blur(zoom_frame(entry[0], 1.08), 45), 8),
            motion_blur(zoom_frame(entry[1], 1.03), 25),
        ]
        return tail + trans + entry[2:]

    raise ValueError(f"Unknown style: {style}")


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
    parser = argparse.ArgumentParser(description="Build cut-style transition tests for 010 -> 007.")
    parser.add_argument("--style", required=True, choices=["whip_blur", "punch_zoom", "soft_cut"])
    parser.add_argument("--source-010", type=Path, default=Path("assets/avatar/AIPEOPLE/010.mp4"))
    parser.add_argument("--source-007", type=Path, default=Path("assets/avatar/AIPEOPLE/007.mp4"))
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    prep = read_clip(args.source_010, 7.50, 2.50)
    entry = read_clip(args.source_007, 0.00, 1.50)
    frames = make_transition(prep, entry, args.style)
    write_video(frames, args.output)
    print(f"wrote {args.output} ({len(frames)} frames, style={args.style})")


if __name__ == "__main__":
    main()
