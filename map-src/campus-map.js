import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  RED_OSM_ID,
  clampTint,
  lightRig,
  materialSet,
  settleTint,
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
  pointInRing,
  sampleTerrainY,
} from "./placement.mjs";
import {
  EYE_M,
  WALK_TAP_M,
  applyWalkAction,
  footprintBlocked,
  chooseFacadeStand,
  outsideStand,
  stickAxes,
  sweptMove,
  poseFrom,
  lookVector,
  wrapYaw,
  yawFromDirection,
} from "./walk.mjs";
import {
  LOOK_KEY_RPS,
  MOUSE_SENSITIVITY,
  STEP_UP_M,
  THIRD_DISTANCE_M,
  VIEW_FIRST,
  VIEW_THIRD,
  eyePoint,
  keyboardAxes,
  nextView,
  stepPlayer,
  thirdPersonRig,
  turnPlayer,
} from "./player.mjs";
import { applyAvatarLook, buildAvatar, poseAvatar } from "./avatar.mjs";
import {
  avatarKind,
  accountActionVisibility,
  clearAccounts,
  clearMapFavorites,
  clearSiteData,
  createProfile,
  deleteProfile,
  exitProfile,
  favoriteOwner,
  loadBook,
  readMapFavorites,
  toggleFavorite,
  selectProfile,
  setGender,
} from "./local-profile.mjs";

const FAV_KEY = "campus_map_favorites";
const TINT_KEY = "campus_map_tint";
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
    walk: "步行", walkHint: "地面行走", walkStop: "结束行走",
    account: "本机资料", nick: "本地昵称", male: "男", female: "女",
    createProfile: "建立本机资料", useProfile: "选用本机资料",
    localOnly: "只存在这台浏览器，不是网上账号，换设备不会同步，清除网站数据后无法恢复。",
    avatarOnly: "仅用于本机地图小人，不会上传。",
    exitProfile: "退出本机资料", deleteProfile: "注销本机资料",
    clearAccounts: "清空本机账号与记录", clearSite: "清空本站全部本机数据",
    clearSiteNote: "浏览器「清除网站数据」也会全部丢掉、无法找回。",
    publicDevice: "公共设备上请用完后退出或清空，以免下一个人看到这份资料。",
    confirm: "确认", cancel: "取消",
    nickLength: "昵称需要 1 到 20 个字。",
    nickDigits: "请换一个昵称，不要使用手机号或学号这样的长数字。",
    nickDuplicate: "这个昵称在本机已经有了。",
    pickGender: "请选择男或女。这只保存在本机。",
    move: "移动", look: "环顾",
    lookHint: "WASD 移动 · 空格跳跃 · Shift 疾跑 · V 视角 · Esc 退出",
    lockHint: "点击画面锁定鼠标，移动鼠标环顾",
    lockDrag: "此环境无法锁定鼠标。按住画面拖动即可环顾。",
    touchHint: "左侧摇杆移动 · 右侧拖动环顾 · 按钮跳跃",
    jump: "跳跃", view: "视角", viewFirst: "第一人称", viewThird: "第三人称",
    forward: "前进", back: "后退", left: "向左", right: "向右",
    lookUp: "抬头", lookDown: "低头", lookLeft: "向左转", lookRight: "向右转",
    full: "全屏", fullExit: "退出全屏", directory: "目录", search: "搜索地点",
    privacy: "请勿输入学号、手机号等个人信息", clearFav: "清空收藏",
    clearFavAsk: "确认清空收藏？取消则保留当前收藏。",
    storage: "仅保存在本机浏览器，公用设备请清空", fav: "收藏", favOn: "已收藏",
    viewFaq: "查看相关 FAQ", noFaq: "暂无对应 FAQ", textOnly: "文字地点",
    notice: "Copernicus · 数据来源与许可", licenseTitle: "数据来源与许可", loading: "正在加载校园地图…",
    fallback: "当前环境无法显示 3D 模型。可以搜索地点列表，或打开官方校园地图。",
    schematic: "本图为示意图：地势来自约 30 米卫星地表模型（DSM），建筑平面来自 OpenStreetMap 轮廓，楼高为统一示意高度，不是实测地形、实测楼高，也不是导航路线。",
    summary: "地形高程使用 Copernicus WorldDEM-30 公开数据，只用于这张校园示意图。欧盟、ESA、DLR 与 Airbus 不对使用该数据承担责任，也不表示认可本页面。",
    officialMap: "庆南大学 2026 校园地图", ext: "外部官方链接", empty: "没有匹配的地点", phone: "电话",
    dialog: "庆南大学 3D 校园示意图",
    labels: "标注", more: "更多", tint: "色调", cool: "冷", neutral: "默认", warm: "暖",
    expandDetail: "展开详情", collapseDetail: "收起详情",
    floorTitle: "各楼层教室与用途", facilities: "设施", hours: "时间",
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
    walk: "걷기", walkHint: "지면 걷기", walkStop: "걷기 종료",
    account: "로컬 자료", nick: "로컬 별명", male: "남", female: "여",
    createProfile: "로컬 자료 만들기", useProfile: "로컬 자료 선택",
    localOnly: "이 기기의 브라우저에만 저장되며, 온라인 계정이 아닙니다. 다른 기기와 동기화되지 않고, 사이트 데이터를 지우면 복구할 수 없습니다.",
    avatarOnly: "본기기 지도 캐릭터에만 쓰이며, 업로드되지 않습니다.",
    exitProfile: "로컬 자료에서 나가기", deleteProfile: "이 로컬 자료 삭제",
    clearAccounts: "로컬 계정과 기록 모두 삭제", clearSite: "이 사이트의 모든 로컬 데이터 삭제",
    clearSiteNote: "브라우저에서 사이트 데이터를 지워도 모두 사라지며, 다시 찾을 수 없습니다.",
    publicDevice: "공용 기기에서는 사용한 뒤 나가거나 삭제하세요. 다음 사용자가 이 자료를 볼 수 있습니다.",
    confirm: "확인", cancel: "취소",
    nickLength: "별명은 1자에서 20자까지입니다.",
    nickDigits: "전화번호나 학번처럼 긴 숫자는 별명으로 쓸 수 없습니다.",
    nickDuplicate: "이 별명은 이 기기에 이미 있습니다.",
    pickGender: "남 또는 여를 고르세요. 이 기기에만 저장됩니다.",
    move: "이동", look: "둘러보기",
    lookHint: "WASD 이동 · Space 점프 · Shift 달리기 · V 시점 · Esc 나가기",
    lockHint: "화면을 클릭해 마우스를 잠그고 움직여 둘러보세요",
    lockDrag: "이 환경에서는 마우스를 잠글 수 없습니다. 화면을 누른 채 드래그해 둘러보세요.",
    touchHint: "왼쪽 스틱 이동 · 오른쪽 드래그 둘러보기 · 버튼 점프",
    jump: "점프", view: "시점", viewFirst: "1인칭", viewThird: "3인칭",
    forward: "앞으로", back: "뒤로", left: "왼쪽", right: "오른쪽",
    lookUp: "위로", lookDown: "아래로", lookLeft: "왼쪽으로", lookRight: "오른쪽으로",
    full: "전체 화면", fullExit: "전체 화면 종료", directory: "목록", search: "장소 검색",
    privacy: "학번·전화번호 등 개인정보는 입력하지 마세요", clearFav: "즐겨찾기 비우기",
    clearFavAsk: "즐겨찾기를 비울까요? 취소하면 그대로 둡니다.",
    storage: "이 브라우저에만 저장됩니다. 공용 기기에서는 비워 주세요", fav: "즐겨찾기", favOn: "즐겨찾기됨",
    viewFaq: "관련 FAQ 보기", noFaq: "연결된 FAQ 없음", textOnly: "텍스트 안내",
    notice: "Copernicus · 출처·라이선스", licenseTitle: "데이터 출처 및 라이선스", loading: "캠퍼스맵을 불러오는 중…",
    fallback: "이 환경에서는 3D 모형을 표시할 수 없습니다. 장소 목록을 검색하거나 공식 캠퍼스맵을 여세요.",
    schematic: "이 화면은 모식도입니다. 지형은 약 30m 위성 표면모델(DSM)이고 건물 평면은 OpenStreetMap 윤곽이며 건물 높이는 동일한 예시 높이입니다. 측량 지형·높이 또는 길안내 경로가 아닙니다.",
    summary: "지형 고도는 Copernicus WorldDEM-30 공개 자료를 사용하며 이 캠퍼스 모식도에만 씁니다. EU, ESA, DLR, Airbus는 이 자료의 사용에 책임을 지지 않으며 이 페이지를 보증하거나 승인하지 않습니다.",
    officialMap: "경남대 2026 캠퍼스맵", ext: "외부 공식 링크", empty: "일치하는 장소가 없습니다", phone: "전화",
    dialog: "경남대학교 3D 캠퍼스 모식도",
    labels: "라벨", more: "더보기", tint: "색조", cool: "차가움", neutral: "기본", warm: "따뜻함",
    expandDetail: "상세 열기", collapseDetail: "상세 접기",
    floorTitle: "층별 강의실·시설 안내", facilities: "시설", hours: "시간",
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
.map-walk{position:absolute;left:8px;right:8px;bottom:50px;z-index:9;display:flex;justify-content:space-between;align-items:flex-end;pointer-events:none}
.map-walk[hidden]{display:none !important}
.map-pad{pointer-events:auto;display:grid;grid-template-columns:44px 44px 44px;grid-template-rows:44px 44px 44px;gap:4px;touch-action:none}
.map-pad-btn{width:44px;height:44px;min-height:44px;padding:0;font-size:1rem;line-height:1}
.map-pad-btn[data-slot="n"]{grid-column:2;grid-row:1}
.map-pad-btn[data-slot="w"]{grid-column:1;grid-row:2}
.map-pad-btn[data-slot="e"]{grid-column:3;grid-row:2}
.map-pad-btn[data-slot="s"]{grid-column:2;grid-row:3}
.map-modal.is-narrow:not(.dir-collapsed) .map-walk{bottom:calc(48% + 50px)}
.map-modal.is-narrow.info-open .map-walk{bottom:calc(min(62vh, 560px) + 52px)}
.map-modal:not(.is-narrow):not(.dir-collapsed) .map-pad-look{margin-right:324px}
.map-modal:not(.is-narrow).info-open:not(.dir-collapsed) .map-pad-look{margin-right:calc(336px + min(400px,100vw - 360px))}
.map-modal:not(.is-narrow).info-open.dir-collapsed .map-pad-look{margin-right:calc(min(420px,100vw - 24px) + 20px)}
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
.map-modal.is-narrow .map-directory{top:auto;left:0;right:0;width:100%;max-height:48%;border-left:0;border-top:1px solid var(--map-line);padding:10px;transform:none;overflow:auto}
.map-modal.is-narrow .map-list{flex:0 0 auto;overflow:visible}
.map-modal.is-narrow.dir-collapsed .map-directory{display:none}
.map-modal.is-narrow .map-info{z-index:18;left:0;right:0;top:auto;bottom:0;width:100%;max-height:min(62vh,560px);border-radius:12px 12px 0 0}
.map-modal.is-narrow:not(.dir-collapsed) .map-attrib{bottom:calc(48% + 10px)}
.map-modal.is-narrow.info-open .map-attrib{bottom:calc(min(62vh, 560px) + 12px);z-index:12}
html.map-lock,html.map-lock body{overflow:hidden!important;height:100%}
.map-more{display:contents}
.map-more-actions{display:contents}
.map-more-btn{display:inline-flex}
.map-tint{display:none;flex-direction:column;gap:2px;min-width:180px;padding:8px 10px;box-sizing:border-box;color:var(--ink);background:var(--map-panel);border:1px solid var(--map-line);border-radius:12px}
.map-tint-label{font-size:.78rem;font-weight:650}
.map-tint-slider{display:flex;align-items:center;min-height:44px}
.map-tint input{width:100%;height:28px;min-height:0;margin:0;accent-color:#39b9c5}
.map-tint-marks{position:relative;display:block;height:32px}
.map-tint-marks button{position:absolute;top:0;width:auto;min-width:0;height:auto;min-height:32px;padding:0 4px;border:0;background:transparent;color:var(--ink);font:inherit;font-size:.72rem;cursor:pointer;transform:translateX(-50%)}
.map-tint-marks button[data-tint-key="cool"]{left:0;transform:none}
.map-tint-marks button[data-tint-key="neutral"]{left:50%}
.map-tint-marks button[data-tint-key="warm"]{left:100%;transform:translateX(-100%)}
.map-fav-confirm{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px}
.map-fav-confirm[hidden]{display:none !important}
.map-fav-confirm p{margin:0;flex:1 0 100%;font-size:.75rem}
.map-toolbar:has(.map-more.is-open){z-index:20}
.map-more.is-open .map-tint{display:flex;position:absolute;top:48px;left:8px;z-index:30}
.map-toolbar [data-map-action="close"]{order:1}
.map-more [data-map-action="zoom-in"]{order:2}
.map-more [data-map-action="zoom-out"]{order:3}
.map-more [data-map-action="reset"]{order:4}
.map-more [data-map-action="north"]{order:5}
.map-toolbar [data-map-action="walk"]{order:6}
.map-more [data-map-action="full"]{order:7}
.map-toolbar [data-map-action="directory"]{order:8}
.map-more [data-map-action="labels"]{order:9}
.map-intl-pill{order:10}
.map-detail-summary{display:none}
.map-modal.is-narrow.walk-active{top:var(--map-vv-off,0px);height:var(--map-vvh,100dvh);bottom:auto}
.map-modal.is-narrow.walk-active .map-canvas,.map-modal.is-narrow.walk-active .map-labels{top:44px;right:0;bottom:auto;left:0;width:100%;height:calc(100% - 44px - var(--walk-dock,220px))}
.map-modal.is-narrow .map-toolbar{overflow:visible}
.map-modal.is-narrow.walk-active .map-toolbar{top:0;left:0;right:0;height:44px;max-width:none;flex-wrap:nowrap;align-items:stretch;gap:4px;padding:0 6px;z-index:24;overflow:visible}
.map-modal.is-narrow.walk-active .map-toolbar > .map-btn:not(.map-intl-pill),.map-modal.is-narrow.walk-active .map-more-btn{display:inline-flex;align-items:center;justify-content:center;height:44px;min-height:44px;min-width:0;flex:1 1 0;padding:0 6px;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.map-modal.is-narrow.walk-active .map-toolbar [data-map-action="close"]{order:1}
.map-modal.is-narrow.walk-active .map-toolbar [data-map-action="directory"]{order:2}
.map-modal.is-narrow.walk-active .map-toolbar [data-map-action="walk"]{order:3}
.map-modal.is-narrow.walk-active .map-more-btn{order:4}
.map-modal.is-narrow.walk-active .map-toolbar > .map-intl-pill{display:none}
.map-modal.is-narrow.walk-active .map-more{display:none;position:absolute;top:48px;right:6px;z-index:25;min-width:168px;padding:6px;border-radius:12px;background:var(--map-panel);border:1px solid var(--map-line);box-sizing:border-box}
.map-modal.is-narrow.walk-active .map-more.is-open{display:flex;flex-direction:column;gap:4px;max-height:min(220px,34vh);overflow:auto;width:min(240px,calc(100% - 16px))}
.map-modal.is-narrow:not(.walk-active) .map-more.is-open{display:flex;flex-direction:column;gap:4px;position:absolute;top:calc(100% + 4px);right:0;left:auto;z-index:30;width:min(240px,calc(100% - 12px));max-height:min(220px,36vh);overflow:auto;padding:8px;border-radius:12px;background:var(--map-panel);border:1px solid var(--map-line);box-sizing:border-box}
.map-modal.is-narrow .map-more.is-open .map-tint{position:static;width:100%;min-width:0;border:0;background:transparent;padding:4px 2px 8px}
.map-modal.is-narrow.walk-active .map-more-actions,.map-modal.is-narrow:not(.walk-active) .map-more.is-open .map-more-actions{display:flex;flex-direction:column;gap:4px}
.map-modal.is-narrow.walk-active .map-more .map-btn:not(.map-tint-mark){width:100%;min-height:44px;height:44px;order:0}
.map-stick{position:absolute;z-index:12;left:calc(12px + env(safe-area-inset-left));bottom:calc(44px + env(safe-area-inset-bottom));width:104px;height:104px;touch-action:none;pointer-events:auto}
.map-stick[hidden]{display:none !important}
.map-stick-base{position:relative;width:104px;height:104px;border-radius:50%;background:rgba(18,24,30,.28);border:1px solid rgba(57,185,197,.5)}
.map-stick-knob{position:absolute;left:30px;top:30px;width:44px;height:44px;border-radius:50%;background:rgba(57,185,197,.8)}
.map-look-hint{position:absolute;z-index:6;top:56px;left:50%;transform:translateX(-50%);margin:0;padding:4px 10px;border-radius:8px;background:rgba(18,24,30,.5);color:#f4f7fb;font-size:12px;line-height:1.3;pointer-events:none;white-space:nowrap}
.map-modal.is-narrow .map-look-hint{display:none}
.map-crosshair{position:absolute;left:50%;top:50%;z-index:13;width:22px;height:22px;margin:-11px 0 0 -11px;pointer-events:none;opacity:.92}
.map-crosshair[hidden]{display:none !important}
.map-crosshair::before,.map-crosshair::after{content:"";position:absolute;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.55)}
.map-crosshair::before{left:10px;top:0;width:2px;height:22px}
.map-crosshair::after{top:10px;left:0;height:2px;width:22px}
.map-lock-hint{position:absolute;z-index:13;left:50%;top:84px;transform:translateX(-50%);margin:0;padding:6px 12px;border-radius:8px;background:rgba(18,24,30,.62);color:#f4f7fb;font-size:12px;line-height:1.3;pointer-events:none;white-space:nowrap}
.map-lock-hint[hidden]{display:none !important}
.map-modal.is-narrow .map-lock-hint{display:none !important}
.map-touch-hint{position:absolute;z-index:13;left:50%;top:48px;transform:translateX(-50%);margin:0;padding:4px 8px;border-radius:8px;background:rgba(18,24,30,.55);color:#f4f7fb;font-size:11px;line-height:1.3;pointer-events:none;white-space:normal;text-align:center;display:none;max-width:min(240px,calc(100% - 136px));box-sizing:border-box}
.map-touch-hint[hidden]{display:none !important}
.map-modal.is-narrow.walk-active .map-touch-hint{display:block}
.map-jump{position:absolute;z-index:13;right:calc(16px + env(safe-area-inset-right));bottom:calc(44px + 32px + 18px + env(safe-area-inset-bottom));width:64px;height:64px;border-radius:50%;border:1px solid rgba(57,185,197,.55);background:rgba(18,24,30,.55);color:#f4f7fb;font:600 12px/1.1 inherit;display:none;align-items:center;justify-content:center;padding:0;touch-action:none;pointer-events:auto;backdrop-filter:blur(6px);box-shadow:0 2px 12px rgba(0,0,0,.25)}
.map-jump[hidden]{display:none !important}
.map-modal.is-narrow.walk-active .map-jump{display:flex;bottom:calc(var(--walk-summary) + 32px + 18px + env(safe-area-inset-bottom))}
.map-modal.is-locked .map-canvas{cursor:none}
.map-account-btn{display:inline-flex}
.map-modal.is-narrow .map-account-btn,.map-modal.is-narrow.walk-active .map-toolbar > .map-btn.map-account-btn{display:none !important}
.map-account-pop{display:none;position:absolute;z-index:28;top:52px;left:8px;width:240px;max-height:min(46vh,320px);overflow:auto;padding:10px;box-sizing:border-box;background:var(--map-panel);border:1px solid var(--map-line);border-radius:12px;color:var(--ink)}
.map-account-pop.is-open{display:block}
.map-modal.is-narrow .map-account-pop{display:none !important}
.map-account-form{display:flex;flex-direction:column;gap:6px;font-size:.78rem}
.map-modal.is-narrow .map-account-slot .map-account-form{display:none}
.map-modal.is-narrow .map-more.is-open .map-account-slot .map-account-form{display:flex}
.map-account-form input,.map-account-form select{min-height:44px;width:100%;box-sizing:border-box;font:inherit}
.map-account-form p{margin:0}
.map-account-row{display:flex;gap:6px}
.map-account-row button{flex:1}
.map-account-confirm{display:flex;flex-direction:column;gap:6px;padding:8px;border:1px solid var(--map-line);border-radius:8px}
.map-account-confirm[hidden]{display:none !important}
.map-modal.is-narrow.walk-active{--walk-summary:0px;--walk-dock:var(--walk-summary)}
.map-modal.is-narrow.walk-active.detail-collapsed{--walk-summary:44px}
.map-modal.is-narrow.walk-active.detail-open{--walk-summary:min(180px,30vh)}
.map-modal.is-narrow.walk-active .map-walk{display:none !important}
.map-modal.is-narrow.walk-active .map-attrib{left:6px;right:6px;bottom:calc(var(--walk-summary) + 6px);max-width:none;z-index:14}
.map-modal.is-narrow.walk-active .map-attrib-bar{width:100%;height:32px}
.map-modal.is-narrow.walk-active .map-stick{bottom:calc(var(--walk-summary) + 32px + 18px)}
.map-modal.is-narrow.walk-active .map-license{left:0;width:min(100%,440px);bottom:40px;max-height:min(46vh,calc(var(--map-vvh,100dvh) * 0.4))}
.map-modal.is-narrow.walk-active .map-directory{z-index:26}
.map-modal.is-narrow.walk-active.detail-collapsed .map-info,.map-modal.is-narrow.walk-active.detail-open .map-info{top:auto;left:0;right:0;bottom:0;width:100%;height:var(--walk-summary);max-height:var(--walk-summary);padding:0;overflow:auto;border-radius:8px 8px 0 0;z-index:15}
.map-modal.is-narrow.walk-active.detail-collapsed .map-info > :not(.map-detail-summary){display:none}
.map-modal.is-narrow.walk-active .map-detail-summary{display:flex;width:100%;height:44px;min-height:44px;align-items:center;justify-content:space-between;gap:8px;padding:0 12px;position:sticky;top:0;z-index:2}
.map-summary-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.map-summary-action{flex:0 0 auto;font-size:.75rem}
.map-modal.is-narrow.walk-active.detail-open .map-info{padding:0 0 8px}
`;

let session = null;
let bootGen = 0;
let styleNode = null;

function t() {
  return TEXT[session && session.lang === "ko" ? "ko" : "zh"];
}

const browserStore = {
  getItem(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  },
  setItem(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* private mode */ }
  },
  removeItem(key) {
    try { localStorage.removeItem(key); } catch (e) { /* private mode */ }
  },
  get length() {
    try { return localStorage.length; } catch (e) { return 0; }
  },
  key(index) {
    try { return localStorage.key(index); } catch (e) { return null; }
  },
};

function readFavs() {
  return readMapFavorites(browserStore);
}

function bindFavs(shell) {
  if (!shell) return;
  shell.favorites = readFavs();
  shell.favOwner = favoriteOwner(browserStore);
}

function readTint() {
  try {
    const raw = localStorage.getItem(TINT_KEY);
    if (raw == null || raw === "") return 0;
    return clampTint(raw);
  } catch (e) {
    return 0;
  }
}

function writeTint(value) {
  try {
    localStorage.setItem(TINT_KEY, String(value));
  } catch (e) {
    /* on-device only */
  }
}

function applyCast(shell) {
  if (!shell) return;
  applyAtmosphereTheme(shell);
  paintBuildings();
  repaintTerrainColors(shell);
  poke();
}

function clearFavStorage() {
  clearMapFavorites(browserStore);
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
  const walkUi = document.createElement("div");
  walkUi.className = "map-walk";
  walkUi.hidden = true;
  const stick = document.createElement("div");
  stick.className = "map-stick";
  stick.hidden = true;
  stick.setAttribute("role", "application");
  const stickBase = document.createElement("div");
  stickBase.className = "map-stick-base";
  const knob = document.createElement("div");
  knob.className = "map-stick-knob";
  stickBase.appendChild(knob);
  stick.appendChild(stickBase);
  const lookHint = document.createElement("p");
  lookHint.className = "map-look-hint";
  lookHint.hidden = true;
  const touchHint = document.createElement("p");
  touchHint.className = "map-touch-hint";
  touchHint.hidden = true;
  const lockHint = document.createElement("p");
  lockHint.className = "map-lock-hint";
  lockHint.hidden = true;
  const crosshair = document.createElement("div");
  crosshair.className = "map-crosshair";
  crosshair.hidden = true;
  const jumpBtn = document.createElement("button");
  jumpBtn.type = "button";
  jumpBtn.className = "map-jump";
  jumpBtn.hidden = true;
  const jumpGlyph = document.createElement("span");
  jumpGlyph.setAttribute("aria-hidden", "true");
  jumpGlyph.textContent = "▲";
  jumpBtn.appendChild(jumpGlyph);
  const attrib = document.createElement("div");
  attrib.className = "map-attrib";
  const attribBar = document.createElement("div");
  attribBar.className = "map-attrib-bar";
  const license = document.createElement("div");
  license.className = "map-license";
  license.hidden = true;
  attrib.append(attribBar, license);
  stage.append(canvas, status, fallback, labelLayer, walkUi, stick, lookHint, touchHint, lockHint, crosshair, jumpBtn, toolbar, directory, info);
  root.append(stage, attrib);
  const shell = {
    root, stage, canvas, status, fallback, toolbar, directory, info, labelLayer, walkUi, stick, knob, lookHint, touchHint, lockHint, crosshair, jumpBtn, attrib, attribBar, license,
    lang, theme: opts.theme === "dark" ? "dark" : "light", tint: readTint(),
    onOpenFaq: opts.onOpenFaq, faqId: opts.faqId || "",
    favorites: readFavs(), favOwner: favoriteOwner(browserStore), category: "all", query: "", labelsOn: true,
    unbinds: [], buildings: [], pickables: [], webgl: false, glDisposed: false,
    raf: 0, interacting: false, tween: null, selectedId: null, hoverId: null,
    detailEntries: null, detailFocus: null, detailBuilding: null, detailExpanded: false,
    renderer: null, controls: null, scene: null, camera: null, avatar: null,
    touch: window.matchMedia ? window.matchMedia("(pointer: coarse)").matches : false,
    locked: false,
    walk: {
      active: false, x: 0, z: 0, y: 0, vy: 0, grounded: true, groundY: 0,
      yaw: 0, pitch: -0.2, view: VIEW_THIRD, eye: EYE_M,
      held: new Set(), heldAt: 0, t: 0, phase: 0, speed: 0,
      focusId: null, drag: null, lookId: null, stick: null, eyeY: 0,
      sprint: false, jumpQueued: false,
    },
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

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function mountAccount(shell) {
  const pop = el("div", "map-account-pop");
  const form = el("div", "map-account-form");
  form.addEventListener("click", (event) => event.stopPropagation());
  form.addEventListener("pointerdown", (event) => event.stopPropagation());
  const notice = el("p", "map-account-notice");
  const avatarNote = el("p", "map-account-avatar");
  const nickLabel = el("label", "map-account-label");
  const nick = document.createElement("input");
  nick.type = "text";
  nick.maxLength = 20;
  nick.autocomplete = "off";
  nick.className = "map-account-nick";
  const genders = el("div", "map-account-row");
  const male = button("", "map-btn");
  const female = button("", "map-btn");
  male.dataset.gender = "male";
  female.dataset.gender = "female";
  genders.append(male, female);
  const message = el("p", "map-account-message");
  const createBtn = button("", "map-btn");
  const pick = document.createElement("select");
  pick.className = "map-account-pick";
  const useBtn = button("", "map-btn");
  const who = el("p", "map-account-who");
  const genderLive = el("div", "map-account-row");
  const maleLive = button("", "map-btn");
  const femaleLive = button("", "map-btn");
  maleLive.dataset.gender = "male";
  femaleLive.dataset.gender = "female";
  genderLive.append(maleLive, femaleLive);
  const actions = el("div", "map-account-actions");
  const exitBtn = button("", "map-btn");
  const deleteBtn = button("", "map-btn");
  const clearBtn = button("", "map-btn");
  const wipeBtn = button("", "map-btn");
  actions.append(exitBtn, deleteBtn, clearBtn, wipeBtn);
  const warn = el("p", "map-account-public");
  const confirmBox = el("div", "map-account-confirm");
  confirmBox.hidden = true;
  const confirmText = el("p", "");
  const confirmRow = el("div", "map-account-row");
  const confirmYes = button("", "map-btn");
  const confirmNo = button("", "map-btn");
  confirmRow.append(confirmYes, confirmNo);
  confirmBox.append(confirmText, confirmRow);
  form.append(notice, avatarNote, nickLabel, nick, genders, message, createBtn, pick, useBtn, who, genderLive, warn, actions, confirmBox);
  pop.appendChild(form);
  shell.stage.appendChild(pop);
  shell.accountPop = pop;
  shell.accountForm = form;
  shell.accountNodes = {
    notice, avatarNote, nickLabel, nick, male, female, message, createBtn, pick, useBtn, who,
    maleLive, femaleLive, exitBtn, deleteBtn, clearBtn, wipeBtn, warn, confirmBox, confirmText, confirmYes, confirmNo,
  };
  let pending = "";
  const refresh = () => paintAccount(shell);
  const choose = (gender) => {
    shell.accountGender = gender;
    paintAccount(shell);
  };
  male.addEventListener("click", () => choose("male"));
  female.addEventListener("click", () => choose("female"));
  maleLive.addEventListener("click", () => {
    setGender(browserStore, "male");
    refreshAvatar(shell);
    paintAccount(shell);
  });
  femaleLive.addEventListener("click", () => {
    setGender(browserStore, "female");
    refreshAvatar(shell);
    paintAccount(shell);
  });
  createBtn.addEventListener("click", () => {
    const result = createProfile(browserStore, { nickname: nick.value, gender: shell.accountGender || "" });
    shell.accountMessage = result.ok ? "" : result.error;
    if (result.ok) {
      nick.value = "";
      bindFavs(shell);
      renderDirectory();
      refreshAvatar(shell);
    }
    paintAccount(shell);
  });
  useBtn.addEventListener("click", () => {
    const result = selectProfile(browserStore, pick.value);
    if (result.ok) {
      bindFavs(shell);
      renderDirectory();
      refreshAvatar(shell);
    }
    paintAccount(shell);
  });
  const ask = (action, text) => {
    pending = action;
    confirmText.textContent = text;
    confirmBox.hidden = false;
  };
  exitBtn.addEventListener("click", () => ask("exit", shell.accountNodes.exitBtn.textContent));
  deleteBtn.addEventListener("click", () => ask("delete", shell.accountNodes.deleteBtn.textContent));
  clearBtn.addEventListener("click", () => ask("clear", shell.accountNodes.clearBtn.textContent));
  wipeBtn.addEventListener("click", () => ask("wipe", shell.accountNodes.wipeBtn.textContent + " " + (TEXT[shell.lang].clearSiteNote || "")));
  confirmNo.addEventListener("click", () => {
    pending = "";
    confirmBox.hidden = true;
  });
  confirmYes.addEventListener("click", () => {
    if (pending === "exit") exitProfile(browserStore);
    else if (pending === "delete") deleteProfile(browserStore);
    else if (pending === "clear") clearAccounts(browserStore);
    else if (pending === "wipe") {
      clearSiteData(browserStore);
      shell.tint = 0;
      if (shell.tintInput) shell.tintInput.value = "0";
      applyCast(shell);
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
    }
    pending = "";
    confirmBox.hidden = true;
    bindFavs(shell);
    if (shell.list) renderDirectory();
    refreshAvatar(shell);
    paintAccount(shell);
  });
  syncAccountPlace(shell);
  paintAccount(shell);
}

function syncAccountPlace(shell) {
  if (!shell || !shell.accountForm || !shell.accountSlot || !shell.accountPop) return;
  const narrow = shell.root.classList.contains("is-narrow");
  const parent = narrow ? shell.accountSlot : shell.accountPop;
  if (shell.accountForm.parentElement !== parent) parent.appendChild(shell.accountForm);
}

function paintAccount(shell) {
  const copy = TEXT[shell.lang];
  const nodes = shell.accountNodes;
  if (!nodes) return;
  if (shell.accountBtn) shell.accountBtn.textContent = copy.account;
  nodes.notice.textContent = copy.localOnly;
  nodes.avatarNote.textContent = copy.avatarOnly;
  nodes.nickLabel.textContent = copy.nick;
  nodes.nick.setAttribute("aria-label", copy.nick);
  nodes.male.textContent = copy.male;
  nodes.female.textContent = copy.female;
  nodes.male.setAttribute("aria-pressed", shell.accountGender === "male" ? "true" : "false");
  nodes.female.setAttribute("aria-pressed", shell.accountGender === "female" ? "true" : "false");
  nodes.createBtn.textContent = copy.createProfile;
  nodes.useBtn.textContent = copy.useProfile;
  nodes.maleLive.textContent = copy.male;
  nodes.femaleLive.textContent = copy.female;
  nodes.exitBtn.textContent = copy.exitProfile;
  nodes.deleteBtn.textContent = copy.deleteProfile;
  nodes.clearBtn.textContent = copy.clearAccounts;
  nodes.wipeBtn.textContent = copy.clearSite;
  nodes.warn.textContent = copy.publicDevice;
  nodes.confirmYes.textContent = copy.confirm;
  nodes.confirmNo.textContent = copy.cancel;
  const book = loadBook(browserStore);
  const active = book.profiles.find((item) => item.id === book.activeId) || null;
  const guest = !active;
  nodes.nick.hidden = !guest;
  nodes.nickLabel.hidden = !guest;
  nodes.male.parentElement.hidden = !guest;
  nodes.createBtn.hidden = !guest;
  nodes.pick.hidden = !guest || book.profiles.length === 0;
  nodes.useBtn.hidden = !guest || book.profiles.length === 0;
  nodes.who.hidden = guest;
  nodes.maleLive.parentElement.hidden = guest;
  const shown = accountActionVisibility(!guest);
  nodes.exitBtn.hidden = !shown.exit;
  nodes.deleteBtn.hidden = !shown.deleteProfile;
  nodes.clearBtn.hidden = !shown.clearAccounts;
  nodes.wipeBtn.hidden = !shown.clearSite;
  nodes.who.textContent = active ? active.nickname : "";
  nodes.maleLive.setAttribute("aria-pressed", active && active.gender === "male" ? "true" : "false");
  nodes.femaleLive.setAttribute("aria-pressed", active && active.gender === "female" ? "true" : "false");
  nodes.pick.replaceChildren();
  for (const profile of book.profiles) {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.nickname;
    nodes.pick.appendChild(option);
  }
  const errors = {
    length: copy.nickLength,
    digits: copy.nickDigits,
    duplicate: copy.nickDuplicate,
    gender: copy.pickGender,
  };
  nodes.message.textContent = errors[shell.accountMessage] || "";
  if (!nodes.confirmBox.hidden && nodes.confirmText.textContent === "") nodes.confirmBox.hidden = true;
}

function refreshAvatar(shell) {
  if (!shell || !shell.avatar) return;
  applyAvatarLook(shell.avatar, avatarKind(browserStore));
  paintAvatar(shell);
  poke();
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
    ["walk", copy.walk],
    ["full", full ? copy.fullExit : copy.full],
    ["directory", copy.directory],
    ["labels", copy.labels],
    ["view", copy.view],
  ];
  if (!shell.toolbar.childElementCount) {
    const morePanel = document.createElement("div");
    morePanel.className = "map-more";
    const moreBtn = button(copy.more, "map-btn map-more-btn");
    moreBtn.dataset.mapAction = "more";
    moreBtn.setAttribute("aria-expanded", "false");
    moreBtn.setAttribute("aria-haspopup", "true");
    const tint = document.createElement("div");
    tint.className = "map-tint";
    const tintLabel = document.createElement("span");
    tintLabel.className = "map-tint-label";
    tintLabel.textContent = copy.tint;
    const tintInput = document.createElement("input");
    tintInput.type = "range";
    tintInput.min = "-1";
    tintInput.max = "1";
    tintInput.step = "0.01";
    tintInput.value = String(shell.tint || 0);
    tintInput.setAttribute("aria-label", copy.tint);
    const tintSlider = document.createElement("div");
    tintSlider.className = "map-tint-slider";
    tintSlider.appendChild(tintInput);
    const marks = document.createElement("div");
    marks.className = "map-tint-marks";
    for (const key of ["cool", "neutral", "warm"]) {
      const mark = button(copy[key], "map-tint-mark");
      mark.dataset.mapAction = "tint";
      mark.dataset.tint = key === "cool" ? "-1" : key === "warm" ? "1" : "0";
      mark.dataset.tintKey = key;
      marks.appendChild(mark);
    }
    tint.append(tintLabel, tintSlider, marks);
    const previewCast = () => {
      if (!session) return;
      session.tint = clampTint(tintInput.value);
      applyCast(session);
    };
    tintInput.addEventListener("input", previewCast);
    tintInput.addEventListener("change", () => {
      if (!session) return;
      const next = settleTint(tintInput.value);
      session.tint = next;
      tintInput.value = String(next);
      writeTint(next);
      applyCast(session);
    });
    tintInput.addEventListener("pointerdown", (event) => event.stopPropagation());
    const actions = document.createElement("div");
    actions.className = "map-more-actions";
    const accountSlot = document.createElement("div");
    accountSlot.className = "map-account-slot";
    shell.accountSlot = accountSlot;
    morePanel.append(tint, accountSlot, actions);
    shell.tintLabel = tintLabel;
    shell.tintInput = tintInput;
    shell.tintMarks = marks;
    const inRow = new Set(["close", "directory", "walk"]);
    for (const [key, label] of specs) {
      const node = button(label, "map-btn");
      node.dataset.mapAction = key;
      if (key === "zoom-in") node.title = copy.zoomIn;
      if (key === "zoom-out") node.title = copy.zoomOut;
      if (key === "labels") node.setAttribute("aria-pressed", shell.labelsOn ? "true" : "false");
      if (inRow.has(key)) shell.toolbar.appendChild(node);
      else actions.appendChild(node);
    }
    shell.moreBtn = moreBtn;
    shell.morePanel = morePanel;
    shell.toolbar.append(moreBtn, morePanel);
    const accountBtn = button(copy.account, "map-btn map-account-btn");
    accountBtn.dataset.mapAction = "account";
    accountBtn.setAttribute("aria-expanded", "false");
    shell.accountBtn = accountBtn;
    shell.toolbar.appendChild(accountBtn);
    mountAccount(shell);
    shell.intlPill = makeIntlButton("map-btn map-intl-pill");
    shell.toolbar.appendChild(shell.intlPill);
    shell.intlPill.addEventListener("click", () => openInternational());
    shell.toolbar.addEventListener("click", (event) => {
      const node = event.target.closest("button");
      if (!node || !session || node.classList.contains("map-intl-pill")) return;
      if (node.closest(".map-account-form")) return;
      const action = node.dataset.mapAction;
      if (action === "account") {
        if (shell.accountPop) shell.accountPop.classList.toggle("is-open");
        accountBtn.setAttribute("aria-expanded", shell.accountPop && shell.accountPop.classList.contains("is-open") ? "true" : "false");
        return;
      }
      if (action === "more") {
        const open = shell.morePanel.classList.toggle("is-open");
        shell.moreBtn.setAttribute("aria-expanded", open ? "true" : "false");
        return;
      }
      if (action === "tint") {
        const next = settleTint(node.dataset.tint);
        session.tint = next;
        if (shell.tintInput) shell.tintInput.value = String(next);
        writeTint(next);
        applyCast(session);
        return;
      }
      if (shell.morePanel) {
        shell.morePanel.classList.remove("is-open");
        shell.moreBtn.setAttribute("aria-expanded", "false");
      }
      if (action === "close") close();
      else if (action === "zoom-in") zoomBy(0.82);
      else if (action === "zoom-out") zoomBy(1.22);
      else if (action === "reset") frameCampus();
      else if (action === "north") faceNorth();
      else if (action === "walk") toggleWalk();
      else if (action === "full") toggleFull();
      else if (action === "directory") {
        session.root.classList.toggle("dir-collapsed");
        layoutLabels();
      } else if (action === "labels") {
        session.labelsOn = !session.labelsOn;
        node.setAttribute("aria-pressed", session.labelsOn ? "true" : "false");
        layoutLabels();
        poke();
      } else if (action === "view") {
        toggleView();
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
    if (shell.moreBtn) shell.moreBtn.textContent = copy.more;
    if (shell.tintLabel) shell.tintLabel.textContent = copy.tint;
    if (shell.tintInput) shell.tintInput.setAttribute("aria-label", copy.tint);
    if (shell.tintMarks) {
      for (const mark of shell.tintMarks.querySelectorAll("button")) {
        const key = mark.dataset.tintKey;
        if (key && copy[key]) mark.textContent = copy[key];
      }
    }
  }
  paintIntl(shell);
  if (shell.search) {
    shell.search.placeholder = copy.search;
    shell.search.setAttribute("aria-label", copy.search);
    shell.privacy.textContent = copy.privacy;
    shell.clearFav.textContent = copy.clearFav;
    if (shell.favConfirmText) shell.favConfirmText.textContent = copy.clearFavAsk;
    if (shell.favYes) shell.favYes.textContent = copy.confirm;
    if (shell.favNo) shell.favNo.textContent = copy.cancel;
    shell.storage.textContent = copy.storage;
    for (const node of shell.filters.querySelectorAll("button")) {
      node.textContent = copy.cats[node.dataset.cat];
    }
  }
  shell.status.textContent = copy.loading;
  if (!shell.fallback.hidden) shell.fallback.textContent = copy.fallback;
  syncAccountPlace(shell);
  paintAccount(shell);
  paintWalkUi(shell);
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
  const favConfirm = document.createElement("div");
  favConfirm.className = "map-fav-confirm";
  favConfirm.hidden = true;
  const favConfirmText = document.createElement("p");
  favConfirmText.textContent = copy.clearFavAsk;
  const favYes = button(copy.confirm, "map-btn");
  const favNo = button(copy.cancel, "map-btn");
  favConfirm.append(favConfirmText, favYes, favNo);
  shell.favConfirm = favConfirm;
  shell.favConfirmText = favConfirmText;
  shell.favYes = favYes;
  shell.favNo = favNo;
  const storage = document.createElement("p");
  storage.className = "map-storage";
  storage.textContent = copy.storage;
  shell.directory.replaceChildren(banner, search, privacy, filters, list, clearFav, favConfirm, storage);
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
  favNo.addEventListener("click", () => {
    favConfirm.hidden = true;
  });
  favYes.addEventListener("click", () => {
    if (!session || favConfirm.hidden) return;
    favConfirm.hidden = true;
    session.favorites = new Set();
    clearFavStorage();
    renderDirectory();
    refreshDetail();
  });
  clearFav.addEventListener("click", () => {
    if (!session) return;
    const confirm = session.directory.querySelector(".map-fav-confirm");
    if (confirm) confirm.hidden = false;
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
  session.detailExpanded = false;
  session.root.classList.remove("info-open");
  session.detailEntries = null;
  session.detailFocus = null;
  session.detailBuilding = null;
  syncWalkChrome(session);
  layoutLabels();
}

function appendDetailSummary(shell, title, noMesh) {
  const btn = button("", "map-btn map-detail-summary");
  const name = document.createElement("span");
  name.className = "map-summary-name";
  name.textContent = title;
  const action = document.createElement("span");
  action.className = "map-summary-action";
  btn.append(name, action);
  if (noMesh) {
    const badge = document.createElement("span");
    badge.className = "map-badge";
    badge.textContent = t().noMesh;
    btn.append(badge);
  }
  btn.addEventListener("click", () => {
    if (!session) return;
    session.detailExpanded = !session.detailExpanded;
    syncWalkChrome(session);
  });
  shell.info.appendChild(btn);
}

function syncWalkChrome(shell) {
  if (!shell || !shell.root) return;
  const active = !!(shell.walk && shell.walk.active);
  const narrow = shell.root.classList.contains("is-narrow");
  const phoneWalk = active && narrow;
  const hasDetail = !!(shell.info && !shell.info.hidden);
  shell.root.classList.toggle("walk-active", phoneWalk);
  shell.root.classList.toggle("detail-collapsed", phoneWalk && hasDetail && !shell.detailExpanded);
  shell.root.classList.toggle("detail-open", phoneWalk && hasDetail && !!shell.detailExpanded);
  const summary = shell.info && shell.info.querySelector(".map-detail-summary");
  if (summary) {
    const action = summary.querySelector(".map-summary-action");
    if (action) action.textContent = " · " + (shell.detailExpanded ? t().collapseDetail : t().expandDetail);
    summary.setAttribute("aria-expanded", shell.detailExpanded ? "true" : "false");
  }
  const vv = window.visualViewport;
  const height = vv && vv.height ? Math.round(vv.height) : (shell.root.clientHeight || window.innerHeight);
  const off = vv && Number.isFinite(vv.offsetTop) ? Math.round(vv.offsetTop) : 0;
  shell.root.style.setProperty("--map-vvh", height + "px");
  shell.root.style.setProperty("--map-vv-off", off + "px");
  requestAnimationFrame(() => {
    if (session === shell) resize();
  });
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
  appendDetailSummary(shell, name, false);
  syncWalkChrome(shell);
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
  const intl = list.some((entry) => entry.faqId === "F86" || entry.faqId === "F83");
  appendDetailSummary(shell, title, !mapped && intl);
  layoutLabels();
  syncWalkChrome(shell);
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
    toggleFavorite(session, browserStore, key);
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
  shell.detailExpanded = false;
  shell.selectedId = osmId;
  paintBuildings();
  const focus = (faqId && record.entries.find((entry) => entry.faqId === faqId)) || record.entries[0] || null;
  if (record.entries.length) showDetail(record.entries, focus, record.building);
  else showUnlinked(record.building);
  if (faqId && shell.list) {
    const row = shell.list.querySelector(`[data-faq-id="${faqId}"]`);
    if (row && row.scrollIntoView) row.scrollIntoView({ block: "nearest" });
  }
  if (shell.camera && shell.terrain) walkToBuilding(record);
}

function focusFaq(faqId) {
  const shell = session;
  if (!shell || !shell.poi || !faqId) return;
  const entry = shell.poi.entries.find((item) => item.faqId === faqId);
  if (!entry) return;
  activateEntry(entry);
}

const MOVE_SLOTS = [
  ["forward", "n", "▲"],
  ["left", "w", "◀"],
  ["right", "e", "▶"],
  ["back", "s", "▼"],
];
const LOOK_SLOTS = [
  ["look-up", "n", "▲"],
  ["look-left", "w", "◀"],
  ["look-right", "e", "▶"],
  ["look-down", "s", "▼"],
];
const WALK_KEYS = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyS: "back",
  ArrowDown: "back",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  KeyQ: "look-left",
  KeyE: "look-right",
  KeyR: "look-up",
  KeyF: "look-down",
};

function makePad(kind, slots) {
  const pad = document.createElement("div");
  pad.className = "map-pad map-pad-" + kind;
  pad.dataset.pad = kind;
  pad.setAttribute("role", "group");
  for (const [action, slot, glyph] of slots) {
    const node = button(glyph, "map-btn map-pad-btn");
    node.dataset.walk = action;
    node.dataset.slot = slot;
    node.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      try { node.setPointerCapture(event.pointerId); } catch (e) { /* already released */ }
      holdWalk(action, true);
    });
    const release = (event) => {
      holdWalk(action, false);
      try {
        if (node.hasPointerCapture(event.pointerId)) node.releasePointerCapture(event.pointerId);
      } catch (e) { /* pointer already gone */ }
    };
    node.addEventListener("pointerup", release);
    node.addEventListener("pointercancel", release);
    pad.appendChild(node);
  }
  return pad;
}

function paintWalkUi(shell) {
  if (!shell || !shell.walkUi) return;
  const copy = TEXT[shell.lang];
  const on = !!(shell.walk && shell.walk.active);
  const narrow = shell.root.classList.contains("is-narrow");
  const walk = shell.walk || {};
  const third = walk.view === VIEW_THIRD;
  shell.walkUi.hidden = true;
  if (shell.stick) {
    shell.stick.hidden = !on;
    shell.stick.setAttribute("aria-label", copy.move);
  }
  if (shell.lookHint) {
    shell.lookHint.hidden = !on;
    shell.lookHint.textContent = copy.lookHint;
  }
  if (shell.touchHint) {
    shell.touchHint.hidden = !on;
    shell.touchHint.textContent = copy.touchHint;
  }
  if (shell.lockHint) {
    const touch = narrow || isTouchControl(shell);
    shell.lockHint.hidden = !on || touch || shell.locked;
    shell.lockHint.textContent = shell.lockFailed ? copy.lockDrag : copy.lockHint;
  }
  if (shell.crosshair) shell.crosshair.hidden = !on;
  if (shell.jumpBtn) {
    shell.jumpBtn.hidden = !on || !narrow;
    shell.jumpBtn.setAttribute("aria-label", copy.jump);
    shell.jumpBtn.title = copy.jump;
  }
  const move = shell.walkUi.querySelector(".map-pad-move");
  const look = shell.walkUi.querySelector(".map-pad-look");
  if (move) move.setAttribute("aria-label", copy.move);
  if (look) look.setAttribute("aria-label", copy.look);
  const labels = {
    forward: copy.forward,
    back: copy.back,
    left: copy.left,
    right: copy.right,
    "look-up": copy.lookUp,
    "look-down": copy.lookDown,
    "look-left": copy.lookLeft,
    "look-right": copy.lookRight,
  };
  for (const node of shell.walkUi.querySelectorAll("[data-walk]")) {
    const label = labels[node.dataset.walk] || "";
    node.setAttribute("aria-label", label);
    node.title = label;
  }
  const walkBtn = shell.toolbar && shell.toolbar.querySelector("[data-map-action='walk']");
  if (walkBtn) {
    walkBtn.setAttribute("aria-pressed", on ? "true" : "false");
    walkBtn.title = on ? copy.walkStop : copy.walkHint;
    walkBtn.textContent = on ? copy.walkStop : copy.walk;
  }
  const viewBtn = shell.toolbar && shell.toolbar.querySelector("[data-map-action='view']");
  if (viewBtn) {
    viewBtn.textContent = on ? (third ? copy.viewFirst : copy.viewThird) : copy.view;
    viewBtn.title = viewBtn.textContent;
    viewBtn.setAttribute("aria-pressed", third ? "true" : "false");
  }
  syncWalkChrome(shell);
}

function buildingRings(shell) {
  return shell.buildings.map((record) => record.building.footprintXZ);
}

const BODY_RADIUS_M = 0.42;
let groundRay = null;

function surfaceY(shell, x, z) {
  const smooth = shell && typeof shell.sampleHeight === "function"
    ? shell.sampleHeight(x, z)
    : sampleTerrainY(shell.terrain, x, z);
  if (!shell || !shell.terrainMesh) return smooth;
  if (!groundRay) groundRay = new THREE.Raycaster();
  groundRay.set(new THREE.Vector3(x, smooth + 80, z), new THREE.Vector3(0, -1, 0));
  groundRay.near = 0;
  groundRay.far = 200;
  const hits = groundRay.intersectObject(shell.terrainMesh, false);
  if (!hits.length) return smooth;
  return Math.max(smooth, hits[0].point.y);
}

function roofY(record) {
  const base = record && record.seat && Number.isFinite(record.seat.baseY) ? record.seat.baseY : 0;
  return base + SCHEMATIC_HEIGHT_M;
}

function insideBuilding(shell, x, z, y) {
  for (const record of shell.buildings) {
    if (y > roofY(record) + 0.25) continue;
    const ring = record.ring || (record.building && record.building.footprintXZ);
    if (ring && pointInRing(x, z, ring)) return true;
  }
  return false;
}

/** Feet height is compared with the target ground so jumping can clear a step. */
function walkBlocked(shell, x, z, fromX, fromZ, feetY) {
  const terrain = shell.terrain;
  if (!terrain) return true;
  const x0 = terrain.xM[0] + 2;
  const x1 = terrain.xM[terrain.xM.length - 1] - 2;
  const z0 = terrain.zM[0] + 2;
  const z1 = terrain.zM[terrain.zM.length - 1] - 2;
  if (x < x0 || x > x1 || z < z0 || z > z1) return true;
  if (footprintBlocked(x, z, buildingRings(shell), BODY_RADIUS_M)) return true;
  const feet = feetY != null ? feetY : surfaceY(shell, fromX == null ? x : fromX, fromZ == null ? z : fromZ);
  if (surfaceY(shell, x, z) - feet > STEP_UP_M) return true;
  return false;
}

function renderedSurfaceY(shell, x, z) {
  return surfaceY(shell, x, z);
}

function thirdPersonCamera(shell) {
  const walk = shell.walk;
  const look = lookVector(walk.yaw, walk.pitch);
  const reach = isTouchControl(shell) ? 5.2 : THIRD_DISTANCE_M;
  const eyeY = walk.y + EYE_M + 0.55;
  for (let d = reach; d >= 1.2; d -= 0.25) {
    const x = walk.x - look.x * d;
    const y = eyeY - look.y * d;
    const z = walk.z - look.z * d;
    if (y < surfaceY(shell, x, z) + 0.45) continue;
    if (insideBuilding(shell, x, z, y)) continue;
    return {
      x,
      y,
      z,
      tx: x + look.x * 30,
      ty: y + look.y * 30,
      tz: z + look.z * 30,
    };
  }
  const x = walk.x - look.x * 1.2;
  const y = eyeY;
  const z = walk.z - look.z * 1.2;
  return { x, y, z, tx: x + look.x * 30, ty: y + look.y * 30, tz: z + look.z * 30 };
}

function paintAvatar(shell) {
  if (!shell || !shell.avatar || !shell.walk) return;
  const walk = shell.walk;
  poseAvatar(shell.avatar, {
    visible: !!(walk.active && walk.view === VIEW_THIRD),
    x: walk.x,
    y: walk.y,
    z: walk.z,
    yaw: walk.yaw,
    pitch: walk.pitch,
    phase: walk.phase,
    speed: walk.speed,
    grounded: walk.grounded,
  });
}

function syncWalkCamera(shell) {
  const walk = shell.walk;
  walk.eyeY = walk.y + EYE_M;
  if (walk.view === VIEW_THIRD) {
    const rig = thirdPersonCamera(shell);
    shell.camera.position.set(rig.x, rig.y, rig.z);
    shell.controls.target.set(rig.tx, rig.ty, rig.tz);
    shell.camera.lookAt(rig.tx, rig.ty, rig.tz);
  } else {
    const eye = eyePoint(walk);
    const pose = poseFrom(walk, eye.y);
    shell.camera.position.set(pose.x, pose.y, pose.z);
    shell.controls.target.set(pose.lookX, pose.lookY, pose.lookZ);
    shell.camera.lookAt(pose.lookX, pose.lookY, pose.lookZ);
  }
  paintAvatar(shell);
  poke();
}

function startWalk(shell, x, z, yaw, pitch, focusId) {
  if (!shell || !shell.camera || !shell.controls || !shell.terrain) return;
  if (walkBlocked(shell, x, z)) {
    const cleared = outsideStand({ x, z }, x + 10, z + 10, (px, pz) => walkBlocked(shell, px, pz));
    x = cleared.x;
    z = cleared.z;
  }
  const walk = shell.walk;
  walk.active = true;
  walk.focusId = focusId || null;
  walk.x = x;
  walk.z = z;
  walk.y = surfaceY(shell, x, z);
  walk.vy = 0;
  walk.grounded = true;
  walk.groundY = walk.y;
  walk.yaw = yaw;
  walk.pitch = Math.max(-1.05, Math.min(0.85, pitch));
  walk.held.clear();
  walk.drag = null;
  walk.lookId = null;
  walk.stick = null;
  walk.phase = 0;
  walk.speed = 0;
  walk.sprint = false;
  walk.jumpQueued = false;
  walk.t = performance.now();
  shell.lockFailed = false;
  if (shell.knob) shell.knob.style.transform = "translate(0px, 0px)";
  shell.controls.enabled = false;
  shell.camera.fov = walk.view === VIEW_THIRD ? 62 : 70;
  shell.camera.updateProjectionMatrix();
  shell.tween = null;
  syncWalkCamera(shell);
  paintWalkUi(shell);
  layoutLabels();
  poke();
}

function exitWalk(shell) {
  if (!shell || !shell.walk) return;
  if (shell.walk.active && shell.camera && shell.controls) {
    const eye = shell.camera.position.clone();
    const yaw = shell.walk.yaw;
    const back = 42;
    shell.camera.position.set(
      eye.x - Math.sin(yaw) * back,
      eye.y + 24,
      eye.z + Math.cos(yaw) * back,
    );
    shell.controls.target.set(eye.x, eye.y + 3, eye.z);
    shell.controls.enabled = true;
    shell.controls.update();
  }
  shell.walk.active = false;
  shell.walk.held.clear();
  shell.walk.focusId = null;
  shell.walk.drag = null;
  shell.walk.lookId = null;
  shell.walk.stick = null;
  shell.walk.sprint = false;
  shell.walk.jumpQueued = false;
  shell.walk.speed = 0;
  if (shell.knob) shell.knob.style.transform = "translate(0px, 0px)";
  if (shell.camera) {
    shell.camera.fov = 42;
    shell.camera.updateProjectionMatrix();
  }
  if (document.pointerLockElement === shell.canvas) document.exitPointerLock?.();
  shell.locked = false;
  shell.root.classList.remove("is-locked");
  paintAvatar(shell);
  paintWalkUi(shell);
  layoutLabels();
  poke();
}

function toggleWalk() {
  const shell = session;
  if (!shell || !shell.camera || !shell.terrain || !shell.controls) return;
  if (shell.walk.active) {
    exitWalk(shell);
    poke();
    return;
  }
  const dir = new THREE.Vector3();
  shell.camera.getWorldDirection(dir);
  const spot = shell.controls.target;
  const yaw = yawFromDirection(dir.x, dir.z);
  const ground = renderedSurfaceY(shell, shell.camera.position.x, shell.camera.position.z);
  const fromOverview = shell.camera.position.y > ground + 80;
  if (fromOverview) {
    const pitched = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
    const level = pitched > 0 ? Math.min(0.12, pitched) : 0;
    startWalk(shell, spot.x, spot.z, yaw, level, null);
    return;
  }
  const look = { x: Math.sin(yaw), z: -Math.cos(yaw) };
  let x = spot.x - look.x * 32;
  let z = spot.z - look.z * 32;
  if (walkBlocked(shell, x, z)) {
    const cleared = outsideStand({ x: spot.x, z: spot.z }, x, z, (px, pz) => walkBlocked(shell, px, pz), 18);
    x = cleared.x;
    z = cleared.z;
  }
  startWalk(shell, x, z, yaw, 0.05, null);
}

function walkToBuilding(record) {
  const shell = session;
  if (!shell || !record || !shell.terrain) return;
  const ring = record.ring || record.building.footprintXZ;
  const picked = chooseFacadeStand(ring, (x, z) => walkBlocked(shell, x, z));
  if (picked) {
    startWalk(shell, picked.x, picked.z, picked.yaw, picked.pitch, record.osmId);
    return;
  }
  const prefer = shell.camera ? shell.camera.position : { x: record.centroid.x, z: record.centroid.z + 24 };
  const stand = outsideStand(record.centroid, prefer.x, prefer.z, (x, z) => walkBlocked(shell, x, z), 22);
  const yaw = yawFromDirection(record.centroid.x - stand.x, record.centroid.z - stand.z);
  startWalk(shell, stand.x, stand.z, yaw, -0.04, record.osmId);
}

function holdWalk(action, down) {
  const shell = session;
  if (!shell || !shell.walk || !shell.walk.active) return;
  if (down) shell.walk.held.add(action);
  else shell.walk.held.delete(action);
  poke();
}

function toggleView() {
  const shell = session;
  if (!shell || !shell.walk) return;
  shell.walk.view = nextView(shell.walk.view);
  if (shell.walk.active && shell.camera) {
    shell.camera.fov = shell.walk.view === VIEW_THIRD ? 62 : 70;
    shell.camera.updateProjectionMatrix();
    syncWalkCamera(shell);
  }
  paintWalkUi(shell);
  poke();
}

function stepWalk(shell) {
  const walk = shell.walk;
  if (!walk || !walk.active) return false;
  const now = performance.now();
  const prev = walk.t || now;
  walk.t = now;
  const dt = Math.min(0.25, Math.max(0, (now - prev) / 1000));
  const stick = walk.stick;
  const stickAxis = stick ? stickAxes(stick.nx, stick.ny) : null;
  const axes = stickAxis && stickAxis.power > 0 ? stickAxis : keyboardAxes(walk.held);
  const beforeX = walk.x;
  const beforeZ = walk.z;
  stepPlayer(walk, dt, {
    axes,
    sprint: walk.sprint,
    jump: walk.jumpQueued,
  }, {
    ground: (x, z) => surfaceY(shell, x, z),
    blocked: (x, z, px, pz) => walkBlocked(shell, x, z, px, pz, walk.y),
  });
  walk.jumpQueued = false;
  const keyLook = LOOK_KEY_RPS * dt;
  if (walk.held.has("look-left")) walk.yaw = wrapYaw(walk.yaw - keyLook);
  if (walk.held.has("look-right")) walk.yaw = wrapYaw(walk.yaw + keyLook);
  if (walk.held.has("look-up")) walk.pitch = Math.min(1.05, walk.pitch + keyLook);
  if (walk.held.has("look-down")) walk.pitch = Math.max(-1.05, walk.pitch - keyLook);
  const travelled = Math.hypot(walk.x - beforeX, walk.z - beforeZ);
  walk.speed = dt > 0 ? travelled / dt : 0;
  if (travelled > 0) walk.phase = (walk.phase + travelled * 2.4) % (Math.PI * 2);
  syncWalkCamera(shell);
  return travelled > 0 || walk.held.size > 0 || !!(stickAxis && stickAxis.power > 0) || !walk.grounded;
}

function queueJump(walk) {
  if (!walk || !walk.active) return;
  walk.jumpQueued = true;
  walk.t = performance.now();
  poke();
}

function onWalkKey(event, down) {
  if (!session || !session.walk) return;
  const tag = event.target && event.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || (event.target && event.target.isContentEditable)) return;
  const walk = session.walk;
  if (event.code === "Space") {
    if (!walk.active) return;
    event.preventDefault();
    if (down && !event.repeat) queueJump(walk);
    return;
  }
  if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
    if (!walk.active) return;
    walk.sprint = down;
    return;
  }
  if (event.code === "KeyV" || event.code === "F5") {
    if (!walk.active) return;
    event.preventDefault();
    if (down && !event.repeat) toggleView();
    return;
  }
  if (!walk.active) return;
  const action = WALK_KEYS[event.code];
  if (!action) return;
  event.preventDefault();
  if (down && event.repeat) return;
  holdWalk(action, down);
}

function isTouchControl(shell) {
  return !!(shell && (shell.touch || shell.root.classList.contains("is-narrow")));
}

function denyPointerLock(shell) {
  if (!shell || shell.locked) return;
  shell.lockFailed = true;
  paintWalkUi(shell);
}

function requestMouseLook(shell) {
  if (!shell || !shell.canvas || typeof shell.canvas.requestPointerLock !== "function") {
    denyPointerLock(shell);
    return;
  }
  shell.lockAt = performance.now();
  try {
    const result = shell.canvas.requestPointerLock();
    if (result && typeof result.catch === "function") result.catch(() => denyPointerLock(shell));
  } catch (e) {
    denyPointerLock(shell);
  }
}

function pickCenter(shell) {
  if (!shell || !shell.canvas) return;
  const rect = shell.canvas.getBoundingClientRect();
  pickAt({ clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 });
}

function frameCampus() {
  const shell = session;
  if (!shell || !shell.controls || !shell.buildings.length) return;
  exitWalk(shell);
  const box = new THREE.Box3();
  for (const record of shell.buildings) box.expandByObject(record.group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.z, 180);
  shell.controls.target.set(center.x - 8, center.y + 10, center.z - 16);
  shell.camera.position.set(center.x + radius * 0.46, center.y + radius * 0.42, center.z + radius * 0.74);
  if (shell.sun) shell.sun.target.position.copy(center);
  shell.tween = null;
  shell.controls.enabled = true;
  shell.controls.update();
  poke();
}

function faceNorth() {
  const shell = session;
  if (!shell || !shell.controls) return;
  if (shell.walk && shell.walk.active) {
    shell.walk.yaw = 0;
    shell.walk.pitch = -0.22;
    syncWalkCamera(shell);
    return;
  }
  const target = shell.controls.target;
  const dist = Math.max(80, shell.camera.position.distanceTo(target));
  const phi = 1.02;
  shell.camera.position.set(target.x, target.y + dist * Math.cos(phi), target.z + dist * Math.sin(phi));
  shell.tween = null;
  shell.controls.update();
  poke();
}

function zoomBy(scale) {
  const shell = session;
  if (!shell || !shell.controls) return;
  if (shell.walk && shell.walk.active) {
    applyWalkAction(shell.walk, scale < 1 ? "forward" : "back", WALK_TAP_M, (x, z) => walkBlocked(shell, x, z, null, null, shell.walk.y));
    shell.walk.y = surfaceY(shell, shell.walk.x, shell.walk.z);
    shell.walk.grounded = true;
    shell.walk.vy = 0;
    syncWalkCamera(shell);
    return;
  }
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
  if (!shell || !shell.camera || !shell.terrain || (shell.walk && shell.walk.active)) return;
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
  const nodes = [shell.toolbar, shell.directory, shell.info, shell.attrib];
  if (shell.walkUi && !shell.walkUi.hidden) {
    for (const pad of shell.walkUi.querySelectorAll(".map-pad")) nodes.push(pad);
  }
  for (const node of nodes) {
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
  const walking = stepWalk(shell);
  const changed = shell.controls && shell.controls.enabled ? shell.controls.update() : false;
  keepAbove();
  shell.renderer.render(shell.scene, shell.camera);
  layoutLabels();
  if (tweening || changed || shell.interacting || walking) poke();
}

function resize() {
  const shell = session;
  if (!shell || !shell.renderer) return;
  const box = shell.canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(box.width) || shell.stage.clientWidth);
  const h = Math.max(1, Math.round(box.height) || shell.stage.clientHeight);
  shell.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  shell.renderer.setSize(w, h, false);
  shell.camera.aspect = w / h;
  shell.camera.updateProjectionMatrix();
  const modalWidth = shell.root.clientWidth;
  if (modalWidth > 0) shell.root.classList.toggle("is-narrow", modalWidth < 800);
  syncAccountPlace(shell);
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

function releaseWalkPointers() {
  if (!session || !session.walk) return;
  session.walk.stick = null;
  session.walk.lookId = null;
  session.walk.drag = null;
  session.walk.held.clear();
  session.walk.sprint = false;
  session.walk.jumpQueued = false;
  if (session.knob) session.knob.style.transform = "translate(0px, 0px)";
}

function bindStick(shell) {
  const node = shell.stick;
  const knob = shell.knob;
  if (!node || !knob) return;
  const end = (event) => {
    const stick = session && session.walk && session.walk.stick;
    if (!stick || (event && stick.id !== event.pointerId)) return;
    session.walk.stick = null;
    knob.style.transform = "translate(0px, 0px)";
  };
  node.addEventListener("pointerdown", (event) => {
    if (!session || !session.walk || !session.walk.active || session.walk.stick) return;
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    try { node.setPointerCapture(event.pointerId); } catch (e) { /* already gone */ }
    const rect = node.getBoundingClientRect();
    session.walk.stick = {
      id: event.pointerId,
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
      nx: 0,
      ny: 0,
    };
    poke();
  });
  node.addEventListener("pointermove", (event) => {
    const stick = session && session.walk && session.walk.stick;
    if (!stick || stick.id !== event.pointerId) return;
    if (event.cancelable) event.preventDefault();
    const dx = (event.clientX - stick.cx) / 46;
    const dy = (stick.cy - event.clientY) / 46;
    const mag = Math.hypot(dx, dy) || 1;
    const lim = mag > 1 ? 1 / mag : 1;
    stick.nx = dx * lim;
    stick.ny = dy * lim;
    knob.style.transform = `translate(${stick.nx * 30}px, ${-stick.ny * 30}px)`;
    poke();
  });
  node.addEventListener("pointerup", end);
  node.addEventListener("pointercancel", end);
}

function bindPointer(shell) {
  bindStick(shell);
  if (shell.jumpBtn) {
    bind(shell, shell.jumpBtn, "pointerdown", (event) => {
      if (!session || !session.walk || !session.walk.active) return;
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
      queueJump(session.walk);
    });
  }
  bind(shell, shell.canvas, "pointerdown", (event) => {
    if (!session || !session.walk || !session.walk.active) return;
    if (event.target !== shell.canvas) return;
    if (session.walk.stick && session.walk.stick.id === event.pointerId) return;
    if (event.pointerType === "mouse" && !isTouchControl(shell)) {
      if (session.locked) {
        event.preventDefault();
        return;
      }
      if (!session.lockFailed) {
        event.preventDefault();
        requestMouseLook(session);
        return;
      }
    }
    if (session.walk.lookId != null) return;
    if (event.cancelable) event.preventDefault();
    session.walk.lookId = event.pointerId;
    session.walk.drag = { x: event.clientX, y: event.clientY, moved: 0 };
  });
  bind(shell, shell.canvas, "pointerup", (event) => {
    if (!session || !session.walk || session.walk.lookId !== event.pointerId) return;
    const moved = session.walk.drag ? session.walk.drag.moved : 0;
    session.walk.lookId = null;
    session.walk.drag = null;
    if (moved < 6) pickAt(event);
  });
  bind(shell, shell.canvas, "pointercancel", (event) => {
    if (!session || !session.walk || session.walk.lookId !== event.pointerId) return;
    session.walk.lookId = null;
    session.walk.drag = null;
  });
  bind(shell, shell.canvas, "pointermove", (event) => {
    if (session && session.walk && session.walk.active && session.walk.lookId === event.pointerId && session.walk.drag) {
      const dx = event.clientX - session.walk.drag.x;
      const dy = event.clientY - session.walk.drag.y;
      session.walk.drag.x = event.clientX;
      session.walk.drag.y = event.clientY;
      session.walk.drag.moved += Math.hypot(dx, dy);
      if (event.cancelable) event.preventDefault();
      if (dx || dy) {
        turnPlayer(session.walk, dx * MOUSE_SENSITIVITY, -dy * MOUSE_SENSITIVITY);
        syncWalkCamera(session);
      }
    }
    const dragging = session && session.walk && session.walk.drag && session.walk.drag.moved >= 6;
    if (!session || !session.camera || dragging) return;
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
  bind(shell, shell.canvas, "click", () => {
    if (!session || !session.locked || !session.walk || !session.walk.active) return;
    if (performance.now() - (session.lockAt || 0) < 450) return;
    pickCenter(session);
  });
  bind(shell, document, "pointerlockchange", () => {
    if (session !== shell) return;
    const now = document.pointerLockElement === shell.canvas;
    shell.locked = now;
    shell.root.classList.toggle("is-locked", shell.locked);
    if (!now) releaseWalkPointers();
    paintWalkUi(shell);
    poke();
  });
  bind(shell, document, "pointerlockerror", () => {
    if (session !== shell) return;
    denyPointerLock(shell);
  });
  bind(shell, document, "mousemove", (event) => {
    if (session !== shell || !shell.locked || !shell.walk || !shell.walk.active) return;
    turnPlayer(shell.walk, (event.movementX || 0) * MOUSE_SENSITIVITY, -(event.movementY || 0) * MOUSE_SENSITIVITY);
    syncWalkCamera(shell);
  });
}

function applyThemeMaterials() {
  const shell = session;
  if (!shell || !shell.renderer) return;
  const rig = lightRig(shell.theme);
  const dark = shell.theme === "dark";
  if (shell.hemi) {
    shell.hemi.color.setHex(rig.hemi);
    shell.hemi.groundColor.setHex(rig.hemiGround);
    shell.hemi.intensity = rig.hemiIntensity;
  }
  if (shell.sun) {
    shell.sun.color.setHex(rig.sun);
    shell.sun.intensity = rig.sunIntensity;
  }
  applyAtmosphereTheme(shell);
  paintTerrain(shell);
  paintBuildings();
  poke();
}

function makeRenderer(shell) {
  const narrow = (shell.stage.clientWidth || window.innerWidth || 1280) < 420;
  const options = {
    canvas: shell.canvas,
    antialias: !narrow,
    alpha: false,
    powerPreference: narrow ? "default" : "high-performance",
    preserveDrawingBuffer: true,
    logarithmicDepthBuffer: true,
  };
  try {
    return new THREE.WebGLRenderer(options);
  } catch (err) {
    return new THREE.WebGLRenderer({
      canvas: shell.canvas,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
      logarithmicDepthBuffer: false,
    });
  }
}

function buildScene(shell) {
  const renderer = makeRenderer(shell);
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
  const hemi = new THREE.HemisphereLight(rig.hemi, rig.hemiGround, rig.hemiIntensity);
  const sun = new THREE.DirectionalLight(rig.sun, rig.sunIntensity);
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
  shell.avatar = buildAvatar();
  applyAvatarLook(shell.avatar, avatarKind(browserStore));
  scene.add(shell.avatar.group);
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

/** Homepage clears storage without rebuilding the map. Drop the loaded profile set first. */
export function syncLocalProfile() {
  if (!session) return;
  bindFavs(session);
  const storedTint = readTint();
  if (session.tint !== storedTint) {
    session.tint = storedTint;
    if (session.tintInput) session.tintInput.value = String(storedTint);
    applyCast(session);
  }
  if (session.list) renderDirectory();
  refreshDetail();
  refreshAvatar(session);
  paintAccount(session);
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

export function debugCast() {
  if (!session) return null;
  const cast = materialSet(session.tint || 0, session.theme);
  const hex = (n) => n.toString(16).padStart(6, "0");
  const live = (mesh) => (mesh && mesh.material && mesh.material.color ? mesh.material.color.getHexString() : "");
  const plain = session.buildings.find((record) => record.archetype !== "crimson" && record.osmId !== 1062064821);
  const red = session.buildings.find((record) => record.archetype === "crimson");
  return {
    tint: session.tint || 0,
    theme: session.theme,
    terrain: hex(cast.terrain),
    building: hex(cast.building),
    foundation: hex(cast.foundation),
    road: hex(cast.road),
    shoulder: hex(cast.shoulder),
    roadLive: live(session.layerMeshes && session.layerMeshes.road),
    shoulderLive: live(session.layerMeshes && session.layerMeshes.curb),
    terrainLive: live(session.terrainMesh),
    buildingLive: plain ? live(plain.mass) : "",
    foundationLive: plain ? live(plain.skirt) : "",
    redMass: red ? live(red.mass) : "",
    redRoof: red ? live(red.roof) : "",
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
    logDepth: !!(session.renderer && session.renderer.capabilities && session.renderer.capabilities.logarithmicDepthBuffer),
    fog: session.scene && session.scene.fog ? session.scene.fog.density : 0,
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
    viewMode: session.walk && session.walk.active ? "walk" : "orbit",
    view: session.walk ? session.walk.view : VIEW_FIRST,
    avatarVisible: !!(session.avatar && session.avatar.group.visible),
    grounded: session.walk ? !!session.walk.grounded : null,
    playerY: session.walk ? +session.walk.y.toFixed(2) : null,
    yaw: session.walk ? session.walk.yaw : 0,
    focusId: session.walk ? session.walk.focusId : null,
    camera: session.camera ? {
      x: session.camera.position.x,
      y: session.camera.position.y,
      z: session.camera.position.z,
    } : null,
    target: session.controls ? {
      x: session.controls.target.x,
      y: session.controls.target.y,
      z: session.controls.target.z,
    } : null,
    focusDistance: focusMetrics(session).distance,
    eyeGap: focusMetrics(session).eyeGap,
    facadeOpaque: session.buildings.every((record) => groupSolid(record.group)),
  };
}

function focusMetrics(shell) {
  if (!shell || !shell.walk || !shell.walk.focusId || !shell.camera) return { distance: null, eyeGap: null };
  const record = shell.buildings.find((item) => item.osmId === shell.walk.focusId);
  if (!record) return { distance: null, eyeGap: null };
  const distance = Math.hypot(shell.camera.position.x - record.centroid.x, shell.camera.position.z - record.centroid.z);
  const ground = sampleTerrainY(shell.terrain, shell.camera.position.x, shell.camera.position.z);
  return { distance, eyeGap: shell.camera.position.y - ground };
}

function groupSolid(group) {
  let ok = true;
  group.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!mat || mat.transparent === true || mat.opacity < 1 || mat.depthWrite === false) ok = false;
    }
  });
  return ok;
}

let probeMat = null;

function getProbeMat() {
  if (!probeMat) {
    probeMat = new THREE.MeshBasicMaterial({
      color: 0xff00ff,
      toneMapped: false,
      fog: false,
      side: THREE.FrontSide,
      depthTest: true,
      depthWrite: true,
      transparent: false,
    });
  }
  return probeMat;
}

function swapProbe(records, on) {
  for (const record of records) {
    if (!record) continue;
    if (on) {
      const saved = [];
      record.group.traverse((obj) => {
        if (!obj.isMesh) return;
        saved.push({ obj, material: obj.material });
        obj.material = getProbeMat();
      });
      record._probeSaved = saved;
    } else if (record._probeSaved) {
      for (const item of record._probeSaved) item.obj.material = item.material;
      record._probeSaved = null;
    }
  }
}

function segmentClear(shell, ax, ay, az, bx, by, bz, ignoreId) {
  for (let s = 1; s < 10; s++) {
    const t = s / 10;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    const z = az + (bz - az) * t;
    if (sampleTerrainY(shell.terrain, x, z) > y - 0.35) return false;
    for (const record of shell.buildings) {
      if (record.osmId === ignoreId) continue;
      if (pointInRing(x, z, record.building.footprintXZ)) return false;
    }
  }
  return true;
}

function rayBlocked(shell, origin, point, ignoreGroup) {
  const dir = point.clone().sub(origin);
  const dist = dir.length();
  if (dist < 0.8) return true;
  dir.multiplyScalar(1 / dist);
  const ray = new THREE.Raycaster(origin, dir, 0.15, Math.max(0.2, dist - 0.3));
  const roots = [];
  for (const child of shell.scene.children) {
    if (child === ignoreGroup || child === shell.sky) continue;
    roots.push(child);
  }
  return ray.intersectObjects(roots, true).length > 0;
}

function facadeSamples(record) {
  const open = record.ring || record.building.footprintXZ;
  const samples = [];
  const midY = record.seat.baseY + SCHEMATIC_HEIGHT_M * 0.45;
  for (let i = 0; i < open.length; i++) {
    const a = open[i];
    const b = open[(i + 1) % open.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 6) continue;
    const mx = (a[0] + b[0]) / 2;
    const mz = (a[1] + b[1]) / 2;
    const ox = (b[1] - a[1]) / len;
    const oz = -(b[0] - a[0]) / len;
    samples.push(new THREE.Vector3(mx + ox * 0.45, midY, mz + oz * 0.45));
  }
  samples.push(new THREE.Vector3(record.centroid.x, record.seat.baseY + SCHEMATIC_HEIGHT_M + 0.4, record.centroid.z));
  return samples;
}

function placeFacadeView(shell, record, distance, eyeLift) {
  const open = record.ring || record.building.footprintXZ;
  let best = null;
  for (let i = 0; i < open.length; i++) {
    const a = open[i];
    const b = open[(i + 1) % open.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 8) continue;
    const mx = (a[0] + b[0]) / 2;
    const mz = (a[1] + b[1]) / 2;
    const ox = (b[1] - a[1]) / len;
    const oz = -(b[0] - a[0]) / len;
    const x = mx + ox * distance;
    const z = mz + oz * distance;
    const y = sampleTerrainY(shell.terrain, x, z) + eyeLift;
    const aimY = record.seat.baseY + SCHEMATIC_HEIGHT_M * 0.5;
    if (!segmentClear(shell, x, y, z, mx, aimY, mz, record.osmId)) continue;
    if (!best || len > best.len) best = { x, y, z, mx, mz, aimY, len };
  }
  if (!best) return false;
  shell.camera.position.set(best.x, best.y, best.z);
  shell.camera.lookAt(best.mx, best.aimY, best.mz);
  shell.camera.updateMatrixWorld(true);
  return true;
}

function readPixel(shell, ndc) {
  const gl = shell.renderer.getContext();
  const bufW = shell.renderer.domElement.width;
  const bufH = shell.renderer.domElement.height;
  const x = Math.min(bufW - 1, Math.max(0, Math.floor((ndc.x * 0.5 + 0.5) * bufW)));
  const y = Math.min(bufH - 1, Math.max(0, Math.floor((ndc.y * 0.5 + 0.5) * bufH)));
  const px = new Uint8Array(4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return [px[0], px[1], px[2], px[3]];
}

export function debugOcclusion(osmId, mode) {
  const shell = session;
  if (!shell || !shell.camera || !shell.renderer) return { tested: 0, solid: 0, placed: false, mode: mode || "current" };
  const modeName = mode || "current";
  const pos = shell.camera.position.clone();
  const quat = shell.camera.quaternion.clone();
  const target = shell.controls.target.clone();
  const involved = [];
  try {
    let placed = true;
    if (modeName === "low" || modeName === "close") {
      const record = shell.buildings.find((item) => item.osmId === osmId);
      if (!record) return { tested: 0, solid: 0, placed: false, mode: modeName };
      const distance = modeName === "low" ? 24 : 13;
      const lift = modeName === "low" ? 2.6 : 4.2;
      placed = placeFacadeView(shell, record, distance, lift) || placeFacadeView(shell, record, distance + 16, lift + 2);
      if (!placed) return { tested: 0, solid: 0, placed: false, mode: modeName };
    }
    shell.camera.updateMatrixWorld(true);
    const records = osmId ? shell.buildings.filter((item) => item.osmId === osmId) : shell.buildings;
    const chosen = [];
    for (const record of records) {
      for (const point of facadeSamples(record)) {
        if (chosen.length >= 8) break;
        const roofY = record.seat.baseY + SCHEMATIC_HEIGHT_M;
        if (point.y > roofY + 0.2 && shell.camera.position.y < roofY) continue;
        const eye = point.clone().applyMatrix4(shell.camera.matrixWorldInverse);
        if (eye.z > -0.5) continue;
        const ndc = point.clone().project(shell.camera);
        if (Math.abs(ndc.x) > 0.92 || Math.abs(ndc.y) > 0.92) continue;
        if (!segmentClear(shell, shell.camera.position.x, shell.camera.position.y, shell.camera.position.z, point.x, point.y, point.z, record.osmId)) continue;
        if (rayBlocked(shell, shell.camera.position, point, record.group)) continue;
        chosen.push({ record, ndc });
      }
    }
    for (const item of chosen) {
      if (!involved.includes(item.record)) involved.push(item.record);
    }
    swapProbe(involved, true);
    shell.renderer.render(shell.scene, shell.camera);
    let solid = 0;
    const colors = [];
    for (const item of chosen) {
      const px = readPixel(shell, item.ndc);
      colors.push(px);
      if (px[0] > 180 && px[2] > 180 && px[1] < 110) solid += 1;
    }
    return { tested: chosen.length, solid, placed, mode: modeName, colors };
  } finally {
    swapProbe(involved, false);
    shell.camera.position.copy(pos);
    shell.camera.quaternion.copy(quat);
    if (shell.controls) shell.controls.target.copy(target);
    shell.renderer.render(shell.scene, shell.camera);
  }
}

function canvasWash(shell) {
  const gl = shell.renderer.getContext();
  const w = shell.renderer.domElement.width;
  const h = shell.renderer.domElement.height;
  const step = Math.max(4, Math.floor(Math.min(w, h) / 48));
  const px = new Uint8Array(4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  let n = 0;
  let sat = 0;
  let luma = 0;
  const x0 = Math.floor(w * 0.18);
  const x1 = Math.floor(w * 0.82);
  const y0 = Math.floor(h * 0.22);
  const y1 = Math.floor(h * 0.78);
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const r = px[0];
      const g = px[1];
      const b = px[2];
      sat += Math.max(r, g, b) - Math.min(r, g, b);
      luma += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      n += 1;
    }
  }
  return { sat: n ? sat / n : 0, luma: n ? luma / n : 0, n };
}

function roadLineContrast(shell) {
  const marks = shell.roadTrace || [];
  const ray = new THREE.Raycaster();
  const lumas = [];
  const road = shell.layerMeshes && shell.layerMeshes.road;
  for (let i = 0; i < marks.length; i += 2) {
    const mark = marks[i];
    const point = new THREE.Vector3(mark.x, mark.y, mark.z);
    const dir = point.clone().sub(shell.camera.position);
    const dist = dir.length();
    if (dist < 2) continue;
    dir.multiplyScalar(1 / dist);
    ray.set(shell.camera.position, dir);
    ray.near = 0.1;
    ray.far = dist + 3;
    const hits = road ? ray.intersectObject(road, false) : [];
    if (!hits.length || hits[0].distance > dist + 1.5) continue;
    const v = hits[0].point.clone();
    const eye = v.clone().applyMatrix4(shell.camera.matrixWorldInverse);
    if (eye.z > -0.5) continue;
    v.project(shell.camera);
    if (Math.abs(v.x) > 0.92 || Math.abs(v.y) > 0.9) continue;
    const px = readPixel(shell, v);
    lumas.push(0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2]);
  }
  if (!lumas.length) return { samples: 0, mean: 0, spread: 0 };
  const sorted = lumas.slice().sort((a, b) => a - b);
  const mid = sorted[Math.floor(sorted.length / 2)];
  const spread = lumas.filter((value) => Math.abs(value - mid) > 70).length / lumas.length;
  const mean = lumas.reduce((sum, value) => sum + value, 0) / lumas.length;
  return { samples: lumas.length, mean, spread };
}

export function debugFacadeColumn(osmId) {
  const shell = session;
  if (!shell || !shell.renderer) return null;
  const record = shell.buildings.find((item) => item.osmId === osmId);
  if (!record || !record.ring) return null;
  const open = record.ring;
  const sun = shell.sun ? shell.sun.position : new THREE.Vector3(-260, 540, 280);
  const edges = [];
  for (let i = 0; i < open.length; i++) {
    const a = open[i];
    const b = open[(i + 1) % open.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 8) continue;
    const mx = (a[0] + b[0]) / 2;
    const mz = (a[1] + b[1]) / 2;
    const ox = (b[1] - a[1]) / len;
    const oz = -(b[0] - a[0]) / len;
    const facing = ox * (sun.x - mx) + oz * (sun.z - mz);
    edges.push({ mx, mz, ox, oz, len, facing });
  }
  edges.sort((a, b) => a.facing - b.facing);
  const saved = {
    pos: shell.camera.position.clone(),
    quat: shell.camera.quaternion.clone(),
    target: shell.controls.target.clone(),
    shadows: shell.renderer.shadowMap.enabled,
  };
  const column = (edge) => {
    const camX = edge.mx + edge.ox * 26;
    const camZ = edge.mz + edge.oz * 26;
    const ground = sampleTerrainY(shell.terrain, camX, camZ);
    shell.camera.position.set(camX, ground + 1.7, camZ);
    shell.camera.lookAt(edge.mx, record.seat.baseY + 6, edge.mz);
    shell.camera.updateMatrixWorld(true);
    shell.renderer.render(shell.scene, shell.camera);
    const samples = [];
    for (let h = 0.6; h <= 16; h += 1.1) {
      const y = record.seat.skirtBottomY + h;
      const v = new THREE.Vector3(edge.mx + edge.ox * 0.35, y, edge.mz + edge.oz * 0.35);
      const eye = v.clone().applyMatrix4(shell.camera.matrixWorldInverse);
      if (eye.z > -0.2) continue;
      v.project(shell.camera);
      if (Math.abs(v.x) > 0.92 || Math.abs(v.y) > 0.92) continue;
      const px = readPixel(shell, v);
      samples.push({
        y: +y.toFixed(1),
        luma: +(0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2]).toFixed(1),
      });
    }
    const skirt = samples.filter((item) => item.y < record.seat.baseY);
    const wall = samples.filter((item) => item.y >= record.seat.baseY + 0.4 && item.luma > 28);
    const avg = (list) => list.reduce((sum, item) => sum + item.luma, 0) / Math.max(1, list.length);
    return { skirt: +avg(skirt).toFixed(1), wall: +avg(wall).toFixed(1), n: samples.length };
  };
  shell.renderer.shadowMap.enabled = true;
  const shaded = edges.length ? column(edges[0]) : null;
  const sunlit = edges.length ? column(edges[edges.length - 1]) : null;
  shell.renderer.shadowMap.enabled = saved.shadows;
  shell.camera.position.copy(saved.pos);
  shell.camera.quaternion.copy(saved.quat);
  shell.controls.target.copy(saved.target);
  shell.renderer.render(shell.scene, shell.camera);
  return { baseY: +record.seat.baseY.toFixed(1), shaded, sunlit };
}

export function debugHoldView(position, target) {
  const shell = session;
  if (!shell || !shell.camera) return null;
  shell.tween = null;
  if (shell.walk) shell.walk.active = false;
  if (shell.controls) shell.controls.enabled = true;
  shell.camera.position.set(position.x, position.y, position.z);
  shell.camera.lookAt(target.x, target.y, target.z);
  shell.camera.updateMatrixWorld(true);
  if (shell.controls) {
    shell.controls.target.set(target.x, target.y, target.z);
    shell.controls.update();
  }
  return debugGroundProbe();
}

export function debugReadWorld(points) {
  const shell = session;
  if (!shell || !shell.renderer) return [];
  shell.renderer.render(shell.scene, shell.camera);
  return (points || []).map((point) => {
    const v = new THREE.Vector3(point.x, point.y, point.z);
    const eye = v.clone().applyMatrix4(shell.camera.matrixWorldInverse);
    if (eye.z > -0.15) return { name: point.name, visible: false };
    v.project(shell.camera);
    if (Math.abs(v.x) > 0.98 || Math.abs(v.y) > 0.98) return { name: point.name, visible: false };
    const px = readPixel(shell, v);
    return {
      name: point.name,
      visible: true,
      rgb: [px[0], px[1], px[2]],
      luma: +(0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2]).toFixed(1),
    };
  });
}

function hitKind(shell, object) {
  if (!object) return "none";
  if (object === shell.terrainMesh) return "terrain";
  if (shell.trees && shell.trees.includes(object)) return "tree";
  if (object.userData && object.userData.layer) return object.userData.layer;
  let node = object;
  while (node) {
    if (node.userData && node.userData.osmId) return "building";
    if (node.children && node.children.some((child) => child.userData && child.userData.osmId)) return "building";
    node = node.parent;
  }
  if (object === shell.sky) return "sky";
  return "other";
}

function describeHit(shell, hit) {
  if (!hit) return null;
  let normalY = null;
  if (hit.face && hit.face.normal) {
    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    normalY = +normal.y.toFixed(2);
  }
  return {
    kind: hitKind(shell, hit.object),
    dist: +hit.distance.toFixed(2),
    y: +hit.point.y.toFixed(2),
    ny: normalY,
  };
}

function firstSolidHit(shell, hits) {
  for (const hit of hits) {
    if (hit.object === shell.sky) continue;
    if (hit.object.userData && hit.object.userData.avatar) continue;
    return hit;
  }
  return null;
}

export function debugWalkProbe() {
  const shell = session;
  if (!shell || !shell.camera || !shell.renderer) return null;
  const eye = shell.camera.position.clone();
  const look = new THREE.Vector3();
  shell.camera.getWorldDirection(look);
  const rendered = shell.sampleHeight ? shell.sampleHeight(eye.x, eye.z) : null;
  const linear = shell.terrain ? sampleTerrainY(shell.terrain, eye.x, eye.z) : null;
  const down = new THREE.Raycaster(
    new THREE.Vector3(eye.x, eye.y + 40, eye.z),
    new THREE.Vector3(0, -1, 0),
    0,
    120,
  );
  const meshHit = shell.terrainMesh ? firstSolidHit(shell, down.intersectObject(shell.terrainMesh, false)) : null;
  const meshY = meshHit ? meshHit.point.y : null;
  const ahead = new THREE.Raycaster(eye, look.clone().normalize(), 0, 80);
  const lookHit = firstSolidHit(shell, ahead.intersectObjects(shell.scene.children, true));
  const ndc = [[-0.7, 0.7], [0, 0.7], [0.7, 0.7], [0, 0], [0, -0.55]];
  const view = [];
  const caster = new THREE.Raycaster();
  for (const [nx, ny] of ndc) {
    caster.setFromCamera(new THREE.Vector2(nx, ny), shell.camera);
    caster.near = 0;
    caster.far = 80;
    view.push(describeHit(shell, firstSolidHit(shell, caster.intersectObjects(shell.scene.children, true))));
  }
  shell.renderer.render(shell.scene, shell.camera);
  const gl = shell.renderer.getContext();
  const canvas = shell.canvas;
  const rect = canvas.getBoundingClientRect();
  const bw = canvas.width;
  const bh = canvas.height;
  const px = new Uint8Array(4);
  let n = 0;
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let sr2 = 0;
  let sg2 = 0;
  let sb2 = 0;
  const step = 16;
  for (let y = rect.top + 4; y < rect.bottom - 4; y += step) {
    for (let x = rect.left + 4; x < rect.right - 4; x += step) {
      if (document.elementFromPoint(x, y) !== canvas) continue;
      const sx = Math.min(bw - 1, Math.max(0, Math.floor(((x - rect.left) / rect.width) * bw)));
      const sy = Math.min(bh - 1, Math.max(0, Math.floor((1 - (y - rect.top) / rect.height) * bh)));
      gl.readPixels(sx, sy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      sr += px[0];
      sg += px[1];
      sb += px[2];
      sr2 += px[0] * px[0];
      sg2 += px[1] * px[1];
      sb2 += px[2] * px[2];
      n += 1;
    }
  }
  const mean = n ? [sr / n, sg / n, sb / n] : [0, 0, 0];
  const std = n ? [
    Math.sqrt(Math.max(0, sr2 / n - mean[0] * mean[0])),
    Math.sqrt(Math.max(0, sg2 / n - mean[1] * mean[1])),
    Math.sqrt(Math.max(0, sb2 / n - mean[2] * mean[2])),
  ] : [0, 0, 0];
  const clearanceMesh = meshY == null ? null : eye.y - meshY;
  return {
    viewMode: shell.walk && shell.walk.active ? "walk" : "orbit",
    x: +eye.x.toFixed(2),
    y: +eye.y.toFixed(2),
    z: +eye.z.toFixed(2),
    yaw: shell.walk ? +shell.walk.yaw.toFixed(3) : null,
    pitch: shell.walk ? +shell.walk.pitch.toFixed(3) : +Math.asin(THREE.MathUtils.clamp(look.y, -1, 1)).toFixed(3),
    rendered: rendered == null ? null : +rendered.toFixed(2),
    linear: linear == null ? null : +linear.toFixed(2),
    clearanceSmooth: rendered == null ? null : +(eye.y - rendered).toFixed(2),
    clearanceMesh: clearanceMesh == null ? null : +clearanceMesh.toFixed(2),
    near: shell.camera.near,
    fov: shell.camera.fov,
    look: describeHit(shell, lookHit),
    view,
    visible: {
      n,
      rgb: mean.map((v) => +v.toFixed(1)),
      std: std.map((v) => +v.toFixed(1)),
    },
  };
}

export function debugWalkState() {
  const shell = session;
  if (!shell || !shell.walk) return null;
  return {
    active: !!shell.walk.active,
    view: shell.walk.view,
    avatar: typeof shell.avatar,
    sceneKids: shell.scene ? shell.scene.children.length : -1,
    third: shell.walk.view === VIEW_THIRD,
    avatarParent: shell.avatar && shell.avatar.group.parent ? shell.avatar.group.parent.type : null,
    avatarY: shell.avatar ? +shell.avatar.group.position.y.toFixed(2) : null,
    avatarVisible: !!(shell.avatar && shell.avatar.group && shell.avatar.group.visible),
    raf: !!shell.raf,
    grounded: !!shell.walk.grounded,
    y: +shell.walk.y.toFixed(3),
    vy: +shell.walk.vy.toFixed(3),
    jumpQueued: !!shell.walk.jumpQueued,
    sprint: !!shell.walk.sprint,
    held: [...shell.walk.held],
    stickId: shell.walk.stick ? shell.walk.stick.id : null,
    lookId: shell.walk.lookId,
    locked: !!shell.locked,
    touch: !!shell.touch,
  };
}

export function debugAvatarProbe() {
  const shell = session;
  if (!shell || !shell.avatar) return null;
  const inScene = shell.scene ? shell.scene.getObjectByName("campus-avatar") : null;
  return {
    same: inScene === shell.avatar.group,
    parent: shell.avatar.group.parent ? shell.avatar.group.parent.type : null,
    found: !!inScene,
    pos: [shell.avatar.group.position.x, shell.avatar.group.position.y, shell.avatar.group.position.z],
    visible: shell.avatar.group.visible,
  };
}

export function debugPlaceWalk(x, z) {
  const shell = session;
  if (!shell || !shell.sampleHeight) return null;
  shell.walk.active = true;
  shell.walk.view = VIEW_FIRST;
  shell.walk.x = x;
  shell.walk.z = z;
  shell.walk.y = surfaceY(shell, x, z);
  shell.walk.vy = 0;
  shell.walk.grounded = true;
  shell.walk.yaw = 0;
  shell.walk.pitch = -0.15;
  shell.walk.focusId = null;
  if (shell.controls) shell.controls.enabled = false;
  if (shell.camera) {
    shell.camera.fov = 70;
    shell.camera.updateProjectionMatrix();
  }
  syncWalkCamera(shell);
  const rendered = shell.sampleHeight(x, z);
  const linear = sampleTerrainY(shell.terrain, x, z);
  return {
    eye: +shell.camera.position.y.toFixed(2),
    rendered: +rendered.toFixed(2),
    linear: +linear.toFixed(2),
    clearance: +(shell.camera.position.y - rendered).toFixed(2),
  };
}

export function debugGroundProbe() {
  const shell = session;
  if (!shell || !shell.renderer || !shell.camera) return null;
  shell.renderer.render(shell.scene, shell.camera);
  const wash = canvasWash(shell);
  const road = roadLineContrast(shell);
  const offset = (shell.surfaceMaterials || []).some((mat) => mat.polygonOffset && Math.abs(mat.polygonOffsetFactor) >= 1);
  return {
    sat: wash.sat,
    luma: wash.luma,
    samples: wash.n,
    road,
    fog: shell.scene.fog ? shell.scene.fog.density : 0,
    logDepth: !!(shell.renderer.capabilities && shell.renderer.capabilities.logarithmicDepthBuffer),
    offset,
    distance: shell.controls ? shell.camera.position.distanceTo(shell.controls.target) : 0,
  };
}

export function debugShiftView(dx, dy, dz) {
  const shell = session;
  if (!shell || !shell.camera) return null;
  shell.camera.position.x += dx;
  shell.camera.position.y += dy;
  shell.camera.position.z += dz;
  if (shell.controls) shell.controls.update();
  return debugGroundProbe();
}

export function close() {
  bootGen += 1;
  const shell = session;
  if (!shell) return;
  session = null;
  if (document.pointerLockElement === shell.canvas) document.exitPointerLock?.();
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
    if (session && session.root === shell.root) onWalkKey(event, true);
    if (event.key !== "Escape" || !session || session.root !== shell.root) return;
    event.preventDefault();
    event.stopPropagation();
    if (document.pointerLockElement === session.canvas) {
      document.exitPointerLock?.();
      return;
    }
    if (session.walk && session.walk.active) {
      exitWalk(session);
      return;
    }
    if (session.morePanel && session.morePanel.classList.contains("is-open")) {
      session.morePanel.classList.remove("is-open");
      if (session.moreBtn) session.moreBtn.setAttribute("aria-expanded", "false");
      return;
    }
    if (session.license && !session.license.hidden) {
      session.license.hidden = true;
      const notice = session.attribBar && session.attribBar.querySelector(".map-notice-btn");
      if (notice) notice.setAttribute("aria-expanded", "false");
      layoutLabels();
      return;
    }
    if (session.root.classList.contains("detail-open")) {
      session.detailExpanded = false;
      syncWalkChrome(session);
      return;
    }
    if (session.info && !session.info.hidden) {
      hideDetail();
      return;
    }
    close();
  }, true);
  bind(shell, window, "keyup", (event) => {
    if (session && session.root === shell.root) onWalkKey(event, false);
  }, true);
  bind(shell, window, "resize", resize);
  bind(shell, window, "blur", releaseWalkPointers);
  bind(shell, document, "visibilitychange", () => {
    if (document.visibilityState !== "visible") releaseWalkPointers();
  });
  if (window.visualViewport) {
    const onVv = () => { if (session === shell) syncWalkChrome(shell); };
    bind(shell, window.visualViewport, "resize", onVv);
    bind(shell, window.visualViewport, "scroll", onVv);
  }
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
