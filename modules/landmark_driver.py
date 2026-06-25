import os
import time
import subprocess
import urllib.request
import cv2
import numpy as np
import scipy.io.wavfile as wavfile
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# Default constants
DEFAULT_REF_IMAGE = r"C:\Users\admin\AppData\Local\Temp\M11A_NOVA_MuseTalk\inputs\best_reference_frame170.png"
DEFAULT_MODEL_PATH = r"C:\Users\admin\AppData\Local\Temp\L01_NOVA_Landmark\face_landmarker.task"
DEFAULT_FFMPEG_PATH = r"C:\Users\admin\AppData\Local\Temp\M11A_NOVA_MuseTalk\bin\ffmpeg.exe"

# Landmark configurations
LIP_UPPER_OUTER = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291]
LIP_UPPER_INNER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308]
LIP_LOWER_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291]
LIP_LOWER_INNER = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308]
CHIN = [152, 148, 149, 150, 136, 172, 377, 378, 379, 396, 401]
ANCHORS = [1, 2, 94, 97, 98, 326, 327, 168, 6, 197, 195, 5, 4, 50, 280, 117, 346, 205, 425, 57, 287, 164, 328, 99]

ALL_INDICES = list(set(LIP_UPPER_OUTER + LIP_UPPER_INNER + LIP_LOWER_OUTER + LIP_LOWER_INNER + CHIN + ANCHORS))

class LandmarkMouthDriver:
    def __init__(self, ref_image_path=DEFAULT_REF_IMAGE, model_path=DEFAULT_MODEL_PATH, ffmpeg_path=DEFAULT_FFMPEG_PATH):
        self.ref_image_path = ref_image_path
        self.model_path = model_path
        self.ffmpeg_path = ffmpeg_path
        
        # Download model if missing
        if not os.path.exists(self.model_path):
            os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
            url = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
            print(f"[LandmarkDriver] Model missing. Downloading from {url}...")
            urllib.request.urlretrieve(url, self.model_path)
            print("[LandmarkDriver] Model download finished.")

        # Load reference image
        if not os.path.exists(self.ref_image_path):
            raise FileNotFoundError(f"Reference image not found at {self.ref_image_path}")
        
        self.img = cv2.imread(self.ref_image_path)
        self.h, self.w, self.c = self.img.shape
        print(f"[LandmarkDriver] Loaded reference frame: {self.w}x{self.h}")

        # Initialize MediaPipe and extract landmarks
        print("[LandmarkDriver] Initializing MediaPipe FaceMesh...")
        base_options = python.BaseOptions(model_asset_path=self.model_path)
        options = vision.FaceLandmarkerOptions(base_options=base_options, num_faces=1)
        mp_image = mp.Image.create_from_file(self.ref_image_path)
        
        with vision.FaceLandmarker.create_from_options(options) as landmarker:
            result = landmarker.detect(mp_image)
            if not result.face_landmarks:
                raise ValueError("No landmarks detected in reference image!")
            self.landmarks = result.face_landmarks[0]

        # Extract source points
        self.points_src = []
        self.points_src_dict = {}
        for idx in ALL_INDICES:
            pt = self.landmarks[idx]
            coords = (pt.x * self.w, pt.y * self.h)
            self.points_src.append(coords)
            self.points_src_dict[idx] = coords

        # Build triangulation mapping (runs once at init)
        self.triangles = self._build_triangulation()
        print(f"[LandmarkDriver] Initialization complete. Cached {len(self.triangles)} triangles.")

    def _build_triangulation(self):
        rect = (0, 0, self.w, self.h)
        subdiv = cv2.Subdiv2D(rect)
        for p in self.points_src:
            subdiv.insert((float(p[0]), float(p[1])))
        
        triangle_list = subdiv.getTriangleList()
        triangles = []
        
        def find_index(pt, points, tol=1.0):
            for idx, p in enumerate(points):
                if abs(p[0] - pt[0]) < tol and abs(p[1] - pt[1]) < tol:
                    return idx
            return None

        for t in triangle_list:
            pt1 = (t[0], t[1])
            pt2 = (t[2], t[3])
            pt3 = (t[4], t[5])
            
            idx1 = find_index(pt1, self.points_src)
            idx2 = find_index(pt2, self.points_src)
            idx3 = find_index(pt3, self.points_src)
            
            if idx1 is not None and idx2 is not None and idx3 is not None:
                triangles.append((idx1, idx2, idx3))
        return triangles

    def _warp_triangle(self, img_src, img_dst, tri_src, tri_dst):
        r1 = cv2.boundingRect(tri_src)
        r2 = cv2.boundingRect(tri_dst)
        
        tri_src_cropped = []
        tri_dst_cropped = []
        for i in range(3):
            tri_src_cropped.append(((tri_src[i][0] - r1[0]), (tri_src[i][1] - r1[1])))
            tri_dst_cropped.append(((tri_dst[i][0] - r2[0]), (tri_dst[i][1] - r2[1])))
            
        img_src_cropped = img_src[r1[1]:r1[1] + r1[3], r1[0]:r1[0] + r1[2]]
        
        warp_mat = cv2.getAffineTransform(np.float32(tri_src_cropped), np.float32(tri_dst_cropped))
        img_dst_cropped = cv2.warpAffine(img_src_cropped, warp_mat, (r2[2], r2[3]), None, flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT_101)
        
        mask = np.zeros((r2[3], r2[2], 3), dtype=np.float32)
        cv2.fillConvexPoly(mask, np.int32(tri_dst_cropped), (1.0, 1.0, 1.0), 16, 0)
        
        img_dst[r2[1]:r2[1] + r2[3], r2[0]:r2[0] + r2[2]] = img_dst[r2[1]:r2[1] + r2[3], r2[0]:r2[0] + r2[2]] * (1.0 - mask) + img_dst_cropped * mask

    def generate(self, audio_path, output_path, render_mode="teeth_tongue"):
        """Generates lip-synced talking head video on top of reference frame using source audio."""
        start_time = time.time()

        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found at {audio_path}")

        # 1. Read audio and compute frame metrics
        sample_rate, data = wavfile.read(audio_path)
        if len(data.shape) > 1:
            data = data.mean(axis=1) # Convert to mono
        
        data = data.astype(np.float32)
        duration = len(data) / sample_rate
        fps = 25
        num_frames = int(round(duration * fps))
        samples_per_frame = sample_rate / fps

        rms_list = []
        for i in range(num_frames):
            start_idx = int(round(i * samples_per_frame))
            end_idx = int(round((i + 1) * samples_per_frame))
            chunk = data[start_idx:end_idx]
            if len(chunk) == 0:
                rms_list.append(0.0)
            else:
                rms = np.sqrt(np.mean(chunk**2))
                rms_list.append(rms)

        # Normalize RMS coefficients
        max_rms = max(rms_list) if max(rms_list) > 0.0 else 1.0
        noise_floor = 0.02 * max_rms
        
        raw_coeffs = []
        for rms in rms_list:
            if rms < noise_floor:
                raw_coeffs.append(0.0)
            else:
                raw_coeffs.append((rms - noise_floor) / (max_rms - noise_floor))

        # Temporal smoothing
        smoothed_coeffs = []
        for i in range(num_frames):
            window = raw_coeffs[max(0, i-1):min(num_frames, i+2)]
            smoothed_coeffs.append(np.mean(window))

        # 2. Setup video writing
        temp_silent_path = output_path + ".temp_silent.mp4"
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        video_writer = cv2.VideoWriter(temp_silent_path, fourcc, fps, (self.w, self.h))

        max_shift = 8.0
        x_left = self.landmarks[61].x * self.w
        x_right = self.landmarks[291].x * self.w
        x_center = (x_left + x_right) / 2.0
        mouth_width = x_right - x_left

        for frame_idx, coeff in enumerate(smoothed_coeffs):
            points_dst_dict = {}
            points_dst = []
            
            for idx in ALL_INDICES:
                pt = self.landmarks[idx]
                px, py = pt.x * self.w, pt.y * self.h
                
                is_lower_lip = idx in LIP_LOWER_OUTER or idx in LIP_LOWER_INNER
                is_chin = idx in CHIN
                
                if is_lower_lip:
                    d = abs(px - x_center) / (mouth_width / 2.0)
                    d = min(max(d, 0.0), 1.0)
                    factor = np.cos(d * np.pi / 2.0)
                    shift = coeff * max_shift * factor
                    coords = (px, py + shift)
                elif is_chin:
                    d = abs(px - x_center) / (mouth_width / 2.0)
                    d = min(max(d, 0.0), 1.0)
                    factor = np.cos(d * np.pi / 2.0)
                    shift = coeff * max_shift * 0.5 * factor
                    coords = (px, py + shift)
                else:
                    coords = (px, py)
                    
                points_dst_dict[idx] = coords
                points_dst.append(coords)

            frame = self.img.copy()
            
            # Delaunay triangulation warp
            for tri in self.triangles:
                idx1, idx2, idx3 = tri
                moved1 = np.linalg.norm(np.array(self.points_src[idx1]) - np.array(points_dst[idx1])) > 0.01
                moved2 = np.linalg.norm(np.array(self.points_src[idx2]) - np.array(points_dst[idx2])) > 0.01
                moved3 = np.linalg.norm(np.array(self.points_src[idx3]) - np.array(points_dst[idx3])) > 0.01
                
                if moved1 or moved2 or moved3:
                    tri_src = np.array([self.points_src[idx1], self.points_src[idx2], self.points_src[idx3]], dtype=np.float32)
                    tri_dst = np.array([points_dst[idx1], points_dst[idx2], points_dst[idx3]], dtype=np.float32)
                    self._warp_triangle(self.img, frame, tri_src, tri_dst)

            # Draw mouth cavity
            if coeff > 0.01:
                inner_pts = []
                for idx in LIP_UPPER_INNER:
                    inner_pts.append(points_dst_dict[idx])
                for idx in reversed(LIP_LOWER_INNER):
                    inner_pts.append(points_dst_dict[idx])
                inner_poly = np.array(inner_pts, dtype=np.int32)
                
                # 1. Base cavity mask
                mask_cavity = np.zeros((self.h, self.w), dtype=np.float32)
                cv2.fillPoly(mask_cavity, [inner_poly], 1.0)
                mask_cavity_blurred = cv2.GaussianBlur(mask_cavity, (3, 3), 0)
                
                # 2. Prepare canvas for cavity colors (teeth, tongue drawn on it)
                cavity_canvas = np.zeros_like(frame)
                brightness = int(max(10, 20 * coeff))
                cavity_canvas[:] = [brightness, int(brightness * 0.75), int(brightness * 1.75)] # base dark reddish black
                
                # --- Lab-02B: Draw Teeth ---
                if render_mode in ["teeth", "teeth_tongue"] and coeff > 0.15:
                    # Upper teeth shape follows the curve of the upper inner lip
                    # We shift it down by dy pixels
                    dy = int(1.0 + 2.0 * coeff)
                    teeth_top = [points_dst_dict[idx] for idx in LIP_UPPER_INNER]
                    teeth_bottom = [(pt[0], pt[1] + dy) for pt in reversed(teeth_top)]
                    teeth_pts = teeth_top + teeth_bottom
                    teeth_poly = np.array(teeth_pts, dtype=np.int32)
                    
                    # Draw white teeth on canvas (BGR: 220, 225, 230)
                    cv2.fillPoly(cavity_canvas, [teeth_poly], (220, 225, 230))
                    
                # --- Lab-02C: Draw Tongue ---
                if render_mode == "teeth_tongue" and coeff > 0.3:
                    # Tongue shape follows the lower inner lip, shifted up
                    dy_tongue = int(3.0 * coeff)
                    tongue_bottom = [points_dst_dict[idx] for idx in LIP_LOWER_INNER]
                    tongue_top = [(pt[0], pt[1] - dy_tongue) for pt in reversed(tongue_bottom)]
                    tongue_pts = tongue_bottom + tongue_top
                    tongue_poly = np.array(tongue_pts, dtype=np.int32)
                    
                    # Draw soft pink/red tongue on canvas (BGR: 60, 50, 160)
                    cv2.fillPoly(cavity_canvas, [tongue_poly], (65, 55, 175))
                    
                # Apply Gaussian Blur to the entire cavity canvas internally to make transitions soft
                cavity_canvas_blurred = cv2.GaussianBlur(cavity_canvas, (3, 3), 0)
                
                # Blend back using the cavity mask
                mask_3d = np.repeat(mask_cavity_blurred[:, :, np.newaxis], 3, axis=2)
                frame = (frame * (1.0 - mask_3d) + cavity_canvas_blurred * mask_3d).astype(np.uint8)

            video_writer.write(frame)

        video_writer.release()

        # 3. Merge audio & video via FFmpeg
        ffmpeg_cmd = [
            self.ffmpeg_path,
            "-y",
            "-i", temp_silent_path,
            "-i", audio_path,
            "-c:v", "copy",
            "-c:a", "aac",
            "-map", "0:v:0",
            "-map", "1:a:0",
            output_path
        ]
        
        result = subprocess.run(ffmpeg_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        
        if os.path.exists(temp_silent_path):
            os.remove(temp_silent_path)
            
        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg failed: {result.stderr.decode('utf-8', errors='ignore')}")

        gen_duration = time.time() - start_time
        print(f"[LandmarkDriver] Video generated in {gen_duration:.2f}s ({num_frames} frames, {num_frames / gen_duration:.1f} fps)")
        return gen_duration
