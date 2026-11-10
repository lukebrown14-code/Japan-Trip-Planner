import type Database from 'better-sqlite3';
import { importTravelBookings, TRAVEL_IMPORT_VERSION } from '../shared/travelImport';
import type { TripData } from '../shared/types';
import { SEED } from '../web/src/data/seed';
import { SPECS, insertRow, snake, toColumn, type CollSpec, loadTrip, updateRow } from './db';

export const DEFAULT_CHECKLIST = [
  'Buy and activate eSIM',
  'Add Suica to phone wallet',
  'Travel insurance',
  'Withdraw / order yen cash',
  'Type-A plug adapters',
  'Complete Visit Japan Web (immigration + customs)',
  'Reserve Shinkansen oversized-luggage seats',
  'Book teamLab, Ghibli Museum and USJ tickets',
  'Flight check-in reminder (24h before departure)',
];

function insertEntity(db: Database.Database, spec: CollSpec, e: Record<string, unknown>) {
  const v: Record<string, unknown> = { id: e.id };
  for (const [name, f] of Object.entries(spec.fields)) {
    const x = e[name];
    if (x === undefined) continue;
    v[snake(name)] = toColumn(f, x);
  }
  insertRow(db, spec.table, v);
}

/** Seeds only when the DB has no trip row. Returns true if seeded. */
export function seedIfEmpty(db: Database.Database): boolean {
  if (db.prepare('SELECT 1 FROM trip LIMIT 1').get()) return false;
  db.transaction(() => {
    const t = SEED.trip;
    db.prepare('INSERT INTO trip(id,title,start_date,end_date) VALUES(?,?,?,?)').run(t.id, t.title, t.startDate, t.endDate);
    for (const s of SEED.stops) insertEntity(db, SPECS.stops, s as unknown as Record<string, unknown>);
    for (const l of SEED.legs) insertEntity(db, SPECS.legs, { ...l, summary: l.summary });
    for (const f of SEED.flights) insertEntity(db, SPECS.flights, f as unknown as Record<string, unknown>);
    for (const a of SEED.activities) insertEntity(db, SPECS.activities, a as unknown as Record<string, unknown>);
    for (const p of SEED.transportPlans ?? []) insertEntity(db, SPECS.transportPlans, p as unknown as Record<string, unknown>);
    for (const b of SEED.transportBookings ?? []) insertEntity(db, SPECS.transportBookings, b as unknown as Record<string, unknown>);
    DEFAULT_CHECKLIST.forEach((text, i) => insertEntity(db, SPECS.checklist, { id: `c${i}`, ord: i, text }));
  })();
  return true;
}

/** Versioned additive import for databases created before the booking screenshots were supplied. */
export function importSavedTravelBookings(db: Database.Database): boolean {
  db.exec('CREATE TABLE IF NOT EXISTS data_imports (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  return db.transaction(() => {
    if (db.prepare('SELECT 1 FROM data_imports WHERE version = ?').get(TRAVEL_IMPORT_VERSION)) return false;
    const imported = importTravelBookings(loadTrip(db) as unknown as TripData, SEED);
    if (!imported) return false;
    for (const collection of ['stops', 'legs', 'transportPlans', 'transportBookings'] as const) {
      const spec = SPECS[collection];
      for (const entity of imported[collection] ?? []) {
        const values: Record<string, unknown> = {};
        for (const [name, field] of Object.entries(spec.fields)) {
          const value = (entity as unknown as Record<string, unknown>)[name];
          if (value !== undefined) values[snake(name)] = toColumn(field, value);
        }
        if (db.prepare(`SELECT 1 FROM ${spec.table} WHERE id = ?`).get(entity.id)) updateRow(db, spec.table, entity.id, values);
        else insertRow(db, spec.table, { id: entity.id, ...values });
      }
    }
    db.prepare('INSERT INTO data_imports(version, applied_at) VALUES (?, ?)').run(TRAVEL_IMPORT_VERSION, new Date().toISOString());
    return true;
  })();
}
