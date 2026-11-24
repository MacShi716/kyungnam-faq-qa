import assert from "node:assert/strict";
import test from "node:test";
import {
  NEUTRAL_OSM_IDS,
  RED_OSM_ID,
  buildingKind,
  paintTokens,
  terrainColor,
} from "../map-src/colors.mjs";
import { layoutLabelBoxes, measureLabel } from "../map-src/labels.mjs";

function chroma(rgb) {
  return Math.max(...rgb) - Math.min(...rgb);
}

test("hillside colors leave greyscale and stay in palette", () => {
  const lawn = terrainColor(0, "light");
  const ridge = terrainColor(1, "light");
  assert.ok(lawn[1] > lawn[0] && lawn[1] > lawn[2]);
  assert.ok(chroma(lawn) > 0.15);
  assert.ok(chroma(ridge) > 0.08);
  assert.ok(ridge[1] < lawn[1]);
  const nightLow = terrainColor(0, "dark");
  const nightHigh = terrainColor(1, "dark");
  assert.ok(nightLow[2] > nightLow[0] && nightLow[1] > nightLow[0]);
  assert.ok(chroma(nightLow) > 0.08);
  assert.ok(chroma(nightHigh) > 0.1);
  assert.ok(nightHigh[2] > nightHigh[1]);
  const mid = terrainColor(0.4, "light");
  assert.ok(mid[1] > mid[0]);
});

test("international design building is red and unnamed outlines stay neutral", () => {
  assert.equal(buildingKind(RED_OSM_ID, true), "red");
  assert.equal(buildingKind(1061923278, false), "neutral");
  assert.equal(buildingKind(1062071802, false), "neutral");
  assert.equal(buildingKind(1062063659, false), "neutral");
  assert.equal(buildingKind(1062064821, true), "mapped");
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
