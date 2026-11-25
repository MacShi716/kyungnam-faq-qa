import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createSmoothSampler } from "../map-src/dressing.mjs";
import { HAZE_DENSITY, linearDepthSteps, roadCrossSection } from "../map-src/ground.mjs";
import { sampleTerrainY } from "../map-src/placement.mjs";

test("an 8cm curb stacked under the road is unresolved on 16-bit depth", () => {
  const steps = linearDepthSteps({
    near: 0.5,
    far: 5000,
    distance: 250,
    separation: 0.08,
    bits: 16,
  });
  assert.ok(steps < 1, String(steps));
});

test("curb shoulders stay beside the asphalt with a gap", () => {
  for (const width of [2.2, 4, 6.5, 11]) {
    const section = roadCrossSection(width);
    const roadEdge = section.road / 2;
    const shoulderInner = section.lateral - section.shoulder / 2;
    const shoulderOuter = section.lateral + section.shoulder / 2;
    assert.ok(shoulderInner >= roadEdge + 0.05, JSON.stringify(section));
    assert.ok(shoulderOuter <= section.full / 2 + section.gap + 0.001, JSON.stringify(section));
    assert.ok(section.shoulder >= 0.2, JSON.stringify(section));
  }
});

test("overview haze keeps most surface color inside 800m", () => {
  assert.ok(Math.exp(-HAZE_DENSITY.light * 800) >= 0.78);
  assert.ok(Math.exp(-HAZE_DENSITY.dark * 800) >= 0.72);
  assert.ok(HAZE_DENSITY.light < 0.0005);
});

test("the drawn hillside rises more than walk eye-height above the linear DEM", () => {
  const terrain = JSON.parse(fs.readFileSync(new URL("../assets/map/campus-terrain.json", import.meta.url), "utf8"));
  const smooth = createSmoothSampler(terrain);
  const x = -165.05;
  const z = 460.65;
  const gap = smooth(x, z) - sampleTerrainY(terrain, x, z);
  assert.ok(gap > 1.7, String(gap));
});

test("walk feet follow the rendered smooth surface", () => {
  const src = fs.readFileSync(new URL("../map-src/campus-map.js", import.meta.url), "utf8");
  assert.match(src, /function surfaceY/);
  assert.match(src, /walk\.y = surfaceY\(shell, x, z\)/);
  assert.match(src, /ground: \(x, z\) => surfaceY\(shell, x, z\)/);
  assert.match(src, /walk\.eyeY = walk\.y \+ EYE_M/);
});

test("ground materials no longer use a slope polygon offset", () => {
  const src = fs.readFileSync(new URL("../map-src/scene-dress.mjs", import.meta.url), "utf8");
  assert.equal(src.includes("polygonOffset: true"), false);
  assert.equal(src.includes("polygonOffsetFactor: -2"), false);
  assert.match(src, /roadCrossSection/);
  const map = fs.readFileSync(new URL("../map-src/campus-map.js", import.meta.url), "utf8");
  assert.match(map, /logarithmicDepthBuffer:\s*true/);
});
