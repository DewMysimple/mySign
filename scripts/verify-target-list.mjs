import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const revision = '6f6538e0ecc780c3e73d1c12ca3c7ba91fee82e1',
  file = '通用规范汉字表(2013)一级字表(3500字).txt';
const cached = 'analysis/chinese/source-cache/independent-target.txt';
await mkdir('analysis/chinese/source-cache', { recursive: true });
let bytes;
try {
  bytes = await readFile(cached);
} catch {
  const response = await fetch(
    `https://api.github.com/repos/lqfeng/ChineseCharacters/contents/${encodeURIComponent(file)}?ref=${revision}`,
    {
      headers: { Accept: 'application/vnd.github.raw+json' },
      signal: AbortSignal.timeout(30000),
    }
  );
  if (!response.ok) throw Error(response.status);
  bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(cached, bytes);
}
const expectedHash =
    '4aac5efd4e149898e00829b16394e7c74aa2d78b7382ed2a069cbf69bf188858',
  rawSha256 = createHash('sha256').update(bytes).digest('hex');
if (rawSha256 !== expectedHash)
  throw Error('Second transcription revision/hash mismatch');
// This source is explicitly a three-column TSV: serial, Han character, pinyin.
const records = bytes
  .toString('utf8')
  .replace(/^\uFEFF/, '')
  .trim()
  .split(/\r?\n/)
  .map((line, index) => {
    const match = /^(\d{4})\t(\p{Script=Han})\t(.+)$/u.exec(line);
    if (!match || Number(match[1]) !== index + 1)
      throw Error(`Unexpected source record ${index + 1}`);
    return match[2];
  });
const text = records.join(''),
  targets = JSON.parse(
    await readFile('data/glyphs/targets.json', 'utf8')
  ).characters,
  set = new Set(records);
const missing = [...targets].filter((c) => !set.has(c)),
  extra = [...set].filter((c) => !targets.includes(c));
const report = {
  repository: 'https://github.com/lqfeng/ChineseCharacters',
  revision,
  path: file,
  rawSha256,
  parser: 'strict sequential serial / Han / pinyin TSV',
  characters: records.length,
  unique: set.size,
  orderedEqual: text === targets,
  missing,
  extra,
  pass: set.size === 3500 && text === targets,
};
await writeFile(
  'analysis/chinese/target-crosscheck.json',
  JSON.stringify(report, null, 2) + '\n'
);
console.log(JSON.stringify(report));
if (!report.pass) process.exitCode = 1;
