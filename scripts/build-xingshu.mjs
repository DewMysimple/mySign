// Builds ONLY the two experimental drawings. Never writes public/glyphs or its manifest.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parsePath, commandBounds } from '../src/handwriting/signature.js';

const source = 'data/xingshu/v0.1.0/artwork.json';
const raw = await readFile(source), artwork = JSON.parse(raw);
const manifest = JSON.parse(await readFile('public/glyphs/manifest.json', 'utf8'));
const round = n => Math.round(n * 10000) / 10000;
const hash = value => createHash('sha256').update(value).digest('hex');
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function sampleCurve(d) {
  const commands = parsePath(d), dense = [];
  let previous;
  for (const { type, values: v } of commands) {
    if (type === 'M') { previous = { x: v[0], y: v[1] }; dense.push(previous); continue; }
    if (type !== 'C') throw new Error('Only independently authored M/C pen routes are accepted');
    const start = previous;
    for (let i = 1; i <= 512; i++) {
      const t = i / 512, u = 1 - t;
      previous = { x: u ** 3 * start.x + 3 * u * u * t * v[0] + 3 * u * t * t * v[2] + t ** 3 * v[4],
        y: u ** 3 * start.y + 3 * u * u * t * v[1] + 3 * u * t * t * v[3] + t ** 3 * v[5] };
      dense.push(previous);
    }
  }
  let total = 0;
  const cumulative = [0];
  for (let i = 1; i < dense.length; i++) { total += distance(dense[i], dense[i - 1]); cumulative.push(total); }
  const points = [], count = Math.ceil(total / 0.23);
  let j = 1;
  for (let i = 0; i <= count; i++) {
    const at = total * i / count;
    while (j < dense.length - 1 && cumulative[j] < at) j++;
    const f = (at - cumulative[j - 1]) / Math.max(1e-12, cumulative[j] - cumulative[j - 1]);
    points.push({ x: dense[j - 1].x + (dense[j].x - dense[j - 1].x) * f, y: dense[j - 1].y + (dense[j].y - dense[j - 1].y) * f });
  }
  return { points, total };
}
function pressure(profile, p) {
  let i = 1;
  while (i < profile.length - 1 && profile[i][0] < p) i++;
  const [a, wa] = profile[i - 1], [b, wb] = profile[i];
  const f = (1 - Math.cos(Math.PI * (p - a) / (b - a))) / 2;
  return wa + (wb - wa) * f;
}
function envelope(points, profile) {
  const left = [], right = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i], a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    const length = distance(a, b), nx = -(b.y - a.y) / length, ny = (b.x - a.x) / length;
    const r = pressure(profile, i / (points.length - 1)) / 2;
    left.push({ x: p.x + nx * r, y: p.y + ny * r });
    right.push({ x: p.x - nx * r, y: p.y - ny * r });
  }
  const polygon = [...left, ...right.reverse()];
  return { polygon, outline: polygon.map((p, i) => `${i ? 'L' : 'M'} ${round(p.x)} ${round(p.y)}`).join(' ') + ' Z' };
}
const glyphs = {}, geometries = [];
for (const [character, input] of Object.entries(artwork.glyphs)) {
  const shard = JSON.parse(await readFile(`public/glyphs/${manifest.shards[manifest.characters[character]].file}`, 'utf8'));
  const original = shard.glyphs[character];
  if (original.strokes.length !== input.logicalStrokes.length) throw new Error('Logical stroke count must be retained');
  const logicalStrokes = input.logicalStrokes.map(({ path, width, rhythm, pace, ...s }, i) => ({
    ...s, originalNumber: i + 1, source: 'Hanzi Writer Data', version: 'npm:2.0.1',
    sourceStrokeHash: original.strokes[i].sourceStrokeHash, structure: s.component,
    omission: false, orderChanged: false,
  }));
  const strokes = [], groups = new Map();
  function add(s, logicalId, connection = null) {
    const { points, total } = sampleCurve(s.path), { polygon, outline } = envelope(points, s.width);
    const bounds = { minX: Math.min(...polygon.map(p => p.x)), minY: Math.min(...polygon.map(p => p.y)), maxX: Math.max(...polygon.map(p => p.x)), maxY: Math.max(...polygon.map(p => p.y)) };
    const segmentId = `${character.codePointAt(0).toString(16)}-${strokes.length + 1}`;
    const stroke = {
      segmentId, logicalStrokeIds: logicalId ? [logicalId] : [], visualActionId: s.group,
      role: connection ? 'connection' : 'logical-stroke', connection,
      outline, d: s.path, median: points.map(p => [round(p.x), round(p.y)]),
      start: points[0], end: points.at(-1), bounds: Object.values(bounds).map(round),
      length: round(total), maskWidth: Math.max(...s.width.map(p => p[1])) + 0.3,
      pressure: s.width, entry: s.entry || 'continuous thread', exit: s.exit || 'continuous thread',
      rhythm: s.rhythm || [[0,0],[1,1]], pace: s.pace,
      source: 'independently authored cubic route and pressure envelope',
    };
    strokes.push(stroke);
    if (!groups.has(s.group)) groups.set(s.group, { id: s.group, logicalStrokeIds: [], segmentIds: [], contact: 'continuous' });
    const group = groups.get(s.group);
    if (logicalId) group.logicalStrokeIds.push(logicalId);
    group.segmentIds.push(segmentId);
    geometries.push({ character, segmentId, logicalStrokeIds: stroke.logicalStrokeIds, role: stroke.role, length: stroke.length, bounds: stroke.bounds });
  }
  for (const s of input.logicalStrokes) {
    add(s, s.id);
    const connection = input.connections.find(c => c.from === s.id);
    if (connection) add(connection, null, { from: connection.from, to: connection.to, intent: connection.intent });
  }
  for (let i = 1; i < strokes.length; i++) {
    if (strokes[i].visualActionId === strokes[i - 1].visualActionId && distance(strokes[i - 1].end, strokes[i].start) > 0.001)
      throw new Error(`Discontinuous contact group ${character} ${i}`);
  }
  glyphs[character] = {
    character, codePoint: `U+${character.codePointAt(0).toString(16).toUpperCase()}`,
    version: artwork.version, style: 'hard-pen-running-script', quality: 'experimental-awaiting-visual-review',
    license: artwork.license, source: artwork.author, baseline: input.baseline, advance: input.advance,
    bounds: [Math.min(...strokes.map(s => s.bounds[0])), Math.min(...strokes.map(s => s.bounds[1])), Math.max(...strokes.map(s => s.bounds[2])), Math.max(...strokes.map(s => s.bounds[3]))],
    components: input.components, logicalStrokes, visualActions: [...groups.values()], strokes,
    omittedLogicalStrokes: input.omittedLogicalStrokes, orderChanges: input.orderChanges,
    modifications: ['New structural proportions, curved stroke routes, independently authored entry/exit envelopes and fine contact bridges.', 'Original logical order and all principal strokes retained; no qualified source file overwritten.'],
  };
}
const files = [];
for (const [character, glyph] of Object.entries(glyphs)) {
  const file = character === '你' ? 'ni.json' : 'hao.json';
  const result = { schema: 'shakespread.xingshu.runtime/1', version: artwork.version,
    status: 'experimental-not-qualified-library', source, sourceSHA256: hash(raw), ...glyph };
  const data = JSON.stringify(result) + '\n';
  await writeFile(`data/xingshu/v0.1.0/${file}`, data);
  files.push({ character, file, bytes: Buffer.byteLength(data), sha256: hash(data) });
}
await writeFile('data/xingshu/v0.1.0/manifest.json', JSON.stringify({
  schema: 'shakespread.xingshu.experimental-manifest/1', version: artwork.version,
  status: 'experimental-not-qualified-library', sourceSHA256: hash(raw), files,
}, null, 2) + '\n');
// Distribute source and modifications with the offline preview, under the same
// Arphic license. This is a separate experimental directory, never glyphs/.
const publicDir = 'public/experiments/xingshu-v0.1.0';
await mkdir(publicDir, { recursive: true });
for (const { file } of files)
  await writeFile(`${publicDir}/${file}`, await readFile(`data/xingshu/v0.1.0/${file}`));
await writeFile(`${publicDir}/artwork.json`, raw);
await writeFile(`${publicDir}/manifest.json`, await readFile('data/xingshu/v0.1.0/manifest.json'));
await writeFile(`${publicDir}/ARPHICPL.TXT`, await readFile('public/glyphs/ARPHICPL.TXT'));
await writeFile(`${publicDir}/provenance.json`, JSON.stringify({
  status: 'experimental-not-qualified-library', version: artwork.version,
  author: artwork.author, license: artwork.license, licenseFile: 'ARPHICPL.TXT',
  source: 'artwork.json', sourceSHA256: hash(raw), coordinateSystem: artwork.coordinateSystem,
  modifications: artwork.notice,
  structuralReferences: Object.values(glyphs).map(g => ({character: g.character,
    source: 'Hanzi Writer Data', version: 'npm:2.0.1',
    logicalStrokeHashes: g.logicalStrokes.map(s => s.sourceStrokeHash)})),
  externalFontOutlinesUsed: false,
  visualApproval: 'pending-user-aesthetic-review; no human calligraphy expert certification',
  qualifiedLibrary: 'Unchanged 3500-glyph dataset. Only two separate prototypes are overlaid in this feature build.',
}, null, 2) + '\n');
await mkdir('analysis/xingshu/artwork', { recursive: true });
await writeFile('analysis/xingshu/artwork/geometry.json', JSON.stringify({ version: artwork.version, sourceSHA256: hash(raw), logicalStrokes: 13, segments: geometries.length, checks: 'Build continuity and retained logical order only; browser shape/mask/synchrony tests are separate.', geometries }, null, 2) + '\n');
function sheet(overlay) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="520" viewBox="0 0 1080 520"><rect width="1080" height="520" fill="#f3f3f1"/>` + Object.values(glyphs).map((g, i) => `<g transform="translate(${120 + i * 480} 50) scale(3.8)">` + g.strokes.map(s => `<path d="${s.outline}" fill="#3775be"/>` + (overlay ? `<path d="${s.d}" fill="none" stroke="${s.role === 'connection' ? '#9b51e0' : '#e45e38'}" stroke-width=".28"/><circle cx="${s.start.x}" cy="${s.start.y}" r=".7" fill="#e45e38"/>` : '')).join('') + '</g>').join('') + '</svg>';
}
await writeFile('analysis/xingshu/artwork/nihao.svg', sheet(false));
await writeFile('analysis/xingshu/artwork/overlay.svg', sheet(true));
let index = 0;
const strokeSheet = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="640" viewBox="0 0 1200 640"><rect width="1200" height="640" fill="#f3f3f1"/>` + Object.values(glyphs).flatMap(g => g.strokes.map(s => {
  const i = index++, x = 25 + (i % 8) * 148, y = 48 + Math.floor(i / 8) * 280;
  return `<g transform="translate(${x} ${y})"><text font-family="sans-serif" font-size="14" fill="#61655f">${g.character} ${s.logicalStrokeIds[0] || 'thread'} · ${s.visualActionId}</text><g transform="translate(0 15) scale(1.15)">${g.strokes.map(t => `<path d="${t.outline}" fill="#dce1de"/>`).join('')}<path d="${s.outline}" fill="#3775be"/><path d="${s.d}" fill="none" stroke="#e45e38" stroke-width=".3"/></g></g>`;
})).join('') + '</svg>';
await writeFile('analysis/xingshu/artwork/strokes.svg', strokeSheet);
// Eight pen-form studies extracted from the two actual drawings. These are
// documentation, not new glyphs or extra logical strokes in the runtime plan.
const studySpecs = [
  ['横','好',6],['竖','你',2],['撇','你',1],['捺势','好',1],
  ['点','你',7],['提','好',3],['折','好',4],['钩','你',5],
];
const studies = studySpecs.map(([kind, character, id]) => {
  const s = artwork.glyphs[character].logicalStrokes.find(s => s.id === id);
  let d = s.path, profile = s.width;
  const note = kind === '捺势'
    ? 'Derived from the descending dot-tail of 女 stroke 1. A pen-form study, not a new logical 捺 or independently certified standard na stroke.'
    : 'Extracted from the actual two-character prototype.';
  if (kind === '捺势') {
    d = 'M 20 53 C 27 57 36 64 41 70';
    const full = sampleCurve(s.path).total, tail = sampleCurve(d).total, start = 1 - tail / full;
    profile = Array.from({length:21},(_,i)=>[i/20,round(pressure(s.width,start+(1-start)*i/20))]);
  }
  const route = sampleCurve(d), shape = envelope(route.points,profile);
  return {kind, character, logicalStrokeId:id, note, entry:s.entry, course:d,
    pressure:profile, turning:kind==='折'||kind==='钩'?'authored curved turn with a local pressure maximum':'continuous cubic course',
    exit:s.exit, d, outline:shape.outline, median:route.points.map(p=>[round(p.x),round(p.y)]),
    length:round(route.total), start:route.points[0],end:route.points.at(-1)};
});
await writeFile('data/xingshu/v0.1.0/stroke-studies.json',JSON.stringify({
  status:'visual-studies-not-registered-glyphs',sourceSHA256:hash(raw),studies,
})+'\n');
await writeFile('analysis/xingshu/artwork/basic-strokes.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="560" viewBox="0 0 1120 560"><rect width="1120" height="560" fill="#f3f3f1"/>${studies.map((s,i)=>`<g transform="translate(${i%4*280+24} ${Math.floor(i/4)*280+32})"><text font-family="sans-serif" font-size="16" fill="#61655f">${s.kind} · ${s.character} ${s.logicalStrokeId}${s.kind==='捺势'?' 斜点末段':''}</text><g transform="translate(10 16) scale(2)"><path d="${s.outline}" fill="#3775be"/><path d="${s.d}" fill="none" stroke="#e45e38" stroke-width=".18"/></g></g>`).join('')}</svg>`);
console.log(JSON.stringify({ glyphs: Object.keys(glyphs), logicalStrokes: 13, segments: geometries.length, sourceSHA256: hash(raw) }));
