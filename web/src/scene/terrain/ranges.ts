// ridge polylines shared by Mountains (cones) and the ground mask script. Pure data, no imports.
/** ridge polylines [lat,lng] with half-width and peak height */
export const RANGES: { pts: [number, number][]; w: number; h: number; n: number }[] = [
  { pts: [[36.9, 137.78], [36.5, 137.62], [36.2, 137.65], [35.9, 137.72]], w: 0.55, h: 2.1, n: 26 },   // Hida (Northern) Alps
  { pts: [[35.9, 137.8], [35.5, 137.85], [35.2, 137.75]], w: 0.5, h: 1.7, n: 14 },                      // Kiso (Central) Alps
  { pts: [[35.9, 138.25], [35.5, 138.2], [35.2, 138.2]], w: 0.5, h: 1.8, n: 14 },                       // Akaishi (Southern) Alps
  { pts: [[36.6, 138.6], [36.45, 139.0], [36.8, 139.3]], w: 0.5, h: 1.2, n: 10 },                       // Joshin-etsu / Kanto fringe
  { pts: [[41.0, 140.7], [39.8, 140.9], [38.6, 140.5], [37.4, 139.9]], w: 0.7, h: 1.1, n: 28 },         // Ou range
  { pts: [[35.3, 135.9], [34.6, 135.8], [34.2, 136.1]], w: 0.4, h: 0.8, n: 8 },                          // Kii / Kansai hills
  { pts: [[35.2, 133.3], [35.1, 132.2]], w: 0.4, h: 0.7, n: 8 },                                         // Chugoku
  { pts: [[43.6, 142.9], [43.2, 143.1], [42.8, 142.6]], w: 0.6, h: 1.2, n: 10 },                         // Daisetsuzan
  { pts: [[32.9, 131.1], [32.4, 130.7]], w: 0.4, h: 0.8, n: 6 },                                          // Aso, Kyushu
];

/** world-space extent covered by the baked ground mask (x east, z south) and its pixel size */
export const MASK = { x0: -132, x1: 112, z0: -142, z1: 182, w: 512, h: 640, sdfRange: 3 };
