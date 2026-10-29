"""Compare original English ink, excluding the intentionally changed input UI."""
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'analysis/chinese/visual'
OUT.mkdir(parents=True, exist_ok=True)
paths = [ROOT / 'analysis/chinese/baseline/desktop-written.png',
         ROOT / 'analysis/verification/desktop-written.png']
images = [Image.open(p).convert('RGB') for p in paths]
assert images[0].size == images[1].size == (1440, 900)
arrays = [np.asarray(im).astype(np.int16) for im in images]
# The signing area ends at y=600. Controls below it intentionally became a textarea.
masks = [(a[:600, :, 2] > a[:600, :, 0] + 20)
         & (a[:600, :, 2] > a[:600, :, 1] + 5)
         & (a[:600, :, 0] < 200) for a in arrays]
difference = masks[0] ^ masks[1]
union = masks[0] | masks[1]
intersection = masks[0] & masks[1]
panel = np.full((600, 1440, 3), 250, dtype=np.uint8)
panel[intersection] = [160, 160, 160]
panel[masks[0] & ~masks[1]] = [210, 40, 40]
panel[masks[1] & ~masks[0]] = [40, 80, 220]
montage = Image.new('RGB', (1440, 3 * 634), 'white')
draw = ImageDraw.Draw(montage)
for index, (label, im) in enumerate([
    ('Frozen English baseline (signing area)', images[0].crop((0, 0, 1440, 600))),
    ('Current English output (signing area)', images[1].crop((0, 0, 1440, 600))),
    ('Ink mask difference: gray unchanged / red removed / blue added', Image.fromarray(panel)),
]):
    draw.text((16, index * 634 + 8), label, fill='black')
    montage.paste(im, (0, index * 634 + 28))
montage.save(OUT / 'english-ink-diff.png')
report = {
    'scope': 'Canonical Shakespeare output; binary blue-ink pixels in 1440x600 signing area. Input UI and gray pencil/shadow excluded. Not a full-page pixel equality claim.',
    'sources': [{'path': p.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in paths],
    'baselineInkPixels': int(masks[0].sum()),
    'currentInkPixels': int(masks[1].sum()),
    'differentInkPixels': int(difference.sum()),
    'intersectionOverUnion': float(intersection.sum() / union.sum()),
    'pass': bool(not difference.any() and union.any()),
}
(OUT / 'english-ink-diff.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf8')
print(json.dumps(report))
raise SystemExit(0 if report['pass'] else 1)
