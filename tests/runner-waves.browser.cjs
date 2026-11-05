const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { hazardAt } = require('../src/lib/runner.ts');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => {
      const original = Crypto.prototype.getRandomValues;
      Crypto.prototype.getRandomValues = function (array) {
        const result = original.call(this, array);
        if (array instanceof Uint32Array && array.length === 1) array[0] = 1;
        return result;
      };
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto((process.env.TYCOON_TEST_ORIGIN || 'http://localhost:3158') + '/play/run');
    await page.locator('canvas[data-webgl-ready]').waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: 'Start running', exact: true }).click();
    const root = page.locator('[data-runner]');
    assert.ok(Number(await root.getAttribute('data-chase-gap')) >= 4.5);
    await page.screenshot({ path: '/workspace/exports/chase-waves-start-390.png' });
    const seen = new Set();
    let paused = false;
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      const state = await root.evaluate(el => ({ ...el.dataset }));
      assert.equal(state.phase, 'running');
      seen.add(`${state.chasePhase}:${state.chaseWave}`);
      const distance = parseInt(await page.locator('section[aria-label="Run score"] > div:nth-child(3) strong').innerText());
      const next = Math.max(0, Math.floor((distance - 26) / 14) + 1);
      const hazard = hazardAt(next, 1);
      const target = hazard.lane === 0 ? -1 : 0;
      let lane = Number(state.lane);
      while (lane !== target) {
        await page.keyboard.press(lane < target ? 'ArrowRight' : 'ArrowLeft');
        lane += lane < target ? 1 : -1;
      }
      if (!paused && state.chaseWave === '2' && state.chasePhase === 'chasing') {
        await page.getByRole('button', { name: 'Pause run', exact: true }).click();
        const snapshot = await root.evaluate(el => ({ ...el.dataset }));
        await page.waitForTimeout(500);
        assert.deepEqual(await root.evaluate(el => ({ ...el.dataset })), snapshot);
        await page.getByRole('button', { name: 'Resume run', exact: true }).click();
        paused = true;
      }
      if (seen.has('chasing:3')) {
        assert.ok(Number(state.runSpeed) > 8);
        break;
      }
      await page.waitForTimeout(120);
    }
    for (const phase of ['chasing:1', 'resting:1', 'chasing:2', 'resting:2', 'chasing:3']) assert.ok(seen.has(phase), `Missing ${phase}`);
    assert.ok(paused);
    assert.deepEqual(errors, []);
    console.log('PASS: mobile head start, repeated chase/rest waves, increasing speed and frozen pause timing.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
