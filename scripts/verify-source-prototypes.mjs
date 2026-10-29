import { chromium, expect } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const data = JSON.parse(
  await readFile('analysis/chinese/source-prototypes.json', 'utf8')
);
const candidates = data.candidates.filter((c) => c.withinFormalTarget);
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--enable-unsafe-swiftshader'],
});
const results = [],
  errors = [];
await mkdir('analysis/chinese/source-prototype-frames', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 700, height: 550 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/tests/fixtures/sources.html');
  await page.waitForFunction(() => window.prototypeAudit);
  for (const [index, candidate] of candidates.entries()) {
    const initial = await page.evaluate(
      (c) => window.prototypeAudit.run(c),
      candidate
    );
    const samples = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const rows = [];
          function frame() {
            const d = window.prototypeAudit.inspect();
            if (d.phase === 'stroke' && d.strokeProgress > 0) {
              const r = document.querySelector(
                  `[data-route="${d.strokeIndex}"]`
                ),
                v = document.querySelector(`[data-outline="${d.strokeIndex}"]`),
                p = r.getPointAtLength(
                  r.getTotalLength() -
                    parseFloat(getComputedStyle(r).strokeDashoffset)
                );
              const s = new DOMPoint(p.x, p.y).matrixTransform(
                v.getScreenCTM()
              );
              rows.push({
                index: d.strokeIndex,
                p: d.strokeProgress,
                error: Math.hypot(
                  s.x - d.projectedTip.x,
                  s.y - d.projectedTip.y
                ),
              });
            }
            if (d.state === 'writing') requestAnimationFrame(frame);
            else resolve(rows);
          }
          requestAnimationFrame(frame);
        })
    );
    expect(
      await page.evaluate(() => window.prototypeAudit.inspect().state)
    ).toBe('written');
    expect(samples.length).toBeGreaterThan(0);
    const maxError = Math.max(0, ...samples.map((s) => s.error));
    expect(maxError).toBeLessThan(0.2);
    if (['永', '盼', '藏', '女', '回'].includes(candidate.character))
      await page.screenshot({
        path: `analysis/chinese/source-prototype-frames/${candidate.character.codePointAt(0).toString(16)}-${candidate.source}.png`,
      });
    results.push({
      character: candidate.character,
      source: candidate.source,
      ...initial,
      samples,
      maxErrorPx: maxError,
    });
    if (index % 10 === 0)
      console.log(`${index + 1}/${candidates.length} paired-source prototypes`);
  }
  expect(errors).toEqual([]);
  await writeFile(
    'analysis/chinese/source-animation-comparison.json',
    JSON.stringify(
      {
        date: new Date().toISOString(),
        browser: browser.version(),
        scope:
          'Both sources use actual SignatureController, SVG masks and PencilScene. Diagnostic 12x timeline playback; not a performance benchmark. Out-of-target prototypes remain unregistered.',
        pass: true,
        characters: new Set(results.map((r) => r.character)).size,
        sourceRuns: results.length,
        skippedOutOfTarget: data.candidates
          .filter((c) => !c.withinFormalTarget)
          .map((c) => ({ character: c.character, source: c.source })),
        results,
        errors,
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}
