// OWNED BY: Collaboration agent. fetch-based ApiClient for shared/api.ts REST routes.
import type { ApiClient, ChangeEvent, WeatherDay } from '@shared/api';
import type { Stop, TripData } from '@shared/types';

async function req(method: string, url: string, body?: unknown): Promise<Response> {
  const r = await fetch(url, { method, credentials: 'same-origin', headers: body !== undefined ? { 'content-type': 'application/json' } : undefined, body: body !== undefined ? JSON.stringify(body) : undefined });
  return r;
}
async function json<T>(r: Response): Promise<T> { return (await r.json()) as T; }
function fail(r: Response): never { throw new Error(`${r.status} ${r.statusText}`.trim()); }

export const realApi: ApiClient = {
  async login(passphrase, name) {
    const r = await req('POST', '/api/login', { passphrase, name });
    if (!r.ok) { const e = new Error(r.status === 401 || r.status === 403 ? 'Wrong passphrase' : `Login failed (${r.status})`); throw e; }
  },
  async me() {
    const r = await req('GET', '/api/me');
    if (r.status === 401) { try { localStorage.removeItem('japan-today-cache-v1'); } catch { /* ignore */ } return null; }
    if (!r.ok) fail(r);
    return json(r);
  },
  async trip() { const r = await req('GET', '/api/trip'); if (!r.ok) fail(r); return json<TripData>(r); },
  async save(c, entity, opts) {
    const id = (entity as { id?: string }).id;
    let r: Response;
    if (opts?.createOnly) r = await req('POST', `/api/${c}`, { ...entity, createOnly: true }); // server returns the existing row untouched
    else if (id && c !== 'reactions') {
      r = await req('PATCH', `/api/${c}/${encodeURIComponent(id)}`, entity);
      if (r.status === 404) r = await req('POST', `/api/${c}`, entity); // upsert with client id
    } else r = await req('POST', `/api/${c}`, entity);
    if (!r.ok) fail(r);
    if (r.status === 204) return entity as never;
    const out = await r.json().catch(() => null);
    return { ...entity, ...(out ?? {}) } as never;
  },
  async reorderStops(ids) {
    const r = await req('POST', '/api/stops/reorder', { ids }); if (!r.ok) fail(r);
    return (await json<{ stops: Stop[] }>(r)).stops;
  },
  async remove(c, id) { const r = await req('DELETE', `/api/${c}/${encodeURIComponent(id)}`); if (!r.ok && r.status !== 404) fail(r); },
  async weather(lat, lng, date) {
    const r = await req('GET', `/api/weather?lat=${lat}&lng=${lng}&date=${date}`);
    if (!r.ok) return null;
    return json<WeatherDay | null>(r);
  },
};

export async function fetchWhatsNew(): Promise<{ since: string; events: ChangeEvent[] }> {
  if (import.meta.env.VITE_API !== 'real') return { since: '', events: [] };
  const r = await req('GET', '/api/whatsnew'); if (!r.ok) return { since: '', events: [] };
  return json(r);
}
export async function markSeen(): Promise<void> {
  if (import.meta.env.VITE_API !== 'real') return;
  await req('POST', '/api/seen').catch(() => {});
}
export async function fetchTravellers(): Promise<string[]> {
  try { const r = await req('GET', '/api/travellers'); if (!r.ok) return []; const j = await r.json(); const a = Array.isArray(j) ? j : j?.travellers; return Array.isArray(a) ? a.filter((x: unknown) => typeof x === 'string') : []; } catch { return []; }
}
