// Screenshots of the city panel tabs with the WebGL canvas hidden (full-page screenshots hang under swiftshader). Needs `vite --port 5211`.
import { chromium } from 'playwright';
const out = process.argv[2] ?? '.';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const mobile of [false, true]) {
  const ctx = await b.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto('http://localhost:5211/'); await p.waitForTimeout(3000);
  await p.evaluate(() => { const s = window.__store.getState(); s.set({ selectedStopId: s.data.stops[0].id }); });
  await p.waitForTimeout(500);
  await p.addStyleTag({ content: 'canvas{display:none!important} body,#root{background:#7fd1f5!important}' });
  if (mobile) await p.click('.sheet .grab', { force: true, noWaitAfter: true });
  for (const t of ['Plan', 'Hotel', 'Eat', 'City', 'Chat']) {
    await p.click(`.sp-tabs >> text=${t}`, { force: true, noWaitAfter: true }); await p.waitForTimeout(250);
    await p.screenshot({ path: `${out}/${mobile ? 'm' : 'd'}-${t}.png`, timeout: 20000, animations: 'disabled' });
  }
  await ctx.close();
}
await b.close();
