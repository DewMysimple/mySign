import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const run = promisify(execFile);
const root = fileURLToPath(
  new URL('../analysis/chinese/source-cache/', import.meta.url)
);
const mmh = `${root}/mmh`,
  hwd = `${root}/hwd-npm`;
const revision = 'bddc96d41bef78427ed0e034e9f7e31d71fd1b92';
const integrity =
  'nbQwM+MaryGoq7pBMIZLCd3lFq03nXuJuwku1+6UbjL58uU+9OULVcMkoNvNuJSoIV7f1bbPRfD4D/LQa5S7qg==';
await mkdir(root, { recursive: true });

async function asset(file, url) {
  if (existsSync(`${root}/${file}`)) return readFile(`${root}/${file}`);
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github.raw+json',
      'User-Agent': 'Shakespread-build',
    },
    signal: AbortSignal.timeout(180000),
  });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(`${root}/${file}`, bytes);
  console.log(`${file}: ${bytes.length} bytes`);
  return bytes;
}
// Build time only. The shipped application never contacts these hosts.
await Promise.all([
  (async () => {
    const bytes = await asset(
      'hanzi-writer-data-2.0.1.tgz',
      'https://registry.npmjs.org/hanzi-writer-data/-/hanzi-writer-data-2.0.1.tgz'
    );
    if (createHash('sha512').update(bytes).digest('base64') !== integrity)
      throw new Error('Hanzi Writer package integrity mismatch');
    await mkdir(hwd, { recursive: true });
    await run(process.env.PYTHON || 'python', [
      '-c',
      'import sys,tarfile; tarfile.open(sys.argv[1]).extractall(sys.argv[2], filter="data")',
      `${root}/hanzi-writer-data-2.0.1.tgz`,
      hwd,
    ]);
    console.log('Hanzi Writer Data 2.0.1 integrity verified and extracted');
  })(),
  asset(
    'level-1.txt',
    'https://api.github.com/repos/shengdoushi/common-standard-chinese-characters-table/contents/level-1.txt?ref=d9b599a9c9cc0dd2d58cad829e285bc780cd4451'
  ),
  (async () => {
    if (!existsSync(`${mmh}/.git`)) {
      await mkdir(mmh, { recursive: true });
      await run('git', ['init'], { cwd: mmh });
      await run(
        'git',
        [
          'remote',
          'add',
          'origin',
          'https://github.com/skishore/makemeahanzi.git',
        ],
        { cwd: mmh }
      );
      await run(
        'git',
        ['fetch', '--depth', '1', '--filter=blob:none', 'origin', revision],
        { cwd: mmh, timeout: 600000 }
      );
      await run(
        'git',
        [
          'sparse-checkout',
          'set',
          '--no-cone',
          'graphics.txt',
          'COPYING',
          'APL/',
        ],
        { cwd: mmh }
      );
      await run('git', ['checkout', '--detach', revision], {
        cwd: mmh,
        timeout: 600000,
      });
    }
    const { stdout } = await run('git', ['rev-parse', 'HEAD'], { cwd: mmh });
    if (stdout.trim() !== revision)
      throw new Error('MMH source revision mismatch; use a fresh cache');
    const blob = await run('git', ['rev-parse', 'HEAD:graphics.txt'], {
      cwd: mmh,
    });
    if (blob.stdout.trim() !== 'ef25a9208f7c4daf942d6f12be0a0f85075d140a')
      throw new Error('MMH graphics blob mismatch');
    console.log(`Make Me a Hanzi pinned source verified: ${revision}`);
  })(),
]);
