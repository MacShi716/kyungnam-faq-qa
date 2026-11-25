import { expect, test } from "@playwright/test";

const AI_HOST = /kyungnam-faq-zhipu-relay\.vercel\.app\/api\/ask/i;

async function silenceAi(page) {
  await page.route(AI_HOST, (route) => route.abort("failed"));
}

async function openMap(page) {
  await page.locator("#btn-map").click();
  await expect(page.locator(".map-modal")).toBeVisible();
  await expect(page.locator(".map-status")).toBeHidden({ timeout: 20000 });
}

async function probe(page) {
  return page.evaluate(() => window.CampusMap.debugGroundProbe());
}

function expectSolidGround(frame, label) {
  expect(frame, label).toBeTruthy();
  expect(frame.logDepth, label).toBe(true);
  expect(frame.offset, label).toBe(false);
  expect(frame.fog, label).toBeLessThan(0.0005);
  expect(frame.sat, label).toBeGreaterThan(4);
  if (frame.road.samples >= 8) {
    expect(frame.road.spread, label).toBeLessThan(0.35);
    expect(frame.road.mean, label).toBeLessThan(130);
  }
}

test("walk eye stays above the drawn hillside", async ({ page }) => {
  test.setTimeout(90000);
  await silenceAi(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await openMap(page);
  const gap = await page.evaluate(() => window.CampusMap.debugPlaceWalk(-165.05, 460.65));
  expect(gap.rendered - gap.linear).toBeGreaterThan(1.7);
  expect(gap.clearance).toBeGreaterThan(1.6);
  expect(gap.clearance).toBeLessThan(1.9);
});

test("shaded foundation stays readable by day and by night", async ({ page }) => {
  test.setTimeout(90000);
  await silenceAi(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await openMap(page);
  const day = await page.evaluate(() => window.CampusMap.debugFacadeColumn(1062064821));
  const dayWash = await probe(page);
  expect(day.shaded.skirt).toBeGreaterThan(60);
  expect(day.shaded.wall).toBeGreaterThan(40);
  expect(day.sunlit.wall).toBeGreaterThan(55);
  expect(dayWash.sat).toBeGreaterThan(4);
  expect(dayWash.luma).toBeLessThan(120);
  expect(dayWash.fog).toBeLessThan(0.0005);
  await page.evaluate(() => window.CampusMap.setTheme("dark"));
  const night = await page.evaluate(() => window.CampusMap.debugFacadeColumn(1062064821));
  const nightWash = await probe(page);
  expect(night.shaded.skirt).toBeGreaterThan(18);
  expect(night.shaded.wall).toBeGreaterThan(40);
  expect(nightWash.luma).toBeGreaterThan(22);
  expect(nightWash.fog).toBeLessThan(0.0005);
});

test.describe("ground color and roads stay stable while the camera moves", () => {
  for (const [name, viewport] of [
    ["desktop", { width: 1280, height: 800 }],
    ["ipad", { width: 1024, height: 768 }],
    ["phone", { width: 390, height: 844 }],
  ]) {
    test(name, async ({ page }) => {
      test.setTimeout(90000);
      const errors = [];
      page.on("pageerror", (err) => errors.push(String(err)));
      await silenceAi(page);
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: "light" });
      await page.goto("/");
      await openMap(page);
      const overview = await probe(page);
      expectSolidGround(overview, name + " overview");
      await page.screenshot({ path: `/opt/cursor/artifacts/ground-${name}-overview.png` });

      for (let i = 0; i < 4; i++) await page.locator(".map-toolbar [data-map-action='zoom-in']").click();
      const box = await page.locator(".map-canvas").boundingBox();
      await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.55);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.4, { steps: 8 });
      await page.mouse.up();
      const turned = await probe(page);
      expectSolidGround(turned, name + " orbit");
      expect(Math.abs(turned.distance - overview.distance)).toBeGreaterThan(20);
      await page.screenshot({ path: `/opt/cursor/artifacts/ground-${name}-orbit.png` });

      const shifted = await page.evaluate(() => window.CampusMap.debugShiftView(18, 6, -14));
      expectSolidGround(shifted, name + " shift");

      await page.locator(".map-toolbar [data-map-action='walk']").click();
      await expect(page.locator(".map-stick")).toBeVisible();
      await page.keyboard.press("KeyW");
      await page.keyboard.press("KeyE");
      const walking = await page.evaluate(() => window.CampusMap.debugSnapshot());
      expect(walking.viewMode).toBe("walk");
      expect(walking.logDepth).toBe(true);
      const resetBtn = page.locator(".map-toolbar [data-map-action='reset']");
      if (!(await resetBtn.isVisible())) await page.locator(".map-more-btn").click();
      await resetBtn.click();
      const reset = await page.evaluate(() => window.CampusMap.debugSnapshot());
      expect(reset.viewMode).toBe("orbit");
      await page.screenshot({ path: `/opt/cursor/artifacts/ground-${name}-reset.png` });
      expect(errors).toEqual([]);
    });
  }
});
