import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  MAX_QUESTION_CHARS,
  MODEL,
  PAGES_ORIGIN,
  UPSTREAM_TIMEOUT_MS,
  UPSTREAM_URL,
  createRelay,
  systemPrompt,
} from "../lib/relay.mjs";

const KEY = "test-key-not-a-secret";
const QUESTION = "你怎么知道我是谁";

function relay(fetchImpl, extra = {}) {
  return createRelay({
    fetchImpl,
    env: { ZHIPU_API_KEY: KEY },
    ...extra,
  });
}

function post(body, headers = {}) {
  return new Request("https://relay.example/api/ask", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: PAGES_ORIGIN,
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function upstreamOk(answer) {
  return async (url, init) => {
    assert.equal(url, UPSTREAM_URL);
    assert.equal(url.includes("fcapp.run"), false);
    const sent = JSON.parse(init.body);
    assert.equal(sent.model, MODEL);
    assert.equal(sent.stream, false);
    assert.equal(sent.max_tokens <= 512, true);
    assert.equal(init.headers.authorization, `Bearer ${KEY}`);
    return new Response(JSON.stringify({ choices: [{ message: { content: answer } }] }), { status: 200 });
  };
}

test("configuration stays on one Hobby region and a short function budget", () => {
  const vercel = JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.deepEqual(vercel.regions, ["hkg1"]);
  assert.equal(vercel.functions["api/ask.mjs"].maxDuration, 20);
  assert.equal(pkg.engines.node, "24.x");
  assert.equal(UPSTREAM_TIMEOUT_MS < 15000, true);
  assert.equal(UPSTREAM_TIMEOUT_MS < vercel.functions["api/ask.mjs"].maxDuration * 1000, true);
});

test("system prompt names Changwon and refuses identity, invented facts, and shuttle claims", () => {
  const zh = systemPrompt("zh");
  const ko = systemPrompt("ko");
  for (const text of [zh, ko]) {
    assert.match(text, /Changwon/);
    assert.match(text, /경상남도/);
    assert.match(text, /Gwangju/);
    assert.match(text, /Busan/);
    assert.match(text, /do not know who the user is/i);
    assert.match(text, /校车/);
    assert.match(text, /phone numbers/i);
  }
  assert.match(zh, /Simplified Chinese/);
  assert.match(ko, /Korean/);
});

test("OPTIONS allows the pages origin and local origins, and rejects others", async () => {
  const handle = relay(async () => {
    throw new Error("upstream should not be called");
  });
  const ok = await handle(new Request("https://relay.example/api/ask", {
    method: "OPTIONS",
    headers: { origin: PAGES_ORIGIN, "access-control-request-method": "POST" },
  }));
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get("access-control-allow-origin"), PAGES_ORIGIN);
  assert.match(ok.headers.get("access-control-allow-methods"), /POST/);
  assert.equal(ok.headers.get("access-control-allow-credentials"), null);

  for (const origin of ["http://localhost", "http://localhost:4173", "http://127.0.0.1:3000", "https://127.0.0.1"]) {
    const local = await handle(new Request("https://relay.example/api/ask", {
      method: "OPTIONS",
      headers: { origin },
    }));
    assert.equal(local.status, 204, origin);
    assert.equal(local.headers.get("access-control-allow-origin"), origin);
  }

  const denied = await handle(new Request("https://relay.example/api/ask", {
    method: "OPTIONS",
    headers: { origin: "https://evil.example" },
  }));
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get("access-control-allow-origin"), null);
});

test("POST returns a trimmed answer and defaults the language to Chinese", async () => {
  let seenLang = "";
  const handle = relay(async (_url, init) => {
    const sent = JSON.parse(init.body);
    seenLang = sent.messages[0].content;
    assert.equal(sent.messages[1].content, QUESTION);
    return new Response(JSON.stringify({ choices: [{ message: { content: "  模拟回答  " } }] }), { status: 200 });
  });
  const res = await handle(post({ question: `  ${QUESTION}  ` }));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { answer: "模拟回答" });
  assert.match(seenLang, /Simplified Chinese/);
  assert.equal(res.headers.get("access-control-allow-origin"), PAGES_ORIGIN);
});

test("Korean requests keep the question and ask for Korean", async () => {
  let prompt = "";
  const handle = relay(async (_url, init) => {
    prompt = JSON.parse(init.body).messages[0].content;
    return new Response(JSON.stringify({ choices: [{ message: { content: "모의 답변" } }] }), { status: 200 });
  });
  const res = await handle(post({ question: "나는 누구인가요?", lang: "ko" }));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).answer, "모의 답변");
  assert.match(prompt, /Korean/);
});

test("rejected inputs never call upstream", async () => {
  let calls = 0;
  const handle = relay(async () => {
    calls += 1;
    return new Response("{}", { status: 200 });
  });
  assert.equal((await handle(post({ question: "" }))).status, 400);
  assert.equal((await handle(post({ question: "x".repeat(MAX_QUESTION_CHARS + 1) }))).status, 400);
  assert.equal((await handle(post({ question: "hello", lang: "en" }))).status, 400);
  assert.equal((await handle(post("not-json"))).status, 400);
  assert.equal((await handle(new Request("https://relay.example/api/ask", {
    method: "POST",
    headers: { "content-type": "text/plain", origin: PAGES_ORIGIN },
    body: "hi",
  }))).status, 415);
  assert.equal((await handle(new Request("https://relay.example/api/ask", { method: "GET" }))).status, 405);
  const huge = await handle(new Request("https://relay.example/api/ask", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: PAGES_ORIGIN,
      "content-length": "99999",
    },
    body: JSON.stringify({ question: "hi" }),
  }));
  assert.equal(huge.status, 413);
  const blocked = await handle(post({ question: "hi" }, { origin: "https://evil.example" }));
  assert.equal(blocked.status, 403);
  assert.equal(calls, 0);
});

test("missing configuration and upstream failures stay generic", async () => {
  const unconfigured = createRelay({ env: {}, fetchImpl: async () => { throw new Error("should not fetch"); } });
  assert.equal((await unconfigured(post({ question: "hi" }))).status, 503);

  const leaked = "Bearer secret upstream detail sk-live";
  const failed = relay(async () => new Response(leaked, { status: 500 }));
  const failure = await failed(post({ question: "hi" }));
  assert.equal(failure.status, 502);
  const failureBody = await failure.text();
  assert.equal(failureBody.includes(leaked), false);
  assert.equal(failureBody.includes(KEY), false);
  assert.match(failureBody, /upstream_failed/);

  const empty = relay(async () => new Response(JSON.stringify({ choices: [{ message: { content: "   " } }] }), { status: 200 }));
  assert.equal((await empty(post({ question: "hi" }))).status, 502);

  const echoed = relay(upstreamOk(`prefix ${KEY} suffix`));
  const hidden = await echoed(post({ question: "hi" }));
  assert.equal(hidden.status, 502);
  assert.equal((await hidden.text()).includes(KEY), false);
});

test("an aborted upstream call returns 504 without the question in logs", async () => {
  const logs = [];
  const original = console.log;
  console.log = (...args) => logs.push(args.join(" "));
  try {
    const handle = relay((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        const err = new Error("aborted");
        err.name = "AbortError";
        reject(err);
      });
    }), { timeoutMs: 30 });
    const res = await handle(post({ question: QUESTION }));
    assert.equal(res.status, 504);
    assert.match(await res.text(), /upstream_timeout/);
    assert.equal(logs.some((line) => line.includes(QUESTION) || line.includes(KEY)), false);
  } finally {
    console.log = original;
  }
});

test("the per-instance limit does not call upstream after the cap", async () => {
  let calls = 0;
  const handle = relay(async () => {
    calls += 1;
    return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
  }, { rateLimit: { max: 2, windowMs: 60_000 } });
  const headers = { "x-forwarded-for": "203.0.113.8" };
  assert.equal((await handle(post({ question: "one" }, headers))).status, 200);
  assert.equal((await handle(post({ question: "two" }, headers))).status, 200);
  assert.equal((await handle(post({ question: "three" }, headers))).status, 429);
  assert.equal((await handle(post({ question: "other" }, { "x-forwarded-for": "203.0.113.9" }))).status, 200);
  assert.equal(calls, 3);
});
