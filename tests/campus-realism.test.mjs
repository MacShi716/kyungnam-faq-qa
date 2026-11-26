import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createSmoothSampler, featureCounts, nearestClearance, placeTrees } from "../map-src/dressing.mjs";
import { getElevationAt } from "../map-src/placement.mjs";
import { directoryRank, displayTitle, faqButtonLabel, officialLinkLabel } from "../map-src/present.mjs";
import { extractHttpUrl } from "../map-src/linkify.mjs";

const terrain = JSON.parse(fs.readFileSync(new URL("../assets/map/campus-terrain.json", import.meta.url), "utf8"));
const osm = JSON.parse(fs.readFileSync(new URL("../assets/map/osm-buildings.json", import.meta.url), "utf8"));
const poi = JSON.parse(fs.readFileSync(new URL("../assets/map/campus-poi-directory.json", import.meta.url), "utf8"));
const layers = JSON.parse(fs.readFileSync(new URL("../assets/map/osm-campus-layers.json", import.meta.url), "utf8"));

test("osm campus layers stay pure ODbL and match the audited counts", () => {
  assert.equal(layers.license, "ODbL-1.0");
  assert.equal(layers.attribution, "© OpenStreetMap contributors");
  assert.deepEqual(featureCounts(layers), { roads: 81, paths: 6, water: 1, pitches: 18, woods: 3 });
  const raw = JSON.stringify(layers);
  assert.equal(raw.includes("faqId"), false);
  assert.equal(raw.includes("campus-poi"), false);
  assert.equal(JSON.stringify(poi).includes("elevationsAboveMinM"), false);
  assert.equal(layers.roads[0].points[0].length, 2);
});

test("smooth sampler stays near the Copernicus grid", () => {
  const smooth = createSmoothSampler(terrain);
  const x = terrain.xM[8];
  const z = terrain.zM[10];
  const linear = getElevationAt(terrain, x, z);
  assert.ok(Math.abs(smooth(x, z) - linear) < 0.8);
  const mid = smooth((terrain.xM[8] + terrain.xM[9]) / 2, (terrain.zM[10] + terrain.zM[11]) / 2);
  assert.ok(Number.isFinite(mid));
});

test("hillside trees clear buildings, roads, pitches, and water", () => {
  const trees = placeTrees({ terrain, buildings: osm.buildings, layers });
  assert.ok(trees.length >= 40 && trees.length <= 480);
  assert.ok(trees.every((tree) => tree.zone === "wood" || tree.zone === "park" || tree.zone === "shore"));
  assert.ok(trees.some((tree) => tree.zone === "wood"));
  assert.ok(trees.some((tree) => tree.zone === "shore"));
  const gap = nearestClearance(trees, osm.buildings, {
    ...layers,
    pitches: (layers.pitches || []).filter((feature) => feature.subtype !== "park"),
    water: [],
  });
  assert.ok(gap >= 7.5, String(gap));
  assert.equal(new Set(trees.map((tree) => `${tree.x.toFixed(2)},${tree.z.toFixed(2)}`)).size, trees.length);
});

test("directory titles and official links stay specific", () => {
  const address = poi.entries.find((entry) => entry.faqId === "F41");
  assert.equal(displayTitle(address, "zh"), "庆南大学（地址与总机）");
  assert.equal(displayTitle(address, "ko"), "경남대학교 (주소·대표전화)");
  assert.ok(directoryRank(address) > directoryRank(poi.entries.find((entry) => entry.faqId === "F49")));
  const design = poi.entries.find((entry) => entry.faqId === "F76");
  const hub = poi.entries.find((entry) => entry.faqId === "F85");
  assert.equal(faqButtonLabel(design, "zh"), "FAQ：设计馆");
  assert.equal(faqButtonLabel(hub, "zh"), "FAQ：留学生服务中心");
  const generic = { url: "https://www.kyungnam.ac.kr/ko/4218/subview.do", labelZh: "官方说明", labelKo: "공식 안내" };
  const label = officialLinkLabel(generic, address, "zh");
  assert.equal(label.includes("官方说明"), false);
  assert.match(label, /交通指南/);
});

test("F23 link capture stops before Chinese punctuation", () => {
  const sentence = "选课网址为 https://sugang.kyungnam.ac.kr，预选课篮子申请等在“课程管理”菜单中办理。";
  const href = extractHttpUrl(sentence);
  assert.equal(href, "https://sugang.kyungnam.ac.kr");
  assert.equal(href.includes("xn--"), false);
  assert.equal(/[^\x00-\x7F]/.test(href), false);
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /https\?:\\\/\\\/\[A-Za-z0-9\]/);
});
