import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import { blobMatchesQuery, entrySearchBlob } from "../map-src/search.mjs";

const poi = JSON.parse(fs.readFileSync(new URL("../assets/map/campus-poi-directory.json", import.meta.url), "utf8"));
const osm = JSON.parse(fs.readFileSync(new URL("../assets/map/osm-buildings.json", import.meta.url), "utf8"));

function sha(path) {
  return crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex");
}

test("protected map sources stay byte-identical", () => {
  const root = new URL("../", import.meta.url);
  assert.equal(sha(new URL("assets/map/osm-buildings.json", root)), "bcc2b4cb64ff281992e69d1c0f40da3f95a7ca2f32f0a2d364a6325b9693025d");
  assert.equal(sha(new URL("assets/map/campus-terrain.json", root)), "3161ef17ab6f06c19dc14bd7a73e5be6be4d5dabdc8e6cc33e6fad8b374f1409");
  assert.equal(sha(new URL("assets/map/COPERNICUS-LICENSE.txt", root)), "058dfc85eca8419acbe0595bc9a13eda9de0083599d41020cea8d5cd71a49350");
  assert.equal(sha(new URL("assets/map/DEM-NOTICE.txt", root)), "f025756f55de65c5335ef72ab7a9b9640c5af34edb35a9a2f0513552d55501b3");
  assert.equal(sha(new URL("assets/map/THREE-LICENSE.txt", root)), "8b378ebe60e2fe500158cb0ac71cb5e8b7d92953c2abcc63a0eb90499653b5bc");
  assert.equal(sha(new URL("THIRD_PARTY_NOTICES.md", root)), "e9335e5088b896806b3ab8c280e253205af06d275fcc5b68e89a90455e2f995c");
});

test("official floors enrich the directory without moving verified geometry", () => {
  assert.equal(poi.entries.length, 51);
  assert.equal(poi.entries.reduce((sum, entry) => sum + (entry.floors || []).length, 0), 68);
  assert.equal(poi.entries.filter((entry) => (entry.floors || []).length).length, 27);
  const original = poi.entries.filter((entry) => /^F(4[1-9]|5\d|6\d|7\d|8[0-6])$/.test(entry.faqId));
  const lines = original.map((entry) => [entry.faqId, entry.category, entry.spatialStatus, entry.nameZh, entry.nameKo, (entry.osmBuildingIds || []).join(".")].join("|"));
  assert.equal(crypto.createHash("sha256").update(lines.join("\n")).digest("hex"), "a6db06894830bc4b244974d3a83eb7ff024afc68e406c39feca6175f20721a9a");
  assert.equal(crypto.createHash("sha256").update(JSON.stringify(poi.generalMapFaqDraft)).digest("hex"), "6819840cfc368ded1bb51b900e5164e404f617abace91685cf5a3db85f03d297");
  assert.equal(crypto.createHash("sha256").update(JSON.stringify(poi.schematicBuildingDefaults)).digest("hex"), "ca5ada22294a94d54faca66fb954fcc7fa89f21905a1ef54eb3b5a6ba7319bfe");
  assert.deepEqual(poi.entries.find((entry) => entry.faqId === "F83").osmBuildingIds, []);
  assert.deepEqual(poi.entries.find((entry) => entry.faqId === "F86").osmBuildingIds, []);
  assert.equal(poi.entries.find((entry) => entry.faqId === "F86").highlightRole, "international-red");
  assert.equal(poi.entries.find((entry) => entry.faqId === "F76").highlightRole, "international-red");
  assert.equal(poi.entries.find((entry) => entry.faqId === "F85").highlightRole, "international-red");
  assert.deepEqual(poi.entries.find((entry) => entry.faqId === "F13").osmBuildingIds, [1062065374]);
  assert.deepEqual(poi.entries.find((entry) => entry.entryId === "POI-MUSEUM").osmBuildingIds, [1062065818]);
  assert.equal(poi.entries.some((entry) => (entry.osmBuildingIds || []).includes(1061923278)), false);
  assert.equal(poi.entries.find((entry) => entry.entryId === "OSM-1062071802").osmBuildingIds.length, 0);
  assert.equal(poi.entries.find((entry) => entry.entryId === "OSM-1062063659").osmBuildingIds.length, 0);
  const linked = new Set(poi.entries.flatMap((entry) => entry.osmBuildingIds || []));
  assert.equal(linked.size, 17);
  assert.equal(osm.buildings.length, 25);
});

test("floor and facility words find the verified building", () => {
  const hits = (query) => poi.entries.filter((entry) => blobMatchesQuery(entrySearchBlob(entry), query)).map((entry) => entry.faqId || entry.entryId);
  assert.ok(hits("留学生").includes("F85"));
  assert.ok(hits("国际处").includes("F86"));
  assert.ok(hits("阅览室").includes("F62"));
  assert.ok(hits("博物馆").includes("F69"));
  assert.ok(hits("博物馆").includes("POI-MUSEUM"));
  assert.ok(hits("食堂").includes("F66"));
  assert.ok(hits("打印").includes("F62"));
  assert.ok(hits("7层").includes("F76"));
  assert.ok(hits("1层").includes("F86"));
  assert.equal(hits("博物馆").includes("1061923278"), false);
});
