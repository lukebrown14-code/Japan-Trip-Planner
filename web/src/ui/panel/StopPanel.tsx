// City panel for store.selectedStopId: Plan / Eat / Chat. Can be hidden to a pill.
import { useLayoutEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import { BottomSheet, useSnap, useSnapTo } from '../BottomSheet';
import { cityColor, sortedStops } from '../../planner';
import { Plan } from './Plan';
import { EatTab } from './EatTab';
import { HotelTab } from './HotelTab';
import { CityTab } from './CityTab';
import { CommentsThread, useCommentCount } from './Social';
import { ActivityThread } from './ActivityThread';
import { fmtDate } from './util';
import { MQ_MOBILE } from '../layout';
import '../timeline.css';
import './panel.css';

type Tab = 'plan' | 'hotel' | 'eat' | 'city' | 'comments';

function Tabs({ tabs, tab, setTab, idBase }: { tabs: [Tab, string, (number | string)?][]; tab: Tab; setTab: (t: Tab) => void; idBase: string }) {
  const snap = useSnap(), snapTo = useSnapTo(); // lives inside BottomSheet so the context is available
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const select = (index: number) => {
    const next = (index + tabs.length) % tabs.length;
    setTab(tabs[next][0]); buttons.current[next]?.focus();
  };
  return <div className="sp-tabs" role="tablist" aria-label="City details">{tabs.map(([k, l, n], i) => <button key={k} ref={el => { buttons.current[i] = el; }} id={`${idBase}-tab-${k}`} aria-controls={`${idBase}-panel`} tabIndex={tab === k ? 0 : -1} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onKeyDown={e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); select(i + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); select(i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); select(0); }
    else if (e.key === 'End') { e.preventDefault(); select(tabs.length - 1); }
  }} onClick={() => { setTab(k); if (snap === 'peek') snapTo('half'); }}>{l}{!!n && <small>{n}</small>}</button>)}</div>;
}

export function StopPanel() {
  const id = useStore(s => s.selectedStopId); const data = useStore(s => s.data); const set = useStore(s => s.set);
  const [tab, setTab] = useState<Tab>('plan'); const [hidden, setHidden] = useState(false); const [lastId, setLastId] = useState(id);
  const selectNonce = useStore(s => s.selectNonce); const [lastNonce, setLastNonce] = useState(selectNonce);
  const stop = id ? data.stops.find(s => s.id === id) : null;
  const tabPanelId = `stop-panel-${stop?.id ?? 'none'}`;
  const nStop = useCommentCount('stop', id ?? '');
  if (id !== lastId) { setLastId(id); setTab('plan'); setHidden(false); }
  if (selectNonce !== lastNonce) { setLastNonce(selectNonce); setHidden(false); } // re-selecting the same stop (map, label, planner) reopens a hidden panel
  useLayoutEffect(() => {
    const mobile = window.matchMedia(MQ_MOBILE);
    const sync = () => useStore.getState().setPlannerPanelActive(mobile.matches && !!stop && !hidden);
    sync(); mobile.addEventListener('change', sync);
    return () => { mobile.removeEventListener('change', sync); useStore.getState().setPlannerPanelActive(false); };
  }, [stop?.id, hidden, selectNonce]);
  if (!stop) return null;
  const color = cityColor(sortedStops(data.stops).findIndex(s => s.id === stop.id));
  const acts = data.activities.filter(a => a.stopId === stop.id);
  const nFood = acts.filter(a => a.category === 'food').length;
  if (hidden) return (
    <button className="sp-pill" style={{ borderLeft: `6px solid ${color}` }} onClick={() => setHidden(false)} aria-label={`Show ${stop.name} panel`}>
      📍 {stop.name} · {fmtDate(stop.arrive)} – {fmtDate(stop.depart)}
    </button>);
  const header = (
    <div className="ac-head sp-head" style={{ borderLeft: `6px solid ${color}`, marginLeft: 16 }}>
      <h2>{stop.name}<small>{stop.nameJa}</small></h2>
      <button className="sp-close min" aria-label="Minimise panel" title="Minimise panel" onClick={() => setHidden(true)}>⌄</button>
      <button className="sp-close" aria-label="Close" onClick={() => set({ selectedStopId: null })}>✕</button>
    </div>
  );
  const tabs: [Tab, string, (number | string)?][] = [['plan', 'Plan'], ['hotel', '🏨 Hotel', stop.hotelStatus === 'booked' ? '✓' : undefined], ['eat', '🍜 Eat', nFood], ['city', 'City'], ['comments', 'Chat', nStop]];
  return (
    <div className="arrival-wrap">
      <BottomSheet key={stop.id} initial="half" covers header={<>{header}
        <Tabs tabs={tabs} tab={tab} setTab={setTab} idBase={tabPanelId} /></>}>
        <div className="sp" id={`${tabPanelId}-panel`} role="tabpanel" aria-labelledby={`${tabPanelId}-tab-${tab}`} tabIndex={0}>
          {tab === 'plan' && <Plan stop={stop} />}
          {tab === 'hotel' && <HotelTab stop={stop} />}
          {tab === 'city' && <CityTab stop={stop} />}
          {tab === 'eat' && <EatTab stop={stop} />}
          {tab === 'comments' && <>
            <div className="sp-sec">{stop.name.toUpperCase()}</div>
            <CommentsThread targetType="stop" targetId={stop.id} />
            {acts.length > 0 && <><div className="sp-sec">ACTIVITIES</div><div className="sp-list">{acts.map(a => <ActivityThread key={a.id} a={a} />)}</div></>}
          </>}
        </div>
      </BottomSheet>
    </div>
  );
}
