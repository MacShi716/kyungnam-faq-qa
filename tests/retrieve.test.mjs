import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const AI_ENDPOINT = "https://kyungnam-faq-ai-bisozsckxu.cn-hongkong.fcapp.run";

function loadApi() {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const start = html.indexOf("const FAQ_DATA");
  const end = html.indexOf("\n  let uiLang");
  assert.ok(start > 0 && end > start, "retriever source markers");
  const api = new Function(`${html.slice(start, end)}
    return {
      FAQ_DATA,
      THRESHOLD,
      searchFaqs,
      matchConfidence: typeof matchConfidence === "function" ? matchConfidence : undefined,
      acceptedFaq: typeof acceptedFaq === "function" ? acceptedFaq : undefined,
    };
  `)();
  api.html = html;
  return api;
}

function variants(faq, lang) {
  const field = lang === "zh" ? faq.question_zh : faq.question_ko;
  return String(field || "").split("|").map((s) => s.trim()).filter(Boolean);
}

test("keeps the existing AI endpoint and verified FAQ facts", () => {
  const api = loadApi();
  assert.match(api.html, new RegExp(AI_ENDPOINT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const f13 = api.FAQ_DATA.find((f) => f.id === "F13");
  const f76 = api.FAQ_DATA.find((f) => f.id === "F76");
  assert.equal(f13.checked_at, "2026-10-28");
  assert.equal(f76.checked_at, "2026-10-28");
  assert.match(f13.answer, /11번/);
  assert.match(f76.answer, /36번/);
});

test("generic conversational wording is not accepted as an unrelated FAQ", () => {
  const api = loadApi();
  assert.equal(typeof api.matchConfidence, "function");
  assert.equal(typeof api.acceptedFaq, "function");

  const ko = "내가 누구인지 어떻게 알아요?";
  const top = api.searchFaqs(ko, "ko", 1)[0];
  assert.equal(top.faq.id, "F76");
  assert.ok(top.score >= api.THRESHOLD, "raw overlap still clears 0.4 before the confidence gate");
  assert.ok(top.score < 0.5);
  assert.ok(api.matchConfidence(ko, top.faq, "ko") < api.THRESHOLD);
  assert.equal(api.acceptedFaq(ko, "ko"), null);

  const generics = [
    ["ko", "나는 누구인가요?"],
    ["ko", "당신은 누구예요?"],
    ["ko", "어떻게 알아요?"],
    ["ko", "알려주세요"],
    ["ko", "어디에 있어요?"],
    ["ko", "뭐예요?"],
    ["ko", "어떻게 해요?"],
    ["zh", "你怎么知道我是谁"],
    ["zh", "你是谁"],
    ["zh", "怎么走？"],
    ["zh", "在哪"],
    ["zh", "怎么办"],
    ["zh", "你好"],
  ];
  for (const [lang, q] of generics) {
    assert.equal(api.acceptedFaq(q, lang), null, q);
  }
});

test("school questions and paraphrases still select the same FAQ", () => {
  const api = loadApi();
  const expectId = (q, lang, id) => {
    const faq = api.acceptedFaq(q, lang);
    assert.ok(faq, q);
    assert.equal(faq.id, id, q);
  };
  expectId("第一工学馆在哪？", "zh", "F13");
  expectId("第1工学馆在哪里", "zh", "F13");
  expectId("请问第一工学馆在哪里", "zh", "F13");
  expectId("工学馆怎么走？", "zh", "F13");
  expectId("제1공학관은 어디에 있어요?", "ko", "F13");
  expectId("제1공학관 어디야", "ko", "F13");
  expectId("1공학관 위치 알려주세요", "ko", "F13");
  expectId("디자인관 어떻게 가요?", "ko", "F76");
  expectId("设计馆在哪？", "zh", "F76");
  expectId("签证续签要多久", "zh", "F09");
  expectId("什么时候可以申请休学？", "zh", "F01");
  expectId("什么时候选课？", "zh", "F04");
  expectId("휴학 신청은 언제 해요?", "ko", "F01");
  expectId("수강신청은 언제 해요?", "ko", "F04");
  expectId("正门在哪？", "zh", "F42");
  expectId("有TOPIK报名费补助吗？", "zh", "F33");
});

test("stored questions keep their current retrieval result", () => {
  const api = loadApi();
  const knownOverlap = new Map([
    ["ko\t중앙도서관 위치 알려주세요", "F26"],
  ]);
  const failures = [];
  for (const faq of api.FAQ_DATA) {
    for (const lang of ["ko", "zh"]) {
      for (const q of variants(faq, lang)) {
        const got = api.acceptedFaq(q, lang);
        const key = `${lang}\t${q}`;
        const expectId = knownOverlap.has(key) ? knownOverlap.get(key) : faq.id;
        if (!got || got.id !== expectId) {
          failures.push(`${key} => ${got && got.id}`);
        }
      }
    }
  }
  assert.deepEqual(failures, []);
});
