import assert from "node:assert/strict";
import test from "node:test";
import {
  NEUTRAL_OSM_IDS,
  RED_OSM_ID,
  buildingKind,
  materialSet,
  paintTokens,
  settleTint,
  terrainColor,
  wallPaint,
} from "../map-src/colors.mjs";
import { layoutLabelBoxes, measureLabel } from "../map-src/labels.mjs";

test("default tint is the natural campus and the ends match cool and warm", () => {
  const day = materialSet(0, "light");
  const night = materialSet(0, "dark");
  assert.equal(day.terrain, 0x6b8f5a);
  assert.equal(day.building, 0xd5d2cb);
  assert.equal(day.road, 0x5c6670);
  assert.equal(night.terrain, 0x2a3a2c);
  assert.equal(night.building, 0x6e7278);
  assert.notEqual(day.road, day.shoulder);
  assert.notEqual(day.road, day.terrain);
  assert.notEqual(day.building, day.foundation);
  const cool = materialSet(-1, "light");
  assert.equal(cool.terrain, 0x87949d);
  assert.equal(cool.building, 0xc6ccd1);
  assert.equal(cool.foundation, 0x929da6);
  assert.equal(cool.road, 0x455563);
  assert.equal(cool.shoulder, 0xa9b5bd);
  const warm = materialSet(1, "light");
  assert.equal(warm.terrain, 0xa39686);
  assert.equal(warm.building, 0xd4ccc4);
  assert.equal(warm.foundation, 0xb3a79b);
  assert.equal(warm.road, 0x5c534b);
  assert.equal(warm.shoulder, 0xc4b8ac);
  const nightCool = materialSet(-1, "dark");
  assert.equal(nightCool.terrain, 0x303d49);
  assert.equal(nightCool.building, 0x788895);
  assert.equal(nightCool.foundation, 0x596c7b);
  assert.equal(nightCool.road, 0x465a6b);
  assert.equal(nightCool.shoulder, 0x8596a3);
  const nightWarm = materialSet(1, "dark");
  assert.equal(nightWarm.terrain, 0x4a4038);
  assert.equal(nightWarm.building, 0x8a8076);
  assert.equal(nightWarm.foundation, 0x6b6057);
  assert.equal(nightWarm.road, 0x5a5249);
  assert.equal(nightWarm.shoulder, 0x9a8e82);
  assert.equal(settleTint(0.08), 0);
  assert.equal(settleTint(-0.08), 0);
  assert.equal(settleTint(0.4), 0.4);
  const lawn = terrainColor(0, "light", 0);
  assert.ok(lawn[1] > lawn[0]);
  assert.ok(lawn[1] > lawn[2]);
  const coolLawn = terrainColor(0, "light", -1);
  assert.ok(coolLawn[2] > coolLawn[0]);
  const warmLawn = terrainColor(0, "light", 1);
  assert.ok(warmLawn[0] > warmLawn[2]);
});

test("international design building is red and unnamed outlines stay neutral", () => {
  assert.equal(buildingKind(RED_OSM_ID, true), "red");
  assert.equal(buildingKind(1061923278, false), "neutral");
  assert.equal(buildingKind(1062071802, false), "neutral");
  assert.equal(buildingKind(1062063659, false), "neutral");
  assert.equal(buildingKind(1062064821, true), "mapped");
  assert.equal(wallPaint(1062073167, "crimson", 1, "light").mass, 0xc92a2a);
  assert.equal(wallPaint(1062064821, "limestone", -1, "light").mass, 0x9a5346);
  assert.equal(wallPaint(1062064821, "limestone", 0, "dark").mass, 0x5a322c);
  assert.equal(wallPaint(1061923278, "brick", 0, "light").mass, 0xd5d2cb);
  for (const id of NEUTRAL_OSM_IDS) assert.equal(buildingKind(id, false), "neutral");
  const red = paintTokens("red", RED_OSM_ID, "light", "idle");
  assert.equal(red.roof, 0xef4444);
  assert.equal(red.mass, 0xc92a2a);
  assert.equal(red.edge, 0xe03131);
  const redDark = paintTokens("red", RED_OSM_ID, "dark", "idle");
  assert.equal(redDark.roof, 0xef4444);
  assert.equal(redDark.mass, 0xc92a2a);
  const neutral = paintTokens("neutral", 1061923278, "light", "idle");
  assert.notEqual(neutral.roof, 0xef4444);
  assert.notEqual(neutral.mass, 0xc92a2a);
  const mapped = paintTokens("mapped", 1062064821, "light", "idle");
  assert.notEqual(mapped.roof, neutral.roof);
  assert.notEqual(mapped.mass, 0xc92a2a);
  assert.throws(() => paintTokens("neon", 1, "light", "idle"));
});

test("label collision keeps the red hub and drops overlaps", () => {
  const size = measureLabel("设计馆 · 留学生服务中心");
  assert.ok(size.w > 80 && size.h === 26);
  const bounds = { left: 0, top: 0, right: 400, bottom: 300 };
  const items = [
    { id: 1062073167, priority: 1, x: 120, y: 140, w: 160, h: 26, text: "设计馆 · 留学生服务中心", red: true },
    { id: 1062064821, priority: 2, x: 120, y: 140, w: 80, h: 26, text: "本馆", red: false },
    { id: 1062071979, priority: 3, x: 280, y: 80, w: 90, h: 26, text: "第二工学馆", red: false },
  ];
  const placed = layoutLabelBoxes(items, bounds, []);
  const ids = placed.map((box) => box.id);
  assert.ok(ids.includes(1062073167));
  assert.equal(ids.includes(1062064821), false);
  assert.ok(ids.includes(1062071979));
  const hidden = layoutLabelBoxes([
    { id: 9, priority: 3, x: -40, y: 40, w: 80, h: 26, text: "外", red: false },
  ], bounds, []);
  assert.equal(hidden.length, 0);
  const forced = layoutLabelBoxes([
    { id: 1062073167, priority: 1, x: -20, y: 20, w: 120, h: 26, text: "设计馆", red: true },
  ], bounds, []);
  assert.equal(forced.length, 1);
  assert.ok(forced[0].x >= bounds.left);
});
