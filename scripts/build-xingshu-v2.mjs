// Builds ONLY the two experimental drawings. Never writes public/glyphs or its manifest.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parsePath, commandBounds } from '../src/handwriting/signature.js';

import { designs, recommended } from '../data/xingshu/v0.2.0/designs.mjs';
import { validateConnections, connectionReview } from './xingshu-connection-audit.mjs';
for (const [variant, design] of [...Object.entries(designs), ['final', {...structuredClone(designs[recommended]), version:'0.2.0-experimental', recommendedFrom:recommended.toUpperCase()}]]) {
const dataDir = variant === 'final' ? 'data/xingshu/v0.2.0' : `data/xingshu/v0.2.0/candidates/${variant}`;
const artDir = `analysis/xingshu-v2/${variant}/artwork`;
await mkdir(dataDir, {recursive:true});
await mkdir(artDir, {recursive:true});
const source = `${dataDir}/artwork.json`;
const raw = Buffer.from(JSON.stringify(design,null,2)+'\n'), artwork = JSON.parse(raw);
await writeFile(source,raw);
validateConnections(artwork);
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
    modifications: ['Round two: redrawn principal curves and individual pressure profiles, compact left components, removed 亻/女 return threads; only separately approved continuity may remain.', 'Original logical order and all principal strokes retained; no qualified source file overwritten.'],
  };
}
const files = [];
for (const [character, glyph] of Object.entries(glyphs)) {
  const file = character === '你' ? 'ni.json' : 'hao.json';
  const result = { schema: 'shakespread.xingshu.runtime/1', version: artwork.version,
    status: 'experimental-not-qualified-library', source, sourceSHA256: hash(raw), ...glyph };
  const data = JSON.stringify(result) + '\n';
  await writeFile(`${dataDir}/${file}`, data);
  files.push({ character, file, bytes: Buffer.byteLength(data), sha256: hash(data) });
}
await writeFile(`${dataDir}/manifest.json`, JSON.stringify({
  schema: 'shakespread.xingshu.experimental-manifest/1', version: artwork.version,
  status: 'experimental-not-qualified-library', sourceSHA256: hash(raw), files,
}, null, 2) + '\n');
// Distribute source and modifications with the offline preview, under the same
// Arphic license. This is a separate experimental directory, never glyphs/.
const publicDir = variant === 'final' ? 'public/experiments/xingshu-v0.2.0' : null;
if (publicDir) {
await mkdir(publicDir, { recursive: true });
for (const { file } of files)
  await writeFile(`${publicDir}/${file}`, await readFile(`${dataDir}/${file}`));
await writeFile(`${publicDir}/artwork.json`, raw);
await writeFile(`${publicDir}/designs.mjs`, await readFile('data/xingshu/v0.2.0/designs.mjs'));
await writeFile(`${publicDir}/connection-review.json`, JSON.stringify(connectionReview,null,2)+'\n');
await writeFile(`${publicDir}/manifest.json`, await readFile(`${dataDir}/manifest.json`));
await writeFile(`${publicDir}/ARPHICPL.TXT`, await readFile('public/glyphs/ARPHICPL.TXT'));
await writeFile(`${publicDir}/provenance.json`, JSON.stringify({
  status: 'experimental-not-qualified-library', version: artwork.version,
  author: artwork.author, license: artwork.license, licenseFile: 'ARPHICPL.TXT',
  source: 'artwork.json', sourceSHA256: hash(raw), coordinateSystem: artwork.coordinateSystem,
  authoringSource: 'designs.mjs', authoringSHA256: hash(await readFile('data/xingshu/v0.2.0/designs.mjs')),
  modifications: artwork.notice,
  structuralReferences: Object.values(glyphs).map(g => ({character: g.character,
    source: 'Hanzi Writer Data', version: 'npm:2.0.1',
    logicalStrokeHashes: g.logicalStrokes.map(s => s.sourceStrokeHash)})),
  externalFontOutlinesUsed: false,
  visualApproval: 'pending-user-aesthetic-review; no human calligraphy expert certification',
  qualifiedLibrary: 'Unchanged 3500-glyph dataset. Only two separate prototypes are overlaid in this feature build.',
}, null, 2) + '\n');
}
await mkdir(artDir, { recursive: true });
await writeFile(`${artDir}/geometry.json`, JSON.stringify({ version: artwork.version, sourceSHA256: hash(raw), logicalStrokes: 13, segments: geometries.length, checks: 'Build continuity and retained logical order only; browser shape/mask/synchrony tests are separate.', geometries }, null, 2) + '\n');
function sheet(overlay) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="520" viewBox="0 0 1080 520"><rect width="1080" height="520" fill="#f3f3f1"/>` + Object.values(glyphs).map((g, i) => `<g transform="translate(${120 + i * 480} 50) scale(3.8)">` + g.strokes.map(s => `<path d="${s.outline}" fill="#3775be"/>` + (overlay ? `<path d="${s.d}" fill="none" stroke="${s.role === 'connection' ? '#9b51e0' : '#e45e38'}" stroke-width=".28"/><circle cx="${s.start.x}" cy="${s.start.y}" r=".7" fill="#e45e38"/>` : '')).join('') + '</g>').join('') + '</svg>';
}
await writeFile(`${artDir}/nihao.svg`, sheet(false));
await writeFile(`${artDir}/overlay.svg`, sheet(true));
let index = 0;
const strokeSheet = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="640" viewBox="0 0 1200 640"><rect width="1200" height="640" fill="#f3f3f1"/>` + Object.values(glyphs).flatMap(g => g.strokes.map(s => {
  const i = index++, x = 25 + (i % 8) * 148, y = 48 + Math.floor(i / 8) * 280;
  return `<g transform="translate(${x} ${y})"><text font-family="sans-serif" font-size="14" fill="#61655f">${g.character} ${s.logicalStrokeIds[0] || 'thread'} · ${s.visualActionId}</text><g transform="translate(0 15) scale(1.15)">${g.strokes.map(t => `<path d="${t.outline}" fill="#dce1de"/>`).join('')}<path d="${s.outline}" fill="#3775be"/><path d="${s.d}" fill="none" stroke="#e45e38" stroke-width=".3"/></g></g>`;
})).join('') + '</svg>';
await writeFile(`${artDir}/strokes.svg`, strokeSheet);
console.log(JSON.stringify({variant, glyphs:Object.keys(glyphs),logicalStrokes:13,groups:Object.values(glyphs).reduce((s,g)=>s+g.visualActions.length,0),segments:geometries.length,sourceSHA256:hash(raw)}));
}
