import type { WeatherDay } from '../shared/api';

type FetchFn = typeof fetch;
const TTL = 60 * 60 * 1000;
const cache = new Map<string, { at: number; v: WeatherDay | null }>();

export function clearWeatherCache() { cache.clear(); }

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Same calendar date one year earlier (Feb 29 -> Feb 28). */
export function prevYear(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  const dd = m === 2 && d === 29 ? 28 : d;
  return `${y - 1}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

export function validateWeatherQuery(q: { lat?: string; lng?: string; date?: string }) {
  const lat = Number(q.lat), lng = Number(q.lng);
  if (q.lat === undefined || q.lng === undefined || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  const date = q.date ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date) return null;
  return { lat, lng, date };
}

export async function getWeather(lat: number, lng: number, date: string, opts: { fetchFn?: FetchFn; now?: Date } = {}): Promise<WeatherDay | null> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)},${date}`;
  const hit = cache.get(key);
  const now = opts.now ?? new Date();
  if (hit && Date.now() - hit.at < TTL) return hit.v;
  const f = opts.fetchFn ?? fetch;
  const today = iso(now);
  const days = (Date.parse(date + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86_400_000;
  const forecast = days >= 0 && days <= 15;
  const qDate = forecast ? date : prevYear(date);
  const base = forecast ? 'https://api.open-meteo.com/v1/forecast' : 'https://archive-api.open-meteo.com/v1/archive';
  const daily = forecast
    ? 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
    : 'weather_code,temperature_2m_max,temperature_2m_min';
  const url = `${base}?latitude=${lat}&longitude=${lng}&daily=${daily}&timezone=Asia%2FTokyo&start_date=${qDate}&end_date=${qDate}`;
  let v: WeatherDay | null = null;
  try {
    const res = await f(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const j = (await res.json()) as { daily?: Record<string, (number | null)[]> };
      const d = j.daily;
      const tmax = d?.temperature_2m_max?.[0], tmin = d?.temperature_2m_min?.[0], code = d?.weather_code?.[0];
      if (typeof tmax === 'number' && typeof tmin === 'number' && typeof code === 'number') {
        v = { date, tmax, tmin, code, kind: forecast ? 'forecast' : 'typical' };
        const rain = d?.precipitation_probability_max?.[0];
        if (forecast && typeof rain === 'number') v.rainPct = rain;
      }
    }
  } catch { v = null; }
  if (v) {
    if (cache.size > 2000) cache.clear();
    cache.set(key, { at: Date.now(), v });
  }
  return v;
}
