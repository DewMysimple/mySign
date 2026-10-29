import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
export const hash = (value) => createHash('sha256').update(value).digest('hex');
export async function readDataset() {
  const manifest = JSON.parse(
      await readFile('public/glyphs/manifest.json', 'utf8')
    ),
    glyphs = [];
  for (const shard of manifest.shards) {
    const bytes = await readFile(`public/glyphs/${shard.file}`);
    if (hash(bytes) !== shard.sha256)
      throw Error(`Shard integrity mismatch: ${shard.file}`);
    glyphs.push(...Object.values(JSON.parse(bytes).glyphs));
  }
  const targets = JSON.parse(
    await readFile('data/glyphs/targets.json', 'utf8')
  ).characters;
  if (
    glyphs.length !== 3500 ||
    new Set(glyphs.map((g) => g.character)).size !== 3500 ||
    [...targets].some((ch) => !glyphs.some((g) => g.character === ch))
  )
    throw Error('The qualified set must equal the 3500 level-one target set');
  const geometryHash = hash(
    JSON.stringify(
      glyphs.map((g) => ({
        character: g.character,
        strokes: g.strokes.map((s) => ({
          outline: s.outline,
          median: s.median,
          maskWidth: s.maskWidth,
          sourceStrokeHash: s.sourceStrokeHash,
          routeHash: s.routeHash,
        })),
      }))
    )
  );
  return { manifest, glyphs, geometryHash };
}
