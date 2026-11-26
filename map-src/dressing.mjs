/** Pure hillside sampling, archetypes, and tree placement. No Three.js, no DOM. */

import { getElevationAt, openRing, pointInRing } from "./placement.mjs";

export const VISUAL_COLS = 96;
export const VISUAL_ROWS = 108;
export const TREE_CLEARANCE_M = 8;
export const TREE_MIN = 350;
export const TREE_MAX = 550;

const LIMESTONE = new Set([1062064821, 1061922793, 1062065818]);
const RIBBON = new Set([
  1062065374,
  1062071979,
  1062071465,
  1062070303,
  1062070057,
  1062070428,
  1061923876,
  1061923944,
]);

export const ARCHETYPE_COLOR = Object.freeze({
  crimson: { mass: 0xc92a2a, roof: 0x3a1818, skirt: 0x9b1c1c, edge: 0xc92a2a, bay: 3.4, floor: 3.5 },
  limestone: { mass: 0xc6ccd1, roof: 0xb7bec4, skirt: 0x929da6, edge: 0x8e98a1, bay: 4.2, floor: 3.8 },
  ribbon: { mass: 0xc6ccd1, roof: 0xb7bec4, skirt: 0x929da6, edge: 0x8e98a1, bay: 3.3, floor: 3.6 },
  brick: { mass: 0xc6ccd1, roof: 0xb7bec4, skirt: 0x929da6, edge: 0x8e98a1, bay: 3.8, floor: 3.5 },
  context: { mass: 0xc6ccd1, roof: 0xb7bec4, skirt: 0x929da6, edge: 0x8e98a1, bay: 4.0, floor: 3.6 },
});

export function archetypeFor(osmId, kind) {
  const id = Number(osmId);
  if (kind === "red" || id === 1062073167) return "crimson";
  if (LIMESTONE.has(id)) return "limestone";
  if (RIBBON.has(id)) return "ribbon";
  if (kind === "neutral") return "context";
  return "brick";
}

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function locate(arr, value) {
  if (value <= arr[0]) return { i: 0, t: 0 };
  const last = arr.length - 1;
  if (value >= arr[last]) return { i: last - 1, t: 1 };
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= value) lo = mid;
    else hi = mid;
  }
  const span = arr[lo + 1] - arr[lo] || 1;
  return { i: lo, t: (value - arr[lo]) / span };
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

/** Smooth Catmull-Rom height. Clamped to the local sample range so ridges do not ring. */
export function createSmoothSampler(terrain) {
  const xs = terrain.xM;
  const zs = terrain.zM;
  const elev = terrain.elevationsAboveMinM;
  const xN = xs.length;
  const zN = zs.length;
  function rowSample(j, i, t) {
    const row = elev[clamp(j, 0, zN - 1)];
    const i0 = clamp(i - 1, 0, xN - 1);
    const i1 = clamp(i, 0, xN - 1);
    const i2 = clamp(i + 1, 0, xN - 1);
    const i3 = clamp(i + 2, 0, xN - 1);
    const y = catmull(row[i0], row[i1], row[i2], row[i3], t);
    let lo = Infinity;
    let hi = -Infinity;
    for (const idx of [i0, i1, i2, i3]) {
      if (row[idx] < lo) lo = row[idx];
      if (row[idx] > hi) hi = row[idx];
    }
    return clamp(y, lo, hi);
  }
  return function smoothAt(x, z) {
    const cx = locate(xs, x);
    const cz = locate(zs, z);
    const j = cz.i;
    const s0 = rowSample(j - 1, cx.i, cx.t);
    const s1 = rowSample(j, cx.i, cx.t);
    const s2 = rowSample(j + 1, cx.i, cx.t);
    const s3 = rowSample(j + 2, cx.i, cx.t);
    const y = catmull(s0, s1, s2, s3, cz.t);
    return clamp(y, Math.min(s0, s1, s2, s3), Math.max(s0, s1, s2, s3));
  };
}

export function slopeDegrees(sample, x, z) {
  const step = 8;
  const y = sample(x, z);
  const dx = (sample(x + step, z) - sample(x - step, z)) / (step * 2);
  const dz = (sample(x, z + step) - sample(x, z - step)) / (step * 2);
  return Math.atan(Math.hypot(dx, dz)) * (180 / Math.PI) || (y ? 0 : 0);
}

export function visualGrid(terrain, sample) {
  const xs = terrain.xM;
  const zs = terrain.zM;
  const x0 = xs[0];
  const x1 = xs[xs.length - 1];
  const z0 = zs[0];
  const z1 = zs[zs.length - 1];
  const positions = new Float32Array(VISUAL_COLS * VISUAL_ROWS * 3);
  const heights = new Float32Array(VISUAL_COLS * VISUAL_ROWS);
  let p = 0;
  for (let j = 0; j < VISUAL_ROWS; j++) {
    const z = z0 + ((z1 - z0) * j) / (VISUAL_ROWS - 1);
    for (let i = 0; i < VISUAL_COLS; i++) {
      const x = x0 + ((x1 - x0) * i) / (VISUAL_COLS - 1);
      const y = sample(x, z);
      positions[p++] = x;
      positions[p++] = y;
      positions[p++] = z;
      heights[j * VISUAL_COLS + i] = y;
    }
  }
  return { positions, heights, width: VISUAL_COLS, x0, x1, z0, z1 };
}

function distToSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-8) return Math.hypot(px - ax, pz - az);
  let t = ((px - ax) * dx + (pz - az) * dz) / len2;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

function distToRing(x, z, ring) {
  const pts = openRing(ring);
  if (pointInRing(x, z, pts)) return 0;
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const d = distToSeg(x, z, a[0], a[1], b[0], b[1]);
    if (d < best) best = d;
  }
  return best;
}

function hash01(ix, iz, salt) {
  let n = Math.imul(ix + salt * 13, 374761393) + Math.imul(iz + 17, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function bbox(points) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of points) {
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minZ) minZ = p[1];
    if (p[1] > maxZ) maxZ = p[1];
  }
  return { minX, maxX, minZ, maxZ };
}

/**
 * Low-poly trees only inside the existing woods, sparser in park polygons,
 * and a light ring around the existing lake. Bare slopes stay grass.
 * The two woods that share an osm id are one wood: a point is planted once.
 */
export function placeTrees({ terrain, buildings, layers, clearance = TREE_CLEARANCE_M }) {
  const sample = createSmoothSampler(terrain);
  const linear = (x, z) => getElevationAt(terrain, x, z);
  const footprints = (buildings || []).map((b) => ({
    ring: b.footprintXZ,
    box: bbox(b.footprintXZ),
  }));
  const pitches = (layers.pitches || []).filter((feature) => feature.subtype !== "park").map((feature) => ({
    ring: feature.points,
    box: bbox(feature.points),
  }));
  const roads = (layers.roads || []).map((road) => ({
    points: road.points,
    width: road.widthM || 4,
    box: bbox(road.points),
  }));
  const woods = (layers.woods || []).map((wood) => wood.points);
  const parks = (layers.pitches || []).filter((feature) => feature.subtype === "park").map((feature) => feature.points);
  const lake = (layers.water || []).find((feature) => feature.osmId === 1035938120) || null;
  const lakeRing = lake ? lake.points : null;
  const xs = terrain.xM;
  const zs = terrain.zM;
  const x0 = xs[0];
  const x1 = xs[xs.length - 1];
  const z0 = zs[0];
  const z1 = zs[zs.length - 1];
  const candidates = [];
  const seen = new Set();
  function plant(px, pz, ix, iz, zone) {
    const key = `${px.toFixed(1)},${pz.toFixed(1)}`;
    if (seen.has(key)) return;
    if (lakeRing && pointInRing(px, pz, lakeRing)) return;
    if (!clears(px, pz, footprints, pitches, roads, clearance)) return;
    if (lakeRing && distToRing(px, pz, lakeRing) < 3) return;
    const y = sample(px, pz);
    if (!Number.isFinite(y) || Math.abs(y - linear(px, pz)) > 40) return;
    seen.add(key);
    candidates.push({
      x: px,
      z: pz,
      y,
      kind: hash01(ix, iz, 3) > 0.62 ? "pine" : "leaf",
      scale: 0.8 + hash01(ix, iz, 4) * 0.5,
      hue: hash01(ix, iz, 5),
      zone,
    });
  }
  let ix = 0;
  for (let x = x0 + 4; x <= x1 - 4; x += 9) {
    let iz = 0;
    for (let z = z0 + 4; z <= z1 - 4; z += 9) {
      const px = x + (hash01(ix, iz, 1) - 0.5) * 5;
      const pz = z + (hash01(ix, iz, 2) - 0.5) * 5;
      const inWood = woods.some((ring) => pointInRing(px, pz, ring));
      const inPark = !inWood && parks.some((ring) => pointInRing(px, pz, ring));
      if (inWood && hash01(ix, iz, 6) > 0.18) plant(px, pz, ix, iz, "wood");
      else if (inPark && hash01(ix, iz, 7) > 0.72) plant(px, pz, ix, iz, "park");
      iz += 1;
    }
    ix += 1;
  }
  if (lakeRing && lakeRing.length > 2) {
    let cx = 0;
    let cz = 0;
    for (const p of lakeRing) {
      cx += p[0];
      cz += p[1];
    }
    cx /= lakeRing.length;
    cz /= lakeRing.length;
    for (let i = 0; i < lakeRing.length; i++) {
      const a = lakeRing[i];
      const b = lakeRing[(i + 1) % lakeRing.length];
      const seg = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const steps = Math.max(1, Math.round(seg / 14));
      for (let s = 0; s < steps; s++) {
        const t = (s + 0.5) / steps;
        const x = a[0] + (b[0] - a[0]) * t;
        const z = a[1] + (b[1] - a[1]) * t;
        const dx = x - cx;
        const dz = z - cz;
        const len = Math.hypot(dx, dz) || 1;
        plant(x + (dx / len) * 7, z + (dz / len) * 7, i, s, "shore");
      }
    }
  }
  candidates.sort((a, b) => a.x - b.x || a.z - b.z || a.hue - b.hue);
  if (candidates.length > 480) {
    const stride = candidates.length / 480;
    const kept = [];
    for (let i = 0; i < 480; i++) kept.push(candidates[Math.floor(i * stride)]);
    return kept;
  }
  return candidates;
}

function clears(x, z, footprints, blocked, roads, clearance) {
  for (const item of footprints) {
    const box = item.box;
    if (x < box.minX - clearance || x > box.maxX + clearance || z < box.minZ - clearance || z > box.maxZ + clearance) continue;
    if (distToRing(x, z, item.ring) < clearance) return false;
  }
  for (const item of blocked) {
    const box = item.box;
    if (x < box.minX - clearance || x > box.maxX + clearance || z < box.minZ - clearance || z > box.maxZ + clearance) continue;
    if (distToRing(x, z, item.ring) < clearance) return false;
  }
  for (const road of roads) {
    const reach = road.width / 2 + clearance;
    const box = road.box;
    if (x < box.minX - reach || x > box.maxX + reach || z < box.minZ - reach || z > box.maxZ + reach) continue;
    const pts = road.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = distToSeg(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
      if (d < reach) return false;
    }
  }
  return true;
}

export function nearestClearance(trees, buildings, layers) {
  let worst = Infinity;
  const footprints = (buildings || []).map((b) => b.footprintXZ);
  const blocked = [...(layers.pitches || []), ...(layers.water || [])].map((feature) => feature.points);
  const roads = layers.roads || [];
  for (const tree of trees) {
    for (const ring of footprints) {
      const d = distToRing(tree.x, tree.z, ring);
      if (d < worst) worst = d;
    }
    for (const ring of blocked) {
      const d = distToRing(tree.x, tree.z, ring);
      if (d < worst) worst = d;
    }
    for (const road of roads) {
      const reach = (road.widthM || 4) / 2;
      const pts = road.points;
      for (let i = 0; i < pts.length - 1; i++) {
        const d = distToSeg(tree.x, tree.z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) - reach;
        if (d < worst) worst = d;
      }
    }
  }
  return worst;
}

export function featureCounts(layers) {
  return {
    roads: (layers.roads || []).length,
    paths: (layers.paths || []).length,
    water: (layers.water || []).length,
    pitches: (layers.pitches || []).length,
    woods: (layers.woods || []).length,
  };
}
