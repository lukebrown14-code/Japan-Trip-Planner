import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Collection } from '../shared/api';
import { SEGMENTS_MAX } from '../shared/types';

export type Kind = 'str' | 'int' | 'num' | 'bool' | 'enum' | 'date' | 'time' | 'dt' | 'url' | 'segments';
export interface FieldSpec { kind: Kind; max?: number; values?: readonly string[]; min?: number; maxN?: number; required?: boolean; default?: unknown; system?: boolean }
export interface CollSpec { table: string; fields: Record<string, FieldSpec> }

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const S = (max = 200, extra: Partial<FieldSpec> = {}): FieldSpec => ({ kind: 'str', max, ...extra });
const E = (values: readonly string[], extra: Partial<FieldSpec> = {}): FieldSpec => ({ kind: 'enum', values, ...extra });
const LAT: FieldSpec = { kind: 'num', min: -90, maxN: 90 };
const LNG: FieldSpec = { kind: 'num', min: -180, maxN: 180 };
const COST: FieldSpec = { kind: 'num', min: 0, maxN: 100_000_000 };
const BOOK = ['to_book', 'booked', 'na'] as const;
const MODES = ['train', 'shinkansen', 'limited_express', 'bus', 'walk', 'plane'] as const;
export const SEGMENT_FIELDS: Record<string, FieldSpec> = {
  id: S(40, { required: true }), ord: { kind: 'int', min: 0, maxN: 10_000, required: true },
  service: S(80), fromStation: S(80), toStation: S(80),
  departTime: { kind: 'time' }, arriveTime: { kind: 'time' },
  departDayOffset: { kind: 'int', min: 0, maxN: 30 }, arriveDayOffset: { kind: 'int', min: 0, maxN: 30 },
  confirmation: S(80), seatDetails: S(120), instructions: S(2000), bookingUrl: { kind: 'url', max: 500 },
  status: E(BOOK, { default: 'to_book' }),
};

export const SPECS: Record<Exclude<Collection, 'reactions'>, CollSpec> = {
  stops: {
    table: 'stops',
    fields: {
      ord: { kind: 'int', min: 0, maxN: 10_000 },
      cityKey: S(40, { required: true }), name: S(80, { required: true }), nameJa: S(80, { required: true }),
      lat: { ...LAT, required: true }, lng: { ...LNG, required: true },
      arrive: { kind: 'date', required: true }, depart: { kind: 'date', required: true },
      hotelName: S(120), hotelUrl: { kind: 'url', max: 500 }, hotelAddressJa: S(300),
      hotelLat: LAT, hotelLng: LNG,
      hotelStatus: E(['none', 'idea', 'booked'], { default: 'none' }), hotelCost: COST, hotelConfirmation: S(80), hotelNotes: S(1000),
      notes: S(2000), createdBy: S(40, { system: true }),
    },
  },
  legs: {
    table: 'legs',
    fields: {
      fromStop: S(40, { required: true }), toStop: S(40, { required: true }),
      departTime: { kind: 'time' }, arriveTime: { kind: 'time' }, summary: S(300),
      status: E(BOOK, { default: 'to_book' }), cost: COST, confirmation: S(80), notes: S(2000),
    },
  },
  flights: {
    table: 'flights',
    fields: {
      direction: E(['in', 'out'], { required: true }), airline: S(80), number: S(20),
      airport: E(['HND', 'NRT'], { required: true }), departAt: { kind: 'dt' }, arriveAt: { kind: 'dt' },
      confirmation: S(80), status: E(BOOK, { default: 'to_book' }),
    },
  },
  activities: {
    table: 'activities',
    fields: {
      stopId: S(40, { required: true }), kind: E(['activity', 'day_trip'], { default: 'activity' }),
      title: S(200, { required: true }), category: S(40), url: { kind: 'url', max: 500 }, lat: LAT, lng: LNG,
      destName: S(120), destLat: LAT, destLng: LNG, mode: E(MODES), day: { kind: 'date' }, time: { kind: 'time' },
      status: E(['idea', 'planned', 'booked'], { default: 'idea' }), needsBooking: { kind: 'bool' },
      cost: COST, confirmation: S(80), suggested: { kind: 'bool' }, createdBy: S(40, { system: true }),
    },
  },
  comments: {
    table: 'comments',
    fields: {
      targetType: E(['stop', 'activity', 'leg'], { required: true }), targetId: S(40, { required: true }),
      author: S(40, { system: true }), body: S(2000, { required: true }), createdAt: S(40, { system: true }),
    },
  },
  transportPlans: {
    table: 'transport_plans',
    fields: {
      adults: { kind: 'int', min: 1, maxN: 20, default: 2 },
      eligibilityConfirmed: { kind: 'bool', default: 0 },
    },
  },
  transportBookings: {
    table: 'transport_bookings',
    fields: {
      kind: E(['journey', 'pass'], { required: true }), journeyKey: S(200), adults: { kind: 'int', min: 1, maxN: 20 },
      sourceType: E(['leg', 'flight', 'activity']), sourceId: S(40), passId: S(80),
      travelDate: { kind: 'date' }, routeKey: S(200),
      purchased: { kind: 'bool', default: 0 }, seatReserved: { kind: 'bool', default: 0 }, payOnDay: { kind: 'bool', default: 0 },
      selectedOption: S(120), activationDate: { kind: 'date' }, segments: { kind: 'segments' },
      cost: COST, fareEstimate: COST, confirmation: S(80), notes: S(2000),
    },
  },
  checklist: {
    table: 'checklist',
    fields: {
      ord: { kind: 'int', min: 0, maxN: 10_000 }, text: S(300, { required: true }), assignee: S(40),
      doneBy: S(40), doneAt: S(40, { system: true }),
    },
  },
};

export const snake = (s: string) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());

const SCHEMA = `
CREATE TABLE IF NOT EXISTS trip(id TEXT PRIMARY KEY, title TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS stops(id TEXT PRIMARY KEY, ord INTEGER NOT NULL, city_key TEXT NOT NULL, name TEXT NOT NULL, name_ja TEXT NOT NULL,
  lat REAL NOT NULL, lng REAL NOT NULL, arrive TEXT NOT NULL, depart TEXT NOT NULL, hotel_name TEXT, hotel_url TEXT, hotel_address_ja TEXT,
  hotel_lat REAL, hotel_lng REAL, hotel_status TEXT NOT NULL DEFAULT 'none', hotel_cost REAL, hotel_confirmation TEXT, hotel_notes TEXT, notes TEXT,
  created_by TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS legs(id TEXT PRIMARY KEY, from_stop TEXT NOT NULL, to_stop TEXT NOT NULL, depart_time TEXT, arrive_time TEXT, summary TEXT,
  status TEXT NOT NULL DEFAULT 'to_book', cost REAL, confirmation TEXT, notes TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS flights(id TEXT PRIMARY KEY, direction TEXT NOT NULL, airline TEXT, number TEXT, airport TEXT NOT NULL,
  depart_at TEXT, arrive_at TEXT, confirmation TEXT, status TEXT NOT NULL DEFAULT 'to_book', updated_at TEXT);
CREATE TABLE IF NOT EXISTS activities(id TEXT PRIMARY KEY, stop_id TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'activity', title TEXT NOT NULL,
  category TEXT, url TEXT, lat REAL, lng REAL, dest_name TEXT, dest_lat REAL, dest_lng REAL, mode TEXT, day TEXT, time TEXT,
  status TEXT NOT NULL DEFAULT 'idea', needs_booking INTEGER, cost REAL, confirmation TEXT, suggested INTEGER, created_by TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS comments(id TEXT PRIMARY KEY, target_type TEXT NOT NULL, target_id TEXT NOT NULL, author TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reactions(target_type TEXT NOT NULL, target_id TEXT NOT NULL, author TEXT NOT NULL, emoji TEXT NOT NULL,
  PRIMARY KEY(target_type, target_id, author, emoji));
CREATE TABLE IF NOT EXISTS checklist(id TEXT PRIMARY KEY, ord INTEGER NOT NULL, text TEXT NOT NULL, assignee TEXT, done_by TEXT, done_at TEXT);
CREATE TABLE IF NOT EXISTS transport_plans(id TEXT PRIMARY KEY, adults INTEGER NOT NULL DEFAULT 2, eligibility_confirmed INTEGER NOT NULL DEFAULT 0, updated_at TEXT);
CREATE TABLE IF NOT EXISTS transport_bookings(id TEXT PRIMARY KEY, kind TEXT NOT NULL, journey_key TEXT, adults INTEGER, source_type TEXT, source_id TEXT, pass_id TEXT,
  travel_date TEXT, route_key TEXT, purchased INTEGER NOT NULL DEFAULT 0, seat_reserved INTEGER NOT NULL DEFAULT 0, pay_on_day INTEGER DEFAULT 0, selected_option TEXT,
  activation_date TEXT, segments TEXT, cost REAL, fare_estimate REAL, confirmation TEXT, notes TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS users_seen(name TEXT PRIMARY KEY, last_seen TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS changes(seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL, collection TEXT NOT NULL, op TEXT NOT NULL,
  entity_id TEXT NOT NULL, entity TEXT, author TEXT NOT NULL, at TEXT NOT NULL, summary TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS changes_at ON changes(at);
`;

export function openDb(path: string): Database.Database {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  if (path !== ':memory:') db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  migrate(db);
  pruneChanges(db);
  return db;
}

export const CHANGES_KEEP_DAYS = 90;
/** Delete change-log rows older than `days` (default 90). Returns number removed. */
export function pruneChanges(db: Database.Database, days = CHANGES_KEEP_DAYS, nowMs = Date.now()): number {
  return db.prepare('DELETE FROM changes WHERE at < ?').run(new Date(nowMs - days * 864e5).toISOString()).changes;
}

/** Idempotent migrations for databases created by older schemas. */
export function migrate(db: Database.Database) {
  const cols = (t: string) => (db.pragma(`table_info(${t})`) as { name: string }[]).map((c) => c.name);
  if (!cols('transport_bookings').includes('pay_on_day')) db.exec('ALTER TABLE transport_bookings ADD COLUMN pay_on_day INTEGER DEFAULT 0');
  if (!cols('transport_bookings').includes('adults')) db.exec('ALTER TABLE transport_bookings ADD COLUMN adults INTEGER');
  if (!cols('transport_bookings').includes('fare_estimate')) db.exec('ALTER TABLE transport_bookings ADD COLUMN fare_estimate REAL');
  if (!cols('transport_bookings').includes('segments')) db.exec('ALTER TABLE transport_bookings ADD COLUMN segments TEXT');
  if (!cols('stops').includes('hotel_notes')) db.exec('ALTER TABLE stops ADD COLUMN hotel_notes TEXT');
  // reactions moved from ♥/⭐/🤔 to 👍/👎/🤔: fold the old positive votes into 👍
  db.exec(`INSERT OR IGNORE INTO reactions(target_type, target_id, author, emoji) SELECT target_type, target_id, author, '👍' FROM reactions WHERE emoji IN ('♥', '⭐');
    DELETE FROM reactions WHERE emoji IN ('♥', '⭐');`);
  db.transaction(() => {
    // dedupe legs by (from_stop,to_stop), keeping the oldest row, then enforce uniqueness
    const dupes = db.prepare('SELECT id FROM legs WHERE rowid NOT IN (SELECT MIN(rowid) FROM legs GROUP BY from_stop, to_stop)').all() as { id: string }[];
    for (const d of dupes) {
      db.prepare("DELETE FROM comments WHERE target_type='leg' AND target_id=?").run(d.id);
      db.prepare('DELETE FROM legs WHERE id=?').run(d.id);
    }
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS legs_pair ON legs(from_stop, to_stop)');
  })();
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DT = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
export const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

function validDate(s: string) { return DATE.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().startsWith(s); }

function check(name: string, f: FieldSpec, v: unknown): unknown {
  const bad = (m: string) => new HttpError(400, `${name}: ${m}`);
  switch (f.kind) {
    case 'str': case 'url': {
      if (typeof v !== 'string') throw bad('must be a string');
      const t = v.trim();
      if (f.required && !t) throw bad('required');
      if (t.length > (f.max ?? 200)) throw bad('too long');
      if (f.kind === 'url' && t) {
        let u: URL; try { u = new URL(t); } catch { throw bad('invalid url'); }
        if (u.protocol !== 'http:' && u.protocol !== 'https:') throw bad('url must be http(s)');
      }
      return t;
    }
    case 'int': case 'num': {
      if (typeof v !== 'number' || !Number.isFinite(v)) throw bad('must be a number');
      if (f.kind === 'int' && !Number.isInteger(v)) throw bad('must be an integer');
      if ((f.min !== undefined && v < f.min) || (f.maxN !== undefined && v > f.maxN)) throw bad('out of range');
      return v;
    }
    case 'bool': if (typeof v !== 'boolean') throw bad('must be a boolean'); return v ? 1 : 0;
    case 'enum': if (typeof v !== 'string' || !f.values!.includes(v)) throw bad(`must be one of ${f.values!.join('|')}`); return v;
    case 'date': if (typeof v !== 'string' || !validDate(v)) throw bad('must be YYYY-MM-DD'); return v;
    case 'time': if (typeof v !== 'string' || !TIME.test(v)) throw bad('must be HH:MM'); return v;
    case 'dt': if (typeof v !== 'string' || !DT.test(v)) throw bad('must be YYYY-MM-DDTHH:MM'); return v;
    case 'segments': {
      if (!Array.isArray(v)) throw bad('must be an array of segments');
      if (v.length > SEGMENTS_MAX) throw bad(`at most ${SEGMENTS_MAX} segments`);
      const ids = new Set<unknown>(), ords = new Set<unknown>();
      return JSON.stringify(v.map((item, i) => {
        const at = `${name}.${i}`;
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw new HttpError(400, `${at}: must be an object`);
        const extra = Object.keys(item).find(k => !SEGMENT_FIELDS[k]);
        if (extra) throw new HttpError(400, `${at}.${extra}: unknown field`);
        // Each segment is a whole record: cleared fields fall back to their default or are left out.
        const seg = checkFields(SEGMENT_FIELDS, item as Record<string, unknown>, true, `${at}.`);
        for (const [k, f] of Object.entries(SEGMENT_FIELDS)) if (seg[k] === null) { if (f.default !== undefined) seg[k] = f.default; else delete seg[k]; }
        if (!ID_RE.test(seg.id as string)) throw new HttpError(400, `${at}.id: invalid id`);
        if (ids.has(seg.id)) throw new HttpError(400, `${at}.id: duplicate`);
        if (ords.has(seg.ord)) throw new HttpError(400, `${at}.ord: duplicate`);
        if (seg.departTime && seg.arriveTime) {
          const stamp = (time: string, offset: number) => { const [h, m] = time.split(':').map(Number); return offset * 1440 + h * 60 + m; };
          if (stamp(seg.arriveTime as string, Number(seg.arriveDayOffset ?? 0)) < stamp(seg.departTime as string, Number(seg.departDayOffset ?? 0)))
            throw new HttpError(400, `${at}.arriveTime: arrival must follow departure; set the arrival day for overnight travel`);
        }
        ids.add(seg.id); ords.add(seg.ord);
        return seg;
      }));
    }
  }
}

/** Check each field `b` supplies (null clears an optional one). When creating, missing fields take their default or fail if required. */
function checkFields(fields: Record<string, FieldSpec>, b: Record<string, unknown>, creating: boolean, path = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, f] of Object.entries(fields)) {
    if (f.system) continue;
    const v = b[name];
    if (v === undefined) {
      if (creating) {
        if (f.required) throw new HttpError(400, `${path}${name}: required`);
        if (f.default !== undefined) out[name] = f.default;
      }
      continue;
    }
    if (v === null) {
      if (f.required) throw new HttpError(400, `${path}${name}: required`);
      out[name] = null; continue;
    }
    const c = check(path + name, f, v);
    out[name] = c === '' && !f.required ? null : c;
  }
  return out;
}

/** Validate client body against spec. Returns column->value map (snake_case) for supplied fields. */
export function validate(spec: CollSpec, body: unknown, creating: boolean): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'body must be an object');
  return Object.fromEntries(Object.entries(checkFields(spec.fields, body as Record<string, unknown>, creating)).map(([name, v]) => [snake(name), v]));
}

/** Entity value -> column value: booleans as 0/1, segment lists as JSON. `rowToEntity` reverses it. */
export const toColumn = (f: FieldSpec, v: unknown) => f.kind === 'bool' ? (v ? 1 : 0) : f.kind === 'segments' ? JSON.stringify(v) : v;

export function rowToEntity(spec: CollSpec, row: Record<string, unknown>): Record<string, unknown> {
  const e: Record<string, unknown> = { id: row.id };
  for (const [name, f] of Object.entries(spec.fields)) {
    const v = row[snake(name)];
    if (v === null || v === undefined) continue;
    e[name] = f.kind === 'bool' ? v === 1 : f.kind === 'segments' ? (typeof v === 'string' && v ? JSON.parse(v) : undefined) : v;
  }
  return e;
}

export function getEntity(db: Database.Database, c: keyof typeof SPECS, id: string) {
  const spec = SPECS[c];
  const row = db.prepare(`SELECT * FROM ${spec.table} WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  return row ? rowToEntity(spec, row) : undefined;
}

export function insertRow(db: Database.Database, table: string, values: Record<string, unknown>) {
  const cols = Object.keys(values);
  db.prepare(`INSERT INTO ${table}(${cols.join(',')}) VALUES(${cols.map((c) => '@' + c).join(',')})`).run(values);
}
export function updateRow(db: Database.Database, table: string, id: string, values: Record<string, unknown>) {
  const cols = Object.keys(values);
  if (!cols.length) return;
  db.prepare(`UPDATE ${table} SET ${cols.map((c) => `${c}=@${c}`).join(',')} WHERE id=@__id`).run({ ...values, __id: id });
}

export function loadTrip(db: Database.Database) {
  const all = (c: keyof typeof SPECS, order: string) =>
    (db.prepare(`SELECT * FROM ${SPECS[c].table} ORDER BY ${order}`).all() as Record<string, unknown>[]).map((r) => rowToEntity(SPECS[c], r));
  const t = db.prepare('SELECT * FROM trip LIMIT 1').get() as { id: string; title: string; start_date: string; end_date: string } | undefined;
  return {
    trip: t ? { id: t.id, title: t.title, startDate: t.start_date, endDate: t.end_date } : { id: 't1', title: 'Trip', startDate: '', endDate: '' },
    stops: all('stops', 'ord, rowid'), legs: all('legs', 'rowid'), flights: all('flights', 'rowid'), activities: all('activities', 'rowid'),
    comments: all('comments', 'created_at, rowid'),
    reactions: (db.prepare('SELECT target_type, target_id, author, emoji FROM reactions ORDER BY rowid').all() as Record<string, string>[]).map((r) => ({
      id: `${r.target_type}:${r.target_id}:${r.author}:${r.emoji}`, targetType: r.target_type, targetId: r.target_id, author: r.author, emoji: r.emoji,
    })),
    checklist: all('checklist', 'ord, rowid'),
    transportPlans: all('transportPlans', 'rowid'), transportBookings: all('transportBookings', 'rowid'),
  };
}
