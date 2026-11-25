import { expect, test } from "@playwright/test";

const AI_HOST = /kyungnam-faq-zhipu-relay\.vercel\.app\/api\/ask/i;

function track(page) {
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (text.includes("favicon.ico") || text.includes("404") || text.includes("Failed to load resource")) return;
    errors.push(text);
  });
  return errors;
}

async function silenceAi(page) {
  await page.route(AI_HOST, (route) => route.abort("failed"));
}

async function openMap(page) {
  await page.locator("#btn-map").click();
  await expect(page.locator(".map-modal")).toBeVisible();
  await expect(page.locator(".map-status")).toBeHidden({ timeout: 20000 });
}

function boxGap(a, b) {
  if (!a || !b) return 0;
  const dx = Math.max(0, Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width)));
  const dy = Math.max(0, Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height)));
  if (dx === 0 && dy === 0) return 0;
  if (dx === 0) return dy;
  if (dy === 0) return dx;
  return Math.hypot(dx, dy);
}

test("building façades stay solid from the default, low, and close views", async ({ page }) => {
  test.setTimeout(120000);
  const errors = track(page);
  await silenceAi(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await openMap(page);
  const snap = await page.evaluate(() => window.CampusMap.debugSnapshot());
  expect(snap.facadeOpaque).toBe(true);
  expect(snap.viewMode).toBe("orbit");
  const current = await page.evaluate(() => window.CampusMap.debugOcclusion(0, "current"));
  expect(current.tested).toBeGreaterThan(2);
  expect(current.solid).toBe(current.tested);
  const low = await page.evaluate(() => window.CampusMap.debugOcclusion(1062064821, "low"));
  expect(low.placed).toBe(true);
  expect(low.tested).toBeGreaterThan(0);
  expect(low.solid).toBe(low.tested);
  const close = await page.evaluate(() => window.CampusMap.debugOcclusion(1062073167, "close"));
  expect(close.placed).toBe(true);
  expect(close.tested).toBeGreaterThan(0);
  expect(close.solid).toBe(close.tested);
  const back = await page.evaluate(() => window.CampusMap.debugSnapshot());
  expect(back.viewMode).toBe("orbit");
  expect(errors).toEqual([]);
});

test("walk controls move the camera and a building becomes the start", async ({ page }) => {
  test.setTimeout(120000);
  const errors = track(page);
  await silenceAi(page);
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await openMap(page);
  const before = await page.evaluate(() => window.CampusMap.debugSnapshot());
  await page.locator(".map-toolbar [data-map-action='walk']").click();
  await expect(page.locator(".map-stick")).toBeVisible();
  await expect(page.locator(".map-look-hint")).toBeVisible();
  await expect(page.locator(".map-toolbar [data-map-action='walk']")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".map-toolbar [data-map-action='walk']")).toHaveText("结束行走");
  await expect(page.locator(".map-account-btn")).toHaveText("本机资料");
  const entered = await page.evaluate(() => window.CampusMap.debugSnapshot());
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(1100);
  await page.keyboard.up("KeyW");
  const walked = await page.evaluate(() => window.CampusMap.debugSnapshot());
  expect(walked.viewMode).toBe("walk");
  const moved = Math.hypot(walked.camera.x - entered.camera.x, walked.camera.z - entered.camera.z);
  expect(moved).toBeGreaterThan(2);
  const targetMoved = Math.hypot(walked.target.x - entered.target.x, walked.target.z - entered.target.z);
  expect(targetMoved).toBeGreaterThan(2);
  expect(Math.hypot(walked.camera.x - before.camera.x, walked.camera.z - before.camera.z)).toBeGreaterThan(2);
  await page.keyboard.down("KeyE");
  await page.waitForTimeout(260);
  await page.keyboard.up("KeyE");
  const turned = await page.evaluate(() => window.CampusMap.debugSnapshot());
  expect(Math.abs(turned.yaw - walked.yaw)).toBeGreaterThan(0.2);
  await page.locator(".map-toolbar [data-map-action='north']").click();
  const north = await page.evaluate(() => window.CampusMap.debugSnapshot());
  expect(north.viewMode).toBe("walk");
  expect(Math.abs(north.yaw)).toBeLessThan(0.05);

  await page.locator("#btn-ko").evaluate((el) => el.click());
  await expect(page.locator(".map-toolbar [data-map-action='walk']")).toHaveText("걷기 종료");
  await expect(page.locator(".map-stick")).toHaveAttribute("aria-label", "이동");
  await page.locator("#theme-switch").evaluate((el) => el.click());
  await expect(page.locator(".map-modal")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".map-stick")).toBeVisible();
  const darkInk = await page.locator(".map-toolbar [data-map-action='walk']").evaluate((el) => {
    const style = getComputedStyle(el);
    return { color: style.color, background: style.backgroundColor };
  });
  expect(darkInk.color).not.toBe(darkInk.background);

  await page.locator("#btn-zh").evaluate((el) => el.click());
  await expect(page.locator(".map-toolbar [data-map-action='walk']")).toHaveText("结束行走");
  await page.locator(".map-list button[data-faq-id='F49']").click();
  await expect(page.locator(".map-toolbar [data-map-action='walk']")).toHaveText("结束行走");
  await expect(page.locator(".map-info")).toContainText("本馆");
  const atHall = await page.evaluate(() => window.CampusMap.debugSnapshot());
  expect(atHall.viewMode).toBe("walk");
  expect(atHall.focusId).toBe(1062064821);
  expect(atHall.focusDistance).toBeGreaterThan(4);
  expect(atHall.focusDistance).toBeLessThan(80);
  expect(Math.abs(atHall.eyeGap - 1.7)).toBeLessThan(1.2);
  await page.locator(".map-toolbar [data-map-action='reset']").click();
  await expect(page.locator(".map-toolbar [data-map-action='walk']")).toHaveText("步行");
  await expect(page.locator(".map-toolbar [data-map-action='walk']")).toHaveAttribute("aria-pressed", "false");
  const reset = await page.evaluate(() => window.CampusMap.debugSnapshot());
  expect(reset.viewMode).toBe("orbit");
  expect(reset.focusId).toBe(null);
  expect(reset.camera.y).toBeGreaterThan(atHall.camera.y + 20);
  const origin = Math.hypot(reset.target.x - before.target.x, reset.target.z - before.target.z);
  expect(origin).toBeLessThan(5);

  await page.locator(".map-intl-pill").click();
  await expect(page.locator(".map-info")).toContainText("暂无3D轮廓");
  const intl = await page.evaluate(() => window.CampusMap.debugSnapshot());
  expect(intl.viewMode).toBe("orbit");
  expect(intl.focusId).toBe(null);
  await expect(page.locator(".map-toolbar [data-map-action='walk']")).toHaveText("步行");
  await page.locator(".map-toolbar [data-map-action='walk']").click();
  await expect(page.locator(".map-toolbar [data-map-action='walk']")).toHaveText("结束行走");
  await page.locator(".map-toolbar [data-map-action='walk']").click();
  await expect(page.locator(".map-toolbar [data-map-action='walk']")).toHaveText("步行");
  await page.locator(".map-toolbar [data-map-action='walk']").click();
  await expect(page.locator(".map-toolbar [data-map-action='walk']")).toHaveText("结束行走");
  expect(errors).toEqual([]);
});

test("first and third person share one walker and space jumps", async ({ page }) => {
  test.setTimeout(120000);
  const errors = track(page);
  await silenceAi(page);
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await openMap(page);
  await page.locator(".map-toolbar [data-map-action='walk']").click();
  await expect(page.locator(".map-toolbar [data-map-action='walk']")).toHaveText("结束行走");
  await expect(page.locator(".map-crosshair")).toBeVisible();
  const third = await page.evaluate(() => window.CampusMap.debugSnapshot());
  expect(third.view).toBe("third");
  expect(third.avatarVisible).toBe(true);
  await expect(page.locator(".map-toolbar [data-map-action='view']")).toHaveText("第一人称");
  await page.keyboard.press("KeyV");
  const first = await page.evaluate(() => window.CampusMap.debugSnapshot());
  expect(first.view).toBe("first");
  expect(first.avatarVisible).toBe(false);
  await expect(page.locator(".map-toolbar [data-map-action='view']")).toHaveText("第三人称");
  await page.keyboard.press("KeyV");
  expect((await page.evaluate(() => window.CampusMap.debugSnapshot())).avatarVisible).toBe(true);
  const groundY = (await page.evaluate(() => window.CampusMap.debugSnapshot())).playerY;
  await page.keyboard.press("Space");
  await page.waitForFunction((base) => window.CampusMap.debugSnapshot().playerY > base + 0.2, groundY, { timeout: 4000 });
  await page.waitForFunction(() => window.CampusMap.debugSnapshot().grounded === true, null, { timeout: 6000 });
  const landed = await page.evaluate(() => window.CampusMap.debugSnapshot());
  expect(Math.abs(landed.playerY - groundY)).toBeLessThan(0.8);
  expect(errors).toEqual([]);
});

test("walk pads stay clear of the attribution bar and the detail card", async ({ page }) => {
  test.setTimeout(120000);
  const errors = track(page);
  await silenceAi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await openMap(page);
  await page.locator(".map-toolbar [data-map-action='walk']").click();
  await expect(page.locator(".map-stick")).toBeVisible();
  await expect(page.locator(".map-jump")).toBeVisible();
  await expect(page.locator(".map-crosshair")).toBeVisible();
  const padGap = boxGap(await page.locator(".map-stick").boundingBox(), await page.locator(".map-attrib").boundingBox());
  expect(padGap).toBeGreaterThan(0);
  await page.locator(".map-toolbar [data-map-action='directory']").click();
  await expect(page.locator(".map-modal")).not.toHaveClass(/dir-collapsed/);
  await page.locator(".map-intl-banner").click();
  await expect(page.locator(".map-modal")).toHaveClass(/dir-collapsed/);
  await expect(page.locator(".map-info")).toBeVisible();
  const openGap = boxGap(await page.locator(".map-attrib").boundingBox(), await page.locator(".map-info").boundingBox());
  expect(openGap).toBeGreaterThan(0);
  const detailGap = boxGap(await page.locator(".map-stick").boundingBox(), await page.locator(".map-info").boundingBox());
  expect(detailGap).toBeGreaterThan(0);
  await page.locator(".map-detail-summary").click();
  await page.locator(".map-detail-close").click();
  await page.locator(".map-toolbar [data-map-action='directory']").click();
  await page.locator(".map-list button[data-faq-id='F76']").click();
  await expect(page.locator(".map-info")).toContainText("设计馆");
  const again = boxGap(await page.locator(".map-attrib").boundingBox(), await page.locator(".map-info").boundingBox());
  expect(again).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

function groundWall(probe) {
  const hits = (probe.view || []).filter(Boolean);
  if (hits.length < 4) return false;
  const ground = hits.every((hit) => hit.kind === "terrain" || hit.kind === "tree");
  const flat = probe.visible && probe.visible.std[1] < 8 && probe.visible.n > 20;
  return ground && flat;
}

test("walk entry keeps the eye above the mesh and the frame off a single ground plane", async ({ page }) => {
  test.setTimeout(120000);
  const errors = track(page);
  await silenceAi(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await openMap(page);
  await page.waitForFunction(() => window.CampusMap && window.CampusMap.debugWalkProbe);
  await page.locator(".map-toolbar [data-map-action='reset']").click();
  await page.locator(".map-toolbar [data-map-action='walk']").click();
  const entered = await page.evaluate(() => window.CampusMap.debugWalkProbe());
  expect(entered.viewMode).toBe("walk");
  expect(entered.pitch).toBeGreaterThan(-0.05);
  expect(entered.clearanceMesh).toBeGreaterThan(1.2);
  expect(groundWall(entered)).toBe(false);
  await page.keyboard.press("KeyW");
  await page.keyboard.press("KeyD");
  const moved = await page.evaluate(() => window.CampusMap.debugWalkProbe());
  expect(moved.clearanceMesh).toBeGreaterThan(1.2);
  expect(groundWall(moved)).toBe(false);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await openMap(page);
  await page.waitForFunction(() => window.CampusMap && window.CampusMap.debugWalkProbe);
  await page.locator(".map-toolbar [data-map-action='directory']").click();
  await page.locator(".map-list button[data-faq-id='F49']").click();
  await expect(page.locator(".map-info")).toBeVisible();
  await expect(page.locator(".map-info")).toContainText("本馆");
  const atHall = await page.evaluate(() => window.CampusMap.debugWalkProbe());
  const kinds = new Set((atHall.view || []).filter(Boolean).map((hit) => hit.kind));
  expect(atHall.clearanceMesh).toBeGreaterThan(1.2);
  expect(kinds.has("building")).toBe(true);
  expect(kinds.has("terrain") || kinds.has("road") || kinds.has("path")).toBe(true);
  expect(groundWall(atHall)).toBe(false);
  await page.keyboard.press("KeyW");
  const stepped = await page.evaluate(() => window.CampusMap.debugWalkProbe());
  expect(stepped.clearanceMesh).toBeGreaterThan(1.2);
  expect(groundWall(stepped)).toBe(false);
  await page.keyboard.press("KeyS");
  await page.keyboard.press("KeyQ");
  await page.keyboard.press("KeyE");
  const after = await page.evaluate(() => window.CampusMap.debugWalkProbe());
  const afterKinds = new Set((after.view || []).filter(Boolean).map((hit) => hit.kind));
  expect(after.clearanceMesh).toBeGreaterThan(1.2);
  expect(afterKinds.has("building")).toBe(true);
  expect(groundWall(after)).toBe(false);
  expect(errors).toEqual([]);
});

test("phone walk separates the map from the controls", async ({ page }) => {
  test.setTimeout(120000);
  const errors = track(page);
  await silenceAi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await openMap(page);
  await page.locator(".map-toolbar [data-map-action='directory']").click();
  await page.locator(".map-list button[data-faq-id='F49']").click();
  await expect(page.locator(".map-detail-summary")).toContainText("本馆");
  await expect(page.locator(".map-detail-summary")).toContainText("展开详情");
  await expect(page.locator(".map-toolbar .map-intl-pill")).toBeHidden();
  const layout = await page.evaluate(() => {
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
    const stick = box(".map-stick");
    const knob = box(".map-stick-knob");
    const usable = window.visualViewport.height;
    const cx = canvas.x + canvas.w / 2;
    const cy = canvas.y + canvas.h / 2;
    const clear = { x: cx - 110, y: cy - 125, w: 220, h: 250 };
    const hit = document.elementFromPoint(cx, cy);
    return {
      canvasH: canvas.h,
      share: canvas.h / usable,
      stick: [stick.w, stick.h],
      knob: [knob.w, knob.h],
      centerIsMap: hit === document.querySelector(".map-canvas"),
      clearStick: overlap(clear, stick),
      infoOverlap: overlap(canvas, box(".map-info")),
    };
  });
  expect(layout.share).toBeGreaterThanOrEqual(0.6);
  expect(layout.stick).toEqual([104, 104]);
  expect(layout.knob).toEqual([44, 44]);
  expect(layout.centerIsMap).toBe(true);
  expect(layout.clearStick).toBe(0);
  expect(layout.infoOverlap).toBe(0);
  await page.keyboard.press("KeyW");
  await page.keyboard.press("KeyQ");
  await page.keyboard.press("KeyW");
  const after = await page.evaluate(() => window.CampusMap.debugWalkProbe());
  const kinds = new Set((after.view || []).filter(Boolean).map((hit) => hit.kind));
  expect(kinds.has("building")).toBe(true);
  expect(kinds.has("terrain") || kinds.has("road") || kinds.has("path")).toBe(true);
  expect(after.clearanceMesh).toBeGreaterThan(1.2);
  await page.locator(".map-detail-summary").click();
  await expect(page.locator(".map-detail-summary")).toContainText("收起详情");
  await expect(page.locator(".map-info")).toContainText("各楼层教室与用途");
  await expect(page.locator(".map-modal")).toHaveClass(/walk-active/);
  await page.locator(".map-detail-summary").click();
  await expect(page.locator(".map-detail-summary")).toContainText("展开详情");
  const barFit = await page.evaluate(() => {
    const bar = document.querySelector(".map-toolbar");
    return bar.scrollWidth <= bar.clientWidth + 2;
  });
  expect(barFit).toBe(true);
  await page.locator(".map-more-btn").click();
  await expect(page.locator(".map-account-form")).toContainText("建立本机资料");
  await expect(page.locator(".map-account-form")).toContainText("只存在这台浏览器");
  await expect(page.locator(".map-account-btn")).toBeHidden();
  await expect(page.locator(".map-more [data-map-action='reset']")).toBeVisible();
  await page.locator(".map-more [data-map-action='reset']").click();
  const reset = await page.evaluate(() => window.CampusMap.debugSnapshot());
  expect(reset.viewMode).toBe("orbit");
  await page.locator(".map-toolbar [data-map-action='walk']").click();
  const walked = await page.evaluate(() => window.CampusMap.debugWalkProbe());
  expect(walked.viewMode).toBe("walk");
  expect(walked.pitch).toBeGreaterThan(-0.05);
  const top = (walked.view || []).slice(0, 3).some((hit) => !hit || hit.kind !== "terrain");
  expect(top).toBe(true);
  expect(errors).toEqual([]);
});

test("360 walk reset and reentry keep the label and a campus view", async ({ page }) => {
  test.setTimeout(120000);
  const errors = track(page);
  await silenceAi(page);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await openMap(page);
  await expect(page.locator(".map-fallback")).toBeHidden();
  await expect(page.locator(".map-canvas")).toBeVisible();
  await page.locator(".map-toolbar [data-map-action='directory']").click();
  await page.locator(".map-list button[data-faq-id='F49']").click();
  const walk = page.locator(".map-toolbar [data-map-action='walk']");
  const narrowFit = await page.evaluate(() => {
    const bar = document.querySelector(".map-toolbar");
    return bar.scrollWidth <= bar.clientWidth + 2;
  });
  expect(narrowFit).toBe(true);
  await expect(walk).toHaveText("结束行走");
  await page.locator(".map-more-btn").click();
  await page.locator(".map-more [data-map-action='reset']").click();
  await expect(walk).toHaveText("步行");
  await expect(walk).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".map-walk")).toBeHidden();
  await walk.click();
  await expect(walk).toHaveText("结束行走");
  await walk.click();
  await expect(walk).toHaveText("步行");
  await expect(page.locator(".map-walk")).toBeHidden();
  await walk.click();
  await expect(walk).toHaveText("结束行走");
  const again = await page.evaluate(() => window.CampusMap.debugWalkProbe());
  expect(again.viewMode).toBe("walk");
  expect(again.clearanceMesh).toBeGreaterThan(1.2);
  expect(again.visible.std[0]).toBeGreaterThan(30);
  const upper = (again.view || []).slice(0, 3);
  expect(upper.every((hit) => hit && hit.kind === "terrain")).toBe(false);
  expect(errors).toEqual([]);
});
