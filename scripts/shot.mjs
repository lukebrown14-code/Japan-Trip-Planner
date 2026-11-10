import { chromium } from 'playwright';
const [,, url, out, w = '1280', h = '800', hours = '', mobile = ''] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, hasTouch: !!mobile, isMobile: !!mobile });
const p = await ctx.newPage(); const errs = [];
p.on('console', m => { if (['error', 'warning'].includes(m.type()) && !m.text().includes('flatShading') && !m.text().includes('Clock')) errs.push(m.type() + ': ' + m.text().slice(0, 200)); });
p.on('pageerror', e => errs.push('PAGEERR: ' + String(e).slice(0, 300)));
await p.goto(url); await p.waitForTimeout(4000);
if (hours) {
  await p.evaluate(hh => { const st = window.__store.getState(); st.set({ tripHours: +hh, follow: false, fitNonce: st.fitNonce + 1 }); }, hours);
  await p.waitForTimeout(2500);
}
await p.screenshot({ path: out });
console.log([...new Set(errs)].slice(0, 10).join('\n') || 'no console errors');
await b.close();
