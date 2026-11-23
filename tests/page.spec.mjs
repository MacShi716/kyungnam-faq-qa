import { expect, test } from "@playwright/test";

const AI_ENDPOINT = "https://kyungnam-faq-zhipu-relay.vercel.app/api/ask";
const AI_HOST = /kyungnam-faq-zhipu-relay\.vercel\.app\/api\/ask/i;
const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 800 },
];

const ZH_NO_MATCH = "没有找到匹配的回答";
const KO_NO_MATCH = "질문에 맞는 답변을 찾지 못했습니다";
const ZH_ERROR = "暂时无法获取回答，请稍后再试。";
const KO_ERROR = "지금은 답변을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.";
const ZH_RETRY = "重试";
const KO_RETRY = "다시 시도";
const ZH_AI_BADGE = "AI自主回答，未经确认";
const KO_AI_BADGE = "AI 자동 답변 · 확인되지 않음";
const ZH_VERIFIED = "已核实的FAQ回答";
const KO_VERIFIED = "확인된 FAQ 답변";
const MOCK_ZH = "模拟回答：请向系办公室确认。";
const MOCK_KO = "모의 답변입니다. 학과 사무실에서 확인하세요.";

function cors(headers = {}) {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    ...headers,
  };
}

async function installAi(page, onPost) {
  const posts = [];
  await page.route(/fcapp\.run/i, (route) => route.abort("failed"));
  await page.route(AI_HOST, async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors() });
      return;
    }
    if (req.method() !== "POST") {
      await route.abort("failed");
      return;
    }
    const body = req.postData() || "";
    posts.push({ url: req.url(), body });
    await onPost(route, posts.length, body);
  });
  return posts;
}

async function fulfillJson(route, status, payload) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: cors({ "content-type": "application/json" }),
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}

async function ask(page, text) {
  await page.locator("#input").fill(text);
  await page.locator("#btn-send").click();
}

function bot(page) {
  return page.locator("#thread .card").last();
}

async function expectServiceError(page, lang) {
  const card = bot(page);
  await expect(card.locator("[data-state='ai-error']")).toBeVisible();
  if (lang === "zh") {
    await expect(card).toContainText(ZH_ERROR);
    await expect(card).toContainText("也可以咨询系办公室。");
    await expect(card.getByRole("button", { name: ZH_RETRY })).toBeVisible();
    await expect(card).not.toContainText(ZH_NO_MATCH);
  } else {
    await expect(card).toContainText(KO_ERROR);
    await expect(card).toContainText("학과 사무실에 문의하셔도 됩니다.");
    await expect(card.getByRole("button", { name: KO_RETRY })).toBeVisible();
    await expect(card).not.toContainText(KO_NO_MATCH);
  }
  await expect(card).not.toContainText(ZH_AI_BADGE);
  await expect(card).not.toContainText(KO_AI_BADGE);
  await expect(card).not.toContainText(ZH_VERIFIED);
  await expect(card).not.toContainText(KO_VERIFIED);
  await expect(card).not.toContainText("你是不是想问");
  await expect(card).not.toContainText("혹시 이런 질문인가요?");
  const retry = card.getByRole("button", { name: lang === "zh" ? ZH_RETRY : KO_RETRY });
  const box = await retry.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
}

for (const viewport of VIEWPORTS) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("403, 500, abort, and bad 200 bodies are service errors, not a missing FAQ or an AI answer", async ({ page }) => {
      const cases = [
        ["403", (route) => fulfillJson(route, 403, { answer: "AccessDenied secret", code: "Current user is in debt" })],
        ["500", (route) => fulfillJson(route, 500, { answer: "upstream failed" })],
        ["abort", (route) => route.abort("internetdisconnected")],
        ["non-json", (route) => route.fulfill({ status: 200, contentType: "text/plain", headers: cors(), body: "<html>not json</html>" })],
        ["missing", (route) => fulfillJson(route, 200, { note: "no answer field" })],
        ["empty", (route) => fulfillJson(route, 200, { answer: "" })],
        ["blank", (route) => fulfillJson(route, 200, { answer: "  \n\t" })],
        ["null", (route) => fulfillJson(route, 200, { answer: null })],
      ];
      for (const [name, respond] of cases) {
        await page.unroute(AI_HOST).catch(() => {});
        const posts = await installAi(page, async (route) => respond(route));
        await page.goto("/");
        await page.evaluate(() => localStorage.removeItem("faq_ui_lang"));
        await page.goto("/");
        await ask(page, "你怎么知道我是谁");
        await expectServiceError(page, "zh");
        await expect(bot(page)).not.toContainText("AccessDenied");
        await expect(bot(page)).not.toContainText("upstream failed");
        expect(posts.length, name).toBeGreaterThan(0);
        expect(posts.every((p) => p.url === AI_ENDPOINT), name).toBe(true);
        await page.locator("#btn-clear").click();
      }
    });

    test("a 15 second hang is a service error", async ({ page }) => {
      await page.clock.install();
      await installAi(page, () => new Promise(() => {}));
      await page.goto("/");
      await ask(page, "你怎么知道我是谁");
      await expect(bot(page)).toContainText("AI正在生成回答");
      await page.clock.fastForward(15000);
      await expectServiceError(page, "zh");
    });

    test("mocked 200 keeps the unverified AI badge", async ({ page }) => {
      await installAi(page, (route, _n, body) => {
        const lang = JSON.parse(body).lang;
        return fulfillJson(route, 200, { answer: lang === "ko" ? MOCK_KO : MOCK_ZH });
      });
      await page.goto("/");
      await ask(page, "你怎么知道我是谁");
      const card = bot(page);
      await expect(card).toContainText(MOCK_ZH);
      await expect(card).toContainText(ZH_AI_BADGE);
      await expect(card).not.toContainText(ZH_VERIFIED);
      await expect(card).not.toContainText(ZH_NO_MATCH);
      await expect(card.locator("[data-state='ai-error']")).toHaveCount(0);
    });

    test("service error stays bilingual across language toggles and retry can recover", async ({ page }) => {
      let posts = 0;
      await installAi(page, (route, n, body) => {
        posts = n;
        if (n === 1) return fulfillJson(route, 500, { answer: "nope" });
        const lang = JSON.parse(body).lang;
        return fulfillJson(route, 200, { answer: lang === "ko" ? MOCK_KO : MOCK_ZH });
      });
      await page.goto("/");
      await ask(page, "你怎么知道我是谁");
      await expectServiceError(page, "zh");
      expect(posts).toBe(1);

      await page.locator("#btn-ko").click();
      await expectServiceError(page, "ko");
      expect(posts).toBe(1);

      await page.locator("#btn-zh").click();
      await expectServiceError(page, "zh");
      expect(posts).toBe(1);

      await page.locator("#btn-ko").click();
      await bot(page).getByRole("button", { name: KO_RETRY }).click();
      await expect(bot(page)).toContainText(MOCK_KO);
      await expect(bot(page)).toContainText(KO_AI_BADGE);
      await expect(bot(page).locator("[data-state='ai-error']")).toHaveCount(0);
      expect(posts).toBe(2);

      await page.locator("#btn-zh").click();
      await expectServiceError(page, "zh");
      expect(posts).toBe(2);
    });

    test("Korean identity question does not select the design building, and a real building query still does", async ({ page }) => {
      const posts = await installAi(page, (route, _n, body) => {
        const lang = JSON.parse(body).lang;
        return fulfillJson(route, 200, { answer: lang === "ko" ? MOCK_KO : MOCK_ZH });
      });
      await page.goto("/");
      await page.locator("#btn-ko").click();
      await ask(page, "내가 누구인지 어떻게 알아요?");
      await expect(bot(page)).toContainText(MOCK_KO);
      await expect(bot(page)).toContainText(KO_AI_BADGE);
      await expect(bot(page)).not.toContainText("디자인관은");
      await expect(bot(page)).not.toContainText("36번");
      await expect(bot(page)).not.toContainText(KO_VERIFIED);
      expect(posts.length).toBe(1);

      await page.locator("#btn-clear").click();
      const before = posts.length;
      await ask(page, "제1공학관은 어디에 있어요?");
      await expect(bot(page)).toContainText(KO_VERIFIED);
      await expect(bot(page)).toContainText("11번");
      await expect(bot(page)).not.toContainText(KO_AI_BADGE);
      expect(posts.length).toBe(before);

      await page.locator("#btn-zh").click();
      await expect(bot(page)).toContainText(ZH_VERIFIED);
      await expect(bot(page)).toContainText("11");
      await page.locator("#btn-clear").click();
      await ask(page, "第一工学馆在哪？");
      await expect(bot(page)).toContainText(ZH_VERIFIED);
      await expect(bot(page)).toContainText("11");
      expect(posts.length).toBe(before);

      await ask(page, "나는 누구인가요?");
      await expect(bot(page)).toContainText(MOCK_ZH);
      await expect(bot(page)).toContainText(ZH_AI_BADGE);
      await expect(bot(page)).not.toContainText(ZH_VERIFIED);
    });

    test("identity questions show no unrelated FAQ chips while typing or after an AI answer", async ({ page }) => {
      await installAi(page, (route, _n, body) => {
        const lang = JSON.parse(body).lang;
        return fulfillJson(route, 200, { answer: lang === "ko" ? MOCK_KO : MOCK_ZH });
      });
      await page.goto("/");
      await page.locator("#input").fill("你怎么知道我是谁");
      await expect(page.locator("#guess")).toBeHidden();
      await page.locator("#btn-send").click();
      await expect(bot(page)).toContainText(MOCK_ZH);
      await expect(bot(page)).toContainText(ZH_AI_BADGE);
      await expect(bot(page)).not.toContainText("山北");
      await expect(bot(page)).not.toContainText("你是不是想问");

      await page.locator("#btn-clear").click();
      await page.locator("#btn-ko").click();
      await page.locator("#input").fill("내가 누구인지 어떻게 알아요?");
      await expect(page.locator("#guess")).toBeHidden();
      await page.locator("#input").fill("나는 누구인가요?");
      await expect(page.locator("#guess")).toBeHidden();
      await page.locator("#btn-send").click();
      await expect(bot(page)).toContainText(MOCK_KO);
      await expect(bot(page)).toContainText(KO_AI_BADGE);
      await expect(bot(page)).not.toContainText("디자인관");
      await expect(bot(page)).not.toContainText("혹시 이런 질문인가요?");
    });

    test("school queries keep relevant typing and follow-up chips", async ({ page }) => {
      const posts = await installAi(page, (route) => route.abort("failed"));
      await page.goto("/");
      await page.locator("#btn-ko").click();
      await page.locator("#input").fill("휴학");
      await expect(page.locator("#guess")).toContainText("휴학 중에 주소나 전화번호가 바뀌면");
      await expect(page.locator("#guess")).not.toContainText("디자인관");
      await page.locator("#btn-send").click();
      const card = bot(page);
      await expect(card).toContainText("일반휴학");
      await expect(card).not.toContainText(KO_AI_BADGE);
      await expect(card.locator(".chips")).toContainText("휴학 중에 주소나 전화번호가 바뀌면");
      await expect(card).not.toContainText("디자인관");
      expect(posts).toHaveLength(0);

      await page.locator("#btn-clear").click();
      await page.locator("#btn-zh").click();
      await page.locator("#input").fill("工学馆");
      await expect(page.locator("#guess")).toContainText("第一工学馆在哪？");
      await expect(page.locator("#guess")).toContainText("第二工学馆在哪？");
      await expect(page.locator("#guess")).not.toContainText("山北");
      await page.locator("#btn-send").click();
      await expect(bot(page)).toContainText(ZH_VERIFIED);
      await expect(bot(page).locator(".chips")).toContainText("第二工学馆在哪？");
      await expect(bot(page)).not.toContainText("山北");
      expect(posts).toHaveLength(0);
    });
  });
}

async function layoutBoxes(page) {
  return page.evaluate(() => {
    const last = document.querySelector("#thread .card:last-child");
    const guess = document.getElementById("guess");
    const dock = document.querySelector(".dock");
    const error = document.querySelector("[data-state='ai-error']");
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, hidden: !!el.hidden || getComputedStyle(el).display === "none" };
    };
    const lastBox = box(last);
    const dockBox = box(dock);
    const guessBox = box(guess);
    const errorBox = box(error);
    const covered = (a, b) => a && b && !b.hidden ? Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) : 0;
    return {
      last: lastBox,
      dock: dockBox,
      guess: guessBox,
      error: errorBox,
      lastUnderDock: covered(lastBox, dockBox),
      errorUnderGuess: covered(errorBox, guessBox),
      reason: error ? error.dataset.reason || "" : "",
    };
  });
}

for (const size of [
  { name: "ipad", width: 1024, height: 712 },
  { name: "ipad-keyboard", width: 1024, height: 480 },
]) {
  test.describe(`dock layout ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test("an AI error after a FAQ answer stays above the composer", async ({ page }) => {
      await installAi(page, (route) => fulfillJson(route, 500, { answer: "hidden upstream" }));
      await page.goto("/");
      await ask(page, "什么时候可以申请休学？");
      await expect(bot(page)).toContainText("一般休学");
      await ask(page, "你几岁了");
      const error = bot(page).locator("[data-state='ai-error']");
      await expect(error).toContainText(ZH_ERROR);
      await expect(error).toHaveAttribute("data-reason", "http");
      await expect(bot(page).getByRole("button", { name: ZH_RETRY })).toBeVisible();
      await expect(page.locator("#guess")).toBeHidden();
      const boxes = await layoutBoxes(page);
      expect(boxes.lastUnderDock).toBe(0);
      expect(boxes.errorUnderGuess).toBe(0);
      await page.locator("#input").fill("工学馆");
      await expect(page.locator("#guess")).toContainText("第一工学馆");
      const typing = await layoutBoxes(page);
      expect(typing.lastUnderDock).toBe(0);
      expect(typing.errorUnderGuess).toBe(0);
    });
  });
}

test("a hung AI request is recorded as a timeout, not a successful answer", async ({ page }) => {
  await page.clock.install();
  await installAi(page, () => new Promise(() => {}));
  await page.goto("/");
  await ask(page, "你好");
  await expect(bot(page)).toContainText("AI正在生成回答");
  await page.clock.fastForward(15000);
  const error = bot(page).locator("[data-state='ai-error']");
  await expect(error).toContainText(ZH_ERROR);
  await expect(error).toHaveAttribute("data-reason", "timeout");
  await expect(bot(page)).not.toContainText("AI自主回答");
});

const switcher = (page) => page.locator("#theme-switch");

async function themeOf(page) {
  return page.locator("html").getAttribute("data-theme");
}

async function thumbSide(page) {
  return page.evaluate(() => {
    const track = document.querySelector(".theme-track").getBoundingClientRect();
    const thumb = document.querySelector(".theme-thumb").getBoundingClientRect();
    return (thumb.left + thumb.width / 2) < (track.left + track.width / 2) ? "left" : "right";
  });
}

async function dragTrack(page, fromRatio, toRatio) {
  const box = await page.locator(".theme-track").boundingBox();
  const y = box.y + box.height / 2;
  const x1 = box.x + Math.max(4, box.width * fromRatio);
  const x2 = box.x + Math.min(box.width - 4, box.width * toRatio);
  await page.mouse.move(x1, y);
  await page.mouse.down();
  await page.mouse.move(x2, y, { steps: 12 });
  await page.mouse.up();
}

function boxesOverlap(a, b) {
  if (!a || !b) return false;
  return a.x < b.x + b.width - 1 && a.x + a.width > b.x + 1 && a.y < b.y + b.height - 1 && a.y + a.height > b.y + 1;
}

test.describe("theme switch", () => {
  test("click, keys, and drags commit the same day and night states", async ({ page }) => {
    await page.goto("/");
    const sw = switcher(page);
    await expect(sw).toHaveAccessibleName("昼夜主题");
    await expect(sw).toHaveAttribute("aria-checked", "true");
    expect(await themeOf(page)).toBe("light");
    expect(await thumbSide(page)).toBe("right");

    await sw.click();
    await expect(sw).toHaveAttribute("aria-checked", "false");
    expect(await themeOf(page)).toBe("dark");
    await expect.poll(() => thumbSide(page)).toBe("left");
    expect(await page.evaluate(() => localStorage.getItem("faq_theme"))).toBe("dark");

    await sw.focus();
    await page.keyboard.press("Enter");
    expect(await themeOf(page)).toBe("light");
    await page.keyboard.press(" ");
    expect(await themeOf(page)).toBe("dark");
    await page.keyboard.press("ArrowRight");
    expect(await themeOf(page)).toBe("light");
    await expect.poll(() => thumbSide(page)).toBe("right");
    await page.keyboard.press("ArrowLeft");
    expect(await themeOf(page)).toBe("dark");
    await expect.poll(() => thumbSide(page)).toBe("left");

    await dragTrack(page, 0.08, 0.92);
    expect(await themeOf(page)).toBe("light");
    await expect.poll(() => thumbSide(page)).toBe("right");
    await dragTrack(page, 0.92, 0.08);
    expect(await themeOf(page)).toBe("dark");
    await expect.poll(() => thumbSide(page)).toBe("left");

    await page.locator("#btn-ko").click();
    await expect(sw).toHaveAccessibleName("화면 테마");
    await expect(sw).toHaveAttribute("aria-checked", "false");
  });

  test("a short drag snaps back, a vertical drag and cancel keep the saved theme", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("faq_theme", "dark"));
    await page.goto("/");
    expect(await themeOf(page)).toBe("dark");
    const box = await page.locator(".theme-track").boundingBox();
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + 6, y);
    await page.mouse.down();
    await page.mouse.move(box.x + 18, y, { steps: 6 });
    await page.mouse.up();
    expect(await themeOf(page)).toBe("dark");
    expect(await thumbSide(page)).toBe("left");

    await page.mouse.move(box.x + box.width / 2, box.y + 8);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 3, box.y + 96, { steps: 8 });
    await page.mouse.up();
    expect(await themeOf(page)).toBe("dark");

    await page.mouse.move(box.x + 8, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 8, y, { steps: 8 });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    expect(await themeOf(page)).toBe("dark");
    expect(await page.evaluate(() => localStorage.getItem("faq_theme"))).toBe("dark");

    await page.evaluate(() => {
      const el = document.getElementById("theme-switch");
      const r = el.getBoundingClientRect();
      const fire = (type, x) => el.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 7,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: type === "pointercancel" ? 0 : 1,
        clientX: x,
        clientY: r.top + r.height / 2,
      }));
      fire("pointerdown", r.left + 8);
      fire("pointermove", r.right - 8);
      fire("pointercancel", r.right - 8);
    });
    expect(await themeOf(page)).toBe("dark");
    expect(await page.evaluate(() => localStorage.getItem("faq_theme"))).toBe("dark");
  });

  test("saved theme survives reload and system theme applies only before a choice", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    expect(await themeOf(page)).toBe("dark");
    await switcher(page).click();
    expect(await themeOf(page)).toBe("light");
    await page.reload();
    expect(await themeOf(page)).toBe("light");
    expect(await page.evaluate(() => localStorage.getItem("faq_theme"))).toBe("light");
    await page.evaluate(() => localStorage.removeItem("faq_theme"));
    await page.reload();
    expect(await themeOf(page)).toBe("dark");
  });

  test("a stored FAQ answer still renders in the dark theme", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("faq_theme", "dark"));
    await page.goto("/");
    await ask(page, "什么时候可以申请休学？");
    await expect(bot(page)).toContainText("一般休学");
    expect(await themeOf(page)).toBe("dark");
    await page.setViewportSize({ width: 390, height: 320 });
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 180, y: 220, id: 1 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 180, y: 70, id: 1 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    expect(await themeOf(page)).toBe("dark");
  });
});

test.describe("theme motion", () => {
  test("the thumb can animate when motion is allowed", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    const duration = await page.locator(".theme-thumb").evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(duration).not.toBe("0s");
  });

  test("reduced motion removes the theme transition", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    const duration = await page.locator(".theme-thumb").evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(duration).toBe("0s");
  });
});

for (const size of [
  { name: "phone-375", width: 375, height: 667 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "ipad-712", width: 1024, height: 712 },
  { name: "ipad-480", width: 1024, height: 480 },
]) {
  test.describe(`theme layout ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    test("header controls stay apart from each other and the composer", async ({ page }) => {
      await page.goto("/");
      for (const mode of ["light", "dark"]) {
        if (mode === "dark") await switcher(page).click();
        expect(await themeOf(page)).toBe(mode);
        const boxes = await page.evaluate(() => {
          const read = (sel) => {
            const r = document.querySelector(sel).getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          };
          return {
            sw: read("#theme-switch"),
            lang: read(".lang"),
            clear: read("#btn-clear"),
            header: read("header.top"),
            dock: read(".dock"),
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
          };
        });
        expect(boxesOverlap(boxes.sw, boxes.lang)).toBe(false);
        expect(boxesOverlap(boxes.sw, boxes.clear)).toBe(false);
        expect(boxesOverlap(boxes.lang, boxes.clear)).toBe(false);
        expect(boxesOverlap(boxes.header, boxes.dock)).toBe(false);
        expect(boxes.sw.x).toBeGreaterThanOrEqual(0);
        expect(boxes.sw.x + boxes.sw.width).toBeLessThanOrEqual(size.width + 1);
        expect(boxes.clear.x + boxes.clear.width).toBeLessThanOrEqual(size.width + 1);
        expect(boxes.sw.height).toBeGreaterThanOrEqual(44);
        expect(boxes.scrollWidth).toBeLessThanOrEqual(boxes.clientWidth + 1);
      }
    });
  });
}

function channels(color) {
  const match = String(color).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) throw new Error("unparsed color " + color);
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
}

function luminance(color) {
  const { r, g, b } = channels(color);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

async function pageChrome(page) {
  return page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const card = getComputedStyle(document.querySelector("#thread .card"));
    const bar = getComputedStyle(document.querySelector(".prompt-bar"));
    const lang = getComputedStyle(document.querySelector(".lang"));
    const dock = getComputedStyle(document.querySelector(".dock"));
    return {
      bg: getComputedStyle(document.documentElement).backgroundColor,
      ink: body.color,
      cardBlur: card.backdropFilter || card.webkitBackdropFilter || "",
      barBlur: bar.backdropFilter || bar.webkitBackdropFilter || "",
      langBlur: lang.backdropFilter || lang.webkitBackdropFilter || "",
      dockBg: dock.backgroundImage || "",
      thumbShadow: getComputedStyle(document.querySelector(".theme-thumb")).boxShadow,
      trackShadow: getComputedStyle(document.querySelector(".theme-track")).boxShadow,
      moon: document.querySelectorAll(".pix.moon rect").length,
      sun: document.querySelectorAll(".pix.sun rect").length,
    };
  });
}

test("both themes keep frosted glass, separated rim light, and distinct answer states", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installAi(page, (route, _n, body) => {
    const lang = JSON.parse(body).lang;
    return fulfillJson(route, 200, { answer: lang === "ko" ? MOCK_KO : MOCK_ZH });
  });
  await page.goto("/");
  const light = await pageChrome(page);
  expect(luminance(light.bg)).toBeGreaterThan(220);
  expect(luminance(light.ink)).toBeLessThan(50);
  expect(light.cardBlur).toContain("blur");
  expect(light.barBlur).toContain("blur");
  expect(light.langBlur).toContain("blur");
  expect(light.trackShadow).toContain("inset");
  expect(light.thumbShadow.split("inset")[0]).toMatch(/-[\d.]+px/);
  expect(light.moon).toBeGreaterThan(20);
  expect(light.sun).toBeGreaterThan(20);

  await page.locator("#input").focus();
  const focused = await page.locator("#prompt-bar").evaluate((el) => getComputedStyle(el).transform);
  expect(focused === "none" || focused === "matrix(1, 0, 0, 1, 0, 0)").toBe(true);
  const clearBox = await page.locator("#btn-clear").boundingBox();
  await page.mouse.move(clearBox.x + 6, clearBox.y + 8);
  expect(await page.locator("#btn-clear").evaluate((el) => getComputedStyle(el).transform)).toBe("none");

  await ask(page, "第一工学馆在哪？");
  const verified = channels(await page.locator(".badge.ok").evaluate((el) => getComputedStyle(el).color));
  expect(verified.g).toBeGreaterThan(verified.r);
  const bubble = await page.evaluate(() => {
    const user = document.querySelector(".card.user").getBoundingClientRect();
    const answer = document.querySelector("#thread .card:not(.user)").getBoundingClientRect();
    return { userLeft: user.left, answerLeft: answer.left, userRight: user.right, answerRight: answer.right };
  });
  expect(bubble.userLeft).toBeGreaterThan(bubble.answerLeft + 8);
  expect(Math.abs(bubble.userRight - bubble.answerRight)).toBeLessThan(3);

  await page.locator("#btn-clear").click();
  await ask(page, "什么时候可以申请休学？");
  const unverified = channels(await page.locator(".badge.warn").evaluate((el) => getComputedStyle(el).color));
  expect(unverified.r).toBeGreaterThan(unverified.b);
  expect(unverified.r).not.toBe(verified.r);

  await page.locator("#btn-clear").click();
  await ask(page, "你怎么知道我是谁");
  const ai = channels(await page.locator(".badge.ai").evaluate((el) => getComputedStyle(el).color));
  expect(ai.b).toBeGreaterThan(ai.r);
  expect(ai.b).not.toBe(unverified.b);

  await page.unroute(AI_HOST).catch(() => {});
  await installAi(page, (route) => fulfillJson(route, 500, { answer: "hidden" }));
  await page.locator("#btn-clear").click();
  await ask(page, "你怎么知道我是谁");
  const error = page.locator("[data-state='ai-error']");
  await expect(error).toContainText(ZH_ERROR);
  await expect(error).not.toContainText(ZH_NO_MATCH);
  const danger = channels(await error.evaluate((el) => getComputedStyle(el).color));
  expect(danger.r).toBeGreaterThan(danger.g);
  expect(danger.r).toBeGreaterThan(danger.b);

  await switcher(page).click();
  const dark = await pageChrome(page);
  expect(await themeOf(page)).toBe("dark");
  expect(luminance(dark.bg)).toBeLessThan(40);
  expect(luminance(dark.ink)).toBeGreaterThan(200);
  expect(dark.cardBlur).toContain("blur");
  expect(dark.barBlur).toContain("blur");
  const nightGlow = dark.thumbShadow.split("inset")[0];
  expect(nightGlow).toMatch(/-[\d.]+px/);
  expect(dark.trackShadow).toContain("inset");
});

test.describe("card spotlight", () => {
  test("reduced motion and the composer do not show a card spotlight", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const card = page.locator("#thread .card").first();
    const box = await card.boundingBox();
    await page.mouse.move(box.x + 28, box.y + 28);
    expect(await card.evaluate((el) => el.style.getPropertyValue("--spot") || "0")).toBe("0");
  });

  test("a fine pointer lights the answer card without tilting it or the input", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    await ask(page, "第一工学馆在哪？");
    const answer = page.locator("#thread .card:not(.user)").last();
    const user = page.locator(".card.user").last();
    await answer.evaluate((el) => { el.style.animation = "none"; });
    const box = await answer.boundingBox();
    await page.mouse.move(box.x + 36, box.y + 42);
    await expect.poll(() => answer.evaluate((el) => el.style.getPropertyValue("--spot"))).toBe("1");
    const tilt = await answer.evaluate((el) => getComputedStyle(el).transform);
    expect(tilt === "none" || tilt === "matrix(1, 0, 0, 1, 0, 0)").toBe(true);
    expect(await answer.evaluate((el) => el.style.transform || "")).toBe("");
    const userBox = await user.boundingBox();
    await page.mouse.move(userBox.x + 12, userBox.y + 12);
    await expect.poll(() => answer.evaluate((el) => el.style.getPropertyValue("--spot") || "0")).toBe("0");
    expect(await user.evaluate((el) => el.style.getPropertyValue("--spot") || "0")).toBe("0");
    await page.locator("#input").click();
    expect(await page.locator("#prompt-bar").evaluate((el) => el.style.getPropertyValue("--spot") || "0")).toBe("0");
    const zoom = await page.locator("#prompt-bar").evaluate((el) => getComputedStyle(el).transform);
    expect(zoom === "none" || zoom === "matrix(1, 0, 0, 1, 0, 0)").toBe(true);
  });
});

for (const size of [
  { name: "desktop-1280", width: 1280, height: 800 },
  { name: "phone-375", width: 375, height: 667 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "ipad-712", width: 1024, height: 712 },
  { name: "ipad-480", width: 1024, height: 480 },
]) {
  test.describe(`unified style layout ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    test("header, answers, and composer stay apart in both themes", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      const setTheme = (mode) => page.evaluate((next) => {
        const sw = document.getElementById("theme-switch");
        if (document.documentElement.getAttribute("data-theme") !== next) sw.click();
      }, mode);
      const readLayout = () => page.evaluate(() => {
        const read = (sel) => {
          const r = document.querySelector(sel).getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        };
        const textBox = (sel) => {
          const el = document.querySelector(sel);
          const r = el.getBoundingClientRect();
          return { height: r.height, width: r.width };
        };
        const answer = document.querySelector("#thread .card:not(.user)");
        const guess = document.getElementById("guess");
        const dock = document.querySelector(".dock");
        const overlap = (a, b) => {
          if (!a || !b) return 0;
          const br = b.getBoundingClientRect();
          const ar = a.getBoundingClientRect();
          if (b.hidden || getComputedStyle(b).display === "none") return 0;
          return Math.max(0, Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top));
        };
        return {
          sw: read("#theme-switch"),
          lang: read(".lang"),
          clear: read("#btn-clear"),
          header: read("header.top"),
          dock: read(".dock"),
          title: textBox("#title"),
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          answerUnderDock: overlap(answer, dock),
          answerUnderGuess: overlap(answer, guess),
        };
      });
      for (const mode of ["light", "dark"]) {
        await setTheme(mode);
        expect(await themeOf(page)).toBe(mode);
        let boxes = await readLayout();
        expect(boxesOverlap(boxes.sw, boxes.lang)).toBe(false);
        expect(boxesOverlap(boxes.lang, boxes.clear)).toBe(false);
        expect(boxesOverlap(boxes.header, boxes.dock)).toBe(false);
        expect(boxes.sw.height).toBeGreaterThanOrEqual(44);
        expect(boxes.clear.height).toBeGreaterThanOrEqual(44);
        expect(boxes.lang.height).toBeGreaterThanOrEqual(44);
        expect(boxes.title.height).toBeGreaterThanOrEqual(22);
        expect(boxes.scrollWidth).toBeLessThanOrEqual(boxes.clientWidth + 1);
        expect(boxes.sw.x).toBeGreaterThanOrEqual(-1);
        expect(boxes.clear.x + boxes.clear.width).toBeLessThanOrEqual(size.width + 1);
      }
      await ask(page, "第一工学馆在哪？");
      await expect(bot(page)).toContainText("11");
      await expect(page.locator("#guess")).toBeHidden();
      for (const mode of ["light", "dark"]) {
        await setTheme(mode);
        let boxes = await readLayout();
        expect(boxes.answerUnderDock).toBe(0);
        expect(boxes.answerUnderGuess).toBe(0);
        expect(boxes.scrollWidth).toBeLessThanOrEqual(boxes.clientWidth + 1);
        expect(boxesOverlap(boxes.header, boxes.dock)).toBe(false);
        await page.locator("#input").fill("工学馆");
        await expect(page.locator("#guess")).toContainText("工学馆");
        boxes = await readLayout();
        expect(boxes.answerUnderDock).toBe(0);
        expect(boxes.answerUnderGuess).toBe(0);
        expect(boxes.scrollWidth).toBeLessThanOrEqual(boxes.clientWidth + 1);
        await page.locator("#input").fill("");
        await expect(page.locator("#guess")).toBeHidden();
      }
    });
  });
}
