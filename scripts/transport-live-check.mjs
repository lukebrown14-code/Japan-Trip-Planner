// This check edits bookings. Run only against a local built server with an isolated test database.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.TRANSPORT_LIVE_URL ?? 'http://127.0.0.1:3218';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Live checks require a local isolated test server');
const passphrase=process.env.TRANSPORT_TEST_PASSPHRASE ?? 'transport-local-check';
const route=`/transport/journeys/${encodeURIComponent('leg:s0:s1')}`;
const browser=await chromium.launch();
try {
  const pages=[];
  for(const name of ['Luke','Partner']) {
    const context=await browser.newContext({viewport:{width:390,height:844}});
    const login=await context.request.post(`${base}/api/login`,{data:{name,passphrase}});assert.equal(login.status(),204);
    const page=await context.newPage();await page.goto(`${base}${route}`);await page.locator('.ws-detail-heading').waitFor();
    await page.waitForFunction(()=>!!window.__store.getState().me);pages.push(page);
  }
  const [a,b]=pages;
  const edit=async p=>p.getByRole('button',{name:'Edit journey',exact:true}).click();
  const save=async p=>{await p.getByRole('button',{name:'Save changes',exact:true}).click();await p.locator('.je-editor').waitFor({state:'detached'});};
  await edit(a);
  await a.getByLabel('Service reference',{exact:true}).fill('LIVE-SERVICE-123');
  await a.getByLabel('Seat details',{exact:true}).fill('Car 2, 3A');
  await a.getByLabel('Collection / boarding instructions',{exact:true}).fill('Collect before boarding');
  await a.getByLabel('Booking status').selectOption('to_book');
  await save(a);
  await b.waitForFunction(()=>window.__store.getState().data.transportBookings.find(r=>r.journeyKey==='leg:s0:s1')?.segments?.[0]?.confirmation==='LIVE-SERVICE-123');
  assert.match(await b.locator('.ws-detail').innerText(),/1 service left to book/);
  // Keep a dirty collaborator draft while the first traveller saves another update.
  await edit(b);await b.getByLabel('Journey notes',{exact:true}).fill('Partner draft');
  await edit(a);await a.getByLabel('Service reference',{exact:true}).fill('LATEST-REF');await save(a);
  await b.getByRole('button',{name:'Discard draft and reload latest',exact:true}).waitFor();
  assert.equal(await b.getByLabel('Journey notes',{exact:true}).inputValue(),'Partner draft');
  await b.getByRole('button',{name:'Save changes',exact:true}).click();assert.match(await b.locator('.je-error').innerText(),/changed while you were editing/);
  await b.getByRole('button',{name:'Discard draft and reload latest',exact:true}).click();
  assert.equal(await b.getByLabel('Service reference',{exact:true}).inputValue(),'LATEST-REF');
  await b.getByRole('button',{name:'Cancel',exact:true}).click();
  await edit(a);
  await a.getByLabel('Service reference',{exact:true}).fill('');await a.getByLabel('Seat details',{exact:true}).fill('');await a.getByLabel('Collection / boarding instructions',{exact:true}).fill('');
  await a.getByLabel('Journey reference',{exact:true}).fill('');await a.getByLabel('Journey notes',{exact:true}).fill('');await a.getByLabel('Total paid for group (¥)',{exact:true}).fill('');
  await a.getByLabel('Booking status').selectOption('booked');
  await a.getByLabel('Departure time',{exact:true}).fill('23:00');await a.getByLabel('Arrival time',{exact:true}).fill('01:10');await a.getByLabel('Arrival date').selectOption('1');
  await save(a);
  await b.waitForFunction(()=>{const row=window.__store.getState().data.transportBookings.find(r=>r.journeyKey==='leg:s0:s1');return row?.segments?.[0]?.arriveDayOffset===1 && row.segments[0].confirmation===undefined && row.confirmation===undefined && row.notes===undefined && row.cost===undefined;});
  await a.reload();await a.locator('.ws-detail-heading').waitFor();assert.match(await a.locator('.ws-detail').innerText(),/01:10 \(\+1 day\)/);
  await b.getByRole('link',{name:'Today',exact:true}).click();await b.locator('.chips button').filter({hasText:'28 Oct'}).click();
  const travel=b.locator('.day-entry').filter({hasText:'Tokyo → Nikko'});await travel.locator('summary').click();assert.match(await travel.innerText(),/En route/);assert.match(await travel.innerText(),/01:10 \(\+1 day\)/);
  console.log('PASS real server: WebSocket service details, dirty collaborator conflict, field clearing, overnight persistence and Today consistency');
} finally {await browser.close();}
