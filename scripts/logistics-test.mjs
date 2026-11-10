import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const [name, w, h, mob] of [['desk', 1280, 800, false], ['mob', 390, 844, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: mob, isMobile: mob });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
  await p.goto('http://localhost:5212'); await p.waitForTimeout(3000);
  await p.evaluate(() => window.__store.setState({ menuOpen: true, travellers: ['Luke', 'Partner'], me: 'Luke' }));
  await p.waitForTimeout(800);
  console.log(name, 'legs', await p.evaluate(() => window.__store.getState().data.legs.length));
  await p.screenshot({ path: `/tmp/claude-501/lg-${name}-1.png` });
  await p.locator('.lg-row .chev').nth(5).click(); await p.waitForTimeout(300);
  await p.screenshot({ path: `/tmp/claude-501/lg-${name}-2.png` });
  await p.getByRole('tab', { name: 'Flights' }).click(); await p.waitForTimeout(300);
  if (await p.getByText('+ Add outbound flight').count()) await p.getByText('+ Add outbound flight').click();
  await p.waitForTimeout(300);
  const f = p.locator('input[type=datetime-local]').last(); await f.fill('2026-11-05T09:00'); await f.blur(); await p.waitForTimeout(300);
  await p.screenshot({ path: `/tmp/claude-501/lg-${name}-3.png` });
  await p.getByRole('tab', { name: 'Checklist' }).click();
  await p.getByText('Add the starter list').click().catch(() => {}); await p.waitForTimeout(300);
  await p.locator('.tick').first().click(); await p.waitForTimeout(300);
  await p.screenshot({ path: `/tmp/claude-501/lg-${name}-4.png` });
  console.log(name, 'hscroll', await p.evaluate(() => document.querySelector('.lg-body').scrollWidth > document.querySelector('.lg-body').clientWidth), errs.slice(0, 5));
  await ctx.close();
}
await b.close();
