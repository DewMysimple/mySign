"""Pinned, OFL font used ONLY as a visual research specimen; no font in the app."""
import hashlib
import json
import base64
from pathlib import Path
from urllib.request import Request, urlopen
from PIL import Image, ImageDraw, ImageFont

OUT = Path('analysis/xingshu/research')
CACHE = Path('analysis/xingshu/source-cache')
OUT.mkdir(parents=True, exist_ok=True)
CACHE.mkdir(parents=True, exist_ok=True)

def get(url):
    return urlopen(Request(url, headers={'User-Agent': 'Shakespread-visual-prototype'}), timeout=40).read()

api = 'https://api.github.com/repos/google/fonts/commits?path=ofl/longcang&per_page=1'
revision = json.loads(get(api))[0]['sha']
records = []
for filename in ['LongCang-Regular.ttf', 'OFL.txt', 'METADATA.pb']:
    url = f'https://api.github.com/repos/google/fonts/contents/ofl/longcang/{filename}?ref={revision}'
    content = json.loads(get(url))
    if content.get('encoding') != 'base64':
        content = json.loads(get(f'https://api.github.com/repos/google/fonts/git/blobs/{content["sha"]}'))
    raw = base64.b64decode(content['content'])
    target = CACHE / filename if filename.endswith('.ttf') else OUT / filename
    target.write_bytes(raw)
    records.append({'file': filename, 'url': url, 'sha256': hashlib.sha256(raw).hexdigest()})
font = ImageFont.truetype(str(CACHE / 'LongCang-Regular.ttf'), 280)
img = Image.new('RGB', (1000, 480), '#f3f3f1')
draw = ImageDraw.Draw(img)
draw.text((208, 100), '你好', font=font, fill='#3775be')
img.save(OUT / 'longcang-reference.png')
(OUT / 'references.json').write_text(json.dumps({
    'scope': 'Visual research only. Font outlines are not used in prototype data or runtime.',
    'repository': 'https://github.com/google/fonts', 'revision': revision,
    'license': 'SIL Open Font License 1.1', 'files': records,
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'revision': revision, 'files': len(records)}))
