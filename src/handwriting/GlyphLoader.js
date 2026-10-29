import manifest from './generated/manifest.json' with { type: 'json' };
import { GlyphCache } from './GlyphCache.js';

export { manifest as GLYPH_MANIFEST };
const abort = () => new DOMException('Writing task cancelled', 'AbortError');

export class GlyphLoader {
  constructor({
    fetcher = (...args) => fetch(...args),
    rawBytes = 2 * 1024 ** 2,
    parsedBytes = 2 * 1024 ** 2,
  } = {}) {
    this.fetcher = fetcher;
    this.raw = new GlyphCache(rawBytes);
    this.parsed = new GlyphCache(parsedBytes);
  }
  has(character) {
    return Object.hasOwn(manifest.characters, character);
  }
  async acquire(characters, signal) {
    const unique = [...new Set(characters)];
    const glyphs = new Map();
    const rawKeys = new Set();
    const pinned = new Set();
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      pinned.forEach((key) => this.parsed.release(key));
      rawKeys.forEach((key) => this.raw.release(key));
    };
    try {
      for (const ch of unique) {
        if (signal?.aborted) throw abort();
        if (!this.has(ch)) throw new Error(`Unsupported glyph ${ch}`);
        let glyph = this.parsed.get(ch);
        if (glyph) {
          this.parsed.pin(ch);
          pinned.add(ch);
          glyphs.set(ch, glyph);
          continue;
        }
        const shard = manifest.characters[ch];
        let raw = this.raw.get(shard);
        if (!raw) {
          const record = manifest.shards[shard];
          const requestSignal = signal
            ? AbortSignal.any([signal, AbortSignal.timeout(10000)])
            : AbortSignal.timeout(10000);
          const response = await this.fetcher(
            `${import.meta.env?.BASE_URL || '/'}glyphs/${record.file}`,
            { signal: requestSignal }
          );
          if (!response.ok)
            throw new Error(`字形分片加载失败 (${response.status})`);
          const text = await response.text();
          if (signal?.aborted) throw abort();
          if (new TextEncoder().encode(text).byteLength !== record.bytes)
            throw new Error('字形分片长度校验失败');
          if (typeof crypto?.subtle?.digest === 'function') {
            const digest = await crypto.subtle.digest(
              'SHA-256',
              new TextEncoder().encode(text)
            );
            const hash = [...new Uint8Array(digest)]
              .map((n) => n.toString(16).padStart(2, '0'))
              .join('');
            if (hash !== record.sha256)
              throw new Error('字形数据完整性校验失败');
          }
          const parsed = JSON.parse(text);
          if (parsed.schema !== manifest.schema || !parsed.glyphs)
            throw new Error('字形数据版本不匹配');
          raw = parsed;
          // UTF-16 string storage + a conservative object-allocation multiplier.
          this.raw.set(shard, raw, text.length * 4, 1);
          rawKeys.add(shard);
        } else if (!rawKeys.has(shard)) {
          this.raw.pin(shard);
          rawKeys.add(shard);
        }
        const data = raw.glyphs[ch];
        if (
          !data ||
          data.character !== ch ||
          data.quality !== (manifest.quality || 'geometry-passed') ||
          !data.strokes?.length ||
          data.strokes.some(
            (s) =>
              !s.outline ||
              s.median?.length < 2 ||
              !Number.isFinite(s.maskWidth)
          )
        ) {
          throw new Error(`字形 ${ch} 未通过运行时校验`);
        }
        glyph = Object.freeze(data);
        this.parsed.set(ch, glyph, JSON.stringify(data).length * 4, 1);
        pinned.add(ch);
        glyphs.set(ch, glyph);
      }
      return { glyphs, release };
    } catch (error) {
      release();
      throw error;
    }
  }
  inspect() {
    return { raw: this.raw.inspect(), parsed: this.parsed.inspect() };
  }
}

// Survives React remounts; no DOM, task callback or WebGL reference is retained.
export const glyphLoader = new GlyphLoader();
