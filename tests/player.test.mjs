import assert from "node:assert/strict";
import test from "node:test";
import {
  GRAVITY_MPS2,
  JUMP_SPEED_MPS,
  SPRINT_SPEED_MPS,
  VIEW_FIRST,
  VIEW_THIRD,
  WALK_SPEED_MPS,
  eyePoint,
  keyboardAxes,
  nextView,
  stepPlayer,
  thirdPersonRig,
  turnPlayer,
} from "../map-src/player.mjs";

const flat = (x, z) => {
  void x;
  void z;
  return 0;
};

function walker() {
  return {
    x: 0,
    z: 0,
    y: 0,
    vy: 0,
    grounded: true,
    groundY: 0,
    yaw: 0,
    pitch: 0,
    eye: 1.7,
  };
}

function world(blocked) {
  return { ground: flat, blocked: blocked || (() => false) };
}

test("space jumps, gravity pulls back, and the feet land on the ground", () => {
  const player = walker();
  const dt = 1 / 60;
  stepPlayer(player, dt, { axes: {}, jump: true }, world());
  assert.equal(player.grounded, false);
  assert.ok(player.vy > 0);
  let peak = player.y;
  for (let i = 0; i < 120 && !player.grounded; i++) {
    stepPlayer(player, dt, { axes: {} }, world());
    peak = Math.max(peak, player.y);
  }
  const expected = (JUMP_SPEED_MPS * JUMP_SPEED_MPS) / (2 * GRAVITY_MPS2);
  assert.ok(player.grounded, "lands again");
  assert.ok(Math.abs(player.y) < 1e-6, "feet return to ground");
  assert.ok(peak > expected * 0.7 && peak < expected * 1.3, String(peak));
});

test("holding forward walks at walk speed and sprint covers more ground", () => {
  const dt = 0.05;
  const walk = walker();
  stepPlayer(walk, dt, { axes: { forward: 1, strafe: 0, power: 1 } }, world());
  const walked = Math.hypot(walk.x, walk.z);
  assert.ok(Math.abs(walked - WALK_SPEED_MPS * dt) < 1e-6, String(walked));
  const run = walker();
  stepPlayer(run, dt, { axes: { forward: 1, strafe: 0, power: 1 }, sprint: true }, world());
  const ran = Math.hypot(run.x, run.z);
  assert.ok(ran > walked * 1.4 && ran < SPRINT_SPEED_MPS * dt + 1e-6, String(ran));
});

test("a wall stops the feet while the next axis still slides", () => {
  const player = walker();
  const dt = 0.05;
  const wall = (nx, nz) => nx > 2;
  for (let i = 0; i < 60; i++) {
    stepPlayer(player, dt, { axes: { forward: 1, strafe: 1, power: 1 } }, world(wall));
  }
  assert.ok(player.x <= 2.05, String(player.x));
  assert.ok(player.z < -0.5, "slides along the wall");
});

test("keyboard axes normalise a diagonal to the same speed as forward", () => {
  const straight = keyboardAxes(new Set(["forward"]));
  const diagonal = keyboardAxes(new Set(["forward", "right"]));
  assert.equal(straight.power, 1);
  assert.ok(Math.abs(diagonal.power - 1) < 1e-6);
  assert.ok(Math.abs(Math.hypot(diagonal.forward, diagonal.strafe) - 1) < 1e-6);
  assert.equal(keyboardAxes(new Set()).power, 0);
});

test("view toggles between first and third and the boom sits behind the head", () => {
  assert.equal(nextView(VIEW_FIRST), VIEW_THIRD);
  assert.equal(nextView(VIEW_THIRD), VIEW_FIRST);
  const player = walker();
  player.y = 10;
  const eye = eyePoint(player);
  assert.equal(eye.y, 11.7);
  const rig = thirdPersonRig(player, 4.4);
  assert.ok(rig.position.z > player.z, "camera sits behind a north-facing player");
  assert.ok(Math.abs(rig.position.y - (10 + 1.7)) < 1e-6);
  assert.ok(rig.target.z < player.z, "camera aims at the horizon ahead");
});

test("mouse deltas turn right and look down with the usual signs", () => {
  const player = walker();
  turnPlayer(player, 0.5, -0.2);
  assert.ok(Math.abs(player.yaw - 0.5) < 1e-9);
  assert.ok(Math.abs(player.pitch + 0.2) < 1e-9);
  turnPlayer(player, 0, 10);
  assert.ok(player.pitch <= 1.05);
  turnPlayer(player, 0, -10);
  assert.ok(player.pitch >= -1.05);
});
