import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SEED } from '../web/src/data/seed';
import { importTravelBookings } from '../shared/travelImport';
import { openDb, loadTrip } from './db';
import { seedIfEmpty, importSavedTravelBookings } from './seed';
const fixture = () => structuredClone(SEED);
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
describe('saved travel booking import', () => {
  it('imports all reservations and final return without changing hotels, activities or dates', () => {
    const saved = fixture();
    saved.stops.pop(); saved.legs.pop(); saved.transportBookings = [];
    saved.stops[2].hotelName = 'My hotel'; saved.stops[2].arrive = '2026-10-30';
    saved.activities.push({ id: 'custom', stopId: 's2', kind: 'activity', title: 'Dinner', status: 'booked' });
    const imported = importTravelBookings(saved, SEED)!;
    expect(imported.stops).toHaveLength(7);
    expect(imported.legs).toHaveLength(6);
    expect(imported.stops[2]).toMatchObject({ hotelName: 'My hotel', arrive: '2026-10-30' });
    expect(imported.activities).toEqual(saved.activities);
    expect(imported.transportBookings).toHaveLength(7);
    expect(imported.transportBookings?.find(b => b.routeKey === 'osaka:hakone')?.segments?.[0]).toMatchObject({ service: 'Hikari 646', departTime: '10:18', arriveTime: '12:38' });
    expect(imported.legs[1].departTime).toBe('08:30'); // Existing values preserved; missing legs do not get guesses.
    expect(saved.stops).toHaveLength(6);
  });
  it('preserves custom booking fields and seat assignments while restoring route order and splitting the airport transfer', () => {
    const saved = fixture(); saved.stops.pop(); saved.legs.pop();
    saved.transportBookings = saved.transportBookings!.filter(b => b.routeKey !== 'hakone:tokyo');
    const takayama = saved.transportBookings.find(b => b.id === 'tj-takayama')!;
    takayama.notes = 'Custom luggage notes'; takayama.cost = 999; takayama.confirmation = 'CUSTOM';
    takayama.segments = [{ ...takayama.segments![2], seatDetails: 'Car 7, seats 2A and 2B', instructions: 'Platform 18' }];
    const airport = saved.transportBookings.find(b => b.id === 'tj-nrt')!;
    const oldReturn = fixture().transportBookings!.find(b => b.id === 'tj-tokyo')!;
    airport.segments = [...oldReturn.segments!.map(s => ({ ...s, departTime: '12:00', instructions: 'Bring bags' })), ...airport.segments!];
    const imported = importTravelBookings(saved, SEED)!;
    const result = imported.transportBookings!.find(b => b.id === takayama.id)!;
    expect(result).toMatchObject({ notes: 'Custom luggage notes', cost: 999, confirmation: 'CUSTOM' });
    expect(result.segments!.map(s => s.service)).toEqual(['JR local', 'Yamabiko 208', 'Kagayaki 507', 'Highway bus']);
    expect(result.segments![2]).toMatchObject({ seatDetails: 'Reserved seat · Car 7, seats 2A and 2B', instructions: 'Platform 18' });
    expect(imported.transportBookings!.find(b => b.id === 'tj-nrt')!.segments).toHaveLength(1);
    expect(imported.transportBookings!.find(b => b.routeKey === 'hakone:tokyo')!.segments![0]).toMatchObject({ departTime: '12:00', instructions: 'Bring bags' });
  });
  it('does not create a final stop when edited Hakone dates no longer match', () => {
    const saved = fixture(); saved.stops.pop(); saved.legs.pop(); saved.stops[5].depart = '2026-11-04';
    const airport = saved.transportBookings!.find(b => b.id === 'tj-nrt')!;
    airport.routeKey = 'hakone:nrt';
    airport.segments!.unshift(...fixture().transportBookings!.find(b => b.id === 'tj-tokyo')!.segments!);
    const airportBefore = structuredClone(airport);
    saved.transportBookings = [airport];
    const result = importTravelBookings(saved, SEED)!;
    expect(result.transportBookings!.find(b => b.id === 'tj-nrt')).toEqual(airportBefore);
    expect(result.stops).toHaveLength(6);
    expect(result.transportBookings!.some(b => b.routeKey === 'hakone:tokyo')).toBe(false);
  });
  it('does not touch another itinerary', () => {
    const saved = fixture(); saved.stops[1].cityKey = 'kyoto';
    expect(importTravelBookings(saved, SEED)).toBeNull();
  });
  it('persists import once across database reopen and never restores deleted or edited records', () => {
    const dir = mkdtempSync(join(tmpdir(), 'travel-import-')); dirs.push(dir);
    const path = join(dir, 'trip.db'); let db = openDb(path); seedIfEmpty(db);
    db.prepare('DELETE FROM transport_bookings').run(); db.prepare("DELETE FROM legs WHERE id = 'l5'").run(); db.prepare("DELETE FROM stops WHERE id = 's6'").run();
    expect(importSavedTravelBookings(db)).toBe(true);
    expect(loadTrip(db).transportBookings).toHaveLength(7);
    db.prepare("UPDATE transport_bookings SET notes = 'Edited later' WHERE id = 'tj-hakone'").run();
    db.prepare("DELETE FROM transport_bookings WHERE id = 'tj-kyoto'").run(); db.close();
    db = openDb(path);
    expect(importSavedTravelBookings(db)).toBe(false);
    const restored = loadTrip(db);
    expect(restored.transportBookings).toHaveLength(6);
    expect(restored.transportBookings.find(b => b.id === 'tj-hakone')!.notes).toBe('Edited later');
    db.close();
  });
});
