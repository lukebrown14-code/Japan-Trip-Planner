import type { TripData, Stop, Leg, Activity, TransportBooking, TransportSegment } from '@shared/types';
import { CITIES } from './cities';
const mk = (i: number, key: string, arrive: string, depart: string): Stop => {
  const c = CITIES[key]; return { id: `s${i}`, ord: i, cityKey: key, name: c.name, nameJa: c.nameJa, lat: c.lat, lng: c.lng, arrive, depart, hotelStatus: 'none' };
};
// Real itinerary: Tokyo → Nikko → Takayama → Kyoto → Osaka → Hakone → Tokyo, city-to-city journeys 27 Oct – 5 Nov 2026.
const stops: Stop[] = [
  mk(0, 'tokyo', '2026-10-24', '2026-10-27'), mk(1, 'nikko', '2026-10-27', '2026-10-29'),
  mk(2, 'takayama', '2026-10-29', '2026-10-31'), mk(3, 'kyoto', '2026-10-31', '2026-11-03'),
  mk(4, 'osaka', '2026-11-03', '2026-11-04'), mk(5, 'hakone', '2026-11-04', '2026-11-05'),
  mk(6, 'tokyo', '2026-11-05', '2026-11-05'),
];
const legs: Leg[] = [
  { id: 'l0', fromStop: 's0', toStop: 's1', departTime: '09:30', arriveTime: '11:22', status: 'to_book' },
  { id: 'l1', fromStop: 's1', toStop: 's2', departTime: '08:30', arriveTime: '13:30', status: 'to_book' },
  { id: 'l2', fromStop: 's2', toStop: 's3', departTime: '15:34', arriveTime: '19:17', status: 'to_book' },
  { id: 'l3', fromStop: 's3', toStop: 's4', departTime: '10:00', arriveTime: '11:00', status: 'to_book' },
  { id: 'l4', fromStop: 's4', toStop: 's5', departTime: '10:18', status: 'to_book' },
  { id: 'l5', fromStop: 's5', toStop: 's6', status: 'to_book' },
];
const activities: Activity[] = [];
const segment = (id: string, ord: number, status: TransportSegment['status'], extra: Partial<TransportSegment> = {}): TransportSegment =>
  ({ id, ord, status, ...extra });
// journeyKey values mirror buildJourneys: `leg:${fromStopId}:${toStopId}` for stop pairs, `flight:${id}` for the outbound flight.
const transportBookings: TransportBooking[] = [
  { id: 'tj-nikko', kind: 'journey', journeyKey: 'leg:s0:s1', sourceType: 'leg', sourceId: 'l0', adults: 2,
    travelDate: '2026-10-27', routeKey: 'tokyo:nikko', purchased: true, seatReserved: true,
    segments: [segment('seg-tn-1', 0, 'booked', { service: 'Revaty Kegon 013', bookingUrl: 'https://tobu-japantrip-tickets.com/#limited-express', fromStation: 'Asakusa', toStation: 'Tobu-Nikko', departTime: '09:30', arriveTime: '11:22' })],
    confirmation: 'DEMO-REF-0001 · Car 6, seats 11C & 11D', cost: 3300,
    notes: 'Limited express charge only — pay the base fare separately (Suica/PASMO or Nikko pass)' },
  { id: 'tj-takayama', kind: 'journey', journeyKey: 'leg:s1:s2', sourceType: 'leg', sourceId: 'l1', adults: 2,
    travelDate: '2026-10-29', routeKey: 'nikko:takayama', purchased: true, seatReserved: true,
    segments: [
      segment('seg-nt-1', 0, 'na', { service: 'JR local', fromStation: 'Nikko', toStation: 'Utsunomiya' }),
      segment('seg-nt-2', 1, 'booked', { service: 'Yamabiko 208', bookingUrl: 'https://www.eki-net.com/en/jreast-train-reservation/Top/Index', fromStation: 'Utsunomiya', toStation: 'Omiya', departTime: '09:06', arriveTime: '09:34', seatDetails: 'Non-reserved seat' }),
      segment('seg-nt-3', 2, 'booked', { service: 'Kagayaki 507', bookingUrl: 'https://www.eki-net.com/en/jreast-train-reservation/Top/Index', fromStation: 'Omiya', toStation: 'Toyama', departTime: '09:45', arriveTime: '11:32', seatDetails: 'Reserved seat' }),
      segment('seg-nt-4', 3, 'to_book', { service: 'Highway bus', bookingUrl: 'https://japanbusonline.com/en/CourseSearch/11900040002', fromStation: 'Toyama', toStation: 'Takayama' }),
    ] },
  { id: 'tj-kyoto', kind: 'journey', journeyKey: 'leg:s2:s3', sourceType: 'leg', sourceId: 'l2', adults: 2,
    travelDate: '2026-10-31', routeKey: 'takayama:kyoto', purchased: true, seatReserved: true,
    segments: [segment('seg-tk-1', 0, 'booked', { service: 'Hida 36', bookingUrl: 'https://www.westjr.co.jp/travel-information/en/tickets-passes/route-search/', fromStation: 'Takayama', toStation: 'Kyoto', departTime: '15:34', arriveTime: '19:17', seatDetails: 'Reserved seat' })],
    confirmation: 'Hida 36 · car 8', cost: 23840 },
  { id: 'tj-osaka', kind: 'journey', journeyKey: 'leg:s3:s4', sourceType: 'leg', sourceId: 'l3', adults: 2,
    travelDate: '2026-11-03', routeKey: 'kyoto:osaka', purchased: false, seatReserved: false,
    segments: [segment('seg-ko-1', 0, 'na', { service: 'JR local', fromStation: 'Kyoto', toStation: 'Osaka' })] },
  { id: 'tj-hakone', kind: 'journey', journeyKey: 'leg:s4:s5', sourceType: 'leg', sourceId: 'l4', adults: 2,
    travelDate: '2026-11-04', routeKey: 'osaka:hakone', purchased: true, seatReserved: true,
    segments: [
      segment('seg-oh-1', 0, 'booked', { service: 'Hikari 646', bookingUrl: 'https://smart-ex.jp/en/', fromStation: 'Shin-Osaka', toStation: 'Odawara', departTime: '10:18', arriveTime: '12:38', seatDetails: 'Reserved seat · Mt. Fuji preference' }),
      segment('seg-oh-2', 1, 'to_book', { service: 'Hakone Tozan Railway', bookingUrl: 'https://www.hakonenavi.jp/international/en/transportation/hakone-tozan', fromStation: 'Odawara', toStation: 'Hakone-Yumoto' }),
    ] },
  { id: 'tj-tokyo', kind: 'journey', journeyKey: 'leg:s5:s6', sourceType: 'leg', sourceId: 'l5', adults: 2,
    travelDate: '2026-11-05', routeKey: 'hakone:tokyo', purchased: false, seatReserved: false,
    segments: [
      segment('seg-hn-1', 0, 'to_book', { service: 'Hakone Tozan Railway', bookingUrl: 'https://www.hakonenavi.jp/international/en/transportation/hakone-tozan', fromStation: 'Hakone-Yumoto', toStation: 'Odawara' }),
      segment('seg-hn-2', 1, 'to_book', { service: 'Shinkansen', bookingUrl: 'https://smart-ex.jp/en/', fromStation: 'Odawara', toStation: 'Tokyo' }),
    ] },
  { id: 'tj-nrt', kind: 'journey', journeyKey: 'flight:f2', sourceType: 'flight', sourceId: 'f2', adults: 2,
    travelDate: '2026-11-05', routeKey: 'tokyo:nrt', purchased: false, seatReserved: false,
    segments: [
      segment('seg-hn-3', 0, 'to_book', { service: 'Narita Express', bookingUrl: 'https://www.eki-net.com/en/jreast-train-reservation/Top/Index', fromStation: 'Tokyo', toStation: 'Narita Airport' }),
    ] },
];
export const SEED: TripData = {
  trip: { id: 't1', title: 'Our Japan Trip', startDate: '2026-10-24', endDate: '2026-11-05' },
  stops, legs, activities, comments: [], reactions: [], checklist: [],
  transportPlans: [{ id: 'transport', adults: 2, eligibilityConfirmed: false }], transportBookings,
  flights: [
    { id: 'f1', direction: 'in', airport: 'HND', arriveAt: '2026-10-24T08:00', status: 'to_book' },
    { id: 'f2', direction: 'out', airport: 'NRT', departAt: '2026-11-05T17:00', status: 'to_book' },
  ],
};
