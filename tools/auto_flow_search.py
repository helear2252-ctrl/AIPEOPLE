import itertools
import json
import math
import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

import cv2
import imageio_ffmpeg
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / "assets" / "avatar" / "AIPEOPLE"
OUT_DIR = ROOT / "assets" / "avatar" / "auto_flow_test"
FPS_OUT = 24
W, H = 1280, 720
FADE_FRAMES = 5


@dataclass
class Segment:
    video: str
    label: str
    start: float
    end: float
    frames: list
    fps: float
    features: dict
    role_scores: dict

    @property
    def key(self):
        return f"{self.video}:{self.label}"


def read_video(path):
    cap = cv2.VideoCapture(str(path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    frames = []
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if frame.shape[1] != W or frame.shape[0] != H:
            frame = cv2.resize(frame, (W, H), interpolation=cv2.INTER_AREA)
        frames.append(frame)
    cap.release()
    return frames, fps


def roi(frame, x1, y1, x2, y2):
    h, w = frame.shape[:2]
    return frame[int(h * y1) : int(h * y2), int(w * x1) : int(w * x2)]


def stats(frames):
    arr = np.stack(frames).astype(np.float32)
    hsv = np.stack([cv2.cvtColor(f, cv2.COLOR_BGR2HSV).astype(np.float32) for f in frames])
    gray = np.stack([cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).astype(np.float32) for f in frames])
    return {
        "brightness": float(gray.mean()),
        "contrast": float(gray.std()),
        "saturation": float(hsv[:, :, :, 1].mean()),
        "warmth": float(arr[:, :, :, 2].mean() - arr[:, :, :, 0].mean()),
    }


def centroid_dark(frame, region, threshold_percentile=35):
    patch = roi(frame, *region)
    gray = cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY)
    t = np.percentile(gray, threshold_percentile)
    mask = gray <= t
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return 0.5, 0.5, 0.0
    return float(xs.mean() / max(1, gray.shape[1])), float(ys.mean() / max(1, gray.shape[0])), float(mask.mean())


def mouth_open(frame):
    patch = roi(frame, 0.41, 0.43, 0.59, 0.63)
    gray = cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY)
    dark = gray < np.percentile(gray, 18)
    lower = dark[int(dark.shape[0] * 0.38) :, :]
    return float(lower.mean() * 100.0)


def face_center(frame):
    patch = roi(frame, 0.25, 0.08, 0.75, 0.78)
    hsv = cv2.cvtColor(patch, cv2.COLOR_BGR2HSV)
    # Broad skin/lit-face proxy. This is intentionally conservative for fixed NOVA framing.
    mask = ((hsv[:, :, 0] < 28) | (hsv[:, :, 0] > 168)) & (hsv[:, :, 1] > 20) & (hsv[:, :, 2] > 50)
    ys, xs = np.where(mask)
    if len(xs) < 100:
        return 0.5, 0.5
    return float(xs.mean() / patch.shape[1]), float(ys.mean() / patch.shape[0])


def compute_features(frames):
    if len(frames) < 2:
        raise ValueError("segment too short")
    first = frames[: min(10, len(frames))]
    last = frames[-min(10, len(frames)) :]
    all_stats = stats(frames)
    first_stats = stats(first)
    last_stats = stats(last)
    diffs = [float(np.mean(cv2.absdiff(frames[i], frames[i + 1]))) for i in range(len(frames) - 1)]
    mouth = [mouth_open(f) for f in frames]
    eye_centers = [centroid_dark(f, (0.36, 0.22, 0.64, 0.39))[:2] for f in frames]
    faces = [face_center(f) for f in frames[:: max(1, len(frames) // 24)]]
    face_x = [p[0] for p in faces]
    face_y = [p[1] for p in faces]
    expr_delta = abs(np.mean([mouth_open(f) for f in last]) - np.mean([mouth_open(f) for f in first]))
    return {
        "first": first_stats,
        "last": last_stats,
        "avg": all_stats,
        "frame_diff_mean": float(np.mean(diffs)),
        "frame_diff_max": float(np.max(diffs)),
        "mouth_mean": float(np.mean(mouth)),
        "mouth_start": float(np.mean([mouth_open(f) for f in first])),
        "mouth_end": float(np.mean([mouth_open(f) for f in last])),
        "mouth_motion": float(np.std(mouth)),
        "mouth_delta": float(expr_delta),
        "eye_motion": float(np.std([p[0] for p in eye_centers]) + np.std([p[1] for p in eye_centers])),
        "eye_x": float(np.mean([p[0] for p in eye_centers])),
        "head_motion": float(np.std(face_x) + np.std(face_y)),
        "head_x": float(np.mean(face_x)),
        "head_y": float(np.mean(face_y)),
        "frames": len(frames),
    }


def role_scores(f):
    motion = f["mouth_motion"]
    fd = f["frame_diff_mean"]
    mouth = f["mouth_mean"]
    expr = f["mouth_delta"] + f["eye_motion"] * 80 + f["frame_diff_max"] * 0.6
    opening = max(0, f["mouth_end"] - f["mouth_start"])
    closing = max(0, f["mouth_start"] - f["mouth_end"])
    stillness = motion * 35 + fd * 30 + f["head_motion"] * 220 + f["eye_motion"] * 260
    end_stable = motion * 16 + fd * 14 + max(0, f["mouth_end"] - f["mouth_start"] + 0.3) * 9
    return {
        "PREP": max(0, 100 - stillness - opening * 5),
        "TALKING_START": max(0, 50 + opening * 18 + f["mouth_end"] * 5 + motion * 6 + fd * 8),
        "TALKING_MAIN": max(0, 40 + mouth * 7 + motion * 18 + fd * 4),
        "TALKING_EMPHASIS": max(0, 35 + mouth * 7 + motion * 22 + expr * 10),
        "FINISH": max(0, 100 - end_stable + closing * 10),
    }


def transition_cost(a, b):
    la, fb = a.features["last"], b.features["first"]
    brightness = abs(la["brightness"] - fb["brightness"])
    contrast = abs(la["contrast"] - fb["contrast"])
    sat = abs(la["saturation"] - fb["saturation"])
    warmth = abs(la["warmth"] - fb["warmth"])
    mouth = abs(a.features["mouth_end"] - b.features["mouth_start"])
    head = abs(a.features["head_x"] - b.features["head_x"]) * 50 + abs(a.features["head_y"] - b.features["head_y"]) * 50
    eye = abs(a.features["eye_x"] - b.features["eye_x"]) * 20
    # Calibrated for ranking, not an absolute visual score.
    return float(
        brightness * 0.38
        + contrast * 0.18
        + sat * 0.06
        + warmth * 0.04
        + mouth * 1.25
        + head * 1.0
        + eye * 0.65
    )


def segment_frames(frames, fps, start, end):
    s = max(0, int(round(start * fps)))
    e = min(len(frames), int(round(end * fps)))
    if e <= s:
        return []
    return frames[s:e]


def build_segments():
    segments = []
    for i in range(1, 11):
        name = f"{i:03d}.mp4"
        frames, fps = read_video(SRC_DIR / name)
        duration = len(frames) / fps
        windows = [("front_0_2", 0, 2), ("mid_2_5", 2, 5), ("tail_5_8", 5, 8)]
        if name == "010.mp4":
            windows += [("special_2_6p25", 2, 6.25), ("special_6p25_10", 6.25, 10), ("special_7p5_10", 7.5, 10)]
        for label, start, end in windows:
            if start >= duration:
                continue
            fs = segment_frames(frames, fps, start, min(end, duration))
            if len(fs) < 12:
                continue
            feat = compute_features(fs)
            scores = role_scores(feat)
            segments.append(Segment(name, label, start, min(end, duration), fs, fps, feat, scores))
    return segments


def role_penalty(seg, role):
    score = seg.role_scores[role]
    penalty = max(0, 70 - score) * 0.9
    if role == "PREP" and seg.features["mouth_motion"] > 1.05:
        penalty += (seg.features["mouth_motion"] - 1.05) * 35
    if role == "PREP" and seg.features["frame_diff_mean"] > 0.8:
        penalty += (seg.features["frame_diff_mean"] - 0.8) * 30
    if role == "TALKING_START" and seg.features["mouth_end"] < seg.features["mouth_start"]:
        penalty += 12
    if role == "TALKING_MAIN" and seg.features["mouth_motion"] < 0.35:
        penalty += 18
    if role == "TALKING_EMPHASIS" and seg.features["mouth_motion"] < 0.45:
        penalty += 14
    if role == "FINISH" and seg.features["mouth_end"] > seg.features["mouth_start"] + 0.6:
        penalty += 26
    if role == "FINISH" and seg.features["frame_diff_mean"] > 0.8:
        penalty += (seg.features["frame_diff_mean"] - 0.8) * 18
    return float(penalty)


def search_paths(segments):
    roles = ["PREP", "TALKING_START", "TALKING_MAIN", "TALKING_EMPHASIS", "FINISH"]
    pools = {r: sorted(segments, key=lambda s: role_penalty(s, r))[:14] for r in roles}
    paths = []
    for combo in itertools.product(*(pools[r] for r in roles)):
        keys = [s.key for s in combo]
        repeated_video = len({s.video for s in combo}) < len(combo)
        # Allow repeated source only when segment window differs, but penalize loops.
        transition = sum(transition_cost(combo[i], combo[i + 1]) for i in range(4))
        role_cost = sum(role_penalty(combo[i], roles[i]) for i in range(5))
        repeat_penalty = (len(combo) - len(set(keys))) * 35 + (len(combo) - len({s.video for s in combo})) * 4
        emphasis_delta = combo[3].role_scores["TALKING_EMPHASIS"] - combo[2].role_scores["TALKING_EMPHASIS"]
        if emphasis_delta < 0:
            role_cost += abs(emphasis_delta) * 0.35
        total = transition + role_cost + repeat_penalty
        paths.append(
            {
                "segments": combo,
                "transition": transition,
                "role_cost": role_cost,
                "total": float(total),
                "repeated_video": repeated_video,
            }
        )
    paths.sort(key=lambda p: p["total"])
    return paths


def adjust_luma_sat(frame, ref_stats, src_stats, strength):
    out = frame.astype(np.float32)
    gray_scale = ref_stats["brightness"] / max(1.0, src_stats["brightness"])
    gray_scale = np.clip(gray_scale, 0.88, 1.12)
    out *= 1 + (gray_scale - 1) * strength
    hsv = cv2.cvtColor(np.clip(out, 0, 255).astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
    sat_scale = ref_stats["saturation"] / max(1.0, src_stats["saturation"])
    sat_scale = np.clip(sat_scale, 0.88, 1.12)
    hsv[:, :, 1] *= 1 + (sat_scale - 1) * strength
    return cv2.cvtColor(np.clip(hsv, 0, 255).astype(np.uint8), cv2.COLOR_HSV2BGR)


def stitch_path(path, out_mp4):
    seq = []
    segs = path["segments"]
    current = [f.copy() for f in segs[0].frames]
    seq.extend(current)
    for nxt in segs[1:]:
        next_frames = [f.copy() for f in nxt.frames]
        overlap = min(FADE_FRAMES, len(seq), len(next_frames))
        ref = stats(seq[-10:])
        src = stats(next_frames[:10])
        for j in range(min(12, len(next_frames))):
            strength = 1.0 - min(1.0, j / 12)
            next_frames[j] = adjust_luma_sat(next_frames[j], ref, src, strength)
        base = seq[:-overlap]
        blended = []
        for j in range(overlap):
            alpha = (j + 1) / (overlap + 1)
            a = seq[-overlap + j]
            b = next_frames[j]
            blended.append(cv2.addWeighted(a, 1 - alpha, b, alpha, 0))
        seq = base + blended + next_frames[overlap:]
    frame_dir = OUT_DIR / (out_mp4.stem + "_frames")
    if frame_dir.exists():
        shutil.rmtree(frame_dir)
    frame_dir.mkdir(parents=True, exist_ok=True)
    for i, frame in enumerate(seq):
        cv2.imwrite(str(frame_dir / f"{i:08d}.png"), frame)
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [
        ffmpeg,
        "-y",
        "-framerate",
        str(FPS_OUT),
        "-i",
        str(frame_dir / "%08d.png"),
        "-c:v",
        "libx264",
        "-profile:v",
        "high",
        "-pix_fmt",
        "yuv420p",
        "-r",
        str(FPS_OUT),
        "-an",
        str(out_mp4),
    ]
    subprocess.run(cmd, check=True, capture_output=True, text=True)
    subprocess.run([ffmpeg, "-hide_banner", "-v", "error", "-i", str(out_mp4), "-f", "null", "-"], check=True)
    shutil.rmtree(frame_dir)
    return seq


def sequence_metrics(frames):
    diffs = [float(np.mean(cv2.absdiff(frames[i], frames[i + 1]))) for i in range(len(frames) - 1)]
    gray = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY) for f in frames]
    brightness = [float(np.mean(g)) for g in gray]
    jumps = [abs(brightness[i + 1] - brightness[i]) for i in range(len(brightness) - 1)]
    h, w = frames[0].shape[:2]
    mouth = (slice(int(h * 0.42), int(h * 0.68)), slice(int(w * 0.38), int(w * 0.62)))
    mouthdiff = [float(np.mean(cv2.absdiff(frames[i][mouth], frames[i + 1][mouth]))) for i in range(len(frames) - 1)]
    face = (slice(int(h * 0.14), int(h * 0.74)), slice(int(w * 0.30), int(w * 0.70)))
    sharp = [
        float(cv2.Laplacian(cv2.cvtColor(f[face], cv2.COLOR_BGR2GRAY), cv2.CV_64F).var())
        for f in frames
    ]
    ref = np.percentile(sharp, 90)
    ghost = float(sum(max(0, ref - s) for s in sharp) / len(sharp))
    return {
        "decode": "PASS",
        "frames": len(frames),
        "duration": len(frames) / FPS_OUT,
        "max_frame_diff": max(diffs),
        "mean_frame_diff": float(np.mean(diffs)),
        "brightness_jump": max(jumps),
        "ghost_exposure": ghost,
        "mouth_mismatch": max(mouthdiff),
    }


def write_sheet(candidates):
    rows = []
    for label, frames in candidates:
        idxs = np.linspace(0, len(frames) - 1, 10).round().astype(int)
        thumbs = []
        for idx in idxs:
            im = cv2.resize(frames[idx], (180, 101))
            cv2.putText(im, label, (5, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1, cv2.LINE_AA)
            cv2.putText(im, str(idx), (5, 95), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1, cv2.LINE_AA)
            thumbs.append(im)
        rows.append(np.hstack(thumbs))
    sheet = OUT_DIR / "auto_flow_candidate_preview_sheet.jpg"
    cv2.imwrite(str(sheet), np.vstack(rows))
    return str(sheet)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    segments = build_segments()
    paths = search_paths(segments)
    top10 = []
    for rank, p in enumerate(paths[:10], 1):
        segs = p["segments"]
        top10.append(
            {
                "rank": rank,
                "PREP": segs[0].key,
                "START": segs[1].key,
                "MAIN": segs[2].key,
                "EMPHASIS": segs[3].key,
                "FINISH": segs[4].key,
                "total": round(p["total"], 2),
                "transition": round(p["transition"], 2),
                "role_cost": round(p["role_cost"], 2),
                "notes": (
                    f"prepMouth={segs[0].features['mouth_mean']:.1f}; "
                    f"mainMotion={segs[2].features['mouth_motion']:.2f}; "
                    f"emphasisMotion={segs[3].features['mouth_motion']:.2f}; "
                    f"finishEndMouth={segs[4].features['mouth_end']:.1f}"
                ),
            }
        )
    built = []
    sheet_items = []
    for i, p in enumerate(paths[:3], 1):
        out = OUT_DIR / f"auto_flow_candidate_{i:02d}.mp4"
        frames = stitch_path(p, out)
        m = sequence_metrics(frames)
        built.append(
            {
                "file": str(out.relative_to(ROOT)),
                "path": [s.key for s in p["segments"]],
                "score": round(p["total"], 2),
                "metrics": m,
            }
        )
        sheet_items.append((f"candidate_{i:02d}", frames))
    sheet = write_sheet(sheet_items)
    report = {
        "segment_count": len(segments),
        "top10": top10,
        "built": built,
        "preview_sheet": sheet,
    }
    report_path = OUT_DIR / "auto_flow_search_report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
