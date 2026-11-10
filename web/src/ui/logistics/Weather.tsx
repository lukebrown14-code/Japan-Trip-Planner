import { useEffect, useState } from 'react';
import type { Stop } from '@shared/types';
import type { WeatherDay } from '@shared/api';
import { api } from '../../api';

export function wmo(code: number): [string, string] {
  if (code === 0) return ['☀️', 'Clear']; if (code <= 2) return ['🌤️', 'Mostly clear']; if (code === 3) return ['☁️', 'Overcast'];
  if (code <= 48) return ['🌫️', 'Fog']; if (code <= 57) return ['🌦️', 'Drizzle']; if (code <= 67) return ['🌧️', 'Rain'];
  if (code <= 77) return ['🌨️', 'Snow']; if (code <= 82) return ['🌧️', 'Showers']; if (code <= 86) return ['🌨️', 'Snow showers']; return ['⛈️', 'Thunderstorm'];
}
const datesOf = (a: string, b: string) => {
  const out: string[] = []; const e = Date.parse(b + 'T00:00:00Z');
  for (let t = Date.parse(a + 'T00:00:00Z'); t <= Math.max(e, Date.parse(a + 'T00:00:00Z')) && out.length < 10; t += 864e5) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
};
const dow = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });

/** Per-day weather for a stop (arrive..depart), or the given `dates`. Null-safe: renders nothing when no data. */
export function WeatherStrip({ stop, dates }: { stop: Pick<Stop, 'lat' | 'lng' | 'arrive' | 'depart'>; dates?: string[] }) {
  const days = dates ?? datesOf(stop.arrive, stop.depart);
  const key = days.join(',') + stop.lat + stop.lng;
  const [w, setW] = useState<(WeatherDay | null)[]>([]);
  useEffect(() => {
    let live = true;
    Promise.all(days.map(d => api.weather(stop.lat, stop.lng, d).catch(() => null))).then(r => { if (live) setW(r); });
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!w.some(Boolean)) return null;
  return (
    <div className="wx-strip" aria-label="Weather">
      {days.map((d, i) => { const x = w[i]; if (!x) return null; const [ic, label] = wmo(x.code);
        return (
          <div className="wx-day" key={d} title={label}>
            <small>{dow(d)}</small><span className="wx-ic">{ic}</span>
            <b>{Math.round(x.tmax)}°</b><small>{Math.round(x.tmin)}°</small>
            {x.rainPct !== undefined && <small>{Math.round(x.rainPct)}% rain</small>}
            <em className={x.kind}>{x.kind === 'forecast' ? 'forecast' : 'typical'}</em>
          </div>); })}
    </div>
  );
}
