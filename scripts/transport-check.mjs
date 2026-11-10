// Isolated mock browser contexts: no real trip data is modified.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base = process.env.TRANSPORT_PREVIEW_URL ?? 'http://127.0.0.1:5180';
const route = key => `/transport/journeys/${encodeURIComponent(key)}`;
const browser = await chromium.launch();
try {
  for (const [width,height] of [[320,568],[390,844],[768,1024],[1280,900]]) {
    const context=await browser.newContext({viewport:{width,height}}); const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/transport`);
    const rows=page.locator('.ws-journey-row');await rows.first().waitFor();
    assert.equal(await rows.count(),6);assert.equal(await page.locator('.je-editor').count(),0);
    assert.match(await page.locator('.ws-progress').innerText(),/3\s*\/\s*6/);
    const layout=await page.locator('.ws-page').evaluate(el=>({overflow:el.scrollWidth-el.clientWidth}));assert.ok(layout.overflow<=1);
    await page.screenshot({path:`/tmp/transport-workspace-${width}.png`});
    await rows.filter({hasText:'Nikko → Takayama'}).click();
    await page.locator('.ws-detail-heading').waitFor();
    assert.match(await page.locator('.ws-detail').innerText(),/09:34/);assert.match(await page.locator('.ws-detail').innerText(),/11 min connection/);
    await page.screenshot({path:`/tmp/transport-detail-${width}.png`});
    await page.getByRole('button',{name:'Edit journey',exact:true}).click();
    await page.getByLabel('Service name / number',{exact:true}).fill('Edited local service');
    assert.equal(await page.locator('.je-service-fields').count(),1);
    await page.getByRole('link',{name:'Today',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Save your changes?'});await dialog.waitFor();
    assert.equal(await page.locator('#root').evaluate(el=>el.inert),true);
    await page.getByRole('button',{name:'Keep editing',exact:true}).click();
    assert.equal(await page.getByLabel('Service name / number',{exact:true}).inputValue(),'Edited local service');
    assert.equal(await page.locator('#root').evaluate(el=>el.inert),false);
    await page.getByRole('button',{name:'Cancel',exact:true}).click();await dialog.waitFor();
    await page.getByRole('button',{name:'Discard and leave',exact:true}).click();
    await page.getByRole('button',{name:'Edit journey',exact:true}).click();
    assert.equal(await page.getByLabel('Service name / number',{exact:true}).inputValue(),'JR local');
    // Editor save bar remains in the visual viewport before and after a short keyboard-sized viewport.
    await page.setViewportSize({width,height:Math.min(height,500)});
    const savebar=await page.locator('.je-savebar').boundingBox();assert.ok(savebar.y>=0 && savebar.y+savebar.height<=Math.min(height,500)+1,JSON.stringify(savebar));
    await page.setViewportSize({width,height});
    await page.getByLabel('Service reference',{exact:true}).fill('UI-SERVICE-123');
    await page.getByLabel('Seat details',{exact:true}).fill('Car 2, seats 3A and 3B');
    await page.getByLabel('Collection / boarding instructions',{exact:true}).fill('Collect at the station');
    if(width===390) {
      await page.evaluate(async()=>{const {api}=await import('/src/api.ts');const original=api.save;let once=true;api.save=async(...args)=>{if(once){once=false;throw new Error('Simulated connection failure');}return original(...args);};});
      await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.getByRole('alert').waitFor();
      assert.equal(await page.getByLabel('Service reference',{exact:true}).inputValue(),'UI-SERVICE-123');
      await page.getByRole('button',{name:'Retry save',exact:true}).click();
    } else await page.getByRole('button',{name:'Save changes',exact:true}).click();
    await page.locator('.je-editor').waitFor({state:'detached'});
    assert.equal(await page.evaluate(()=>document.activeElement?.tagName),'H2');
    await page.waitForFunction(()=>window.__store.getState().data.transportBookings.find(b=>b.journeyKey==='leg:s1:s2').segments[0].confirmation==='UI-SERVICE-123');
    assert.match(await page.locator('.ws-detail').innerText(),/UI-SERVICE-123/);
    await page.reload();await page.locator('.ws-detail-heading').waitFor();assert.match(await page.locator('.ws-detail').innerText(),/UI-SERVICE-123/);
    assert.deepEqual(errors,[]);
    console.log(`PASS ${width}px: intercity-only overview, service arrivals/transfers, read/edit separation, dirty guard, save, persistence, save-bar visibility`);
    await context.close();
  }
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.goto(`${base}/transport`);await page.locator('.ws-journey-row').first().click();await page.getByRole('button',{name:'Edit journey',exact:true}).click();
  await page.getByLabel('Service reference',{exact:true}).fill('DRAFT');
  await page.goBack();await page.getByRole('dialog',{name:'Save your changes?'}).waitFor();await page.getByRole('button',{name:'Keep editing',exact:true}).click();
  assert.equal(await page.getByLabel('Service reference',{exact:true}).inputValue(),'DRAFT');
  // Collaborator update arriving while editing retains the draft and blocks an unapproved overwrite.
  await page.evaluate(()=>{const st=window.__store.getState();const b=st.data.transportBookings.find(b=>b.journeyKey==='leg:s0:s1');st.replaceEntity('transportBookings',{...b,confirmation:'COLLABORATOR-REF'});});
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  assert.match(await page.locator('.je-error').innerText(),/changed while you were editing/);
  assert.equal(await page.getByLabel('Service reference',{exact:true}).inputValue(),'DRAFT');
  await page.getByRole('button',{name:'Discard draft and reload latest',exact:true}).click();assert.equal(await page.getByLabel('Journey reference',{exact:true}).inputValue(),'COLLABORATOR-REF');
  await page.getByLabel('Service reference',{exact:true}).fill('REMOVED-DRAFT');
  await page.evaluate(()=>{const st=window.__store.getState();st.set({data:{...st.data,stops:st.data.stops.filter(s=>s.id!=='s1')}});});
  assert.equal(await page.getByLabel('Service reference',{exact:true}).inputValue(),'REMOVED-DRAFT');assert.equal(await page.getByRole('button',{name:'Save changes',exact:true}).isDisabled(),true);
  console.log('PASS browser Back guard, collaborator conflict and removed-journey draft retention');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Discard and leave',exact:true}).click();
  for(const path of ['/transport/journeys/missing','/transport/journeys/']) {
    await page.goto(`${base}${path}`);await page.getByRole('heading',{name:'Journey no longer available',exact:true}).waitFor();
  }
  await page.getByRole('button',{name:'← All journeys',exact:true}).click();
  assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'Between cities');
  await page.goto(`${base}${route('leg:s0:s1')}`);await page.getByRole('button',{name:'Edit journey',exact:true}).click();
  await page.getByRole('button',{name:'Remove service',exact:true}).click();await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await page.locator('.je-editor').waitFor({state:'detached'});assert.equal(await page.locator('.ws-services .ws-service').count(),0);
  await page.getByRole('button',{name:'Edit journey',exact:true}).click();assert.equal(await page.locator('.je-service').count(),0);
  await page.getByRole('button',{name:'Add service',exact:true}).click();await page.getByLabel('Service name / number',{exact:true}).fill('Overnight train');
  await page.getByLabel('Departure time',{exact:true}).fill('23:00');await page.getByLabel('Arrival time',{exact:true}).fill('01:00');await page.getByLabel('Arrival date').selectOption('1');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.locator('.je-editor').waitFor({state:'detached'});
  assert.match(await page.locator('.ws-detail').innerText(),/01:00 \(\+1 day\)/);
  console.log('PASS missing routes, focus restoration, removing all services and overnight date editing');
} finally {await browser.close();}
