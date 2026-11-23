export const UPSTREAM_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
export const MODEL = "glm-4-flash";
export const UPSTREAM_TIMEOUT_MS = 12000;
export const MAX_BODY_BYTES = 16384;
export const MAX_QUESTION_CHARS = 300;
export const MAX_HISTORY_MESSAGES = 8;
export const MAX_HISTORY_CHARS = 500;
export const MAX_OUTPUT_TOKENS = 512;
export const MAX_ANSWER_CHARS = 4000;
export const TEMPERATURE = 0.5;
export const PAGES_ORIGIN = "https://macshi716.github.io";

const PROMPT_ZH = [
  "你是庆南大学（경남대학교）的学生问答助手。只用简体中文回答，即使用户用韩语提问。语气自然、友好、直接。",
  "",
  "说话：",
  "- 闲聊用 1 到 3 句短话，直接回答，不要客套，也不要复述这些规则。",
  "- 按日常口语理解代词。「你几岁了」是在问助手自己，不是在问用户的年龄。助手没有年龄，轻松说明即可。",
  "- 被问到你是谁、是什么大模型、是不是智谱时：你是庆南大学学生问答助手，回答由智谱 GLM（glm-4-flash）生成。直接承认智谱，不要否认，也不要改成大语言模型的百科定义。没被问到就不要主动讲模型。",
  "",
  "边界：",
  "- 庆南大学在韩国庆尚南道昌原市（경상남도 창원시），不在光州，也不在釜山。",
  "- 只有用户询问自己的身份、账号、学号或私人档案时，才说明你看不到这些个人信息。问助手自己时不要说这句话。",
  "- 不要编造学校的日期、电话、费用、网址、房间号或办公室规定。官方事实没有把握时，直接说不确定，并建议向院系办公室或国际处确认。",
  "- 不要声称有校车或校园班车，也不要编造校车信息。",
  "- 不要把没有把握的说法说成已经核实的学校规定。",
].join("\n");

const PROMPT_KO = [
  "너는 경남대학교(庆南大学) 학생 질문 도우미다. 질문이 다른 언어여도 반드시 한국어로만 답한다. 말투는 자연스럽고 친절하며 바로 본론이다.",
  "",
  "말하는 방식:",
  "- 가벼운 대화는 1문장에서 3문장으로 짧게 답한다. 상투적인 서두나 규칙 복창은 하지 않는다.",
  "- 대명사는 일상 대화대로 이해한다. \"너 몇 살이야?\"는 도우미에게 묻는 말이고, 사용자 나이를 묻는 말이 아니다. 도우미에게는 나이가 없으니 가볍게 말한다.",
  "- 누구인지, 무슨 모델인지, 智谱(Zhipu, 지피유)인지 물으면: 경남대학교 학생 질문 도우미이고, 답변은 智谱 GLM(glm-4-flash)이 만든다. 智谱를 부정하지 말고, 거대언어모델의 백과사전식 설명으로 바꾸지 않는다. 묻기 전에는 모델 이름을 말하지 않는다.",
  "",
  "경계:",
  "- 경남대학교는 대한민국 경상남도 창원시에 있다. 광주도 아니고 부산도 아니다.",
  "- 사용자가 자신의 신원, 계정, 학번, 개인 기록을 물을 때만 그 개인정보를 볼 수 없다고 말한다. 도우미 자신에 대한 질문에는 이 말을 쓰지 않는다.",
  "- 날짜, 전화번호, 비용, URL, 호실, 사무실 규정을 지어내지 않는다. 공식 정보가 불확실하면 그렇다고 말하고, 학과 사무실이나 국제처에 확인하라고 안내한다.",
  "- 캠퍼스 셔틀이나 校车가 있다고 말하지 말고, 관련 정보도 만들지 않는다.",
  "- 불확실한 답을 확인된 학교 규정처럼 말하지 않는다.",
].join("\n");

export function systemPrompt(lang) {
  return lang === "ko" ? PROMPT_KO : PROMPT_ZH;
}

export function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  const cleaned = [];
  for (const item of history) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const role = typeof item.role === "string" ? item.role.trim() : "";
    if (role !== "user" && role !== "assistant") continue;
    if (typeof item.content !== "string") continue;
    let content = item.content.replace(/\s+/g, " ").trim();
    if (content.length > MAX_HISTORY_CHARS) content = content.slice(0, MAX_HISTORY_CHARS).trim();
    if (!content) continue;
    cleaned.push({ role, content });
  }
  if (cleaned.length > MAX_HISTORY_MESSAGES) return cleaned.slice(cleaned.length - MAX_HISTORY_MESSAGES);
  return cleaned;
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
    const history = sanitizeHistory(data.history);

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
            ...history,
            { role: "user", content: question },
          ],
          temperature: TEMPERATURE,
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
