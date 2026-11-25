/** On-device profiles. No network, no password, no gender for guests. */

export const PROFILES_KEY = "faq_local_profiles";
export const STATE_PREFIX = "faq_local_state_";
export const GUEST_FAV_KEY = "campus_map_favorites";
export const THEME_KEY = "faq_theme";
export const LANG_KEY = "faq_ui_lang";

export function stateKey(id) {
  return STATE_PREFIX + id;
}

export function hasLongDigitRun(value) {
  return /\d{10,}/.test(String(value || "")) || /^\d{8,}$/.test(String(value || "").trim());
}

export function nicknameError(name, profiles) {
  const text = String(name || "").trim();
  if (text.length < 1 || text.length > 20) return "length";
  if (hasLongDigitRun(text)) return "digits";
  if ((profiles || []).some((item) => item.nickname === text)) return "duplicate";
  return "";
}

export function emptyState() {
  return { searchHistory: [], frequent: [], mapFavorites: [] };
}

export function emptyBook() {
  return { v: 1, activeId: null, profiles: [] };
}

function validProfile(item) {
  return !!(item
    && typeof item.id === "string"
    && item.id.startsWith("p_")
    && typeof item.nickname === "string"
    && (item.gender === "male" || item.gender === "female")
    && typeof item.createdAt === "string");
}

function readJson(storage, key) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function writeJson(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* private mode */
  }
}

export function loadBook(storage) {
  const data = readJson(storage, PROFILES_KEY);
  if (!data || data.v !== 1 || !Array.isArray(data.profiles)) return emptyBook();
  const profiles = data.profiles.filter(validProfile);
  const activeId = profiles.some((item) => item.id === data.activeId) ? data.activeId : null;
  return { v: 1, activeId, profiles };
}

export function saveBook(storage, book) {
  writeJson(storage, PROFILES_KEY, {
    v: 1,
    activeId: book.activeId || null,
    profiles: book.profiles || [],
  });
}

export function loadState(storage, id) {
  const data = readJson(storage, stateKey(id));
  const base = emptyState();
  if (!data) return base;
  if (Array.isArray(data.searchHistory)) {
    base.searchHistory = data.searchHistory.filter((item) => item && typeof item.q === "string").slice(0, 50);
  }
  if (Array.isArray(data.frequent)) {
    base.frequent = data.frequent.filter((item) => item && typeof item.id === "string").slice(0, 20);
  }
  if (Array.isArray(data.mapFavorites)) {
    base.mapFavorites = data.mapFavorites.filter((item) => typeof item === "string");
  }
  return base;
}

export function saveState(storage, id, state) {
  writeJson(storage, stateKey(id), {
    searchHistory: (state.searchHistory || []).slice(0, 50),
    frequent: (state.frequent || []).slice(0, 20),
    mapFavorites: state.mapFavorites || [],
  });
}

function newId() {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") return "p_" + cryptoObj.randomUUID();
  return "p_" + Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
}

export function createProfile(storage, input) {
  const book = loadBook(storage);
  const nickname = String(input.nickname || "");
  const error = nicknameError(nickname, book.profiles);
  if (error) return { ok: false, error };
  if (input.gender !== "male" && input.gender !== "female") return { ok: false, error: "gender" };
  const now = input.now || new Date().toISOString();
  const profile = {
    id: input.id || newId(),
    nickname: nickname.trim(),
    gender: input.gender,
    createdAt: now,
    updatedAt: now,
  };
  book.profiles.push(profile);
  book.activeId = profile.id;
  saveBook(storage, book);
  saveState(storage, profile.id, emptyState());
  return { ok: true, profile };
}

export function selectProfile(storage, id) {
  const book = loadBook(storage);
  if (!book.profiles.some((item) => item.id === id)) return { ok: false, error: "missing" };
  book.activeId = id;
  saveBook(storage, book);
  return { ok: true, profile: book.profiles.find((item) => item.id === id) };
}

export function exitProfile(storage) {
  const book = loadBook(storage);
  book.activeId = null;
  saveBook(storage, book);
  return { ok: true };
}

export function deleteProfile(storage, id) {
  const book = loadBook(storage);
  const target = id || book.activeId;
  book.profiles = book.profiles.filter((item) => item.id !== target);
  if (book.activeId === target) book.activeId = null;
  saveBook(storage, book);
  try { storage.removeItem(stateKey(target)); } catch (e) { /* already gone */ }
  return { ok: true };
}

export function clearAccounts(storage) {
  const book = loadBook(storage);
  for (const profile of book.profiles) {
    try { storage.removeItem(stateKey(profile.id)); } catch (e) { /* already gone */ }
  }
  try { storage.removeItem(PROFILES_KEY); } catch (e) { /* already gone */ }
  try { storage.removeItem(GUEST_FAV_KEY); } catch (e) { /* already gone */ }
  return { ok: true };
}

export function clearSiteData(storage) {
  clearAccounts(storage);
  try { storage.removeItem(THEME_KEY); } catch (e) { /* already gone */ }
  try { storage.removeItem(LANG_KEY); } catch (e) { /* already gone */ }
  return { ok: true };
}

export function activeProfile(storage) {
  const book = loadBook(storage);
  if (!book.activeId) return null;
  return book.profiles.find((item) => item.id === book.activeId) || null;
}

export function setGender(storage, gender, now) {
  if (gender !== "male" && gender !== "female") return { ok: false, error: "gender" };
  const book = loadBook(storage);
  const profile = book.profiles.find((item) => item.id === book.activeId);
  if (!profile) return { ok: false, error: "guest" };
  profile.gender = gender;
  profile.updatedAt = now || new Date().toISOString();
  saveBook(storage, book);
  return { ok: true, profile };
}

export function avatarKind(storage) {
  const profile = activeProfile(storage);
  if (!profile) return "guest";
  return profile.gender === "female" ? "female" : "male";
}

export function noteSearch(storage, text, now) {
  const profile = activeProfile(storage);
  if (!profile) return { ok: true, skipped: "guest" };
  if (hasLongDigitRun(text)) return { ok: false, error: "digits" };
  const state = loadState(storage, profile.id);
  const q = String(text || "").trim().slice(0, 80);
  if (!q) return { ok: false, error: "empty" };
  state.searchHistory = [{ q, at: now || new Date().toISOString() }, ...state.searchHistory.filter((item) => item.q !== q)].slice(0, 50);
  saveState(storage, profile.id, state);
  return { ok: true };
}

export function noteFrequent(storage, id) {
  const profile = activeProfile(storage);
  if (!profile || !id) return { ok: true, skipped: "guest" };
  const state = loadState(storage, profile.id);
  const key = String(id);
  const found = state.frequent.find((item) => item.id === key);
  if (found) found.n += 1;
  else state.frequent.push({ id: key, n: 1 });
  state.frequent.sort((a, b) => b.n - a.n);
  state.frequent = state.frequent.slice(0, 20);
  saveState(storage, profile.id, state);
  return { ok: true };
}

export function readMapFavorites(storage) {
  const profile = activeProfile(storage);
  if (profile) return new Set(loadState(storage, profile.id).mapFavorites);
  try {
    const raw = JSON.parse(storage.getItem(GUEST_FAV_KEY) || "[]");
    if (!Array.isArray(raw)) return new Set();
    return new Set(raw.filter((item) => typeof item === "string"));
  } catch (e) {
    return new Set();
  }
}

export function writeMapFavorites(storage, favs) {
  const ids = [...favs].filter((item) => typeof item === "string");
  const profile = activeProfile(storage);
  if (profile) {
    const state = loadState(storage, profile.id);
    state.mapFavorites = ids;
    saveState(storage, profile.id, state);
    return;
  }
  try { storage.setItem(GUEST_FAV_KEY, JSON.stringify(ids)); } catch (e) { /* private mode */ }
}
