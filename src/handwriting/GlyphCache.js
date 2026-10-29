/** A byte-budgeted, reference-pinned LRU. Active jobs may exceed the cache budget;
 * release enforces it immediately. No live glyph can be evicted under a writer. */
export class GlyphCache {
  constructor(budgetBytes) {
    this.budgetBytes = budgetBytes;
    this.entries = new Map();
    this.bytes = 0;
    this.hits = 0;
    this.misses = 0;
  }
  get(key) {
    const entry = this.entries.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    this.hits++;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }
  set(key, value, bytes, pins = 0) {
    const old = this.entries.get(key);
    if (old) this.bytes -= old.bytes;
    this.entries.delete(key);
    this.entries.set(key, { value, bytes, pins: (old?.pins || 0) + pins });
    this.bytes += bytes;
    this.evict();
    return value;
  }
  pin(key) {
    const e = this.entries.get(key);
    if (e) e.pins++;
  }
  release(key) {
    const e = this.entries.get(key);
    if (e) e.pins = Math.max(0, e.pins - 1);
    this.evict();
  }
  evict() {
    for (const [key, e] of this.entries) {
      if (this.bytes <= this.budgetBytes) break;
      if (!e.pins) {
        this.entries.delete(key);
        this.bytes -= e.bytes;
      }
    }
  }
  inspect() {
    return {
      entries: this.entries.size,
      bytes: this.bytes,
      budgetBytes: this.budgetBytes,
      pinned: [...this.entries.values()].filter((e) => e.pins).length,
      hits: this.hits,
      misses: this.misses,
    };
  }
}
