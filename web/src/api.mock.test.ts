import { afterEach, beforeEach, expect, it, vi } from 'vitest';
let saved: Map<string,string>;
beforeEach(()=>{
  vi.resetModules();saved=new Map();
  vi.stubGlobal('localStorage',{getItem:(k:string)=>saved.get(k)??null,setItem:(k:string,v:string)=>saved.set(k,v),removeItem:(k:string)=>saved.delete(k)});
});
afterEach(()=>vi.unstubAllGlobals());
it('mock saves clear optional fields and nested details consistently across reloads',async()=>{
  let {mockApi}=await import('./api.mock');
  await mockApi.save('transportBookings',{id:'test-clear',kind:'journey',confirmation:'REF',cost:100,
    segments:[{id:'service',ord:0,status:'booked',confirmation:'SERVICE',seatDetails:'3A'}]});
  await mockApi.save('transportBookings',{id:'test-clear',confirmation:null,cost:null,
    segments:[{id:'service',ord:0,status:'booked',confirmation:null}]});
  vi.resetModules();({mockApi}=await import('./api.mock'));
  const booking=(await mockApi.trip()).transportBookings!.find(b=>b.id==='test-clear')!;
  expect(booking).not.toHaveProperty('confirmation');expect(booking).not.toHaveProperty('cost');
  expect(booking.segments).toEqual([{id:'service',ord:0,status:'booked'}]);
});
it('imports existing cached reservations once and preserves later edits and deletions across reloads', async () => {
  const { SEED } = await import('./data/seed');
  const oldTrip = structuredClone(SEED);
  oldTrip.stops.pop(); oldTrip.legs.pop(); oldTrip.transportBookings = [];
  oldTrip.stops[5].hotelName = 'Saved Hakone hotel';
  saved.set('japan-mock-trip', JSON.stringify(oldTrip));
  let { mockApi } = await import('./api.mock');
  const imported = await mockApi.trip();
  expect(imported.stops).toHaveLength(7);
  expect(imported.stops[5].hotelName).toBe('Saved Hakone hotel');
  expect(imported.transportBookings).toHaveLength(7);
  expect(imported).not.toHaveProperty('_dataImports');
  await mockApi.save('transportBookings', { id: 'tj-hakone', notes: 'Edited after import' });
  await mockApi.remove('transportBookings', 'tj-kyoto');
  vi.resetModules(); ({ mockApi } = await import('./api.mock'));
  const reloaded = await mockApi.trip();
  expect(reloaded.transportBookings).toHaveLength(6);
  expect(reloaded.transportBookings!.find(b => b.id === 'tj-hakone')!.notes).toBe('Edited after import');
  expect(reloaded.transportBookings!.some(b => b.id === 'tj-kyoto')).toBe(false);
});
