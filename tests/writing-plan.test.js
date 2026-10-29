import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GlyphCache } from '../src/handwriting/GlyphCache.js';
import { SYMBOLS } from '../src/handwriting/symbols.js';
import { buildSignature, parsePath } from '../src/handwriting/signature.js';
import {
  validateText,
  buildWritingPlan,
  writingLayout,
} from '../src/handwriting/writingPlan.js';

async function loadGlyphs(text) {
  const m = JSON.parse(await readFile('public/glyphs/manifest.json', 'utf8'));
  const glyphs = new Map();
  for (const ch of text) {
    if (!Object.hasOwn(m.characters, ch)) continue;
    const shard = JSON.parse(
      await readFile(`public/glyphs/${m.shards[m.characters[ch]].file}`, 'utf8')
    );
    glyphs.set(ch, shard.glyphs[ch]);
  }
  return glyphs;
}

test('registered text preserves spaces, punctuation and explicit line breaks; all errors use grapheme positions', () => {
  const result = validateText('  王明  Amy，2026！\r\n\n签名。 ');
  assert.equal(result.text, '  王明  Amy，2026！\n\n签名。 ');
  assert.deepEqual(result.issues, []);
  const bad = validateText('王🙂\t👩‍👩‍👧‍👧É');
  assert.deepEqual(
    bad.issues.map((i) => i.position),
    [2, 3, 4, 5]
  );
  assert.ok(bad.issues[0].codePoint.includes('1F642'));
  assert.equal(validateText(' \n ').issues.length, 1);
});

test('all digits and whitelisted punctuation have finite, explicitly ordered pen routes', () => {
  for (const [ch, g] of Object.entries(SYMBOLS)) {
    assert.ok(g.advance > 0, ch);
    assert.ok(g.strokes.length > 0, ch);
    for (const d of g.strokes) {
      const p = parsePath(d);
      assert.equal(p[0].type, 'M');
      assert.ok(p.length > 1);
      assert.ok(p.flatMap((x) => x.values).every(Number.isFinite));
    }
  }
});

test('canonical English geometry is byte-identical to frozen original engine', () => {
  for (const name of [
    'Shakespeare',
    'Mary Jane',
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    'Amy',
  ]) {
    const original = buildSignature(name),
      plan = buildWritingPlan(name, new Map(), 1440, 900);
    assert.equal(plan.legacy, true);
    assert.deepEqual(
      plan.strokes.map((s) => s.d),
      original.strokes.map((s) => s.d)
    );
    assert.deepEqual(plan.bounds, original.bounds);
  }
});

test('mixed text uses paired outline/median routes, stable lines, and a single coordinate mapping', async () => {
  const text = '王明 Amy 2026，\n\n中文签名！';
  const glyphs = await loadGlyphs(text);
  const model = buildWritingPlan(text, glyphs, 1440, 900);
  assert.equal(model.name, text);
  assert.equal(model.lines.length, 3);
  assert.equal(model.lines[1], '');
  assert.ok(model.strokes.some((s) => s.outline));
  assert.ok(model.strokes.some((s) => s.engine === 'latin'));
  assert.ok(model.strokes.some((s) => s.engine === 'symbol'));
  const before = JSON.stringify(model.lines);
  for (const [w, h] of [
    [1440, 900],
    [768, 900],
    [880, 360],
    [320, 568],
  ]) {
    const l = writingLayout(model, w, h);
    assert.ok(Number.isFinite(l.scale));
    assert.ok(l.scale > 0);
    assert.equal(JSON.stringify(model.lines), before);
  }
  for (const s of model.strokes.filter((s) => s.outline)) {
    assert.ok(s.sourceStrokeHash.length === 64);
    assert.ok(s.maskWidth > 0);
    assert.ok(s.length > 0);
    assert.equal(s.start.x, s.median[0][0] + s.offset.x);
    assert.equal(s.start.y, s.median[0][1] + s.offset.y);
  }
  assert.ok(model.actions.some((a) => a.type === 'line-move'));
  assert.ok(model.clearActions.some((a) => a.type === 'particles'));
});

test('automatic line breaks respect opening/closing punctuation; oversize tasks reject without truncation', async () => {
  const text = '中文中文中文中文中文中文，（签名）《中文》！';
  const g = await loadGlyphs(text);
  const plan = buildWritingPlan(text, g, 390, 844);
  assert.ok(plan.lines.length > 1);
  assert.equal(plan.lines.join(''), text);
  for (const line of plan.lines) {
    assert.ok(!/^[，。！）》]/.test(line), line);
    assert.ok(!/[（《]$/.test(line), line);
  }
  assert.throws(
    () => buildWritingPlan('王'.repeat(1000), g, 1440, 900),
    /超过|字形/
  );
});

test('byte LRU keeps active entries pinned, evicts in access order, and releases back to budget', () => {
  const c = new GlyphCache(10);
  c.set('a', { a: 1 }, 6, 1);
  c.set('b', { b: 1 }, 6);
  assert.ok(c.get('a'));
  assert.equal(c.get('b'), undefined);
  assert.equal(c.inspect().pinned, 1);
  c.set('c', {}, 20, 1);
  assert.ok(c.inspect().bytes > 10);
  c.release('a');
  assert.equal(c.get('a'), undefined);
  assert.ok(c.get('c'));
  c.release('c');
  assert.ok(c.inspect().bytes <= 10);
  assert.equal(c.inspect().pinned, 0);
});

test('long English wraps at the readable floor and leading/trailing blank lines retain real line-box space', async () => {
  const text = 'Alexandria '.repeat(9).trim();
  const plan = buildWritingPlan(text, new Map(), 700, 900);
  assert.equal(plan.legacy, false);
  assert.ok(plan.lines.length > 1);
  assert.equal(plan.lines.join(''), text);
  assert.ok(writingLayout(plan, 700, 900).scale >= 0.36);
  const g = await loadGlyphs('王');
  const plain = buildWritingPlan('王', g, 1440, 900),
    blank = buildWritingPlan('\n王\n', g, 1440, 900);
  assert.equal(blank.lines.length, 3);
  assert.ok(
    blank.bounds.maxY - blank.bounds.minY >
      plain.bounds.maxY - plain.bounds.minY + 200
  );
  assert.ok(blank.strokes.every((s) => s.line === 1));
});
