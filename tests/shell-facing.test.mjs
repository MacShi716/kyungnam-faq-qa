import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { pointInRing } from "../map-src/placement.mjs";
import { footprintShell } from "../map-src/scene-dress.mjs";

const osm = JSON.parse(fs.readFileSync(new URL("../assets/map/osm-buildings.json", import.meta.url), "utf8"));

function triangles(pos) {
  const out = [];
  for (let i = 0; i < pos.length; i += 9) {
    const ax = pos[i];
    const ay = pos[i + 1];
    const az = pos[i + 2];
    const bx = pos[i + 3];
    const by = pos[i + 4];
    const bz = pos[i + 5];
    const cx = pos[i + 6];
    const cy = pos[i + 7];
    const cz = pos[i + 8];
    const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
    const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-5) continue;
    out.push({
      nx: nx / len,
      ny: ny / len,
      nz: nz / len,
      x: (ax + bx + cx) / 3,
      y: (ay + by + cy) / 3,
      z: (az + bz + cz) / 3,
    });
  }
  return out;
}

function assertOutside(tris, ring, label) {
  for (const tri of tris) {
    const out = pointInRing(tri.x + tri.nx * 0.3, tri.z + tri.nz * 0.3, ring);
    const inn = pointInRing(tri.x - tri.nx * 0.3, tri.z - tri.nz * 0.3, ring);
    assert.equal(out, false, `${label} normal leaves the footprint`);
    assert.equal(inn, true, `${label} backface stays inside`);
    assert.ok(Math.abs(tri.ny) < 0.25, `${label} wall stays vertical`);
  }
}

test("every campus shell faces outward and roofs face up", () => {
  assert.equal(osm.buildings.length, 25);
  for (const building of osm.buildings) {
    const before = building.footprintXZ[0].slice();
    const built = footprintShell(building.footprintXZ, { baseY: 10, roofY: 24, skirtBottomY: 4 });
    assert.deepEqual(building.footprintXZ[0], before);
    const id = String(building.osmId);
    assert.ok(built.walls.pos.length >= 9, id);
    assertOutside(triangles(built.walls.pos), built.open, id + " wall");
    assertOutside(triangles(built.skirt.pos), built.open, id + " skirt");
    assertOutside(triangles(built.parapetOuter.pos), built.open, id + " parapet");
    for (const tri of triangles(built.parapetInner.pos)) {
      assert.equal(pointInRing(tri.x + tri.nx * 0.2, tri.z + tri.nz * 0.2, built.inner), true, id + " inner parapet");
      assert.ok(Math.abs(tri.ny) < 0.25, id);
    }
    for (const tri of triangles(built.parapetTop.pos)) {
      assert.ok(tri.ny > 0.5, id + " parapet top " + tri.ny);
    }
    const roof = triangles(built.gravel.pos);
    assert.ok(roof.length >= 1, id);
    for (const tri of roof) assert.ok(tri.ny > 0.5, id + " roof " + tri.ny);
  }
});
