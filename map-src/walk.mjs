/** Ground-level walk maths. No DOM, no Three.js. +X east, +Z south, yaw 0 looks north (-Z). */

import { pointInRing } from "./placement.mjs";

export const EYE_M = 1.7;
export const WALK_TAP_M = 7;
export const WALK_HOLD_MPS = 22;
export const LOOK_TAP = 0.42;
export const LOOK_HOLD_RPS = 1.35;

export function wrapYaw(yaw) {
  const turn = Math.PI * 2;
  return yaw - Math.floor((yaw + Math.PI) / turn) * turn;
}

export function clampPitch(pitch) {
  return Math.max(-1.05, Math.min(0.85, pitch));
}

export function yawFromDirection(dx, dz) {
  return Math.atan2(dx, -dz);
}

export function lookVector(yaw, pitch) {
  const cp = Math.cos(pitch);
  return { x: Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp };
}

export function poseFrom(state, eyeY) {
  const look = lookVector(state.yaw, state.pitch);
  return {
    x: state.x,
    y: eyeY,
    z: state.z,
    lookX: state.x + look.x * 30,
    lookY: eyeY + look.y * 30,
    lookZ: state.z + look.z * 30,
  };
}

export function moveVector(yaw, action) {
  const fx = Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = Math.sin(yaw);
  if (action === "forward") return { x: fx, z: fz };
  if (action === "back") return { x: -fx, z: -fz };
  if (action === "right") return { x: rx, z: rz };
  if (action === "left") return { x: -rx, z: -rz };
  return { x: 0, z: 0 };
}

export function slideMove(x, z, yaw, action, distance, blocked) {
  const v = moveVector(yaw, action);
  const steps = Math.max(1, Math.ceil(Math.abs(distance) / 0.35));
  const sx = (v.x * distance) / steps;
  const sz = (v.z * distance) / steps;
  let cx = x;
  let cz = z;
  for (let i = 0; i < steps; i++) {
    const nx = cx + sx;
    const nz = cz + sz;
    if (!blocked(nx, nz)) {
      cx = nx;
      cz = nz;
      continue;
    }
    if (!blocked(nx, cz)) {
      cx = nx;
      continue;
    }
    if (!blocked(cx, nz)) {
      cz = nz;
      continue;
    }
    break;
  }
  return { x: cx, z: cz };
}

function angDiff(from, to) {
  return wrapYaw(to - from);
}

function ringOpen(ring) {
  const out = ring.map((p) => [p[0], p[1]]);
  if (out.length > 1) {
    const a = out[0];
    const b = out[out.length - 1];
    if (a[0] === b[0] && a[1] === b[1]) out.pop();
  }
  return out;
}

function gapToRing(x, z, ring) {
  if (pointInRing(x, z, ring)) return 0;
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len2 = dx * dx + dz * dz;
    let t = len2 < 1e-8 ? 0 : ((x - a[0]) * dx + (z - a[1]) * dz) / len2;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
    if (d < best) best = d;
  }
  return best;
}

function seesFacade(x, z, yaw, ring, half) {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const mx = (a[0] + b[0]) / 2;
    const mz = (a[1] + b[1]) / 2;
    const bearing = yawFromDirection(mx - x, mz - z);
    const dist = Math.hypot(mx - x, mz - z);
    if (dist > 6 && dist < 96 && Math.abs(angDiff(yaw, bearing)) < half) return true;
  }
  return false;
}

function groundAhead(x, z, yaw, ring) {
  const look = lookVector(yaw, 0);
  const px = x + look.x * 14;
  const pz = z + look.z * 14;
  return gapToRing(px, pz, ring) > 3;
}

/**
 * Stand outside a footprint so forward, a left turn, and forward again
 * still see the facade with open ground ahead. Pitch stays near level.
 */
export function chooseFacadeStand(ring, blocked) {
  const open = ringOpen(ring);
  if (open.length < 3) return null;
  let cx = 0;
  let cz = 0;
  for (const p of open) {
    cx += p[0];
    cz += p[1];
  }
  cx /= open.length;
  cz /= open.length;
  const half = 0.34;
  const pitch = 0.06;
  let best = null;
  for (let i = 0; i < open.length; i++) {
    const a = open[i];
    const b = open[(i + 1) % open.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    if (len < 8) continue;
    let ox = dz / len;
    let oz = -dx / len;
    const mx = (a[0] + b[0]) / 2;
    const mz = (a[1] + b[1]) / 2;
    if (pointInRing(mx + ox * 3, mz + oz * 3, open)) {
      ox = -ox;
      oz = -oz;
    }
    const face = yawFromDirection(-ox, -oz);
    const along = yawFromDirection(dx, dz);
    const back = wrapYaw(along + Math.PI);
    const yaws = [
      face,
      wrapYaw(along + Math.max(-0.28, Math.min(0.28, angDiff(along, face)))),
      wrapYaw(back + Math.max(-0.28, Math.min(0.28, angDiff(back, face)))),
    ];
    for (const dist of [22, 30, 38]) {
      const x = mx + ox * dist;
      const z = mz + oz * dist;
      if (blocked(x, z)) continue;
      if (Math.hypot(x - cx, z - cz) > 76) continue;
      if (gapToRing(x, z, open) < 12) continue;
      for (const yaw of yaws) {
        const state = { x, z, yaw, pitch };
        if (!seesFacade(x, z, yaw, open, half) || !groundAhead(x, z, yaw, open)) continue;
        let minGap = gapToRing(x, z, open);
        let ok = true;
        for (const [action, amount] of [["forward", 7], ["look-left", 0.42], ["forward", 7]]) {
          applyWalkAction(state, action, amount, blocked);
          const gap = gapToRing(state.x, state.z, open);
          if (gap < minGap) minGap = gap;
          if (gap < 12 || !seesFacade(state.x, state.z, state.yaw, open, half) || !groundAhead(state.x, state.z, state.yaw, open)) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        const side = { x, z, yaw, pitch };
        for (const action of ["back", "left", "right"]) {
          applyWalkAction(side, action, 7, blocked);
          if (gapToRing(side.x, side.z, open) < 8) ok = false;
          side.x = x;
          side.z = z;
          side.yaw = yaw;
        }
        if (!ok) continue;
        if (!best || minGap > best.gap) best = { x, z, yaw, pitch, gap: minGap };
      }
    }
  }
  return best;
}

export function outsideStand(centroid, preferX, preferZ, blocked, beyond = 0) {
  const extra = Math.max(0, beyond || 0);
  const seeds = [];
  const dx = preferX - centroid.x;
  const dz = preferZ - centroid.z;
  if (Math.hypot(dx, dz) >= 0.5) seeds.push([dx, dz]);
  seeds.push([0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]);
  for (const [rx, rz] of seeds) {
    const len = Math.hypot(rx, rz) || 1;
    const ux = rx / len;
    const uz = rz / len;
    let first = 0;
    for (let d = 4; d <= 96; d += 1.25) {
      const x = centroid.x + ux * d;
      const z = centroid.z + uz * d;
      if (blocked(x, z)) continue;
      first = d;
      break;
    }
    if (!first) continue;
    for (let d = Math.min(96, first + extra); d >= first - 0.01; d -= 1.25) {
      const x = centroid.x + ux * d;
      const z = centroid.z + uz * d;
      if (!blocked(x, z)) return { x, z };
    }
  }
  return { x: centroid.x + 28, z: centroid.z + 28 };
}

export function applyWalkAction(state, action, amount, blocked) {
  if (action === "forward" || action === "back" || action === "left" || action === "right") {
    const next = slideMove(state.x, state.z, state.yaw, action, amount, blocked);
    const moved = next.x !== state.x || next.z !== state.z;
    state.x = next.x;
    state.z = next.z;
    return moved;
  }
  if (action === "look-left") state.yaw = wrapYaw(state.yaw - amount);
  else if (action === "look-right") state.yaw = wrapYaw(state.yaw + amount);
  else if (action === "look-up") state.pitch = clampPitch(state.pitch + amount);
  else if (action === "look-down") state.pitch = clampPitch(state.pitch - amount);
  else return false;
  return true;
}

export function footprintBlocked(x, z, rings, radius) {
  const pad = radius || 0;
  const samples = pad > 0
    ? [[0, 0], [pad, 0], [-pad, 0], [0, pad], [0, -pad], [pad, pad], [-pad, pad], [pad, -pad], [-pad, -pad]]
    : [[0, 0]];
  for (const ring of rings) {
    for (const [ox, oz] of samples) {
      if (pointInRing(x + ox, z + oz, ring)) return true;
    }
  }
  return false;
}
