import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { PerformanceMonitor, AdaptiveDpr } from '@react-three/drei';
import { useStore } from '../../store';

/** FPS-driven quality tiers + graceful WebGL context loss. */
export function Perf() {
  const gl = useThree((s) => s.gl);
  const setDpr = useThree((s) => s.setDpr);
  useEffect(() => {
    const el = gl.domElement;
    el.style.touchAction = 'none';
    let note: HTMLDivElement | null = null;
    const lost = (e: Event) => {
      e.preventDefault();
      useStore.getState().set({ quality: 'low' });
      if (!note && el.parentElement) {
        note = document.createElement('div');
        note.textContent = 'Reconnecting the graphics…';
        note.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;background:#bfe6f7;color:#1b2a4a;font:600 16px system-ui;z-index:5';
        const p = el.parentElement; if (getComputedStyle(p).position === 'static') p.style.position = 'relative';
        p.appendChild(note);
      }
    };
    const restored = () => { note?.remove(); note = null; };
    el.addEventListener('webglcontextlost', lost);
    el.addEventListener('webglcontextrestored', restored);
    return () => { el.removeEventListener('webglcontextlost', lost); el.removeEventListener('webglcontextrestored', restored); note?.remove(); };
  }, [gl]);
  const max = Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
  return (
    <>
      <PerformanceMonitor ms={250} iterations={6} bounds={(refresh) => (refresh > 90 ? [50, 90] : [30, 55])}
        onChange={({ factor }) => setDpr(Math.max(1, max * (0.55 + 0.45 * factor)))}
        onDecline={() => useStore.getState().set({ quality: 'low' })} />
      <AdaptiveDpr pixelated={false} />
    </>
  );
}
