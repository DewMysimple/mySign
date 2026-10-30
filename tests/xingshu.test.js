import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { GlyphLoader } from '../src/handwriting/GlyphLoader.js';
import { getPrototypeGlyph, XINGSHU_CHARACTERS } from '../src/handwriting/xingshuRegistry.js';
import { buildWritingPlan } from '../src/handwriting/writingPlan.js';
import { motionRhythm } from '../src/handwriting/motionRhythm.js';
import { designs, recommended } from '../data/xingshu/v0.2.0/designs.mjs';
import { validateConnections } from '../scripts/xingshu-connection-audit.mjs';

test('only two experimental glyphs are overlaid and source files are fingerprinted independently', async () => {
  assert.deepEqual(XINGSHU_CHARACTERS, ['你','好']);
  const manifest = JSON.parse(await readFile('data/xingshu/v0.2.0/manifest.json','utf8'));
  for (const record of manifest.files) {
    const raw = await readFile(`data/xingshu/v0.2.0/${record.file}`);
    assert.equal(createHash('sha256').update(raw).digest('hex'),record.sha256);
    assert.equal(raw.length,record.bytes);
  }
  assert.equal(getPrototypeGlyph('王'),undefined);
  assert.equal(getPrototypeGlyph('你').status,'experimental-not-qualified-library');
});

test('all three old return threads are absent from ink, plans and particle input segments', () => {
  const glyphs=new Map(XINGSHU_CHARACTERS.map(ch=>[ch,getPrototypeGlyph(ch)]));
  const p=buildWritingPlan('你好',glyphs,1440,900);
  assert.equal(p.strokes.filter(s=>s.role==='connection').length,0);
  assert.equal(p.strokes.length,13);
  // Original 你 1→2, 3→4 and 好 1→2 now execute actual airborne movement.
  for(const index of [1,3,8])assert.ok(p.actions.some(a=>a.type==='lift'&&a.index===index));
  assert.ok(!p.actions.some(a=>a.type==='lift'&&a.index===11));
  assert.equal(p.visualActions.filter(g=>g.segmentIndices.length>1).length,1);
});

test('A and B preserve the same thirteen originals; B alone has a tangent-continuous 子 fold',async()=>{
  assert.equal(recommended,'b');
  for(const [variant,groups]of[['a',13],['b',12]]){
    let totalGroups=0;
    for(const [ch,file]of[['你','ni'],['好','hao']]){
      const g=JSON.parse(await readFile(`data/xingshu/v0.2.0/candidates/${variant}/${file}.json`));
      const old=JSON.parse(await readFile(`data/xingshu/v0.1.0/${file}.json`));
      assert.deepEqual(g.logicalStrokes.map(s=>s.sourceStrokeHash),old.logicalStrokes.map(s=>s.sourceStrokeHash));
      assert.equal(g.strokes.length,ch==='你'?7:6);totalGroups+=g.visualActions.length;
    }assert.equal(totalGroups,groups);
  }
  const [a,b]=[3,4].map(i=>getPrototypeGlyph('好').strokes[i]);
  assert.deepEqual(a.end,b.start);
  const nums=d=>d.match(/-?\d+(?:\.\d+)?/g).map(Number), av=nums(a.d).slice(-6),bv=nums(b.d).slice(0,8);
  const u=[av[4]-av[2],av[5]-av[3]],v=[bv[2]-bv[0],bv[3]-bv[1]];
  assert.ok((u[0]*v[0]+u[1]*v[1])/Math.hypot(...u)/Math.hypot(...v)>.99999);
});

test('each principal curve and pressure profile is redesigned; stroke weight is not a uniform multiplier',async()=>{
  const ratios=[];
  for(const file of ['ni','hao']){
    const old=JSON.parse(await readFile(`data/xingshu/v0.1.0/${file}.json`));
    const current=getPrototypeGlyph(file==='ni'?'你':'好');
    for(const s of current.strokes){
      const previous=old.strokes.find(t=>t.logicalStrokeIds[0]===s.logicalStrokeIds[0]);
      assert.notEqual(s.d,previous.d);assert.notDeepEqual(s.pressure,previous.pressure);
      assert.ok(Math.max(...s.pressure.map(p=>p[1]))>=4.2);
      assert.ok(s.pressure.length>=5&&s.pressure.every(([p,w])=>p>=0&&p<=1&&w>=.5));
      ratios.push(Math.max(...s.pressure.map(p=>p[1]))/Math.max(...previous.pressure.map(p=>p[1])));
    }
  }assert.ok(Math.max(...ratios)-Math.min(...ratios)>.2);
});

test('ink admission rejects the removed threads and unreviewed direct groups independently of stroke order',()=>{
  validateConnections(designs.a);validateConnections(designs.b);
  const bad=structuredClone(designs.b);
  bad.glyphs['你'].connections.push({id:'ni-thread-1-2',from:1,to:2});
  assert.throws(()=>validateConnections(bad),/six review/);
  const unreviewed=structuredClone(designs.a);
  unreviewed.glyphs['你'].logicalStrokes[1].group='ni-1';
  assert.throws(()=>validateConnections(unreviewed),/Unreviewed/);
});

test('7 and 6 original logical strokes survive continuous grouping, with no omission or order change', () => {
  for (const [ch,count] of [['你',7],['好',6]]) {
    const g = getPrototypeGlyph(ch);
    assert.deepEqual(g.logicalStrokes.map(s => s.originalNumber),Array.from({length:count},(_,i)=>i+1));
    assert.deepEqual(g.strokes.flatMap(s => s.logicalStrokeIds),Array.from({length:count},(_,i)=>i+1));
    assert.deepEqual(g.omittedLogicalStrokes,[]); assert.deepEqual(g.orderChanges,[]);
    assert.ok(g.logicalStrokes.every(s => s.sourceStrokeHash.length === 64 && s.component));
    assert.ok(g.visualActions.length <= count);
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
  assert.equal(calls,0); assert.equal(plan.logicalStrokes.length,13); assert.equal(plan.visualActions.length,12);
  assert.equal(plan.strokes.length,13); assert.deepEqual(plan.prototypeCharacters,['你','好']);
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
