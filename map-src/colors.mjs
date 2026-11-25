/** Theme colors for the schematic campus model. No Three.js, no network. */

export const RED_OSM_ID = 1062073167;

/** Unnamed outlines, the pre-2008 museum outline, 생활과학관, and 제2경상관. */
export const NEUTRAL_OSM_IDS = Object.freeze([
  1061922824,
  1061923278,
  1062063659,
  1062066160,
  1062066666,
  1062069659,
  1062071802,
  1064495988,
]);

const MAPPED_LIGHT = Object.freeze([
  { mass: 0xf3e4d0, roof: 0xfaf4ea, skirt: 0x8d8478, edge: 0x8a6a4a },
  { mass: 0xf7f1e6, roof: 0xfffaf3, skirt: 0x90887e, edge: 0x7d6b58 },
  { mass: 0xe7cbb8, roof: 0xf3ddd0, skirt: 0x7d6a60, edge: 0x8d5e48 },
  { mass: 0xd5e1ee, roof: 0xeaf1f8, skirt: 0x6e7884, edge: 0x5c7388 },
  { mass: 0xe5e3dc, roof: 0xf3f1ea, skirt: 0x7a7872, edge: 0x6e6c66 },
]);

const MAPPED_DARK = Object.freeze([
  { mass: 0xc8ae90, roof: 0xe2d0b4, skirt: 0x3a332c, edge: 0xf0ddc4 },
  { mass: 0xd8d0c4, roof: 0xf0e8dc, skirt: 0x3a3834, edge: 0xf4ecdf },
  { mass: 0xc48b74, roof: 0xe0b09a, skirt: 0x3a2c28, edge: 0xf3c8b6 },
  { mass: 0x8ea4bc, roof: 0xb7c9dc, skirt: 0x2a3138, edge: 0xd7e6f6 },
  { mass: 0xb7b6b0, roof: 0xd5d3cc, skirt: 0x323230, edge: 0xe6e4de },
]);

const NEUTRAL = Object.freeze({
  light: { mass: 0xd5d0c7, roof: 0xe4dfd6, skirt: 0x9a958c, edge: 0xb7b2a8 },
  dark: { mass: 0x3a4149, roof: 0x484f59, skirt: 0x24292f, edge: 0x66707c },
});

function mix(a, b, t) {
  return a + (b - a) * t;
}

function mix3(a, b, t) {
  return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
}

export function buildingKind(osmId, linked) {
  const id = Number(osmId);
  if (id === RED_OSM_ID) return "red";
  if (NEUTRAL_OSM_IDS.includes(id) || !linked) return "neutral";
  return "mapped";
}

/** Smooth 0..1 elevation color. Channels are linear 0..1. */
export function terrainColor(t, theme) {
  const u = Math.min(1, Math.max(0, t));
  if (theme === "dark") {
    const low = [0.06, 0.15, 0.19];
    const mid = [0.09, 0.18, 0.28];
    const high = [0.16, 0.20, 0.38];
    if (u < 0.58) return mix3(low, mid, u / 0.58);
    return mix3(mid, high, (u - 0.58) / 0.42);
  }
  const lawn = [0.58, 0.78, 0.40];
  const wood = [0.20, 0.46, 0.26];
  const ridge = [0.48, 0.40, 0.24];
  if (u < 0.7) return mix3(lawn, wood, u / 0.7);
  return mix3(wood, ridge, (u - 0.7) / 0.3);
}

export function skyColor(theme) {
  return theme === "dark" ? 0x101820 : 0xd7eefc;
}

export function lightRig(theme) {
  if (theme === "dark") {
    return {
      hemi: 0xd5e0f0,
      hemiGround: 0x5c6858,
      hemiIntensity: 1.45,
      sun: 0xd5e2f4,
      sunIntensity: 0.62,
      boundary: 0x8fd0c4,
    };
  }
  return {
    hemi: 0xf4f8ff,
    hemiGround: 0xc5d6a2,
    hemiIntensity: 1.05,
    sun: 0xfff3dc,
    sunIntensity: 1.12,
    boundary: 0xf6f1e6,
  };
}

export function paintTokens(kind, osmId, theme, mode) {
  const dark = theme === "dark";
  if (kind === "red") {
    return {
      mass: 0xc92a2a,
      roof: mode === "idle" ? 0xef4444 : 0xff5c5c,
      skirt: 0x9b1c1c,
      edge: 0xe03131,
      emissive: 0x6a1414,
      emissiveIntensity: mode === "selected" ? 0.48 : mode === "hover" ? 0.34 : 0.2,
    };
  }
  if (kind === "neutral") {
    const base = dark ? NEUTRAL.dark : NEUTRAL.light;
    return {
      mass: base.mass,
      roof: base.roof,
      skirt: base.skirt,
      edge: mode === "idle" ? base.edge : 0xc48a2a,
      emissive: 0x000000,
      emissiveIntensity: mode === "selected" ? 0.08 : 0,
    };
  }
  if (kind === "mapped") {
    const table = dark ? MAPPED_DARK : MAPPED_LIGHT;
    const base = table[Math.abs(Number(osmId)) % table.length];
    return {
      mass: base.mass,
      roof: base.roof,
      skirt: base.skirt,
      edge: mode === "idle" ? base.edge : mode === "hover" ? 0xd0892a : 0xe39a2b,
      emissive: mode === "selected" ? (dark ? 0x3a2c14 : 0x5a4020) : 0x000000,
      emissiveIntensity: mode === "selected" ? 0.22 : mode === "hover" ? 0.06 : 0,
    };
  }
  throw new Error("unknown building kind: " + kind);
}
