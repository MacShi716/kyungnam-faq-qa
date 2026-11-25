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

function srgbByte(hex, shift) {
  const n = ((hex >> shift) & 255) / 255;
  return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
}

function hexLin(hex) {
  return [srgbByte(hex, 16), srgbByte(hex, 8), srgbByte(hex, 0)];
}

const CAST_ROLES = ["terrain", "building", "foundation", "road", "shoulder"];

export const MAIN_HALL_ID = 1062064821;
export const DESIGN_HALL_ID = 1062073167;

/** Natural campus at tint 0. Cool and warm are the extra casts, not the default. */
const NATURAL = Object.freeze({
  light: { terrain: 0x6b8f5a, building: 0xd5d2cb, foundation: 0xb8b3ab, road: 0x5c6670, shoulder: 0xb4b8b0 },
  dark: { terrain: 0x2a3a2c, building: 0x6e7278, foundation: 0x4e555c, road: 0x3e4852, shoulder: 0x6a7068 },
});

const CAST = Object.freeze({
  light: {
    cool: { terrain: 0x87949d, building: 0xc6ccd1, foundation: 0x929da6, road: 0x455563, shoulder: 0xa9b5bd },
    warm: { terrain: 0xa39686, building: 0xd4ccc4, foundation: 0xb3a79b, road: 0x5c534b, shoulder: 0xc4b8ac },
  },
  dark: {
    cool: { terrain: 0x303d49, building: 0x788895, foundation: 0x596c7b, road: 0x465a6b, shoulder: 0x8596a3 },
    warm: { terrain: 0x4a4038, building: 0x8a8076, foundation: 0x6b6057, road: 0x5a5249, shoulder: 0x9a8e82 },
  },
});

function byteAt(hex, shift) {
  return (hex >> shift) & 255;
}

function packHex(r, g, b) {
  return ((r & 255) << 16) | ((g & 255) << 8) | (b & 255);
}

function lerpHex(a, b, t) {
  const ch = (shift) => Math.round(byteAt(a, shift) + (byteAt(b, shift) - byteAt(a, shift)) * t);
  return packHex(ch(16), ch(8), ch(0));
}

export function clampTint(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-1, Math.min(1, n));
}

/** Release near the center returns to no cast. */
export function settleTint(value) {
  const n = clampTint(value);
  return Math.abs(n) <= 0.12 ? 0 : n;
}

/** tint -1 cool, 0 natural campus, +1 warm. One value drives day and night. */
export function materialSet(tint, theme) {
  const t = clampTint(tint);
  const base = theme === "dark" ? NATURAL.dark : NATURAL.light;
  const pair = theme === "dark" ? CAST.dark : CAST.light;
  const end = t < 0 ? pair.cool : pair.warm;
  const amount = Math.abs(t);
  const out = {};
  for (const key of CAST_ROLES) out[key] = lerpHex(base[key], end[key], amount);
  return out;
}

/** Design Hall and 본관 keep their own colors. Ordinary walls follow the tint. */
export function wallPaint(osmId, archetype, tint, theme) {
  const dark = theme === "dark";
  if (archetype === "crimson" || osmId === DESIGN_HALL_ID) {
    return { mass: 0xc92a2a, skirt: 0x9b1c1c, tinted: false };
  }
  if (osmId === MAIN_HALL_ID) {
    return { mass: dark ? 0x5a322c : 0x9a5346, skirt: dark ? 0x3e2420 : 0x7a4038, tinted: false };
  }
  const cast = materialSet(tint, theme);
  return { mass: cast.building, skirt: cast.foundation, tinted: true };
}

/** Smooth 0..1 elevation color. Channels are linear 0..1. */
export function terrainColor(t, theme, tint = 0) {
  const u = Math.min(1, Math.max(0, t));
  const base = hexLin(materialSet(tint, theme).terrain);
  const lift = 1 + (u - 0.5) * 0.06;
  return base.map((channel) => Math.min(1, Math.max(0, channel * lift)));
}

export function skyColor(theme) {
  return theme === "dark" ? 0x101820 : 0xd7eefc;
}

export function lightRig(theme) {
  if (theme === "dark") {
    return {
      hemi: 0xd5dde8,
      hemiGround: 0x243028,
      hemiIntensity: 1.05,
      sun: 0xe4e0d4,
      sunIntensity: 0.7,
      boundary: 0x8fd0c4,
    };
  }
  return {
    hemi: 0xe7f1f8,
    hemiGround: 0x6b8f5a,
    hemiIntensity: 0.95,
    sun: 0xfff6ea,
    sunIntensity: 1.05,
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
      edge: mode === "idle" ? base.edge : 0x39b9c5,
      emissive: mode === "selected" ? 0x0e3c42 : 0x000000,
      emissiveIntensity: mode === "selected" ? 0.18 : 0,
    };
  }
  throw new Error("unknown building kind: " + kind);
}
