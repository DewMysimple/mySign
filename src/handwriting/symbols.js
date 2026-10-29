// Original pen-centre paths. Writing order is explicit, as for the English engine.
const glyph = (advance, ...strokes) => ({ advance, strokes });
const dot = (x, y) => `M ${x} ${y} L ${x + 0.6} ${y - 0.8}`;
const comma = 'M 8 -2 C 11 -1 9 6 5 9';
const question = [
  'M 2 -52 C 5 -73 35 -74 36 -55 C 37 -42 17 -38 18 -23',
  dot(18, -3),
];
const exclamation = ['M 11 -70 L 8 -24', dot(8, -3)];
const leftParen = 'M 22 -75 C 1 -54 -3 -23 10 8';
const rightParen = 'M 4 -75 C 20 -54 15 -23 -2 8';
const quoteLeft = (x) => `M ${x + 7} -76 C ${x} -71 ${x - 2} -65 ${x + 2} -63`;
const quoteRight = (x) =>
  `M ${x + 4} -76 C ${x + 7} -70 ${x + 3} -64 ${x - 1} -62`;

export const SYMBOLS = Object.freeze({
  0: glyph(42, 'M 27 -69 C 5 -74 -8 -8 12 -1 C 35 8 52 -63 27 -69'),
  1: glyph(27, 'M 1 -54 L 23 -70 L 7 -1', 'M -2 0 L 23 0'),
  2: glyph(43, 'M 1 -54 C 9 -81 50 -75 36 -48 C 30 -36 9 -13 -2 -1 L 37 -1'),
  3: glyph(
    42,
    'M 0 -60 C 20 -80 50 -72 33 -48 C 29 -43 20 -39 13 -37 C 43 -45 44 -9 19 -1 C 8 3 0 0 -3 -5'
  ),
  4: glyph(44, 'M 30 -71 L 0 -24 L 41 -24', 'M 36 -71 L 18 0'),
  5: glyph(
    42,
    'M 42 -69 L 12 -69 L 3 -38 C 30 -50 48 -28 28 -7 C 18 4 1 2 -4 -7'
  ),
  6: glyph(
    44,
    'M 40 -67 C 18 -81 -4 -35 2 -10 C 10 14 44 -4 38 -26 C 34 -42 13 -41 3 -23'
  ),
  7: glyph(42, 'M 1 -69 L 43 -69 C 29 -48 13 -21 7 0'),
  8: glyph(
    44,
    'M 21 -39 C -3 -49 8 -74 29 -69 C 53 -61 23 -37 11 -29 C -15 -9 12 11 31 -4 C 57 -23 29 -36 21 -39'
  ),
  9: glyph(
    44,
    'M 38 -49 C 47 -77 13 -79 3 -54 C -7 -25 22 -23 36 -44 C 31 -22 17 -1 0 3'
  ),
  '.': glyph(15, dot(5, -2)),
  ',': glyph(17, comma),
  ':': glyph(17, dot(8, -36), dot(6, -2)),
  ';': glyph(17, dot(8, -36), comma),
  '?': glyph(44, ...question),
  '!': glyph(22, ...exclamation),
  "'": glyph(15, quoteRight(3)),
  '"': glyph(26, quoteRight(3), quoteRight(15)),
  '-': glyph(32, 'M 2 -28 L 29 -29'),
  _: glyph(44, 'M 0 8 L 41 8'),
  '(': glyph(27, leftParen),
  ')': glyph(27, rightParen),
  '[': glyph(25, 'M 23 -73 L 9 -73 L -1 7 L 13 7'),
  ']': glyph(25, 'M 5 -73 L 19 -73 L 9 7 L -5 7'),
  '/': glyph(34, 'M 33 -73 L -2 7'),
  '+': glyph(40, 'M 3 -31 L 37 -31', 'M 23 -53 L 17 -10'),
  '=': glyph(40, 'M 3 -40 L 37 -40', 'M 1 -22 L 35 -22'),
  '，': glyph(50, comma),
  '。': glyph(50, 'M 13 -9 C -1 -12 -4 5 7 5 C 18 5 21 -8 13 -9'),
  '、': glyph(50, 'M 6 -13 C 11 -10 17 -5 20 0'),
  '？': glyph(70, ...question),
  '！': glyph(50, ...exclamation),
  '；': glyph(50, dot(8, -36), comma),
  '：': glyph(50, dot(8, -36), dot(6, -2)),
  '“': glyph(40, quoteLeft(5), quoteLeft(20)),
  '”': glyph(40, quoteRight(5), quoteRight(20)),
  '‘': glyph(30, quoteLeft(5)),
  '’': glyph(30, quoteRight(5)),
  '（': glyph(40, leftParen),
  '）': glyph(40, rightParen),
  '《': glyph(50, 'M 28 -70 L 7 -35 L 20 0', 'M 43 -70 L 22 -35 L 35 0'),
  '》': glyph(50, 'M 8 -70 L 21 -35 L 0 0', 'M 23 -70 L 36 -35 L 15 0'),
  '〈': glyph(35, 'M 28 -70 L 7 -35 L 20 0'),
  '〉': glyph(35, 'M 8 -70 L 21 -35 L 0 0'),
  '…': glyph(60, dot(8, -25), dot(27, -25), dot(46, -25)),
  '—': glyph(100, 'M 4 -34 L 96 -34'),
});

export const NO_LINE_START = new Set([...',.!?:;)]，。、？！；：”’）》〉…']);
export const NO_LINE_END = new Set([...'([（“‘《〈']);
