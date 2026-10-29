"""Decode every source frame and produce a reproducible visual/measurement index.

Requires Python + opencv-python + numpy + Pillow (analysis only, not the app).
Run: python scripts/analyze_video.py
"""

from pathlib import Path
import csv
import json

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
VIDEO = next((ROOT / "source").glob("*.mp4"))
OUT = ROOT / "analysis"
OUT.mkdir(exist_ok=True)
(OUT / "keyframes").mkdir(exist_ok=True)
(OUT / "contact-sheets").mkdir(exist_ok=True)

cap = cv2.VideoCapture(str(VIDEO))
fps = cap.get(cv2.CAP_PROP_FPS)
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
font = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 13)
rows, thumbnails, overview = [], [], []
previous = None
index = 0
key_indices = {0, 30, 60, 75, 90, 105, 120, 150, 180, 210, 240, 270, 300, 330, 360, 390, 420, 450, 465, 480, 495, 510, 525, 540, 556}


def visual_phase(frame_index):
    """Human annotations from the complete contact sheets, not recovered app state.

    Letter/phase boundaries are approximate where the pencil occludes new ink.
    Keep measurements separate from this interpretation in the CSV columns.
    """
    if frame_index < 38:
        return "idle", "", "Blank paper, stationary pencil and input caret."
    if frame_index < 73:
        return "ready", "", "Name is present; dark confirmation control is visible."
    if frame_index < 89:
        return "approaching", "", "Submission/loading transition; pencil moves to the first stroke."
    letters = [(118, "S"), (146, "Sh"), (169, "Sha"), (200, "Shak"), (222, "Shake"),
               (244, "Shakes"), (269, "Shakesp"), (290, "Shakespe"), (312, "Shakespea"),
               (332, "Shakespear"), (345, "Shakespeare")]
    for boundary, prefix in letters:
        if frame_index < boundary:
            return "writing", prefix, "Current last letter is being drawn; pencil/shadow follow its strokes."
    if frame_index < 456:
        return "written", "Shakespeare", "Complete signature holds; control settles to the eraser."
    if frame_index < 459:
        return "erase_trigger", "Shakespeare", "Eraser is clicked; transition to clearing."
    if frame_index < 485:
        return "erasing", "Shakespeare", "Ink breaks into blue particles, expands, fades; pencil returns."
    if frame_index < 493:
        return "resetting", "", "Remaining motion ends; name and input state reset."
    return "idle", "", "Blank paper and stationary pencil restored."

while True:
    ok, frame = cap.read()
    if not ok:
        break
    # The signature's saturated blue is separate from the neutral pencil/paper.
    b, g, r = [channel.astype(np.int16) for channel in cv2.split(frame)]
    blue = (b - r > 30) & (b - g > 12) & (r < 185)
    blue[: int(height * 0.12), :] = False
    blue[int(height * 0.78) :, :] = False
    ys, xs = np.where(blue)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    diff = 0.0 if previous is None else float(np.mean(cv2.absdiff(gray, previous)))
    rows.append({
        "frame": index,
        "time_seconds": round(index / fps, 5),
        "blue_pixels": int(blue.sum()),
        "ink_left": int(xs.min()) if len(xs) else "",
        "ink_top": int(ys.min()) if len(xs) else "",
        "ink_right": int(xs.max()) if len(xs) else "",
        "ink_bottom": int(ys.max()) if len(xs) else "",
        "frame_change_mean": round(diff, 5),
    })
    previous = gray
    phase, prefix, observation = visual_phase(index)
    rows[-1].update(visual_phase=phase, visible_prefix_target=prefix, observation=observation)
    rgb = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    thumb = rgb.resize((250, 161), Image.Resampling.LANCZOS)
    tile = Image.new("RGB", (250, 183), "#f5f5f5")
    tile.paste(thumb, (0, 22))
    ImageDraw.Draw(tile).text((7, 4), f"{index:03d}  {index / fps:05.2f}s", font=font, fill="#222222")
    thumbnails.append(tile)
    if index % 15 == 0 or index == 556:
        overview.append(tile)
    if index in key_indices:
        rgb.save(OUT / "keyframes" / f"frame-{index:03d}-{index / fps:05.2f}s.webp", quality=94)
    index += 1

cap.release()

for page, start in enumerate(range(0, len(thumbnails), 72)):
    chunk = thumbnails[start : start + 72]
    sheet = Image.new("RGB", (2000, 183 * 9), "#e5e5e5")
    for j, tile in enumerate(chunk):
        sheet.paste(tile, ((j % 8) * 250, (j // 8) * 183))
    sheet.save(OUT / "contact-sheets" / f"all-frames-{page + 1:02d}.jpg", quality=90)

sheet = Image.new("RGB", (1250, 183 * ((len(overview) + 4) // 5)), "#e5e5e5")
for j, tile in enumerate(overview):
    sheet.paste(tile, ((j % 5) * 250, (j // 5) * 183))
sheet.save(OUT / "overview.jpg", quality=95)

with (OUT / "frame-metrics.csv").open("w", newline="", encoding="utf-8") as file:
    writer = csv.DictWriter(file, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)

summary = {
    "source": VIDEO.name,
    "width": width,
    "height": height,
    "fps": fps,
    "decoded_frames": index,
    "duration_seconds": index / fps,
    "peak_blue_pixels": max(row["blue_pixels"] for row in rows),
    "first_blue_frame": next((row["frame"] for row in rows if row["blue_pixels"] > 40), None),
    "note": "Zero-based frames. All frames decoded and indexed; blue segmentation is a visual measurement, not stroke reconstruction.",
}
(OUT / "video-metadata.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(summary, ensure_ascii=True, indent=2))
