import shutil
import subprocess
from pathlib import Path

import cv2
import imageio_ffmpeg
import numpy as np


FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
OUT_DIR = Path("assets/avatar/final_hd_ultra_smooth")
WIDTH = 1280
HEIGHT = 720
FPS = 24


def run_ffmpeg(args):
    proc = subprocess.run([FFMPEG, "-y", *args], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr)


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


def crossfade(prep_frames, entry_frames, fade_frames):
    keep = prep_frames[:-fade_frames]
    faded = []
    for i in range(fade_frames):
        alpha = (i + 1) / (fade_frames + 1)
        faded.append(cv2.addWeighted(prep_frames[-fade_frames + i], 1.0 - alpha, entry_frames[i], alpha, 0))
    return keep + faded + entry_frames[fade_frames:]


def write_video(frames, output: Path):
    cmd = [
        FFMPEG,
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


def build_prep_boundary_blend():
    output = OUT_DIR / "TALKING_PREP_HD_BOUNDARY_BLEND.mp4"
    source_010 = Path("assets/avatar/color_matched_test/010_boundary_to_007_start10.mp4")
    source_007 = Path("assets/avatar/AIPEOPLE/007.mp4")
    if output.exists():
        raise FileExistsError(f"Refusing to overwrite {output}")
    prep = read_clip(source_010, 7.50, 2.50)
    entry = read_clip(source_007, 0.00, 1.50)
    frames = crossfade(prep, entry, int(round(0.4 * FPS)))
    write_video(frames, output)
    return output


def copy_emphasis_entry():
    output = OUT_DIR / "TALKING_EMPHASIS_ENTRY_HD.mp4"
    source = Path("assets/avatar/talking_transition_test/TALKING_TO_EMPHASIS_TEST.mp4")
    if output.exists():
        raise FileExistsError(f"Refusing to overwrite {output}")
    shutil.copy2(source, output)
    return output


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    prep = build_prep_boundary_blend()
    emphasis = copy_emphasis_entry()
    print(f"created {prep}")
    print(f"created {emphasis}")


if __name__ == "__main__":
    main()
