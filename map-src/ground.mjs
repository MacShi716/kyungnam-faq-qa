/** Ground-overlay spacing and haze. No Three.js, no DOM. */

export const HAZE_DENSITY = Object.freeze({
  light: 0.00026,
  dark: 0.00034,
});

export const ROAD_FRACTION = 0.78;
export const SHOULDER_GAP_M = 0.06;

/**
 * Asphalt in the middle, curb only on the shoulders, with a gap so the two
 * ribbons never share pixels. A light curb under the asphalt z-fights on a
 * 16-bit depth buffer (iPhone) and flickers as the camera moves.
 */
export function roadCrossSection(fullWidth) {
  const full = Math.max(2.2, fullWidth || 4);
  const road = full * ROAD_FRACTION;
  const shoulder = (full - road) / 2;
  const lateral = road / 2 + SHOULDER_GAP_M + shoulder / 2;
  return { full, road, shoulder, lateral, gap: SHOULDER_GAP_M };
}

/** Window-depth steps separating two surfaces. Used to show why an 8cm stack fails on 16-bit. */
export function linearDepthSteps({ near, far, distance, separation, bits }) {
  const m32 = (2 * far * near) / (near - far);
  const dNdc = (Math.abs(m32) / (distance * distance)) * separation;
  const dWindow = dNdc * 0.5;
  return dWindow / (1 / (2 ** bits));
}
