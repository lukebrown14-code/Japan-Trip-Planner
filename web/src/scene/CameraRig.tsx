// OWNED BY: Terrain & atmosphere agent. Pan/zoom/pinch/fit/focus-on-stop for the isometric orthographic camera.
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store';
import { toWorld } from '../geo';
import { LABEL_Y } from './city/City';
import { CITIES } from '../data/cities';
import { rig } from './terrain/rigState';
import { uncoveredRect, uncoveredCentre, targetFor, groundToScreenOffset, screenToGroundOffset, insideRect, fitPoints, projectBounds, axes, SINE, COSE, type Rect } from './cameraMath';

const DIST = 140;
const YAW = Math.PI / 4; // same orientation on desktop and mobile
// Honshu / Shikoku / Kyushu to southern Tohoku
const FIT_PTS = [[34.0, 134.6], [34.0, 140.6], [37.4, 140.6], [37.4, 134.6]].map(([la, ln]) => toWorld(la, ln));
const LIMITS = { x0: -95, x1: 85, z0: -70, z1: 70 };
const damp = (a: number, b: number, l: number, dt: number) => a + (b - a) * (1 - Math.exp(-l * dt));
const angDamp = (a: number, b: number, l: number, dt: number) => { let d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + d * (1 - Math.exp(-l * dt)); };

export function CameraRig() {
  const { camera, gl, size, invalidate } = useThree();
  const cam = camera as THREE.OrthographicCamera;
  // goal state (eased toward every frame) and current (rig)
  const goal = useRef({ tx: 0, tz: 0, zoom: 14, yaw: YAW });
  const cur = useRef({ init: false });
  const fitted = useRef(false);
  const prev = useRef({ focus: useStore.getState().focusReq, fit: useStore.getState().fitNonce });

  // minZoom stays based on the whole-Japan box so pinch-out still shows every candidate city
  const japanZoom = () => {
    const { x0, x1, y0, y1 } = projectBounds(FIT_PTS, YAW);
    return Math.min(size.width / ((x1 - x0) * 1.12), size.height / ((y1 - y0) * 1.45));
  };
  // part of the canvas not hidden by the top bar, planner bar and city sheet (read from the DOM)
  const coverRect = (sheetExpected: boolean): Rect => {
    const cv = gl.domElement.getBoundingClientRect();
    const q = (sel: string) => { const r = document.querySelector(sel)?.getBoundingClientRect(); return r && r.width > 0 && r.height > 0 ? r : null; };
    const tb = q('[data-cover=top]'), tp = q('[data-cover=bottom]'), sh = q('[data-cover=sheet]');
    return uncoveredRect(size.width, size.height, {
      topbarBottom: tb ? tb.bottom - cv.top : undefined, tpTop: tp ? tp.top - cv.top : undefined,
      sheet: sh ? { top: sh.top - cv.top, left: sh.left - cv.left } : null, sheetExpected,
    });
  };
  const computeFit = () => {
    const pts = useStore.getState().data.stops.map(s => toWorld(s.lat, s.lng));
    if (!pts.length) pts.push(...FIT_PTS);
    const r = coverRect(false), lab = Math.min(48, 0.12 * (r.y1 - r.y0)); // leave room for the city labels above the top-most stop
    return fitPoints(pts, size.width, size.height, { ...r, y0: r.y0 + lab }, YAW);
  };
  const minZoom = () => japanZoom() * 0.7;
  const focusZoom = () => (size.width < 640 ? 24 : 20);

  const doFit = (snap = false) => {
    const f = computeFit(); Object.assign(goal.current, f); fitted.current = true;
    if (snap) { Object.assign(rig, f); cur.current.init = true; }
    invalidate();
  };

  // initial view: always frame Japan (the trip starts with an inbound flight over open ocean)
  useEffect(() => {
    doFit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // refit on resize if user hasn't moved
  useEffect(() => { rig.viewW = size.width; rig.viewH = size.height; if (fitted.current) doFit(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [size.width, size.height]);

  // input
  useEffect(() => {
    const el = gl.domElement;
    el.style.touchAction = 'none';
    const ptrs = new Map<number, { x: number; y: number }>();
    let pinch0 = 0, zoom0 = 0, moved = 0, downT = 0, downXY = { x: 0, y: 0 }, lastTap = { t: 0, x: 0, y: 0 };
    const manual = () => { fitted.current = false; };
    const panBy = (dx: number, dy: number) => {
      const g = goal.current, { rx, rz, fx, fz } = axes(g.yaw);
      const k = 1 / g.zoom, kf = 1 / (g.zoom * SINE);
      g.tx += -rx * dx * k + fx * dy * kf; g.tz += -rz * dx * k + fz * dy * kf;
      invalidate();
    };
    const zoomAt = (factor: number, cx: number, cy: number) => {
      const g = goal.current; const nz = THREE.MathUtils.clamp(g.zoom * factor, minZoom(), 70);
      const sx = cx - size.width / 2, sy = cy - size.height / 2;
      const a = screenToGroundOffset(sx, sy, g.zoom, g.yaw), b = screenToGroundOffset(sx, sy, nz, g.yaw);
      g.tx += a.dx - b.dx; g.tz += a.dz - b.dz; g.zoom = nz; invalidate();
    };
    const down = (e: PointerEvent) => {
      el.setPointerCapture?.(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) { moved = 0; downT = performance.now(); downXY = { x: e.clientX, y: e.clientY }; }
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = goal.current.zoom; moved = 99; }
    };
    const move = (e: PointerEvent) => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (ptrs.size === 1) { moved += Math.abs(dx) + Math.abs(dy); if (moved > 6) { manual(); panBy(dx, dy); } }
      else if (ptrs.size === 2) {
        const before = [...ptrs.values()]; const mx0 = (before[0].x + before[1].x) / 2, my0 = (before[0].y + before[1].y) / 2;
        p.x = e.clientX; p.y = e.clientY;
        const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        manual(); panBy(mx - mx0, my - my0);
        if (pinch0 > 0) { const target = zoom0 * (d / pinch0); zoomAt(target / goal.current.zoom, mx - el.getBoundingClientRect().left, my - el.getBoundingClientRect().top); }
        return;
      }
      p.x = e.clientX; p.y = e.clientY;
    };
    const up = (e: PointerEvent) => {
      const had = ptrs.delete(e.pointerId);
      if (!had) return;
      if (ptrs.size === 0 && moved < 8 && performance.now() - downT < 350) {
        const now = performance.now();
        if (now - lastTap.t < 340 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) { useStore.getState().fit(); lastTap.t = 0; }
        else lastTap = { t: now, x: e.clientX, y: e.clientY };
      }
      if (ptrs.size < 2) pinch0 = 0;
      void downXY;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault(); manual();
      const r = el.getBoundingClientRect();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomAt(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0016)), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, size.width, size.height]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    const st = useStore.getState(), g = goal.current;
    if (st.fitNonce !== prev.current.fit) { prev.current.fit = st.fitNonce; doFit(); }
    if (st.focusReq !== prev.current.focus) {
      prev.current.focus = st.focusReq;
      const stop = st.data.stops.find(s => s.id === st.selectedStopId);
      if (stop) {
        const [x, z] = toWorld(stop.lat, stop.lng), rect = coverRect(true), c0 = uncoveredCentre(size.width, size.height, rect), ox = c0.ox;
        const labelY = LABEL_Y[CITIES[stop.cityKey]?.landmark ?? 'generic'] ?? 3.2;
        let go = true, zoom = g.zoom;
        if (st.focusReq.keepZoom) { // pan only if the city isn't already comfortably inside the uncovered area
          const p = groundToScreenOffset(x - g.tx, z - g.tz, g.zoom, g.yaw);
          go = !insideRect(p.sx + size.width / 2, p.sy + size.height / 2, rect, 60);
        } else zoom = Math.max(g.zoom, focusZoom() * 0.8);
        if (go) { const oy = c0.oy + labelY * zoom * COSE * 0.5; // centre city + label together
          const t = targetFor(x, z, ox, oy, zoom, g.yaw); g.tx = t.tx; g.tz = t.tz; g.zoom = zoom; }
        fitted.current = false;
      }
    }
    g.tx = THREE.MathUtils.clamp(g.tx, LIMITS.x0, LIMITS.x1); g.tz = THREE.MathUtils.clamp(g.tz, LIMITS.z0, LIMITS.z1);
    g.zoom = THREE.MathUtils.clamp(g.zoom, minZoom(), 70);
    rig.tx = damp(rig.tx, g.tx, 12, dt); rig.tz = damp(rig.tz, g.tz, 12, dt);
    rig.zoom = damp(rig.zoom, g.zoom, 9, dt); rig.yaw = angDamp(rig.yaw, g.yaw, 5, dt);
    rig.viewW = size.width; rig.viewH = size.height;
    cam.position.set(rig.tx + Math.sin(rig.yaw) * COSE * DIST, SINE * DIST, rig.tz + Math.cos(rig.yaw) * COSE * DIST);
    cam.zoom = rig.zoom; cam.near = -600; cam.far = 600;
    cam.lookAt(rig.tx, 0, rig.tz); cam.updateProjectionMatrix();
  });
  return null;
}
