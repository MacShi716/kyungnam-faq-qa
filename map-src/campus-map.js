import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  RED_OSM_ID,
  lightRig,
} from "./colors.mjs";
import { layoutLabelBoxes, measureLabel } from "./labels.mjs";
import { displayTitle, directoryRank, faqButtonLabel, officialLinkLabel } from "./present.mjs";
import { blobMatchesQuery, entrySearchBlob } from "./search.mjs";
import {
  applyAtmosphereTheme,
  buildCampusLayers,
  buildRealisticBuildings,
  buildRealisticTerrain,
  installAtmosphere,
  paintRealisticBuildings,
  repaintTerrainColors,
} from "./scene-dress.mjs";
import {
  SCHEMATIC_HEIGHT_M,
  sampleTerrainY,
} from "./placement.mjs";

const FAV_KEY = "campus_map_favorites";
const OFFICIAL_MAP = "https://inews.kyungnam.ac.kr/bbs/view.html?idxno=39517";
const OSM_COPYRIGHT = "https://www.openstreetmap.org/copyright";
const ODBL_LICENSE = "https://opendatacommons.org/licenses/odbl/1-0/";
const LEGAL_ATTRIBUTION = "produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.";
const LEGAL_LIABILITY = "The organisations in charge of the Copernicus programme by law or by delegation do not incur any liability for any use of the Copernicus WorldDEM-30.";
const OLD_MUSEUM_OSM = 1061923278;
const PRIORITY2 = new Set(["F49", "F62", "F69", "F57", "F71", "F72", "F73"]);

const TEXT = {
  zh: {
    close: "关闭", zoomIn: "放大", zoomOut: "缩小", reset: "回到全校", north: "正北复位",
    full: "全屏", fullExit: "退出全屏", directory: "目录", search: "搜索地点",
    privacy: "请勿输入学号、手机号等个人信息", clearFav: "清空收藏",
    storage: "仅保存在本机浏览器，公用设备请清空", fav: "收藏", favOn: "已收藏",
    viewFaq: "查看相关 FAQ", noFaq: "暂无对应 FAQ", textOnly: "文字地点",
    notice: "Copernicus · 数据来源与许可", licenseTitle: "数据来源与许可", loading: "正在加载校园地图…",
    fallback: "当前环境无法显示 3D 模型。可以搜索地点列表，或打开官方校园地图。",
    schematic: "本图为示意图：地势来自约 30 米卫星地表模型（DSM），建筑平面来自 OpenStreetMap 轮廓，楼高为统一示意高度，不是实测地形、实测楼高，也不是导航路线。",
    summary: "地形高程使用 Copernicus WorldDEM-30 公开数据，只用于这张校园示意图。欧盟、ESA、DLR 与 Airbus 不对使用该数据承担责任，也不表示认可本页面。",
    officialMap: "庆南大学 2026 校园地图", ext: "外部官方链接", empty: "没有匹配的地点", phone: "电话",
    dialog: "庆南大学 3D 校园示意图",
    labels: "标注", floorTitle: "各楼层教室与用途", facilities: "设施", hours: "时间",
    roleBadge: "国际服务重点", noMesh: "暂无3D轮廓",
    designLabel: "设计馆 · 留学生服务中心",
    intlTitle: "国际处 · 创造馆 1F",
    mapNo: (n) => `地图 ${n} 号`,
    fresh: (date) => `官网 ko/6382 页面日期为 ${date}。本次已核对页面仍公开该楼层，请以现场或官网最新指引为准。`,
    museumMoved: "此 OSM 轮廓仍标有旧博物馆名称。官网确认博物馆已于 2008 年迁入汉马未来馆，此处不是现博物馆。",
    museumJump: "查看汉马未来馆",
    cats: { all: "全部", international: "国际服务", academic: "教学/行政", dining: "餐饮", dorm: "宿舍", other: "地标/其他", fav: "收藏" },
  },
  ko: {
    close: "닫기", zoomIn: "확대", zoomOut: "축소", reset: "전체 보기", north: "정북",
    full: "전체 화면", fullExit: "전체 화면 종료", directory: "목록", search: "장소 검색",
    privacy: "학번·전화번호 등 개인정보는 입력하지 마세요", clearFav: "즐겨찾기 비우기",
    storage: "이 브라우저에만 저장됩니다. 공용 기기에서는 비워 주세요", fav: "즐겨찾기", favOn: "즐겨찾기됨",
    viewFaq: "관련 FAQ 보기", noFaq: "연결된 FAQ 없음", textOnly: "텍스트 안내",
    notice: "Copernicus · 출처·라이선스", licenseTitle: "데이터 출처 및 라이선스", loading: "캠퍼스맵을 불러오는 중…",
    fallback: "이 환경에서는 3D 모형을 표시할 수 없습니다. 장소 목록을 검색하거나 공식 캠퍼스맵을 여세요.",
    schematic: "이 화면은 모식도입니다. 지형은 약 30m 위성 표면모델(DSM)이고 건물 평면은 OpenStreetMap 윤곽이며 건물 높이는 동일한 예시 높이입니다. 측량 지형·높이 또는 길안내 경로가 아닙니다.",
    summary: "지형 고도는 Copernicus WorldDEM-30 공개 자료를 사용하며 이 캠퍼스 모식도에만 씁니다. EU, ESA, DLR, Airbus는 이 자료의 사용에 책임을 지지 않으며 이 페이지를 보증하거나 승인하지 않습니다.",
    officialMap: "경남대 2026 캠퍼스맵", ext: "외부 공식 링크", empty: "일치하는 장소가 없습니다", phone: "전화",
    dialog: "경남대학교 3D 캠퍼스 모식도",
    labels: "라벨", floorTitle: "층별 강의실·시설 안내", facilities: "시설", hours: "시간",
    roleBadge: "유학생 핵심", noMesh: "3D 외곽선 없음",
    designLabel: "디자인관 · 유학생서비스센터",
    intlTitle: "국제처 · 창조관 1층",
    mapNo: (n) => `캠퍼스맵 ${n}번`,
    fresh: (date) => `공식 ko/6382 페이지 날짜는 ${date}입니다. 이번 확인 당시 해당 층이 공개되어 있었으며, 현장 또는 학교 공식 최신 안내 기준 확인 필요.`,
    museumMoved: "이 OSM 윤곽은 옛 박물관 이름입니다. 공식 안내에 따르면 박물관은 2008년 한마미래관으로 이전했으며, 현재 박물관이 아닙니다.",
    museumJump: "한마미래관 보기",
    cats: { all: "전체", international: "국제 서비스", academic: "교육/행정", dining: "식당", dorm: "기숙사", other: "랜드마크/기타", fav: "즐겨찾기" },
  },
};

const CAT_ORDER = ["all", "international", "academic", "dining", "dorm", "other", "fav"];
const MAP_CSS = `
.map-modal{--map-panel:rgba(255,252,247,.9);--map-line:rgba(28,32,38,.16);position:fixed;inset:0;z-index:40;width:100%;height:100dvh;max-width:100vw;box-sizing:border-box;overflow:hidden;background:var(--bg);color:var(--ink);font:inherit;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
.map-modal[data-theme="dark"]{--map-panel:rgba(14,16,20,.82);--map-line:rgba(255,255,255,.14)}
.map-stage{position:relative;width:100%;height:100%;overflow:hidden}
.map-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
.map-fallback,.map-status{position:absolute;z-index:4;left:12px;right:12px;top:64px;margin:0;padding:12px 14px;border-radius:16px;background:var(--glass);border:1px solid var(--line);backdrop-filter:blur(16px)}
.map-toolbar,.map-directory,.map-info{position:absolute;z-index:8}
.map-labels{position:absolute;inset:0;z-index:7;pointer-events:none;overflow:hidden}
.map-toolbar{top:8px;left:8px;right:8px;display:flex;flex-wrap:wrap;gap:6px;max-width:calc(100% - 16px)}
.map-btn{min-height:44px;padding:0 11px;border-radius:8px;border:1px solid var(--map-line);background:var(--map-panel);color:var(--ink);font:inherit;font-weight:600;font-size:.82rem;letter-spacing:.01em;cursor:pointer;backdrop-filter:blur(18px) saturate(1.2);box-shadow:none}
.map-btn[aria-pressed="true"]{background:var(--pressed-bg);box-shadow:inset 0 0 0 1px var(--map-line)}
.map-btn:focus-visible,.map-search:focus-visible,.map-ext-link:focus-visible,.map-osm-link:focus-visible,.map-pill:focus-visible,.map-odbl-link:focus-visible{outline:2px solid var(--rim);outline-offset:2px}
.map-directory{top:0;right:0;bottom:0;width:min(320px,100%);display:flex;flex-direction:column;gap:8px;padding:64px 10px 12px;background:color-mix(in srgb,var(--bg) 88%,transparent);border-left:1px solid var(--line);backdrop-filter:blur(18px);box-sizing:border-box}
.map-modal.dir-collapsed:not(.is-narrow) .map-directory{transform:translateX(105%)}
.map-search{width:100%;min-height:44px;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--ink);font:inherit;padding:8px 10px}
.map-privacy,.map-storage,.map-meta{margin:0;color:var(--muted);font-size:.75rem;line-height:1.45}
.map-filters{display:flex;flex-wrap:wrap;gap:6px}
.map-list{list-style:none;margin:0;padding:0;overflow:auto;display:flex;flex-direction:column;gap:6px;min-height:0}
.map-list button{width:100%;text-align:left;min-height:44px;border-radius:12px;border:1px solid var(--line);background:var(--chip);color:var(--ink);font:inherit;padding:8px 10px;cursor:pointer}
.map-list button small{display:block;color:var(--muted);font-size:.75rem}
.map-badge{display:inline-block;margin:0 6px 6px 0;padding:2px 8px;border-radius:999px;background:var(--badge-warn-bg);color:var(--warn);font-size:.75rem}
.map-num-pill{display:inline-block;margin:0 6px 6px 0;padding:2px 8px;border-radius:999px;border:1px solid var(--line);font-size:.75rem}
.map-role-badge{display:inline-block;margin:0 6px 6px 0;padding:2px 7px;border-radius:3px;background:transparent;color:#b91c1c;border:1px solid #c92a2a;font-size:.75rem;font-weight:650}
.map-info{z-index:14;top:64px;right:332px;left:auto;bottom:auto;width:min(400px,calc(100% - 360px));max-height:calc(100% - 132px);overflow:auto;padding:14px 14px 18px;border-radius:12px;background:var(--map-panel);border:1px solid var(--map-line);backdrop-filter:blur(18px);box-sizing:border-box;box-shadow:0 16px 40px rgba(16,18,22,.12)}
.map-modal.dir-collapsed:not(.is-narrow) .map-info{right:12px;width:min(420px,calc(100% - 24px))}
.map-info-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.map-info h3{margin:0 0 4px;font-size:1.05rem;line-height:1.3}
.map-info h4{margin:10px 0 6px;font-size:.86rem}
.map-info p{margin:0 0 8px;line-height:1.45}
.map-detail-close{width:36px;min-height:36px;padding:0;border-radius:8px;flex:0 0 auto}
.map-overview{margin:0 0 8px;line-height:1.5}
.map-warning{color:var(--warn);font-weight:650}
.map-floors,.map-facilities{list-style:none;margin:0 0 8px;padding:0}
.map-floors{display:flex;flex-direction:column;gap:6px}
.map-floors li{padding:8px 10px;border-radius:12px;background:var(--chip);border:1px solid var(--line)}
.map-floors strong{display:block;margin-bottom:2px}
.map-facilities{display:flex;flex-wrap:wrap;gap:6px}
.map-facilities li{padding:3px 8px;border-radius:999px;background:var(--chip);border:1px solid var(--line);font-size:.78rem}
.map-floor-note,.map-floor-note-alt,.map-floor-freshness{font-size:.78rem;color:var(--muted);line-height:1.45}
.map-pill{position:absolute;pointer-events:auto;border:1px solid var(--map-line);border-radius:3px;padding:2px 6px 3px;background:rgba(255,252,247,.92);color:#1c2430;font:inherit;font-size:11px;font-weight:600;letter-spacing:.01em;line-height:1.3;white-space:nowrap;box-shadow:none;cursor:pointer}
.map-pill::before{content:"";position:absolute;left:50%;top:100%;width:1px;height:9px;background:currentColor;opacity:.7}
.map-pill::after{content:"";position:absolute;left:50%;top:calc(100% + 8px);width:4px;height:4px;margin-left:-2px;border-radius:50%;background:currentColor}
.map-pill.is-red{background:rgba(255,252,247,.94);color:#b91c1c;border-color:#c92a2a}
.map-modal[data-theme="dark"] .map-pill{background:rgba(16,18,22,.82);color:#f4f7fb;border-color:rgba(255,255,255,.16)}
.map-modal[data-theme="dark"] .map-pill.is-red{color:#c92a2a;border-color:#c92a2a;background:rgba(22,14,14,.88)}
.map-pill.is-active{box-shadow:inset 0 0 0 1px currentColor}
.map-intl-pill,.map-intl-banner{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:1px;line-height:1.15;background:rgba(201,42,42,.06);color:#b91c1c;border:1px solid #c92a2a;text-align:left;box-shadow:none}
.map-modal[data-theme="dark"] .map-intl-pill,.map-modal[data-theme="dark"] .map-intl-banner{background:rgba(201,42,42,.16);color:#f3d0d0;border-color:#c92a2a}
.map-intl-pill small,.map-intl-banner small{color:currentColor;font-size:.68rem;font-weight:600;opacity:.9}
.map-intl-banner{width:100%;min-height:48px;border-radius:8px;padding:7px 10px}
.map-attrib{position:absolute;left:10px;bottom:10px;z-index:16;max-width:calc(100% - 20px)}
.map-attrib-bar{display:flex;align-items:center;gap:8px;height:32px;max-width:100%;padding:0 8px 0 10px;border-radius:8px;background:var(--map-panel);border:1px solid var(--map-line);backdrop-filter:blur(14px);box-sizing:border-box;overflow:hidden;white-space:nowrap}
.map-attrib-bar .map-osm-link{font-size:11px;line-height:1;font-weight:650;overflow:hidden;text-overflow:ellipsis}
.map-notice-btn{min-height:24px;height:24px;padding:0 8px;font-size:11px;line-height:1;border-radius:6px;flex:0 0 auto}
.map-modal.is-narrow .map-attrib-bar{gap:6px;padding:0 6px 0 8px}
.map-modal.is-narrow .map-attrib-bar .map-osm-link,.map-modal.is-narrow .map-notice-btn{font-size:10px}
.map-modal.is-narrow .map-notice-btn{padding:0 6px}
.map-license{position:absolute;left:0;bottom:42px;width:min(440px,calc(100vw - 24px));max-height:min(52vh,calc(100dvh - 96px));overflow:auto;padding:16px 16px 44px;scroll-padding-bottom:28px;border-radius:12px;background:var(--map-panel);border:1px solid var(--map-line);backdrop-filter:blur(16px);box-sizing:border-box;box-shadow:inset 0 -18px 16px -14px rgba(16,18,22,.28),0 16px 40px rgba(16,18,22,.16)}
.map-license h2{margin:0 0 8px;font-size:.92rem}
.map-legal{margin:4px 0;font-size:11px;line-height:1.45}
.map-osm-link,.map-odbl-link,.map-ext-link{color:var(--ink);font-weight:700}
.map-license .map-osm-link,.map-license .map-odbl-link{display:inline-block;margin:0 0 6px;font-size:12px}
.map-ext-tag{margin-left:6px;color:var(--muted);font-size:.75rem;font-weight:500}
.map-modal.is-narrow .map-directory{top:auto;left:0;right:0;width:100%;max-height:48%;border-left:0;border-top:1px solid var(--map-line);padding:10px;transform:none}
.map-modal.is-narrow.dir-collapsed .map-directory{display:none}
.map-modal.is-narrow .map-info{z-index:18;left:0;right:0;top:auto;bottom:0;width:100%;max-height:min(62vh,560px);border-radius:12px 12px 0 0}
.map-modal.is-narrow:not(.dir-collapsed) .map-attrib{bottom:calc(48% + 10px)}
.map-modal.is-narrow.info-open .map-attrib{bottom:calc(min(62vh, 560px) + 12px);z-index:12}
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

function splitParts(values) {
  const out = [];
  for (const value of values || []) {
    for (const part of String(value).split("|")) {
      const text = part.trim();
      if (text && !out.includes(text)) out.push(text);
    }
  }
  return out;
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

function favId(entry) {
  if (entry.faqId) return "faq:" + entry.faqId;
  if (entry.entryId) return "entry:" + entry.entryId;
  return "name:" + (entry.nameZh || entry.nameKo || "");
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
  info.className = "map-info map-detail";
  info.hidden = true;
  const labelLayer = document.createElement("div");
  labelLayer.className = "map-labels";
  const attrib = document.createElement("div");
  attrib.className = "map-attrib";
  const attribBar = document.createElement("div");
  attribBar.className = "map-attrib-bar";
  const license = document.createElement("div");
  license.className = "map-license";
  license.hidden = true;
  attrib.append(attribBar, license);
  stage.append(canvas, status, fallback, labelLayer, toolbar, directory, info);
  root.append(stage, attrib);
  const shell = {
    root, stage, canvas, status, fallback, toolbar, directory, info, labelLayer, attrib, attribBar, license,
    lang, theme: opts.theme === "dark" ? "dark" : "light",
    onOpenFaq: opts.onOpenFaq, faqId: opts.faqId || "",
    favorites: readFavs(), category: "all", query: "", labelsOn: true,
    unbinds: [], buildings: [], pickables: [], webgl: false, glDisposed: false,
    raf: 0, interacting: false, tween: null, selectedId: null, hoverId: null,
    detailEntries: null, detailFocus: null, detailBuilding: null,
    renderer: null, controls: null, scene: null, camera: null,
  };
  paintChrome(shell);
  paintAttribution(shell);
  return shell;
}

function paintAttribution(shell) {
  const lang = shell.lang;
  const copy = TEXT[lang];
  const other = TEXT[lang === "ko" ? "zh" : "ko"];
  const wasOpen = shell.license && !shell.license.hidden;
  shell.attribBar.replaceChildren();
  shell.license.replaceChildren();
  const osm = document.createElement("a");
  osm.className = "map-osm-link";
  osm.href = OSM_COPYRIGHT;
  osm.target = "_blank";
  osm.rel = "noopener noreferrer";
  osm.textContent = "© OpenStreetMap contributors";
  const noticeBtn = button(copy.notice, "map-btn map-notice-btn");
  noticeBtn.setAttribute("aria-expanded", wasOpen ? "true" : "false");
  noticeBtn.addEventListener("click", () => {
    const open = shell.license.hidden;
    shell.license.hidden = !open;
    noticeBtn.setAttribute("aria-expanded", open ? "true" : "false");
    layoutLabels();
  });
  shell.attribBar.append(osm, noticeBtn);
  const heading = document.createElement("h2");
  heading.textContent = copy.licenseTitle;
  const osmFull = document.createElement("a");
  osmFull.className = "map-osm-link";
  osmFull.href = OSM_COPYRIGHT;
  osmFull.target = "_blank";
  osmFull.rel = "noopener noreferrer";
  osmFull.textContent = "© OpenStreetMap contributors";
  const odbl = document.createElement("a");
  odbl.className = "map-odbl-link";
  odbl.href = ODBL_LICENSE;
  odbl.target = "_blank";
  odbl.rel = "noopener noreferrer";
  odbl.textContent = "Open Database License 1.0 (ODbL)";
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
  shell.license.append(heading, osmFull, document.createElement("br"), odbl, legal1, legal2, summary, summaryOther, schematic, schematicOther, extLink(OFFICIAL_MAP, copy.officialMap, lang));
  shell.license.hidden = !wasOpen;
}

function makeIntlButton(className) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = className;
  const title = document.createElement("span");
  title.className = "map-intl-title";
  const sub = document.createElement("small");
  node.append(title, sub);
  return node;
}

function paintIntl(shell) {
  const copy = TEXT[shell.lang];
  for (const node of [shell.intlPill, shell.intlBanner]) {
    if (!node) continue;
    node.querySelector(".map-intl-title").textContent = copy.intlTitle;
    node.querySelector("small").textContent = copy.noMesh;
  }
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
    ["labels", copy.labels],
  ];
  if (!shell.toolbar.childElementCount) {
    for (const [key, label] of specs) {
      const node = button(label, "map-btn");
      node.dataset.mapAction = key;
      if (key === "zoom-in") node.title = copy.zoomIn;
      if (key === "zoom-out") node.title = copy.zoomOut;
      if (key === "labels") node.setAttribute("aria-pressed", shell.labelsOn ? "true" : "false");
      shell.toolbar.appendChild(node);
    }
    shell.intlPill = makeIntlButton("map-btn map-intl-pill");
    shell.toolbar.appendChild(shell.intlPill);
    shell.intlPill.addEventListener("click", () => openInternational());
    shell.toolbar.addEventListener("click", (event) => {
      const node = event.target.closest("button");
      if (!node || !session || node.classList.contains("map-intl-pill")) return;
      const action = node.dataset.mapAction;
      if (action === "close") close();
      else if (action === "zoom-in") zoomBy(0.82);
      else if (action === "zoom-out") zoomBy(1.22);
      else if (action === "reset") frameCampus(true);
      else if (action === "north") faceNorth();
      else if (action === "full") toggleFull();
      else if (action === "directory") {
        session.root.classList.toggle("dir-collapsed");
        layoutLabels();
      } else if (action === "labels") {
        session.labelsOn = !session.labelsOn;
        node.setAttribute("aria-pressed", session.labelsOn ? "true" : "false");
        layoutLabels();
        poke();
      }
    });
  } else {
    for (const node of shell.toolbar.querySelectorAll("button[data-map-action]")) {
      const key = node.dataset.mapAction;
      const found = specs.find((item) => item[0] === key);
      if (!found) continue;
      if (key === "zoom-in" || key === "zoom-out") node.title = key === "zoom-in" ? copy.zoomIn : copy.zoomOut;
      else node.textContent = found[1];
      if (key === "labels") node.setAttribute("aria-pressed", shell.labelsOn ? "true" : "false");
    }
  }
  paintIntl(shell);
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
  const banner = makeIntlButton("map-btn map-intl-banner");
  banner.addEventListener("click", () => openInternational());
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
  shell.directory.replaceChildren(banner, search, privacy, filters, list, clearFav, storage);
  shell.intlBanner = banner;
  shell.search = search;
  shell.privacy = privacy;
  shell.filters = filters;
  shell.list = list;
  shell.clearFav = clearFav;
  shell.storage = storage;
  paintIntl(shell);
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
    refreshDetail();
  });
}

function entryMatches(shell, entry) {
  if (shell.category === "fav") {
    if (!shell.favorites.has(favId(entry))) return false;
  } else if (shell.category === "other") {
    if (entry.category !== "landmark" && entry.category !== "campus") return false;
  } else if (shell.category !== "all" && entry.category !== shell.category) return false;
  return blobMatchesQuery(entrySearchBlob(entry), shell.query);
}

function renderDirectory() {
  const shell = session;
  if (!shell || !shell.list || !shell.poi) return;
  const copy = TEXT[shell.lang];
  shell.list.replaceChildren();
  const rows = shell.poi.entries.filter((entry) => entryMatches(shell, entry))
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => directoryRank(a.entry) - directoryRank(b.entry) || a.index - b.index)
    .map((item) => item.entry);
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
    node.dataset.faqId = entry.faqId || "";
    node.dataset.spatial = entry.spatialStatus;
    const name = document.createElement("strong");
    name.textContent = displayTitle(entry, shell.lang);
    const meta = document.createElement("small");
    const badge = entry.spatialStatus === "mapped" ? "3D" : copy.textOnly;
    meta.textContent = `${badge} · ${catOf(entry, shell.lang)} · ${shell.lang === "ko" ? entry.nameZh : entry.nameKo}`;
    node.append(name, meta);
    node.addEventListener("click", () => activateEntry(entry));
    li.appendChild(node);
    shell.list.appendChild(li);
  }
}

function findFaq(faqId) {
  if (!session || !session.poi || !faqId) return null;
  return session.poi.entries.find((item) => item.faqId === faqId) || null;
}

function relatedEntries(entry) {
  if (!entry || !session || !session.poi) return entry ? [entry] : [];
  if (entry.faqId === "F86" || entry.faqId === "F83") {
    const rows = session.poi.entries.filter((item) => item.faqId === "F86" || item.faqId === "F83");
    return rows.length ? rows : [entry];
  }
  const ids = entry.osmBuildingIds || [];
  if (!ids.length) return [entry];
  const rows = session.poi.entries.filter((item) => (item.osmBuildingIds || []).some((id) => ids.includes(id)));
  return rows.length ? rows : [entry];
}

function openInternational() {
  const entry = findFaq("F86");
  if (!entry) return;
  showDetail(relatedEntries(entry), entry, null);
}

function activateEntry(entry) {
  if (!session) return;
  if (entry.spatialStatus === "mapped" && entry.osmBuildingIds && entry.osmBuildingIds.length && session.webgl) {
    selectBuilding(entry.osmBuildingIds[0], entry.faqId);
    return;
  }
  showDetail(relatedEntries(entry), entry, null);
}

function isDesign(entries) {
  return entries.some((entry) => entry.faqId === "F76" || entry.faqId === "F85" || (entry.osmBuildingIds || []).includes(RED_OSM_ID));
}

function floorRank(code) {
  const match = String(code || "").match(/^(B)?(\d+)/i);
  if (!match) return 999;
  const n = Number(match[2]);
  return match[1] ? -n : n;
}

function mergeFloors(entries) {
  const map = new Map();
  for (const entry of entries) {
    for (const floor of entry.floors || []) {
      const key = floor.floor || floor.labelZh || "";
      if (!map.has(key)) {
        map.set(key, {
          floor: floor.floor,
          labelZh: floor.labelZh,
          labelKo: floor.labelKo,
          roomsZh: [],
          roomsKo: [],
        });
      }
      const row = map.get(key);
      for (const room of floor.roomsAndUsesZh || []) {
        if (!row.roomsZh.includes(room)) row.roomsZh.push(room);
      }
      for (const room of floor.roomsAndUsesKo || []) {
        if (!row.roomsKo.includes(room)) row.roomsKo.push(room);
      }
    }
  }
  return [...map.values()].sort((a, b) => floorRank(a.floor) - floorRank(b.floor));
}

function cites6382(entry) {
  const blob = JSON.stringify(entry.officialUrls || []) + JSON.stringify(entry.floors || []) + String(entry.floorVerificationUrl || "");
  return blob.includes("/ko/6382/");
}

function hideDetail() {
  if (!session) return;
  session.info.hidden = true;
  session.root.classList.remove("info-open");
  session.detailEntries = null;
  session.detailFocus = null;
  session.detailBuilding = null;
  layoutLabels();
}

function revealDetail(shell) {
  shell.info.hidden = false;
  shell.root.classList.add("info-open");
  if (shell.root.classList.contains("is-narrow")) shell.root.classList.add("dir-collapsed");
}

function detailHeader(title, sub) {
  const head = document.createElement("div");
  head.className = "map-info-head";
  const text = document.createElement("div");
  const h = document.createElement("h3");
  h.textContent = title;
  text.appendChild(h);
  if (sub) {
    const meta = document.createElement("p");
    meta.className = "map-meta";
    meta.textContent = sub;
    text.appendChild(meta);
  }
  const dismiss = button("×", "map-btn map-detail-close");
  dismiss.setAttribute("aria-label", t().close);
  dismiss.addEventListener("click", () => hideDetail());
  head.append(text, dismiss);
  return head;
}

function showUnlinked(building) {
  const shell = session;
  if (!shell) return;
  const copy = TEXT[shell.lang];
  shell.detailEntries = null;
  shell.detailFocus = null;
  shell.detailBuilding = building;
  revealDetail(shell);
  shell.info.replaceChildren();
  const name = (building.tags && (building.tags.name || building.tags["name:ko"])) || ("OSM " + building.osmId);
  shell.info.appendChild(detailHeader(name, "OSM " + building.osmId));
  if (Number(building.osmId) === OLD_MUSEUM_OSM) {
    const note = document.createElement("p");
    note.className = "map-warning";
    note.textContent = copy.museumMoved;
    const jump = button(copy.museumJump, "map-btn");
    jump.addEventListener("click", () => {
      const host = findFaq("F69");
      if (host) activateEntry(host);
    });
    shell.info.append(note, jump);
  }
  const missing = document.createElement("p");
  missing.className = "map-no-faq";
  missing.textContent = copy.noFaq + " · OSM " + building.osmId;
  shell.info.append(missing, favButton("osm:" + building.osmId));
}

function showDetail(entries, focus, building) {
  const shell = session;
  if (!shell) return;
  const list = (entries || []).filter(Boolean);
  if (!list.length) {
    if (building) showUnlinked(building);
    return;
  }
  const lang = shell.lang;
  const copy = TEXT[lang];
  const other = TEXT[lang === "ko" ? "zh" : "ko"];
  shell.detailEntries = list;
  shell.detailFocus = focus || list[0];
  shell.detailBuilding = building || null;
  revealDetail(shell);
  shell.info.replaceChildren();
  const focusEntry = shell.detailFocus;
  const design = isDesign(list);
  const title = design
    ? copy.designLabel
    : (lang === "ko" ? focusEntry.nameKo : focusEntry.nameZh);
  const sub = design
    ? other.designLabel
    : (lang === "ko" ? (focusEntry.labelZh || focusEntry.nameZh) : (focusEntry.labelKo || focusEntry.nameKo));
  shell.info.appendChild(detailHeader(title, sub));
  const badges = document.createElement("p");
  const numbered = [focusEntry, ...list].find((entry) => entry && typeof entry.mapNumber === "number");
  const mapNumber = numbered ? numbered.mapNumber : null;
  if (typeof mapNumber === "number") {
    const pill = document.createElement("span");
    pill.className = "map-num-pill";
    pill.textContent = copy.mapNo(mapNumber);
    badges.appendChild(pill);
  }
  if (list.some((entry) => entry.highlightRole === "international-red")) {
    const role = document.createElement("span");
    role.className = "map-role-badge";
    role.textContent = copy.roleBadge;
    badges.appendChild(role);
  }
  const mapped = list.some((entry) => entry.spatialStatus === "mapped");
  if (!mapped) {
    const badge = document.createElement("span");
    badge.className = "map-badge";
    const intl = list.some((entry) => entry.faqId === "F86" || entry.faqId === "F83");
    badge.textContent = intl ? copy.noMesh : copy.textOnly;
    badges.appendChild(badge);
  }
  if (badges.childElementCount) shell.info.appendChild(badges);
  const seenSummary = new Set();
  for (const entry of list) {
    const summary = lang === "ko" ? entry.summaryKo : entry.summaryZh;
    const fallback = lang === "ko" ? entry.textKo : entry.textZh;
    const text = summary || fallback || "";
    if (!text || seenSummary.has(text)) continue;
    seenSummary.add(text);
    const overview = document.createElement("p");
    overview.className = "map-overview";
    overview.textContent = text;
    shell.info.appendChild(overview);
  }
  const floors = mergeFloors(list);
  const floorHead = document.createElement("h4");
  floorHead.textContent = copy.floorTitle;
  shell.info.appendChild(floorHead);
  if (floors.length) {
    const ul = document.createElement("ul");
    ul.className = "map-floors";
    for (const floor of floors) {
      const li = document.createElement("li");
      li.dataset.floor = floor.floor || "";
      const strong = document.createElement("strong");
      const label = lang === "ko" ? (floor.labelKo || floor.floor) : (floor.labelZh || floor.floor);
      strong.textContent = floor.floor ? `${floor.floor} · ${label}` : label;
      const rooms = document.createElement("span");
      const roomList = splitParts(lang === "ko" ? floor.roomsKo : floor.roomsZh);
      rooms.textContent = roomList.join("、");
      li.append(strong, rooms);
      ul.appendChild(li);
    }
    shell.info.appendChild(ul);
  }
  const noteEntry = list.find((entry) => entry.floorCoverageNoteZh || entry.floorCoverageNoteKo) || list[0];
  if (noteEntry) {
    const note = document.createElement("p");
    note.className = "map-floor-note";
    note.textContent = lang === "ko" ? (noteEntry.floorCoverageNoteKo || "") : (noteEntry.floorCoverageNoteZh || "");
    const alt = document.createElement("p");
    alt.className = "map-floor-note-alt";
    alt.textContent = lang === "ko" ? (noteEntry.floorCoverageNoteZh || "") : (noteEntry.floorCoverageNoteKo || "");
    if (note.textContent) shell.info.appendChild(note);
    if (alt.textContent) shell.info.appendChild(alt);
  }
  const dated = list.find((entry) => entry.officialFloorSourcePageLastModified);
  const date = dated ? dated.officialFloorSourcePageLastModified : (list.some(cites6382) ? "2021-08-30" : "");
  if (date) {
    const fresh = document.createElement("p");
    fresh.className = "map-floor-freshness";
    fresh.textContent = copy.fresh(date);
    shell.info.appendChild(fresh);
  }
  const facilities = splitParts(list.flatMap((entry) => (lang === "ko" ? entry.facilitiesKo : entry.facilitiesZh) || []));
  if (facilities.length) {
    const head = document.createElement("h4");
    head.textContent = copy.facilities;
    const ul = document.createElement("ul");
    ul.className = "map-facilities";
    for (const item of facilities) {
      const li = document.createElement("li");
      li.textContent = item;
      ul.appendChild(li);
    }
    shell.info.append(head, ul);
  }
  const hours = [];
  for (const entry of list) {
    const value = lang === "ko" ? entry.hoursKo : entry.hoursZh;
    if (value && !hours.includes(value)) hours.push(value);
  }
  if (hours.length) {
    const head = document.createElement("h4");
    head.textContent = copy.hours;
    shell.info.appendChild(head);
    for (const value of hours) {
      const row = document.createElement("p");
      row.className = "map-hours";
      row.textContent = value;
      shell.info.appendChild(row);
    }
  }
  const phones = [];
  const seenPhone = new Set();
  for (const entry of list) {
    for (const phone of entry.phones || []) {
      if (!phone || !phone.number || seenPhone.has(phone.number + (phone.labelZh || ""))) continue;
      seenPhone.add(phone.number + (phone.labelZh || ""));
      phones.push(phone);
    }
    if (!(entry.phones || []).length) {
      for (const number of phonesOf(entry)) {
        if (seenPhone.has(number)) continue;
        seenPhone.add(number);
        phones.push({ number, labelZh: "", labelKo: "" });
      }
    }
  }
  for (const phone of phones) {
    const row = document.createElement("p");
    row.className = "map-phone";
    const label = splitParts([lang === "ko" ? phone.labelKo : phone.labelZh]).join("、");
    row.textContent = `${copy.phone} ${label ? label + " " : ""}${phone.number}`;
    shell.info.appendChild(row);
  }
  const seenUrl = new Set();
  for (const entry of list) {
    for (const link of entry.officialUrls || []) {
      if (!link || !link.url || seenUrl.has(link.url)) continue;
      seenUrl.add(link.url);
      shell.info.appendChild(extLink(link.url, officialLinkLabel(link, entry, lang), lang));
    }
  }
  const faqIds = [];
  for (const entry of list) {
    if (entry.faqId && /^F\d+$/.test(entry.faqId) && !faqIds.includes(entry.faqId)) faqIds.push(entry.faqId);
  }
  for (const id of faqIds) {
    const faqEntry = list.find((entry) => entry.faqId === id) || { faqId: id };
    const faq = button(faqButtonLabel(faqEntry, lang), "map-btn");
    faq.dataset.faqId = id;
    faq.addEventListener("click", () => openFaq(id));
    shell.info.appendChild(faq);
  }
  shell.info.appendChild(favButton(favId(focusEntry)));
  layoutLabels();
}

function refreshDetail() {
  if (!session || session.info.hidden) return;
  if (session.detailEntries) showDetail(session.detailEntries, session.detailFocus, session.detailBuilding);
  else if (session.detailBuilding) showUnlinked(session.detailBuilding);
}

function paintFav(node, on) {
  const copy = TEXT[session.lang];
  const star = document.createElement("span");
  star.setAttribute("aria-hidden", "true");
  star.textContent = on ? "★ " : "☆ ";
  node.replaceChildren(star, document.createTextNode(on ? copy.favOn : copy.fav));
  node.setAttribute("aria-pressed", on ? "true" : "false");
}

function favButton(key) {
  const node = button("", "map-btn");
  paintFav(node, session.favorites.has(key));
  node.addEventListener("click", () => {
    if (!session) return;
    if (session.favorites.has(key)) session.favorites.delete(key);
    else session.favorites.add(key);
    writeFavs(session.favorites);
    paintFav(node, session.favorites.has(key));
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
  const seenTex = new Set();
  for (const tex of shell.ownedTextures || []) {
    if (tex && !seenTex.has(tex.uuid)) {
      seenTex.add(tex.uuid);
      tex.dispose();
    }
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

function buildTerrain(shell) {
  buildRealisticTerrain(shell);
}

function paintTerrain(shell) {
  repaintTerrainColors(shell);
  applyAtmosphereTheme(shell);
}

function buildBuildings(shell) {
  buildRealisticBuildings(shell);
}

function paintBuildings() {
  if (!session) return;
  paintRealisticBuildings(session);
}

function labelText(record, lang) {
  if (!record.entries.length || record.kind === "neutral") return "";
  if (record.osmId === RED_OSM_ID || record.kind === "red") return TEXT[lang].designLabel;
  const main = record.entries.find((entry) => entry.entryId !== "POI-MUSEUM" && entry.faqId !== "F85") || record.entries[0];
  if (!main) return "";
  if (lang === "ko") return main.labelKo || main.nameKo;
  return main.labelZh || main.nameZh;
}

function labelPriority(record) {
  if (record.osmId === RED_OSM_ID || record.kind === "red") return 1;
  if (session && (record.osmId === session.selectedId || record.osmId === session.hoverId)) return 1;
  if (record.entries.some((entry) => PRIORITY2.has(entry.faqId))) return 2;
  return 3;
}

function selectBuilding(osmId, faqId) {
  const shell = session;
  if (!shell) return;
  const record = shell.buildings.find((item) => item.osmId === osmId);
  if (!record) return;
  shell.selectedId = osmId;
  paintBuildings();
  const focus = (faqId && record.entries.find((entry) => entry.faqId === faqId)) || record.entries[0] || null;
  if (record.entries.length) showDetail(record.entries, focus, record.building);
  else showUnlinked(record.building);
  if (faqId && shell.list) {
    const row = shell.list.querySelector(`[data-faq-id="${faqId}"]`);
    if (row && row.scrollIntoView) row.scrollIntoView({ block: "nearest" });
  }
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
  const radius = Math.max(size.x, size.z, 180);
  shell.controls.target.set(center.x - 8, center.y + 10, center.z - 16);
  shell.camera.position.set(center.x + radius * 0.46, center.y + radius * 0.42, center.z + radius * 0.74);
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

function obstacleBoxes(shell) {
  const stage = shell.stage.getBoundingClientRect();
  const boxes = [];
  for (const node of [shell.toolbar, shell.directory, shell.info, shell.attrib]) {
    if (!node || node.hidden) continue;
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const rect = node.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    boxes.push({
      x: rect.left - stage.left,
      y: rect.top - stage.top,
      w: rect.width,
      h: rect.height,
    });
  }
  return boxes;
}

function layoutLabels() {
  const shell = session;
  if (!shell || !shell.labelLayer) return;
  if (!shell.labelsOn || !shell.camera || !shell.webgl) {
    shell.labelLayer.replaceChildren();
    return;
  }
  const rect = shell.stage.getBoundingClientRect();
  const width = rect.width || shell.stage.clientWidth;
  const height = rect.height || shell.stage.clientHeight;
  const items = [];
  for (const record of shell.buildings) {
    const text = labelText(record, shell.lang);
    if (!text) continue;
    const point = new THREE.Vector3(record.centroid.x, record.seat.baseY + SCHEMATIC_HEIGHT_M + 4.2, record.centroid.z);
    point.project(shell.camera);
    if (point.z > 1) continue;
    const size = measureLabel(text);
    items.push({
      id: record.osmId,
      priority: labelPriority(record),
      x: (point.x * 0.5 + 0.5) * width,
      y: (-point.y * 0.5 + 0.5) * height,
      w: size.w,
      h: size.h,
      text,
      red: record.kind === "red",
    });
  }
  const bounds = { left: 8, top: 58, right: Math.max(80, width - 8), bottom: Math.max(90, height - 48) };
  const visible = layoutLabelBoxes(items, bounds, obstacleBoxes(shell));
  const keep = new Set(visible.map((box) => String(box.id)));
  for (const child of [...shell.labelLayer.children]) {
    if (!keep.has(child.dataset.osmId)) child.remove();
  }
  for (const box of visible) {
    let node = shell.labelLayer.querySelector(`[data-osm-id="${box.id}"]`);
    if (!node) {
      node = document.createElement("button");
      node.type = "button";
      node.className = "map-pill";
      node.dataset.osmId = String(box.id);
      node.addEventListener("click", (event) => {
        event.stopPropagation();
        selectBuilding(Number(node.dataset.osmId), "");
      });
      shell.labelLayer.appendChild(node);
    }
    node.textContent = box.text;
    node.classList.toggle("is-red", box.red);
    node.classList.toggle("is-active", Number(box.id) === shell.selectedId);
    node.style.left = `${box.x}px`;
    node.style.top = `${box.y}px`;
    node.style.width = `${box.w}px`;
  }
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
  layoutLabels();
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
      layoutLabels();
      poke();
    }
  });
}

function applyThemeMaterials() {
  const shell = session;
  if (!shell || !shell.renderer) return;
  const rig = lightRig(shell.theme);
  const dark = shell.theme === "dark";
  if (shell.hemi) {
    shell.hemi.color.setHex(dark ? 0x9eb0c4 : 0xf4f7fb);
    shell.hemi.groundColor.setHex(dark ? 0x1a201c : 0xa39880);
    shell.hemi.intensity = dark ? 0.38 : 0.46;
  }
  if (shell.sun) {
    shell.sun.color.setHex(rig.sun);
    shell.sun.intensity = dark ? 0.95 : 1.7;
  }
  applyAtmosphereTheme(shell);
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
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
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
  const rig = lightRig(shell.theme);
  const hemi = new THREE.HemisphereLight(0xf4f7fb, 0xa39880, 0.55);
  const sun = new THREE.DirectionalLight(rig.sun, 1.7);
  sun.position.set(-260, 540, 280);
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
  shell.ownedTextures = [];
  shell.facadeMaterials = [];
  shell.surfaceMaterials = [];
  installAtmosphere(shell);
  buildTerrain(shell);
  buildCampusLayers(shell);
  buildBuildings(shell);
  applyThemeMaterials();
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
  refreshDetail();
  layoutLabels();
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

export function debugSnapshot() {
  if (!session || !session.terrainMesh) return null;
  const colors = session.terrainMesh.geometry.attributes.color.array;
  const heights = session.terrainRange.heights;
  let chroma = 0;
  let lowI = 0;
  let highI = 0;
  for (let i = 0; i < heights.length; i++) {
    const r = colors[i * 3];
    const g = colors[i * 3 + 1];
    const b = colors[i * 3 + 2];
    chroma = Math.max(chroma, Math.max(r, g, b) - Math.min(r, g, b));
    if (heights[i] < heights[lowI]) lowI = i;
    if (heights[i] > heights[highI]) highI = i;
  }
  const at = (i) => [colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]];
  return {
    theme: session.theme,
    labelsOn: session.labelsOn,
    chroma,
    lowColor: at(lowI),
    highColor: at(highI),
    clear: session.renderer ? session.renderer.getClearColor(new THREE.Color()).getHexString() : "",
    toneMapping: session.renderer && session.renderer.toneMapping === THREE.ACESFilmicToneMapping ? "ACESFilmic" : "",
    trees: session.treeCount || 0,
    roads: session.layerStats ? session.layerStats.roads : 0,
    pbr: !!(session.terrainMesh && session.terrainMesh.material && session.terrainMesh.material.map),
    buildings: session.buildings.map((record) => ({
      archetype: record.archetype || "",
      osmId: record.osmId,
      kind: record.kind,
      mass: record.mass.material.color.getHexString(),
      roof: record.roof.material.color.getHexString(),
      skirt: record.skirt.material.color.getHexString(),
      edge: record.edge.material.color.getHexString(),
      beacon: !!record.beacon,
    })),
    labelTexts: [...session.labelLayer.querySelectorAll(".map-pill")].map((node) => node.textContent),
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
    if (event.key !== "Escape" || !session || session.root !== shell.root) return;
    event.preventDefault();
    event.stopPropagation();
    if (session.license && !session.license.hidden) {
      session.license.hidden = true;
      const notice = session.attribBar && session.attribBar.querySelector(".map-notice-btn");
      if (notice) notice.setAttribute("aria-expanded", "false");
      layoutLabels();
      return;
    }
    if (session.info && !session.info.hidden) {
      hideDetail();
      return;
    }
    close();
  }, true);
  bind(shell, window, "resize", resize);
  bind(shell, document, "fullscreenchange", () => { if (session) paintChrome(session); });
  mountDirectory(shell);
  try {
    const [osm, terrain, poi, layers] = await Promise.all([
      fetchJson("osm-buildings.json"),
      fetchJson("campus-terrain.json"),
      fetchJson("campus-poi-directory.json"),
      fetchJson("osm-campus-layers.json"),
    ]);
    if (gen !== bootGen || session !== shell) return;
    shell.osm = osm;
    shell.terrain = terrain;
    shell.poi = poi;
    shell.layers = layers;
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
