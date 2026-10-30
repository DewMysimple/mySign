import ni from '../../data/xingshu/v0.2.0/ni.json' with { type: 'json' };
import hao from '../../data/xingshu/v0.2.0/hao.json' with { type: 'json' };
const glyphs = { '你': ni, '好': hao };

// An explicit two-character experimental overlay. Never mutate the qualified
// manifest or pretend that the remaining 3498 characters use this drawing style.
export const XINGSHU_VERSION = ni.version;
export const XINGSHU_CHARACTERS = Object.freeze(Object.keys(glyphs));
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
for (const [ch, g] of Object.entries(glyphs)) {
  if (!['你', '好'].includes(ch) || g.quality !== 'experimental-awaiting-visual-review' ||
      g.omittedLogicalStrokes.length || g.orderChanges.length ||
      g.strokes.some(s => !s.d || !s.outline || !s.visualActionId || s.length <= 0))
    throw new Error('Invalid experimental drawing registry');
  freeze(g);
}
export const getPrototypeGlyph = character => glyphs[character];
