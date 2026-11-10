import type { TransportBooking } from '@shared/types';
import { api } from '../api';
import { useStore } from '../store';
import { journeyBooking } from './planner';
import { intercityJourneys } from './viewModel';
const hash = (key: string) => { let v=2166136261; for(const c of key) v=Math.imul(v^c.charCodeAt(0),16777619); return (v>>>0).toString(36); };
export async function saveJourneyDetails(key: string, patch: Partial<TransportBooking>): Promise<TransportBooking> {
  const data=useStore.getState().data;
  const journey=intercityJourneys(data).find(j=>j.key===key);
  if(!journey) throw new Error('This journey was removed. Your draft has been kept.');
  const current=journeyBooking(data,journey);
  const base:TransportBooking=current ?? { id:`tj-${hash(key)}`,kind:'journey',journeyKey:key,travelDate:journey.date,routeKey:journey.routeKey,
    purchased:false,seatReserved:false,adults:data.transportPlans?.find(p=>p.id==='transport')?.adults ?? 2 };
  const entity={...base,...patch,sourceType:journey.sourceType,sourceId:journey.sourceId.startsWith('new:')?undefined:journey.sourceId};
  const payload=Object.fromEntries(Object.entries(entity).map(([k,v])=>[k,v===undefined?null:v])) as unknown as TransportBooking;
  const saved=await api.save('transportBookings',payload);
  const normalised=Object.fromEntries(Object.entries(saved).map(([k,v])=>[k,v===null?undefined:v])) as unknown as TransportBooking;
  useStore.getState().replaceEntity('transportBookings',normalised);
  return normalised;
}
export async function confirmJourneyReview(key:string) {
  const data=useStore.getState().data; const journey=intercityJourneys(data).find(j=>j.key===key);
  if(!journey || !journey.date) throw new Error('Confirm the itinerary travel date first.');
  const booking=journeyBooking(data,journey);
  return saveJourneyDetails(key,{travelDate:journey.date,routeKey:journey.routeKey,adults:data.transportPlans?.find(p=>p.id==='transport')?.adults ?? 2,
    selectedOption:journey.options.some(o=>o.id===booking?.selectedOption)?booking?.selectedOption:undefined});
}
