# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: chinese.spec.js >> fixed mixed wrapping survives resize and live motion changes without restarting a completed stroke
- Location: tests\browser\chinese.spec.js:179:1

# Error details

```
Error: expect(received).toBeLessThan(expected)

Expected: < 0.2
Received:   262.18688107232373
```

# Page snapshot

```yaml
- main [ref=e3]:
  - img "Handwritten signature of 中文签名中文签名中文签名中文签名，（王明）《中文》！"
  - form "Signature controls" [ref=e4]:
    - generic [ref=e5]: 姓名或签名内容（中文、英文、数字及标点）
    - textbox "姓名或签名内容（中文、英文、数字及标点）" [ref=e6]:
      - /placeholder: Your name · 你的名字
      - text: 中文签名中文签名中文签名中文签名，（王明）《中文》！
    - button "Erase signature" [ref=e7] [cursor=pointer]
  - status [ref=e11]: 中文签名中文签名中文签名中文签名，（王明）《中文》！ is signed. Use the eraser to start again.
```

# Test source

```ts
  102 |   expect((await inspect(page)).renderCount).toBe(renderCount);
  103 |   await page.getByRole('button', { name: 'Erase signature' }).click();
  104 |   await waitState(page, 'erasing');
  105 |   expect((await inspect(page)).particles).toBeGreaterThan(100);
  106 |   await page.waitForTimeout(200);
  107 |   await page.screenshot({ path: path.join(OUT, 'mixed-particles.png') });
  108 |   await waitState(page, 'idle');
  109 |   const after = await inspect(page);
  110 |   expect(after.cache.raw.pinned).toBe(0);
  111 |   expect(after.cache.parsed.pinned).toBe(0);
  112 |   expect(after.particles).toBe(0);
  113 |   expect(after.geometries).toBe(initial.geometries);
  114 |   expect(after.textures).toBe(initial.textures);
  115 |   expect(errors).toEqual([]);
  116 |   await writeFile(
  117 |     path.join(OUT, 'synchronization.json'),
  118 |     JSON.stringify(
  119 |       {
  120 |         sampleCount: samples.length,
  121 |         maxErrorPx: Math.max(...samples.map((s) => s.error)),
  122 |         written,
  123 |         after,
  124 |         errors,
  125 |         samples,
  126 |       },
  127 |       null,
  128 |       2
  129 |     )
  130 |   );
  131 | });
  132 | 
  133 | test('IME Enter is consumed, Shift+Enter is retained, unsupported graphemes report every position without rewriting', async ({
  134 |   page,
  135 | }) => {
  136 |   const errors = await launch(page),
  137 |     input = page.getByRole('textbox');
  138 |   await input.fill('王明');
  139 |   await input.dispatchEvent('compositionstart');
  140 |   await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true });
  141 |   await waitState(page, 'idle');
  142 |   await input.dispatchEvent('compositionend');
  143 |   await input.evaluate((el) =>
  144 |     el.dispatchEvent(
  145 |       new KeyboardEvent('keydown', {
  146 |         key: 'Enter',
  147 |         keyCode: 229,
  148 |         bubbles: true,
  149 |         cancelable: true,
  150 |       })
  151 |     )
  152 |   );
  153 |   await waitState(page, 'idle');
  154 |   await input.press('End');
  155 |   await input.press('Shift+Enter');
  156 |   await input.press('A');
  157 |   await expect(input).toHaveValue('王明\nA');
  158 |   const invalid = '王🙂\tÉ';
  159 |   await input.fill(invalid);
  160 |   await input.press('Enter');
  161 |   await waitState(page, 'idle');
  162 |   await expect(input).toHaveValue(invalid);
  163 |   await expect(page.locator('#signature-status')).toContainText('第 2 个字符');
  164 |   await expect(page.locator('#signature-status')).toContainText('第 3 个字符');
  165 |   await expect(page.locator('#signature-status')).toContainText('第 4 个字符');
  166 |   await expect(input).toBeEditable();
  167 |   await expect(page.locator('[data-stroke]')).toHaveCount(0);
  168 |   await page.emulateMedia({ reducedMotion: 'reduce' });
  169 |   await sign(page, '王明\n\n  Amy，2026！ ');
  170 |   await waitState(page, 'written');
  171 |   const d = await inspect(page);
  172 |   expect(d.name).toBe('王明\n\n  Amy，2026！ ');
  173 |   expect(d.lines).toEqual(['王明', '', '  Amy，2026！ ']);
  174 |   await page.screenshot({ path: path.join(OUT, 'manual-newlines.png') });
  175 |   await erase(page);
  176 |   expect(errors).toEqual([]);
  177 | });
  178 | 
  179 | test('fixed mixed wrapping survives resize and live motion changes without restarting a completed stroke', async ({
  180 |   page,
  181 | }) => {
  182 |   const errors = await launch(page);
  183 |   await page.setViewportSize({ width: 700, height: 700 });
  184 |   await sign(page, '中文签名中文签名中文签名中文签名，（王明）《中文》！');
  185 |   await waitState(page, 'writing');
  186 |   await page.waitForFunction(() => {
  187 |     const d = window.__signatureDebug.inspect();
  188 |     return d.phase === 'stroke' && d.strokeIndex > 0 && d.strokeProgress > 0.1;
  189 |   });
  190 |   const before = await inspect(page);
  191 |   expect(before.lines.length).toBeGreaterThan(1);
  192 |   await page.emulateMedia({ reducedMotion: 'reduce' });
  193 |   const changed = await inspect(page);
  194 |   expect(changed.strokeIndex).toBeGreaterThanOrEqual(before.strokeIndex);
  195 |   await page.setViewportSize({ width: 1280, height: 800 });
  196 |   const samples = await sample(page, 5000);
  197 |   await waitState(page, 'written');
  198 |   const done = await inspect(page);
  199 |   expect(done.lines).toEqual(before.lines);
  200 |   expect(done.reducedMotion).toBe(true);
  201 |   if (samples.length)
> 202 |     expect(Math.max(...samples.map((s) => s.error))).toBeLessThan(0.2);
      |                                                      ^ Error: expect(received).toBeLessThan(expected)
  203 |   await page.screenshot({ path: path.join(OUT, 'fixed-wrap-resize.png') });
  204 |   await erase(page);
  205 |   await page.emulateMedia({ reducedMotion: 'no-preference' });
  206 |   await sign(page, '永');
  207 |   await waitState(page, 'written');
  208 |   await erase(page);
  209 |   expect(errors).toEqual([]);
  210 | });
  211 | 
  212 | test('load failure and preflight budgets preserve original text, then recover with verified caches', async ({
  213 |   page,
  214 | }) => {
  215 |   await launch(page);
  216 |   const input = page.getByRole('textbox');
  217 |   await page.route('**/glyphs/shard-*.json', (route) => route.abort());
  218 |   const text = '张李陈赵';
  219 |   await sign(page, text);
  220 |   await waitState(page, 'idle');
  221 |   await expect(input).toHaveValue(text);
  222 |   await expect(input).toBeEditable();
  223 |   expect((await inspect(page)).active).toBe(false);
  224 |   expect((await inspect(page)).cache.raw.pinned).toBe(0);
  225 |   await page.unroute('**/glyphs/shard-*.json');
  226 |   await page.emulateMedia({ reducedMotion: 'reduce' });
  227 |   await sign(page, text);
  228 |   await waitState(page, 'written');
  229 |   await erase(page);
  230 |   const huge = '王'.repeat(1000);
  231 |   await sign(page, huge);
  232 |   await waitState(page, 'idle');
  233 |   await expect(input).toHaveValue(huge);
  234 |   await expect(page.locator('#signature-status')).toContainText('超过');
  235 |   expect((await inspect(page)).cache.parsed.pinned).toBe(0);
  236 |   await sign(page, 'Amy');
  237 |   await waitState(page, 'written');
  238 |   await erase(page);
  239 | });
  240 | 
  241 | test('fault injection covers preflight, loading, stroke, lift, particle preparation and erase completion, each retry succeeds', async ({
  242 |   page,
  243 | }) => {
  244 |   const errors = await launch(page);
  245 |   const results = [];
  246 |   for (const stage of [
  247 |     'preflight',
  248 |     'loading',
  249 |     'stroke',
  250 |     'lift',
  251 |     'particles',
  252 |     'particle-draw',
  253 |     'erase',
  254 |   ]) {
  255 |     const text = '王明 Amy';
  256 |     const isClear = ['particles', 'particle-draw', 'erase'].includes(stage);
  257 |     await page.emulateMedia({
  258 |       reducedMotion:
  259 |         isClear && stage !== 'particle-draw' ? 'reduce' : 'no-preference',
  260 |     });
  261 |     if (isClear) {
  262 |       await sign(page, text);
  263 |       await waitState(page, 'written');
  264 |     }
  265 |     await page.evaluate(
  266 |       (stage) => window.__signatureDebug.inject(stage),
  267 |       stage
  268 |     );
  269 |     if (isClear)
  270 |       await page.getByRole('button', { name: 'Erase signature' }).click();
  271 |     else await sign(page, text);
  272 |     await waitState(page, 'idle');
  273 |     await expect(page.getByRole('textbox')).toHaveValue(text);
  274 |     await expect(page.getByRole('textbox')).toBeEditable();
  275 |     const d = await inspect(page);
  276 |     await writeFile(
  277 |       path.join(OUT, `fault-${stage}.json`),
  278 |       JSON.stringify(d, null, 2)
  279 |     );
  280 |     expect(d.active, stage).toBe(false);
  281 |     expect(d.particles).toBe(0);
  282 |     expect(d.cache.raw.pinned).toBe(0);
  283 |     expect(d.cache.parsed.pinned).toBe(0);
  284 |     expect(d.strokeCount).toBe(0);
  285 |     expect(d.projectedTip.x).toBeCloseTo(1440 * 0.685, 3);
  286 |     expect(d.projectedTip.y).toBeCloseTo(900 * 0.505, 3);
  287 |     results.push({ stage, after: d });
  288 |     await page.emulateMedia({ reducedMotion: 'reduce' });
  289 |     await sign(page, text);
  290 |     await waitState(page, 'written');
  291 |     await erase(page);
  292 |   }
  293 |   expect(errors).toEqual([]);
  294 |   await writeFile(
  295 |     path.join(OUT, 'faults.json'),
  296 |     JSON.stringify({ results, errors }, null, 2)
  297 |   );
  298 | });
  299 | 
  300 | test('bounded cache reuse and resources stay stable through repeated mixed write/clear cycles', async ({
  301 |   page,
  302 | }) => {
```