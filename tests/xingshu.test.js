import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { GlyphLoader } from '../src/handwriting/GlyphLoader.js';
import { getPrototypeGlyph, XINGSHU_CHARACTERS } from '../src/handwriting/xingshuRegistry.js';
import { buildWritingPlan } from '../src/handwriting/writingPlan.js';
import { motionRhythm } from '../src/handwriting/motionRhythm.js';

test('only two experimental glyphs are overlaid and source files are fingerprinted independently', async () => {
  assert.deepEqual(XINGSHU_CHARACTERS, ['你','好']);
  const manifest = JSON.parse(await readFile('data/xingshu/v0.1.0/manifest.json','utf8'));
  for (const record of manifest.files) {
    const raw = await readFile(`data/xingshu/v0.1.0/${record.file}`);
    assert.equal(createHash('sha256').update(raw).digest('hex'),record.sha256);
    assert.equal(raw.length,record.bytes);
  }
  assert.equal(getPrototypeGlyph('王'),undefined);
  assert.equal(getPrototypeGlyph('你').status,'experimental-not-qualified-library');
});

test('7 and 6 original logical strokes survive continuous grouping, with no omission or order change', () => {
  for (const [ch,count] of [['你',7],['好',6]]) {
    const g = getPrototypeGlyph(ch);
    assert.deepEqual(g.logicalStrokes.map(s => s.originalNumber),Array.from({length:count},(_,i)=>i+1));
    assert.deepEqual(g.strokes.flatMap(s => s.logicalStrokeIds),Array.from({length:count},(_,i)=>i+1));
    assert.deepEqual(g.omittedLogicalStrokes,[]); assert.deepEqual(g.orderChanges,[]);
    assert.ok(g.logicalStrokes.every(s => s.sourceStrokeHash.length === 64 && s.component));
    assert.ok(g.visualActions.length < count);
    assert.ok(Object.isFrozen(g.strokes[0].median[0]));
    for (let i=1;i<g.strokes.length;i++) {
      const a=g.strokes[i-1],b=g.strokes[i];
      if (a.visualActionId === b.visualActionId)
        assert.ok(Math.hypot(a.end.x-b.start.x,a.end.y-b.start.y)<0.001);
    }
  }
});

test('two-glyph loading uses immutable local prototype data without touching qualified shard caches', async () => {
  let calls=0;
  const loader=new GlyphLoader({fetcher:()=>{calls++;throw new Error('unexpected fetch');}});
  const lease=await loader.acquire(['你','好','你']);
  const plan=buildWritingPlan('你好',lease.glyphs,1440,900);
  assert.equal(calls,0); assert.equal(plan.logicalStrokes.length,13); assert.equal(plan.visualActions.length,9);
  assert.equal(plan.strokes.length,16); assert.deepEqual(plan.prototypeCharacters,['你','好']);
  for(let i=1;i<plan.strokes.length;i++) {
    const a=plan.strokes[i-1],b=plan.strokes[i];
    if(a.characterIndex===b.characterIndex && a.visualActionId===b.visualActionId)
      assert.ok(!plan.actions.some(x=>x.type==='lift' && x.index===i));
  }
  assert.ok(plan.actions.some(a=>a.type==='character-move'));
  lease.release(); assert.equal(loader.inspect().parsed.pinned,0);
});

test('authored press/turn/release rhythm stays monotone and reaches exact endpoints', () => {
  const distinct=new Set();
  for(const ch of XINGSHU_CHARACTERS) for(const s of getPrototypeGlyph(ch).strokes) {
    const ease=motionRhythm(s.rhythm); let previous=0;
    assert.equal(ease(0),0); assert.equal(ease(1),1);
    for(let i=0;i<=1000;i++) { const p=ease(i/1000); assert.ok(p>=previous-1e-12 && p<=1); previous=p; }
    distinct.add(JSON.stringify(s.rhythm));
  }
  assert.ok(distinct.size>5);
});
