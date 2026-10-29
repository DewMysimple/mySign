import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GlyphLoader, GLYPH_MANIFEST } from '../src/handwriting/GlyphLoader.js';

const shardFor = async (ch) =>
  readFile(
    `public/glyphs/${GLYPH_MANIFEST.shards[GLYPH_MANIFEST.characters[ch]].file}`,
    'utf8'
  );

test('verified shard parsing, cache hits, concurrent leases, and capacity pressure preserve active glyphs', async () => {
  const raw = await shardFor('王');
  let requests = 0;
  const loader = new GlyphLoader({
    fetcher: async () => {
      requests++;
      return new Response(raw);
    },
    rawBytes: 1500,
    parsedBytes: 1500,
  });
  const first = await loader.acquire(['王', '丰']);
  assert.equal(requests, 1);
  assert.equal(first.glyphs.get('王').character, '王');
  assert.equal(loader.inspect().raw.pinned, 1);
  const second = await loader.acquire(['王', '丰']);
  assert.equal(requests, 1);
  assert.ok(loader.inspect().parsed.hits >= 2);
  first.release();
  assert.equal(loader.inspect().parsed.pinned, 2);
  assert.ok(second.glyphs.get('丰').strokes.length > 0);
  second.release();
  second.release();
  assert.equal(loader.inspect().raw.pinned, 0);
  assert.equal(loader.inspect().parsed.pinned, 0);
  assert.ok(loader.inspect().raw.bytes <= 1500);
  assert.ok(loader.inspect().parsed.bytes <= 1500);
});

test('failed HTTP and tampered local shards never enter either verified cache', async () => {
  const raw = await shardFor('王');
  for (const response of [
    new Response('', { status: 503 }),
    new Response(raw.replace('Shakespread', 'Shakezpread')),
  ]) {
    const loader = new GlyphLoader({ fetcher: async () => response });
    await assert.rejects(() => loader.acquire(['王']), /失败/);
    assert.equal(loader.inspect().raw.entries, 0);
    assert.equal(loader.inspect().parsed.entries, 0);
  }
});

test('cancelling an in-flight request releases all pins without poisoning a retry', async () => {
  const raw = await shardFor('王');
  let wait = true;
  const loader = new GlyphLoader({
    fetcher: async (_url, { signal }) =>
      wait
        ? new Promise((_resolve, reject) =>
            signal.addEventListener(
              'abort',
              () => reject(new DOMException('cancelled', 'AbortError')),
              { once: true }
            )
          )
        : new Response(raw),
  });
  const controller = new AbortController();
  const promise = loader.acquire(['王'], controller.signal);
  controller.abort();
  await assert.rejects(promise, { name: 'AbortError' });
  assert.equal(loader.inspect().raw.pinned, 0);
  assert.equal(loader.inspect().parsed.pinned, 0);
  wait = false;
  const retry = await loader.acquire(['王']);
  assert.equal(retry.glyphs.get('王').character, '王');
  retry.release();
});
