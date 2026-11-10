import { SEGMENTS_MAX, type TransportSegment } from '@shared/types';
import type { JourneyView } from '../../transport/viewModel';
import { safeBookingUrl } from '../../transport/bookingUrl';
export interface Draft { segments: TransportSegment[]; confirmation: string; cost: string; notes: string }
export function draftFor(view: JourneyView): Draft {
  const meaningful = view.legacy && view.services.some(s => s.departTime || s.arriveTime || s.confirmation || s.instructions || (s.service && s.service !== 'Service not set'));
  return { segments: (!view.legacy || meaningful ? view.services : []).map(({ departLabel, arriveLabel, statusLabel, ...s }) => s), confirmation: view.confirmation ?? '', cost: view.totalPaid === undefined ? '' : String(view.totalPaid), notes: view.notes ?? '' };
}
export function fingerprint(view?: JourneyView) {
  return JSON.stringify(view ? [view.booking, view.journey.date, view.journey.routeKey, view.adults, view.currentAdults, view.reviewReasons, view.legacy ? view.services : undefined] : null);
}
const minute = (t: string, offset: number) => Number(t.slice(0,2))*60 + Number(t.slice(3)) + offset*1440;
export function validateDraft(draft: Draft): string | undefined {
  if (draft.segments.length > SEGMENTS_MAX) return `Use at most ${SEGMENTS_MAX} services.`;
  if (draft.cost !== '' && (!/^\d+$/.test(draft.cost) || Number(draft.cost)>100000000)) return 'Total paid must be a whole yen amount from 0 to 100,000,000.';
  if (draft.confirmation.length>80 || draft.notes.length>2000) return 'Journey reference or notes are too long.';
  for (const [i,s] of draft.segments.entries()) {
    if (s.bookingUrl?.trim() && !safeBookingUrl(s.bookingUrl)) return `Service ${i+1}: booking URL must be a valid http(s) address, at most 500 characters.`;
    for (const offset of [s.departDayOffset ?? 0,s.arriveDayOffset ?? 0]) if (!Number.isInteger(offset) || offset<0 || offset>30) return `Service ${i+1}: day offsets must be whole numbers from 0 to 30.`;
    for (const time of [s.departTime,s.arriveTime]) if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return `Service ${i+1}: enter valid times.`;
    if (s.departTime && s.arriveTime && minute(s.arriveTime,s.arriveDayOffset??0)<minute(s.departTime,s.departDayOffset??0)) return `Service ${i+1}: arrival is before departure. Check its times and day offsets.`;
    if ([s.service,s.fromStation,s.toStation,s.confirmation].some(v=>(v?.length??0)>80) || (s.seatDetails?.length??0)>120 || (s.instructions?.length??0)>2000) return `Service ${i+1}: a detail exceeds its character limit.`;
  }
}
export function connectionWarnings(services: TransportSegment[]): string[] {
  return services.slice(1).flatMap((s,i)=> { const prev=services[i]; return prev.arriveTime && s.departTime && minute(s.departTime,s.departDayOffset??0)<minute(prev.arriveTime,prev.arriveDayOffset??0) ? [`Service ${i+2} leaves before service ${i+1} arrives. Check the connection.`] : []; });
}
