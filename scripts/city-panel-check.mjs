// DOM-only check of the city panel at desktop + mobile (no screenshots; WebGL screenshots time out under swiftshader). Needs `vite --port 5211`.
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const mobile of [false, true]) {
  const ctx = await b.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, hasTouch: mobile, isMobile: mobile });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await p.goto('http://localhost:5211/'); await p.waitForTimeout(3000);
  await p.evaluate(() => { const s = window.__store.getState(); s.set({ selectedStopId: s.data.stops[0].id }); });
  await p.waitForTimeout(500);
  const click = sel => p.click(sel, { force: true, noWaitAfter: true, timeout: 8000 });
  const tab = t => click(`.sp-tabs >> text=${t}`);
  const tabs = await p.$$eval('.sp-tabs button', e => e.map(x => x.textContent));
  const overflow = () => p.evaluate(() => { const b = document.querySelector('.sheet .body'); const t = document.querySelector('.sp-tabs'); return { body: b.scrollWidth <= b.clientWidth, tabsFit: t.scrollWidth <= t.clientWidth }; });
  const out = { mobile, tabs, overflowPlan: await overflow() };
  await tab('Hotel'); await click('.sp-card >> text=Add hotel'); await p.fill('.sp-form input >> nth=0', 'Hotel Gracery'); await click('.sp-form >> text=Save'); await p.waitForTimeout(300);
  out.hotel = await p.$eval('.sp-card b', e => e.textContent); out.overflowHotel = await overflow();
  await tab('City'); await p.fill('textarea[aria-label="City notes"]', 'Stay near Shinjuku'); await p.click('.sp-sec >> text=DATES', { force: true }); await p.waitForTimeout(100);
  await click('.sp-sec:has-text("DATES") button'); out.dateInputs = (await p.$$('.sp-dates input')).length;
  out.overflowCity = await overflow();
  await tab('Plan'); out.planSummary = await p.$eval('.sp-sum', e => e.textContent);
  await tab('Eat'); await p.fill('input[aria-label="New food spot"]', 'Ichiran'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  out.eats = await p.$$eval('.sp-act .t', e => e.map(x => x.textContent));
  await click('button[aria-label="Hide panel"]'); await p.waitForTimeout(200);
  out.pill = await p.$eval('.sp-pill', e => e.textContent); await click('.sp-pill'); await p.waitForTimeout(200); out.back = !!(await p.$('.sheet'));
  out.errs = errs; console.log(out); await ctx.close();
}
await b.close();
