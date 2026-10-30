import { GLYPHS } from './glyphs.js';
import { SYMBOLS } from './symbols.js';
import {
  buildSignature,
  commandBounds,
  parsePath,
  signatureLayout,
} from './signature.js';
import manifest from './generated/manifest.json' with { type: 'json' };
import limits from './signatureLimits.json' with { type: 'json' };

// Single-line calibration and boundary evidence is kept separate from 1.1.0.
export const WRITING_BUDGET = Object.freeze(limits);
export const normalizeText = (value) => String(value).replace(/\r\n?/g, '\n');
const segments = (text) =>
  [...new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(text)].map(
    (s) => s.segment
  );
const codePoints = (value) =>
  [...value]
    .map(
      (ch) =>
        `U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`
    )
    .join(' ');

export function validateText(value) {
  const text = normalizeText(value);
  const issues = [];
  for (const [index, character] of segments(text).entries()) {
    if (
      !Object.hasOwn(GLYPHS, character) &&
      !Object.hasOwn(SYMBOLS, character) &&
      !Object.hasOwn(manifest.characters, character) &&
      character !== ' '
    ) {
      issues.push({
        position: index + 1,
        character,
        codePoint: codePoints(character),
        reason:
          ['\n', '\u2028', '\u2029'].includes(character)
            ? '目前只支持单行签名，请移除换行后重试'
            : character === '\t' ? '制表符不支持，请使用空格' : '暂不支持此字符',
      });
    }
  }
  if (!text.trim())
    issues.push({
      position: 1,
      character: '',
      codePoint: '',
      reason: '请输入要书写的内容',
    });
  return {
    text,
    issues,
    chinese: [
      ...new Set(
        [...text].filter((ch) => Object.hasOwn(manifest.characters, ch))
      ),
    ],
  };
}

export class PreflightError extends Error {
  constructor(message, issues = []) {
    super(message);
    this.name = 'PreflightError';
    this.issues = issues;
  }
}
export function assertValidText(value) {
  const result = validateText(value);
  if (result.issues.length)
    throw new PreflightError(
      result.issues
        .map((i) =>
          i.character
            ? `第 ${i.position} 个字符「${i.character === '\n' ? '换行' : i.character}」：${i.reason}`
            : i.reason
        )
        .join('；'),
      result.issues
    );
  const characters = segments(result.text).length;
  if (characters > WRITING_BUDGET.maxCharacters)
    throw new PreflightError(
      `共有 ${characters} 个字符（含空格），超过单行签名 ${WRITING_BUDGET.maxCharacters} 个字符的上限。请缩短内容，原文已保留。`
    );
  const strokes = [...result.text].reduce(
    (sum, ch) =>
      sum +
      (manifest.strokeCounts?.[ch] ||
        GLYPHS[ch]?.strokes.length ||
        SYMBOLS[ch]?.strokes.length ||
        0),
    0
  );
  if (strokes > WRITING_BUDGET.maxStrokes)
    throw new PreflightError(
      `共有至少 ${strokes} 笔，超过当前 ${WRITING_BUDGET.maxStrokes} 笔的安全预算。请缩短签名，原文已保留。`
    );
  return result;
}

function singleLineGlyph(character) {
  const g = SYMBOLS[character];
  return {
    advance: g.advance + 3,
    baseline: 0,
    strokes: g.strokes.map((d) => {
      const commands = parsePath(d),
        last = commands.at(-1).values;
      return {
        d,
        start: { x: commands[0].values[0], y: commands[0].values[1] },
        end: { x: last.at(-2), y: last.at(-1) },
        bounds: commandBounds(commands),
      };
    }),
  };
}

function pathLength(d) {
  let length = 0,
    previous = { x: 0, y: 0 };
  for (const { type, values: v } of parsePath(d)) {
    if (type === 'M') {
      previous = { x: v[0], y: v[1] };
      continue;
    }
    if (type === 'L') {
      length += Math.hypot(v[0] - previous.x, v[1] - previous.y);
      previous = { x: v[0], y: v[1] };
      continue;
    }
    const start = { ...previous };
    for (let i = 1; i <= 24; i++) {
      const t = i / 24,
        u = 1 - t;
      const next = {
        x:
          u ** 3 * start.x +
          3 * u * u * t * v[0] +
          3 * u * t * t * v[2] +
          t ** 3 * v[4],
        y:
          u ** 3 * start.y +
          3 * u * u * t * v[1] +
          3 * u * t * t * v[3] +
          t ** 3 * v[5],
      };
      length += Math.hypot(next.x - previous.x, next.y - previous.y);
      previous = next;
    }
  }
  return length;
}

function tokensFor(text, glyphs) {
  const tokens = [];
  const chunks = text.match(/[A-Za-z]+|[^A-Za-z]/gu) || [];
  let characterIndex = 0;
  const english = (word) => {
    const model = buildSignature(word);
    return {
      text: word,
      advance: [...word].reduce((a, ch) => a + GLYPHS[ch].advance + 3, 0),
      strokes: model.strokes,
      engine: 'latin',
      index: characterIndex,
    };
  };
  for (const chunk of chunks) {
    if (/^[A-Za-z]+$/.test(chunk)) {
      const token = english(chunk);
      tokens.push(token);
      characterIndex += chunk.length;
    } else if (chunk === ' ') {
      tokens.push({
        text: chunk,
        advance: 26,
        strokes: [],
        index: characterIndex++,
      });
    } else if (Object.hasOwn(SYMBOLS, chunk)) {
      tokens.push({
        ...singleLineGlyph(chunk),
        text: chunk,
        engine: 'symbol',
        index: characterIndex++,
      });
    } else {
      const g = glyphs.get(chunk);
      if (!g) throw new PreflightError(`字形「${chunk}」加载不完整，请重试`);
      tokens.push({
        text: chunk,
        index: characterIndex++,
        advance: g.advance + 5,
        engine: 'hanzi',
        glyph: g,
        strokes: g.strokes.map((s, strokeIndex) => ({
          ...s,
          style: g.style || 'standard',
          prototypeVersion: g.style ? g.version : null,
          logicalStrokeIds: s.logicalStrokeIds || [strokeIndex + 1],
          logicalRecords: g.logicalStrokes || null,
          visualActionId: s.visualActionId || `standard-${strokeIndex + 1}`,
          d: s.d || s.median
              .map(([x, y], i) => `${i ? 'L' : 'M'} ${x} ${y}`)
              .join(' '),
          start: { x: s.median[0][0], y: s.median[0][1] },
          end: { x: s.median.at(-1)[0], y: s.median.at(-1)[1] },
          bounds: {
            minX: s.bounds[0],
            minY: s.bounds[1],
            maxX: s.bounds[2],
            maxY: s.bounds[3],
          },
        })),
      });
    }
  }
  return tokens;
}

export function buildWritingPlan(
  text,
  glyphs,
  width,
  height,
  budget = WRITING_BUDGET
) {
  assertValidText(text);
  // Exactly preserve the proven English geometry and timing for canonical names.
  const original = /^[A-Za-z]+(?: [A-Za-z]+)*$/.test(text)
    ? buildSignature(text)
    : null;
  const legacy = Boolean(original);
  let model;
  if (legacy) {
    model = { ...original, legacy: true, lines: [text] };
    model.strokes = model.strokes.map((s) => ({
      ...s,
      engine: 'latin',
      line: 0,
      offset: { x: 0, y: 0 },
    }));
  } else {
    const lines = [tokensFor(text, glyphs)];
    const strokes = [],
      rowWidths = lines.map((row) => row.reduce((s, t) => s + t.advance, 0));
    const fullWidth = Math.max(...rowWidths, 1);
    lines.forEach((line, row) => {
      let x = (fullWidth - rowWidths[row]) / 2;
      for (const token of line) {
        const offset = {
          x,
          y: token.engine === 'hanzi' ? -token.glyph.baseline : 0,
        };
        for (const s of token.strokes) {
          const b = s.bounds;
          strokes.push({
            ...s,
            character: token.text,
            characterIndex: token.index,
            line: row,
            engine: token.engine,
            offset: { ...offset },
            start: { x: s.start.x + offset.x, y: s.start.y + offset.y },
            end: { x: s.end.x + offset.x, y: s.end.y + offset.y },
            bounds: {
              minX: b.minX + offset.x,
              maxX: b.maxX + offset.x,
              minY: b.minY + offset.y,
              maxY: b.maxY + offset.y,
            },
          });
        }
        x += token.advance;
      }
    });
    if (!strokes.length) throw new PreflightError('没有可以书写的笔画');
    model = {
      name: text,
      strokes,
      legacy: false,
      lines: lines.map((row) => row.map((t) => t.text).join('')),
      bounds: {
        minX: Math.min(0, ...strokes.map((s) => s.bounds.minX)) - 4,
        maxX: Math.max(fullWidth, ...strokes.map((s) => s.bounds.maxX)) + 4,
        minY: Math.min(-88, ...strokes.map((s) => s.bounds.minY)) - 4,
        maxY: Math.max(20, ...strokes.map((s) => s.bounds.maxY)) + 4,
      },
    };
  }
  if (model.strokes.length > budget.maxStrokes)
    throw new PreflightError(
      `共有 ${model.strokes.length} 段墨迹动作（含牵丝），超过当前 ${budget.maxStrokes} 段的安全预算。请缩短签名，原文已保留。`
    );
  const logical = new Map();
  const visual = new Map();
  for (const [index, s] of model.strokes.entries()) {
    if (s.engine !== 'hanzi') continue;
    const key = `${s.characterIndex}:${s.visualActionId}`;
    if (!visual.has(key)) visual.set(key, {
      id: key, character: s.character, segmentIndices: [], logicalStrokeIds: [],
    });
    const group = visual.get(key);
    group.segmentIndices.push(index);
    for (const id of s.logicalStrokeIds) {
      const logicalKey = `${s.characterIndex}:${id}`;
      group.logicalStrokeIds.push(logicalKey);
      logical.set(logicalKey, {
        ...(s.logicalRecords?.[id - 1] || {
          originalNumber: id, sourceStrokeHash: s.sourceStrokeHash,
        }),
        id: logicalKey, character: s.character,
        characterPosition: s.characterIndex + 1,
      });
    }
  }
  model.logicalStrokes = [...logical.values()];
  model.visualActions = [...visual.values()];
  model.prototypeCharacters = [...new Set(model.strokes
    .filter(s => s.prototypeVersion).map(s => s.character))];
  model.actions = [{ type: 'approach', duration: 0.66 }];
  for (const [i, s] of model.strokes.entries()) {
    const previous = model.strokes[i - 1];
    if (
      previous &&
      Math.hypot(previous.end.x - s.start.x, previous.end.y - s.start.y) > 0.5
    ) {
      const kind =
        s.characterIndex !== previous.characterIndex ||
        s.character !== previous.character ? 'character-move' : 'lift';
      model.actions.push({
        type: kind,
        index: i,
        duration: kind === 'character-move' ? 0.12 : 0.065,
      });
    }
    model.actions.push({
      type: 'stroke',
      index: i,
      visualActionId: s.visualActionId,
      rhythm: s.rhythm,
      duration:
        s.prototypeVersion
          ? Math.max(0.035, Math.min(0.85, s.length * s.pace))
          : s.engine === 'hanzi' ? Math.max(
              0.065,
              Math.min(0.6, s.length * 0.008 + (s.complexity || 0) * 0.012)
            )
          : Math.max(0.045, Math.min(0.85, pathLength(s.d) * 0.0036)),
    });
  }
  model.actions.push({ type: 'settle', duration: 0 });
  model.clearActions = [
    { type: 'erase', duration: 1.3 },
    { type: 'particles', duration: 1.3 },
    { type: 'return', duration: 1.12 },
  ];
  model.estimatedSeconds = model.legacy
    ? Math.min(14, Math.max(1.35, text.replaceAll(' ', '').length * 0.68)) +
      0.66 +
      model.strokes.length * 0.1
    : model.actions.reduce((s, a) => s + a.duration, 0);
  if (model.estimatedSeconds > budget.maxSeconds)
    throw new PreflightError(
      `预计书写约 ${Math.ceil(model.estimatedSeconds)} 秒，超过当前 ${budget.maxSeconds} 秒的安全时长。请缩短签名，原文已保留。`
    );
  const layout = writingLayout(model, width, height);
  if (layout.scale < budget.minScale)
    throw new PreflightError(
      '单行可用宽度不足，继续缩小将影响辨认。请缩短签名或扩大窗口，原文已保留。'
    );
  return model;
}

export function writingLayout(model, width, height) {
  if (model.legacy) return signatureLayout(model, width, height);
  const b = model.bounds;
  const scale = Math.min(
    (width * (width < 600 ? 0.84 : 0.66)) / (b.maxX - b.minX),
    (height * 0.48) / (b.maxY - b.minY),
    width < 600 ? 1.05 : 1.65
  );
  return {
    scale,
    x: width / 2 - ((b.minX + b.maxX) / 2) * scale,
    y: height * 0.435 - ((b.minY + b.maxY) / 2) * scale,
    width,
    height,
  };
}
