// Trip-planner e2e: node scripts/planner-test.mjs [url] [outDir]. Expects `npm run dev` (mock API) running.
import { chromium } from 'playwright';
const [,, url = 'http://localhost:5173/', out = '.'] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errs = []; let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
for (const [name, vp, mobile] of [['desktop', { width: 1280, height: 800 }, false], ['mobile', { width: 390, height: 844 }, true]]) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: mobile, isMobile: mobile });
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error' && !m.text().includes('flatShading')) errs.push(`${name}: ${m.text().slice(0, 200)}`); });
  p.on('pageerror', e => errs.push(`${name} PAGEERR: ${String(e).slice(0, 300)}`));
  await p.goto(url); await p.waitForTimeout(3500);
  const stops = () => p.evaluate(() => window.__store.getState().data.stops.map(s => [s.name, s.arrive, s.depart]));
  ok(await p.locator('.tp-block').count() === 6, `${name}: 6 city blocks`);
  ok(await p.locator('.tp-day').count() === 13, `${name}: 13 day cells (24 Oct – 5 Nov)`);
  await p.screenshot({ path: `${out}/planner-${name}-open.png` });

  // drag the Tokyo|Nikko boundary left by one day (24→27 becomes 24→26)
  const h = p.locator('.tp-handle').first(); const hb = await h.boundingBox(); const tb = await p.locator('.tp-track').boundingBox();
  const slot = tb.width / 13; const x0 = hb.x + hb.width / 2, y0 = hb.y + hb.height / 2;
  await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move(x0 - slot * 1.1, y0, { steps: 6 });
  ok(await p.locator('.tp-tip').count() === 1, `${name}: drag shows date tooltip`);
  await p.screenshot({ path: `${out}/planner-${name}-drag.png` });
  await p.mouse.up(); await p.waitForTimeout(300);
  const after = await stops();
  ok(after[0][2] === '2026-10-26' && after[1][1] === '2026-10-26', `${name}: boundary moved Tokyo/Nikko to 26 Oct (${JSON.stringify(after.slice(0, 2))})`);

  // clamp: try to drag far right; Nikko must keep one night
  const hb2 = await h.boundingBox(); await p.mouse.move(hb2.x + hb2.width / 2, hb2.y + hb2.height / 2); await p.mouse.down();
  await p.mouse.move(tb.x + tb.width - 4, hb2.y + hb2.height / 2, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(300);
  const clamped = await stops(); ok(clamped[0][2] === '2026-10-27' && clamped[1][1] === '2026-10-27', `${name}: drag clamps to keep Nikko one night`);

  // click a block selects + focuses the stop
  await p.locator('.tp-block').nth(3).click(); await p.waitForTimeout(1500);
  ok(await p.evaluate(() => window.__store.getState().selectedStopId) === 's3', `${name}: clicking Kyoto selects it`);
  await p.screenshot({ path: `${out}/planner-${name}-panel.png` });

  // City details temporarily collapse the mobile planner; closing restores its saved state.
  if (mobile) {
    ok(await p.locator('.tp-summary').count() === 1, `${name}: city panel automatically shows compact planner`);
    ok(await p.evaluate(() => window.__store.getState().plannerOpen), `${name}: automatic collapse preserves open preference`);
  }
  await p.locator('.sp-close[aria-label="Close"]').click(); await p.waitForTimeout(300);
  ok(await p.locator('.tp-track').count() === 1, `${name}: closing city details restores planner`);

  // collapse
  const h0 = (await p.locator('.tp').boundingBox()).height;
  await p.locator('.tp-collapse').click(); await p.waitForFunction(() => document.querySelector('.tp').getBoundingClientRect().height < 100, null, { timeout: 3000 }).catch(() => {});
  const h1 = (await p.locator('.tp').boundingBox()).height;
  ok(h1 < h0 - 60 && await p.locator('.tp-track').count() === 0, `${name}: collapse shrinks bar (${Math.round(h0)}→${Math.round(h1)}px)`);
  ok(await p.evaluate(() => document.documentElement.dataset.planner) === 'closed', `${name}: --tl-h switches via data-planner`);
  await p.screenshot({ path: `${out}/planner-${name}-closed.png` });
  await p.reload(); await p.waitForTimeout(3000);
  ok(await p.locator('.tp-track').count() === 0, `${name}: collapsed state persists across reload`);
  await p.keyboard.press('t'); await p.waitForTimeout(400);
  ok(await p.locator('.tp-track').count() === 1, `${name}: T reopens`);
  await p.keyboard.press('t'); await p.waitForTimeout(400); await p.keyboard.press('t'); await p.waitForTimeout(300);
  ok(await p.locator('.tp-track').count() === 1, `${name}: T toggles once per press`);
  await ctx.close();
}

// ---- save robustness + panel reselect (dev server: patches the shared mock api module in the page) ----
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(`review PAGEERR: ${String(e).slice(0, 300)}`));
  await p.goto(url); await p.waitForTimeout(3000);
  const st = () => p.evaluate(() => window.__store.getState().data.stops.slice(0, 3).map(s => [s.arrive, s.depart]));
  const dragFirst = async () => { const hb = await p.locator('.tp-handle').first().boundingBox(); const tb = await p.locator('.tp-track').boundingBox();
    const x = hb.x + hb.width / 2, y = hb.y + hb.height / 2; await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x - tb.width / 13 * 1.1, y, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(500); };

  // 1. one of the two saves fails: only that stop rolls back (client matches what the server accepted)
  await p.evaluate(async () => { const { api } = await import('/src/api.ts'); const orig = api.save.bind(api); window.__origSave = orig;
    api.save = async (c, e, o) => { if (e.id === 's1') throw new Error('boom'); return orig(c, e, o); }; });
  await dragFirst(); const r1 = await st();
  ok(r1[0][1] === '2026-10-26' && r1[1][0] === '2026-10-27', `review: failed save rolls back only the failed stop (Tokyo kept 26 Oct, Nikko back to 27: ${JSON.stringify(r1.slice(0, 2))})`);
  ok(await p.locator('.tp-err').count() === 1, 'review: error message shown');

  // 2. held arrow key: saves never overlap and the final dates are persisted
  await p.reload(); await p.waitForTimeout(3000); // fresh page: unpatched api, fresh mock db
  await p.evaluate(async () => { const { api } = await import('/src/api.ts'); const orig = api.save.bind(api); window.__conc = 0; window.__maxConc = 0;
    api.save = async (c, e, o) => { window.__conc++; window.__maxConc = Math.max(window.__maxConc, window.__conc); await new Promise(r => setTimeout(r, 80)); try { return await orig(c, e, o); } finally { window.__conc--; } }; });
  await p.locator('.tp-handle').first().focus(); for (let i = 0; i < 2; i++) await p.keyboard.press('ArrowLeft');
  await p.waitForTimeout(1200); const r2 = await st();
  ok(await p.evaluate(() => window.__maxConc) === 1, `review: held arrow key never overlaps saves (max concurrent ${await p.evaluate(() => window.__maxConc)})`);
  ok(r2[0][1] === '2026-10-25' && r2[1][0] === '2026-10-25', `review: final dates saved after key repeat (${JSON.stringify(r2.slice(0, 2))})`);
  ok(await p.evaluate(async () => { const { api } = await import('/src/api.ts'); const d = await api.trip(); return d.stops.find(s => s.id === 's0').depart; }) === '2026-10-25', 'review: store of record (mock db) holds the final date');

  // 3. hidden city panel reopens when the same city is selected again
  await p.locator('.tp-block').nth(3).click(); await p.waitForTimeout(600);
  await p.locator('.sp-close[aria-label="Hide panel"]').click(); await p.waitForTimeout(300);
  ok(await p.locator('.sp-pill').count() === 1, 'review: panel hidden to pill');
  await p.locator('.tp-block').nth(3).click(); await p.waitForTimeout(400);
  ok(await p.locator('.sp-pill').count() === 0 && await p.locator('.arrival-wrap .sheet').count() === 1, 'review: re-selecting the same city (planner) reopens the hidden panel');
  await p.locator('.sp-close[aria-label="Hide panel"]').click(); await p.waitForTimeout(300);
  await p.evaluate(() => window.__store.getState().selectStop('s3')); await p.waitForTimeout(300);
  ok(await p.locator('.sp-pill').count() === 0, 'review: selectStop (map/label click path) reopens it too');
  await ctx.close();
}

// ---- layout matrix: fit, overflow, handle hit areas, touch drag ----
const MATRIX = [['phone-320', 320, 568, true], ['phone-360', 360, 740, true], ['phone-390', 390, 844, true], ['tablet-768', 768, 1024, true], ['desktop-1280', 1280, 800, false], ['landscape-844x390', 844, 390, true]];
for (const [name, w, h, mobile] of MATRIX) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: mobile, isMobile: mobile });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(`${name} PAGEERR: ${String(e).slice(0, 300)}`));
  await p.goto(url); await p.waitForTimeout(3000);
  const m = await p.evaluate(() => {
    const r = q => document.querySelector(q).getBoundingClientRect();
    const bar = r('.tp'), tr = r('.tp-track'), blocks = [...document.querySelectorAll('.tp-block')].map(e => e.getBoundingClientRect());
    const hs = [...document.querySelectorAll('.tp-handle')].map(e => e.getBoundingClientRect());
    const last = blocks[blocks.length - 1], blk = r('.tp-blocks');
    return { bar: [bar.left, bar.right, bar.top, bar.bottom], vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth,
      minHandle: Math.min(...hs.map(x => x.width)), overlap: hs.some((a, i) => hs.some((c, j) => j > i && a.right > c.left + 0.5 && a.left < c.right - 0.5)),
      lastGap: Math.abs(last.right - blk.right), trackBlkGap: Math.abs(tr.right - blk.right), blockH: Math.min(...blocks.map(x => x.height)) };
  });
  ok(m.sw <= m.vw, `${name}: no horizontal overflow (${m.sw}<=${m.vw})`);
  ok(m.bar[0] >= -0.5 && m.bar[1] <= m.vw + 0.5 && m.bar[3] <= m.vh + 0.5 && m.bar[2] >= 0, `${name}: bar inside viewport`);
  ok(m.minHandle >= 22 && !m.overlap, `${name}: handles >=22px (min ${m.minHandle.toFixed(1)}) and not overlapping`);
  ok(m.lastGap <= 2.5, `${name}: last block flush with track edge (${m.lastGap.toFixed(1)}px)`);
  ok(m.blockH >= 44 || h < 500 && m.blockH >= 40, `${name}: block tap height ${m.blockH.toFixed(0)}px`);
  await p.screenshot({ path: `${out}/layout-${name}-open.png` });
  if (mobile) { // touch drag Tokyo|Nikko left by one day through CDP touch events
    const cdp = await ctx.newCDPSession(p);
    const hb = await p.locator('.tp-handle').first().boundingBox(); const tb = await p.locator('.tp-track').boundingBox(); const slot = tb.width / 13;
    const x = hb.x + hb.width / 2, y = hb.y + hb.height / 2;
    const t = (type, px) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: px, y }] });
    await t('touchStart', x); for (let i = 1; i <= 6; i++) await t('touchMove', x - slot * 1.1 * i / 6);
    await p.screenshot({ path: `${out}/layout-${name}-drag.png` });
    await t('touchEnd', 0); await p.waitForTimeout(300);
    const st = await p.evaluate(() => window.__store.getState().data.stops.slice(0, 2).map(s => [s.arrive, s.depart]));
    ok(st[0][1] === '2026-10-26' && st[1][0] === '2026-10-26', `${name}: touch drag moved boundary to 26 Oct (${JSON.stringify(st)})`);
    ok(await p.evaluate(() => scrollY === 0 && scrollX === 0), `${name}: page did not scroll during drag`);
  }
  await p.locator('.tp-collapse').click(); await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/layout-${name}-closed.png` });
  await ctx.close();
}
console.log([...new Set(errs)].slice(0, 10).join('\n') || 'no console errors');
await b.close(); process.exit(fails ? 1 : 0);
