import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  clearAccounts,
  clearSiteData,
  createProfile,
  deleteProfile,
  exitProfile,
  loadState,
  readMapFavorites,
  selectProfile,
  toggleFavorite,
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
  };
}

function loadedMap(store) {
  return {
    favorites: readMapFavorites(store),
    favOwner: "p_old",
  };
}

function guestList(store) {
  const raw = store.getItem("campus_map_favorites");
  return raw ? JSON.parse(raw) : null;
}

test("homepage full clear then an old map star click must not move profile favorites to the guest", () => {
  const store = memory();
  createProfile(store, { nickname: "tester-a", gender: "female", id: "p_old", now: "2026-11-25T00:00:00.000Z" });
  writeMapFavorites(store, new Set(["old-private-favorite"]));
  store.setItem("korean-site-progress", "keep");
  store.setItem("gomoku-save", "keep");
  store.setItem("qa_unrelated_key_do_not_delete", "keep-me");
  const session = loadedMap(store);
  assert.equal(session.favorites.has("old-private-favorite"), true);
  clearSiteData(store);
  toggleFavorite(session, store, "new-public-favorite");
  assert.equal(store.getItem("faq_local_state_p_old"), null);
  assert.equal(store.getItem("faq_local_profiles"), null);
  assert.deepEqual(guestList(store), ["new-public-favorite"]);
  assert.equal(session.favorites.has("old-private-favorite"), false);
  const reloaded = readMapFavorites(store);
  assert.equal(reloaded.has("old-private-favorite"), false);
  assert.equal(reloaded.has("new-public-favorite"), true);
  assert.equal(store.getItem("korean-site-progress"), "keep");
  assert.equal(store.getItem("gomoku-save"), "keep");
  assert.equal(store.getItem("qa_unrelated_key_do_not_delete"), "keep-me");
});

test("homepage account clear has the same stale-set boundary", () => {
  const store = memory();
  createProfile(store, { nickname: "tester-a", gender: "female", id: "p_old", now: "2026-11-25T00:00:00.000Z" });
  writeMapFavorites(store, new Set(["old-private-favorite"]));
  store.setItem("faq_theme", "dark");
  store.setItem("faq_ui_lang", "ko");
  store.setItem("campus_map_tint", "1");
  store.setItem("gomoku-save", "keep");
  const session = loadedMap(store);
  clearAccounts(store);
  toggleFavorite(session, store, "new-public-favorite");
  assert.equal(store.getItem("faq_local_state_p_old"), null);
  assert.deepEqual(guestList(store), ["new-public-favorite"]);
  assert.equal(store.getItem("faq_theme"), "dark");
  assert.equal(store.getItem("faq_ui_lang"), "ko");
  assert.equal(store.getItem("campus_map_tint"), "1");
  assert.equal(store.getItem("gomoku-save"), "keep");
});

test("map wipe, account clear, exit, delete, and switch do not migrate favorites", () => {
  const store = memory();
  createProfile(store, { nickname: "tester-a", gender: "female", id: "p_old", now: "2026-11-25T00:00:00.000Z" });
  writeMapFavorites(store, new Set(["old-private-favorite"]));
  store.setItem("campus_map_favorites", "[\"guest-kept\"]");
  const exited = loadedMap(store);
  exitProfile(store);
  toggleFavorite(exited, store, "new-public-favorite");
  assert.deepEqual(loadState(store, "p_old").mapFavorites, ["old-private-favorite"]);
  assert.deepEqual(guestList(store).slice().sort(), ["guest-kept", "new-public-favorite"]);

  const removed = { favorites: new Set(["old-private-favorite"]), favOwner: "p_old" };
  deleteProfile(store, "p_old");
  toggleFavorite(removed, store, "after-delete");
  assert.equal(store.getItem("faq_local_state_p_old"), null);
  assert.equal(guestList(store).includes("old-private-favorite"), false);
  assert.equal(guestList(store).includes("after-delete"), true);

  createProfile(store, { nickname: "tester-a", gender: "female", id: "p_old", now: "2026-11-25T00:00:00.000Z" });
  writeMapFavorites(store, new Set(["old-private-favorite"]));
  createProfile(store, { nickname: "tester-b", gender: "male", id: "p_b", now: "2026-11-25T00:00:00.000Z" });
  writeMapFavorites(store, new Set(["bee-only"]));
  selectProfile(store, "p_old");
  writeMapFavorites(store, new Set(["old-private-favorite"]));
  const switched = loadedMap(store);
  selectProfile(store, "p_b");
  toggleFavorite(switched, store, "bee-new");
  assert.deepEqual(loadState(store, "p_old").mapFavorites, ["old-private-favorite"]);
  assert.deepEqual(loadState(store, "p_b").mapFavorites.slice().sort(), ["bee-new", "bee-only"]);
  assert.equal(guestList(store).includes("old-private-favorite"), false);
});

test("a real guest click and a real profile click still save only their own new id", () => {
  const store = memory();
  const guest = { favorites: new Set(), favOwner: null };
  toggleFavorite(guest, store, "new-public-favorite");
  assert.deepEqual(guestList(store), ["new-public-favorite"]);
  assert.equal(store.getItem("faq_local_profiles"), null);

  createProfile(store, { nickname: "tester-a", gender: "female", id: "p_old", now: "2026-11-25T00:00:00.000Z" });
  const session = { favorites: readMapFavorites(store), favOwner: "p_old" };
  toggleFavorite(session, store, "profile-new");
  assert.deepEqual(loadState(store, "p_old").mapFavorites, ["profile-new"]);
  assert.deepEqual(guestList(store), ["new-public-favorite"]);
});

test("the homepage clear confirm tells an open map to drop profile memory", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const yes = html.slice(html.indexOf("function syncOpenMap"), html.indexOf("attachMagnet($(\"btn-clear\")"));
  assert.match(yes, /clearLocalAccounts\(\)/);
  assert.match(yes, /clearAllSiteData\(\)/);
  assert.match(yes, /syncLocalProfile/);
  assert.match(yes, /syncOpenMap\(\)/);
  const map = fs.readFileSync(new URL("../map-src/campus-map.js", import.meta.url), "utf8");
  const click = map.slice(map.indexOf("function favButton"), map.indexOf("function openFaq"));
  assert.match(click, /toggleFavorite/);
  assert.match(map, /export function syncLocalProfile/);
});
