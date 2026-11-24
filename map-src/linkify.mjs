/** ASCII-only URL capture. CJK and full-width punctuation never enter the href. */

const HTTP_RE = /https?:\/\/[A-Za-z0-9][A-Za-z0-9\-._~:/?#\[\]@!$&'*+,;=%]*/g;
const TRAIL_RE = /[),.;:!?]+$/;

export function extractHttpUrl(value) {
  const match = String(value || "").match(HTTP_RE);
  if (!match) return "";
  return match[0].replace(TRAIL_RE, "");
}

export function extractHttpUrls(value) {
  const out = [];
  const text = String(value || "");
  for (const match of text.matchAll(HTTP_RE)) {
    const clean = match[0].replace(TRAIL_RE, "");
    if (clean) out.push(clean);
  }
  return out;
}
