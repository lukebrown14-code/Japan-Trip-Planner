// Layout constants shared by CSS-driven panels and the camera maths (keep in step with styles.css / timeline.css, which
// can't import them). Elements that cover the map carry data-cover="top|bottom|sheet" so the camera reads them explicitly.
export const BP_DESKTOP = 900;               // >= this the city sheet is a right-hand panel
export const LANDSCAPE_MAX_H = 500;          // landscape phones (height <= this) also get the side panel
export const SHEET_FRAC = { half: 0.48, full: 0.88 }; // BottomSheet heights as a fraction of the viewport
export const SIDE_PANEL = { desktop: { w: 400, margin: 16 }, landscape: { maxW: 400, vw: 0.45, margin: 12 } };
export const MQ_DESKTOP = `(min-width: ${BP_DESKTOP}px)`;
export const MQ_MOBILE = `(max-width: ${BP_DESKTOP - 1}px)`;
