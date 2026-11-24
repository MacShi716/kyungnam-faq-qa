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
    ["留学生服务中心", "团队确认，请以现场或官网指引为准"],
    ["国际处", "团队确认，请以现场或官网指引为准"],
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
  await expect(page.locator("#thread .card").last()).toContainText("팀 확인 정보, 현장 또는 학교 공식 안내 기준 확인 필요");
  await page.locator("#btn-clear").click();
  await ask(page, "국제처 어디예요?");
  await expect(page.locator("#thread .card").last()).toContainText("팀 확인 정보, 현장 또는 학교 공식 안내 기준 확인 필요");
  expect(posts).toEqual([]);
});

for (const viewport of [
  { name: "desktop", width: 1280, height: 800 },
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
      await expect(page.locator(".map-osm-link")).toBeVisible();
      await expect(page.locator(".map-osm-link")).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
      await expect(page.locator(".map-osm-link")).toHaveAttribute("target", "_blank");
      await expect(page.locator(".map-osm-link")).toHaveAttribute("rel", /noopener/);
      await expect(page.locator(".map-attrib")).toContainText(LEGAL);
      await expect(page.locator(".map-attrib")).toContainText(LIABILITY);
      expect(await page.locator(".map-modal img").count()).toBe(0);
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
  await page.locator(".map-info").getByRole("button", { name: "查看相关 FAQ" }).click();
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
  await expect(page.locator(".map-list")).toContainText("第一汉马馆");
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
  await expect(page.locator(".map-summary")).toContainText("Copernicus WorldDEM-30");
  await expect(page.locator(".map-schematic")).toContainText("모식도");
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
  await expect(page.locator(".map-osm-link")).toBeVisible();
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
