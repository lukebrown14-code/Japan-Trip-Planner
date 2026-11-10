import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Activity, Stop, Trip } from '@shared/types';
import { activitiesDisplacedByStops, allocateNights, cityColor, dayNum, nightsOf } from '../planner';
import { fmtDate } from './panel/util';
import './nights-editor.css';

export interface NightsEditorProps {
  stops: Stop[];
  trip: Trip;
  activities: Activity[];
  focusIndex?: number;
  onClose: () => void;
  onApply: (nights: number[]) => void;
}

/** Edit the number of nights in each city while keeping the trip's first and last dates fixed. */
export function NightsEditor({ stops, trip, activities, focusIndex, onClose, onApply }: NightsEditorProps) {
  const titleId = useId();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [values, setValues] = useState(() => stops.map(stop => String(nightsOf(stop.arrive, stop.depart))));

  useEffect(() => {
    if (focusIndex !== undefined) inputRefs.current[focusIndex]?.focus();
  }, [focusIndex]);

  const total = dayNum(trip.endDate) - dayNum(trip.startDate);
  const validNumbers = values.map(value => /^\d+$/.test(value) ? Number(value) : NaN);
  const minimum = stops.map(stop => nightsOf(stop.arrive, stop.depart) === 0 ? 0 : 1);
  const rowsValid = validNumbers.length === stops.length && validNumbers.every((n, i) => Number.isSafeInteger(n) && n >= minimum[i]);
  const assigned = validNumbers.reduce((sum, n) => sum + (Number.isSafeInteger(n) && n >= 1 ? n : 0), 0);
  const remaining = total - assigned;
  const preview = rowsValid ? allocateNights(trip, stops, validNumbers) : null;
  const changed = stops.some((stop, i) => validNumbers[i] !== nightsOf(stop.arrive, stop.depart));
  const canApply = !!preview && changed;
  const affected = canApply ? activitiesDisplacedByStops(activities, stops, preview) : [];

  const setNight = (index: number, value: string) => {
    setValues(previous => previous.map((night, i) => i === index ? value : night));
  };
  const step = (index: number, delta: number) => {
    const current = validNumbers[index];
    const next = Number.isSafeInteger(current) && current >= minimum[index] ? Math.max(minimum[index], current + delta) : minimum[index];
    setNight(index, String(next));
  };

  return createPortal(
    <div className="tp-ne-overlay" onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="tp-ne" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="tp-ne-header">
          <div><span className="tp-ne-eyebrow">Trip planner</span><h2 id={titleId}>City nights</h2></div>
          <button type="button" className="tp-ne-close" onClick={onClose} aria-label="Close nights editor">×</button>
        </div>
        <p className="tp-ne-intro">Set nights for each city. Your trip has <strong>{total} {total === 1 ? 'night' : 'nights'}</strong>.</p>

        <div className="tp-ne-list">
          {stops.map((stop, index) => {
            const current = nightsOf(stop.arrive, stop.depart);
            const value = validNumbers[index];
            const valid = Number.isSafeInteger(value) && value >= minimum[index];
            const proposed = preview?.[index];
            return <div className="tp-ne-row" key={stop.id}>
              <div className="tp-ne-city">
                <i className="tp-ne-dot" style={{ background: cityColor(index) }} aria-hidden="true" />
                <div className="tp-ne-city-text">
                  <strong>{stop.name}</strong>
                  <small>{proposed ? `${fmtDate(proposed.arrive)}–${fmtDate(proposed.depart)}` : `${fmtDate(stop.arrive)}–${fmtDate(stop.depart)}`}</small>
                </div>
              </div>
              <div className="tp-ne-controls">
                <button type="button" onClick={() => step(index, -1)} disabled={valid && value <= minimum[index]} aria-label={`Remove one night from ${stop.name}`}>−</button>
                <label className="tp-ne-input-wrap">
                  <input ref={element => { inputRefs.current[index] = element; }} type="number" inputMode="numeric" min={minimum[index]} step="1" value={values[index] ?? ''}
                    onChange={e => setNight(index, e.target.value)} aria-label={`Nights in ${stop.name}`} aria-invalid={!valid} />
                </label>
                <button type="button" onClick={() => step(index, 1)} aria-label={`Add one night to ${stop.name}`}>+</button>
              </div>
              {valid && value !== current && <small className="tp-ne-original">Was {current} {current === 1 ? 'night' : 'nights'}</small>}
            </div>;
          })}
        </div>

        <div className={`tp-ne-total${rowsValid && remaining === 0 ? ' balanced' : ''}`} role="status" aria-live="polite">
          <strong>{assigned} of {total} nights assigned</strong>
          <span>{!rowsValid ? 'Enter at least 1 night for overnight stays; same-day visits can have 0' : remaining > 0 ? `${remaining} ${remaining === 1 ? 'night' : 'nights'} left to assign` : remaining < 0 ? `${-remaining} ${remaining === -1 ? 'night' : 'nights'} over the trip total` : 'All nights assigned'}</span>
        </div>

        {affected.length > 0 && <div className="tp-ne-warning" role="status">
          <strong>{affected.length} {affected.length === 1 ? 'plan falls' : 'plans fall'} outside the new city dates</strong>
          <p>These plans will no longer appear in their city’s daily itinerary until you change their dates.</p>
          <ul>{affected.map(item => <li key={item.activityId}><span>{item.title}</span><small>{fmtDate(item.day)} · {item.stopName}</small></li>)}</ul>
        </div>}

        <div className="tp-ne-actions">
          <button type="button" className="tp-ne-cancel" onClick={onClose}>Cancel</button>
          <button type="button" className="tp-ne-apply" disabled={!canApply} onClick={() => onApply(validNumbers)}>Apply nights</button>
        </div>
      </section>
    </div>, document.body,
  );
}
