"""Reproduce same-group, paired-outline/median source comparison (build time)."""
import json
from pathlib import Path
from build_glyphs import candidate, REPRESENTATIVES, VERSIONS, sha, dumps
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'analysis/chinese/source-cache'
mmh={x['character']:x for x in map(json.loads,(CACHE/'mmh/graphics.txt').read_text(encoding='utf8').splitlines())}
hwd=CACHE/'hwd-npm/package'
targets=json.loads((ROOT/'data/glyphs/targets.json').read_text(encoding='utf8'))['characters']
quality=json.loads((ROOT/'analysis/chinese/glyph-quality.json').read_text(encoding='utf8'))
prototypes=[]; render_candidates=[]
for ch in REPRESENTATIVES:
    a=json.loads((hwd/f'{ch}.json').read_text(encoding='utf8')) if (hwd/f'{ch}.json').exists() else None
    b=mmh.get(ch)
    results=[candidate(ch,'hwd',a),candidate(ch,'mmh',b)]
    for r in results:
        if r['pass']:render_candidates.append({'character':ch,'source':r['source'],'withinFormalTarget':ch in targets,'glyph':{'character':ch,'advance':100,'baseline':88,'strokes':r['strokes']}})
    prototypes.append({'character':ch,'withinFormalTarget':ch in targets,'strokes':len(a['strokes']) if a else None,
        'sameOutline':bool(a and b and a['strokes']==b['strokes']),'sameMedians':bool(a and b and a['medians']==b['medians']),
        'candidates':[{k:v for k,v in r.items() if k!='strokes'} for r in results]})
report={'date':'2026-10-30','versions':VERSIONS,'hwdNpmGitHead':'ad1a9905cada18d07630acc27d438b070d753ec0',
        'hwdNpmIntegrity':'sha512-nbQwM+MaryGoq7pBMIZLCd3lFq03nXuJuwku1+6UbjL58uU+9OULVcMkoNvNuJSoIV7f1bbPRfD4D/LQa5S7qg==',
        'commonAncestry':True,'independentOrderCertification':False,'target':3500,
        'rawCoverage':{'hwd':sum((hwd/f'{c}.json').exists() for c in targets),'mmh':sum(c in mmh for c in targets)},
        'fullPrimaryGeometryQualified':quality['geometryPassed'],'riskComparedGlyphs':len(quality['sourceComparison']),
        'prototypeCount':len(prototypes),'representativePrimaryFailures':[r['character'] for r in prototypes if not r['candidates'][0]['pass']],
        'prototypes':prototypes,'decision':'Primary HWD 2.0.1, paired MMH as controlled fallback. Shared ancestry acknowledged; repair order independently checked against GF0023-2020. Out-of-target prototype characters are not registered or counted as supported.'}
(ROOT/'analysis/chinese/source-comparison.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
(ROOT/'analysis/chinese/source-prototypes.json').write_text(json.dumps({'scope':'isolated source comparison only; does not register any out-of-target glyph','candidates':render_candidates},ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
print(json.dumps({k:v for k,v in report.items() if k not in ['prototypes']},ensure_ascii=True))
