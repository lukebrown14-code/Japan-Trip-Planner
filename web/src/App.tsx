import { lazy, Suspense, useEffect, useState } from 'react';
import { Diorama } from './scene/Diorama'; import { TripPlanner } from './ui/TripPlanner'; import { LabelOverlay } from './ui/LabelOverlay';
import { StopPanel } from './ui/panel/StopPanel'; import { TopBar } from './ui/TopBar'; import { Login } from './ui/Login'; import { WhatsNew } from './ui/WhatsNew';
import { LogisticsDrawer } from './ui/logistics/Drawer'; import { TodayView } from './today/TodayView'; import { Playground } from './dev/Playground';
import { api } from './api'; import { useStore } from './store'; import { startRealtime } from './realtime'; import { usePath } from './nav';
import { isTransportPath } from './transport/routes';

type Session = 'checking' | 'in' | 'out' | 'offline';
const TransportWorkspace = lazy(() => import('./ui/transport/TransportWorkspace'));

export default function App() {
  const play = new URLSearchParams(location.search).get('play');
  const path = usePath();
  const [session, setSession] = useState<Session>('checking');
  useEffect(() => { (async () => {
    try {
      const me = await api.me();
      if (!me) { setSession('out'); return; }
      const data = await api.trip(); useStore.getState().set({ me: me.name, travellers: me.travellers, data }); setSession('in');
    } catch { setSession('offline'); } // offline: Today view falls back to its cached trip
  })(); return startRealtime(); }, []);
  if (play) return <Playground part={play} />;
  if (session === 'checking') return <div className="login" aria-busy="true" />; // backdrop only, so a signed-in reload doesn't flash the login form
  if (path === '/today' && session !== 'out') return <TodayView />;
  if (session !== 'in') return <Login onDone={() => location.reload()} />;
  if (isTransportPath(path)) return <Suspense fallback={<div className="login" role="status">Opening transport…</div>}><TransportWorkspace /></Suspense>;
  return (<><Diorama /><LabelOverlay /><TopBar /><TripPlanner /><StopPanel /><WhatsNew /><LogisticsDrawer /></>);
}
