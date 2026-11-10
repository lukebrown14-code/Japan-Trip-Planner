import { describe, it, expect } from 'vitest';
import { uncoveredRect, uncoveredCentre, targetFor, groundToScreenOffset, insideRect, fitPoints, isSidePanel } from './cameraMath';

const YAW = Math.PI / 4;

describe('uncoveredRect', () => {
  it('phone: between topbar and expected half sheet', () => {
    const r = uncoveredRect(390, 844, { topbarBottom: 60, tpTop: 700, sheetExpected: true });
    expect(r.y0).toBe(60); expect(r.x1).toBe(390);
    expect(r.y1).toBeCloseTo(700 - 0.48 * 844);
  });
  it('phone without sheet: above the planner bar', () => {
    expect(uncoveredRect(390, 844, { topbarBottom: 60, tpTop: 700 }).y1).toBe(700);
  });
  it('uses the real sheet when taller than expected', () => {
    expect(uncoveredRect(390, 844, { topbarBottom: 60, tpTop: 700, sheet: { top: 150, left: 0 }, sheetExpected: true }).y1).toBe(180);
  });
  it('desktop: left of the 400px panel plus margin', () => {
    const r = uncoveredRect(1280, 800, { topbarBottom: 60, tpTop: 640, sheetExpected: true });
    expect(r.x1).toBe(1280 - 416 - 16); expect(r.y1).toBe(640);
  });
  it('landscape phone is a side panel', () => {
    expect(isSidePanel(844, 390)).toBe(true); expect(isSidePanel(390, 844)).toBe(false);
    expect(uncoveredRect(844, 390, { topbarBottom: 48, tpTop: 268, sheetExpected: true }).x1).toBeLessThan(844 - 300);
  });
});

describe('ground/screen maths', () => {
  it('targetFor puts the point at the requested screen offset', () => {
    const z = 20, t = targetFor(10, -5, 30, -80, z, YAW);
    const s = groundToScreenOffset(10 - t.tx, -5 - t.tz, z, YAW);
    expect(s.sx).toBeCloseTo(30); expect(s.sy).toBeCloseTo(-80);
  });
  it('insideRect respects padding', () => {
    const r = { x0: 0, y0: 50, x1: 300, y1: 400 };
    expect(insideRect(100, 100, r, 60)).toBe(false); expect(insideRect(100, 200, r, 60)).toBe(true);
  });
});

describe('fitPoints', () => {
  const w = 390, h = 844, rect = uncoveredRect(w, h, { topbarBottom: 60, tpTop: 700 });
  const pts: [number, number][] = [[-10, 5], [20, 10], [5, -15], [-30, 20]];
  it('puts every point inside the rect', () => {
    const f = fitPoints(pts, w, h, rect, YAW);
    for (const [x, z] of pts) {
      const s = groundToScreenOffset(x - f.tx, z - f.tz, f.zoom, YAW);
      expect(insideRect(s.sx + w / 2, s.sy + h / 2, rect)).toBe(true);
    }
  });
  it('single stop does not over-zoom', () => {
    const one = fitPoints([[0, 0]], w, h, rect, YAW), two = fitPoints([[0, 0], [1, 1]], w, h, rect, YAW);
    expect(one.zoom).toBeCloseTo(two.zoom, 0); expect(one.zoom).toBeLessThan(40);
  });
  it('centre of an uncovered rect offsets from canvas centre', () => {
    const c = uncoveredCentre(w, h, rect); expect(c.oy).toBeLessThan(0);
  });
});
