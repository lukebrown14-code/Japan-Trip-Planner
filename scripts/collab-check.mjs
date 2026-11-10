import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('http://localhost:5214/'); await p.evaluate(()=>localStorage.removeItem('japan-mock-me')); await p.reload(); await p.waitForTimeout(1500);

await p.waitForTimeout(4000);
await p.screenshot({ path: '/tmp/claude-501/collab-top.png' });
await p.click('[aria-label="What\'s new"]'); await p.waitForTimeout(500);
await p.screenshot({ path: '/tmp/claude-501/collab-wn.png' });
console.log(errs.join('\n')||'ok'); await b.close();
