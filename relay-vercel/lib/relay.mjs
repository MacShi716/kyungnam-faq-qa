export const UPSTREAM_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
export const MODEL = "glm-4-flash";
export const UPSTREAM_TIMEOUT_MS = 12000;
export const MAX_BODY_BYTES = 4096;
export const MAX_QUESTION_CHARS = 300;
export const MAX_OUTPUT_TOKENS = 512;
export const MAX_ANSWER_CHARS = 4000;
export const PAGES_ORIGIN = "https://macshi716.github.io";

const RULES = [
  "You are a conversational assistant for students at Kyungnam University (경남대학교 / 庆南大学).",
  "The campus is in Changwon, Gyeongsangnam-do, South Korea (창원시, 경상남도 / 庆尚南道昌原市).",
  "It is not in Gwangju (광주 / 光州) and not in Busan (부산 / 釜山).",
  "한국어로 묻거나 lang이 ko이면 한국어로 답하고, 中文로 묻거나 lang이 zh이면 简体中文으로 답하세요.",
  "Answer in Korean when the requested language is Korean, and in Simplified Chinese when it is Chinese.",
  "Ordinary conversation is allowed, including greetings. This is not a retrieval-only bot.",
  "You do not know who the user is. You cannot see accounts, student records, or any private information. If asked who they are, say clearly that you do not know.",
  "사용자를 알고 있다고 말하지 마세요. 계정, 학번, 비공개 정보에는 접근할 수 없습니다.",
  "不要声称知道用户是谁，也不能访问账号、学号或任何私人信息。",
  "Do not invent dates, phone numbers, fees, URLs, room numbers, or office facts. If you are unsure, say so and suggest confirming with the department office.",
  "날짜, 전화번호, 비용, URL, 호실, 사무실 사실을 지어내지 마세요. 모르면 모른다고 하세요.",
  "不要编造日期、电话、费用、网址、房间号或办公室信息。不确定时请明确说明。",
  "Do not describe a campus shuttle or 校车, and do not claim that one exists.",
  "캠퍼스 셔틀이나 校车 정보를 만들지 마세요.",
  "不要提供校车或校园班车信息，也不要声称存在校车。",
  "Do not present an uncertain statement as a verified school rule.",
].join("\n");

export function systemPrompt(lang) {
  const reply = lang === "ko" ? "Reply language: Korean." : "Reply language: Simplified Chinese.";
  return `${RULES}\n${reply}`;
}

export function isAllowedOrigin(origin) {
  if (!origin || origin === "null") return false;
  if (origin === PAGES_ORIGIN) return true;
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return false;
  return url.hostname === "localhost" || url.hostname === "127.0.0.1";
}

function corsHeaders(origin) {
  if (!isAllowedOrigin(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "600",
    vary: "origin",
  };
}

function json(status, body, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...corsHeaders(origin),
    },
  });
}

function clientKey(request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const first = forwarded.split(",")[0].trim();
  return first || "anonymous";
}

function allowRequest(buckets, key, now, limit) {
  const t = now();
  const fresh = (buckets.get(key) || []).filter((ts) => t - ts < limit.windowMs);
  if (fresh.length >= limit.max) {
    buckets.set(key, fresh);
    return false;
  }
  fresh.push(t);
  buckets.set(key, fresh);
  if (buckets.size > 5000) {
    const oldest = buckets.keys().next().value;
    buckets.delete(oldest);
  }
  return true;
}

function answerText(payload) {
  const message = payload && payload.choices && payload.choices[0] && payload.choices[0].message;
  const content = message && message.content;
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part.text === "string") return part.text;
      return "";
    })
    .join("")
    .trim();
}

export function createRelay(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const env = options.env || process.env;
  const timeoutMs = options.timeoutMs ?? UPSTREAM_TIMEOUT_MS;
  const now = options.now || Date.now;
  const limit = options.rateLimit || { max: 30, windowMs: 60_000 };
  const buckets = new Map();

  return async function handle(request) {
    const origin = request.headers.get("origin");
    if (origin && !isAllowedOrigin(origin)) {
      return json(403, { error: "origin_not_allowed" }, null);
    }
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: { "cache-control": "no-store", ...corsHeaders(origin) },
      });
    }
    if (request.method !== "POST") {
      return json(405, { error: "method_not_allowed" }, origin);
    }
    if (!allowRequest(buckets, clientKey(request), now, limit)) {
      return json(429, { error: "rate_limited" }, origin);
    }

    const declared = Number(request.headers.get("content-length") || 0);
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      return json(413, { error: "body_too_large" }, origin);
    }
    const type = request.headers.get("content-type") || "";
    if (!type.toLowerCase().startsWith("application/json")) {
      return json(415, { error: "unsupported_media_type" }, origin);
    }

    let raw;
    try {
      raw = await request.arrayBuffer();
    } catch {
      return json(400, { error: "invalid_body" }, origin);
    }
    if (raw.byteLength > MAX_BODY_BYTES) {
      return json(413, { error: "body_too_large" }, origin);
    }

    let data;
    try {
      data = JSON.parse(new TextDecoder().decode(raw));
    } catch {
      return json(400, { error: "invalid_json" }, origin);
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return json(400, { error: "invalid_json" }, origin);
    }

    const question = typeof data.question === "string" ? data.question.trim() : "";
    if (!question || question.length > MAX_QUESTION_CHARS) {
      return json(400, { error: "invalid_question" }, origin);
    }
    let lang = data.lang;
    if (lang == null || lang === "") lang = "zh";
    if (lang !== "zh" && lang !== "ko") {
      return json(400, { error: "invalid_lang" }, origin);
    }

    const apiKey = env.ZHIPU_API_KEY;
    if (typeof apiKey !== "string" || !apiKey.trim()) {
      return json(503, { error: "not_configured" }, origin);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let upstream;
    try {
      upstream = await fetchImpl(UPSTREAM_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: systemPrompt(lang) },
            { role: "user", content: question },
          ],
          temperature: 0.3,
          max_tokens: MAX_OUTPUT_TOKENS,
          stream: false,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err && err.name === "AbortError") {
        return json(504, { error: "upstream_timeout" }, origin);
      }
      return json(502, { error: "upstream_failed" }, origin);
    } finally {
      clearTimeout(timer);
    }

    if (!upstream || !upstream.ok) {
      return json(502, { error: "upstream_failed" }, origin);
    }
    let payload;
    try {
      payload = await upstream.json();
    } catch {
      return json(502, { error: "upstream_failed" }, origin);
    }
    let answer = answerText(payload);
    if (!answer || answer.includes(apiKey.trim())) {
      return json(502, { error: "empty_answer" }, origin);
    }
    if (answer.length > MAX_ANSWER_CHARS) answer = answer.slice(0, MAX_ANSWER_CHARS).trim();
    if (!answer) return json(502, { error: "empty_answer" }, origin);
    return json(200, { answer }, origin);
  };
}
