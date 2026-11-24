/** Pure terrain sampling and building seating. No Three.js, no network. */

export const PLATFORM_LIFT_M = 0.15;
export const SKIRT_DEPTH_M = 3;
export const SCHEMATIC_HEIGHT_M = 14;
export const SAMPLE_STEP_M = 2;

export function openRing(ring) {
  const out = ring.map((p) => [p[0], p[1]]);
  if (out.length > 1) {
    const a = out[0];
    const b = out[out.length - 1];
    if (a[0] === b[0] && a[1] === b[1]) out.pop();
  }
  return out;
}

export function signedArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
}

function cross2(ax, az, bx, bz) {
  return ax * bz - az * bx;
}

function isConvex(points, i0, i1, i2) {
  const a = points[i0];
  const b = points[i1];
  const c = points[i2];
  return cross2(b[0] - a[0], b[1] - a[1], c[0] - b[0], c[1] - b[1]) > 1e-8;
}

function pointInTri(p, a, b, c) {
  const c1 = cross2(b[0] - a[0], b[1] - a[1], p[0] - a[0], p[1] - a[1]);
  const c2 = cross2(c[0] - b[0], c[1] - b[1], p[0] - b[0], p[1] - b[1]);
  const c3 = cross2(a[0] - c[0], a[1] - c[1], p[0] - c[0], p[1] - c[1]);
  const hasNeg = c1 < -1e-8 || c2 < -1e-8 || c3 < -1e-8;
  const hasPos = c1 > 1e-8 || c2 > 1e-8 || c3 > 1e-8;
  return !(hasNeg && hasPos);
}

/** Ear-clip an XZ ring. Returns a flat index list of CCW triangles. */
export function triangulateXZ(ring) {
  const points = openRing(ring);
  const n = points.length;
  if (n < 3) return [];
  const idx = points.map((_, i) => i);
  if (signedArea(points) < 0) idx.reverse();
  const tris = [];
  let guard = 0;
  while (idx.length > 3 && guard < n * n) {
    guard += 1;
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const i0 = idx[(i + idx.length - 1) % idx.length];
      const i1 = idx[i];
      const i2 = idx[(i + 1) % idx.length];
      if (!isConvex(points, i0, i1, i2)) continue;
      let inside = false;
      for (let k = 0; k < idx.length; k++) {
        const ik = idx[k];
        if (ik === i0 || ik === i1 || ik === i2) continue;
        if (pointInTri(points[ik], points[i0], points[i1], points[i2])) {
          inside = true;
          break;
        }
      }
      if (inside) continue;
      tris.push(i0, i1, i2);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  if (idx.length === 3) tris.push(idx[0], idx[1], idx[2]);
  return tris;
}

export function pointInRing(x, z, ring) {
  const pts = openRing(ring);
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0];
    const zi = pts[i][1];
    const xj = pts[j][0];
    const zj = pts[j][1];
    const intersect = (zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function locateSegment(arr, value) {
  const last = arr.length - 2;
  if (value <= arr[0]) return 0;
  if (value >= arr[arr.length - 1]) return last;
  let lo = 0;
  let hi = arr.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= value) lo = mid;
    else hi = mid;
  }
  return lo;
}

function barycentric(ax, az, bx, bz, cx, cz, px, pz) {
  const v0x = bx - ax;
  const v0z = bz - az;
  const v1x = cx - ax;
  const v1z = cz - az;
  const v2x = px - ax;
  const v2z = pz - az;
  const dot00 = v0x * v0x + v0z * v0z;
  const dot01 = v0x * v1x + v0z * v1z;
  const dot02 = v0x * v2x + v0z * v2z;
  const dot11 = v1x * v1x + v1z * v1z;
  const dot12 = v1x * v2x + v1z * v2z;
  const denom = dot00 * dot11 - dot01 * dot01;
  if (Math.abs(denom) < 1e-12) return { u: 0, v: 0, w: 1 };
  const inv = 1 / denom;
  const u = (dot11 * dot02 - dot01 * dot12) * inv;
  const v = (dot00 * dot12 - dot01 * dot02) * inv;
  return { u, v, w: 1 - u - v };
}

/**
 * Piecewise-linear height on the fixed NW-SE mesh.
 * Cell (j, i): a=(j,i), b=(j,i+1), c=(j+1,i), d=(j+1,i+1).
 * Triangles [a,d,b] and [a,c,d]. Y is elevationsAboveMinM (already relative).
 */
export function sampleTerrainY(terrain, x, z) {
  const xM = terrain.xM;
  const zM = terrain.zM;
  const elev = terrain.elevationsAboveMinM;
  const i = locateSegment(xM, x);
  const j = locateSegment(zM, z);
  const ax = xM[i];
  const az = zM[j];
  const bx = xM[i + 1];
  const bz = zM[j];
  const cx = xM[i];
  const cz = zM[j + 1];
  const dx = xM[i + 1];
  const dz = zM[j + 1];
  const ha = elev[j][i];
  const hb = elev[j][i + 1];
  const hc = elev[j + 1][i];
  const hd = elev[j + 1][i + 1];
  const adx = dx - ax;
  const adz = dz - az;
  const apx = x - ax;
  const apz = z - az;
  const side = adx * apz - adz * apx;
  if (side <= 0) {
    const w = barycentric(ax, az, dx, dz, bx, bz, x, z);
    return w.w * ha + w.u * hd + w.v * hb;
  }
  const w = barycentric(ax, az, cx, cz, dx, dz, x, z);
  return w.w * ha + w.u * hc + w.v * hd;
}

export function terrainCellIndices(width, height) {
  const indices = [];
  for (let j = 0; j < height - 1; j++) {
    for (let i = 0; i < width - 1; i++) {
      const a = j * width + i;
      const b = j * width + (i + 1);
      const c = (j + 1) * width + i;
      const d = (j + 1) * width + (i + 1);
      indices.push(a, d, b, a, c, d);
    }
  }
  return indices;
}

export function terrainPositions(terrain) {
  const { xM, zM, elevationsAboveMinM: elev } = terrain;
  const positions = new Float64Array(zM.length * xM.length * 3);
  let p = 0;
  for (let j = 0; j < zM.length; j++) {
    for (let i = 0; i < xM.length; i++) {
      positions[p++] = xM[i];
      positions[p++] = elev[j][i];
      positions[p++] = zM[j];
    }
  }
  return positions;
}

export function footprintSamplePoints(ring, terrain) {
  const open = openRing(ring);
  const pts = [];
  for (let i = 0; i < open.length; i++) {
    const a = open[i];
    const b = open[(i + 1) % open.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(len / SAMPLE_STEP_M));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      pts.push([a[0] + dx * t, a[1] + dz * t]);
    }
  }
  const { xM, zM } = terrain;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of open) {
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minZ) minZ = p[1];
    if (p[1] > maxZ) maxZ = p[1];
  }
  for (let j = 0; j < zM.length; j++) {
    if (zM[j] < minZ || zM[j] > maxZ) continue;
    for (let i = 0; i < xM.length; i++) {
      if (xM[i] < minX || xM[i] > maxX) continue;
      if (pointInRing(xM[i], zM[j], open)) pts.push([xM[i], zM[j]]);
    }
  }
  for (let x = minX; x <= maxX; x += SAMPLE_STEP_M) {
    for (let z = minZ; z <= maxZ; z += SAMPLE_STEP_M) {
      if (pointInRing(x, z, open)) pts.push([x, z]);
    }
  }
  return pts;
}

export function measureFootprint(ring, terrain) {
  const pts = footprintSamplePoints(ring, terrain);
  let maxTerrainY = -Infinity;
  let minTerrainY = Infinity;
  for (const [x, z] of pts) {
    const y = sampleTerrainY(terrain, x, z);
    if (y > maxTerrainY) maxTerrainY = y;
    if (y < minTerrainY) minTerrainY = y;
  }
  return {
    sampleCount: pts.length,
    maxTerrainY,
    minTerrainY,
    baseY: maxTerrainY + PLATFORM_LIFT_M,
    skirtBottomY: minTerrainY - SKIRT_DEPTH_M,
    heightM: SCHEMATIC_HEIGHT_M,
  };
}

export function ringCentroid(ring) {
  const open = openRing(ring);
  let x = 0;
  let z = 0;
  for (const p of open) {
    x += p[0];
    z += p[1];
  }
  return { x: x / open.length, z: z / open.length };
}
