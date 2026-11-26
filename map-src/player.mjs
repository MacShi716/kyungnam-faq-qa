/** First- and third-person player physics for the walk mode. No DOM, no Three.js. */

import { clampPitch, lookVector, sweptMove, wrapYaw } from "./walk.mjs";

export const WALK_SPEED_MPS = 4.2;
export const SPRINT_SPEED_MPS = 6.9;
export const GRAVITY_MPS2 = 20;
export const JUMP_SPEED_MPS = 6.2;
export const STEP_UP_M = 0.5;
export const THIRD_DISTANCE_M = 4.4;
export const VIEW_FIRST = "first";
export const VIEW_THIRD = "third";
export const MOUSE_SENSITIVITY = 0.0024;
export const LOOK_KEY_RPS = 1.6;
export const MAX_PITCH_UP = 1.05;
export const MAX_PITCH_DOWN = -1.05;
export const MAX_SUBSTEP_S = 0.05;

export function nextView(view) {
  return view === VIEW_THIRD ? VIEW_FIRST : VIEW_THIRD;
}

export function normalizeView(view) {
  return view === VIEW_THIRD ? VIEW_THIRD : VIEW_FIRST;
}

/** Eye point of the first-person camera. */
export function eyePoint(player) {
  return { x: player.x, y: player.y + player.eye, z: player.z };
}

/**
 * Camera spot behind the player's head along the view axis.
 * `target` is where the camera aims, `distance` is how far the boom reaches.
 */
export function thirdPersonRig(player, distance) {
  const boom = Math.max(1.2, distance == null ? THIRD_DISTANCE_M : distance);
  const look = lookVector(player.yaw, player.pitch);
  const headY = player.y + player.eye;
  return {
    position: {
      x: player.x - look.x * boom,
      y: headY - look.y * boom,
      z: player.z - look.z * boom,
    },
    target: {
      x: player.x + look.x * 12,
      y: headY + look.y * 12,
      z: player.z + look.z * 12,
    },
  };
}

/** Keyboard keys held at once become one normalised analogue axis pair. */
export function keyboardAxes(held) {
  let forward = 0;
  let strafe = 0;
  if (held && held.has("forward")) forward += 1;
  if (held && held.has("back")) forward -= 1;
  if (held && held.has("right")) strafe += 1;
  if (held && held.has("left")) strafe -= 1;
  const mag = Math.hypot(forward, strafe);
  if (!mag) return { forward: 0, strafe: 0, power: 0 };
  return { forward: forward / mag, strafe: strafe / mag, power: Math.min(1, mag) };
}

export function turnPlayer(player, yawDelta, pitchDelta) {
  player.yaw = wrapYaw(player.yaw + yawDelta);
  player.pitch = Math.max(MAX_PITCH_DOWN, Math.min(MAX_PITCH_UP, player.pitch + pitchDelta));
}

/**
 * Advance one frame. `world.ground(x, z)` returns the walkable height and
 * `world.blocked(nx, nz, px, pz)` reports a wall or a step that is too tall.
 * Long frames are split so speed and gravity stay frame-rate independent.
 */
export function stepPlayer(player, dt, input, world) {
  const total = Math.max(0, Math.min(0.25, dt || 0));
  const sens = input.sensitivity || MOUSE_SENSITIVITY;
  let turned = false;
  if (input.pointerDX || input.pointerDY) {
    turnPlayer(player, (input.pointerDX || 0) * sens, -(input.pointerDY || 0) * sens);
    turned = true;
  }
  const axes = input.axes || { forward: 0, strafe: 0, power: 0 };
  const speed = input.sprint ? SPRINT_SPEED_MPS : WALK_SPEED_MPS;
  let jumpPending = !!input.jump;
  let moved = 0;
  let remaining = total;
  while (remaining > 1e-6) {
    const step = Math.min(MAX_SUBSTEP_S, remaining);
    remaining -= step;
    if (axes.power > 0 && step > 0) {
      const distance = speed * axes.power * step;
      const dx = (Math.sin(player.yaw) * axes.forward + Math.cos(player.yaw) * axes.strafe) * distance;
      const dz = (-Math.cos(player.yaw) * axes.forward + Math.sin(player.yaw) * axes.strafe) * distance;
      const next = sweptMove(player.x, player.z, dx, dz, world.blocked);
      moved += Math.hypot(next.x - player.x, next.z - player.z);
      player.x = next.x;
      player.z = next.z;
    }
    const ground = world.ground(player.x, player.z);
    player.groundY = ground;
    if (jumpPending && player.grounded) {
      player.vy = JUMP_SPEED_MPS;
      player.grounded = false;
    }
    jumpPending = false;
    if (player.grounded) {
      const gap = ground - player.y;
      if (gap > STEP_UP_M) player.y = ground;
      else if (gap >= -0.12) player.y = ground;
      else {
        player.grounded = false;
        player.vy = 0;
      }
    }
    if (!player.grounded) {
      player.vy -= GRAVITY_MPS2 * step;
      player.y += player.vy * step;
      if (player.y <= ground) {
        player.y = ground;
        player.vy = 0;
        player.grounded = true;
      }
    }
  }
  return {
    moved,
    turned,
    grounded: player.grounded,
    speed: total > 0 ? moved / total : 0,
  };
}
