import json
import os
import shutil
import subprocess
from itertools import product
from pathlib import Path

import cv2
import imageio_ffmpeg
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "avatar" / "AIPEOPLE"
OUT = ROOT / "assets" / "avatar" / "flow_v3_longlens_candidates"
FPS = 24
SIZE = (1280, 720)


def read_video(path):
    cap = cv2.VideoCapture(str(path))
    fps = cap.get(cv2.CAP_PROP_FPS) or FPS
    frames = []
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if (frame.shape[1], frame.shape[0]) != SIZE:
            frame = cv2.resize(frame, SIZE, interpolation=cv2.INTER_AREA)
        frames.append(frame)
    cap.release()
    return frames, fps


def roi(frame, x1, y1, x2, y2):
    h, w = frame.shape[:2]
    return frame[int(h * y1) : int(h * y2), int(w * x1) : int(w * x2)]


def mouth_open(frame):
    patch = roi(frame, 0.40, 0.40, 0.60, 0.64)
    gray = cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY)
    dark = gray < np.percentile(gray, 18)
    return float(dark[int(dark.shape[0] * 0.40) :, :].mean() * 100)


def eye_center(frame):
    patch = roi(frame, 0.35, 0.20, 0.65, 0.40)
    gray = cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY)
    mask = gray <= np.percentile(gray, 32)
    ys, xs = np.where(mask)
    if len(xs) < 10:
        return 0.5, 0.5
    return float(xs.mean() / gray.shape[1]), float(ys.mean() / gray.shape[0])


def bg_delta(a, b):
    regions = [(0, 0, 0.25, 1), (0.75, 0, 1, 1), (0.25, 0, 0.75, 0.15)]
    return float(np.mean([cv2.absdiff(roi(a, *r), roi(b, *r)).mean() for r in regions]))


def luminance(frame):
    return cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)


def face_sharpness(frame):
    gray = cv2.cvtColor(roi(frame, 0.30, 0.12, 0.70, 0.72), cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def dark_frame(frames):
    return bool(min(float(luminance(frame).mean()) for frame in frames) < 6.0)


def boundary_metrics(left, right, n=10):
    tail = left[-n:]
    head = right[:n]
    h, w = tail[0].shape[:2]
    mouth = (slice(int(h * 0.42), int(h * 0.68)), slice(int(w * 0.38), int(w * 0.62)))
    frame_diff = float(np.mean([cv2.absdiff(a, b).mean() for a, b in zip(tail, head)]))
    brightness_tail = float(np.mean([luminance(frame).mean() for frame in tail]))
    brightness_head = float(np.mean([luminance(frame).mean() for frame in head]))
    mouth_mismatch = float(np.mean([cv2.absdiff(a[mouth], b[mouth]).mean() for a, b in zip(tail, head)]))
    bg = float(np.mean([bg_delta(a, b) for a, b in zip(tail, head)]))
    return {
        "frame_diff": frame_diff,
        "brightness_jump": abs(brightness_tail - brightness_head),
        "dark_frame": dark_frame(tail + head),
        "mouth_mismatch": mouth_mismatch,
        "background_delta": bg,
    }


def sequence_metrics(segments):
    boundaries = []
    for i in range(len(segments) - 1):
        boundaries.append(boundary_metrics(segments[i]["frames"], segments[i + 1]["frames"]))
    all_frames = [frame for seg in segments for frame in seg["frames"]]
    sharp = [face_sharpness(frame) for frame in all_frames[:: max(1, len(all_frames) // 180)]]
    ref = np.percentile(sharp, 90)
    ghost = float(np.mean([max(0.0, ref - value) for value in sharp]))
    eyes = np.array([eye_center(frame) for frame in all_frames[:: max(1, len(all_frames) // 180)]])
    eye_stability = float(max(0, min(100, 100 - (eyes[:, 0].std() + eyes[:, 1].std()) * 3000)))
    bg_stability = float(max(0, min(100, 100 - np.mean([m["background_delta"] for m in boundaries]) * 10)))
    return {
        "boundaries": boundaries,
        "max_frame_diff": max(m["frame_diff"] for m in boundaries),
        "max_brightness_jump": max(m["brightness_jump"] for m in boundaries),
        "dark_frame": any(m["dark_frame"] for m in boundaries),
        "ghost_exposure": ghost,
        "mouth_mismatch": max(m["mouth_mismatch"] for m in boundaries),
        "background_stability": bg_stability,
        "eye_stability": eye_stability,
    }


def segment(video_frames, fps, start, end):
    s = int(round(start * fps))
    e = int(round(end * fps))
    return video_frames[max(0, s) : min(len(video_frames), e)]


def make_segment(name, frames):
    return {"name": name, "frames": frames}


def write_mp4(path, segments):
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    proc = subprocess.Popen(
        [
            ffmpeg,
            "-y",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "bgr24",
            "-s",
            f"{SIZE[0]}x{SIZE[1]}",
            "-r",
            str(FPS),
            "-i",
            "-",
            "-c:v",
            "libx264",
            "-profile:v",
            "high",
            "-pix_fmt",
            "yuv420p",
            "-r",
            str(FPS),
            "-an",
            str(path),
        ],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    for seg in segments:
        for frame in seg["frames"]:
            proc.stdin.write(frame.tobytes())
    proc.stdin.close()
    _, stderr = proc.communicate()
    if proc.returncode:
        raise RuntimeError(stderr.decode("utf-8", errors="ignore")[-2000:])
    subprocess.run([ffmpeg, "-hide_banner", "-v", "error", "-i", str(path), "-f", "null", "-"], check=True)


def make_sheet(path, candidates):
    rows = []
    for label, segments in candidates:
        frames = [frame for seg in segments for frame in seg["frames"]]
        idxs = np.linspace(0, len(frames) - 1, 10).round().astype(int)
        thumbs = []
        for idx in idxs:
            img = cv2.resize(frames[idx], (180, 101))
            cv2.putText(img, label, (5, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1, cv2.LINE_AA)
            cv2.putText(img, str(idx), (5, 95), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1, cv2.LINE_AA)
            thumbs.append(img)
        rows.append(np.hstack(thumbs))
    cv2.imwrite(str(path), np.vstack(rows))


def load_all():
    data = {}
    for path in sorted(SRC.glob("*.mp4")):
        data[path.name], fps = read_video(path)
    return data


def auto_candidate(data):
    names = sorted(data)
    endpoint = {}
    clip_quality = {}
    for name in names:
        frames = data[name]
        sampled = frames[:: max(1, len(frames) // 100)]
        eyes = np.array([eye_center(frame) for frame in sampled])
        eye_stability = float(max(0, min(100, 100 - (eyes[:, 0].std() + eyes[:, 1].std()) * 3000)))
        bg_self = float(np.mean([bg_delta(sampled[i], sampled[i + 1]) for i in range(len(sampled) - 1)])) if len(sampled) > 1 else 0.0
        endpoint[name] = {
            "head": frames[:10],
            "tail": frames[-10:],
            "dark": dark_frame(frames[:10] + frames[-10:]),
        }
        clip_quality[name] = {
            "eye_stability": eye_stability,
            "bg_self": bg_self,
        }

    def compute_fast_boundary(left_name, right_name):
        left = endpoint[left_name]["tail"]
        right = endpoint[right_name]["head"]
        h, w = left[0].shape[:2]
        mouth = (slice(int(h * 0.42), int(h * 0.68)), slice(int(w * 0.38), int(w * 0.62)))
        frame_diff = float(np.mean([cv2.absdiff(a, b).mean() for a, b in zip(left, right)]))
        brightness_jump = abs(
            float(np.mean([luminance(frame).mean() for frame in left]))
            - float(np.mean([luminance(frame).mean() for frame in right]))
        )
        mouth_mismatch = float(np.mean([cv2.absdiff(a[mouth], b[mouth]).mean() for a, b in zip(left, right)]))
        dark = endpoint[left_name]["dark"] or endpoint[right_name]["dark"]
        bg = float(np.mean([bg_delta(a, b) for a, b in zip(left, right)]))
        return frame_diff * 1.6 + brightness_jump * 1.3 + mouth_mismatch * 0.35 + bg * 0.4 + (60 if dark else 0)

    boundary_score = {
        (left, right): compute_fast_boundary(left, right)
        for left in names
        for right in names
    }

    best = None
    for waiting, response, finish in product(names, repeat=3):
        if response == waiting or finish == response:
            continue
        score = boundary_score[(waiting, response)] + boundary_score[(response, finish)] + boundary_score[(finish, waiting)]
        score += clip_quality[response]["bg_self"] * 6
        score -= clip_quality[response]["eye_stability"] * 0.04
        # Prefer stable long-lens response candidates over extreme motion outliers.
        if response in {"011.mp4", "015.mp4"}:
            score += 10
        if best is None or score < best["score"]:
            best = {
                "score": float(score),
                "waiting": waiting,
                "response": response,
                "finish": finish,
            }
    best["segments"] = [
        make_segment(best["waiting"], data[best["waiting"]]),
        make_segment(best["response"], data[best["response"]]),
        make_segment(best["finish"], data[best["finish"]]),
        make_segment(best["waiting"], data[best["waiting"]]),
    ]
    best["metrics"] = sequence_metrics(best["segments"])
    return best


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    data = load_all()
    f019 = data["019.mp4"]
    fps019 = FPS
    candidate_a = [
        make_segment("WAITING=009", data["009.mp4"]),
        make_segment("FLOW_RESPONSE=019", data["019.mp4"]),
        make_segment("FINISH=013", data["013.mp4"]),
        make_segment("WAITING=009", data["009.mp4"]),
    ]
    candidate_b = [
        make_segment("WAITING=009", data["009.mp4"]),
        make_segment("019_front_0_2", segment(f019, fps019, 0, 2)),
        make_segment("019_main_2_10", segment(f019, fps019, 2, 10)),
        make_segment("FINISH=013", data["013.mp4"]),
        make_segment("WAITING=009", data["009.mp4"]),
    ]
    c = auto_candidate(data)
    candidate_c = c["segments"]
    candidates = [
        ("candidate_A_minimal", candidate_a),
        ("candidate_B_019_split", candidate_b),
        ("candidate_C_auto", candidate_c),
    ]
    built = []
    for label, segments in candidates:
        mp4 = OUT / f"{label}.mp4"
        write_mp4(mp4, segments)
        metrics = sequence_metrics(segments)
        built.append(
            {
                "label": label,
                "file": str(mp4.relative_to(ROOT)),
                "flow": [seg["name"] for seg in segments],
                "junction_count": len(segments) - 1,
                "metrics": metrics,
            }
        )
    sheet = OUT / "flow_v3_longlens_candidates_sheet.jpg"
    make_sheet(sheet, candidates)
    report = {"built": built, "auto_search": {"score": c["score"], "waiting": c["waiting"], "response": c["response"], "finish": c["finish"]}, "sheet": str(sheet.relative_to(ROOT))}
    (OUT / "flow_v3_longlens_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
