import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { applyAvatarLook, buildAvatar } from "../map-src/avatar.mjs";
import {
  accountActionVisibility,
  activeProfile,
  avatarKind,
  clearAccounts,
  clearMapFavorites,
  clearSiteData,
  createProfile,
  deleteProfile,
  exitProfile,
  hasLongDigitRun,
  loadBook,
  loadState,
  noteFrequent,
  noteSearch,
  readMapFavorites,
  selectProfile,
  setGender,
  writeMapFavorites,
} from "../map-src/local-profile.mjs";

function memory() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
    get length() { return data.size; },
    key(index) { return [...data.keys()][index] || null; },
    keys() { return [...data.keys()]; },
  };
}

test("guest stays anonymous and a profile stores only nickname and gender", () => {
  const store = memory();
  assert.equal(avatarKind(store), "guest");
  assert.equal(activeProfile(store), null);
  const made = createProfile(store, { nickname: "tester-a", gender: "female", now: "2026-11-25T00:00:00.000Z", id: "p_test" });
  assert.equal(made.ok, true);
  assert.equal(made.profile.gender, "female");
  assert.equal(Object.hasOwn(made.profile, "password"), false);
  assert.equal(avatarKind(store), "female");
  const book = loadBook(store);
  assert.equal(book.activeId, "p_test");
  assert.equal(book.profiles[0].nickname, "tester-a");
  assert.equal(hasLongDigitRun("01012345678"), true);
  assert.equal(createProfile(store, { nickname: "01012345678", gender: "male" }).error, "digits");
  assert.equal(createProfile(store, { nickname: "tester-a", gender: "male" }).error, "duplicate");
  assert.equal(noteSearch(store, "01099998888").error, "digits");
  assert.equal(noteSearch(store, "图书馆").ok, true);
  assert.equal(loadState(store, "p_test").searchHistory[0].q, "图书馆");
  assert.equal(noteFrequent(store, "F49").ok, true);
  writeMapFavorites(store, new Set(["faq:F49"]));
  assert.deepEqual([...readMapFavorites(store)], ["faq:F49"]);
  store.setItem("campus_map_favorites", JSON.stringify(["faq:guest"]));
  assert.deepEqual([...readMapFavorites(store)], ["faq:F49"]);
  exitProfile(store);
  assert.equal(avatarKind(store), "guest");
  assert.equal(activeProfile(store), null);
  assert.deepEqual([...readMapFavorites(store)], ["faq:guest"]);
  selectProfile(store, "p_test");
  setGender(store, "male", "2026-11-25T01:00:00.000Z");
  assert.equal(avatarKind(store), "male");
  deleteProfile(store, "p_test");
  assert.equal(loadBook(store).profiles.length, 0);
  assert.equal(store.getItem("faq_local_state_p_test"), null);
});

test("clearing favorites empties the store for the current mode", () => {
  const store = memory();
  createProfile(store, { nickname: "tester-a", gender: "female", now: "2026-11-25T00:00:00.000Z", id: "p_test" });
  writeMapFavorites(store, new Set(["faq:F49"]));
  store.setItem("campus_map_favorites", JSON.stringify(["faq:guest"]));
  clearMapFavorites(store);
  assert.deepEqual(loadState(store, "p_test").mapFavorites, []);
  assert.deepEqual([...readMapFavorites(store)], []);
  assert.equal(store.getItem("campus_map_favorites"), JSON.stringify(["faq:guest"]));
  exitProfile(store);
  writeMapFavorites(store, new Set(["faq:F1"]));
  clearMapFavorites(store);
  assert.equal(store.getItem("campus_map_favorites"), "[]");
  assert.deepEqual([...readMapFavorites(store)], []);
});

test("a guest can still wipe every local key, including leftovers and tint", () => {
  const store = memory();
  assert.deepEqual(accountActionVisibility(false), {
    exit: false,
    deleteProfile: false,
    clearAccounts: true,
    clearSite: true,
  });
  assert.equal(accountActionVisibility(true).exit, true);
  assert.equal(accountActionVisibility(true).deleteProfile, true);
  createProfile(store, { nickname: "tester-b", gender: "male", id: "p_b", now: "2026-11-25T00:00:00.000Z" });
  store.setItem("faq_local_state_orphan", "{\"searchHistory\":[{\"q\":\"left\"}]}");
  store.setItem("campus_map_tint", "1");
  store.setItem("faq_theme", "dark");
  store.setItem("faq_ui_lang", "ko");
  clearAccounts(store);
  assert.equal(store.getItem("faq_local_profiles"), null);
  assert.equal(store.getItem("faq_local_state_p_b"), null);
  assert.equal(store.getItem("faq_local_state_orphan"), null);
  assert.equal(store.getItem("campus_map_tint"), "1");
  assert.equal(store.getItem("faq_theme"), "dark");
  store.setItem("faq_local_state_orphan", "{\"mapFavorites\":[\"faq:F9\"]}");
  store.setItem("faq_local_profiles", "{\"v\":1,\"activeId\":null,\"profiles\":[]}");
  clearSiteData(store);
  assert.equal(store.getItem("campus_map_tint"), null);
  assert.equal(store.getItem("faq_local_state_orphan"), null);
  assert.equal(store.getItem("faq_theme"), null);
  assert.equal(store.getItem("faq_ui_lang"), null);
  assert.equal(store.keys().length, 0);
});

test("clearing accounts keeps theme and clearing the site removes it", () => {
  const store = memory();
  createProfile(store, { nickname: "tester-b", gender: "male", id: "p_b", now: "2026-11-25T00:00:00.000Z" });
  store.setItem("faq_theme", "dark");
  store.setItem("faq_ui_lang", "ko");
  store.setItem("campus_map_favorites", "[\"faq:F1\"]");
  clearAccounts(store);
  assert.equal(store.getItem("faq_local_profiles"), null);
  assert.equal(store.getItem("campus_map_favorites"), null);
  assert.equal(store.getItem("faq_theme"), "dark");
  assert.equal(store.getItem("faq_ui_lang"), "ko");
  store.setItem("faq_local_profiles", "{\"v\":1,\"activeId\":null,\"profiles\":[]}");
  clearSiteData(store);
  assert.equal(store.getItem("faq_theme"), null);
  assert.equal(store.getItem("faq_ui_lang"), null);
});

test("the ask request does not carry a local profile", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const start = html.lastIndexOf("fetch(AI_ENDPOINT");
  const body = html.slice(start, start + 420);
  assert.equal(body.includes("faq_local"), false);
  assert.equal(body.includes("nickname"), false);
  assert.equal(body.includes("gender"), false);
  const map = fs.readFileSync(new URL("../map-src/campus-map.js", import.meta.url), "utf8");
  assert.equal(map.includes("注册"), false);
  assert.equal(map.includes("로그인"), false);
  assert.match(map, /建立本机资料/);
  assert.match(map, /选用本机资料/);
  assert.match(html, /faq_local_state_/);
  const chatClear = html.slice(html.indexOf('$("btn-clear").addEventListener'), html.indexOf("attachMagnet"));
  assert.equal(chatClear.includes("faq_local"), false);
  assert.equal(chatClear.includes("clearAllSiteData"), false);
  assert.match(html, /id="local-data-accounts"/);
  assert.match(html, /id="local-data-site"/);
  assert.match(html, /清空本机账号与记录/);
  assert.match(html, /清空本站全部本机数据/);
  assert.equal(map.includes("exitBtn.parentElement.hidden"), false);
  assert.match(map, /clearMapFavorites\(browserStore\)/);
  assert.match(map, /accountActionVisibility\(/);
});

test("guest, male, and female avatars share a skeleton and differ by look", () => {
  const avatar = buildAvatar();
  assert.equal(avatar.kind, "guest");
  assert.equal(avatar.parts.bob.visible, false);
  assert.equal(avatar.parts.fringe.visible, false);
  assert.equal(avatar.parts.torso.material.color.getHexString(), "6e6e6e");
  applyAvatarLook(avatar, "male");
  assert.equal(avatar.parts.fringe.visible, true);
  assert.equal(avatar.parts.bob.visible, false);
  assert.equal(avatar.parts.torso.material.color.getHexString(), "2f4f6f");
  applyAvatarLook(avatar, "female");
  assert.equal(avatar.parts.bob.visible, true);
  assert.equal(avatar.parts.fringe.visible, false);
  assert.equal(avatar.parts.torso.material.color.getHexString(), "8a6a4a");
  assert.equal(avatar.parts.pack.material.color.getHexString(), "2c3a4a");
  assert.equal(avatar.parts.legL.material.color.getHexString(), "2a2a32");
  applyAvatarLook(avatar, "guest");
  assert.equal(avatar.kind, "guest");
  assert.equal(avatar.parts.bob.visible, false);
});
