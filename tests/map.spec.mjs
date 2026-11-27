import { expect, test } from "@playwright/test";

const AI_HOST = /kyungnam-faq-zhipu-relay\.vercel\.app\/api\/ask/i;
const EXTERNAL = /cdn\.|fonts\.google|fonts\.gstatic|unpkg\.com|jsdelivr|cdnjs|openstreetmap\.org\/.*tile|tile\.openstreetmap|google-analytics|googletagmanager/i;
const LEGAL = "produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.";
const LIABILITY = "The organisations in charge of the Copernicus programme by law or by delegation do not incur any liability for any use of the Copernicus WorldDEM-30.";

function track(page) {
  const urls = [];
  const errors = [];
  page.on("request", (req) => urls.push(req.url()));
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (text.includes("favicon.ico") || text.includes("404") || text.includes("Failed to load resource")) return;
    errors.push(text);
  });
  return { urls, errors };
}

async function silenceAi(page) {
  await page.route(AI_HOST, (route) => route.abort("failed"));
}

async function ask(page, text) {
  await page.locator("#input").fill(text);
  await page.locator("#btn-send").click();
}

async function openMap(page) {
  await page.locator("#btn-map").click();
  await expect(page.locator(".map-modal")).toBeVisible();
  await expect(page.locator(".map-status")).toBeHidden({ timeout: 20000 });
}

test("initial load stays local and does not fetch the map bundle", async ({ page }) => {
  const seen = track(page);
  await silenceAi(page);
  await page.goto("/");
  await expect(page.locator("#btn-map")).toHaveText("地图");
  expect(seen.urls.some((url) => url.includes("campus-map.min.js"))).toBe(false);
  expect(seen.urls.some((url) => url.includes("osm-buildings.json"))).toBe(false);
  expect(seen.urls.some((url) => url.includes("campus-terrain.json"))).toBe(false);
  expect(seen.urls.some((url) => url.includes("campus-poi-directory.json"))).toBe(false);
  expect(seen.urls.some((url) => url.includes("osm-campus-layers.json"))).toBe(false);
  expect(seen.urls.filter((url) => EXTERNAL.test(url))).toEqual([]);
  expect(seen.errors).toEqual([]);
});

test("map questions stay on the local FAQ and buildings stay specific", async ({ page }) => {
  const posts = [];
  await page.route(AI_HOST, (route) => {
    posts.push(route.request().url());
    return route.abort("failed");
  });
  await page.goto("/");
  for (const text of ["地图", "学校地图"]) {
    await ask(page, text);
    const card = page.locator("#thread .card").last();
    await expect(card).toContainText("打开 3D 校园地图");
    await expect(card.locator(".map-faq-btn")).toBeVisible();
    await expect(card).not.toContainText("AI自主回答");
    await page.locator("#btn-clear").click();
  }
  await page.locator("#btn-ko").click();
  await ask(page, "캠퍼스맵");
  await expect(page.locator("#thread .card").last()).toContainText("3D 캠퍼스맵 열기");
  await page.locator("#btn-clear").click();
  await page.locator("#btn-zh").click();
  const exact = [
    ["正门", "正门"],
    ["本馆", "本馆"],
    ["图书馆", "图书馆"],
    ["留学生服务中心", "请以现场或官网最新指引为准"],
    ["国际处", "请以现场或官网最新指引为准"],
  ];
  for (const [query, snippet] of exact) {
    await ask(page, query);
    const card = page.locator("#thread .card").last();
    await expect(card).toContainText(snippet);
    await expect(card).not.toContainText("AI自主回答");
    await page.locator("#btn-clear").click();
  }
  await page.locator("#btn-ko").click();
  await ask(page, "유학생서비스센터");
  await expect(page.locator("#thread .card").last()).toContainText("현장 또는 학교 공식 최신 안내 기준 확인 필요");
  await expect(page.locator("#thread .card").last()).toContainText("ko/6382");
  await page.locator("#btn-clear").click();
  await ask(page, "국제처 어디예요?");
  await expect(page.locator("#thread .card").last()).toContainText("현장 또는 학교 공식 최신 안내 기준 확인 필요");
  await expect(page.locator("#thread .card").last()).toContainText("ko/6382");
  expect(posts).toEqual([]);
});

for (const viewport of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "ipad", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test.describe(`map viewport ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });
    test("opens a full-viewport map without overflow or console errors", async ({ page }) => {
      test.setTimeout(60000);
      const seen = track(page);
      await silenceAi(page);
      await page.goto("/");
      await openMap(page);
      const modal = page.locator(".map-modal");
      await expect(modal).toBeVisible();
      const box = await modal.boundingBox();
      expect(box.width).toBeGreaterThan(viewport.width - 2);
      expect(box.height).toBeGreaterThan(viewport.height - 40);
      const metrics = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
        canvas: document.querySelector(".map-canvas")?.width || 0,
        fallback: document.querySelector(".map-fallback")?.hidden,
      }));
      expect(metrics.scroll).toBeLessThanOrEqual(metrics.client + 1);
      expect(metrics.fallback).not.toBe(false);
      expect(metrics.canvas).toBeGreaterThan(100);
      const pixels = await page.evaluate(() => {
        const canvas = document.querySelector(".map-canvas");
        const gl = canvas.getContext("webgl2");
        const buf = new Uint8Array(16);
        gl.readPixels(8, 8, 2, 2, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        return buf.reduce((sum, value) => sum + value, 0);
      });
      expect(pixels).toBeGreaterThan(0);
      await expect(page.locator(".map-attrib-bar .map-osm-link")).toBeVisible();
      await expect(page.locator(".map-attrib-bar .map-osm-link")).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
      await expect(page.locator(".map-attrib-bar .map-osm-link")).toHaveAttribute("target", "_blank");
      await expect(page.locator(".map-attrib-bar .map-osm-link")).toHaveAttribute("rel", /noopener/);
      await expect(page.locator(".map-license")).toBeHidden();
      const bar = await page.locator(".map-attrib-bar").boundingBox();
      expect(bar.height).toBeGreaterThanOrEqual(28);
      expect(bar.height).toBeLessThanOrEqual(36);
      expect(bar.x).toBeLessThan(24);
      expect(bar.y).toBeGreaterThan(viewport.height - 90);
      expect(bar.x + bar.width).toBeLessThanOrEqual(viewport.width - 8);
      expect(bar.y + bar.height).toBeLessThanOrEqual(viewport.height - 4);
      const coversCenter = bar.x < viewport.width * 0.42
        && bar.x + bar.width > viewport.width * 0.58
        && bar.y < viewport.height * 0.62
        && bar.y + bar.height > viewport.height * 0.38;
      expect(coversCenter).toBe(false);
      const mounted = await page.evaluate(() => {
        const root = document.querySelector(".map-modal");
        const attrib = document.querySelector(".map-attrib");
        return !!(root && attrib && root.contains(attrib));
      });
      expect(mounted).toBe(true);
      await page.locator(".map-notice-btn").click();
      await expect(page.locator(".map-license")).toBeVisible();
      await expect(page.locator(".map-license")).toContainText(LEGAL);
      await expect(page.locator(".map-license")).toContainText(LIABILITY);
      await expect(page.locator(".map-odbl-link")).toHaveAttribute("href", "https://opendatacommons.org/licenses/odbl/1-0/");
      await expect(page.locator(".map-license")).toContainText("모식도");
      await expect(page.locator(".map-license")).toContainText("示意图");
      const pop = await page.locator(".map-license").boundingBox();
      expect(pop.x).toBeGreaterThanOrEqual(-1);
      expect(pop.y).toBeGreaterThanOrEqual(-1);
      expect(pop.x + pop.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(pop.y + pop.height).toBeLessThanOrEqual(viewport.height + 1);
      const openOverflow = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(openOverflow.scroll).toBeLessThanOrEqual(openOverflow.client + 1);
      expect(await page.locator(".map-modal img").count()).toBe(0);
      await page.locator(".map-notice-btn").click();
      await expect(page.locator(".map-license")).toBeHidden();
      expect(seen.urls.some((url) => url.includes("osm-campus-layers.json"))).toBe(true);
      expect(seen.errors).toEqual([]);
      await page.locator(".map-toolbar [data-map-action='close']").click();
      await expect(modal).toHaveCount(0);
    });
  });
}

test("building, FAQ, directory, favorites, theme, and language stay in sync", async ({ page }) => {
  test.setTimeout(90000);
  const seen = track(page);
  await silenceAi(page);
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const startUrl = page.url();
  await ask(page, "本馆");
  await page.locator(".map-faq-btn").click();
  await expect(page.locator(".map-modal")).toBeVisible();
  await expect(page.locator(".map-info")).toContainText("本馆", { timeout: 20000 });
  await page.locator(".map-info").getByRole("button", { name: "FAQ：本馆" }).click();
  await expect(page.locator(".map-modal")).toHaveCount(0);
  await expect(page.locator("#thread .card").last()).toContainText("本馆");

  await page.locator("#btn-map").click();
  await expect(page.locator(".map-search")).toBeVisible({ timeout: 20000 });
  await page.locator(".map-search").fill("正门");
  const textOnly = page.locator(".map-list button[data-spatial='unmapped-text-only']").first();
  await expect(textOnly).toContainText("文字地点");
  await textOnly.click();
  await expect(page.locator(".map-info")).toContainText("文字地点");
  await expect(page.locator(".map-info")).toContainText("正门");

  await page.locator(".map-search").fill("");
  await page.locator(".map-filters").getByRole("button", { name: "宿舍" }).click();
  await expect(page.locator(".map-list")).toContainText("第一汉马生活馆");
  await expect(page.locator(".map-list")).not.toContainText("本馆");
  await page.locator(".map-filters").getByRole("button", { name: "全部" }).click();
  await page.locator(".map-search").fill("");
  await page.locator(".map-list button[data-faq-id='F49']").click();
  await expect(page.locator(".map-info")).toContainText("本馆");
  const point = await page.evaluate(() => window.CampusMap.projectBuilding(1062064821));
  expect(point && point.behind).toBe(false);
  await page.mouse.click(point.x, point.y);
  await expect(page.locator(".map-info")).toContainText("本馆");

  await page.locator(".map-info").getByRole("button", { name: "收藏" }).first().click();
  await expect.poll(() => page.evaluate(() => {
    try { return localStorage.getItem("campus_map_favorites"); } catch (e) { return "throw"; }
  })).toContain("F49");
  expect(page.url()).toBe(startUrl);
  expect(new URL(page.url()).search).toBe("");
  expect(new URL(page.url()).hash).toBe("");
  await page.locator(".map-toolbar [data-map-action='close']").click();
  await page.reload();
  await page.locator("#btn-map").click();
  await expect(page.locator(".map-search")).toBeVisible({ timeout: 20000 });
  await page.locator(".map-filters").getByRole("button", { name: "收藏" }).click();
  await expect(page.locator(".map-list")).toContainText("本馆");
  await page.locator(".map-clear").click();
  await expect.poll(() => page.evaluate(() => {
    try { return localStorage.getItem("campus_map_favorites"); } catch (e) { return "throw"; }
  })).toBe(null);
  await expect(page.locator(".map-privacy")).toContainText("请勿输入学号、手机号等个人信息");
  await expect(page.locator(".map-storage")).toContainText("仅保存在本机浏览器，公用设备请清空");

  await page.locator("#theme-switch").evaluate((el) => el.click());
  await expect(page.locator(".map-modal")).toHaveAttribute("data-theme", "dark");
  await page.locator("#btn-ko").evaluate((el) => el.click());
  await expect(page.locator("#btn-map")).toHaveText("지도");
  await expect(page.locator(".map-toolbar [data-map-action='reset']")).toHaveText("전체 보기");
  await expect(page.locator(".map-toolbar [data-map-action='north']")).toHaveText("정북");
  await expect(page.locator(".map-privacy")).toContainText("개인정보는 입력하지 마세요");
  await page.locator(".map-notice-btn").click();
  await expect(page.locator(".map-summary")).toContainText("Copernicus WorldDEM-30");
  await expect(page.locator(".map-schematic")).toContainText("모식도");
  await page.locator(".map-notice-btn").click();
  await page.locator("#btn-zh").evaluate((el) => el.click());
  await page.locator("#theme-switch").evaluate((el) => el.click());
  await expect(page.locator(".map-modal")).toHaveAttribute("data-theme", "light");

  for (let i = 0; i < 3; i++) {
    if (await page.locator(".map-modal").count()) {
      await page.locator(".map-toolbar [data-map-action='close']").click();
    }
    await page.locator("#btn-map").click();
    await expect(page.locator(".map-canvas")).toBeVisible();
    await expect(page.locator(".map-status")).toBeHidden({ timeout: 20000 });
  }
  await page.keyboard.press("Escape");
  await expect(page.locator(".map-modal")).toHaveCount(0);
  expect(seen.errors).toEqual([]);
  expect(seen.urls.filter((url) => EXTERNAL.test(url))).toEqual([]);
});

test("missing WebGL shows the directory and official map link", async ({ page }) => {
  const seen = track(page);
  await silenceAi(page);
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (String(type).includes("webgl")) return null;
      return orig.call(this, type, ...args);
    };
  });
  await page.goto("/");
  await page.locator("#btn-map").click();
  await expect(page.locator(".map-fallback")).toBeVisible({ timeout: 20000 });
  await expect(page.locator(".map-fallback")).toContainText("无法显示 3D");
  await expect(page.locator(".map-search")).toBeVisible();
  await expect(page.locator(".map-attrib a[href*='inews.kyungnam.ac.kr']")).toHaveAttribute("target", "_blank");
      await expect(page.locator(".map-attrib-bar .map-osm-link")).toBeVisible();
  expect(seen.errors).toEqual([]);
});

test("blocked storage does not crash the page or the map", async ({ page }) => {
  const seen = track(page);
  await silenceAi(page);
  await page.addInitScript(() => {
    const fail = () => { throw new Error("storage blocked"); };
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        return { getItem: fail, setItem: fail, removeItem: fail, clear: fail, key: fail, length: 0 };
      },
    });
  });
  await page.goto("/");
  await expect(page.locator("#title")).toBeVisible();
  await page.locator("#btn-map").click();
  await expect(page.locator(".map-modal")).toBeVisible();
  await page.locator(".map-clear").click();
  expect(seen.errors.filter((line) => !line.includes("storage blocked"))).toEqual([]);
});

test("colored hillside, red hubs, on-map labels, and floor search", async ({ page }) => {
  test.setTimeout(120000);
  const seen = track(page);
  await silenceAi(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await openMap(page);
  const snap = await page.evaluate(() => window.CampusMap.debugSnapshot());
  expect(snap.lowColor[1]).toBeGreaterThan(snap.lowColor[0]);
  expect(snap.lowColor[1]).toBeGreaterThan(snap.lowColor[2]);
  const red = snap.buildings.find((item) => item.osmId === 1062073167);
  expect(red.kind).toBe("red");
  expect(red.archetype).toBe("crimson");
  expect(red.roof).toBe("3a1818");
  expect(red.mass).toBe("c92a2a");
  expect(red.edge).toBe("c92a2a");
  expect(red.beacon).toBe(true);
  expect(snap.pbr).toBe(true);
  expect(snap.toneMapping).toBe("ACESFilmic");
  expect(snap.roads).toBe(81);
  expect(snap.trees).toBeGreaterThanOrEqual(40);
  expect(snap.trees).toBeLessThanOrEqual(480);
  const oldMuseum = snap.buildings.find((item) => item.osmId === 1061923278);
  expect(oldMuseum.kind).toBe("neutral");
  expect(oldMuseum.roof).not.toBe("ef4444");
  expect(oldMuseum.mass).not.toBe("c92a2a");
  const mapped = snap.buildings.filter((item) => item.kind === "mapped");
  expect(mapped.length).toBeGreaterThan(10);
  expect(mapped.some((item) => item.roof === "ef4444")).toBe(false);
  expect(snap.labelTexts.join("\n")).not.toContain("博物馆");
  await expect(page.locator(".map-pill.is-red")).toContainText("设计馆 · 留学生服务中心");
  await expect(page.locator(".map-intl-pill")).toContainText("国际处 · 创造馆 1F");
  await expect(page.locator(".map-intl-pill")).toContainText("暂无3D轮廓");
  await expect(page.locator(".map-intl-banner")).toBeVisible();
  for (const [query, name] of [["阅览室", "中央图书馆"], ["打印", "中央图书馆"], ["博物馆", "汉马未来馆"], ["食堂", "汉马馆"], ["7层", "设计馆"], ["留学生", "留学生服务中心"], ["国际处", "国际处"], ["1层", "本馆"]]) {
    await page.locator(".map-search").fill(query);
    await expect(page.locator(".map-list")).toContainText(name);
  }
  await page.locator(".map-search").fill("博物馆");
  await expect(page.locator(".map-list")).toContainText("庆南大学博物馆");
  await page.locator(".map-toolbar [data-map-action='directory']").click();
  await page.locator(".map-pill.is-red").click();
  await expect(page.locator(".map-info")).toContainText("设计馆 · 留学生服务中心");
  await expect(page.locator(".map-info")).toContainText("7F");
  await expect(page.locator(".map-info")).toContainText("留学生服务中心");
  await expect(page.locator(".map-info")).toContainText("2021-08-30");
  await expect(page.locator(".map-info")).toContainText("请以现场或官网最新指引为准");
  const official = page.locator(".map-info a[href='https://www.kyungnam.ac.kr/ko/6382/subview.do']").first();
  await expect(official).toHaveAttribute("target", "_blank");
  await expect(official).toHaveAttribute("rel", "noopener noreferrer");
  await page.locator(".map-detail-close").click();
  await page.locator("#btn-ko").evaluate((el) => el.click());
  await expect(page.locator(".map-pill.is-red")).toContainText("디자인관 · 유학생서비스센터");
  await expect(page.locator(".map-intl-pill")).toContainText("국제처 · 창조관 1층");
  await expect(page.locator(".map-intl-pill")).toContainText("3D 외곽선 없음");
  await page.locator("#btn-zh").evaluate((el) => el.click());
  await page.locator(".map-toolbar [data-map-action='labels']").click();
  await expect(page.locator(".map-pill")).toHaveCount(0);
  await page.locator(".map-toolbar [data-map-action='labels']").click();
  await expect(page.locator(".map-pill.is-red")).toBeVisible();
  await page.locator(".map-intl-pill").click();
  await expect(page.locator(".map-info")).toContainText("国际处");
  await expect(page.locator(".map-info")).toContainText("1F");
  await expect(page.locator(".map-info")).toContainText("055-249-2299");
  await expect(page.locator(".map-info")).toContainText("暂无3D轮廓");
  await expect(page.locator(".map-role-badge")).toContainText("国际服务重点");
  await expect(page.locator(".map-floor-note")).not.toHaveText("");
  await page.locator(".map-detail-close").click();
  await page.locator(".map-toolbar [data-map-action='directory']").click();
  await page.locator(".map-search").fill("中央图书馆");
  await page.locator(".map-list button[data-faq-id='F62']").click();
  await expect(page.locator(".map-info")).toContainText("复印室");
  await expect(page.locator(".map-info")).toContainText("阅览");
  await page.locator("#theme-switch").evaluate((el) => el.click());
  await expect(page.locator(".map-modal")).toHaveAttribute("data-theme", "dark");
  const dark = await page.evaluate(() => window.CampusMap.debugSnapshot());
  expect(dark.theme).toBe("dark");
  expect(dark.lowColor[1]).toBeGreaterThan(dark.lowColor[2] - 0.02);
  const redDark = dark.buildings.find((item) => item.osmId === 1062073167);
  expect(redDark.mass).toBe("c92a2a");
  expect(redDark.roof).toBe("3a1818");
  expect(redDark.edge).toBe("c92a2a");
  expect(seen.errors).toEqual([]);
  expect(seen.urls.filter((url) => EXTERNAL.test(url))).toEqual([]);
});

function boxGap(a, b) {
  if (!a || !b) return 0;
  const dx = Math.max(0, Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width)));
  const dy = Math.max(0, Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height)));
  if (dx === 0 && dy === 0) return 0;
  if (dx === 0) return dy;
  if (dy === 0) return dx;
  return Math.hypot(dx, dy);
}

test("mobile detail drawer does not cover the attribution bar", async ({ page }) => {
  test.setTimeout(90000);
  const seen = track(page);
  await silenceAi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await openMap(page);
  await page.locator(".map-toolbar [data-map-action='directory']").click();
  await expect(page.locator(".map-modal")).not.toHaveClass(/dir-collapsed/);
  await page.locator(".map-intl-banner").click();
  await expect(page.locator(".map-modal")).toHaveClass(/dir-collapsed/);
  await expect(page.locator(".map-info")).toBeVisible();
  const openGap = boxGap(await page.locator(".map-attrib").boundingBox(), await page.locator(".map-info").boundingBox());
  expect(openGap).toBeGreaterThan(0);
  await page.locator(".map-detail-close").click();
  await expect(page.locator(".map-info")).toBeHidden();
  await page.locator(".map-pill.is-red").click();
  await expect(page.locator(".map-info")).toContainText("设计馆");
  const again = boxGap(await page.locator(".map-attrib").boundingBox(), await page.locator(".map-info").boundingBox());
  expect(again).toBeGreaterThan(0);
  expect(seen.errors).toEqual([]);
});

test("iPad detail card keeps clearance from the attribution bar", async ({ page }) => {
  test.setTimeout(90000);
  await silenceAi(page);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");
  await openMap(page);
  await page.locator(".map-list button[data-faq-id='F49']").click();
  await expect(page.locator(".map-info")).toBeVisible();
  const gap = boxGap(await page.locator(".map-attrib").boundingBox(), await page.locator(".map-info").boundingBox());
  expect(gap).toBeGreaterThanOrEqual(10);
});

test("tablet building click shows info without walk and narrows the directory", async ({ page }) => {
  test.setTimeout(90000);
  await silenceAi(page);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");
  await openMap(page);
  await page.waitForFunction(() => window.CampusMap && window.CampusMap.projectBuilding(1062064821));
  const directoryWidth = await page.locator(".map-directory").evaluate((el) => el.getBoundingClientRect().width);
  expect(directoryWidth).toBeGreaterThanOrEqual(200);
  expect(directoryWidth).toBeLessThanOrEqual(220);
  expect(await page.locator(".map-modal").evaluate((el) => el.classList.contains("dir-collapsed"))).toBe(false);
  const point = await page.evaluate(() => window.CampusMap.projectBuilding(1062064821));
  expect(point.behind).toBe(false);
  await page.mouse.click(point.x, point.y);
  await expect(page.locator(".map-info")).toContainText("本馆");
  await expect(page.locator(".map-modal")).toHaveClass(/dir-collapsed/);
  await expect(page.locator(".map-modal")).not.toHaveClass(/walk-active/);
  await expect(page.locator(".map-stick")).toBeHidden();
  const snap = await page.evaluate(() => window.CampusMap.debugSnapshot());
  expect(snap.viewMode).toBe("orbit");
  expect(snap.focusId).toBe(null);
  const card = await page.locator(".map-info").boundingBox();
  expect(card.width).toBeLessThanOrEqual(321);
  await page.locator(".map-toolbar [data-map-action='directory']").click();
  await expect(page.locator(".map-modal")).not.toHaveClass(/dir-collapsed/);
  await page.locator(".map-toolbar [data-map-action='directory']").click();
  await expect(page.locator(".map-modal")).toHaveClass(/dir-collapsed/);
});

test("escape closes the license, then the detail, then the map", async ({ page }) => {
  test.setTimeout(90000);
  await silenceAi(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await openMap(page);
  await page.locator(".map-notice-btn").click();
  await expect(page.locator(".map-license")).toBeVisible();
  const pad = await page.locator(".map-license").evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
  expect(pad).toBeGreaterThanOrEqual(24);
  await page.keyboard.press("Escape");
  await expect(page.locator(".map-license")).toBeHidden();
  await expect(page.locator(".map-modal")).toBeVisible();
  await page.locator(".map-pill.is-red").click();
  await expect(page.locator(".map-info")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".map-info")).toBeHidden();
  await expect(page.locator(".map-modal")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".map-modal")).toHaveCount(0);
});

test("directory leads with a place name and detail actions stay distinct", async ({ page }) => {
  test.setTimeout(90000);
  await silenceAi(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await openMap(page);
  await expect(page.locator(".map-notice-btn")).toHaveText("Copernicus · 数据来源与许可");
  const first = page.locator(".map-list button").first();
  await expect(first).toContainText("本馆");
  await expect(first).not.toContainText("学校地址和总机电话是多少");
  await page.locator(".map-search").fill("总机");
  await expect(page.locator(".map-list")).toContainText("庆南大学（地址与总机）");
  await page.locator(".map-search").fill("");
  await page.locator(".map-pill.is-red").click();
  await expect(page.locator(".map-info").getByRole("button", { name: "FAQ：设计馆" })).toBeVisible();
  await expect(page.locator(".map-info").getByRole("button", { name: "FAQ：留学生服务中心" })).toBeVisible();
  const labels = await page.locator(".map-info .map-ext-link").allTextContents();
  expect(labels.length).toBeGreaterThan(0);
  expect(labels.every((label) => label === "官方说明")).toBe(false);
});

test("tint slider lives in more and drives day and night materials", async ({ page }) => {
  test.setTimeout(120000);
  const seen = track(page);
  await silenceAi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("campus_map_tint"));
  await openMap(page);
  const fresh = await page.evaluate(() => window.CampusMap.debugCast());
  expect(fresh.tint).toBe(0);
  expect(fresh.terrain).toBe("6b8f5a");
  expect(fresh.road).toBe("5c6670");
  expect(fresh.road).not.toBe(fresh.shoulder);
  expect(fresh.road).not.toBe(fresh.terrain);
  expect(fresh.building).not.toBe(fresh.foundation);
  expect(fresh.roadLive).toBe(fresh.road);
  expect(fresh.redMass).toBe("c92a2a");
  await expect(page.locator(".map-tint")).toBeHidden();
  await page.locator(".map-toolbar [data-map-action='directory']").click();
  await page.locator(".map-list button[data-faq-id='F49']").click();
  await page.locator(".map-more-btn").click();
  const tint = page.locator(".map-tint");
  await expect(tint).toBeVisible();
  await expect(tint.locator(".map-tint-label")).toHaveText("色调");
  const first = await page.locator(".map-more").evaluate((panel) => panel.firstElementChild.className);
  expect(first).toContain("map-tint");
  const blocked = await page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel);
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    };
    const overlap = (a, b) => {
      const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      return x * y;
    };
    const canvas = box(".map-canvas");
    const tintBox = box(".map-tint");
    const cx = canvas.x + canvas.w / 2;
    const cy = canvas.y + canvas.h / 2;
    const coversCenter = cx >= tintBox.x && cx <= tintBox.x + tintBox.w && cy >= tintBox.y && cy <= tintBox.y + tintBox.h;
    return {
      stick: overlap(tintBox, box(".map-stick")),
      attrib: overlap(tintBox, box(".map-attrib")),
      coversCenter,
      belowBar: tintBox.y >= 44,
    };
  });
  expect(blocked.stick).toBe(0);
  expect(blocked.attrib).toBe(0);
  expect(blocked.coversCenter).toBe(false);
  expect(blocked.belowBar).toBe(true);
  await page.locator(".map-tint-marks button[data-tint='-1']").click();
  const cool = await page.evaluate(() => window.CampusMap.debugCast());
  expect(cool.tint).toBe(-1);
  expect(cool.roadLive).toBe("455563");
  expect(cool.terrainLive).toBe("87949d");
  expect(cool.buildingLive).toBe("c6ccd1");
  expect(cool.foundationLive).toBe("929da6");
  expect(cool.shoulderLive).toBe("a9b5bd");
  expect(cool.redMass).toBe("c92a2a");
  await page.evaluate(() => window.CampusMap.setTheme("dark"));
  const night = await page.evaluate(() => window.CampusMap.debugCast());
  expect(night.tint).toBe(-1);
  expect(night.roadLive).toBe("465a6b");
  expect(night.terrainLive).toBe("303d49");
  expect(night.buildingLive).toBe("788895");
  expect(night.redMass).toBe("c92a2a");
  await page.locator(".map-tint-marks button[data-tint='1']").click();
  const warmNight = await page.evaluate(() => window.CampusMap.debugCast());
  expect(warmNight.roadLive).toBe("5a5249");
  expect(warmNight.terrainLive).toBe("4a4038");
  expect(warmNight.buildingLive).toBe("8a8076");
  await page.evaluate(() => window.CampusMap.setTheme("light"));
  const warmDay = await page.evaluate(() => window.CampusMap.debugCast());
  expect(warmDay.tint).toBe(1);
  expect(warmDay.roadLive).toBe("5c534b");
  expect(warmDay.terrainLive).toBe("a39686");
  expect(warmDay.shoulderLive).toBe("c4b8ac");
  await page.locator(".map-tint input").evaluate((input) => {
    input.value = "0.08";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const dragging = await page.evaluate(() => window.CampusMap.debugCast());
  expect(dragging.tint).toBeCloseTo(0.08, 2);
  expect(dragging.roadLive).not.toBe("5c534b");
  expect(dragging.roadLive).not.toBe(fresh.road);
  await page.locator(".map-tint input").evaluate((input) => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const snapped = await page.evaluate(() => window.CampusMap.debugCast());
  expect(snapped.tint).toBe(0);
  expect(snapped.roadLive).toBe(fresh.road);
  await page.locator(".map-tint-marks button[data-tint='-1']").click();
  await page.locator(".map-toolbar [data-map-action='close']").click();
  await openMap(page);
  const kept = await page.evaluate(() => window.CampusMap.debugCast());
  expect(kept.tint).toBe(-1);
  expect(kept.roadLive).toBe("455563");
  await page.evaluate(() => localStorage.removeItem("campus_map_tint"));
  await page.locator(".map-toolbar [data-map-action='close']").click();
  await openMap(page);
  const cleared = await page.evaluate(() => window.CampusMap.debugCast());
  expect(cleared.tint).toBe(0);
  expect(cleared.roadLive).toBe(fresh.road);
  expect(seen.errors).toEqual([]);
});

test("student system answer keeps a clean sugang host", async ({ page }) => {
  await silenceAi(page);
  await page.goto("/");
  await ask(page, "怎么登录学生信息系统？");
  const link = page.locator("#thread .card").last().locator("a[href*='sugang.kyungnam.ac.kr']");
  await expect(link).toHaveAttribute("href", "https://sugang.kyungnam.ac.kr");
  const href = await link.getAttribute("href");
  expect(href).not.toContain("xn--");
});
