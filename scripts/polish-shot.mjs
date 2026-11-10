import { chromium } from 'playwright';
// usage: node polish-shot.mjs out.png w h hours [selectedStopId|-] [mobile] [follow] [wait]
const [,, out, w = '1280', h = '800', hours = '38', sel = '-', mobile = '', follow = '', wait = '3000'] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, hasTouch: !!mobile, isMobile: !!mobile });
const p = await ctx.newPage(); p.setDefaultTimeout(120000); const errs = [];
p.on('pageerror', e => errs.push('PAGEERR: ' + String(e).slice(0, 300)));
p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await p.goto((process.env.URL ?? 'http://localhost:5231/')); await p.waitForTimeout(4000);
await p.evaluate(([hh, sel, follow]) => { const st = window.__store.getState(); const stops = st.data.stops; const s = sel === '-' ? null : (stops.find(x => x.id === sel || x.cityKey === sel)?.id ?? null);
  st.set({ tripHours: +hh, follow: !!follow, selectedStopId: s, fitNonce: st.fitNonce + 1 }); }, [hours, sel, follow]);
await p.waitForTimeout(+wait);
await p.screenshot({ path: out, timeout: 120000 });
console.log(errs.slice(0, 5).join('\n') || 'ok');
await b.close();
