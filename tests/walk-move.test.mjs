import assert from "node:assert/strict";
import test from "node:test";
import { pointInRing } from "../map-src/placement.mjs";
import { readFileSync } from "node:fs";
import {
  EYE_M,
  LOOK_TAP,
  WALK_TAP_M,
  applyWalkAction,
  chooseFacadeStand,
  footprintBlocked,
  lookVector,
  outsideStand,
  poseFrom,
  slideMove,
  yawFromDirection,
} from "../map-src/walk.mjs";

const SQUARE = [[0, 0], [10, 0], [10, 10], [0, 10]];

test("north looks along -Z and a step leaves the orbit spot", () => {
  assert.equal(yawFromDirection(0, -1), 0);
  const look = lookVector(0, 0);
  assert.ok(Math.abs(look.x) < 1e-9);
  assert.ok(look.z < -0.99);
  const state = { x: 40, z: 80, yaw: 0, pitch: 0 };
  const before = poseFrom(state, 30 + EYE_M);
  applyWalkAction(state, "forward", WALK_TAP_M, () => false);
  const after = poseFrom(state, 30 + EYE_M);
  assert.ok(Math.hypot(after.x - before.x, after.z - before.z) > 5);
  assert.ok(after.z < before.z);
  assert.ok(Math.abs(after.y - (30 + EYE_M)) < 1e-9);
});

test("walk slides along a footprint instead of entering it", () => {
  const blocked = (x, z) => footprintBlocked(x, z, [SQUARE], 1.1);
  const next = slideMove(5, 16, 0, "forward", 30, blocked);
  assert.equal(pointInRing(next.x, next.z, SQUARE), false);
  assert.ok(next.z > 11);
  assert.ok(next.z < 16);
});

test("a building start stands outside the footprint, facing it", () => {
  const centroid = { x: 5, z: 5 };
  const blocked = (x, z) => footprintBlocked(x, z, [SQUARE], 1.2);
  const stand = outsideStand(centroid, 5, 40, blocked);
  assert.equal(pointInRing(stand.x, stand.z, SQUARE), false);
  assert.equal(blocked(stand.x, stand.z), false);
  const state = {
    x: stand.x,
    z: stand.z,
    yaw: yawFromDirection(centroid.x - stand.x, centroid.z - stand.z),
    pitch: -0.2,
  };
  const pose = poseFrom(state, 12);
  const towardX = pose.lookX - pose.x;
  const towardZ = pose.lookZ - pose.z;
  const aimX = centroid.x - stand.x;
  const aimZ = centroid.z - stand.z;
  const dot = towardX * aimX + towardZ * aimZ;
  assert.ok(dot > 0);
  applyWalkAction(state, "look-right", LOOK_TAP, blocked);
  assert.notEqual(state.yaw, yawFromDirection(aimX, aimZ));
  const backed = outsideStand(centroid, 5, 40, blocked, 10);
  assert.equal(blocked(backed.x, backed.z), false);
  assert.ok(Math.hypot(backed.x - stand.x, backed.z - stand.z) > 8);
  assert.ok(Math.hypot(backed.x - stand.x, backed.z - stand.z) < 12);
});

test("본관 stand still sees the facade after forward, left, forward", () => {
  const osm = JSON.parse(readFileSync(new URL("../assets/map/osm-buildings.json", import.meta.url), "utf8"));
  const hall = osm.buildings.find((item) => item.osmId === 1062064821);
  const ring = hall.footprintXZ;
  const blocked = (x, z) => footprintBlocked(x, z, [ring], 1.15);
  const stand = chooseFacadeStand(ring, blocked);
  assert.ok(stand, "a vantage exists");
  assert.equal(blocked(stand.x, stand.z), false);
  const state = { x: stand.x, z: stand.z, yaw: stand.yaw, pitch: stand.pitch };
  for (const [action, amount] of [["forward", WALK_TAP_M], ["look-left", LOOK_TAP], ["forward", WALK_TAP_M]]) {
    applyWalkAction(state, action, amount, blocked);
    assert.equal(blocked(state.x, state.z), false);
  }
  assert.ok(Math.hypot(state.x - stand.x, state.z - stand.z) > 8);
});
