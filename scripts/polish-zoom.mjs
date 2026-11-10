import { chromium } from 'playwright';
// usage: node polish-zoom.mjs out.png cityKey hours [wheelSteps=6] [w h] [mobile]
const [,, out, key, hours, steps = '6', w = '1100', h = '720', mobile = ''] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, hasTouch: !!mobile, isMobile: !!mobile });
const p = await ctx.newPage(); p.setDefaultTimeout(120000);
await p.goto('http://localhost:5231/'); await p.waitForFunction(() => window.__store?.getState().data.stops.length > 0 && window.__labelPos && Object.keys(window.__labelPos).length > 3); await p.waitForTimeout(1500);
await p.evaluate(([hh]) => { const st = window.__store.getState(); st.set({ tripHours: +hh, follow: false, selectedStopId: null, fitNonce: st.fitNonce + 1 }); }, [hours]);
await p.waitForTimeout(5000);
const id = await p.evaluate(k => window.__store.getState().data.stops.find(x => x.cityKey === k).id, key);
for (let i = 0; i < +steps; i++) {
  const pos = await p.evaluate(i => { const l = window.__labelPos[i]; return [l.x, l.y + 45]; }, id);
  const cx = Math.min(Math.max(pos[0], 50), +w - 50), cy = Math.min(Math.max(pos[1], 80), +h - 80);
  await p.mouse.move(cx, cy); await p.mouse.wheel(0, -260); await p.waitForTimeout(1800);
}
await p.waitForTimeout(6000);
await p.screenshot({ path: out, timeout: 120000 });
await b.close();
