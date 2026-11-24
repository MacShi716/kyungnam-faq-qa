import fs from "node:fs";

const poiPath = new URL("../assets/map/campus-poi-directory.json", import.meta.url);
const officialPath = process.argv[2];
if (!officialPath) {
  console.error("usage: node scripts/merge-official-poi.mjs <official-building-details.json>");
  process.exit(1);
}

const poi = JSON.parse(fs.readFileSync(poiPath, "utf8"));
const official = JSON.parse(fs.readFileSync(officialPath, "utf8"));
const byFaq = new Map(official.entries.filter((entry) => entry.faqId).map((entry) => [entry.faqId, entry]));

const ENRICH = [
  "mapNumber",
  "summaryZh",
  "summaryKo",
  "facilitiesZh",
  "facilitiesKo",
  "phones",
  "hoursZh",
  "hoursKo",
  "officialUrls",
  "highlightRole",
  "floors",
  "floorGuideStatus",
  "floorCoverageNoteZh",
  "floorCoverageNoteKo",
  "verificationLevel",
  "sourceCheckedAt",
  "hostBuildingZh",
  "hostBuildingKo",
  "officialFloorSourcePageLastModified",
  "dataCautionsZh",
  "floorVerifiedByOfficialPage",
  "floorStatus",
  "mapNumberRefersTo",
  "claimedFloor",
  "floorVerificationUrl",
];

function copyEnrich(target, source) {
  for (const key of ENRICH) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== "") target[key] = source[key];
  }
  target.entryId = source.id;
  target.labelZh = source.nameZh;
  target.labelKo = source.nameKo;
  if (!target.highlightRole) target.highlightRole = "normal";
  const urls = new Set([...(target.sourceUrls || []), ...(source.sourceUrls || [])]);
  target.sourceUrls = [...urls];
}

for (const entry of poi.entries) {
  const source = byFaq.get(entry.faqId);
  if (!source) continue;
  copyEnrich(entry, source);
  if (entry.faqId === "F85" || entry.faqId === "F86") {
    entry.displayWarningZh = "请以现场或官网最新指引为准（官网 ko/6382 页面日期 2021-08-30）。";
    entry.displayWarningKo = "현장 또는 학교 공식 최신 안내 기준 확인 필요 (공식 ko/6382 페이지 날짜 2021-08-30).";
  }
}

const EXTRA = {
  "BUILDING-ENGINEERING-1": { faqId: "F13", category: "academic" },
  "POI-MUSEUM": { faqId: "", category: "landmark" },
  "BUILDING-INDUSTRY-ACADEMY": { faqId: "", category: "academic" },
  "OSM-1062071802": { faqId: "", category: "landmark" },
  "OSM-1062063659": { faqId: "", category: "landmark" },
};

function insertEntry(entry) {
  if (typeof entry.mapNumber !== "number") {
    poi.entries.push(entry);
    return;
  }
  const index = poi.entries.findIndex((item) => typeof item.mapNumber === "number" && item.mapNumber > entry.mapNumber);
  if (index < 0) poi.entries.push(entry);
  else poi.entries.splice(index, 0, entry);
}

for (const source of official.entries) {
  const extra = EXTRA[source.id];
  if (!extra) continue;
  const osmBuildingIds = Array.isArray(source.osmBuildingIds) ? source.osmBuildingIds.slice() : [];
  const entry = {
    faqId: extra.faqId,
    entryId: source.id,
    nameKo: source.nameKo,
    nameZh: source.nameZh,
    labelKo: source.nameKo,
    labelZh: source.nameZh,
    category: extra.category,
    osmBuildingIds,
    spatialStatus: osmBuildingIds.length ? "mapped" : "unmapped-text-only",
    positionXZ: null,
    sourceUrls: source.sourceUrls || [],
    sourceCheckedAt: source.sourceCheckedAt || "",
    textKo: source.summaryKo || "",
    textZh: source.summaryZh || "",
    provenance: "Official public kyungnam.ac.kr pages; geometry attached only where the audited OSM name link already existed",
  };
  copyEnrich(entry, source);
  insertEntry(entry);
}

fs.writeFileSync(poiPath, JSON.stringify(poi, null, 2) + "\n");
const floors = poi.entries.reduce((sum, entry) => sum + ((entry.floors || []).length), 0);
const withFloors = poi.entries.filter((entry) => (entry.floors || []).length).length;
console.log(`entries ${poi.entries.length} floorRecords ${floors} withFloors ${withFloors}`);
