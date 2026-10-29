import { GLYPHS } from './glyphs.js';

export const INK_COLOR = '#3775be';
export const STROKE_WIDTH = 4.5;

export function normalizeName(value) {
  return value.trim().replace(/\s+/g, ' ');
}

export function isSupportedName(value) {
  return /^[a-zA-Z]+(?: [a-zA-Z]+)*$/.test(normalizeName(value));
}

const round = (n) => Math.round(n * 1000) / 1000;

/** Parse only the tiny, deliberately bounded vocabulary of our original paths. */
export function parsePath(d) {
  const tokens = d.match(/[MLC]|-?(?:\d*\.)?\d+/g);
  const commands = [];
  for (let i = 0; i < tokens.length;) {
    const type = tokens[i++];
    const size = type === 'C' ? 6 : 2;
    const values = tokens.slice(i, i + size).map(Number);
    if (!['M', 'L', 'C'].includes(type) || values.length !== size || values.some(Number.isNaN)) {
      throw new Error('Invalid handwriting path');
    }
    commands.push({ type, values });
    i += size;
  }
  return commands;
}

const cubicAt = (a, b, c, d, t) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d;

function cubicExtrema(a, b, c, d) {
  const qa = -a + 3 * b - 3 * c + d;
  const qb = 2 * (a - 2 * b + c);
  const qc = b - a;
  if (Math.abs(qa) < 1e-10) return Math.abs(qb) < 1e-10 ? [] : [-qc / qb].filter((t) => t > 0 && t < 1);
  const discriminant = qb * qb - 4 * qa * qc;
  if (discriminant < 0) return [];
  const root = Math.sqrt(discriminant);
  return [(-qb + root) / (2 * qa), (-qb - root) / (2 * qa)].filter((t) => t > 0 && t < 1);
}

// Use the actual Bézier extrema, so long handles do not shrink or miscentre ink.
function commandBounds(commands) {
  const xs = [], ys = [];
  let x = 0, y = 0;
  for (const { type, values: v } of commands) {
    if (type === 'C') {
      for (const t of cubicExtrema(x, v[0], v[2], v[4])) xs.push(cubicAt(x, v[0], v[2], v[4], t));
      for (const t of cubicExtrema(y, v[1], v[3], v[5])) ys.push(cubicAt(y, v[1], v[3], v[5], t));
      x = v[4]; y = v[5];
    } else {
      x = v[0]; y = v[1];
    }
    xs.push(x); ys.push(y);
  }
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/** No text/font masking: every returned stroke describes the actual pen route. */
export function buildSignature(rawName) {
  const name = normalizeName(rawName);
  if (!isSupportedName(name)) throw new Error('Use English letters and spaces.');
  const strokes = [];
  let cursor = 0;
  for (const [index, character] of [...name].entries()) {
    if (character === ' ') {
      cursor += 26;
      continue;
    }
    const letter = GLYPHS[character];
    // Tiny deterministic baseline variations keep repeated letters from looking stamped.
    const baseline = Math.sin(index * 1.67) * 0.8;
    const stretch = 1 + Math.sin(index * 2.31) * 0.018;
    for (const [strokeIndex, d] of letter.strokes.entries()) {
      const commands = parsePath(d).map(({ type, values }) => ({
        type,
        values: values.map((value, i) => round(i % 2 ? value + baseline : value * stretch + cursor)),
      }));
      const start = { x: commands[0].values[0], y: commands[0].values[1] };
      const last = commands.at(-1).values;
      const end = { x: last.at(-2), y: last.at(-1) };
      const previous = strokes.at(-1);
      // Only join nearby baseline exits. Dots/crossbars and spaces always lift.
      if (strokeIndex === 0 && index > 0 && name[index - 1] !== ' ' && previous?.isMain &&
          Math.hypot(previous.end.x - start.x, previous.end.y - start.y) < 12) {
        const { x, y } = previous.end;
        strokes.push({
          character, isMain: false, isJoin: true, start: { x, y }, end: start,
          d: `M ${x} ${y} C ${x + 3} ${y - 1} ${start.x - 2} ${start.y + 2} ${start.x} ${start.y}`,
          bounds: { minX: Math.min(x, start.x), maxX: Math.max(x, start.x), minY: Math.min(y - 1, start.y), maxY: Math.max(y, start.y + 2) },
        });
      }
      strokes.push({
        character, isMain: strokeIndex === 0, isJoin: false, start, end,
        d: commands.map(({ type, values }) => `${type} ${values.join(' ')}`).join(' '),
        bounds: commandBounds(commands),
      });
    }
    cursor += letter.advance + 3;
  }
  const bounds = {
    minX: Math.min(...strokes.map((stroke) => stroke.bounds.minX)) - STROKE_WIDTH / 2 - 1.5,
    maxX: Math.max(...strokes.map((stroke) => stroke.bounds.maxX)) + STROKE_WIDTH / 2 + 1.5,
    minY: Math.min(...strokes.map((stroke) => stroke.bounds.minY)) - STROKE_WIDTH / 2 - 1.5,
    maxY: Math.max(...strokes.map((stroke) => stroke.bounds.maxY)) + STROKE_WIDTH / 2 + 1.5,
  };
  return { name, strokes, bounds };
}

export function signatureLayout(signature, width, height) {
  const b = signature.bounds;
  const available = width * (width < 600 ? 0.84 : 0.66);
  const scale = Math.min(
    available / (b.maxX - b.minX),
    Math.max(1.12, Math.min(width / 1440 * 2.65, 3.8)),
    height * 0.24 / (b.maxY - b.minY),
  );
  return {
    scale,
    x: width / 2 - (b.minX + b.maxX) / 2 * scale,
    y: height * 0.455 - (b.minY + b.maxY) / 2 * scale,
    width, height,
  };
}

export function toScreen(point, layout) {
  return { x: layout.x + point.x * layout.scale, y: layout.y + point.y * layout.scale };
}

export function idleTip(width, height) {
  return { x: width * (width < 600 ? 0.77 : 0.685), y: height * 0.505 };
}
