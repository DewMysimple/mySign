import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readDataset, hash } from './glyph-dataset.mjs';
const OUT = 'analysis/chinese/masks';
await mkdir(OUT, { recursive: true });
const {glyphs,geometryHash}=await readDataset();
const strokes = glyphs.flatMap((g) =>
  g.strokes.map((s, index) => ({ ...s, character: g.character, index }))
);
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto('http://127.0.0.1:5173/tests/fixtures/masks.html');
const results = [];
for (let offset = 0; offset < strokes.length; offset += 128) {
  const batch = strokes.slice(offset, offset + 128);
  const checks = await page.evaluate(async (batch) => {
    // Exercise the ACTUAL renderer used by SignatureController, at six progress
    // values, against an independent unmasked reference made from source outlines.
    const { createStrokeVisual, setStrokeProgress } = await import(
      '/src/handwriting/inkRenderer.js'
    );
    const cell = 128,
      cols = 16,
      rows = Math.ceil(batch.length / cols),
      w = cell * cols,
      h = cell * rows,
      NS = 'http://www.w3.org/2000/svg';
    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;left:-20000px;top:0';
    document.body.append(container);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    container.append(svg);
    const routes = batch.map((s, i) =>
      createStrokeVisual(
        svg,
        {
          ...s,
          engine: 'hanzi',
          d: s.median
            .map(([x, y], n) => `${n ? 'L' : 'M'} ${x} ${y}`)
            .join(' '),
          offset: {
            x: (i % cols) * cell + 14,
            y: Math.floor(i / cols) * cell + 14,
          },
        },
        i,
        'audit'
      )
    );
    const reference = `<svg xmlns="${NS}" width="${w}" height="${h}">${batch.map((s, i) => `<g transform="translate(${(i % cols) * cell + 14} ${Math.floor(i / cols) * cell + 14})"><path d="${s.outline}" fill="#3775be"/></g>`).join('')}</svg>`;
    const render = async (text) => {
      const im = new Image();
      im.src = 'data:image/svg+xml;base64,' + btoa(text);
      await im.decode();
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(im, 0, 0);
      return { canvas, ctx, data: ctx.getImageData(0, 0, w, h) };
    };
    const ref = await render(reference),
      levels = [0, 0.25, 0.5, 0.75, 0.995, 1],
      renders = [];
    for (const p of levels) {
      routes.forEach((r) => setStrokeProgress(r, p));
      renders.push(await render(new XMLSerializer().serializeToString(svg)));
    }
    const actual = renders.at(-1),
      diff = ref.ctx.createImageData(w, h),
      result = [];
    batch.forEach((s, i) => {
      let total = 0,
        missing = 0,
        alphaDifference = 0;
      const areas = levels.map(() => 0);
      for (
        let y = Math.floor(i / cols) * cell;
        y < Math.floor(i / cols) * cell + cell;
        y++
      )
        for (let x = (i % cols) * cell; x < (i % cols) * cell + cell; x++) {
          const n = (y * w + x) * 4,
            ra = ref.data.data[n + 3],
            aa = actual.data.data[n + 3];
          if (ra > 127) {
            total++;
            if (aa < 127) missing++;
          }
          alphaDifference += Math.abs(ra - aa) / 255;
          renders.forEach((r, j) => {
            areas[j] += r.data.data[n + 3] / 255;
          });
          if (Math.abs(ra - aa) > 8) {
            diff.data[n] = 220;
            diff.data[n + 3] = 255;
          }
        }
      const progressiveMonotone =
        areas[0] === 0 &&
        areas.slice(0, -1).every((v, j) => !j || v + 1e-5 >= areas[j - 1]);
      const alphaAreaMonotoneIncludingCompletion =
        areas[0] === 0 && areas.every((v, j) => !j || v + 1e-5 >= areas[j - 1]);
      result.push({
        character: s.character,
        stroke: s.index,
        inkPixels: total,
        missingPixels: missing,
        coverage: total ? 1 - missing / total : 0,
        alphaDifference,
        levels,
        areas: areas.map((v) => Math.round(v * 10000) / 10000),
        progressiveMonotone,
        alphaAreaMonotoneIncludingCompletion,
        completedOutlineExact: alphaDifference === 0,
        nearEndJump: areas.at(-1) ? 1 - areas.at(-2) / areas.at(-1) : 0,
      });
    });
    const diffCanvas = document.createElement('canvas');
    diffCanvas.width = w;
    diffCanvas.height = h;
    diffCanvas.getContext('2d').putImageData(diff, 0, 0);
    const white = (canvas) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(canvas, 0, 0);
      return c.toDataURL();
    };
    const output = {
      result,
      reference: white(ref.canvas),
      actual: white(actual.canvas),
      partial: white(renders[2].canvas),
      diff: white(diffCanvas),
    };
    container.remove();
    return output;
  }, batch);
  results.push(...checks.result);
  const failures = checks.result.filter(
    (r) =>
      r.coverage < 0.999 || !r.progressiveMonotone || !r.completedOutlineExact
  );
  if (offset === 0 || failures.length) {
    const prefix = offset === 0 ? 'sample' : `failure-${offset}`;
    for (const kind of ['reference', 'actual', 'partial', 'diff'])
      await writeFile(
        `${OUT}/${prefix}-${kind}.png`,
        Buffer.from(checks[kind].split(',')[1], 'base64')
      );
  }
  if (offset % 1280 === 0)
    console.log(
      `${Math.min(offset + 128, strokes.length)}/${strokes.length} actual SVG strokes at six progress levels`
    );
}
const failures = results.filter(
  (r) =>
    r.coverage < 0.999 || !r.progressiveMonotone || !r.completedOutlineExact
);
await writeFile(
  `${OUT}/coverage.json`,
  JSON.stringify(
    {
      environment: {
        browser: browser.version(),
        platform: process.platform,
        date: new Date().toISOString(),
      },
      implementation:
        'createStrokeVisual + setStrokeProgress; complete strokes release masks',
      glyphCount: glyphs.length,
      datasetGeometrySHA256: geometryHash,
      rendererSHA256: hash(await readFile('src/handwriting/inkRenderer.js')),
      strokeCount: strokes.length,
      threshold: 0.999,
      pass: failures.length === 0,
      minCoverage: Math.min(...results.map((r) => r.coverage)),
      maxNearEndJump: Math.max(...results.map((r) => r.nearEndJump)),
      failures,
      results,
    },
    null,
    2
  )
);
await browser.close();
console.log(
  JSON.stringify({
    glyphs: glyphs.length,
    strokes: strokes.length,
    failed: failures.length,
  })
);
if (failures.length) process.exitCode = 1;
