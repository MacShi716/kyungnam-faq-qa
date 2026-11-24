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
  expect(frame.sat, label).toBeGreaterThan(16);
  if (frame.road.samples >= 8) {
    expect(frame.road.spread, label).toBeLessThan(0.2);
    expect(frame.road.mean, label).toBeLessThan(130);
  }
}

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
      await expect(page.locator(".map-walk")).toBeVisible();
      await page.locator(".map-pad-move [data-walk='forward']").click();
      await page.locator(".map-pad-look [data-walk='look-right']").click();
      const walking = await page.evaluate(() => window.CampusMap.debugSnapshot());
      expect(walking.viewMode).toBe("walk");
      expect(walking.logDepth).toBe(true);
      await page.locator(".map-toolbar [data-map-action='reset']").click();
      const reset = await page.evaluate(() => window.CampusMap.debugSnapshot());
      expect(reset.viewMode).toBe("orbit");
      await page.screenshot({ path: `/opt/cursor/artifacts/ground-${name}-reset.png` });
      expect(errors).toEqual([]);
    });
  }
});
