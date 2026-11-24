/** Directory titles, FAQ buttons, and official-link labels. No DOM, no network. */

const GENERIC_LINK = new Set(["官方说明", "공식 안내", ""]);

const PAGE_LABEL = {
  4218: ["交通指南", "찾아오시는 길"],
  6382: ["楼层配置 ko/6382", "층별 안내 ko/6382"],
  6347: ["楼栋介绍 ko/6347", "건물 안내 ko/6347"],
  6373: ["生活设施 ko/6373", "생활 시설 ko/6373"],
  6362: ["校园设施 ko/6362", "캠퍼스 시설 ko/6362"],
  6365: ["学生服务 ko/6365", "학생 서비스 ko/6365"],
  6338: ["学院介绍 ko/6338", "단과 안내 ko/6338"],
  6398: ["行政办公 ko/6398", "행정 안내 ko/6398"],
  6388: ["场馆介绍 ko/6388", "시설 안내 ko/6388"],
  6392: ["场馆介绍 ko/6392", "시설 안내 ko/6392"],
  4424: ["学事指南 ko/4424", "학사 안내 ko/4424"],
  4311: ["校园生活 ko/4311", "대학 생활 ko/4311"],
  4331: ["校园服务 ko/4331", "캠퍼스 서비스 ko/4331"],
};

const SECTION_LABEL = {
  dorm: ["宿舍官网", "기숙사 안내"],
  museum: ["博物馆官网", "박물관 안내"],
  international: ["国际交流官网", "국제교류 안내"],
  library: ["图书馆页面", "도서관 안내"],
  ipsi: ["招生官网", "입학 안내"],
  cge: ["大学院官网", "대학원 안내"],
  ige: ["国际研究生院", "국제대학원 안내"],
};

export function displayTitle(entry, lang) {
  if (!entry) return "";
  if (entry.faqId === "F41") {
    return lang === "ko" ? "경남대학교 (주소·대표전화)" : "庆南大学（地址与总机）";
  }
  if (lang === "ko") return entry.labelKo || entry.nameKo || "";
  return entry.labelZh || entry.nameZh || "";
}

export function directoryRank(entry) {
  if ((entry.osmBuildingIds || []).length || entry.spatialStatus === "mapped") return 0;
  if (entry.faqId === "F41") return 2;
  return 1;
}

export function faqButtonLabel(entry, lang) {
  const name = displayTitle(entry, lang);
  return lang === "ko" ? `FAQ: ${name}` : `FAQ：${name}`;
}

export function officialLinkLabel(link, entry, lang) {
  const raw = lang === "ko" ? (link.labelKo || "") : (link.labelZh || "");
  if (raw && !GENERIC_LINK.has(raw)) return raw;
  let parsed = null;
  try { parsed = new URL(link.url); } catch (e) { parsed = null; }
  const place = displayTitle(entry, lang);
  if (!parsed) return raw || (link.url || place);
  const host = parsed.hostname.replace(/^www\./, "");
  const parts = parsed.pathname.split("/").filter(Boolean);
  const pageId = parts.find((part) => /^\d+$/.test(part));
  const section = parts[0] && parts[0] !== "ko" ? parts[0] : host.split(".")[0];
  let detail = "";
  if (pageId && PAGE_LABEL[pageId]) detail = PAGE_LABEL[pageId][lang === "ko" ? 1 : 0];
  else if (SECTION_LABEL[section]) detail = SECTION_LABEL[section][lang === "ko" ? 1 : 0];
  else detail = pageId ? `${host}/${pageId}` : host;
  return place ? `${place} · ${detail}` : detail;
}
