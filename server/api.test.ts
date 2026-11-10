import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { buildApp } from './index';
import { seedIfEmpty } from './seed';
import { getWeather, clearWeatherCache, prevYear } from './weather';
import type { WsMessage } from '../shared/api';

let dir: string; let app: ReturnType<typeof buildApp>;
const mk = () => buildApp({ passphrase: 'pw', sessionSecret: 's3cret', travellers: ['Luke', 'Partner'], dbPath: join(dir, 't.db'), distDir: join(dir, 'nodist') });
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'trip-')); app = mk(); });
afterEach(async () => { await app.close(); rmSync(dir, { recursive: true, force: true }); });

async function login(name = 'Luke', ip?: string) {
  const r = await app.inject({ method: 'POST', url: '/api/login', payload: { passphrase: 'pw', name }, remoteAddress: ip });
  const c = r.cookies.find((x) => x.name === 'trip')!;
  return { r, cookie: `trip=${c.value}`, raw: c };
}
const req = (cookie: string, method: string, url: string, payload?: unknown) =>
  app.inject({ method: method as 'GET', url, payload: payload as object, headers: { cookie } });

describe('auth', () => {
  it('requires a cookie on every api route', async () => {
    const routes: [string, string][] = [['GET', '/api/me'], ['GET', '/api/trip'], ['POST', '/api/stops'], ['PATCH', '/api/stops/s0'], ['DELETE', '/api/stops/s0'],
      ['POST', '/api/reactions'], ['GET', '/api/whatsnew'], ['POST', '/api/seen'], ['GET', '/api/weather?lat=35&lng=139&date=2026-10-24'], ['POST', '/api/checklist'], ['GET', '/ws']];
    for (const [m, u] of routes) {
      const r = await app.inject({ method: m as 'GET', url: u, payload: m === 'GET' ? undefined : {} });
      expect(r.statusCode, `${m} ${u}`).toBe(401);
    }
  });
  it('rejects forged / tampered cookie', async () => {
    const { cookie } = await login();
    const bad = cookie.slice(0, -2) + 'xx';
    expect((await req(bad, 'GET', '/api/me')).statusCode).toBe(401);
    expect((await req('trip=' + Buffer.from('{"name":"Luke","exp":9999999999999}').toString('base64url') + '.abc', 'GET', '/api/me')).statusCode).toBe(401);
  });
  it('login happy path sets httpOnly lax cookie', async () => {
    const { r, raw, cookie } = await login('Partner');
    expect(r.statusCode).toBe(204);
    expect(raw.httpOnly).toBe(true); expect(String(raw.sameSite).toLowerCase()).toBe('lax');
    const me = await req(cookie, 'GET', '/api/me');
    expect(me.json()).toEqual({ name: 'Partner', travellers: ['Luke', 'Partner'] });
  });
  it('login sad paths', async () => {
    const bad = (payload: unknown) => app.inject({ method: 'POST', url: '/api/login', payload: payload as object });
    expect((await bad({ passphrase: 'nope', name: 'Luke' })).statusCode).toBe(401);
    expect((await bad({ passphrase: 'pw', name: 'Mallory' })).statusCode).toBe(401);
    expect((await bad({ passphrase: 5, name: 'Luke' })).statusCode).toBe(401);
    expect((await bad({})).statusCode).toBe(401);
  });
  it('rate limits after 10 failures per IP', async () => {
    for (let i = 0; i < 10; i++) {
      const r = await app.inject({ method: 'POST', url: '/api/login', payload: { passphrase: 'x', name: 'Luke' }, remoteAddress: '9.9.9.9' });
      expect(r.statusCode).toBe(401);
    }
    const r = await app.inject({ method: 'POST', url: '/api/login', payload: { passphrase: 'pw', name: 'Luke' }, remoteAddress: '9.9.9.9' });
    expect(r.statusCode).toBe(429);
    expect((await login('Luke', '8.8.8.8')).r.statusCode).toBe(204);
  });
  it('logout clears cookie', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/logout' });
    expect(r.statusCode).toBe(204);
    expect(r.cookies.find((c) => c.name === 'trip')?.value).toBe('');
  });
  it('rejects cross-origin state changes', async () => {
    const { cookie } = await login();
    const r = await app.inject({ method: 'POST', url: '/api/checklist', payload: { text: 'x' }, headers: { cookie, origin: 'https://evil.example', host: 'trip.example' } });
    expect(r.statusCode).toBe(403);
    const ok = await app.inject({ method: 'POST', url: '/api/checklist', payload: { text: 'x' }, headers: { cookie, origin: 'https://trip.example', host: 'trip.example' } });
    expect(ok.statusCode).toBe(201);
  });
  it('body limit 100kb', async () => {
    const { cookie } = await login();
    const r = await req(cookie, 'POST', '/api/checklist', { text: 'x'.repeat(150_000) });
    expect(r.statusCode).toBe(413);
  });
  it('sets security headers', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/me' });
    expect(r.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('trip + CRUD', () => {
  it('returns seeded TripData in camelCase', async () => {
    const { cookie } = await login();
    const t = (await req(cookie, 'GET', '/api/trip')).json();
    expect(t.trip.startDate).toBe('2026-10-24');
    expect(t.stops).toHaveLength(7); expect(t.stops[0]).toMatchObject({ cityKey: 'tokyo', hotelStatus: 'none' });
    expect(t.legs).toHaveLength(6); expect(t.flights).toHaveLength(2);
    expect(t.checklist.length).toBeGreaterThanOrEqual(9);
    expect(t.stops[0]).not.toHaveProperty('hotelName');
  });
  it('creates, patches, upserts, deletes an activity', async () => {
    const { cookie } = await login('Luke');
    const c = await req(cookie, 'POST', '/api/activities', { stopId: 's0', title: 'teamLab', needsBooking: true, createdBy: 'Hacker', status: 'planned', cost: 4000 });
    expect(c.statusCode).toBe(201);
    const a = c.json();
    expect(a).toMatchObject({ title: 'teamLab', kind: 'activity', needsBooking: true, createdBy: 'Luke', status: 'planned' });
    const p = await req(cookie, 'PATCH', `/api/activities/${a.id}`, { status: 'booked', confirmation: 'ABC', cost: null });
    expect(p.json()).toMatchObject({ status: 'booked', confirmation: 'ABC', title: 'teamLab', createdBy: 'Luke' });
    expect(p.json().cost).toBeUndefined();
    const u = await req(cookie, 'POST', '/api/activities', { id: a.id, stopId: 's0', title: 'teamLab 2' });
    expect(u.statusCode).toBe(200); expect(u.json().title).toBe('teamLab 2');
    const mine = await req(cookie, 'POST', '/api/activities', { id: 'custom-1', stopId: 's1', title: 'Custom' });
    expect(mine.json().id).toBe('custom-1');
    expect((await req(cookie, 'DELETE', `/api/activities/${a.id}`)).statusCode).toBe(200);
    expect((await req(cookie, 'DELETE', `/api/activities/${a.id}`)).statusCode).toBe(404);
    expect((await req(cookie, 'PATCH', '/api/activities/nope', { title: 'x' })).statusCode).toBe(404);
  });
  it('validates strictly', async () => {
    const { cookie } = await login();
    const bad = async (url: string, body: unknown, m = 'POST') => (await req(cookie, m, url, body)).statusCode;
    expect(await bad('/api/activities', { title: 'x' })).toBe(400); // no stopId
    expect(await bad('/api/activities', { stopId: 'ghost', title: 'x' })).toBe(400);
    expect(await bad('/api/activities', { stopId: 's0', title: '' })).toBe(400);
    expect(await bad('/api/activities', { stopId: 's0', title: 'x'.repeat(201) })).toBe(400);
    expect(await bad('/api/activities', { stopId: 's0', title: 'x', status: 'weird' })).toBe(400);
    expect(await bad('/api/activities', { stopId: 's0', title: 'x', lat: 91 })).toBe(400);
    expect(await bad('/api/activities', { stopId: 's0', title: 'x', lat: '5' })).toBe(400);
    expect(await bad('/api/activities', { stopId: 's0', title: 'x', url: 'javascript:alert(1)' })).toBe(400);
    expect(await bad('/api/activities', { stopId: 's0', title: 'x', day: '2026-13-40' })).toBe(400);
    expect(await bad('/api/activities', { stopId: 's0', title: 'x', time: '25:00' })).toBe(400);
    expect(await bad('/api/activities', { stopId: 's0', title: 'x', id: 'bad id!' })).toBe(400);
    expect(await bad('/api/activities', [1])).toBe(400);
    expect(await bad('/api/legs', { fromStop: 's0', toStop: 'ghost' })).toBe(400);
    expect(await bad('/api/legs', { fromStop: 's0', toStop: 's1', status: 'x' })).toBe(400);
    expect(await bad('/api/flights', { direction: 'in', airport: 'LAX' })).toBe(400);
    expect(await bad('/api/stops', { cityKey: 'x', name: 'X' })).toBe(400);
    expect(await bad('/api/checklist', { text: 'x', assignee: 'Nobody' })).toBe(400);
    expect(await bad('/api/nonsense', { a: 1 })).toBe(404);
    // unknown fields ignored, not stored
    const ok = await req(cookie, 'POST', '/api/checklist', { text: 'fine', evil: 'x', id: undefined });
    expect(ok.statusCode).toBe(201); expect(ok.json().evil).toBeUndefined();
  });
  it('legs, flights, stops, checklist', async () => {
    const { cookie } = await login('Luke');
    const leg = (await req(cookie, 'PATCH', '/api/legs/l0', { status: 'booked', confirmation: 'N700', departTime: '09:30' })).json();
    expect(leg).toMatchObject({ status: 'booked', departTime: '09:30', fromStop: 's0' });
    const f = (await req(cookie, 'PATCH', '/api/flights/f1', { number: 'JL1', departAt: '2026-10-24T08:00', airline: 'JAL' })).json();
    expect(f).toMatchObject({ number: 'JL1', airline: 'JAL' });
    const s = (await req(cookie, 'POST', '/api/stops', { cityKey: 'nara', name: 'Nara', nameJa: '奈良', lat: 34.68, lng: 135.8, arrive: '2026-11-01', depart: '2026-11-02' })).json();
    expect(s.ord).toBe(7);
    const hotel = (await req(cookie, 'PATCH', `/api/stops/${s.id}`, { hotelName: 'Ryokan', hotelAddressJa: '奈良県', hotelStatus: 'booked', hotelUrl: 'https://example.com' })).json();
    expect(hotel).toMatchObject({ hotelName: 'Ryokan', hotelStatus: 'booked' });
    const ck = (await req(cookie, 'PATCH', '/api/checklist/c0', { doneBy: 'Luke', assignee: 'Partner' })).json();
    expect(ck).toMatchObject({ doneBy: 'Luke', assignee: 'Partner' }); expect(ck.doneAt).toBeTruthy();
    expect((await req(cookie, 'PATCH', '/api/checklist/c1', { doneBy: 'Partner' })).statusCode).toBe(400);
    const un = (await req(cookie, 'PATCH', '/api/checklist/c0', { doneBy: null })).json();
    expect(un.doneBy).toBeUndefined(); expect(un.doneAt).toBeUndefined();
  });
  it('deleting a stop cascades', async () => {
    const { cookie } = await login();
    await req(cookie, 'POST', '/api/activities', { id: 'a3', stopId: 's1', title: 'Test activity' });
    await req(cookie, 'POST', '/api/comments', { targetType: 'activity', targetId: 'a3', body: 'hi' });
    await req(cookie, 'POST', '/api/reactions', { targetType: 'activity', targetId: 'a3', emoji: '👍' });
    const heard: string[] = []; app.hub.onBroadcast((m) => { if (m.type === 'change') heard.push(m.event.collection + ':' + m.event.op); });
    expect((await req(cookie, 'DELETE', '/api/stops/s1')).statusCode).toBe(200);
    const t = (await req(cookie, 'GET', '/api/trip')).json();
    expect(t.stops.find((s: { id: string }) => s.id === 's1')).toBeUndefined();
    expect(t.activities.find((a: { id: string }) => a.id === 'a3')).toBeUndefined();
    expect(t.legs.every((l: { fromStop: string; toStop: string }) => l.fromStop !== 's1' && l.toStop !== 's1')).toBe(true);
    expect(t.comments).toHaveLength(0); expect(t.reactions).toHaveLength(0);
    expect(heard).toContain('stops:delete'); expect(heard).toContain('comments:delete');
  });
});

describe('comments and reactions', () => {
  it('forces comment author to session user; only author edits/deletes', async () => {
    const l = await login('Luke'), p = await login('Partner');
    const c = (await req(l.cookie, 'POST', '/api/comments', { targetType: 'stop', targetId: 's0', body: 'Hello', author: 'Partner' })).json();
    expect(c.author).toBe('Luke'); expect(c.createdAt).toBeTruthy();
    expect((await req(p.cookie, 'PATCH', `/api/comments/${c.id}`, { body: 'hax' })).statusCode).toBe(403);
    expect((await req(p.cookie, 'DELETE', `/api/comments/${c.id}`)).statusCode).toBe(403);
    expect((await req(l.cookie, 'PATCH', `/api/comments/${c.id}`, { body: 'Edited' })).json().body).toBe('Edited');
    expect((await req(l.cookie, 'POST', '/api/comments', { targetType: 'stop', targetId: 'ghost', body: 'x' })).statusCode).toBe(400);
    expect((await req(l.cookie, 'DELETE', `/api/comments/${c.id}`)).statusCode).toBe(200);
  });
  it('toggles reactions keyed by author', async () => {
    const l = await login('Luke'), p = await login('Partner');
    await req(l.cookie, 'POST', '/api/activities', { id: 'a1', stopId: 's0', title: 'Test activity' });
    const post = (cookie: string, emoji = '👍') => req(cookie, 'POST', '/api/reactions', { targetType: 'activity', targetId: 'a1', emoji, author: 'spoof' });
    expect((await post(l.cookie)).json()).toMatchObject({ author: 'Luke', active: true });
    await post(p.cookie);
    let t = (await req(l.cookie, 'GET', '/api/trip')).json();
    expect(t.reactions).toHaveLength(2);
    expect((await post(l.cookie)).json().active).toBe(false);
    t = (await req(l.cookie, 'GET', '/api/trip')).json();
    expect(t.reactions).toEqual([{ id: 'activity:a1:Partner:👍', targetType: 'activity', targetId: 'a1', author: 'Partner', emoji: '👍' }]);
    expect((await post(l.cookie, '💩')).statusCode).toBe(400);
    expect((await req(l.cookie, 'POST', '/api/reactions', { targetType: 'leg', targetId: 'l0', emoji: '👍' })).statusCode).toBe(400);
    const id = encodeURIComponent('activity:a1:Partner:👍');
    expect((await req(l.cookie, 'DELETE', `/api/reactions/${id}`)).statusCode).toBe(404); // not yours
    expect((await req(p.cookie, 'DELETE', `/api/reactions/${id}`)).statusCode).toBe(200);
  });
});

describe('realtime + whatsnew', () => {
  it('broadcasts every mutation via hub', async () => {
    const { cookie } = await login();
    const seen: WsMessage[] = []; app.hub.onBroadcast((m) => seen.push(m));
    await req(cookie, 'POST', '/api/checklist', { text: 'Passport' });
    await req(cookie, 'PATCH', '/api/legs/l0', { status: 'booked' });
    await req(cookie, 'POST', '/api/reactions', { targetType: 'stop', targetId: 's0', emoji: '👎' });
    await req(cookie, 'POST', '/api/checklist', { text: '' }); // invalid -> no broadcast
    const ch = seen.filter((m) => m.type === 'change') as Extract<WsMessage, { type: 'change' }>[];
    expect(ch.map((m) => m.event.collection)).toEqual(['checklist', 'legs', 'reactions']);
    expect(ch[0].event).toMatchObject({ op: 'upsert', author: 'Luke', entity: { text: 'Passport' } });
    expect(ch[0].event.summary).toContain('Luke added checklist item');
  });
  it('whatsnew excludes own changes, honours since/last_seen', async () => {
    const l = await login('Luke'), p = await login('Partner');
    const before = new Date(Date.now() - 1000).toISOString();
    await req(l.cookie, 'POST', '/api/checklist', { text: 'A' });
    await req(p.cookie, 'POST', '/api/checklist', { text: 'B' });
    const wn = (await req(p.cookie, 'GET', '/api/whatsnew')).json();
    expect(wn.events.map((e: { summary: string }) => e.summary)).toEqual(['Luke added checklist item "A"']);
    expect((await req(p.cookie, 'GET', `/api/whatsnew?since=${before}`)).json().events).toHaveLength(1);
    expect((await req(p.cookie, 'GET', '/api/whatsnew?since=garbage')).statusCode).toBe(400);
    expect((await req(p.cookie, 'POST', '/api/seen')).statusCode).toBe(204);
    expect((await req(p.cookie, 'GET', '/api/whatsnew')).json().events).toHaveLength(0);
    await new Promise((r) => setTimeout(r, 5));
    await req(l.cookie, 'DELETE', '/api/checklist/c0');
    const after = (await req(p.cookie, 'GET', '/api/whatsnew')).json();
    expect(after.events).toHaveLength(1); expect(after.events[0]).toMatchObject({ op: 'delete', entityId: 'c0' });
  });
  it('websocket presence over a real socket', async () => {
    await app.listen({ port: 0, host: '127.0.0.1' });
    const port = (app.server.address() as { port: number }).port;
    const l = await login('Luke');
    const p = await login('Partner');
    const open = (cookie: string) => new Promise<{ ws: WebSocket; msgs: WsMessage[] }>((res, rej) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers: { cookie } }); const msgs: WsMessage[] = [];
      ws.on('message', (d) => msgs.push(JSON.parse(d.toString()))); ws.on('open', () => res({ ws, msgs })); ws.on('error', rej);
    });
    await expect(new Promise((res, rej) => { const w = new WebSocket(`ws://127.0.0.1:${port}/ws`); w.on('open', res); w.on('error', rej); })).rejects.toBeTruthy();
    const a = await open(l.cookie); const b = await open(p.cookie);
    a.ws.send(JSON.stringify({ type: 'viewing', stopId: 's2' }));
    await new Promise((r) => setTimeout(r, 150));
    const last = [...b.msgs].reverse().find((m) => m.type === 'presence') as Extract<WsMessage, { type: 'presence' }>;
    expect(last.users).toContainEqual({ name: 'Luke', stopId: 's2' }); expect(last.users).toContainEqual({ name: 'Partner' });
    await req(l.cookie, 'POST', '/api/checklist', { text: 'ws' });
    await new Promise((r) => setTimeout(r, 150));
    expect(b.msgs.some((m) => m.type === 'change' && m.event.entity && (m.event.entity as { text: string }).text === 'ws')).toBe(true);
    a.ws.close();
    await new Promise((r) => setTimeout(r, 150));
    const after = [...b.msgs].reverse().find((m) => m.type === 'presence') as Extract<WsMessage, { type: 'presence' }>;
    expect(after.users.map((u) => u.name)).toEqual(['Partner']);
    b.ws.close();
  });
});

describe('seed', () => {
  it('is idempotent across restarts and does not overwrite edits', async () => {
    const { cookie } = await login();
    await req(cookie, 'PATCH', '/api/stops/s0', { hotelName: 'Edited' });
    await req(cookie, 'DELETE', '/api/checklist/c0');
    await app.close();
    app = mk();
    const c2 = (await login()).cookie;
    const t = (await req(c2, 'GET', '/api/trip')).json();
    expect(t.stops).toHaveLength(7); expect(t.stops[0].hotelName).toBe('Edited');
    expect(t.checklist.find((c: { id: string }) => c.id === 'c0')).toBeUndefined();
    expect(seedIfEmpty(app.db)).toBe(false);
  });
});

describe('weather', () => {
  const fake = (body: unknown, ok = true) => (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;
  const today = new Date('2026-10-02T00:00:00Z');
  beforeEach(() => clearWeatherCache());
  it('uses forecast within 15 days, archive otherwise, and caches', async () => {
    const urls: string[] = [];
    const f = (async (u: string) => { urls.push(u); return { ok: true, json: async () => ({ daily: { temperature_2m_max: [20.5], temperature_2m_min: [11], weather_code: [3], precipitation_probability_max: [40] } }) }; }) as unknown as typeof fetch;
    const a = await getWeather(35.68, 139.76, '2026-10-10', { fetchFn: f, now: today });
    expect(a).toEqual({ date: '2026-10-10', tmax: 20.5, tmin: 11, code: 3, rainPct: 40, kind: 'forecast' });
    expect(urls[0]).toContain('api.open-meteo.com/v1/forecast');
    const b = await getWeather(35.68, 139.76, '2026-11-02', { fetchFn: f, now: today });
    expect(b).toMatchObject({ kind: 'typical', date: '2026-11-02' });
    expect(urls[1]).toContain('archive-api.open-meteo.com'); expect(urls[1]).toContain('start_date=2025-11-02');
    await getWeather(35.68, 139.76, '2026-11-02', { fetchFn: f, now: today });
    expect(urls).toHaveLength(2);
    expect(prevYear('2028-02-29')).toBe('2027-02-28');
  });
  it('returns null on failure and via route validates input', async () => {
    expect(await getWeather(1, 1, '2026-10-03', { fetchFn: fake({}, false), now: today })).toBeNull();
    expect(await getWeather(1, 1, '2026-10-03', { fetchFn: (async () => { throw new Error('x'); }) as unknown as typeof fetch, now: today })).toBeNull();
    const { cookie } = await login();
    expect((await req(cookie, 'GET', '/api/weather?lat=999&lng=1&date=2026-10-24')).statusCode).toBe(400);
    expect((await req(cookie, 'GET', '/api/weather?lat=1&lng=1&date=bad')).statusCode).toBe(400);
    expect((await req(cookie, 'GET', '/api/weather?lat=abc&lng=1&date=2026-10-24')).statusCode).toBe(400);
  });
});

import { describe as d2, it as i2, expect as e2 } from 'vitest';
d2('auth bypass regressions', () => {
  i2('percent-encoded /api and /ws paths still require auth', async () => {
    const app = buildApp({ dbPath: ':memory:', passphrase: 'x', sessionSecret: 's', production: false });
    for (const url of ['/%61pi/trip', '/%61pi/me', '/api%2Ftrip', '/%41PI/trip']) {
      const r = await app.inject({ method: 'GET', url });
      e2(r.body).not.toContain('"stops"'); e2(r.body).not.toContain('"travellers"');
    }
    const w = await app.inject({ method: 'GET', url: '/%77s' }); e2(w.statusCode).not.toBe(200);
    await app.close();
  });
});

import { openDb, pruneChanges, migrate } from './db';
import Database from 'better-sqlite3';
import { Hub } from './realtime';

describe('final polish', () => {
  it('createOnly leg returns existing without overwriting; plain duplicate pair is 409', async () => {
    const { cookie } = await login();
    const trip = (await req(cookie, 'GET', '/api/trip')).json();
    const [a, b] = trip.stops;
    const leg = trip.legs.find((l: any) => l.fromStop === a.id && l.toStop === b.id);
    await req(cookie, 'PATCH', `/api/legs/${leg.id}`, { status: 'booked', confirmation: 'ABC' });
    const r = await req(cookie, 'POST', '/api/legs', { id: `leg-${a.id}-${b.id}`, fromStop: a.id, toStop: b.id, status: 'to_book', createOnly: true });
    expect(r.statusCode).toBe(200); expect(r.json()).toMatchObject({ id: leg.id, status: 'booked', confirmation: 'ABC' });
    expect((await req(cookie, 'POST', '/api/legs', { id: 'other', fromStop: a.id, toStop: b.id })).statusCode).toBe(409);
    expect((await req(cookie, 'POST', '/api/legs', { id: leg.id, fromStop: a.id, toStop: b.id, status: 'to_book', createOnly: true })).json().status).toBe('booked');
    // new pair, createOnly creates (201) with deterministic id
    const c = trip.stops[trip.stops.length - 1];
    const n = await req(cookie, 'POST', '/api/legs', { id: `leg-${a.id}-${c.id}`, fromStop: a.id, toStop: c.id, status: 'to_book', createOnly: true });
    expect(n.statusCode).toBe(201);
    expect((await req(cookie, 'POST', '/api/legs', { id: `leg-${a.id}-${c.id}`, fromStop: a.id, toStop: c.id, createOnly: true })).statusCode).toBe(200);
    expect((await req(cookie, 'GET', '/api/trip')).json().legs.filter((l: any) => l.fromStop === a.id && l.toStop === c.id)).toHaveLength(1);
  });

  it('reorder is atomic, validated and broadcasts upserts', async () => {
    const { cookie } = await login();
    const ids: string[] = (await req(cookie, 'GET', '/api/trip')).json().stops.map((s: any) => s.id);
    const seen: WsMessage[] = []; app.hub.onBroadcast((m) => seen.push(m));
    const next = [...ids]; [next[0], next[1]] = [next[1], next[0]];
    const r = await req(cookie, 'POST', '/api/stops/reorder', { ids: next });
    expect(r.statusCode).toBe(200); expect(r.json().stops).toHaveLength(2);
    expect(seen.filter((m) => m.type === 'change' && m.event.collection === 'stops' && m.event.op === 'upsert')).toHaveLength(2);
    expect((await req(cookie, 'GET', '/api/trip')).json().stops.map((s: any) => s.id)).toEqual(next);
    for (const bad of [{}, { ids: [] }, { ids: 'x' }, { ids: [next[0], next[0], ...next.slice(2)] }, { ids: [...next.slice(1), 'nope'] }, { ids: [1, 2] }])
      expect((await req(cookie, 'POST', '/api/stops/reorder', bad)).statusCode, JSON.stringify(bad)).toBe(400);
    expect((await req(cookie, 'POST', '/api/stops/reorder', { ids: next.slice(1) })).statusCode).toBe(409);
    expect((await req(cookie, 'GET', '/api/trip')).json().stops.map((s: any) => s.id)).toEqual(next);
  });

  it('stop delete cascades and broadcasts a delete per child', async () => {
    const { cookie } = await login();
    const trip = (await req(cookie, 'GET', '/api/trip')).json();
    const s = trip.stops[1];
    const act = (await req(cookie, 'POST', '/api/activities', { stopId: s.id, title: 'x' })).json();
    await req(cookie, 'POST', '/api/comments', { targetType: 'activity', targetId: act.id, body: 'hi' });
    await req(cookie, 'POST', '/api/reactions', { targetType: 'stop', targetId: s.id, emoji: '👍' });
    const seen: WsMessage[] = []; app.hub.onBroadcast((m) => seen.push(m));
    expect((await req(cookie, 'DELETE', `/api/stops/${s.id}`)).statusCode).toBe(200);
    const del = seen.flatMap((m) => (m.type === 'change' && m.event.op === 'delete' ? [m.event.collection] : []));
    for (const c of ['stops', 'activities', 'legs', 'comments', 'reactions']) expect(del).toContain(c);
    const after = (await req(cookie, 'GET', '/api/trip')).json();
    expect(after.legs.some((l: any) => l.fromStop === s.id || l.toStop === s.id)).toBe(false);
    expect(after.activities.some((a: any) => a.stopId === s.id)).toBe(false);
  });

  it('hotelNotes validated and persisted', async () => {
    const { cookie } = await login();
    const s = (await req(cookie, 'GET', '/api/trip')).json().stops[0];
    expect((await req(cookie, 'PATCH', `/api/stops/${s.id}`, { hotelNotes: 'x'.repeat(1001) })).statusCode).toBe(400);
    expect((await req(cookie, 'PATCH', `/api/stops/${s.id}`, { hotelNotes: 'Check-in 3pm' })).json().hotelNotes).toBe('Check-in 3pm');
    expect((await req(cookie, 'PATCH', `/api/stops/${s.id}`, { hotelNotes: '' })).json().hotelNotes).toBeUndefined();
  });

  it('migrates old ♥/⭐ reactions to 👍 (deduped) and leaves 🤔', () => {
    const db = openDb(join(dir, 'react.db'));
    const ins = db.prepare('INSERT INTO reactions(target_type,target_id,author,emoji) VALUES(?,?,?,?)');
    ins.run('activity', 'a1', 'Luke', '♥'); ins.run('activity', 'a1', 'Luke', '⭐'); ins.run('activity', 'a1', 'Partner', '🤔'); ins.run('stop', 's1', 'Partner', '⭐');
    migrate(db);
    expect(db.prepare('SELECT target_id, author, emoji FROM reactions ORDER BY target_id, author').all()).toEqual([
      { target_id: 'a1', author: 'Luke', emoji: '👍' }, { target_id: 'a1', author: 'Partner', emoji: '🤔' }, { target_id: 's1', author: 'Partner', emoji: '👍' }]);
    db.close();
  });

  it('migrates a DB from the old schema: dedupes legs keeping oldest, adds hotel_notes, prunes old changes', () => {
    const p = join(dir, 'old.db');
    const old = new Database(p);
    old.exec(`CREATE TABLE stops(id TEXT PRIMARY KEY, ord INTEGER NOT NULL, city_key TEXT NOT NULL, name TEXT NOT NULL, name_ja TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL, arrive TEXT NOT NULL, depart TEXT NOT NULL, hotel_name TEXT, hotel_url TEXT, hotel_address_ja TEXT, hotel_lat REAL, hotel_lng REAL, hotel_status TEXT NOT NULL DEFAULT 'none', hotel_cost REAL, hotel_confirmation TEXT, notes TEXT, created_by TEXT, updated_at TEXT);
CREATE TABLE legs(id TEXT PRIMARY KEY, from_stop TEXT NOT NULL, to_stop TEXT NOT NULL, depart_time TEXT, arrive_time TEXT, summary TEXT, status TEXT NOT NULL DEFAULT 'to_book', cost REAL, confirmation TEXT, notes TEXT, updated_at TEXT);
CREATE TABLE comments(id TEXT PRIMARY KEY, target_type TEXT NOT NULL, target_id TEXT NOT NULL, author TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE changes(seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL, collection TEXT NOT NULL, op TEXT NOT NULL, entity_id TEXT NOT NULL, entity TEXT, author TEXT NOT NULL, at TEXT NOT NULL, summary TEXT NOT NULL);
INSERT INTO legs(id,from_stop,to_stop,status) VALUES('a','s1','s2','booked'),('b','s1','s2','to_book'),('c','s2','s3','to_book');
INSERT INTO comments VALUES('c1','leg','b','Luke','dup','2026-01-01');
INSERT INTO changes(id,collection,op,entity_id,author,at,summary) VALUES('o','legs','upsert','a','L','2020-01-01T00:00:00.000Z','old'),('n','legs','upsert','a','L','${new Date().toISOString()}','new');`);
    old.close();
    const db = openDb(p);
    expect((db.prepare('SELECT id FROM legs ORDER BY rowid').all() as any[]).map((r) => r.id)).toEqual(['a', 'c']);
    expect(db.prepare('SELECT COUNT(*) n FROM comments').get()).toEqual({ n: 0 });
    expect((db.pragma('table_info(stops)') as any[]).some((c) => c.name === 'hotel_notes')).toBe(true);
    expect((db.prepare('SELECT id FROM changes').all() as any[]).map((r) => r.id)).toEqual(['n']);
    expect(() => db.prepare("INSERT INTO legs(id,from_stop,to_stop) VALUES('z','s1','s2')").run()).toThrow(/UNIQUE/);
    expect(() => { migrate(db); }).not.toThrow(); // idempotent
    expect(pruneChanges(db, 90)).toBe(0);
    db.close();
  });

  it('hub heartbeat terminates sockets missing a pong and throttles viewing', () => {
    const mkWs = () => { const w: any = { readyState: 1, sent: [] as string[], pings: 0, terminated: false, send(d: string) { this.sent.push(d); }, ping() { this.pings++; }, terminate() { this.terminated = true; } }; return w; };
    const hub = new Hub(); const a = mkWs(), b = mkWs();
    hub.add(a, 'Luke'); hub.add(b, 'Partner');
    a.sent.length = 0; b.sent.length = 0;
    hub.viewing(a, 's1'); expect(b.sent).toHaveLength(1);
    hub.viewing(a, 's1'); hub.viewing(a, 's1'); expect(b.sent).toHaveLength(1);
    hub.viewing(a, 's2'); expect(b.sent).toHaveLength(2);
    hub.heartbeat(); expect(a.pings).toBe(1); expect(b.pings).toBe(1);
    hub.pong(a);
    hub.heartbeat();
    expect(b.terminated).toBe(true); expect(a.terminated).toBe(false);
    expect(hub.presence().map((u) => u.name)).toEqual(['Luke']);
  });
});


describe('transport storage', () => {
  it('persists shared settings and independent purchase/reservation state across restart', async () => {
    const { cookie } = await login();
    const settings = await req(cookie, 'POST', '/api/transportPlans', { id: 'transport', adults: 3, eligibilityConfirmed: true });
    expect(settings.statusCode).toBe(200);
    const saved = await req(cookie, 'POST', '/api/transportBookings', { id: 'tb1', kind: 'journey', sourceType: 'leg', sourceId: 'l0', journeyKey: 'leg-l0', travelDate: '2026-10-26', purchased: true, adults: 2, fareEstimate: 5500, confirmation: 'ABC' });
    expect(saved.statusCode).toBe(201);
    expect(saved.json()).toMatchObject({ purchased: true, seatReserved: false });
    const reserved = await req(cookie, 'PATCH', '/api/transportBookings/tb1', { seatReserved: true, payOnDay: true });
    expect(reserved.json()).toMatchObject({ purchased: true, seatReserved: true, confirmation: 'ABC' });
    const leg = (await req(cookie, 'GET', '/api/trip')).json().legs.find((x: { id: string }) => x.id === 'l0');
    expect(leg.status).toBe('to_book');
    await app.close(); app = mk();
    const trip = (await req(cookie, 'GET', '/api/trip')).json();
    expect(trip.transportPlans).toEqual([{ id: 'transport', adults: 3, eligibilityConfirmed: true }]);
    expect(trip.transportBookings.find((b: { id: string }) => b.id === 'tb1')).toMatchObject({ purchased: true, seatReserved: true, payOnDay: true, adults: 2, fareEstimate: 5500, confirmation: 'ABC' });
    const partner = await login('Partner');
    const news = (await req(partner.cookie, 'GET', '/api/whatsnew')).json();
    expect(news.events.some((e: { collection: string }) => e.collection === 'transportBookings')).toBe(true);
  });
  it('rejects invalid settings, dates and status fields', async () => {
    const { cookie } = await login();
    for (const adults of [0, -1, 1.5, 21]) expect((await req(cookie, 'POST', '/api/transportPlans', { id: 'transport', adults })).statusCode).toBe(400);
    expect((await req(cookie, 'POST', '/api/transportPlans', { id: 'other', adults: 2 })).statusCode).toBe(400);
    for (const bad of [{ travelDate: '2026-02-30' }, { purchased: 'yes' }, { payOnDay: 'yes' }, { kind: 'unknown' }, { cost: -1 }, { fareEstimate: -1 }, { adults: 0 }, { adults: 21 }, { adults: 1.5 }]) {
      expect((await req(cookie, 'POST', '/api/transportBookings', { kind: 'journey', ...bad })).statusCode).toBe(400);
    }
  });
  it('stores journey segments as a full-replacement list and keeps them across restart', async () => {
    const { cookie } = await login();
    const segments = [
      { id: 'seg-1', ord: 0, service: 'Revaty Kegon 013', fromStation: 'Asakusa', toStation: 'Tobu-Nikko', departTime: '09:30', arriveTime: '11:22', status: 'booked' },
      { id: 'seg-2', ord: 1, service: 'JR local', status: 'to_book' },
    ];
    const saved = await req(cookie, 'POST', '/api/transportBookings', { id: 'tb-seg', kind: 'journey', journeyKey: 'leg:s0:s1', segments });
    expect(saved.statusCode).toBe(201);
    expect(saved.json().segments).toEqual(segments);
    // a new array replaces the whole list; an omitted status defaults to to_book and empty fields are dropped
    const patched = await req(cookie, 'PATCH', '/api/transportBookings/tb-seg', { segments: [{ id: 'seg-3', ord: 0, service: ' ' }, { id: 'seg-4', ord: 1, status: 'na' }] });
    const replaced = [{ id: 'seg-3', ord: 0, status: 'to_book' }, { id: 'seg-4', ord: 1, status: 'na' }];
    expect(patched.json().segments).toEqual(replaced);
    await app.close(); app = mk();
    const trip = (await req(cookie, 'GET', '/api/trip')).json();
    expect(trip.transportBookings.find((b: { id: string }) => b.id === 'tb-seg').segments).toEqual(replaced);
    const cleared = await req(cookie, 'PATCH', '/api/transportBookings/tb-seg', { segments: null });
    expect(cleared.json().segments).toBeUndefined();
  });
  it('persists service booking details and explicit overnight days, then clears them', async () => {
    const { cookie } = await login();
    const segment = { id: 'night', ord: 0, status: 'booked', departTime: '23:15', arriveTime: '02:10',
      departDayOffset: 0, arriveDayOffset: 1, confirmation: 'SERVICE-REF', seatDetails: 'Car 2, 3A', instructions: 'Collect at the station', bookingUrl: 'https://smart-ex.jp/en/' };
    const saved = await req(cookie, 'POST', '/api/transportBookings', { id: 'overnight', kind: 'journey', journeyKey: 'leg:s0:s1', segments: [segment] });
    expect(saved.statusCode).toBe(201);
    expect(saved.json().segments).toEqual([segment]);
    await app.close(); app = mk();
    const trip = (await req(cookie, 'GET', '/api/trip')).json();
    expect(trip.transportBookings.find((b: { id: string }) => b.id === 'overnight').segments).toEqual([segment]);
    const cleared = await req(cookie, 'PATCH', '/api/transportBookings/overnight', { segments: [{ id: 'night', ord: 0, status: 'na', confirmation: null, seatDetails: null, instructions: null, bookingUrl: null }] });
    expect(cleared.json().segments).toEqual([{ id: 'night', ord: 0, status: 'na' }]);
  });
  it('rejects impossible service times and invalid optional detail fields', async () => {
    const { cookie } = await login();
    for (const invalid of [
      { departTime: '23:00', arriveTime: '01:00' },
      { departTime: '12:00', arriveTime: '12:30', departDayOffset: 2, arriveDayOffset: 1 },
      { departDayOffset: -1 }, { arriveDayOffset: 1.5 }, { arriveDayOffset: 31 },
      { bookingUrl: 'javascript:alert(1)' }, { bookingUrl: 'data:text/html,test' }, { bookingUrl: 'not a URL' }, { bookingUrl: 'https://example.com/' + 'x'.repeat(500) },
      { confirmation: 'x'.repeat(81) }, { seatDetails: 'x'.repeat(121) }, { instructions: 'x'.repeat(2001) },
    ]) {
      const response = await req(cookie, 'POST', '/api/transportBookings', { id: 'invalid-details', kind: 'journey',
        segments: [{ id: 'invalid', ord: 0, status: 'to_book', ...invalid }] });
      expect(response.statusCode, JSON.stringify(invalid)).toBe(400);
    }
  });
  it('rejects malformed segment lists', async () => {
    const { cookie } = await login();
    for (const bad of [
      'not-an-array',
      [{ ord: 0, status: 'booked' }],
      [{ id: 'seg-1', ord: -1, status: 'booked' }],
      [{ id: 'seg-1', ord: 0, status: 'booked', departTime: '9:30' }],
      [{ id: 'seg-1', ord: 0, status: 'someday' }],
      [{ id: 'seg-1', ord: 0, status: 'booked', platform: 7 }],
      [{ id: 'seg 1', ord: 0, status: 'booked' }],
      [{ id: 'seg-1', ord: 0, status: 'booked' }, { id: 'seg-1', ord: 1, status: 'booked' }],
      [{ id: 'seg-1', ord: 0, status: 'booked' }, { id: 'seg-2', ord: 0, status: 'booked' }],
      Array.from({ length: 13 }, (_, i) => ({ id: `seg-${i}`, ord: i, status: 'booked' })),
    ]) {
      expect((await req(cookie, 'POST', '/api/transportBookings', { id: `tb-bad`, kind: 'journey', segments: bad })).statusCode).toBe(400);
    }
  });
  it('keeps confirmations when a linked itinerary entity is removed', async () => {
    const { cookie } = await login();
    await req(cookie, 'POST', '/api/transportBookings', { id: 'tb2', kind: 'journey', sourceType: 'leg', sourceId: 'l0', confirmation: 'KEEP' });
    await req(cookie, 'DELETE', '/api/legs/l0');
    const trip = (await req(cookie, 'GET', '/api/trip')).json();
    expect(trip.transportBookings.find((b: { id: string }) => b.id === 'tb2')).toMatchObject({ confirmation: 'KEEP' });
    expect((await req(cookie, 'DELETE', '/api/transportBookings/tb2')).statusCode).toBe(200);
    expect((await req(cookie, 'GET', '/api/trip')).json().transportBookings.some((b: { id: string }) => b.id === 'tb2')).toBe(false);
  });
});
