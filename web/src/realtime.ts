// OWNED BY: Collaboration agent. WS client: applies ChangeEvents to the store, presence -> store.online, sends {type:'viewing'}. No-op with mock api.
import type { Collection, WsMessage, WsClientMessage } from '@shared/api';
import { useStore } from './store';
import { api } from './api';
import { bumpWhatsNew } from './ui/collab/unread';

export function startRealtime(): () => void {
  if (import.meta.env.VITE_API !== 'real') return () => {};
  let ws: WebSocket | null = null, stopped = false, tries = 0, timer: number | undefined, opened = false;
  const send = (m: WsClientMessage) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
  const connect = () => {
    if (stopped) return;
    ws = new WebSocket(`${location.origin.replace(/^http/, 'ws')}/ws`);
    ws.onopen = () => {
      const wasReconnect = opened; opened = true; tries = 0;
      send({ type: 'viewing', stopId: useStore.getState().selectedStopId ?? undefined });
      if (wasReconnect) api.trip().then(data => useStore.getState().set({ data })).catch(() => {});
    };
    ws.onmessage = ev => {
      let m: WsMessage; try { m = JSON.parse(ev.data); } catch { return; }
      const st = useStore.getState();
      if (m.type === 'presence') st.set({ online: m.users });
      else if (m.type === 'change') {
        const e = m.event;
        if (e.op === 'delete') st.removeEntity(e.collection as Collection, e.entityId);
        else if (e.entity) st.replaceEntity(e.collection as Collection, { id: e.entityId, ...(e.entity as object) });
        if (e.author !== st.me) bumpWhatsNew();
      }
    };
    ws.onclose = () => { ws = null; if (stopped) return; const d = Math.min(15000, 500 * 2 ** tries++) + Math.random() * 300; timer = window.setTimeout(connect, d); };
    ws.onerror = () => { try { ws?.close(); } catch { /* */ } };
  };
  connect();
  const unsub = useStore.subscribe((s, p) => { if (s.selectedStopId !== p.selectedStopId) send({ type: 'viewing', stopId: s.selectedStopId ?? undefined }); });
  return () => { stopped = true; unsub(); clearTimeout(timer); ws?.close(); };
}
