import { describe, expect, it } from 'vitest';
import type { TransportSegment } from '@shared/types';
import { SEED } from '../data/seed';
import { route } from './catalogue';
import { buildJourneys, comparePasses, journeysChronological, journeySegments, passCoversJourney, type Journey } from './planner';
const journey=(key:string,date:string,fare:number|undefined,extra={}):Journey=>({key,date,type:'intercity',title:key,from:'A',to:'B',sourceType:'leg',sourceId:key,routeKey:key,options:[route('jr','JR','', 'https://example.test',{fare,fullyCoveredBy:['jr'],...extra})]});
describe('transport planning',()=>{
 it('prices return transport for planned day trips and leaves ideas out of booking totals',()=>{
  const activity={id:'day',stopId:'s2',kind:'day_trip' as const,title:'Shirakawa-go',destName:'Shirakawago',day:'2026-10-29',status:'planned' as const};
  const data={...SEED,stops:[SEED.stops[2]],flights:[],activities:[activity,{...activity,id:'idea',status:'idea' as const}]};
  const journeys=buildJourneys(data);
  expect(journeys).toHaveLength(1);
  expect(journeys[0].options[0].fare).toBe(5600);
  expect(comparePasses(journeys,2)[0].total).toBe(11200);
 });
 it('generates ordered consecutive journeys and flight transfers without relying on map timings',()=>{const result=buildJourneys(SEED);expect(result.filter(j=>j.type==='intercity')).toHaveLength(6);expect(result.find(j=>j.type==='airport')?.date).toBe('2026-10-24');expect(result[0].fromStopId).toBe('s0');});
 it('retains unsupported journeys and does not invent fares',()=>{const data={...SEED,stops:SEED.stops.map(s=>({...s,cityKey:'unknown'}))};expect(buildJourneys(data)[0].options[0].supported).toBe(false);expect(buildJourneys(data)[0].options[0].fare).toBeUndefined();});
 it('includes days one through seven and excludes day eight',()=>{expect(passCoversJourney('jr-7',journey('a','2026-10-07',100),'2026-10-01')).toBe(true);expect(passCoversJourney('jr-7',journey('b','2026-10-08',100),'2026-10-01')).toBe(false);});
 it('chooses the highest-value activation window and multiplies adults once',()=>{const rows=comparePasses([journey('a','2026-10-01',1000),journey('b','2026-10-08',40000),journey('c','2026-10-14',40000)],2);const pass=rows.find(p=>p.passId==='jr-7')!;expect(pass.total).toBe(102000);expect(pass.coveredJourneyKeys).toEqual(['b','c']);expect(pass.savings).toBe(60000);expect(rows[0].total).toBe(162000);});
 it('counts only uncovered supplements on mixed-operator journeys',()=>{const j=journey('mixed','2026-10-01',5000,{fullyCoveredBy:[],jrCoveredFare:4000});const pass=comparePasses([j],2).find(p=>p.passId==='jr-7')!;expect(pass.total).toBe(102000);expect(passCoversJourney('jr-7',j,'2026-10-01')).toBe(false);});
 it('never treats missing fares as zero in a complete total',()=>{const j=journey('unknown','2026-10-01',undefined,{fullyCoveredBy:[]});const rows=comparePasses([j],2);expect(rows[0].total).toBeUndefined();expect(rows.find(p=>p.passId==='jr-7')?.incomplete).toBe(true);});
 it('can price a pass covering unknown individual fares, without claiming savings',()=>{const pass=comparePasses([journey('a','2026-10-01',undefined)],2).find(p=>p.passId==='jr-7')!;expect(pass.total).toBe(100000);expect(pass.savings).toBeUndefined();});
 it('honours selected alternatives and does not claim regional coverage via Nagoya',()=>{const j=buildJourneys(SEED).find(j=>j.routeKey==='takayama:kyoto')!;expect(passCoversJourney('takayama-hokuriku',j,j.date,'hida-nagoya')).toBe(false);expect(passCoversJourney('takayama-hokuriku',j,j.date,'hida-toyama')).toBe(true);});
 it('uses a matching saved quote and ignores quotes after dates change',()=>{
  const first=buildJourneys(SEED)[0];
  const booking={id:'b',kind:'journey' as const,journeyKey:first.key,routeKey:first.routeKey,travelDate:first.date,selectedOption:first.options[0].id,fareEstimate:4200,purchased:false,seatReserved:false};
  expect(buildJourneys({...SEED,transportBookings:[booking]})[0].options[0].fare).toBe(4200);
  expect(buildJourneys({...SEED,transportBookings:[{...booking,travelDate:'2026-10-01'}]})[0].options[0].fare).toBeUndefined();
 });
 it('prefers a complete window over a lower incomplete subtotal',()=>{
  const rows=comparePasses([journey('unknown','2026-10-01',undefined),journey('known','2026-10-20',90000)],1);
  const pass=rows.find(p=>p.passId==='jr-7')!;
  expect(pass.incomplete).toBe(false);
  expect(pass.total).toBe(140000);
  expect(pass.coveredJourneyKeys).toEqual(['unknown']);
 });
 it('honours the tracked activation date instead of silently choosing an earlier window',()=>{
  const journeys=[journey('early','2026-10-01',40000),journey('late','2026-10-08',1000)];
  const optimal=comparePasses(journeys,1).find(p=>p.passId==='jr-7')!;
  expect(optimal.total).toBe(51000);
  const tracked=comparePasses(journeys,1,{}, {'jr-7':'2026-10-08'}).find(p=>p.passId==='jr-7')!;
  expect(tracked.total).toBe(90000);
  expect(tracked.activationDate).toBe('2026-10-08');
  expect(tracked.coveredJourneyKeys).toEqual(['late']);
 });
 it('unknown dates cannot imply pass coverage',()=>{const j={...journey('a','2026-10-01',100),date:undefined};expect(passCoversJourney('jr-7',j,'2026-10-01')).toBe(false);});
});

describe('journey list contract',()=>{
  const seg=(id:string,ord:number,status:TransportSegment['status']):TransportSegment=>({id,ord,status});
  const booking=(journeyKey:string,segments:TransportSegment[],extra={})=>({id:'b',kind:'journey' as const,journeyKey,purchased:false,seatReserved:false,segments,...extra});
  it('lists intercity and airport journeys chronologically and excludes day trips',()=>{
    const dayTrip={id:'day',stopId:'s1',kind:'day_trip' as const,title:'Edo Wonderland',destName:'Nikko',day:'2026-10-27',status:'planned' as const};
    const data={...SEED,activities:[dayTrip]};
    expect(journeysChronological(data).map(j=>j.key)).toEqual(['flight:f1','leg:s0:s1','leg:s1:s2','leg:s2:s3','leg:s3:s4','leg:s4:s5','leg:s5:s6','flight:f2']);
    expect(journeysChronological(data).map(j=>j.date)).toEqual(['2026-10-24','2026-10-27','2026-10-29','2026-10-31','2026-11-03','2026-11-04','2026-11-05','2026-11-05']);
    expect(buildJourneys(data).some(j=>j.key==='activity:day')).toBe(true);
  });
  it('orders same-date journeys deterministically: airport, then intercity, then key',()=>{
    const data={...SEED,stops:SEED.stops.map((s,i)=>i===2?{...s,arrive:'2026-10-27'}:s),
      flights:[{...SEED.flights[0],arriveAt:'2026-10-27T09:00'},SEED.flights[1]]};
    expect(journeysChronological(data).slice(0,3).map(j=>j.key)).toEqual(['flight:f1','leg:s0:s1','leg:s1:s2']);
  });
  it('returns a journey\'s saved segments in travel order',()=>{
    const first=buildJourneys(SEED).find(j=>j.type==='intercity')!;
    const data={...SEED,transportBookings:[booking(first.key,[seg('c',3,'to_book'),seg('a',1,'booked'),seg('b',2,'booked')])]};
    expect(journeySegments(data,first).map(s=>s.id)).toEqual(['a','b','c']);
    expect(journeySegments(SEED,first).map(s=>`${s.service} ${s.fromStation}→${s.toStation}`)).toEqual(['Revaty Kegon 013 Asakusa→Tobu-Nikko']);
  });
});
