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
