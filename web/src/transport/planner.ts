import type { TransportSegment, TripData } from '@shared/types';
import { PASSES, ROUTES, route, type RouteOption } from './catalogue';
export type { RouteOption } from './catalogue';
export interface Journey {
 key:string; type:'intercity'|'airport'|'daytrip'; title:string; date?:string; from:string; to:string;
 sourceType:'leg'|'flight'|'activity';sourceId:string;routeKey:string;options:RouteOption[];
 fromStopId?:string;toStopId?:string;
}
const typeOrder=(type:Journey['type'])=>type==='airport'?0:type==='intercity'?1:2;
/** Intercity and airport journeys in travel order (day trips excluded; they are planned in city panels).
 *  Same-date journeys keep a deterministic order (arrival airport, then intercity, then departure airport, then key); it is not a timetable. */
export function journeysChronological(data:TripData):Journey[] {
 const order=(j:Journey)=>j.type==='airport' && data.flights.find(f=>f.id===j.sourceId)?.direction==='out'?3:typeOrder(j.type);
 return buildJourneys(data).filter(j=>j.type!=='daytrip')
  .sort((a,b)=>(a.date??'9999-12-31').localeCompare(b.date??'9999-12-31')||order(a)-order(b)||a.key.localeCompare(b.key));
}
/** The journey-kind booking saved for a journey, if any. Pass rows never match. */
export function journeyBooking(data:TripData,journey:Journey){return data.transportBookings?.find(b=>b.kind==='journey'&&b.journeyKey===journey.key);}
/** A journey's saved segments in travel order. Empty until travellers add detail. */
export function journeySegments(data:TripData,journey:Journey):TransportSegment[] {
 return [...(journeyBooking(data,journey)?.segments??[])].sort((a,b)=>a.ord-b.ord);
}
const day=(value?:string)=>value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
const epoch=(value:string)=>Date.parse(`${value}T00:00:00Z`)/86400000;
const iso=(value:number)=>new Date(value*86400000).toISOString().slice(0,10);
function options(key:string):RouteOption[] {
 const found=ROUTES[key]; if(found)return found;
 const reversed=key.split(':').reverse().join(':');
 if(ROUTES[reversed] && (key==='tokyo:nrt'||key==='tokyo:hnd'))return ROUTES[reversed].map(o=>({...o,title:o.title.replace('→ Tokyo station','from Tokyo station')}));
 return [route('manual','Plan this route with the operator','This route has no maintained fare or timetable. Confirm stations, date, connections and price before purchasing.','https://global.jr-central.co.jp/en/onlinebooking/',{supported:false})];
}
export function buildJourneys(data:TripData):Journey[] {
 const stops=[...data.stops].sort((a,b)=>a.ord-b.ord); const journeys:Journey[]=[];
 stops.slice(1).forEach((to,index)=>{const from=stops[index];const leg=data.legs.find(l=>l.fromStop===from.id&&l.toStop===to.id);const routeKey=`${from.cityKey}:${to.cityKey}`;
 journeys.push({key:`leg:${from.id}:${to.id}`,type:'intercity',title:`${from.name} → ${to.name}`,date:day(to.arrive),from:from.name,to:to.name,sourceType:'leg',sourceId:leg?.id??`new:${from.id}:${to.id}`,routeKey,options:options(routeKey),fromStopId:from.id,toStopId:to.id});});
 data.flights.forEach(f=>{const stop=f.direction==='in'?stops[0]:stops.at(-1);if(!stop)return;const inbound=f.direction==='in';const airport=f.airport.toLowerCase();const routeKey=inbound?`${airport}:${stop.cityKey}`:`${stop.cityKey}:${airport}`;const from=inbound?f.airport:stop.name;const to=inbound?stop.name:f.airport;
 journeys.push({key:`flight:${f.id}`,type:'airport',title:`${from} → ${to}`,date:day(inbound?f.arriveAt:f.departAt),from,to,sourceType:'flight',sourceId:f.id,routeKey,options:options(routeKey)});});
 data.activities.filter(a=>a.kind==='day_trip'&&a.status!=='idea').forEach(a=>{const stop=stops.find(s=>s.id===a.stopId);if(!stop)return;const destination=(a.destName??a.title).toLowerCase().replace(/[\s-]/g,'');const routeKey=`${stop.cityKey}:${destination}`;
 journeys.push({key:`activity:${a.id}`,type:'daytrip',title:`${stop.name} ↔ ${a.destName??a.title}`,date:day(a.day),from:stop.name,to:a.destName??a.title,sourceType:'activity',sourceId:a.id,routeKey,options:options(routeKey)});});
 return journeys.map(j=>{
  const booking=data.transportBookings?.find(b=>b.kind==='journey'&&b.journeyKey===j.key);
  if(!booking||booking.fareEstimate===undefined||booking.fareEstimate<0||!Number.isFinite(booking.fareEstimate)||booking.routeKey!==j.routeKey||booking.travelDate!==j.date)return j;
  const chosen=booking.selectedOption??j.options[0]?.id;
  return {...j,options:j.options.map(o=>o.id===chosen?{...o,fare:booking.fareEstimate,description:`${o.description} Your saved per-adult fare estimate is used in comparisons.`}:o)};
 });
}
export function passCoverage(passId:string,journey:Journey,option:RouteOption,activationDate?:string):{covered:boolean;supplementaryFare?:number} {
 const pass=PASSES.find(p=>p.id===passId);if(!pass||!activationDate||!journey.date)return {covered:false};
 const start=epoch(activationDate),travel=epoch(journey.date);if(!Number.isFinite(start)||!Number.isFinite(travel)||travel<start||travel>=start+pass.days)return {covered:false};
 const id=passId.startsWith('jr-')?'jr':passId;
 if(option.fullyCoveredBy?.includes(id))return {covered:true,supplementaryFare:0};
 const included=id==='jr'?option.jrCoveredFare:option.partialCoverage?.[id];
 if(included!==undefined&&option.fare!==undefined)return {covered:included>=option.fare,supplementaryFare:Math.max(0,option.fare-included)};
 return {covered:false};
}
export function passCoversJourney(passId:string,journey:Journey,activationDate?:string,selectedOptionId?:string):boolean {
 const selected=journey.options.find(o=>o.id===selectedOptionId)??journey.options[0];return selected?passCoverage(passId,journey,selected,activationDate).covered:false;
}
export interface PassComparison {passId:string;name:string;total?:number;incomplete:boolean;coveredJourneyKeys:string[];activationDate?:string;savings?:number;reason:string;knownSubtotal:number;}
export function comparePasses(journeys:Journey[],adults:number,selectedOptions:Record<string,string>={},activationDates:Record<string,string>={}):PassComparison[] {
 const count=Number.isInteger(adults)&&adults>0?adults:2;
 const picked=journeys.map(j=>({j,o:j.options.find(o=>o.id===selectedOptions[j.key])??j.options[0]}));
 const unknown=picked.some(({o})=>o?.fare===undefined);const baseline=picked.reduce((sum,{o})=>sum+(o?.fare??0),0)*count;
 const individual:PassComparison={passId:'individual',name:'Individual tickets',total:unknown?undefined:baseline,knownSubtotal:baseline,incomplete:unknown,coveredJourneyKeys:[],reason:unknown?'Some fares need an operator quote. Known subtotal excludes unpriced journeys and local travel.':'Buy tickets for each journey; local city travel is additional.'};
 return [individual,...PASSES.map(pass=>{
  const dates=[...new Set(picked.filter(({j})=>j.date).map(({j})=>j.date!))].sort();
  let best={subtotal:Infinity,keys:[] as string[],date:undefined as string|undefined,incomplete:true,unknownCovered:-1};
  // A maximum weighted calendar window always has a journey on one of its edges.
  const requested=activationDates[pass.id];
  const starts=requested?[requested]:[...new Set(dates.flatMap(d=>[d,iso(epoch(d)-pass.days+1)]))].sort();
  for(const start of starts){let subtotal=pass.price*count;let incomplete=false;let unknownCovered=0;const keys:string[]=[];
   for(const {j,o} of picked){const cover=passCoverage(pass.id,j,o,start);if(cover.covered){keys.push(j.key);if(o.fare===undefined)unknownCovered++;continue;}if(cover.supplementaryFare!==undefined){subtotal+=cover.supplementaryFare*count;keys.push(j.key);}else if(o.fare!==undefined)subtotal+=o.fare*count;else incomplete=true;}
   const better=best.date===undefined||(!incomplete&&best.incomplete)||(incomplete===best.incomplete&&(
    incomplete?(unknownCovered>best.unknownCovered||(unknownCovered===best.unknownCovered&&(subtotal<best.subtotal||(subtotal===best.subtotal&&keys.length>best.keys.length))))
      :(subtotal<best.subtotal||(subtotal===best.subtotal&&keys.length>best.keys.length))));
   if(better)best={subtotal,keys,date:start,incomplete,unknownCovered};
  }
  if(!starts.length)best={subtotal:pass.price*count+baseline,keys:[],date:undefined,incomplete:unknown,unknownCovered:0};
  // Local-area passes cover local travel that is not itemised in the itinerary: do not invent a saving.
  const local=['nikko-world','nikko-all','hakone-area'].includes(pass.id);const incomplete=best.incomplete||local;
  return {passId:pass.id,name:pass.name,total:incomplete?undefined:best.subtotal,knownSubtotal:best.subtotal,incomplete,coveredJourneyKeys:best.keys,activationDate:requested??(best.keys.length?best.date:undefined),savings:!unknown&&!incomplete?baseline-best.subtotal:undefined,
   reason:local?'Compare your actual local rides. Intercity limited express supplements remain separate; local savings are not yet priced.':best.keys.length?`${best.keys.length} journey(s) covered in a ${pass.days}-day window. ${incomplete?'Unpriced uncovered journeys prevent a reliable total.':'Includes the pass and every uncovered journey.'}`:'No selected journey is fully covered by this pass; individual tickets remain the starting point.'};
 })];
}
