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
