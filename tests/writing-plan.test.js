import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GlyphCache } from '../src/handwriting/GlyphCache.js';
import { SYMBOLS } from '../src/handwriting/symbols.js';
import { buildSignature, parsePath } from '../src/handwriting/signature.js';
import { validateText, assertValidText, buildWritingPlan, writingLayout, WRITING_BUDGET } from '../src/handwriting/writingPlan.js';

async function loadGlyphs(text) {
  const m = JSON.parse(await readFile('public/glyphs/manifest.json', 'utf8')), glyphs = new Map();
  for (const ch of text) {
    if (!Object.hasOwn(m.characters, ch)) continue;
    const shard = JSON.parse(await readFile(`public/glyphs/${m.shards[m.characters[ch]].file}`, 'utf8'));
    glyphs.set(ch, shard.glyphs[ch]);
  }
  return glyphs;
}

test('registered single-line text preserves spaces; every unsupported grapheme and newline is reported', () => {
  const value = '  王明  Amy，2026！ ';
  assert.equal(validateText(value).text, value);
  assert.deepEqual(validateText(value).issues, []);
  const bad = validateText('王🙂\t👩‍👩‍👧‍👧É\r\n签');
  assert.deepEqual(bad.issues.map(i => i.position), [2, 3, 4, 5, 6]);
  assert.ok(bad.issues[0].codePoint.includes('1F642'));
  assert.match(bad.issues.at(-1).reason, /单行/);
  assert.equal(bad.text, '王🙂\t👩‍👩‍👧‍👧É\n签');
  assert.throws(() => assertValidText('你\n好'), /第 2 个字符.*单行/);
  assert.throws(() => assertValidText('你\u2028好'), /单行/);
});

test('all digits and whitelisted punctuation retain finite, explicitly ordered pen routes', () => {
  for (const [ch, g] of Object.entries(SYMBOLS)) {
    assert.ok(g.advance > 0, ch);
    assert.ok(g.strokes.length > 0, ch);
    for (const d of g.strokes) {
      const p = parsePath(d);
      assert.equal(p[0].type, 'M');
      assert.ok(p.length > 1);
      assert.ok(p.flatMap(x => x.values).every(Number.isFinite));
    }
  }
});

test('canonical English geometry and bounds remain identical to the original engine', () => {
  for (const name of ['Shakespeare', 'Mary Jane', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'Amy', 'Alexandria Montgomery Fitzgerald']) {
    const original = buildSignature(name), plan = buildWritingPlan(name, new Map(), 1440, 900);
    assert.equal(plan.legacy, true);
    assert.deepEqual(plan.strokes.map(s => s.d), original.strokes.map(s => s.d));
    assert.deepEqual(plan.bounds, original.bounds);
  }
});

test('mixed text shares paired contours, original Latin and one fixed line', async () => {
  const text = '王明 Amy 2026，中文签名！', glyphs = await loadGlyphs(text);
  const model = buildWritingPlan(text, glyphs, 1440, 900);
  assert.equal(model.name, text);
  assert.deepEqual(model.lines, [text]);
  assert.ok(model.strokes.some(s => s.outline));
  assert.ok(model.strokes.some(s => s.engine === 'latin'));
  assert.ok(model.strokes.some(s => s.engine === 'symbol'));
  for (const s of model.strokes.filter(s => s.outline)) {
    assert.equal(s.sourceStrokeHash.length, 64);
    assert.ok(s.maskWidth > 0 && s.length > 0);
    assert.equal(s.start.x, s.median[0][0] + s.offset.x);
    assert.equal(s.start.y, s.median[0][1] + s.offset.y);
  }
  assert.ok(!model.actions.some(a => a.type === 'line-move'));
  for (const [w,h] of [[1440,900],[1280,800],[1024,768]]) {
    assert.ok(writingLayout(model,w,h).scale > 0);
    assert.deepEqual(model.lines, [text]);
  }
});

test('character, actual width, ink-segment and duration budgets refuse without truncation or wrapping', () => {
  assertValidText('1'.repeat(WRITING_BUDGET.maxCharacters));
  assert.throws(() => assertValidText('1'.repeat(WRITING_BUDGET.maxCharacters + 1)), /字符.*超过/);
  const name = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  assert.throws(() => buildWritingPlan(name, new Map(), 700, 900), /单行可用宽度不足/);
  assert.equal(buildWritingPlan(name, new Map(), 1440,900).name, name);
  assert.throws(() => buildWritingPlan('Amy', new Map(),1440,900,{...WRITING_BUDGET,maxStrokes:1}), /墨迹动作/);
  assert.throws(() => buildWritingPlan('Amy', new Map(),1440,900,{...WRITING_BUDGET,maxSeconds:0.1}), /安全时长/);
});

test('byte LRU keeps active entries pinned and releases back to its capacity', () => {
  const c = new GlyphCache(10);
  c.set('a',{a:1},6,1); c.set('b',{b:1},6);
  assert.ok(c.get('a')); assert.equal(c.get('b'),undefined);
  c.set('c',{},20,1); assert.ok(c.inspect().bytes > 10);
  c.release('a'); assert.equal(c.get('a'),undefined); assert.ok(c.get('c'));
  c.release('c'); assert.ok(c.inspect().bytes <= 10); assert.equal(c.inspect().pinned,0);
});

test('leading and trailing spaces remain in the single-line plan, with no multi-line path', async () => {
  const text = '  王明  Amy  ', glyphs = await loadGlyphs(text);
  const plan = buildWritingPlan(text,glyphs,1440,900);
  assert.equal(plan.name,text); assert.deepEqual(plan.lines,[text]);
  assert.ok(plan.strokes.every(s => s.line === 0));
  for (const invalid of ['\n王','王\n','王\n\n明'])
    assert.throws(() => buildWritingPlan(invalid,glyphs,1440,900), /单行/);
});
