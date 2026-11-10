import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import fstatic from '@fastify/static';
import { createHmac, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';
import type { ChangeEvent, Collection, WsClientMessage } from '../shared/api';
import { HttpError, ID_RE, SPECS, getEntity, insertRow, loadTrip, openDb, updateRow, validate } from './db';
import { Hub } from './realtime';
import { seedIfEmpty, importSavedTravelBookings } from './seed';
import { getWeather, validateWeatherQuery } from './weather';

export interface AppOptions {
  passphrase?: string; sessionSecret?: string; travellers?: string[]; dbPath?: string; production?: boolean; distDir?: string;
  fetchFn?: typeof fetch; heartbeatMs?: number;
}

const COOKIE = 'trip';
const SESSION_MS = 90 * 24 * 3600 * 1000;
const EMOJI = ['👍', '👎', '🤔'];
const now = () => new Date().toISOString();
const rid = () => randomBytes(9).toString('base64url');

function safeEqual(a: string, b: string) {
  const ha = createHash('sha256').update(a).digest(), hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function buildApp(opts: AppOptions = {}): FastifyInstance & { hub: Hub; db: Database.Database } {
  const production = opts.production ?? process.env.NODE_ENV === 'production';
  const passphrase = opts.passphrase ?? process.env.TRIP_PASSPHRASE ?? (production ? '' : 'japan');
  if (!passphrase) throw new Error('TRIP_PASSPHRASE is required in production');
  const secret = opts.sessionSecret ?? process.env.SESSION_SECRET ?? randomBytes(32).toString('hex');
  if (production && !opts.sessionSecret && !process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is required in production');
  const travellers = opts.travellers ?? (process.env.TRAVELLER_NAMES ?? 'Luke,Partner').split(',').map((s) => s.trim()).filter(Boolean);
  if (production && !opts.dbPath && !process.env.DB_PATH) throw new Error('DB_PATH is required in production (mount a volume, e.g. /data/trip.db)');
  const db = openDb(opts.dbPath ?? process.env.DB_PATH ?? './data/trip.db');
  seedIfEmpty(db);
  importSavedTravelBookings(db);
  const hub = new Hub();
  hub.startHeartbeat(opts.heartbeatMs ?? 30_000);

  const app = Fastify({ bodyLimit: 100 * 1024, trustProxy: (production ? 1 : false) as unknown as boolean, logger: false }) as unknown as FastifyInstance & { hub: Hub; db: Database.Database };
  app.hub = hub; app.db = db;
  app.register(cookie);
  app.register(websocket, { options: { maxPayload: 4096 } });

  // ---- sessions
  const sign = (p: string) => createHmac('sha256', secret).update(p).digest('base64url');
  const makeToken = (name: string) => { const p = Buffer.from(JSON.stringify({ name, exp: Date.now() + SESSION_MS })).toString('base64url'); return `${p}.${sign(p)}`; };
  const readSession = (req: FastifyRequest): string | null => {
    const raw = req.cookies?.[COOKIE];
    if (!raw) return null;
    const [p, s] = raw.split('.');
    if (!p || !s || !safeEqual(s, sign(p))) return null;
    try {
      const d = JSON.parse(Buffer.from(p, 'base64url').toString()) as { name?: unknown; exp?: unknown };
      if (typeof d.name !== 'string' || typeof d.exp !== 'number' || d.exp < Date.now() || !travellers.includes(d.name)) return null;
      return d.name;
    } catch { return null; }
  };
  const user = (req: FastifyRequest) => (req as unknown as { user: string }).user;

  // ---- security headers + same-origin + auth
  app.addHook('onSend', async (req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff').header('X-Frame-Options', 'DENY').header('Referrer-Policy', 'no-referrer');
    if (production) reply.header('Strict-Transport-Security', 'max-age=15552000');
    let up = req.url; try { up = decodeURIComponent(up); } catch { /* keep raw */ }
    if (up.startsWith('/api')) reply.header('Cache-Control', 'no-store');
  });
  const originOk = (req: FastifyRequest) => {
    const o = req.headers.origin;
    if (!o) return true;
    try { return new URL(o).host === (req.headers['x-forwarded-host'] && production ? String(req.headers['x-forwarded-host']) : req.headers.host); } catch { return false; }
  };
  app.addHook('onRequest', async (req, reply) => {
    const raw = req.url.split('?')[0];
    let dec = raw; try { dec = decodeURIComponent(raw); } catch { return reply.code(400).send({ error: 'bad path' }); }
    const route = req.routeOptions?.url ?? '';
    const looksApi = (p: string) => p === '/api' || p.startsWith('/api/'), looksWs = (p: string) => p === '/ws';
    const isApi = looksApi(raw) || looksApi(dec) || looksApi(route), isWs = looksWs(raw) || looksWs(dec) || looksWs(route);
    const path = route || dec;
    if (!isApi && !isWs) return;
    if ((req.method !== 'GET' && req.method !== 'HEAD' || isWs) && !originOk(req)) return reply.code(403).send({ error: 'cross-origin request rejected' });
    if (path === '/api/login' || path === '/api/logout' || path === '/api/travellers') return;
    const u = readSession(req);
    if (!u) return reply.code(401).send({ error: 'unauthorised' });
    (req as unknown as { user: string }).user = u;
  });
  app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
    if (err instanceof HttpError) return reply.code(err.status).send({ error: err.message });
    const sc = err.statusCode && err.statusCode < 500 ? err.statusCode : 500;
    if (sc === 500) console.error('server error:', err.message);
    return reply.code(sc).send({ error: sc === 500 ? 'internal error' : err.message });
  });

  // ---- login (rate limited)
  const fails = new Map<string, number[]>();
  const WINDOW = 15 * 60 * 1000, MAX_FAILS = 10;
  const recent = (ip: string) => { const t = Date.now(); const a = (fails.get(ip) ?? []).filter((x) => t - x < WINDOW); if (a.length) fails.set(ip, a); else fails.delete(ip); return a; };
  app.post('/api/login', async (req, reply) => {
    const ip = req.ip;
    if (recent(ip).length >= MAX_FAILS || recent('*').length >= 50) return reply.code(429).send({ error: 'too many attempts, try later' });
    const b = req.body as { passphrase?: unknown; name?: unknown } | null;
    const ok = typeof b?.passphrase === 'string' && typeof b?.name === 'string' && safeEqual(b.passphrase, passphrase) && travellers.includes(b.name);
    if (!ok) { fails.set(ip, [...recent(ip), Date.now()]); fails.set('*', [...recent('*'), Date.now()]); if (fails.size > 5000) fails.clear(); return reply.code(401).send({ error: 'invalid passphrase or name' }); }
    reply.setCookie(COOKIE, makeToken(b!.name as string), { httpOnly: true, sameSite: 'lax', secure: production, path: '/', maxAge: SESSION_MS / 1000 });
    return reply.code(204).send();
  });
  app.post('/api/logout', async (_req, reply) => { reply.clearCookie(COOKIE, { path: '/' }); return reply.code(204).send(); });
  app.get('/api/travellers', async () => travellers);
  app.get('/api/me', async (req) => ({ name: user(req), travellers }));

  app.get('/api/trip', async () => loadTrip(db));

  // ---- change log
  const logChange = (collection: Collection, op: 'upsert' | 'delete', entityId: string, entity: unknown, author: string, summary: string): ChangeEvent => {
    const ev: ChangeEvent = { id: rid(), collection, op, entityId, author, at: now(), summary, ...(entity !== undefined ? { entity } : {}) };
    db.prepare('INSERT INTO changes(id,collection,op,entity_id,entity,author,at,summary) VALUES(?,?,?,?,?,?,?,?)')
      .run(ev.id, collection, op, entityId, entity === undefined ? null : JSON.stringify(entity), author, ev.at, summary);
    return ev;
  };
  const NOUN: Record<Collection, string> = { stops: 'stop', legs: 'leg', flights: 'flight', activities: 'activity', comments: 'comment', reactions: 'reaction', checklist: 'checklist item', transportPlans: 'transport settings', transportBookings: 'transport booking' };
  const label = (c: Collection, e: Record<string, unknown>) => String(e.title ?? e.name ?? e.text ?? e.body ?? e.summary ?? e.number ?? e.direction ?? '').slice(0, 60);
  const summarise = (c: Collection, verb: string, who: string, e: Record<string, unknown>) => `${who} ${verb} ${NOUN[c]}${label(c, e) ? ` "${label(c, e)}"` : ''}`;
  const emit = (events: ChangeEvent[]) => { for (const event of events) hub.broadcast({ type: 'change', event }); };

  const exists = (table: string, id: unknown) => typeof id === 'string' && !!db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(id);
  const targetTable = (t: string) => (t === 'stop' ? 'stops' : t === 'activity' ? 'activities' : 'legs');

  type Id6 = Exclude<Collection, 'reactions'>;
  const isColl = (c: string): c is Id6 => c in SPECS;

  function deleteCascade(c: Id6, id: string, who: string, events: ChangeEvent[]) {
    const del = (cc: Id6, i: string) => {
      const before = getEntity(db, cc, i);
      if (!before) return;
      db.prepare(`DELETE FROM ${SPECS[cc].table} WHERE id=?`).run(i);
      events.push(logChange(cc, 'delete', i, undefined, who, summarise(cc, 'removed', who, before)));
    };
    const dropAttached = (t: string, i: string) => {
      for (const r of db.prepare('SELECT id FROM comments WHERE target_type=? AND target_id=?').all(t, i) as { id: string }[]) del('comments', r.id);
      for (const r of db.prepare('SELECT emoji, author FROM reactions WHERE target_type=? AND target_id=?').all(t, i) as { emoji: string; author: string }[]) {
        db.prepare('DELETE FROM reactions WHERE target_type=? AND target_id=? AND author=? AND emoji=?').run(t, i, r.author, r.emoji);
        events.push(logChange('reactions', 'delete', `${t}:${i}:${r.author}:${r.emoji}`, undefined, who, `${who} removed reaction`));
      }
    };
    if (c === 'stops') {
      for (const r of db.prepare('SELECT id FROM activities WHERE stop_id=?').all(id) as { id: string }[]) { dropAttached('activity', r.id); del('activities', r.id); }
      for (const r of db.prepare('SELECT id FROM legs WHERE from_stop=? OR to_stop=?').all(id, id) as { id: string }[]) { dropAttached('leg', r.id); del('legs', r.id); }
      dropAttached('stop', id);
    } else if (c === 'activities') dropAttached('activity', id);
    else if (c === 'legs') dropAttached('leg', id);
    del(c, id);
  }

  function checkRefs(c: Id6, v: Record<string, unknown>) {
    if (c === 'legs') {
      if ('from_stop' in v && !exists('stops', v.from_stop)) throw new HttpError(400, 'fromStop: unknown stop');
      if ('to_stop' in v && !exists('stops', v.to_stop)) throw new HttpError(400, 'toStop: unknown stop');
    } else if (c === 'activities') {
      if ('stop_id' in v && !exists('stops', v.stop_id)) throw new HttpError(400, 'stopId: unknown stop');
    } else if (c === 'comments') {
      if (!exists(targetTable(String(v.target_type)), v.target_id)) throw new HttpError(400, 'targetId: unknown target');
    }
  }

  function upsert(c: Id6, body: unknown, who: string, forcedId: string | undefined, mustExist: boolean, createOnly = false) {
    const spec = SPECS[c];
    const rawId = forcedId ?? (body && typeof body === 'object' ? (body as { id?: unknown }).id : undefined);
    if (rawId !== undefined && (typeof rawId !== 'string' || !ID_RE.test(rawId))) throw new HttpError(400, 'id: invalid');
    if (c === 'transportPlans' && rawId !== 'transport') throw new HttpError(400, 'id: transport settings must use transport');
    const existing = rawId ? getEntity(db, c, rawId as string) : undefined;
    if (mustExist && !existing) throw new HttpError(404, 'not found');
    if (createOnly && existing) return { entity: existing, created: false };
    const events: ChangeEvent[] = [];
    let result!: Record<string, unknown>;
    db.transaction(() => {
      const v = validate(spec, body, !existing);
      if (c === 'transportPlans' && ('adults' in v && v.adults === null || 'eligibility_confirmed' in v && v.eligibility_confirmed === null)) throw new HttpError(400, 'transport settings cannot be null');
      if (c === 'transportBookings' && ('purchased' in v && v.purchased === null || 'seat_reserved' in v && v.seat_reserved === null)) throw new HttpError(400, 'transport status cannot be null');
      if (createOnly && !existing && c === 'legs') {
        checkRefs(c, v);
        const dup = db.prepare('SELECT id FROM legs WHERE from_stop=? AND to_stop=?').get(v.from_stop, v.to_stop) as { id: string } | undefined;
        if (dup) { result = getEntity(db, c, dup.id)!; return; }
      }
      const b = body as Record<string, unknown>;
      if (c === 'comments') {
        if (existing) {
          if (existing.author !== who) throw new HttpError(403, 'only the author can edit a comment');
          delete v.target_type; delete v.target_id; // immutable
        } else { v.author = who; v.created_at = now(); }
      }
      if (c === 'stops' || c === 'activities') { if (!existing) v.created_by = who; v.updated_at = now(); }
      else if (c !== 'comments' && c !== 'checklist') v.updated_at = now();
      if (c === 'checklist' && 'done_by' in v) {
        if (v.done_by !== null && v.done_by !== who && !(existing && existing.doneBy === v.done_by)) throw new HttpError(400, 'doneBy: must be you');
        v.done_at = v.done_by === null ? null : (existing?.doneBy === v.done_by && existing?.doneAt ? existing.doneAt : now());
      }
      if ('assignee' in v && v.assignee !== null && !travellers.includes(v.assignee as string)) throw new HttpError(400, 'assignee: unknown traveller');
      if (!(existing && c === 'comments')) checkRefs(c, v);
      if (c === 'comments' && existing && !('body' in v)) throw new HttpError(400, 'body: required');
      if (!existing && 'ord' in spec.fields && v.ord === undefined) {
        v.ord = ((db.prepare(`SELECT MAX(ord) m FROM ${spec.table}`).get() as { m: number | null }).m ?? -1) + 1;
      }
      const id = (rawId as string | undefined) ?? rid();
      if (existing) { try { updateRow(db, spec.table, id, v); } catch (e) { if (String((e as Error).message).includes('UNIQUE')) throw new HttpError(409, 'conflict'); throw e; } }
      else { try { insertRow(db, spec.table, { id, ...v }); } catch (e) { if (String((e as Error).message).includes('UNIQUE')) throw new HttpError(409, 'conflict'); throw e; } }
      result = getEntity(db, c, id)!;
      events.push(logChange(c, 'upsert', id, result, who, summarise(c, existing ? 'updated' : 'added', who, result)));
      void b;
    })();
    emit(events);
    return { entity: result, created: !existing && events.length > 0 };
  }

  // atomic stop reorder
  app.post('/api/stops/reorder', async (req) => {
    const who = user(req);
    const ids = (req.body as { ids?: unknown } | null)?.ids;
    if (!Array.isArray(ids) || !ids.length || ids.length > 500 || !ids.every((i) => typeof i === 'string' && ID_RE.test(i))) throw new HttpError(400, 'ids: must be a non-empty array of stop ids');
    if (new Set(ids).size !== ids.length) throw new HttpError(400, 'ids: duplicate id');
    const events: ChangeEvent[] = [];
    const changed: Record<string, unknown>[] = [];
    db.transaction(() => {
      const cur = db.prepare('SELECT id, ord FROM stops').all() as { id: string; ord: number }[];
      const have = new Map(cur.map((r) => [r.id, r.ord]));
      for (const i of ids as string[]) if (!have.has(i)) throw new HttpError(400, `ids: unknown stop ${i}`);
      if (ids.length !== have.size) throw new HttpError(409, 'ids: must list every stop (trip changed, reload)');
      (ids as string[]).forEach((i, n) => {
        if (have.get(i) === n) return;
        updateRow(db, 'stops', i, { ord: n, updated_at: now() });
        const e = getEntity(db, 'stops', i)!;
        changed.push(e);
        events.push(logChange('stops', 'upsert', i, e, who, summarise('stops', 'reordered', who, e)));
      });
    })();
    emit(events);
    return { stops: changed };
  });

  for (const c of Object.keys(SPECS) as Id6[]) {
    app.post(`/api/${c}`, async (req, reply) => {
      const co = c === 'legs' && !!req.body && typeof req.body === 'object' && (req.body as { createOnly?: unknown }).createOnly === true;
      const r = upsert(c, req.body, user(req), undefined, false, co);
      return reply.code(r.created ? 201 : 200).send(r.entity);
    });
    app.patch(`/api/${c}/:id`, async (req) => upsert(c, req.body, user(req), (req.params as { id: string }).id, true).entity);
    app.delete(`/api/${c}/:id`, async (req) => {
      const id = (req.params as { id: string }).id, who = user(req);
      const before = getEntity(db, c, id);
      if (!before) throw new HttpError(404, 'not found');
      if (c === 'comments' && before.author !== who) throw new HttpError(403, 'only the author can delete a comment');
      const events: ChangeEvent[] = [];
      db.transaction(() => deleteCascade(c, id, who, events))();
      emit(events);
      return { ok: true };
    });
  }

  // ---- reactions (toggle)
  app.post('/api/reactions', async (req) => {
    const who = user(req);
    const b = req.body as { targetType?: unknown; targetId?: unknown; emoji?: unknown } | null;
    if (!b || typeof b !== 'object') throw new HttpError(400, 'body must be an object');
    if (b.targetType !== 'activity' && b.targetType !== 'stop') throw new HttpError(400, 'targetType: must be activity|stop');
    if (typeof b.emoji !== 'string' || !EMOJI.includes(b.emoji)) throw new HttpError(400, 'emoji: invalid');
    if (typeof b.targetId !== 'string' || !exists(targetTable(b.targetType), b.targetId)) throw new HttpError(400, 'targetId: unknown target');
    const r = { targetType: b.targetType, targetId: b.targetId, author: who, emoji: b.emoji };
    const id = `${r.targetType}:${r.targetId}:${who}:${r.emoji}`;
    let event!: ChangeEvent, active = false;
    db.transaction(() => {
      const del = db.prepare('DELETE FROM reactions WHERE target_type=? AND target_id=? AND author=? AND emoji=?').run(r.targetType, r.targetId, who, r.emoji);
      if (del.changes) event = logChange('reactions', 'delete', id, r, who, `${who} removed ${r.emoji}`);
      else {
        db.prepare('INSERT INTO reactions(target_type,target_id,author,emoji) VALUES(?,?,?,?)').run(r.targetType, r.targetId, who, r.emoji);
        active = true; event = logChange('reactions', 'upsert', id, r, who, `${who} reacted ${r.emoji}`);
      }
    })();
    emit([event]);
    return { ...r, id, active };
  });
  app.delete('/api/reactions/:id', async (req) => {
    const who = user(req);
    const id = (req.params as { id: string }).id;
    const m = /^(activity|stop):([A-Za-z0-9_-]{1,40}):([^:]{1,40}):(.{1,8})$/.exec(id);
    if (!m || m[3] !== who) throw new HttpError(404, 'not found');
    const res = db.prepare('DELETE FROM reactions WHERE target_type=? AND target_id=? AND author=? AND emoji=?').run(m[1], m[2], who, m[4]);
    if (!res.changes) throw new HttpError(404, 'not found');
    emit([logChange('reactions', 'delete', id, { targetType: m[1], targetId: m[2], author: who, emoji: m[4] }, who, `${who} removed ${m[4]}`)]);
    return { ok: true };
  });

  // ---- what's new
  const seenOf = (name: string) => (db.prepare('SELECT last_seen FROM users_seen WHERE name=?').get(name) as { last_seen: string } | undefined)?.last_seen;
  app.get('/api/whatsnew', async (req) => {
    const q = req.query as { since?: string };
    let since = q.since ?? seenOf(user(req)) ?? '1970-01-01T00:00:00.000Z';
    if (Number.isNaN(Date.parse(since))) throw new HttpError(400, 'since: invalid timestamp');
    since = new Date(since).toISOString();
    const rows = db.prepare('SELECT * FROM (SELECT * FROM changes WHERE at > ? AND author != ? ORDER BY seq DESC LIMIT 200) ORDER BY seq').all(since, user(req)) as Record<string, string | null>[];
    const events: ChangeEvent[] = rows.map((r) => ({
      id: r.id!, collection: r.collection as Collection, op: r.op as 'upsert' | 'delete', entityId: r.entity_id!, author: r.author!, at: r.at!, summary: r.summary!,
      ...(r.entity ? { entity: JSON.parse(r.entity) } : {}),
    }));
    return { since, events };
  });
  app.post('/api/seen', async (req, reply) => {
    db.prepare('INSERT INTO users_seen(name,last_seen) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET last_seen=excluded.last_seen').run(user(req), now());
    return reply.code(204).send();
  });

  // ---- weather
  app.get('/api/weather', async (req, reply) => {
    const q = validateWeatherQuery(req.query as Record<string, string>);
    if (!q) return reply.code(400).send({ error: 'invalid lat/lng/date' });
    return (await getWeather(q.lat, q.lng, q.date, { fetchFn: opts.fetchFn })) ?? null;
  });

  // ---- websocket
  app.register(async (inst) => {
    inst.get('/ws', { websocket: true }, (socket, req) => {
      hub.add(socket, user(req));
      socket.on('message', (raw: Buffer) => {
        try {
          const m = JSON.parse(raw.toString()) as WsClientMessage;
          if (m?.type === 'viewing') {
            const sid = typeof m.stopId === 'string' && ID_RE.test(m.stopId) ? m.stopId : undefined;
            hub.viewing(socket, sid);
          }
        } catch { /* ignore malformed */ }
      });
      socket.on('pong', () => hub.pong(socket));
      socket.on('close', () => hub.remove(socket));
      socket.on('error', () => hub.remove(socket));
    });
  });
  app.addHook('onClose', async () => { hub.closeAll(); db.close(); });

  // ---- static + SPA fallback
  const dist = opts.distDir ?? resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
  const hasDist = existsSync(resolve(dist, 'index.html'));
  if (hasDist) app.register(fstatic, { root: dist, wildcard: false, index: ['index.html'] });
  app.setNotFoundHandler((req, reply) => {
    const path = req.url.split('?')[0];
    if (path.startsWith('/api') || path === '/ws' || req.method !== 'GET' || !hasDist) return reply.code(404).send({ error: 'not found' });
    return reply.sendFile('index.html');
  });

  return app;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const app = buildApp();
  const port = Number(process.env.PORT ?? 3000);
  app.listen({ port, host: '0.0.0.0' }).then(() => console.log(`Trip planner listening on :${port}`)).catch((e) => { console.error(e.message); process.exit(1); });
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { try { app.hub.closeAll(); app.db.pragma('wal_checkpoint(TRUNCATE)'); } catch { /* ignore */ } app.close().finally(() => process.exit(0)); setTimeout(() => process.exit(0), 4000).unref(); });
}
