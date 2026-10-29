import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { SYMBOLS } from '../src/handwriting/symbols.js';
const out = 'analysis/chinese/visual';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 960 } });
  await page.setContent('<body style="margin:0;background:#f5f5f3"><svg width="1200" height="960" xmlns="http://www.w3.org/2000/svg"></svg></body>');
  await page.evaluate((entries) => {
    const svg = document.querySelector('svg'), ns = svg.namespaceURI;
    for (const [i, [character, glyph]] of entries.entries()) {
      const x = (i % 8) * 150, y = Math.floor(i / 8) * 150;
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', x + 12); label.setAttribute('y', y + 22);
      label.setAttribute('font-size', 16);
      label.textContent = `${character} · U+${character.codePointAt(0).toString(16).toUpperCase()}`;
      svg.append(label);
      for (const d of glyph.strokes) {
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', d); path.setAttribute('transform', `translate(${x + 30} ${y + 115})`);
        for (const [key, value] of Object.entries({ fill: 'none', stroke: '#3775be', 'stroke-width': 4.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })) path.setAttribute(key, value);
        svg.append(path);
      }
    }
  }, Object.entries(SYMBOLS));
  await page.screenshot({ path: `${out}/symbols.png` });
  await writeFile(`${out}/symbols.json`, JSON.stringify({ scope: 'Original digit and punctuation path atlas; animation order defined by source arrays and integration tests', count: Object.keys(SYMBOLS).length, characters: Object.keys(SYMBOLS).join('') }, null, 2) + '\n');
  console.log(`Rendered ${Object.keys(SYMBOLS).length} symbols`);
} finally { await browser.close(); }
