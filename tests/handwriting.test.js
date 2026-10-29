import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GLYPHS } from '../src/handwriting/glyphs.js';
import { buildSignature, isSupportedName, normalizeName, parsePath, signatureLayout, toScreen } from '../src/handwriting/signature.js';

test('all 52 English letters have finite, ordered, nonempty pen gestures', () => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  assert.equal(Object.keys(GLYPHS).length, 52);
  for (const letter of alphabet) {
    const signature = buildSignature(letter);
    assert.ok(signature.strokes.length > 0, letter);
    for (const stroke of signature.strokes) {
      const commands = parsePath(stroke.d);
      assert.equal(commands[0].type, 'M', letter);
      assert.ok(commands.length > 1, letter);
      assert.ok(commands.flatMap((c) => c.values).every(Number.isFinite), letter);
    }
  }
});

test('names are normalized; unsupported or empty content cannot start signing', () => {
  assert.equal(normalizeName('  Mary   Jane  '), 'Mary Jane');
  for (const value of ['', ' ', '123', 'Alice1', '中文', '<script>', 'Amy-Jane', 'Émile']) {
    assert.equal(isSupportedName(value), false, value);
    assert.throws(() => buildSignature(value));
  }
  for (const value of ['A', 'Shakespeare', '  Mary   Jane  ', 'aBc XYZ']) assert.ok(isSupportedName(value), value);
});

test('spaces create a real pen lift and do not draw a line between words', () => {
  const name = buildSignature('a a');
  assert.equal(name.strokes.length, 2);
  assert.ok(name.strokes[1].start.x - name.strokes[0].start.x > 60);
  assert.ok(name.strokes.every((s) => !s.isJoin));
});

test('dots and crossbars remain separate gestures, after their main stroke', () => {
  for (const letter of ['i', 'j', 't', 'f', 'x', 'A', 'T', 'X']) {
    const name = buildSignature(letter);
    assert.ok(name.strokes.length > 1, letter);
    assert.equal(name.strokes[0].isMain, true, letter);
    assert.equal(name.strokes[1].isMain, false, letter);
  }
});

test('short, long, all-capital and descending names fit and centre on every viewport', () => {
  const sizes = [[320, 568], [390, 844], [768, 1024], [1440, 900], [2560, 1440], [880, 360]];
  for (const text of ['A', 'Amy', 'Shakespeare', 'WILLIAM SHAKESPEARE', 'gypqj', 'Alexandria Montgomery Fitzgerald', 'A'.repeat(300)]) {
    const name = buildSignature(text);
    for (const [width, height] of sizes) {
      const layout = signatureLayout(name, width, height);
      const upper = toScreen({ x: name.bounds.minX, y: name.bounds.minY }, layout);
      const lower = toScreen({ x: name.bounds.maxX, y: name.bounds.maxY }, layout);
      assert.ok(upper.x > 0 && lower.x < width && upper.y > 0 && lower.y < height * 0.7, `${text.slice(0, 30)} at ${width}×${height}`);
      assert.ok(Math.abs((upper.x + lower.x) / 2 - width / 2) < 0.0001);
    }
  }
});
