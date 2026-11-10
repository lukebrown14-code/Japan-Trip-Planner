import { describe, expect, it } from 'vitest';
import { connectionWarnings, draftFor, fingerprint, validateDraft, type Draft } from './editorLogic';
import type { JourneyView } from '../../transport/viewModel';
const draft = (patch:Partial<Draft>={}):Draft => ({segments:[],cost:'',confirmation:'',notes:'',...patch});
const view = (patch:Partial<JourneyView>={}):JourneyView => ({key:'leg:a:b',legacy:true,services:[{id:'l',ord:0,status:'to_book',service:'Service not set',fromStation:'City A',toStation:'City B',departLabel:'Time not set',arriveLabel:'Time not set',statusLabel:'To book'}],adults:2,reviewReasons:[],journey:{date:'2026-10-05',routeKey:'a:b'},...patch} as JourneyView);
describe('journey editor drafts',()=> {
  it('does not fabricate a service from a route-only legacy fallback',()=>{expect(draftFor(view()).segments).toEqual([]);});
  it('preserves meaningful legacy timing and references without display-only fields',()=>{const v=view();v.services[0].departTime='09:30';v.confirmation='LEGACY';const d=draftFor(v);expect(d.segments[0].departTime).toBe('09:30');expect(d.segments[0]).not.toHaveProperty('departLabel');expect(d.confirmation).toBe('LEGACY');});
  it('preserves deliberately empty saved services',()=>{expect(draftFor(view({legacy:false,services:[]})).segments).toEqual([]);});
  it('accepts web booking URLs, preserves them in drafts, and rejects unsafe URLs',()=>{
    const s={id:'s',ord:0,status:'booked' as const,bookingUrl:'https://smart-ex.jp/en/'};
    expect(validateDraft(draft({segments:[s]}))).toBeUndefined();
    const v=view({legacy:false});v.services[0].bookingUrl=s.bookingUrl;
    expect(draftFor(v).segments[0].bookingUrl).toBe(s.bookingUrl);
    for(const bookingUrl of ['javascript:alert(1)','data:text/html,test','not a URL','https://example.com/'+ 'x'.repeat(500)])
      expect(validateDraft(draft({segments:[{...s,bookingUrl}]}))).toMatch(/booking URL/);
  });
  it('rejects invalid money and accepts the boundary',()=>{expect(validateDraft(draft({cost:'1.5'}))).toMatch(/whole yen/);expect(validateDraft(draft({cost:'100000001'}))).toMatch(/whole yen/);expect(validateDraft(draft({cost:'100000000'}))).toBeUndefined();});
  it('requires explicit offsets for overnight services',()=>{const s={id:'s',ord:0,status:'booked' as const,departTime:'23:10',arriveTime:'01:20'};expect(validateDraft(draft({segments:[s]}))).toMatch(/arrival is before/);expect(validateDraft(draft({segments:[{...s,arriveDayOffset:1}]}))).toBeUndefined();});
  it('rejects fractional and excessive offsets',()=>{for(const offset of [0.5,31,-1])expect(validateDraft(draft({segments:[{id:'s',ord:0,status:'to_book',departDayOffset:offset}]}))).toMatch(/whole numbers/);});
  it('warns about backwards connections without blocking the draft',()=>{const segments=[{id:'a',ord:0,status:'booked' as const,arriveTime:'10:00'},{id:'b',ord:1,status:'booked' as const,departTime:'09:00'}];expect(connectionWarnings(segments)).toHaveLength(1);expect(validateDraft(draft({segments}))).toBeUndefined();expect(connectionWarnings([{...segments[0],arriveDayOffset:1},{...segments[1],departDayOffset:2}])).toEqual([]);});
  it('detects removed journeys and itinerary review changes',()=>{expect(fingerprint(undefined)).not.toBe(fingerprint(view()));expect(fingerprint(view({reviewReasons:['Travellers changed']}))).not.toBe(fingerprint(view()));expect(fingerprint(view({currentAdults:3}))).not.toBe(fingerprint(view({currentAdults:2}))); });
  it('enforces full-array limit and optional field limits',()=>{expect(validateDraft(draft({segments:Array.from({length:13},(_,i)=>({id:String(i),ord:i,status:'to_book'}))}))).toMatch(/at most 12/);expect(validateDraft(draft({segments:[{id:'s',ord:0,status:'booked',seatDetails:'a'.repeat(121)}]}))).toMatch(/character limit/);});
});
