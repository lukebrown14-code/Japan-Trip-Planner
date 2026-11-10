import { chromium } from 'playwright';
const B = 'http://localhost:3200';
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const out = []; const ok = (n, c, extra='') => { out.push(`${c ? 'PASS' : 'FAIL'} ${n} ${extra}`); };
async function user(name, vp, mobile) {
  const ctx = await b.newContext({ viewport: vp, isMobile: !!mobile, hasTouch: !!mobile });
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(String(e).slice(0,200)));
  await p.goto(B); await p.waitForTimeout(1500);
  ok(`${name}: login gate shown`, await p.getByText('Our Japan Trip').first().isVisible());
  await p.locator('input[type=password]').fill('wrong'); 
  const chip = p.getByText(name, { exact: true }).first(); if (await chip.count()) await chip.click(); else await p.locator('input[type=text]').fill(name);
  await p.locator('button.go').first().click({ force: true }).catch(()=>{});
  await p.waitForTimeout(800);
  ok(`${name}: wrong passphrase rejected`, !(await p.evaluate(() => !!window.__store?.getState().me)));
  await p.locator('input[type=password]').fill('sakura');
  await p.locator('button.go').first().click({ force: true });
  await p.waitForFunction(() => window.__store?.getState().me, null, { timeout: 15000 }).catch(()=>{});
  await p.waitForTimeout(2500);
  return p;
}
const A = await user('Luke', { width: 1280, height: 800 });
const M = await user('Mia', { width: 390, height: 844 }, true); M.on('websocket', w => w.on('framereceived', f => console.log('M WS<-', String(f.payload).slice(0,90))));
ok('A logged in as Luke', await A.evaluate(() => window.__store.getState().me) === 'Luke');
ok('M logged in as Mia', await M.evaluate(() => window.__store.getState().me) === 'Mia');
ok('seed loaded (6 stops)', await A.evaluate(() => window.__store.getState().data.stops.length) === 6);
// A comments + activity + reaction via real API through page
const r = await A.evaluate(async () => {
  const j = (m, u, b) => fetch(u, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, b: await x.json().catch(() => null) }));
  const c = await j('POST', '/api/comments', { targetType: 'stop', targetId: 's3', body: 'Tea ceremony in Gion?' });
  const a = await j('POST', '/api/activities', { stopId: 's3', kind: 'activity', title: 'Arashiyama bamboo', status: 'idea' });
  const re = await j('POST', '/api/reactions', { targetType: 'activity', targetId: a.b.id, emoji: '👎' });
  return { c: c.s, a: a.s, re: re.s };
});
ok('API create comment/activity/reaction', r.c === 201 && r.a === 201 && (r.re === 201 || r.re === 200), JSON.stringify(r));
await M.waitForFunction(() => { const d = window.__store.getState().data; return d.activities.some(x => x.title === 'Arashiyama bamboo') && d.reactions.length >= 1; }, null, { timeout: 20000 }).catch(() => {});
const mia = await M.evaluate(() => { const d = window.__store.getState().data; return { c: d.comments.some(x => x.body.includes('Tea ceremony') && x.author === 'Luke'), a: d.activities.some(x => x.title === 'Arashiyama bamboo'), r: d.reactions.length }; });
console.log('DBG M', JSON.stringify(await M.evaluate(() => { const d = window.__store.getState().data; return { acts: d.activities.length, com: d.comments.length, rx: d.reactions.length }; })), 'A', JSON.stringify(await A.evaluate(() => { const d = window.__store.getState().data; return { acts: d.activities.length, com: d.comments.length, rx: d.reactions.length }; })));
ok('Mia received live comment', mia.c); ok('Mia received live activity', mia.a); ok('Mia received live reaction', mia.r >= 1, String(mia.r));
// presence
await A.evaluate(() => window.__store.getState().set({ selectedStopId: 's3' }));
await M.waitForTimeout(2000);
const pres = await M.evaluate(() => window.__store.getState().online);
ok('presence: Mia sees Luke viewing s3', pres.some(u => u.name === 'Luke' && u.stopId === 's3'), JSON.stringify(pres));
// UI: Mia adds a comment through the panel
await M.evaluate(() => window.__store.getState().set({ selectedStopId: 's3' }));
await M.waitForTimeout(1500);
await M.screenshot({ path: 'shots/e2e_mia_panel.png' });
await A.waitForTimeout(500); await A.screenshot({ path: 'shots/e2e_luke.png' });
await A.evaluate(() => window.__store.getState().set({ menuOpen: true })); await A.waitForTimeout(1200); await A.screenshot({ path: 'shots/e2e_drawer.png' });
// persistence check via fresh fetch
const cnt = await A.evaluate(async () => (await (await fetch('/api/trip')).json()).comments.length);
ok('comment persisted server-side', cnt >= 1, String(cnt));
// unauth
const un = await (await fetch(B + '/api/trip')).status; ok('unauthenticated /api/trip is 401', un === 401, String(un));
console.log(out.join('\n')); console.log('page errors:', JSON.stringify([...A.errs, ...M.errs]));
await b.close();
