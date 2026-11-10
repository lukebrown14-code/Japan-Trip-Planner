import { describe, expect, it } from 'vitest';
import { SEED } from '../data/seed';
import { journeyView, journeyViews, timeLabel } from './viewModel';
import { intercityOrphanBookings, transportTasks } from './progress';
import { transportHref, transportRouteKey } from './routes';
const fixture=()=>structuredClone(SEED);
describe('intercity presentation shared across views',()=>{
  it('excludes airport/pass/day-trip data without changing it',()=>{
    const data=fixture(); const before=JSON.stringify(data);
    expect(journeyViews(data).map(j=>j.key)).toEqual(['leg:s0:s1','leg:s1:s2','leg:s2:s3','leg:s3:s4','leg:s4:s5','leg:s5:s6']);
    expect(journeyView(data,'flight:f1')).toBeUndefined();
    expect(JSON.stringify(data)).toBe(before);
  });
  it('finishes in Tokyo on 5 November without duplicating the airport services',()=>{
    const data=fixture(); const final=journeyViews(data).at(-1)!;
    expect(final).toMatchObject({key:'leg:s5:s6',date:'2026-11-05',arranged:false});
    expect(final.journey).toMatchObject({from:'Hakone',to:'Tokyo'});
    expect(final.services.map(s=>s.toStation)).toEqual(['Odawara','Tokyo']);
    expect(final.departTime).toBeUndefined(); expect(final.arriveTime).toBeUndefined();
    const airport=data.transportBookings!.find(b=>b.journeyKey==='flight:f2')!;
    expect(airport.routeKey).toBe('tokyo:nrt'); expect(airport.segments).toHaveLength(1);
    expect(airport.segments![0].fromStation).toBe('Tokyo');
  });
  it('shows the confirmed Hikari booking without treating Odawara as the final Hakone arrival',()=>{
    const view=journeyView(fixture(),'leg:s4:s5')!;
    expect(view.date).toBe('2026-11-04');
    expect(view.services[0]).toMatchObject({service:'Hikari 646',fromStation:'Shin-Osaka',toStation:'Odawara',departTime:'10:18',arriveTime:'12:38',status:'booked',seatDetails:'Reserved seat · Mt. Fuji preference'});
    expect(view.departTime).toBe('10:18'); expect(view.arriveTime).toBeUndefined();
    expect(view.services[1].status).toBe('to_book');
  });
  it('records the Hida 36 reserved seats for two adults on the existing Kyoto leg',()=>{
    const data=fixture(); const view=journeyView(data,'leg:s2:s3')!;
    expect(view).toMatchObject({date:'2026-10-31',adults:2,departTime:'15:34',arriveTime:'19:17'});
    expect(view.services[0]).toMatchObject({service:'Hida 36',fromStation:'Takayama',toStation:'Kyoto',status:'booked',seatDetails:'Reserved seat'});
    expect(data.transportBookings!.filter(b=>b.journeyKey==='leg:s2:s3')).toHaveLength(1);
  });
  it('records Yamabiko 208 non-reserved seats within the existing Takayama journey',()=>{
    const view=journeyView(fixture(),'leg:s1:s2')!;
    expect(view).toMatchObject({date:'2026-10-29',adults:2});
    expect(view.services[1]).toMatchObject({service:'Yamabiko 208',fromStation:'Utsunomiya',toStation:'Omiya',departTime:'09:06',arriveTime:'09:34',status:'booked',seatDetails:'Non-reserved seat'});
    expect(view.transfers[1].minutes).toBe(11);
  });
  it('records Kagayaki 507 reserved seats after the Yamabiko connection',()=>{
    const view=journeyView(fixture(),'leg:s1:s2')!;
    expect(view).toMatchObject({date:'2026-10-29',adults:2});
    expect(view.services[2]).toMatchObject({service:'Kagayaki 507',fromStation:'Omiya',toStation:'Toyama',departTime:'09:45',arriveTime:'11:32',status:'booked',seatDetails:'Reserved seat'});
    expect(view.transfers[1]).toMatchObject({minutes:11,stationChanged:false});
    expect(view.services[3].status).toBe('to_book');
  });
  it('preserves official booking links in service views',()=>{
    const views=journeyViews(fixture());
    expect(views.find(v=>v.key==='leg:s4:s5')!.services[0].bookingUrl).toBe('https://smart-ex.jp/en/');
    expect(views.find(v=>v.key==='leg:s1:s2')!.services[2].bookingUrl).toBe('https://www.eki-net.com/en/jreast-train-reservation/Top/Index');
    expect(views.find(v=>v.key==='leg:s2:s3')!.services[0].bookingUrl).toBe('https://www.westjr.co.jp/travel-information/en/tickets-passes/route-search/');
  });
  it('uses saved services rather than conflicting leg data',()=>{
    const data=fixture(); data.legs[0]={...data.legs[0],departTime:'01:00',arriveTime:'02:00',confirmation:'OLD'};
    const view=journeyView(data,'leg:s0:s1')!;
    expect(view.departTime).toBe('09:30'); expect(view.arriveTime).toBe('11:22');
    expect(view.confirmation).toContain('DEMO-REF-0001'); expect(view.legacy).toBe(false);
  });
  it('keeps pay-on-day arrangement separate from missing travel times',()=>{
    const view=journeyView(fixture(),'leg:s3:s4')!;
    expect(view).toMatchObject({arranged:true,status:'arranged',nextAction:'Transport arranged'});
    expect(view.services[0].statusLabel).toBe('Pay on the day');
    expect(view.missingDetails).toContain('Service 1: times not set.');
  });
  it('shows intermediate arrival times and the actual transfer interval',()=>{
    const view=journeyView(fixture(),'leg:s1:s2')!;
    expect(view.services[1].arriveLabel).toBe('09:34');
    expect(view.transfers[1]).toMatchObject({minutes:11,stationChanged:false});
    expect(view.nextAction).toBe('1 service left to book');
    expect(transportTasks(fixture()).find(t=>t.journey?.key===view.key)?.nextAction).toBe(view.nextAction);
  });
  it('handles explicit overnight days, unknown connections and station changes',()=>{
    const data=fixture(); const b=data.transportBookings![0];
    b.segments=[{id:'night',ord:0,status:'booked',fromStation:'A',toStation:'B',departTime:'23:00',arriveTime:'02:00',arriveDayOffset:1},
      {id:'second',ord:1,status:'na',fromStation:'C',toStation:'D',departTime:'02:30',departDayOffset:1}];
    const view=journeyView(data,b.journeyKey!)!;
    expect(view.services[0].arriveLabel).toBe('02:00 (+1 day)');
    expect(view.transfers[0]).toMatchObject({minutes:30,stationChanged:true});
    expect(view.services[1].arriveLabel).toBe('Time not set');
    expect(timeLabel(undefined,1)).toBe('Time not set');
  });
  it('warns about overlapping services without inventing a connection time',()=>{
    const data=fixture(); const b=data.transportBookings![0];
    b.segments=[{id:'a',ord:0,status:'booked',arriveTime:'10:00'},{id:'b',ord:1,status:'to_book',departTime:'09:00'}];
    expect(journeyView(data,b.journeyKey!)!.transfers[0]).toMatchObject({minutes:-60,warning:expect.any(String)});
    b.segments[1].departTime=undefined;
    expect(journeyView(data,b.journeyKey!)!.transfers[0].minutes).toBeUndefined();
  });
  it('surfaces changed dates while retaining confirmations and services',()=>{
    const data=fixture(); data.stops[1].arrive='2026-10-28';
    const view=journeyView(data,'leg:s0:s1')!;
    expect(view).toMatchObject({status:'needs_review',arranged:false});
    expect(view.reviewReasons[0]).toContain('Travel date changed');
    expect(view.confirmation).toContain('DEMO-REF-0001');
    expect(view.services).toHaveLength(1);
  });
  it('falls back to saved leg details without using graph estimates',()=>{
    const data=fixture(); data.transportBookings=[];
    data.legs[0]={...data.legs[0],departTime:'23:00',arriveTime:'02:00',confirmation:'LEG-REF'};
    const view=journeyView(data,'leg:s0:s1')!;
    expect(view).toMatchObject({legacy:true,departTime:'23:00',arriveTime:'02:00',arriveDayOffset:1,confirmation:'LEG-REF'});
    expect(view.services[0].arriveLabel).toBe('02:00 (+1 day)');
  });
  it('retains removed intercity bookings but excludes excluded-kind orphans',()=>{
    const data=fixture(); data.transportBookings=[
      {id:'city',kind:'journey',journeyKey:'leg:removed:gone',purchased:true,seatReserved:true,confirmation:'KEEP'},
      {id:'airport',kind:'journey',journeyKey:'flight:gone',purchased:true,seatReserved:true},
      {id:'day',kind:'journey',sourceType:'activity',purchased:true,seatReserved:true},
      {id:'pass',kind:'pass',purchased:true,seatReserved:false}];
    expect(intercityOrphanBookings(data).map(b=>b.id)).toEqual(['city']);
    expect(transportTasks(data).filter(t=>!t.journey).map(t=>t.key)).toEqual(['transport-orphan-city']);
    expect(data.transportBookings).toHaveLength(4);
  });
  it('never restores cleared booking fields or explicitly removed services from a legacy leg',()=>{
    const data=fixture();data.legs[0]={...data.legs[0],status:'booked',confirmation:'OLD',notes:'OLD NOTES',cost:999,departTime:'08:00',arriveTime:'09:00'};
    data.transportBookings![0]={...data.transportBookings![0],confirmation:undefined,notes:undefined,cost:undefined,segments:[]};
    const view=journeyView(data,'leg:s0:s1')!;
    expect(view).toMatchObject({legacy:false,services:[],arranged:false,status:'to_arrange',nextAction:'Add services and booking details'});
    expect(view.confirmation).toBeUndefined();expect(view.notes).toBeUndefined();expect(view.totalPaid).toBeUndefined();expect(view.departTime).toBeUndefined();
    expect(transportTasks(data).find(t=>t.journey?.key===view.key)).toMatchObject({ready:false,nextAction:view.nextAction});
  });
  it('does not fabricate a service or station from a bare legacy leg',()=>{
    const data=fixture();data.transportBookings=[];
    data.legs[0]={id:'l0',fromStop:'s0',toStop:'s1',status:'to_book'};
    const view=journeyView(data,'leg:s0:s1')!;
    expect(view.legacy).toBe(true);expect(view.services).toEqual([]);expect(view.departTime).toBeUndefined();
    data.legs[0].departTime='09:00';
    const timed=journeyView(data,'leg:s0:s1')!;expect(timed.services[0].fromStation).toBeUndefined();expect(timed.services[0].toStation).toBeUndefined();
  });
  it('handles empty trips and lossless encoded journey routes',()=>{
    const data=fixture();data.stops=[];
    expect(journeyViews(data)).toEqual([]);
    const key='leg:city one:city/two';expect(transportRouteKey(transportHref(key))).toBe(key);
    expect(transportRouteKey('/transport/journeys/%ZZ')).toBeUndefined();
  });
});
