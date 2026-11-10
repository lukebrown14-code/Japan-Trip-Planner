// Bottom bar: a compact route overview, with city-night allocation in a separate editor.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Stop } from '@shared/types';
import { plannerIsOpen, useStore } from '../store';
import { allocateNights, cityColor, dayLabel, dayNum, nightsOf, scheduleIssues, slotCentre, sortedStops, tripDayCount } from '../planner';
import { dateRange } from '../scene/city/util';
import { fmtDate } from './panel/util';
import { saveStopsInOrder } from './saveStops';
import { PlannerCalendar } from './PlannerCalendar';
import { NightsEditor } from './NightsEditor';
import './planner.css';
import { navigate } from '../nav';

export function TripPlanner() {
  const trip = useStore(s => s.data.trip); const rawStops = useStore(s => s.data.stops);
  const activities = useStore(s => s.data.activities);
  const nightEditorRequest = useStore(s => s.nightEditorRequest);
  const open = useStore(plannerIsOpen); const sel = useStore(s => s.selectedStopId);
  const expanded = useStore(s => s.plannerExpanded); const toggleExpanded = useStore(s => s.toggleExpanded);
  const toggle = useStore(s => s.togglePlanner); const focusStop = useStore(s => s.focusStop);
  const n = tripDayCount(trip);
  const stops = useMemo(() => sortedStops(rawStops), [rawStops]);
  const selectedStop = stops.find(s => s.id === sel);
  const issues = useMemo(() => scheduleIssues(trip, stops), [trip, stops]);
  const badRange = useMemo(() => new Set(issues.filter(x => x.kind === 'range').map(x => x.index)), [issues]);
  const days = useMemo(() => Array.from({ length: n }, (_, i) => dayLabel(trip, i)), [trip, n]);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [undoChange, setUndoChange] = useState<{ before: Stop[]; after: Stop[] } | null>(null);
  const saveVersion = useRef(0);
  const [editingNights, setEditingNights] = useState(false);
  const [editFocusIndex, setEditFocusIndex] = useState(0);
  const editBaseline = useRef<Array<Pick<Stop, 'id' | 'arrive' | 'depart'>>>([]);
  const editTrigger = useRef<HTMLElement | null>(null);
  const plannerRef = useRef<HTMLDivElement>(null);
  const calendarTrigger = useRef<HTMLButtonElement>(null);
  const closeCalendar = () => toggleExpanded();
  const openEditor = (i = 0) => {
    editTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    editBaseline.current = sortedStops(useStore.getState().data.stops).map(({ id, arrive, depart }) => ({ id, arrive, depart }));
    setEditFocusIndex(i); setEditingNights(true);
  };
  useEffect(() => {
    if (!nightEditorRequest) return;
    const index = sortedStops(useStore.getState().data.stops).findIndex(s => s.id === nightEditorRequest.stopId);
    if (index >= 0) openEditor(index);
    useStore.getState().set({ nightEditorRequest: null });
  }, [nightEditorRequest?.nonce]);
  const closeEditor = () => { setEditingNights(false); requestAnimationFrame(() => editTrigger.current?.focus()); };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editingNights) { e.preventDefault(); closeEditor(); return; }
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key === 'Escape' && useStore.getState().plannerExpanded) { closeCalendar(); return; }
      if (editingNights) return;
      if (!e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 't' || e.key === 'T')) toggle();
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [toggle, toggleExpanded, editingNights]);

  useEffect(() => {
    if (!expanded) return;
    const root = plannerRef.current; if (!root) return;
    const siblings = [...root.parentElement!.children].filter(el => el !== root) as HTMLElement[];
    const prior = siblings.map(el => el.inert);
    siblings.forEach(el => { el.inert = true; });
    requestAnimationFrame(() => root.querySelector<HTMLElement>('.tp-expand')?.focus());
    return () => { siblings.forEach((el, i) => { el.inert = prior[i]; }); requestAnimationFrame(() => calendarTrigger.current?.focus()); };
  }, [expanded]);

  useEffect(() => {
    if (!editingNights) return;
    const app = plannerRef.current?.parentElement;
    if (!app) return;
    const wasInert = app.inert;
    app.inert = true;
    const dialog = document.querySelector<HTMLElement>('.tp-ne');
    requestAnimationFrame(() => dialog?.querySelectorAll<HTMLInputElement>('input[type="number"]')[editFocusIndex]?.focus());
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !dialog) return;
      const items = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)')].filter(el => el.getClientRects().length);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { app.inert = wasInert; document.removeEventListener('keydown', trap); };
  }, [editingNights, editFocusIndex]);

  const trapFocus = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || (!expanded && !editingNights)) return;
    const scope = plannerRef.current;
    if (!scope) return;
    const items = [...scope.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter(el => el.getClientRects().length && !el.closest('[hidden]'));
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const applyNights = (nights: number[]) => {
    const live = sortedStops(useStore.getState().data.stops);
    if (live.length !== editBaseline.current.length || live.some((s, i) =>
      s.id !== editBaseline.current[i].id || s.arrive !== editBaseline.current[i].arrive || s.depart !== editBaseline.current[i].depart)) {
      setError('City nights changed while you were editing. Open the editor again to review the latest plan.');
      closeEditor(); return;
    }
    const allocated = allocateNights(trip, live, nights);
    if (allocated) {
      const after = allocated.filter((s, i) => s.arrive !== live[i].arrive || s.depart !== live[i].depart);
      const before = live.filter((s, i) => s.arrive !== allocated[i].arrive || s.depart !== allocated[i].depart);
      if (!after.length) { closeEditor(); return; }
      useStore.getState().upsertMany('stops', after);
      const version = ++saveVersion.current;
      setUndoChange(null); setSaveStatus('saving'); setError(null);
      saveStopsInOrder(before, message => { if (version !== saveVersion.current) return; setError(message); if (message) setSaveStatus('error'); }, status => {
        if (version !== saveVersion.current) return;
        setSaveStatus(status.phase);
        if (status.phase === 'saved') setUndoChange({ before, after });
      });
    }
    closeEditor();
  };

  const undoDates = () => {
    if (!undoChange || saveStatus !== 'saved') return;
    const current = undoChange.after.map(s => useStore.getState().data.stops.find(live => live.id === s.id));
    if (current.some((s, i) => !s || s.arrive !== undoChange.after[i].arrive || s.depart !== undoChange.after[i].depart)) {
      setUndoChange(null); setError('City nights changed elsewhere. Review the planner before editing again.'); return;
    }
    const latest = current as Stop[];
    const reverted = latest.map((s, i) => ({ ...s, arrive: undoChange.before[i].arrive, depart: undoChange.before[i].depart }));
    useStore.getState().upsertMany('stops', reverted);
    const version = ++saveVersion.current;
    setUndoChange(null); setSaveStatus('saving'); setError(null);
    saveStopsInOrder(latest, message => { if (version !== saveVersion.current) return; setError(message); if (message) setSaveStatus('error'); }, status => {
      if (version !== saveVersion.current) return;
      setSaveStatus(status.phase);
    });
  };

  const pct = (iso: string) => `${slotCentre(trip, iso) * 100}%`;
  const left = (s: Stop) => (s.arrive <= trip.startDate ? '0%' : pct(s.arrive));
  const right = (s: Stop) => (s.depart >= trip.endDate ? '100%' : pct(s.depart));
  const gapText = (i: number, kind: string) => `${kind === 'gap' ? 'Gap' : 'Overlap'} between ${stops[i].name} and ${stops[i + 1].name}`;

  return (
    <div ref={plannerRef} className={`tp${open ? '' : ' closed'}${expanded ? ' expanded' : ''}`} data-cover="bottom" role={expanded ? 'dialog' : 'region'} aria-modal={expanded ? true : undefined} aria-label={expanded ? 'Trip calendar' : 'Trip planner'} onPointerDown={e => e.stopPropagation()} onWheel={e => e.stopPropagation()} onKeyDown={trapFocus}>
      <div className="tp-head">
        {open && !expanded && <button className="tp-collapse" onClick={toggle} aria-expanded={open} aria-label="Hide trip planner" title="Toggle (T)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>}
        {open ? <div className="tp-title"><b>{expanded ? 'Trip calendar' : 'Trip planner'}</b><span><span className="tp-dates">{dateRange(trip.startDate, trip.endDate)} · </span>{n - 1} nights</span></div> :
          <button className="tp-summary" onClick={toggle} aria-expanded={false} aria-label={`Show trip planner${selectedStop ? ` · ${selectedStop.name}, ${dateRange(selectedStop.arrive, selectedStop.depart)}` : ''}`} title="Show trip planner (T)">
            <i className="tp-summary-dot" aria-hidden style={{ background: selectedStop ? cityColor(stops.indexOf(selectedStop)) : 'var(--gold)' }} />
            <span className="tp-summary-text"><b>{selectedStop?.name ?? 'Trip planner'}</b><span>{selectedStop ? dateRange(selectedStop.arrive, selectedStop.depart) : dateRange(trip.startDate, trip.endDate)}</span></span>
            <svg className="tp-summary-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>
          </button>}
        {error && <span className="tp-err" role="alert">{error}</span>}
        {!error && saveStatus !== 'saving' && !undoChange && issues.length > 0 && <span className="tp-issue" role="status">{issues[0].kind === 'range' ? `${stops[issues[0].index].name} is outside trip dates` : gapText(issues[0].index, issues[0].kind)}{issues.length > 1 ? ` · ${issues.length} issues` : ''}</span>}
        {saveStatus !== 'idle' && !error && <span className="tp-save-status" role="status">{saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : ''}</span>}
        {undoChange && saveStatus === 'saved' && <button className="tp-undo" onClick={undoDates}>Undo</button>}
        {open && !expanded && stops.length > 1 && <button className="tp-btn tp-edit" onClick={() => openEditor(Math.max(0, stops.findIndex(s => s.id === sel)))}>Edit nights</button>}
        {!expanded && <button className="tp-btn tp-transport" onClick={() => { useStore.getState().set({ menuOpen: false }); navigate('/transport'); }}>Transport</button>}
        <button ref={calendarTrigger} className="tp-btn tp-expand" onClick={toggleExpanded} aria-expanded={expanded} aria-label={expanded ? 'Close calendar' : 'Expand to calendar'} title={expanded ? 'Close (Esc)' : 'Calendar'}>
          <svg viewBox="0 0 24 24" aria-hidden="true">{expanded ? <path d="M5 5l14 14M19 5L5 19"/> : <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-13 4h2m4 0h2m-8 4h2"/></>}</svg><span className="tp-btn-t"> {expanded ? 'Close' : 'Calendar'}</span></button>
      </div>
      {open && (<div className="tp-body">
        {!expanded && <div className="tp-mobile-range">{dateRange(trip.startDate, trip.endDate)} <span>· {n - 1} nights</span></div>}
        <div className="tp-ruler" style={{ ['--n' as string]: n }} aria-hidden>
          {days.map((d, i) => (
            <div key={i} className={`tp-day${d.hol ? ' hol' : ''}`}><span className="wd">{d.weekday}</span><span className="wd1">{d.weekday[0]}</span><b>{d.day}</b>{i > 0 && d.day === 1 && <span className="tp-month-marker">{new Date(dayNum(trip.startDate) * 864e5 + i * 864e5).toLocaleDateString('en-AU', { month: 'short', timeZone: 'UTC' })}</span>}<i /></div>
          ))}
        </div>
        <div className="tp-track" style={{ ['--n' as string]: n }}>
          <div className="tp-blocks">
            {stops.map((s, i) => { const nn = nightsOf(s.arrive, s.depart); return (
              <button key={s.id} className={`tp-block${nn < 2 ? ' short' : ''}${sel === s.id ? ' cur' : ''}${badRange.has(i) ? ' bad' : ''}`}
                style={{ left: left(s), width: `calc(${right(s)} - ${left(s)})`, background: cityColor(i) }}
                onClick={() => focusStop(s.id)} title={`${s.name} · ${fmtDate(s.arrive)} → ${fmtDate(s.depart)}`}>
                <b>{s.name}</b><small>{nn}n<em> · {s.nameJa}</em></small>
              </button>); })}
          </div>
          {issues.filter(x => x.kind !== 'range').map(x => (
            <span key={`${x.kind}${x.index}`} className="tp-warn" style={{ left: pct(stops[x.index].depart) }} title={gapText(x.index, x.kind)} role="img" aria-label={gapText(x.index, x.kind)}>⚠</span>
          ))}
        </div>
        {!expanded && <div className="tp-mobile-stops" role="list" aria-label="Trip stops">{stops.map((s, i) => <div className="tp-mobile-stop" role="listitem" key={s.id} style={{ ['--stop-color' as string]: cityColor(i) }}><button className={sel === s.id ? 'selected' : ''} onClick={() => focusStop(s.id)}><span className="tp-mobile-dot"/><strong>{s.name}</strong><small>{dateRange(s.arrive, s.depart)} · {nightsOf(s.arrive, s.depart)} {nightsOf(s.arrive, s.depart) === 1 ? 'night' : 'nights'}</small></button></div>)}</div>}
        {expanded && <PlannerCalendar />}
      </div>)}
      {editingNights && <NightsEditor stops={stops} trip={trip} activities={activities} focusIndex={editFocusIndex} onClose={closeEditor} onApply={applyNights}/>}
    </div>
  );
}
