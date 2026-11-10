// Pure camera maths (no three.js / DOM): the uncovered map rect, ground<->screen offsets and trip framing.
// Screen coords are canvas-relative CSS px (y down); ground coords are world (x east, z south).
import { BP_DESKTOP, LANDSCAPE_MAX_H, SHEET_FRAC, SIDE_PANEL } from '../ui/layout';
export const ELEV = Math.atan2(70, Math.hypot(60, 60)); // matches Diorama's camera [60,70,60]
export const SINE = Math.sin(ELEV), COSE = Math.cos(ELEV);

export interface Rect { x0: number; y0: number; x1: number; y1: number }
export interface Cover {
  /** bottom edge of the top bar (canvas-relative) */
  topbarBottom?: number;
  /** top edge of the planner bar */
  tpTop?: number;
  /** a city sheet that is currently on screen (canvas-relative top/left) */
  sheet?: { top: number; left: number } | null;
  /** the city sheet is about to appear (a focus selects a city) */
  sheetExpected?: boolean;
}

const MARGIN = 16;
const MIN_SIDE = 120;

/** Landscape phones and desktop show the city sheet as a right-hand panel. */
export const isSidePanel = (w: number, h: number) => w >= BP_DESKTOP || (h <= LANDSCAPE_MAX_H && w > h);
export const sidePanelLeft = (w: number, h: number) => {
  const { desktop: d, landscape: l } = SIDE_PANEL;
  return w >= BP_DESKTOP ? w - d.margin - d.w : w - l.margin - Math.min(l.maxW, l.vw * w);
};

/** The part of the canvas not hidden by the top bar, planner bar and city sheet / side panel. */
export function uncoveredRect(w: number, h: number, c: Cover = {}): Rect {
  const y0 = Math.min(c.topbarBottom ?? 56, h * 0.4);
  const tpTop = c.tpTop ?? h - 150;
  let x1 = w, y1 = Math.max(y0 + MIN_SIDE, Math.min(tpTop, h));
  if (isSidePanel(w, h)) {
    const left = Math.min(c.sheet?.left ?? Infinity, c.sheetExpected ? sidePanelLeft(w, h) : Infinity);
    if (isFinite(left)) x1 = Math.max(MIN_SIDE, left - MARGIN);
  } else {
    const top = Math.min(c.sheet?.top ?? Infinity, c.sheetExpected ? tpTop - SHEET_FRAC.half * h : Infinity);
    if (isFinite(top)) y1 = Math.max(y0 + MIN_SIDE, Math.min(y1, top));
  }
  return { x0: 0, y0, x1, y1 };
}

/** Screen offset from the canvas centre to the centre of the uncovered rect. */
export const uncoveredCentre = (w: number, h: number, r: Rect) => ({ ox: (r.x0 + r.x1 - w) / 2, oy: (r.y0 + r.y1 - h) / 2 });

export const axes = (yaw: number) => ({ rx: Math.cos(yaw), rz: -Math.sin(yaw), fx: -Math.sin(yaw), fz: -Math.cos(yaw) });

/** Ground offset (from the camera target) of a screen point (px from canvas centre) at a zoom. */
export function screenToGroundOffset(sx: number, sy: number, zoom: number, yaw: number) {
  const { rx, rz, fx, fz } = axes(yaw);
  return { dx: rx * sx / zoom - fx * sy / (zoom * SINE), dz: rz * sx / zoom - fz * sy / (zoom * SINE) };
}

/** Inverse: screen offset (px from canvas centre) of a ground offset from the target. */
export function groundToScreenOffset(dx: number, dz: number, zoom: number, yaw: number) {
  const { rx, rz, fx, fz } = axes(yaw);
  return { sx: zoom * (dx * rx + dz * rz), sy: -zoom * SINE * (dx * fx + dz * fz) };
}

/** Camera target that makes ground point (x,z) appear at screen offset (ox,oy) from the canvas centre. */
export function targetFor(x: number, z: number, ox: number, oy: number, zoom: number, yaw: number) {
  const d = screenToGroundOffset(ox, oy, zoom, yaw);
  return { tx: x - d.dx, tz: z - d.dz };
}

/** Is the screen point (canvas-relative) inside the rect shrunk by pad? */
export const insideRect = (x: number, y: number, r: Rect, pad = 0) => x >= r.x0 + pad && x <= r.x1 - pad && y >= r.y0 + pad && y <= r.y1 - pad;

/** Bounding box of ground points in screen-axis units (before zoom). */
export function projectBounds(pts: [number, number][], yaw: number) {
  const { rx, rz, fx, fz } = axes(yaw);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [x, z] of pts) { const sx = x * rx + z * rz, sy = (x * fx + z * fz) * SINE; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
  return { x0, x1, y0, y1 };
}

/** Fit ground points into a rect: bbox + pad on each side, with a minimum extent (world screen units). */
export function fitPoints(pts: [number, number][], w: number, h: number, rect: Rect, yaw: number,
  opts: { pad?: number; minW?: number; minH?: number; maxZoom?: number } = {}) {
  const { pad = 0.18, minW = 22, minH = 15, maxZoom = 70 } = opts;
  const { rx, rz, fx, fz } = axes(yaw);
  const { x0, x1, y0, y1 } = projectBounds(pts, yaw);
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const ew = Math.max((x1 - x0) * (1 + 2 * pad), minW), eh = Math.max((y1 - y0) * (1 + 2 * pad), minH);
  const zoom = Math.min((rect.x1 - rect.x0) / ew, (rect.y1 - rect.y0) / eh, maxZoom);
  const gx = mx * rx + (my / SINE) * fx, gz = mx * rz + (my / SINE) * fz;
  const { ox, oy } = uncoveredCentre(w, h, rect);
  const t = targetFor(gx, gz, ox, oy, zoom, yaw);
  return { tx: t.tx, tz: t.tz, zoom, yaw };
}
