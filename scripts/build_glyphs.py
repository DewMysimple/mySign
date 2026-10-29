"""Offline glyph conversion and geometry gates. Never fetches at application runtime.

python scripts/build_glyphs.py --source-cache analysis/chinese/source-cache
Requires numpy, Pillow, shapely (see scripts/glyph-requirements.txt).
Source outlines/order/medians stay paired; no guessed skeleton becomes publishable.
"""
import argparse
import hashlib
import json
import math
import re
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from shapely.geometry import Polygon, LineString, Point
from shapely.ops import unary_union
from median_candidates import derive_median

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/glyphs'
REPORT = ROOT / 'analysis/chinese'
VERSIONS = {'mmh': 'bddc96d41bef78427ed0e034e9f7e31d71fd1b92', 'hwd': 'npm:2.0.1', 'target': 'd9b599a9c9cc0dd2d58cad829e285bc780cd4451'}
REPRESENTATIVES = '一二三十永我心书中文名签国圆回风飞女水火山木王张李陈赵黄明德爱谢赢警藏戴曦麟齿凹凸卵'
REPAIRS = json.loads((ROOT/'data/glyphs/repairs.json').read_text(encoding='utf8'))['repairs']

def dumps(value): return json.dumps(value, ensure_ascii=False, separators=(',', ':'))
def sha(data): return hashlib.sha256(data).hexdigest()
def dump(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(dumps(data) + '\n', encoding='utf8')

def convert_path(d):
    """Strict upstream M/L/Q/C/Z parser, Bézier sampling at <=2 source-unit steps.
    Transform both geometry types with x/10.24, (900-y)/10.24. No skew/stretch.
    """
    tokens = re.findall(r'[A-Za-z]|[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?', d)
    i = 0; current = np.array([0., 0.]); start = current.copy(); rings = []; ring = []; commands = []
    while i < len(tokens):
        cmd = tokens[i]; i += 1
        if cmd == 'Z':
            if ring:
                ring.append(start.tolist()); rings.append(ring); ring = []
            commands.append('Z'); current = start.copy(); continue
        if cmd not in {'M','L','Q','C'}: raise ValueError(f'Unsupported command {cmd}')
        size = {'M':2,'L':2,'Q':4,'C':6}[cmd]
        values = list(map(float, tokens[i:i+size])); i += size
        if len(values) != size or not all(math.isfinite(v) for v in values): raise ValueError('Nonfinite path')
        points = np.array(values).reshape(-1,2)
        normalized = [[round(x/10.24,4), round((900-y)/10.24,4)] for x,y in points]
        commands.append(cmd + ' ' + ' '.join(str(v) for p in normalized for v in p))
        if cmd == 'M':
            if ring: rings.append(ring)
            current = points[0]; start = current.copy(); ring = [current.tolist()]
        elif cmd == 'L': ring.append(points[0].tolist()); current = points[0]
        else:
            controls = np.vstack([current,points])
            count = max(4, int(np.linalg.norm(np.diff(controls,axis=0),axis=1).sum()/2))
            for t in np.linspace(0,1,count+1)[1:]:
                q = controls.copy()
                while len(q)>1: q=q[:-1]*(1-t)+q[1:]*t
                ring.append(q[0].tolist())
            current = points[-1]
    if ring: rings.append(ring)
    if not rings or any(len(r)<4 for r in rings): raise ValueError('Open/empty contour')
    polygons = [Polygon(r) for r in rings]
    # Source curves occasionally self-touch; buffer(0) is ONLY a checking surface.
    # The rendered contour is retained exactly; never replace it with this polygon.
    surface = unary_union([p if p.is_valid else p.buffer(0) for p in polygons])
    return ' '.join(commands), rings, surface

def candidate(character, source, data):
    issues = []; repairs = []; strokes = []; stroke_stats = []; proposals=[]
    if not isinstance(data,dict):return {'character':character,'source':source,'pass':False,'issues':['invalid_source_record'],'proposals':[]}
    outlines=data.get('strokes') if isinstance(data.get('strokes'),list) else []
    medians=data.get('medians') if isinstance(data.get('medians'),list) else []
    if not outlines or len(outlines) != len(medians):
        for index,outline in enumerate(outlines):
            if index<len(medians) and isinstance(medians[index],list) and len(medians[index])>=2:continue
            try: proposals.append({'stroke':index,**derive_median(convert_path(outline)[2],medians[index] if index<len(medians) and isinstance(medians[index],list) else None)})
            except (ValueError,TypeError,IndexError):pass
        return {'character':character, 'source':source, 'pass':False, 'issues':['missing_or_mismatched_strokes'],'proposals':proposals}
    for index,(outline, raw_median) in enumerate(zip(outlines,medians)):
        surface=None
        if not isinstance(raw_median,list):raw_median=[]
        try:
            repair=REPAIRS.get(character)
            source_median=raw_median
            if repair and repair['stroke']==index:
                if raw_median!=repair['originalMedian']: raise ValueError('Repair source mismatch; review new source instead of applying stale repair')
                raw_median=repair['median']
                repairs.append({'stroke':index,'kind':repair['kind'],'evidence':'data/glyphs/repairs.json','orderSource':repair['independentOrderSource'],'independent_order_change':False})
            normalized, rings, surface = convert_path(outline)
            median = []
            for p in raw_median:
                if len(p)!=2 or not all(math.isfinite(v) for v in p): raise ValueError('Nonfinite median')
                if not median or p != median[-1]: median.append(p)
            if len(median) != len(raw_median): repairs.append({'stroke':index,'kind':'remove_consecutive_duplicate_points','independent_order_change':False})
            if len(median)<2:
                proposals.append({'stroke':index,**derive_median(surface,median or None)})
                raise ValueError('Missing median; generated candidate stays quarantined until independent review')
            line = LineString(median)
            if line.length < 1 or surface.area<1: raise ValueError('Degenerate geometry')
            samples=[line.interpolate(v) for v in np.linspace(0,line.length,max(12,int(line.length/8)))]
            distances=np.array([surface.distance(p) for p in samples])
            interior=float(np.mean(distances<=2))
            max_out=float(distances.max())
            # Independent of mask coverage: a route must trace its OWN outline.
            if interior < .90 or max_out>32:
                issues.append(f'stroke_{index}:median_outside:{interior:.3f}:{max_out:.2f}')
                proposals.append({'stroke':index,**derive_median(surface,median)})
            boundary=[p for ring in rings for p in ring]
            radius=max(line.distance(Point(p)) for p in boundary)+2
            coverage=surface.intersection(line.buffer(radius,quad_segs=16)).area/surface.area
            if coverage < .999: issues.append(f'stroke_{index}:mask_coverage:{coverage:.5f}')
            a=np.array(median,dtype=float)
            v=np.diff(a,axis=0)
            turns=np.sum(np.arccos(np.clip(np.sum(v[:-1]*v[1:],axis=1)/(np.linalg.norm(v[:-1],axis=1)*np.linalg.norm(v[1:],axis=1)),-1,1))) if len(v)>1 else 0
            points=[[round(x/10.24,4),round((900-y)/10.24,4)] for x,y in median]
            b=surface.bounds
            strokes.append({'outline':normalized, 'median':points, 'length':round(line.length/10.24,4),
                'maskWidth':round(radius*2/10.24,4), 'complexity':round(float(turns),3),
                'bounds':[round(b[0]/10.24,4),round((900-b[3])/10.24,4),round(b[2]/10.24,4),round((900-b[1])/10.24,4)],
                'sourceStrokeHash':sha((outline+dumps(source_median)).encode()),'routeHash':sha(dumps(median).encode())})
            stroke_stats.append({'interiorRatio':round(interior,5),'maxOutside':round(max_out,3),'maskCoverage':round(coverage,7)})
        except (ValueError,TypeError,IndexError) as e:
            issues.append(f'stroke_{index}:{e}')
            if not any(p['stroke']==index for p in proposals):
                try: proposals.append({'stroke':index,**derive_median(surface if surface is not None else convert_path(outline)[2])})
                except (ValueError,TypeError,IndexError):pass
    if not strokes: issues.append('empty')
    score=round(100-10*len(issues)-sum(1-s['interiorRatio'] for s in stroke_stats),5)
    return {'character':character,'source':source,'pass':not issues,'issues':issues,'repairs':repairs,'score':score,
            'strokes':strokes,'metrics':stroke_stats,'sourceHash':sha(dumps(data).encode()),'proposals':proposals}

def select_candidate(primary,backup):
    if not primary['pass']:return backup if backup and backup['pass'] else None
    if backup and backup['pass'] and backup['score']>primary['score']+1:return backup
    return primary

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--source-cache',default='analysis/chinese/source-cache'); args=ap.parse_args()
    cache=ROOT/args.source_cache
    mmh_file=cache/'mmh/graphics.txt'
    if not mmh_file.exists(): mmh_file=cache/'mmh-graphics.txt'
    mmh={g['character']:g for g in map(json.loads,mmh_file.read_text(encoding='utf8').splitlines())}
    hwd_root=cache/'hwd-npm/package'
    targets=''.join((cache/'level-1.txt').read_text(encoding='utf8').split())
    assert len(targets)==len(set(targets))==3500, 'Do not substitute another 3500-character set'
    dump(ROOT/'data/glyphs/targets.json',{'standard':'通用规范汉字表（2013）一级','revision':VERSIONS['target'],'characters':targets})
    font_path=Path('C:/Windows/Fonts/msyh.ttc')
    font=ImageFont.truetype(str(font_path),12) if font_path.exists() else ImageFont.load_default()
    all_results=[]; quarantined=[]; selected=[]; comparisons=[]; page=None; draw=None
    OUT.mkdir(parents=True,exist_ok=True)
    for n,ch in enumerate(targets):
        hfile=hwd_root/f'{ch}.json'
        data=json.loads(hfile.read_text(encoding='utf8')) if hfile.exists() else None
        primary=candidate(ch,'hwd',data)
        risk=ch in REPRESENTATIVES or not primary['pass'] or len(primary.get('strokes',[]))>=18 or n%97==0
        backup=candidate(ch,'mmh',mmh.get(ch)) if risk else None
        chosen=select_candidate(primary,backup)
        if backup:
            comparisons.append({'character':ch,'primary':{k:v for k,v in primary.items() if k not in ['strokes']},'backup':{k:v for k,v in backup.items() if k not in ['strokes']},'selected':chosen['source'] if chosen else None})
        if chosen:
            bounds=[min(s['bounds'][0] for s in chosen['strokes']),min(s['bounds'][1] for s in chosen['strokes']),max(s['bounds'][2] for s in chosen['strokes']),max(s['bounds'][3] for s in chosen['strokes'])]
            glyph={'character':ch,'codePoint':f'U+{ord(ch):04X}','source':chosen['source'],'version':VERSIONS[chosen['source']],
                'license':'Arphic Public License','sourceHash':chosen['sourceHash'],'quality':'geometry-passed',
                'orderEvidence':'source-order-with-reviewed-route-repair' if chosen['repairs'] else 'unmodified-source-pair','review':'pending-atlas-audit','repairs':chosen['repairs'],'score':chosen['score'],
                'advance':100,'bearingLeft':bounds[0],'bearingRight':100-bounds[2],'baseline':88,'visualOffset':[0,0],
                'bounds':bounds,'strokes':chosen['strokes']}
            selected.append(glyph)
        else: quarantined.append({'character':ch,'primary':primary['issues'],'backup':backup['issues'] if backup else ['not_compared']})
        all_results.append({'character':ch,'source':chosen['source'] if chosen else None,'pass':bool(chosen),'strokeCount':len(chosen['strokes']) if chosen else 0,'score':chosen['score'] if chosen else 0,'repairs':chosen['repairs'] if chosen else [],'metrics':chosen['metrics'] if chosen else []})
        # Full atlas, 100 legible glyphs/page, source contours and route overlay.
        slot=n%100
        if slot==0:
            page=Image.new('RGB',(1200,1400),'#f3f3f1'); draw=ImageDraw.Draw(page)
        x=(slot%10)*120+8; y=(slot//10)*140+22
        draw.text((x,y-19),f'{n+1:04} {ch}',font=font,fill='#323630')
        if chosen:
            for stroke_index,(outline,median) in enumerate(zip((data if chosen['source']=='hwd' else mmh[ch])['strokes'],(data if chosen['source']=='hwd' else mmh[ch])['medians'])):
                if ch in REPAIRS and REPAIRS[ch]['stroke']==stroke_index: median=REPAIRS[ch]['median']
                _,rings,_=convert_path(outline)
                for ring in rings: draw.polygon([(x+px/10.24,y+(900-py)/10.24) for px,py in ring],fill='#3775be')
                draw.line([(x+px/10.24,y+(900-py)/10.24) for px,py in median],fill='#e59464',width=1)
        else: draw.text((x,y+40),'QUARANTINED',font=font,fill='#c00000')
        if slot==99: page.save(REPORT/f'atlas/atlas-{n//100+1:02}.png')
        if (n+1)%100==0: print(f'{n+1}/3500: {len(selected)} geometry passed, {len(quarantined)} quarantined',flush=True)
    registry={}; shards=[]
    for offset in range(0,len(selected),32):
        group=selected[offset:offset+32]; name=f'shard-{offset//32:03}.json'
        payload={'schema':1,'notice':'Shakespread: normalized coordinates and derived metrics, 2026-10-30. Original Arphic outlines/medians/order paired; under Arphic Public License. No warranty. See ARPHICPL.TXT and provenance.json.','glyphs':{g['character']:g for g in group}}
        raw=(dumps(payload)+'\n').encode(); (OUT/name).write_bytes(raw)
        shards.append({'file':name,'bytes':len(raw),'sha256':sha(raw)})
        for g in group: registry[g['character']]=len(shards)-1
    manifest={'schema':1,'targetCount':3500,'geometryPassed':len(selected),'characters':registry,'shards':shards,'license':'Arphic Public License','versions':VERSIONS,'strokeCounts':{g['character']:len(g['strokes']) for g in selected}}
    dump(ROOT/'src/handwriting/generated/manifest.json',manifest); dump(OUT/'manifest.json',manifest)
    dump(OUT/'provenance.json',{'versions':VERSIONS,'targetSHA256':sha(targets.encode()),'sourceSHA256':sha(mmh_file.read_bytes().replace(b'\r\n',b'\n')),'workingCopySHA256':sha(mmh_file.read_bytes()),'sourceGitBlob':'ef25a9208f7c4daf942d6f12be0a0f85075d140a','notice':'Coordinate normalization, metrics, source selection and mask coverage derived by Shakespread on 2026-10-30. Geometry remains paired with its original median and stroke order. No warranty.','urls':{'hwd':'https://github.com/chanind/hanzi-writer-data','mmh':'https://github.com/skishore/makemeahanzi','target':'https://github.com/shengdoushi/common-standard-chinese-characters-table'},'license':'ARPHICPL.TXT'})
    (OUT/'ARPHICPL.TXT').write_bytes((hwd_root/'ARPHICPL.TXT').read_bytes())
    dump(REPORT/'glyph-quality.json',{'versions':VERSIONS,'target':3500,'geometryPassed':len(selected),'quarantined':quarantined,'sourceComparison':comparisons,'glyphs':all_results,'releaseStatus':'NOT_RELEASED: manual audit, animation, performance and device gates pending'})
    print(dumps({'target':3500,'geometryPassed':len(selected),'quarantined':len(quarantined),'shards':len(shards)}))

if __name__=='__main__':
    (REPORT/'atlas').mkdir(parents=True,exist_ok=True)
    main()
