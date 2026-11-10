import type { WebSocket } from 'ws';
import type { WsMessage } from '../shared/api';

interface Client { name: string; stopId?: string; seq: number; alive: boolean }
export type Listener = (msg: WsMessage) => void;

/** In-memory WebSocket hub: change broadcast + presence. */
export class Hub {
  private clients = new Map<WebSocket, Client>();
  private listeners = new Set<Listener>();
  private seq = 0;

  /** Observe every broadcast (used by tests / instrumentation). */
  onBroadcast(fn: Listener) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }

  add(ws: WebSocket, name: string) {
    this.clients.set(ws, { name, seq: ++this.seq, alive: true });
    this.broadcastPresence();
  }
  /** Mark a socket alive (call on 'pong'). */
  pong(ws: WebSocket) { const c = this.clients.get(ws); if (c) c.alive = true; }
  /** One heartbeat round: terminate sockets that missed the previous ping, ping the rest. */
  heartbeat() {
    for (const [ws, c] of [...this.clients]) {
      if (!c.alive) { try { ws.terminate(); } catch { /* ignore */ } this.remove(ws); continue; }
      c.alive = false;
      try { ws.ping(); } catch { /* ignore */ }
    }
  }
  private timer?: ReturnType<typeof setInterval>;
  startHeartbeat(ms = 30_000) { this.stopHeartbeat(); this.timer = setInterval(() => this.heartbeat(), ms); this.timer.unref?.(); }
  stopHeartbeat() { if (this.timer) clearInterval(this.timer); this.timer = undefined; }
  remove(ws: WebSocket) { if (this.clients.delete(ws)) this.broadcastPresence(); }
  viewing(ws: WebSocket, stopId?: string) {
    const c = this.clients.get(ws);
    if (!c || c.stopId === stopId) return; // throttle: only broadcast when the viewed stop changes
    c.stopId = stopId; c.seq = ++this.seq;
    this.broadcastPresence();
  }
  presence() {
    const byName = new Map<string, Client>();
    for (const c of this.clients.values()) {
      const cur = byName.get(c.name);
      if (!cur || c.seq > cur.seq) byName.set(c.name, c);
    }
    return [...byName.values()].map((c) => (c.stopId ? { name: c.name, stopId: c.stopId } : { name: c.name }));
  }
  broadcastPresence() { this.broadcast({ type: 'presence', users: this.presence() }); }
  broadcast(msg: WsMessage) {
    for (const l of this.listeners) { try { l(msg); } catch { /* ignore */ } }
    const data = JSON.stringify(msg);
    for (const ws of this.clients.keys()) { if (ws.readyState === 1) { try { ws.send(data); } catch { /* ignore */ } } }
  }
  closeAll() { this.stopHeartbeat(); for (const ws of this.clients.keys()) { try { ws.terminate(); } catch { /* ignore */ } } this.clients.clear(); }
}
