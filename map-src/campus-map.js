import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  SCHEMATIC_HEIGHT_M,
  measureFootprint,
  openRing,
  ringCentroid,
  sampleTerrainY,
  terrainCellIndices,
  triangulateXZ,
} from "./placement.mjs";

const FAV_KEY = "campus_map_favorites";
const OFFICIAL_MAP = "https://inews.kyungnam.ac.kr/bbs/view.html?idxno=39517";
const OSM_COPYRIGHT = "https://www.openstreetmap.org/copyright";
const LEGAL_ATTRIBUTION = "produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.";
const LEGAL_LIABILITY = "The organisations in charge of the Copernicus programme by law or by delegation do not incur any liability for any use of the Copernicus WorldDEM-30.";

const TEXT = {
  zh: {
    close: "关闭", zoomIn: "放大", zoomOut: "缩小", reset: "回到全校", north: "正北复位",
    full: "全屏", fullExit: "退出全屏", directory: "目录", search: "搜索地点",
    privacy: "请勿输入学号、手机号等个人信息", clearFav: "清空收藏",
    storage: "仅保存在本机浏览器，公用设备请清空", fav: "收藏", favOn: "已收藏",
    viewFaq: "查看相关 FAQ", noFaq: "暂无对应 FAQ", textOnly: "文字地点",
    notice: "数据来源与许可", loading: "正在加载校园地图…",
    fallback: "当前环境无法显示 3D 模型。可以搜索地点列表，或打开官方校园地图。",
    schematic: "本图为示意图：地势来自约 30 米卫星地表模型（DSM），建筑平面来自 OpenStreetMap 轮廓，楼高为统一示意高度，不是实测地形、实测楼高，也不是导航路线。",
    summary: "地形高程使用 Copernicus WorldDEM-30 公开数据，只用于这张校园示意图。欧盟、ESA、DLR 与 Airbus 不对使用该数据承担责任，也不表示认可本页面。",
    officialMap: "庆南大学 2026 校园地图", ext: "外部官方链接", empty: "没有匹配的地点", phone: "电话",
    dialog: "庆南大学 3D 校园示意图",
    cats: { all: "全部", international: "国际服务", academic: "教学/行政", dining: "餐饮", dorm: "宿舍", other: "地标/其他", fav: "收藏" },
  },
  ko: {
    close: "닫기", zoomIn: "확대", zoomOut: "축소", reset: "전체 보기", north: "정북",
    full: "전체 화면", fullExit: "전체 화면 종료", directory: "목록", search: "장소 검색",
    privacy: "학번·전화번호 등 개인정보는 입력하지 마세요", clearFav: "즐겨찾기 비우기",
    storage: "이 브라우저에만 저장됩니다. 공용 기기에서는 비워 주세요", fav: "즐겨찾기", favOn: "즐겨찾기됨",
    viewFaq: "관련 FAQ 보기", noFaq: "연결된 FAQ 없음", textOnly: "텍스트 안내",
    notice: "데이터 출처 및 라이선스", loading: "캠퍼스맵을 불러오는 중…",
    fallback: "이 환경에서는 3D 모형을 표시할 수 없습니다. 장소 목록을 검색하거나 공식 캠퍼스맵을 여세요.",
    schematic: "이 화면은 모식도입니다. 지형은 약 30m 위성 표면모델(DSM)이고 건물 평면은 OpenStreetMap 윤곽이며 건물 높이는 동일한 예시 높이입니다. 측량 지형·높이 또는 길안내 경로가 아닙니다.",
    summary: "지형 고도는 Copernicus WorldDEM-30 공개 자료를 사용하며 이 캠퍼스 모식도에만 씁니다. EU, ESA, DLR, Airbus는 이 자료의 사용에 책임을 지지 않으며 이 페이지를 보증하거나 승인하지 않습니다.",
    officialMap: "경남대 2026 캠퍼스맵", ext: "외부 공식 링크", empty: "일치하는 장소가 없습니다", phone: "전화",
    dialog: "경남대학교 3D 캠퍼스 모식도",
    cats: { all: "전체", international: "국제 서비스", academic: "교육/행정", dining: "식당", dorm: "기숙사", other: "랜드마크/기타", fav: "즐겨찾기" },
  },
};

const CAT_ORDER = ["all", "international", "academic", "dining", "dorm", "other", "fav"];
const MAP_CSS = `
.map-modal{position:fixed;inset:0;z-index:40;width:100%;height:100dvh;max-width:100vw;box-sizing:border-box;overflow:hidden;background:var(--bg);color:var(--ink);font:inherit;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
.map-stage{position:relative;width:100%;height:100%;overflow:hidden}
.map-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
.map-fallback,.map-status{position:absolute;z-index:4;left:12px;right:12px;top:64px;margin:0;padding:12px 14px;border-radius:16px;background:var(--glass);border:1px solid var(--line);backdrop-filter:blur(16px)}
.map-toolbar,.map-directory,.map-info,.map-attrib,.map-float{position:absolute;z-index:8}
.map-toolbar{top:8px;left:8px;right:8px;display:flex;flex-wrap:wrap;gap:6px;max-width:100%}
.map-btn{min-height:44px;padding:0 12px;border-radius:999px;border:1px solid color-mix(in srgb,var(--rim) 42%,var(--line));background:var(--glass);color:var(--ink);font:inherit;font-weight:650;font-size:.86rem;cursor:pointer;backdrop-filter:blur(16px) saturate(1.3)}
.map-btn[aria-pressed="true"]{background:var(--pressed-bg);box-shadow:inset 0 0 0 1px var(--rim)}
.map-btn:focus-visible,.map-search:focus-visible,.map-ext-link:focus-visible,.map-osm-link:focus-visible{outline:2px solid var(--rim);outline-offset:2px}
.map-directory{top:0;right:0;bottom:0;width:min(320px,100%);display:flex;flex-direction:column;gap:8px;padding:64px 10px 12px;background:color-mix(in srgb,var(--bg) 88%,transparent);border-left:1px solid var(--line);backdrop-filter:blur(18px);box-sizing:border-box}
.map-modal.dir-collapsed:not(.is-narrow) .map-directory{transform:translateX(105%)}
.map-search{width:100%;min-height:44px;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--ink);font:inherit;padding:8px 10px}
.map-privacy,.map-storage,.map-meta{margin:0;color:var(--muted);font-size:.75rem;line-height:1.45}
.map-filters{display:flex;flex-wrap:wrap;gap:6px}
.map-list{list-style:none;margin:0;padding:0;overflow:auto;display:flex;flex-direction:column;gap:6px;min-height:0}
.map-list button{width:100%;text-align:left;min-height:44px;border-radius:12px;border:1px solid var(--line);background:var(--chip);color:var(--ink);font:inherit;padding:8px 10px;cursor:pointer}
.map-list button small{display:block;color:var(--muted);font-size:.75rem}
.map-badge{display:inline-block;margin:0 0 4px;padding:2px 8px;border-radius:999px;background:var(--badge-warn-bg);color:var(--warn);font-size:.75rem}
.map-info{left:10px;bottom:12px;width:min(380px,calc(100% - 340px));max-height:48%;overflow:auto;padding:12px;border-radius:16px;background:var(--card-bg);border:1px solid var(--line);backdrop-filter:blur(16px);box-sizing:border-box}
.map-modal.dir-collapsed:not(.is-narrow) .map-info{width:min(420px,calc(100% - 20px))}
.map-info h3{margin:0 0 4px;font-size:1rem}
.map-info p{margin:0 0 8px;line-height:1.45}
.map-warning{color:var(--warn);font-weight:650}
.map-float{transform:translate(-50%,-120%);padding:4px 8px;border-radius:999px;background:var(--card);border:1px solid var(--line);font-size:.78rem;pointer-events:none;white-space:nowrap}
.map-attrib{left:8px;top:118px;z-index:9;width:min(460px,calc(100% - 340px));max-height:32%;overflow:auto;padding:8px 10px;border-radius:14px;background:color-mix(in srgb,var(--bg) 92%,transparent);border:1px solid var(--line);font-size:11px;line-height:1.45}
.map-modal.dir-collapsed:not(.is-narrow) .map-attrib{width:min(560px,calc(100% - 16px))}
.map-legal{margin:4px 0;font-size:11px}
.map-osm-link,.map-ext-link{color:var(--ink);font-weight:700}
.map-ext-tag{margin-left:6px;color:var(--muted)}
.map-modal.is-narrow .map-directory{top:auto;left:0;right:0;width:100%;max-height:48%;border-left:0;border-top:1px solid var(--line);padding:10px;transform:none}
.map-modal.is-narrow.dir-collapsed .map-directory{display:none}
.map-modal.is-narrow .map-attrib{top:auto;bottom:8px;width:min(100% - 16px,520px);max-height:30%}
.map-modal.is-narrow:not(.dir-collapsed) .map-attrib{bottom:calc(48% + 8px);max-height:22%}
.map-modal.is-narrow .map-info{width:min(100% - 20px,480px);right:10px}
.map-modal.is-narrow:not(.dir-collapsed) .map-info{bottom:calc(48% + 8px);max-height:28%}
html.map-lock,html.map-lock body{overflow:hidden!important;height:100%}
`;

let session = null;
let bootGen = 0;
let styleNode = null;

function t() {
  return TEXT[session && session.lang === "ko" ? "ko" : "zh"];
}

function readFavs() {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    const arr = JSON.parse(raw || "[]");
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((item) => typeof item === "string"));
  } catch (e) {
    return new Set();
  }
}

function writeFavs(set) {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify([...set]));
  } catch (e) {
    /* incognito or blocked storage */
  }
}

function clearFavStorage() {
  try {
    localStorage.removeItem(FAV_KEY);
  } catch (e) {
    /* incognito or blocked storage */
  }
}

function dataUrl(name) {
  return new URL("assets/map/" + name, document.baseURI).toString();
}

async function fetchJson(name) {
  const response = await fetch(dataUrl(name));
  if (!response.ok) throw new Error(name);
  return response.json();
}

function ensureStyle() {
  if (styleNode) return;
  styleNode = document.createElement("style");
  styleNode.id = "campus-map-style";
  styleNode.textContent = MAP_CSS;
  document.head.appendChild(styleNode);
}

function button(label, className) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = className || "map-btn";
  node.textContent = label;
  return node;
}

function extLink(url, label, lang) {
  const a = document.createElement("a");
  a.className = "map-ext-link";
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = label;
  const tag = document.createElement("span");
  tag.className = "map-ext-tag";
  tag.textContent = TEXT[lang].ext;
  const wrap = document.createElement("p");
  wrap.append(a, tag);
  return wrap;
}

function phonesOf(entry) {
  const blob = `${entry.textKo || ""} ${entry.textZh || ""}`;
  const found = blob.match(/0\d{1,2}-\d{3,4}-\d{4}/g) || [];
  return [...new Set(found)];
}

function catOf(entry, lang) {
  const key = entry.category === "landmark" || entry.category === "campus" ? "other" : entry.category;
  return TEXT[lang].cats[key] || TEXT[lang].cats.other;
}

function probeWebGL2() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return false;
    const lose = gl.getExtension("WEBGL_lose_context");
    if (lose) lose.loseContext();
    return true;
  } catch (e) {
    return false;
  }
}

function bind(shell, target, type, fn, opts) {
  target.addEventListener(type, fn, opts);
  shell.unbinds.push(() => target.removeEventListener(type, fn, opts));
}

function createShell(opts) {
  ensureStyle();
  const lang = opts.lang === "ko" ? "ko" : "zh";
  const root = document.createElement("div");
  root.className = "map-modal";
  root.dataset.theme = opts.theme === "dark" ? "dark" : "light";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  if (window.innerWidth < 800) root.classList.add("is-narrow", "dir-collapsed");
  const stage = document.createElement("div");
  stage.className = "map-stage";
  const canvas = document.createElement("canvas");
  canvas.className = "map-canvas";
  const status = document.createElement("p");
  status.className = "map-status";
  status.textContent = TEXT[lang].loading;
  const fallback = document.createElement("p");
  fallback.className = "map-fallback";
  fallback.hidden = true;
  const toolbar = document.createElement("div");
  toolbar.className = "map-toolbar";
  const directory = document.createElement("aside");
  directory.className = "map-directory";
  const info = document.createElement("div");
  info.className = "map-info";
  info.hidden = true;
  const label = document.createElement("div");
  label.className = "map-float";
  label.hidden = true;
  const attrib = document.createElement("div");
  attrib.className = "map-attrib";
  stage.append(canvas, status, fallback, toolbar, directory, info, label, attrib);
  root.appendChild(stage);
  const shell = {
    root, stage, canvas, status, fallback, toolbar, directory, info, label, attrib,
    lang, theme: opts.theme === "dark" ? "dark" : "light",
    onOpenFaq: opts.onOpenFaq, faqId: opts.faqId || "",
    favorites: readFavs(), category: "all", query: "",
    unbinds: [], buildings: [], pickables: [], webgl: false, glDisposed: false,
    raf: 0, interacting: false, tween: null, selectedId: null, hoverId: null,
    infoEntries: null, infoBuilding: null, renderer: null, controls: null, scene: null, camera: null,
  };
  paintChrome(shell);
  paintAttribution(shell);
  return shell;
}

function paintAttribution(shell) {
  const lang = shell.lang;
  const copy = TEXT[lang];
  const other = TEXT[lang === "ko" ? "zh" : "ko"];
  shell.attrib.replaceChildren();
  const osm = document.createElement("a");
  osm.className = "map-osm-link";
  osm.href = OSM_COPYRIGHT;
  osm.target = "_blank";
  osm.rel = "noopener noreferrer";
  osm.textContent = "© OpenStreetMap contributors";
  const osmTag = document.createElement("span");
  osmTag.className = "map-ext-tag";
  osmTag.textContent = copy.ext;
  const line = document.createElement("p");
  line.append(osm, osmTag);
  const noticeBtn = button(copy.notice, "map-btn");
  noticeBtn.classList.add("map-notice-btn");
  noticeBtn.setAttribute("aria-expanded", "true");
  const notice = document.createElement("div");
  notice.className = "map-notice";
  const legal1 = document.createElement("p");
  legal1.className = "map-legal";
  legal1.textContent = LEGAL_ATTRIBUTION;
  const legal2 = document.createElement("p");
  legal2.className = "map-legal";
  legal2.textContent = LEGAL_LIABILITY;
  const summary = document.createElement("p");
  summary.className = "map-summary";
  summary.textContent = copy.summary;
  const summaryOther = document.createElement("p");
  summaryOther.className = "map-summary-alt";
  summaryOther.textContent = other.summary;
  const schematic = document.createElement("p");
  schematic.className = "map-schematic";
  schematic.textContent = copy.schematic;
  const schematicOther = document.createElement("p");
  schematicOther.className = "map-schematic-alt";
  schematicOther.textContent = other.schematic;
  notice.append(legal1, legal2, summary, summaryOther, schematic, schematicOther, extLink(OFFICIAL_MAP, copy.officialMap, lang));
  noticeBtn.addEventListener("click", () => {
    const open = notice.hidden;
    notice.hidden = !open;
    noticeBtn.setAttribute("aria-expanded", open ? "true" : "false");
  });
  shell.attrib.append(line, noticeBtn, notice);
}

function paintChrome(shell) {
  const copy = TEXT[shell.lang];
  shell.root.setAttribute("aria-label", copy.dialog);
  shell.root.dataset.theme = shell.theme;
  const full = document.fullscreenElement === shell.root;
  const specs = [
    ["close", copy.close],
    ["zoom-in", "+"],
    ["zoom-out", "-"],
    ["reset", copy.reset],
    ["north", copy.north],
    ["full", full ? copy.fullExit : copy.full],
    ["directory", copy.directory],
  ];
  if (!shell.toolbar.childElementCount) {
    for (const [key, label] of specs) {
      const node = button(label, "map-btn");
      node.dataset.mapAction = key;
      if (key === "zoom-in") node.title = copy.zoomIn;
      if (key === "zoom-out") node.title = copy.zoomOut;
      shell.toolbar.appendChild(node);
    }
    shell.toolbar.addEventListener("click", (event) => {
      const node = event.target.closest("button");
      if (!node || !session) return;
      const action = node.dataset.mapAction;
      if (action === "close") close();
      else if (action === "zoom-in") zoomBy(0.82);
      else if (action === "zoom-out") zoomBy(1.22);
      else if (action === "reset") frameCampus(true);
      else if (action === "north") faceNorth();
      else if (action === "full") toggleFull();
      else if (action === "directory") {
        session.root.classList.toggle("dir-collapsed");
      }
    });
  } else {
    for (const node of shell.toolbar.querySelectorAll("button")) {
      const key = node.dataset.mapAction;
      const found = specs.find((item) => item[0] === key);
      if (!found) continue;
      if (key === "zoom-in" || key === "zoom-out") node.title = key === "zoom-in" ? copy.zoomIn : copy.zoomOut;
      else node.textContent = found[1];
    }
  }
  if (shell.search) {
    shell.search.placeholder = copy.search;
    shell.search.setAttribute("aria-label", copy.search);
    shell.privacy.textContent = copy.privacy;
    shell.clearFav.textContent = copy.clearFav;
    shell.storage.textContent = copy.storage;
    for (const node of shell.filters.querySelectorAll("button")) {
      node.textContent = copy.cats[node.dataset.cat];
    }
  }
  shell.status.textContent = copy.loading;
  if (!shell.fallback.hidden) shell.fallback.textContent = copy.fallback;
}

function mountDirectory(shell) {
  const copy = TEXT[shell.lang];
  const search = document.createElement("input");
  search.className = "map-search";
  search.type = "search";
  search.autocomplete = "off";
  search.placeholder = copy.search;
  search.setAttribute("aria-label", copy.search);
  const privacy = document.createElement("p");
  privacy.className = "map-privacy";
  privacy.textContent = copy.privacy;
  const filters = document.createElement("div");
  filters.className = "map-filters";
  for (const cat of CAT_ORDER) {
    const node = button(copy.cats[cat], "map-btn");
    node.dataset.cat = cat;
    node.setAttribute("aria-pressed", cat === shell.category ? "true" : "false");
    filters.appendChild(node);
  }
  const list = document.createElement("ul");
  list.className = "map-list";
  const clearFav = button(copy.clearFav, "map-btn map-clear");
  const storage = document.createElement("p");
  storage.className = "map-storage";
  storage.textContent = copy.storage;
  shell.directory.replaceChildren(search, privacy, filters, list, clearFav, storage);
  shell.search = search;
  shell.privacy = privacy;
  shell.filters = filters;
  shell.list = list;
  shell.clearFav = clearFav;
  shell.storage = storage;
  search.addEventListener("input", () => {
    if (!session) return;
    session.query = search.value || "";
    renderDirectory();
  });
  filters.addEventListener("click", (event) => {
    const node = event.target.closest("button");
    if (!node || !session) return;
    session.category = node.dataset.cat;
    for (const item of filters.querySelectorAll("button")) {
      item.setAttribute("aria-pressed", item === node ? "true" : "false");
    }
    renderDirectory();
  });
  clearFav.addEventListener("click", () => {
    if (!session) return;
    session.favorites = new Set();
    clearFavStorage();
    renderDirectory();
    refreshInfo();
  });
}

function entryMatches(shell, entry) {
  if (shell.category === "fav") {
    if (!shell.favorites.has("faq:" + entry.faqId)) return false;
  } else if (shell.category === "other") {
    if (entry.category !== "landmark" && entry.category !== "campus") return false;
  } else if (shell.category !== "all" && entry.category !== shell.category) return false;
  const q = shell.query.trim().toLowerCase();
  if (!q) return true;
  const blob = [entry.nameZh, entry.nameKo, entry.faqId, entry.textZh, entry.textKo].join("\n").toLowerCase();
  return blob.includes(q);
}

function renderDirectory() {
  const shell = session;
  if (!shell || !shell.list || !shell.poi) return;
  const copy = TEXT[shell.lang];
  shell.list.replaceChildren();
  const rows = shell.poi.entries.filter((entry) => entryMatches(shell, entry));
  if (!rows.length) {
    const empty = document.createElement("li");
    empty.className = "map-meta";
    empty.textContent = copy.empty;
    shell.list.appendChild(empty);
    return;
  }
  for (const entry of rows) {
    const li = document.createElement("li");
    const node = document.createElement("button");
    node.type = "button";
    node.dataset.faqId = entry.faqId;
    node.dataset.spatial = entry.spatialStatus;
    const name = document.createElement("strong");
    name.textContent = shell.lang === "ko" ? entry.nameKo : entry.nameZh;
    const meta = document.createElement("small");
    const badge = entry.spatialStatus === "mapped" ? "3D" : copy.textOnly;
    meta.textContent = `${badge} · ${catOf(entry, shell.lang)} · ${shell.lang === "ko" ? entry.nameZh : entry.nameKo}`;
    node.append(name, meta);
    node.addEventListener("click", () => activateEntry(entry));
    li.appendChild(node);
    shell.list.appendChild(li);
  }
}

function activateEntry(entry) {
  if (!session) return;
  if (entry.spatialStatus === "mapped" && entry.osmBuildingIds && entry.osmBuildingIds.length && session.webgl) {
    selectBuilding(entry.osmBuildingIds[0], entry.faqId);
    return;
  }
  session.selectedId = null;
  paintBuildings();
  showInfo([entry], null);
  if (session.label) session.label.hidden = true;
}

function showInfo(entries, building) {
  const shell = session;
  if (!shell) return;
  shell.infoEntries = entries;
  shell.infoBuilding = building;
  const copy = TEXT[shell.lang];
  shell.info.hidden = false;
  shell.info.replaceChildren();
  const dismiss = button(shell.lang === "ko" ? "접기" : "收起", "map-btn");
  dismiss.addEventListener("click", () => { shell.info.hidden = true; });
  shell.info.appendChild(dismiss);
  if (building && (!entries || !entries.length)) {
    const h = document.createElement("h3");
    h.textContent = (building.tags && building.tags.name) || ("OSM " + building.osmId);
    const note = document.createElement("p");
    note.className = "map-no-faq";
    note.textContent = copy.noFaq + " · OSM " + building.osmId;
    shell.info.append(h, note, favButton("osm:" + building.osmId));
    return;
  }
  for (const entry of entries || []) {
    const block = document.createElement("section");
    block.dataset.faqId = entry.faqId;
    const h = document.createElement("h3");
    h.textContent = shell.lang === "ko" ? entry.nameKo : entry.nameZh;
    const sub = document.createElement("p");
    sub.className = "map-meta";
    sub.textContent = `${shell.lang === "ko" ? entry.nameZh : entry.nameKo} · ${catOf(entry, shell.lang)}`;
    block.append(h, sub);
    if (entry.spatialStatus !== "mapped") {
      const badge = document.createElement("p");
      badge.className = "map-badge";
      badge.textContent = copy.textOnly;
      block.appendChild(badge);
    }
    const warning = shell.lang === "ko" ? entry.displayWarningKo : entry.displayWarningZh;
    if (warning) {
      const warn = document.createElement("p");
      warn.className = "map-warning";
      warn.textContent = warning;
      block.appendChild(warn);
    }
    const body = document.createElement("p");
    body.textContent = shell.lang === "ko" ? entry.textKo : entry.textZh;
    block.appendChild(body);
    for (const phone of phonesOf(entry)) {
      const row = document.createElement("p");
      row.className = "map-phone";
      row.textContent = `${copy.phone} ${phone}`;
      block.appendChild(row);
    }
    for (const url of entry.sourceUrls || []) {
      let host = url;
      try { host = new URL(url).hostname.replace(/^www\./, ""); } catch (e) { host = url; }
      block.appendChild(extLink(url, host, shell.lang));
    }
    const faq = button(copy.viewFaq, "map-btn");
    faq.addEventListener("click", () => openFaq(entry.faqId));
    block.append(faq, favButton("faq:" + entry.faqId));
    shell.info.appendChild(block);
  }
}

function refreshInfo() {
  if (!session || session.info.hidden) return;
  if (session.infoEntries || session.infoBuilding) showInfo(session.infoEntries, session.infoBuilding);
}

function favButton(key) {
  const copy = TEXT[session.lang];
  const node = button(session.favorites.has(key) ? copy.favOn : copy.fav, "map-btn");
  node.setAttribute("aria-pressed", session.favorites.has(key) ? "true" : "false");
  node.addEventListener("click", () => {
    if (!session) return;
    if (session.favorites.has(key)) session.favorites.delete(key);
    else session.favorites.add(key);
    writeFavs(session.favorites);
    node.textContent = session.favorites.has(key) ? TEXT[session.lang].favOn : TEXT[session.lang].fav;
    node.setAttribute("aria-pressed", session.favorites.has(key) ? "true" : "false");
    renderDirectory();
  });
  return node;
}

function openFaq(id) {
  const cb = session && session.onOpenFaq;
  close();
  if (typeof cb === "function") cb(id);
}

function indexEntries(poi) {
  const byOsm = new Map();
  for (const entry of poi.entries) {
    for (const id of entry.osmBuildingIds || []) {
      const list = byOsm.get(id) || [];
      list.push(entry);
      byOsm.set(id, list);
    }
  }
  return byOsm;
}

function showFallback(shell, reason) {
  shell.webgl = false;
  shell.fallback.hidden = false;
  shell.fallback.textContent = TEXT[shell.lang].fallback;
  shell.fallback.dataset.reason = String(reason && reason.message ? reason.message : reason || "fallback");
  shell.canvas.hidden = true;
  shell.status.hidden = true;
}

function disposeGL(shell, lost) {
  if (!shell || shell.glDisposed) return;
  shell.glDisposed = true;
  if (shell.raf) cancelAnimationFrame(shell.raf);
  shell.raf = 0;
  shell.tween = null;
  if (shell.controls) shell.controls.dispose();
  if (shell.scene) {
    shell.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      const mats = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
      for (const mat of mats) {
        if (mat && mat.dispose) mat.dispose();
      }
    });
  }
  if (shell.renderer) {
    if (!lost) {
      try { shell.renderer.forceContextLoss(); } catch (e) { /* already lost */ }
    }
    shell.renderer.dispose();
  }
  shell.renderer = null;
  shell.controls = null;
}

function extrudeGeometry(open, tris, y0, y1) {
  const positions = [];
  const push = (p, y) => positions.push(p[0], y, p[1]);
  for (let t = 0; t < tris.length; t += 3) {
    push(open[tris[t]], y1);
    push(open[tris[t + 1]], y1);
    push(open[tris[t + 2]], y1);
  }
  for (let t = 0; t < tris.length; t += 3) {
    push(open[tris[t]], y0);
    push(open[tris[t + 2]], y0);
    push(open[tris[t + 1]], y0);
  }
  for (let i = 0; i < open.length; i++) {
    const a = open[i];
    const b = open[(i + 1) % open.length];
    positions.push(a[0], y0, a[1], b[0], y0, b[1], b[0], y1, b[1]);
    positions.push(a[0], y0, a[1], b[0], y1, b[1], a[0], y1, a[1]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

function trianglesOf(ring) {
  const open = openRing(ring);
  let tris = triangulateXZ(open);
  if (tris.length < 3 && open.length >= 3) {
    tris = [];
    for (let i = 1; i < open.length - 1; i++) tris.push(0, i, i + 1);
  }
  return { open, tris };
}

function buildTerrain(shell) {
  const terrain = shell.terrain;
  const width = terrain.xM.length;
  const height = terrain.zM.length;
  const positions = new Float32Array(width * height * 3);
  const heights = new Float32Array(width * height);
  let p = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const y = terrain.elevationsAboveMinM[j][i];
      positions[p++] = terrain.xM[i];
      positions[p++] = y;
      positions[p++] = terrain.zM[j];
      heights[j * width + i] = y;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setIndex(terrainCellIndices(width, height));
  geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(width * height * 3), 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  shell.scene.add(mesh);
  shell.terrainMesh = mesh;
  shell.terrainRange = { minY, maxY, heights, width };
  paintTerrain(shell);
  const boundary = drapeBoundary(shell, shell.osm.campusBoundaryXZ);
  if (boundary) shell.scene.add(boundary);
}

function paintTerrain(shell) {
  if (!shell.terrainMesh) return;
  const { minY, maxY, heights } = shell.terrainRange;
  const span = Math.max(1, maxY - minY);
  const dark = shell.theme === "dark";
  const low = dark ? [0.15, 0.18, 0.23] : [0.76, 0.78, 0.8];
  const high = dark ? [0.4, 0.46, 0.54] : [0.98, 0.97, 0.95];
  const colors = shell.terrainMesh.geometry.attributes.color.array;
  for (let i = 0; i < heights.length; i++) {
    const t = (heights[i] - minY) / span;
    colors[i * 3] = low[0] + (high[0] - low[0]) * t;
    colors[i * 3 + 1] = low[1] + (high[1] - low[1]) * t;
    colors[i * 3 + 2] = low[2] + (high[2] - low[2]) * t;
  }
  shell.terrainMesh.geometry.attributes.color.needsUpdate = true;
  if (shell.boundary) shell.boundary.material.color.set(dark ? 0x9eb6d8 : 0x8d6240);
}

function drapeBoundary(shell, ring) {
  if (!ring || ring.length < 2) return null;
  const samples = [];
  const pts = ring.map((p) => [p[0], p[1]]);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(1, Math.ceil(len / 2));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const x = a[0] + (b[0] - a[0]) * t;
      const z = a[1] + (b[1] - a[1]) * t;
      samples.push(new THREE.Vector3(x, sampleTerrainY(shell.terrain, x, z) + 0.55, z));
    }
  }
  if (samples.length < 2) return null;
  const half = 0.85;
  const positions = [];
  for (let i = 0; i < samples.length; i++) {
    const prev = samples[Math.max(0, i - 1)];
    const next = samples[Math.min(samples.length - 1, i + 1)];
    const tx = next.x - prev.x;
    const tz = next.z - prev.z;
    const mag = Math.hypot(tx, tz) || 1;
    const px = (-tz / mag) * half;
    const pz = (tx / mag) * half;
    const p = samples[i];
    positions.push(p.x - px, p.y, p.z - pz, p.x + px, p.y, p.z + pz);
  }
  const indices = [];
  for (let i = 0; i < samples.length - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({ color: shell.theme === "dark" ? 0x9eb6d8 : 0x8d6240, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  shell.boundary = mesh;
  return mesh;
}

function buildBuildings(shell) {
  for (const building of shell.osm.buildings) {
    const seat = measureFootprint(building.footprintXZ, shell.terrain);
    const { open, tris } = trianglesOf(building.footprintXZ);
    if (!open.length || tris.length < 3) continue;
    const skirtGeo = extrudeGeometry(open, tris, seat.skirtBottomY, seat.baseY);
    const massGeo = extrudeGeometry(open, tris, seat.baseY, seat.baseY + SCHEMATIC_HEIGHT_M);
    const entries = shell.byOsm.get(building.osmId) || [];
    const mapped = entries.length > 0;
    const skirt = new THREE.Mesh(skirtGeo, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, flatShading: true }));
    const mass = new THREE.Mesh(massGeo, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, flatShading: true }));
    skirt.castShadow = true;
    skirt.receiveShadow = true;
    mass.castShadow = true;
    mass.receiveShadow = true;
    mass.userData.osmId = building.osmId;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(massGeo, 20), new THREE.LineBasicMaterial());
    const group = new THREE.Group();
    group.add(skirt, mass, edges);
    shell.scene.add(group);
    const centroid = ringCentroid(open);
    const record = { osmId: building.osmId, building, entries, mapped, skirt, mass, edge: edges, group, seat, centroid };
    shell.buildings.push(record);
    shell.pickables.push(mass);
  }
  paintBuildings();
}

function paintBuildings() {
  const shell = session;
  if (!shell) return;
  const dark = shell.theme === "dark";
  for (const record of shell.buildings) {
    const mode = record.osmId === shell.selectedId ? "selected" : record.osmId === shell.hoverId ? "hover" : "idle";
    let mass = dark ? 0xd5dbe4 : 0xf4f2ee;
    let skirt = dark ? 0x222833 : 0xb7b2a8;
    let edge = dark ? 0x8ea0b8 : 0x6a635c;
    if (record.mapped && mode === "idle") {
      mass = dark ? 0xe6edf6 : 0xfffdfb;
      edge = dark ? 0xb7c6dc : 0x4c453c;
    }
    if (mode === "hover") {
      mass = dark ? 0xf4e2c2 : 0xfff4df;
      edge = 0xc48a2a;
    }
    if (mode === "selected") {
      mass = dark ? 0xffe1a8 : 0xffefc6;
      skirt = dark ? 0x3a3428 : 0xd8c6a2;
      edge = 0xb56a00;
    }
    record.mass.material.color.setHex(mass);
    record.mass.material.emissive.setHex(mode === "selected" ? (dark ? 0x3a2c14 : 0x5a4020) : 0x000000);
    record.mass.material.emissiveIntensity = mode === "selected" ? 0.22 : 0;
    record.skirt.material.color.setHex(skirt);
    record.edge.material.color.setHex(edge);
  }
}

function selectBuilding(osmId, faqId) {
  const shell = session;
  if (!shell) return;
  const record = shell.buildings.find((item) => item.osmId === osmId);
  if (!record) return;
  shell.selectedId = osmId;
  paintBuildings();
  const entries = record.entries.length ? record.entries : [];
  showInfo(entries, record.building);
  if (faqId && shell.list) {
    const row = shell.list.querySelector(`[data-faq-id="${faqId}"]`);
    if (row && row.scrollIntoView) row.scrollIntoView({ block: "nearest" });
  }
  const name = entries[0]
    ? (shell.lang === "ko" ? entries[0].nameKo : entries[0].nameZh)
    : ((record.building.tags && record.building.tags.name) || ("OSM " + osmId));
  shell.label.hidden = false;
  shell.label.textContent = name;
  flyTo(record.centroid.x, record.seat.baseY + 4, record.centroid.z);
}

function focusFaq(faqId) {
  const shell = session;
  if (!shell || !shell.poi || !faqId) return;
  const entry = shell.poi.entries.find((item) => item.faqId === faqId);
  if (!entry) return;
  activateEntry(entry);
}

function flyTo(x, y, z) {
  const shell = session;
  if (!shell || !shell.controls) return;
  const target = new THREE.Vector3(x, y, z);
  const offset = shell.camera.position.clone().sub(shell.controls.target);
  if (offset.length() < 30) offset.set(36, 48, 64);
  offset.setLength(THREE.MathUtils.clamp(offset.length() * 0.7, 46, 170));
  const endPos = target.clone().add(offset);
  const floorY = sampleTerrainY(shell.terrain, endPos.x, endPos.z) + 12;
  if (endPos.y < floorY) endPos.y = floorY;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    shell.controls.target.copy(target);
    shell.camera.position.copy(endPos);
    shell.tween = null;
    poke();
    return;
  }
  shell.tween = {
    t0: performance.now(),
    dur: 680,
    sT: shell.controls.target.clone(),
    sP: shell.camera.position.clone(),
    eT: target,
    eP: endPos,
  };
  poke();
}

function frameCampus() {
  const shell = session;
  if (!shell || !shell.controls || !shell.buildings.length) return;
  const box = new THREE.Box3();
  for (const record of shell.buildings) box.expandByObject(record.group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.z, 120) * 0.68;
  shell.controls.target.copy(center);
  shell.camera.position.set(center.x + radius * 0.08, center.y + radius * 0.62, center.z + radius);
  if (shell.sun) shell.sun.target.position.copy(center);
  shell.tween = null;
  poke();
}

function faceNorth() {
  const shell = session;
  if (!shell || !shell.controls) return;
  const target = shell.controls.target;
  const dist = Math.max(80, shell.camera.position.distanceTo(target));
  const phi = 1.02;
  shell.camera.position.set(target.x, target.y + dist * Math.cos(phi), target.z + dist * Math.sin(phi));
  shell.tween = null;
  poke();
}

function zoomBy(scale) {
  const shell = session;
  if (!shell || !shell.controls) return;
  if (scale < 1) shell.controls.dollyIn(scale);
  else shell.controls.dollyOut(1 / scale);
  poke();
}

function toggleFull() {
  const shell = session;
  if (!shell) return;
  if (document.fullscreenElement === shell.root) {
    document.exitFullscreen?.().catch(() => {});
  } else {
    shell.root.requestFullscreen?.().catch(() => {});
  }
}

function keepAbove() {
  const shell = session;
  if (!shell || !shell.camera || !shell.terrain) return;
  const y = sampleTerrainY(shell.terrain, shell.camera.position.x, shell.camera.position.z);
  if (shell.camera.position.y < y + 8) shell.camera.position.y = y + 8;
}

function stepTween() {
  const shell = session;
  if (!shell || !shell.tween) return false;
  const tw = shell.tween;
  const raw = Math.min(1, (performance.now() - tw.t0) / tw.dur);
  const k = raw * raw * (3 - 2 * raw);
  shell.controls.target.lerpVectors(tw.sT, tw.eT, k);
  shell.camera.position.lerpVectors(tw.sP, tw.eP, k);
  if (raw >= 1) shell.tween = null;
  return true;
}

function placeLabel() {
  const shell = session;
  if (!shell || !shell.label || !shell.camera) return;
  if (!shell.selectedId) {
    shell.label.hidden = true;
    return;
  }
  const record = shell.buildings.find((item) => item.osmId === shell.selectedId);
  if (!record) return;
  const v = new THREE.Vector3(record.centroid.x, record.seat.baseY + SCHEMATIC_HEIGHT_M + 2, record.centroid.z);
  v.project(shell.camera);
  if (v.z > 1) {
    shell.label.hidden = true;
    return;
  }
  const rect = shell.stage.getBoundingClientRect();
  shell.label.style.left = `${(v.x * 0.5 + 0.5) * rect.width}px`;
  shell.label.style.top = `${(-v.y * 0.5 + 0.5) * rect.height}px`;
  shell.label.hidden = false;
}

function poke() {
  const shell = session;
  if (!shell || shell.glDisposed || !shell.renderer) return;
  if (shell.raf) return;
  shell.raf = requestAnimationFrame(tick);
}

function tick() {
  const shell = session;
  if (!shell || !shell.renderer) return;
  shell.raf = 0;
  const tweening = stepTween();
  const changed = shell.controls ? shell.controls.update() : false;
  keepAbove();
  shell.renderer.render(shell.scene, shell.camera);
  placeLabel();
  if (tweening || changed || shell.interacting) poke();
}

function resize() {
  const shell = session;
  if (!shell || !shell.renderer) return;
  const w = Math.max(1, shell.stage.clientWidth);
  const h = Math.max(1, shell.stage.clientHeight);
  shell.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  shell.renderer.setSize(w, h, false);
  shell.camera.aspect = w / h;
  shell.camera.updateProjectionMatrix();
  shell.root.classList.toggle("is-narrow", w < 800);
  poke();
}

function pickAt(event) {
  const shell = session;
  if (!shell || !shell.camera) return;
  const rect = shell.canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, shell.camera);
  const hits = ray.intersectObjects(shell.pickables, false);
  if (!hits.length) return;
  selectBuilding(hits[0].object.userData.osmId, "");
}

function bindPointer(shell) {
  let down = null;
  bind(shell, shell.canvas, "pointerdown", (event) => {
    down = { x: event.clientX, y: event.clientY, id: event.pointerId };
  });
  bind(shell, shell.canvas, "pointerup", (event) => {
    if (!down || down.id !== event.pointerId) return;
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    down = null;
    if (moved < 6) pickAt(event);
  });
  bind(shell, shell.canvas, "pointermove", (event) => {
    if (!session || !session.camera || (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) >= 6)) return;
    const rect = session.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, session.camera);
    const hits = ray.intersectObjects(session.pickables, false);
    const next = hits.length ? hits[0].object.userData.osmId : null;
    if (next !== session.hoverId) {
      session.hoverId = next;
      paintBuildings();
      poke();
    }
  });
}

function applyThemeMaterials() {
  const shell = session;
  if (!shell || !shell.renderer) return;
  const dark = shell.theme === "dark";
  shell.renderer.setClearColor(dark ? 0x10141a : 0xf3efe8, 1);
  if (shell.hemi) {
    shell.hemi.color.set(dark ? 0xb7c8e4 : 0xfff6ea);
    shell.hemi.groundColor.set(dark ? 0x1b212b : 0xc9c3b8);
  }
  if (shell.sun) shell.sun.color.set(dark ? 0xd5e4ff : 0xfff3df);
  paintTerrain(shell);
  paintBuildings();
  poke();
}

function buildScene(shell) {
  const renderer = new THREE.WebGLRenderer({
    canvas: shell.canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 5000);
  const controls = new OrbitControls(camera, shell.canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.maxPolarAngle = Math.PI / 2 - 0.08;
  controls.minPolarAngle = 0.2;
  controls.minDistance = 18;
  controls.maxDistance = 1200;
  controls.target.set(0, 40, 0);
  const hemi = new THREE.HemisphereLight(0xfff6ea, 0xc9c3b8, 0.72);
  const sun = new THREE.DirectionalLight(0xfff3df, 1.2);
  sun.position.set(-220, 340, -160);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -520;
  sun.shadow.camera.right = 520;
  sun.shadow.camera.top = 520;
  sun.shadow.camera.bottom = -520;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 1200;
  sun.shadow.bias = -0.0006;
  scene.add(hemi, sun, sun.target);
  shell.renderer = renderer;
  shell.scene = scene;
  shell.camera = camera;
  shell.controls = controls;
  shell.hemi = hemi;
  shell.sun = sun;
  shell.webgl = true;
  shell.canvas.hidden = false;
  shell.status.hidden = true;
  shell.fallback.hidden = true;
  buildTerrain(shell);
  buildBuildings(shell);
  bind(shell, controls, "start", () => { if (session) session.interacting = true; poke(); });
  bind(shell, controls, "end", () => { if (session) session.interacting = false; poke(); });
  bind(shell, controls, "change", poke);
  bind(shell, shell.canvas, "webglcontextlost", (event) => {
    event.preventDefault();
    if (!session) return;
    showFallback(session, "webglcontextlost");
    disposeGL(session, true);
  });
  bindPointer(shell);
  applyThemeMaterials();
  resize();
  frameCampus();
  controls.update();
  poke();
  requestAnimationFrame(() => {
    if (session === shell) resize();
  });
}

function lockPage(on) {
  document.documentElement.classList.toggle("map-lock", on);
}

export function isOpen() {
  return !!session;
}

export function setLang(lang) {
  if (!session) return;
  session.lang = lang === "ko" ? "ko" : "zh";
  paintChrome(session);
  paintAttribution(session);
  renderDirectory();
  refreshInfo();
  if (session.selectedId) {
    const record = session.buildings.find((item) => item.osmId === session.selectedId);
    if (record && session.label) {
      const entry = record.entries[0];
      session.label.textContent = entry
        ? (session.lang === "ko" ? entry.nameKo : entry.nameZh)
        : ((record.building.tags && record.building.tags.name) || ("OSM " + record.osmId));
    }
  }
}

export function setTheme(theme) {
  if (!session) return;
  session.theme = theme === "dark" ? "dark" : "light";
  session.root.dataset.theme = session.theme;
  applyThemeMaterials();
}

export function projectBuilding(osmId) {
  if (!session || !session.camera) return null;
  const record = session.buildings.find((item) => item.osmId === osmId);
  if (!record) return null;
  const v = new THREE.Vector3(record.centroid.x, record.seat.baseY + 7, record.centroid.z);
  v.project(session.camera);
  const rect = session.canvas.getBoundingClientRect();
  return {
    x: rect.left + (v.x * 0.5 + 0.5) * rect.width,
    y: rect.top + (-v.y * 0.5 + 0.5) * rect.height,
    behind: v.z > 1,
  };
}

export function close() {
  bootGen += 1;
  const shell = session;
  if (!shell) return;
  session = null;
  if (document.fullscreenElement === shell.root) {
    document.exitFullscreen?.().catch(() => {});
  }
  disposeGL(shell, false);
  for (const unbind of shell.unbinds) unbind();
  shell.root.remove();
  if (!session) lockPage(false);
}

export async function open(opts) {
  opts = opts || {};
  if (session) {
    if (opts.onOpenFaq) session.onOpenFaq = opts.onOpenFaq;
    if (opts.lang) setLang(opts.lang);
    if (opts.theme) setTheme(opts.theme);
    if (opts.faqId) focusFaq(opts.faqId);
    return;
  }
  const gen = ++bootGen;
  const shell = createShell(opts);
  session = shell;
  document.body.appendChild(shell.root);
  lockPage(true);
  bind(shell, window, "keydown", (event) => {
    if (event.key === "Escape" && session && session.root === shell.root) {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  }, true);
  bind(shell, window, "resize", resize);
  bind(shell, document, "fullscreenchange", () => { if (session) paintChrome(session); });
  mountDirectory(shell);
  try {
    const [osm, terrain, poi] = await Promise.all([
      fetchJson("osm-buildings.json"),
      fetchJson("campus-terrain.json"),
      fetchJson("campus-poi-directory.json"),
    ]);
    if (gen !== bootGen || session !== shell) return;
    shell.osm = osm;
    shell.terrain = terrain;
    shell.poi = poi;
    shell.byOsm = indexEntries(poi);
    renderDirectory();
    if (!probeWebGL2()) {
      showFallback(shell, "no-webgl2");
      if (opts.faqId) focusFaq(opts.faqId);
      return;
    }
    try {
      buildScene(shell);
    } catch (err) {
      showFallback(shell, err);
    }
    if (opts.faqId) focusFaq(opts.faqId);
  } catch (err) {
    if (session === shell) showFallback(shell, err);
  }
}
