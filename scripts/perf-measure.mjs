/**
 * Campus map frame/load benchmark.
 *
 * Usage:
 *   node scripts/perf-measure.mjs --url http://127.0.0.1:4198/ --label baseline \
 *     --out /tmp/perf/baseline.json [--seconds 5]
 *
 * Runs desktop (1280x800, dpr 1) and phone (390x844, dpr 3) Chromium contexts,
 * instruments requestAnimationFrame + WebGL draw calls before the page loads,
 * then samples overview orbit dragging and walk mode with W held.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, token, i, all) => {
    if (token.startsWith("--")) acc.push([token.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : "true"]);
    return acc;
  }, []),
);
const URL = args.url || "http://127.0.0.1:4198/";
const LABEL = args.label || "run";
const OUT = args.out || `/tmp/perf-${LABEL}.json`;
const SECONDS = Number(args.seconds || 5);
const MODES = (args.modes || "load,overview,walk").split(",");

const INIT = () => {
  const perf = (window.__perf = {
    frames: [],
    samples: [],
    errors: [],
    gl: null,
  });
  const glState = { fbo: null };
  const wrapProto = (proto) => {
    for (const name of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"]) {
      if (!proto || !proto[name]) continue;
      const orig = proto[name];
      proto[name] = function (...a) {
        const mode = a[0];
        const count = name.includes("Instanced") ? a[1] : a[2];
        const instances = name.includes("Instanced") ? a[3] : 1;
        const s = window.__perf.gl;
        if (s) {
          const main = glState.fbo == null;
          if (main) {
            s.mainDraws++;
            if (mode === 4) s.mainTris += (count / 3) * instances;
            else if (mode === 1) s.mainLines += count / 2;
          } else {
            s.shadowDraws++;
          }
          s.totalDraws++;
        }
        return orig.apply(this, a);
      };
    }
    const bind = proto && proto.bindFramebuffer;
    if (bind) {
      proto.bindFramebuffer = function (target, fb) {
        if (target === this.FRAMEBUFFER) glState.fbo = fb;
        return bind.apply(this, arguments);
      };
    }
  };
  wrapProto(window.WebGL2RenderingContext && window.WebGL2RenderingContext.prototype);
  wrapProto(window.WebGLRenderingContext && window.WebGLRenderingContext.prototype);

  const origRaf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) {
    return origRaf(function (ts) {
      const s = window.__perf.gl;
      const t0 = performance.now();
      const d0 = s ? s.totalDraws : 0;
      const md0 = s ? s.mainDraws : 0;
      const td0 = s ? s.mainTris : 0;
      try {
        cb(ts);
      } finally {
        const dur = performance.now() - t0;
        if (s && s.totalDraws > d0) {
          window.__perf.frames.push({
            t: t0,
            dur,
            draws: s.totalDraws - d0,
            mainDraws: s.mainDraws - md0,
            tris: s.mainTris - td0,
          });
        }
      }
    });
  };
};

const GL_STATS = () => {
  const canvas = document.querySelector(".map-canvas");
  if (!canvas) return null;
  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
  if (!gl) return null;
  const dbg = gl.getExtension("WEBGL_debug_renderer_info");
  window.__perf.gl = {
    mainDraws: 0,
    shadowDraws: 0,
    totalDraws: 0,
    mainTris: 0,
    mainLines: 0,
  };
  return {
    vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    version: gl.getParameter(gl.VERSION),
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    canvas: { width: canvas.width, height: canvas.height, cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight },
    dpr: window.devicePixelRatio,
  };
};

function stats(values) {
  if (!values.length) return { n: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    n: sorted.length,
    mean: +(sum / sorted.length).toFixed(2),
    median: +q(0.5).toFixed(2),
    p95: +q(0.95).toFixed(2),
    min: +sorted[0].toFixed(2),
    max: +sorted[sorted.length - 1].toFixed(2),
  };
}

function summarize(frames) {
  const intervals = [];
  for (let i = 1; i < frames.length; i++) intervals.push(frames[i].t - frames[i - 1].t);
  const dur = frames.length ? frames[frames.length - 1].t - frames[0].t : 0;
  return {
    frames: frames.length,
    windowMs: +dur.toFixed(0),
    fps: dur > 0 ? +((frames.length - 1) / (dur / 1000)).toFixed(1) : 0,
    intervalMs: stats(intervals),
    callbackMs: stats(frames.map((f) => f.dur)),
    drawsPerFrame: stats(frames.map((f) => f.mainDraws)),
    totalDrawsPerFrame: stats(frames.map((f) => f.draws)),
    trisPerFrame: stats(frames.map((f) => f.tris)),
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openMap(page) {
  await page.waitForFunction(() => {
    const b = document.querySelector("#btn-map");
    return b && b.offsetParent !== null;
  }, null, { timeout: 30000 });
  const t0 = Date.now();
  await page.locator("#btn-map").click();
  await page.waitForSelector(".map-modal", { state: "visible", timeout: 30000 });
  await page.waitForSelector(".map-status", { state: "hidden", timeout: 60000 });
  await page.waitForFunction(() => window.CampusMap && window.CampusMap.debugSnapshot && window.CampusMap.debugSnapshot() !== null, null, { timeout: 30000 });
  return Date.now() - t0;
}

async function measureOverview(page) {
  await page.evaluate(() => {
    window.__perf.frames = [];
    window.__perf.samples = [];
    window.__perf.gl && (window.__perf.gl.mainDraws = 0);
  });
  const box = await page.locator(".map-canvas").boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const start = Date.now();
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  let i = 0;
  while (Date.now() - start < SECONDS * 1000) {
    const a = (i / 40) * Math.PI * 2;
    await page.mouse.move(cx + Math.cos(a) * box.width * 0.18, cy + Math.sin(a) * box.height * 0.1);
    i++;
    await sleep(8);
  }
  await page.mouse.up();
  await sleep(300);
  return page.evaluate(() => window.__perf.frames);
}

async function measureWalk(page) {
  await page.locator(".map-toolbar [data-map-action='walk']").click();
  await page.waitForFunction(() => {
    const s = window.CampusMap.debugSnapshot();
    return s && s.viewMode === "walk";
  }, null, { timeout: 15000 });
  await sleep(500);
  await page.evaluate(() => {
    window.__perf.frames = [];
    window.__perf.gl && (window.__perf.gl.mainDraws = 0);
  });
  await page.keyboard.down("w");
  await sleep(SECONDS * 1000);
  await page.keyboard.up("w");
  await sleep(200);
  const frames = await page.evaluate(() => window.__perf.frames);
  const walk = await page.evaluate(() => {
    const s = window.CampusMap.debugSnapshot();
    return { viewMode: s.viewMode, trees: s.trees, buildings: s.buildings.length, grounded: s.grounded, playerY: s.playerY };
  });
  await page.locator(".map-toolbar [data-map-action='walk']").click();
  return { frames, walk };
}

async function loadMetrics(page, mapReadyMs) {
  return page.evaluate((readyMs) => {
    const nav = performance.getEntriesByType("navigation")[0] || {};
    const resources = performance.getEntriesByType("resource").map((r) => ({
      name: r.name.replace(location.origin + "/", ""),
      transferSize: r.transferSize,
      encodedBodySize: r.encodedBodySize,
      decodedBodySize: r.decodedBodySize,
      duration: +r.duration.toFixed(1),
      startTime: +r.startTime.toFixed(1),
    }));
    return {
      mapReadyMs: readyMs,
      navigation: {
        domContentLoaded: +(nav.domContentLoadedEventEnd || 0).toFixed(1),
        load: +(nav.loadEventEnd || 0).toFixed(1),
        transferSize: nav.transferSize,
        encodedBodySize: nav.encodedBodySize,
        decodedBodySize: nav.decodedBodySize,
      },
      resources,
    };
  }, mapReadyMs);
}

async function runMode(browser, name, contextOpts) {
  const context = await browser.newContext(contextOpts);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|Failed to load resource|404/.test(m.text())) consoleErrors.push(m.text());
  });
  await page.addInitScript(INIT);
  const navStart = Date.now();
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  const mapReadyMs = await openMap(page);
  const gl = await page.evaluate(GL_STATS);
  const initial = await page.evaluate(() => {
    const s = window.CampusMap.debugSnapshot();
    return { trees: s.trees, buildings: s.buildings.length, logDepth: s.logDepth, theme: s.theme };
  });
  const load = await loadMetrics(page, mapReadyMs);
  const result = { mode: name, viewport: contextOpts.viewport, dpr: contextOpts.deviceScaleFactor, gl, initial, load, wallOpenMs: Date.now() - navStart };
  if (MODES.includes("overview")) result.overview = summarize(await measureOverview(page));
  if (MODES.includes("walk")) {
    const walk = await measureWalk(page);
    result.walk = summarize(walk.frames);
    result.walkState = walk.walk;
  }
  result.consoleErrors = consoleErrors;
  await page.screenshot({ path: `/tmp/perf-${LABEL}-${name}.png` });
  await context.close();
  return result;
}

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const results = { label: LABEL, url: URL, seconds: SECONDS, startedAt: new Date().toISOString(), runs: [] };
try {
  for (const [name, opts] of [
    ["desktop", { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }],
    ["phone", { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }],
  ]) {
    results.runs.push(await runMode(browser, name, opts));
  }
} finally {
  await browser.close();
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
