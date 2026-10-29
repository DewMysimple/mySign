import { readFile, writeFile } from 'node:fs/promises';
import { readDataset, hash } from './glyph-dataset.mjs';
const { manifest, glyphs, geometryHash } = await readDataset();
const read = async (file) => JSON.parse(await readFile(file, 'utf8'));
const geometry = await read('analysis/chinese/glyph-quality.json'),
  masks = await read('analysis/chinese/masks/coverage.json'),
  atlas = await read('analysis/chinese/atlas-review.json'),
  animation = await read('analysis/chinese/performance/calibration.json');
if (geometry.geometryPassed !== 3500 || geometry.quarantined.length)
  throw Error('Geometry gate failed');
if (
  !masks.pass ||
  masks.glyphCount !== 3500 ||
  masks.datasetGeometrySHA256 !== geometryHash ||
  masks.rendererSHA256 !==
    hash(await readFile('src/handwriting/inkRenderer.js'))
)
  throw Error('Actual SVG renderer gate is missing, stale or failed');
if (
  atlas.status !== 'completed' ||
  atlas.reviewedGlyphs !== 3500 ||
  atlas.pages.length !== 35
)
  throw Error('Full atlas review is incomplete');
for (const p of atlas.pages)
  if (hash(await readFile(`analysis/chinese/${p.file}`)) !== p.sha256)
    throw Error(`Stale atlas review ${p.file}`);
if (
  animation.errors.length ||
  animation.results.length < 7 ||
  animation.results.some((r) => r.maxErrorPx > 0.2) ||
  !animation.results.some((r) => r.text.includes('盼'))
)
  throw Error('Representative animation gate failed');
const before = geometryHash;
for (const shard of manifest.shards) {
  const file = `public/glyphs/${shard.file}`,
    data = await read(file);
  if (!data.notice.includes('Glyph geometry,'))
    data.notice +=
      ' Glyph geometry, full-atlas visual review and representative synchronized animations qualified on 2026-10-30; see qualification.json. This is not a human expert certificate.';
  for (const g of Object.values(data.glyphs)) {
    g.quality = 'qualified';
    g.review = 'full-atlas-reviewed-by-Codex';
    g.qualification = {
      date: '2026-10-30',
      geometry: 'passed',
      actualSvg: 'passed',
      atlas: 'reviewed',
      animation: 'representative-sampled',
      evidence: 'qualification.json',
    };
  }
  const bytes = Buffer.from(JSON.stringify(data) + '\n');
  await writeFile(file, bytes);
  shard.bytes = bytes.length;
  shard.sha256 = hash(bytes);
}
manifest.quality = 'qualified';
manifest.qualifiedCount = 3500;
manifest.datasetGeometrySHA256 = before;
await writeFile('public/glyphs/manifest.json', JSON.stringify(manifest) + '\n');
await writeFile(
  'src/handwriting/generated/manifest.json',
  JSON.stringify(manifest) + '\n'
);
const after = await readDataset();
if (after.geometryHash !== before)
  throw Error(
    'Qualification must not alter any geometry, route or stroke order'
  );
await writeFile(
  'public/glyphs/qualification.json',
  JSON.stringify(
    {
      schema: 1,
      date: '2026-10-30',
      targetCount: 3500,
      qualifiedCount: 3500,
      temporarilyUnsupportedTargets: 0,
      datasetGeometrySHA256: before,
      scope:
        'glyph data qualification; complete application release gates are separate',
      reviewer:
        'Codex visual inspection; no claim of human expert certification',
      evidence: {
        geometry: 'analysis/chinese/glyph-quality.json',
        svg: 'analysis/chinese/masks/coverage.json',
        atlas: 'analysis/chinese/atlas-review.json',
        animation: 'analysis/chinese/performance/calibration.json',
      },
    },
    null,
    2
  ) + '\n'
);
console.log(
  JSON.stringify({
    qualified: 3500,
    geometryUnchanged: true,
    datasetGeometrySHA256: before,
  })
);
