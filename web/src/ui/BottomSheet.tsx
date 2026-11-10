import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { TAP_SLOP } from '../planner';
import { MQ_DESKTOP, SHEET_FRAC } from './layout';
export type Snap = 'peek' | 'half' | 'full';
const ORDER: Snap[] = ['peek', 'half', 'full'];
// Two contexts so consumers that only move the sheet (snapTo is stable) don't re-render when it snaps.
const SnapCtx = createContext<Snap>('half');
const SnapToCtx = createContext<(s: Snap) => void>(() => {});
/** Current snap. Safe without a provider. */
export const useSnap = () => useContext(SnapCtx);
/** Move the sheet. Safe without a provider (no-op). */
export const useSnapTo = () => useContext(SnapToCtx);
const TRANSITION = 'height .22s ease';
const desktop = () => typeof window !== 'undefined' && window.matchMedia(MQ_DESKTOP).matches;

/** Mobile bottom sheet (desktop: right-side panel via CSS). Grab handle / header drag follows the finger, then snaps peek/half/full. */
export function BottomSheet({ children, initial = 'half', header, covers }: { children: ReactNode; initial?: Snap; header?: ReactNode; covers?: boolean }) {
  const [snap, setSnap] = useState<Snap>(initial);
  const sheet = useRef<HTMLDivElement>(null); const grab = useRef<HTMLDivElement>(null); const head = useRef<HTMLDivElement>(null);
  const [peekPx, setPeekPx] = useState(150);
  const drag = useRef<{ y: number; h: number; max: number; moved: boolean; id: number; last: number; t: number; v: number } | null>(null);
  const suppress = useRef(false);

  useEffect(() => { // peek = grab + header (+ tabs), measured
    const m = () => setPeekPx(Math.ceil((grab.current?.offsetHeight ?? 28) + (head.current?.offsetHeight ?? 110)) + 6);
    m(); const ro = new ResizeObserver(m); if (head.current) ro.observe(head.current); return () => ro.disconnect();
  }, []);
  const px = useCallback((s: Snap) => s === 'peek' ? peekPx : window.innerHeight * SHEET_FRAC[s], [peekPx]);
  const heightAt = (d: { y: number; h: number; max: number }, y: number) => Math.max(peekPx, Math.min(d.max, d.h + (d.y - y)));
  const heightFor = (s: Snap) => s === 'peek' ? `${peekPx}px` : `${SHEET_FRAC[s] * 100}dvh`;
  // While dragging the height is written straight to the DOM (no re-render per pointer event); on release it is set back
  // to the snap target with the transition on, so React's own value agrees and the sheet animates there.
  const settle = (s: Snap) => { const el = sheet.current; if (el) { el.style.transition = TRANSITION; el.style.height = heightFor(s); } };

  const start = (e: React.PointerEvent) => {
    if (desktop() || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const isGrab = (e.currentTarget as HTMLElement).classList.contains('grab');
    if (!isGrab && (e.target as HTMLElement).closest('button,a,input,select,textarea')) return;
    drag.current = { y: e.clientY, h: sheet.current?.offsetHeight ?? px(snap), max: px('full'), moved: false, id: e.pointerId, last: e.clientY, t: e.timeStamp, v: 0 };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current; if (!d || e.pointerId !== d.id) return;
    if (!d.moved) { if (Math.abs(e.clientY - d.y) < TAP_SLOP) return; d.moved = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ } }
    const dt = e.timeStamp - d.t; if (dt > 0) d.v = d.v * .5 + ((e.clientY - d.last) / dt) * .5; d.last = e.clientY; d.t = e.timeStamp;
    const el = sheet.current; if (el) { el.style.transition = 'none'; el.style.height = `${heightAt(d, e.clientY)}px`; }
  };
  const end = (e: React.PointerEvent) => {
    const d = drag.current; drag.current = null; if (!d || e.pointerId !== d.id || !d.moved) return;
    suppress.current = true; setTimeout(() => { suppress.current = false; }, 0);
    const h = heightAt(d, e.clientY) - d.v * 150; // flick bias (v>0 = moving down)
    const next = ORDER.reduce((b, s) => Math.abs(px(s) - h) < Math.abs(px(b) - h) ? s : b, 'half' as Snap);
    setSnap(next); settle(next);
  };
  const cancel = () => { if (drag.current?.moved) settle(snap); drag.current = null; };
  const resizeWithKeyboard = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const current = ORDER.indexOf(snap);
    let next = current;
    switch (e.key) {
      case 'ArrowUp': next = Math.min(ORDER.length - 1, current + 1); break;
      case 'ArrowDown': next = Math.max(0, current - 1); break;
      case 'PageUp': next = ORDER.length - 1; break;
      case 'PageDown': next = 0; break;
      case 'Home': next = 0; break;
      case 'End': next = ORDER.length - 1; break;
      default: return;
    }
    e.preventDefault();
    const target = ORDER[next];
    if (target !== snap) { setSnap(target); settle(target); }
  };
  const hs = { onPointerMove: move, onPointerUp: end, onPointerCancel: cancel };
  return (
    <SnapToCtx.Provider value={setSnap}><SnapCtx.Provider value={snap}>
      <div ref={sheet} className="sheet" data-cover={covers ? 'sheet' : undefined} style={{ height: heightFor(snap), transition: TRANSITION }} onPointerDown={e => e.stopPropagation()} onWheel={e => e.stopPropagation()}>
        <div ref={grab} className="grab" role="slider" tabIndex={0} aria-label="Panel height" aria-orientation="vertical" aria-valuemin={0} aria-valuemax={ORDER.length - 1} aria-valuenow={ORDER.indexOf(snap)} aria-valuetext={`${snap[0].toUpperCase()}${snap.slice(1)} height`} onKeyDown={resizeWithKeyboard} onPointerDown={start} {...hs}
          onClick={() => { if (suppress.current) return; setSnap(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'peek'); }}><i /></div>
        <div ref={head} className="sheet-head" style={{ flex: 'none', touchAction: 'pan-x' }} onPointerDown={start} {...hs}>{header}</div>
        <div className="body">{children}</div>
      </div>
    </SnapCtx.Provider></SnapToCtx.Provider>
  );
}
