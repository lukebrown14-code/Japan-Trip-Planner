export type HotelStatus = 'none' | 'idea' | 'booked';
export type BookStatus = 'to_book' | 'booked' | 'na';
export type ActivityStatus = 'idea' | 'planned' | 'booked';
export type Mode = 'train' | 'shinkansen' | 'limited_express' | 'bus' | 'walk' | 'plane';

export interface Stop {
  id: string; ord: number; cityKey: string; name: string; nameJa: string;
  lat: number; lng: number;
  arrive: string; depart: string; // ISO local dates 'YYYY-MM-DD'
  hotelName?: string; hotelUrl?: string; hotelAddressJa?: string;
  hotelLat?: number; hotelLng?: number;
  hotelStatus: HotelStatus; hotelCost?: number; hotelConfirmation?: string; hotelNotes?: string; // max 1000 chars
  notes?: string;
}
export interface Leg {
  id: string; fromStop: string; toStop: string;
  departTime?: string; arriveTime?: string; // 'HH:MM'
  summary?: string; status: BookStatus; cost?: number; confirmation?: string; notes?: string;
}
export interface Flight {
  id: string; direction: 'in' | 'out'; airline?: string; number?: string; airport: 'HND' | 'NRT';
  departAt?: string; arriveAt?: string; confirmation?: string; status: BookStatus;
}
export interface Activity {
  id: string; stopId: string; kind: 'activity' | 'day_trip';
  title: string; category?: string; url?: string; lat?: number; lng?: number;
  destName?: string; destLat?: number; destLng?: number; mode?: Mode;
  day?: string; time?: string; status: ActivityStatus; needsBooking?: boolean;
  cost?: number; confirmation?: string; suggested?: boolean; createdBy?: string;
}
export interface Comment { id: string; targetType: 'stop' | 'activity' | 'leg'; targetId: string; author: string; body: string; createdAt: string }
export interface Reaction { targetType: 'activity' | 'stop'; targetId: string; author: string; emoji: '👍' | '👎' | '🤔' }
export interface ChecklistItem { id: string; ord: number; text: string; assignee?: string; doneBy?: string; doneAt?: string }
export interface Trip { id: string; title: string; startDate: string; endDate: string }
export interface TransportPlan {
  id: string; adults: number; eligibilityConfirmed: boolean;
}
/** Most segments one transport booking may hold; the server rejects longer lists. */
export const SEGMENTS_MAX = 12;
/** One scheduled service within a journey's transport booking (full-replacement array). */
export interface TransportSegment {
  id: string; ord: number;
  service?: string; // train/bus name and number, e.g. 'Revaty Kegon 013'
  fromStation?: string; toStation?: string; // e.g. 'Asakusa', 'Tobu-Nikko'
  departTime?: string; arriveTime?: string; // 'HH:MM'
  departDayOffset?: number; arriveDayOffset?: number; // days after the journey date; defaults to 0
  confirmation?: string; seatDetails?: string; instructions?: string; bookingUrl?: string;
  status: BookStatus; // booked | to_book | na (pay on the day)
}
export interface TransportBooking {
  id: string; kind: 'journey' | 'pass'; journeyKey?: string; adults?: number;
  sourceType?: 'leg' | 'flight' | 'activity'; sourceId?: string;
  passId?: string; travelDate?: string; routeKey?: string;
  purchased: boolean; seatReserved: boolean; payOnDay?: boolean; selectedOption?: string; activationDate?: string;
  segments?: TransportSegment[];
  cost?: number; fareEstimate?: number; confirmation?: string; notes?: string;
}
export interface TripData {
  trip: Trip; stops: Stop[]; legs: Leg[]; flights: Flight[]; activities: Activity[];
  comments: Comment[]; reactions: Reaction[]; checklist: ChecklistItem[];
  transportPlans?: TransportPlan[]; transportBookings?: TransportBooking[];
}
