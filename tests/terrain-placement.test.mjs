import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  SKIRT_DEPTH_M,
  PLATFORM_LIFT_M,
  measureFootprint,
  sampleTerrainY,
  terrainCellIndices,
  triangulateXZ,
} from "../map-src/placement.mjs";

const osm = JSON.parse(fs.readFileSync(new URL("../assets/map/osm-buildings.json", import.meta.url), "utf8"));
const terrain = JSON.parse(fs.readFileSync(new URL("../assets/map/campus-terrain.json", import.meta.url), "utf8"));
const poi = JSON.parse(fs.readFileSync(new URL("../assets/map/campus-poi-directory.json", import.meta.url), "utf8"));

test("source files stay isolated", () => {
  const osmText = JSON.stringify(osm);
  const terrainText = JSON.stringify(terrain);
  const poiText = JSON.stringify(poi);
  assert.equal(osmText.includes("elevationsAboveMinM"), false);
  assert.equal(osmText.includes("minElevationM"), false);
  assert.equal(terrainText.includes("footprintXZ"), false);
  assert.equal(terrainText.includes("osmId"), false);
  assert.equal(poiText.includes("elevationsAboveMinM"), false);
  assert.equal(poiText.includes("footprintXZ"), false);
  assert.equal(osm.buildings.length, 25);
  assert.equal(terrain.width, 32);
  assert.equal(terrain.height, 36);
  assert.equal(poi.entries.length, 51);
  assert.equal(poi.entries.filter((e) => e.osmBuildingIds.length).length, 19);
});

test("terrain mesh uses NW-SE triangles and relative elevations", () => {
  const indices = terrainCellIndices(terrain.width, terrain.height);
  const width = terrain.width;
  assert.equal(indices.length, (terrain.width - 1) * (terrain.height - 1) * 6);
  assert.deepEqual(indices.slice(0, 6), [0, width + 1, 1, 0, width, width + 1]);
  const j = 4;
  const i = 6;
  const ax = terrain.xM[i];
  const az = terrain.zM[j];
  const ha = terrain.elevationsAboveMinM[j][i];
  const hb = terrain.elevationsAboveMinM[j][i + 1];
  const hc = terrain.elevationsAboveMinM[j + 1][i];
  const hd = terrain.elevationsAboveMinM[j + 1][i + 1];
  assert.equal(sampleTerrainY(terrain, ax, az), ha);
  assert.equal(sampleTerrainY(terrain, terrain.xM[i + 1], az), hb);
  assert.equal(sampleTerrainY(terrain, ax, terrain.zM[j + 1]), hc);
  const midX = (ax + terrain.xM[i + 1]) / 2;
  const midZ = (az + terrain.zM[j + 1]) / 2;
  assert.ok(Math.abs(sampleTerrainY(terrain, midX, midZ) - (ha + hd) / 2) < 1e-6);
  const northX = ax + (terrain.xM[i + 1] - ax) * 0.72;
  const northZ = az + (terrain.zM[j + 1] - az) * 0.12;
  const adx = terrain.xM[i + 1] - ax;
  const adz = terrain.zM[j + 1] - az;
  const side = adx * (northZ - az) - adz * (northX - ax);
  assert.ok(side < 0, "sample sits in triangle [a,d,b]");
  const expected = ha * 0.28 + hb * 0.6 + hd * 0.12;
  const got = sampleTerrainY(terrain, northX, northZ);
  assert.ok(Math.abs(got - expected) < 0.05, `${got} vs ${expected}`);
  assert.ok(got > ha - 30);
  assert.equal(terrain.minElevationM, 3);
  assert.notEqual(sampleTerrainY(terrain, ax, az), ha - terrain.minElevationM);
});

test("all 25 buildings sit on the slope with skirts below the footprint", () => {
  assert.equal(osm.buildings.length, 25);
  for (const building of osm.buildings) {
    const tris = triangulateXZ(building.footprintXZ);
    assert.ok(tris.length >= 3, String(building.osmId));
    const seat = measureFootprint(building.footprintXZ, terrain);
    assert.ok(Number.isFinite(seat.maxTerrainY), String(building.osmId));
    assert.ok(Number.isFinite(seat.minTerrainY), String(building.osmId));
    assert.ok(seat.sampleCount > building.footprintXZ.length, String(building.osmId));
    assert.ok(seat.baseY >= seat.maxTerrainY, String(building.osmId));
    assert.equal(seat.baseY, seat.maxTerrainY + PLATFORM_LIFT_M);
    assert.ok(seat.skirtBottomY < seat.minTerrainY, String(building.osmId));
    assert.equal(seat.skirtBottomY, seat.minTerrainY - SKIRT_DEPTH_M);
    assert.ok(seat.maxTerrainY - seat.minTerrainY < 80, String(building.osmId));
  }
});
