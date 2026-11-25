/** Photoreal campus meshes. Browser only: canvas textures, no network, no external HDR. */

import * as THREE from "three";
import { buildingKind, terrainColor } from "./colors.mjs";
import {
  ARCHETYPE_COLOR,
  VISUAL_COLS,
  VISUAL_ROWS,
  archetypeFor,
  createSmoothSampler,
  placeTrees,
  slopeDegrees,
  visualGrid,
} from "./dressing.mjs";
import { HAZE_DENSITY, roadCrossSection } from "./ground.mjs";
import {
  SCHEMATIC_HEIGHT_M,
  measureFootprint,
  openRing,
  pointInRing,
  ringCentroid,
  signedArea,
  terrainCellIndices,
  triangulateXZ,
} from "./placement.mjs";

const LIFT = {
  curb: 0.12,
  road: 0.2,
  path: 0.18,
  pitch: 0.16,
  water: 0.05,
  rim: 0.22,
};

function hash01(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  let n = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function noise(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const s = (a, b, t) => a + (b - a) * (t * t * (3 - 2 * t));
  const h = (i, j) => hash01(i * 0.17, j * 0.13);
  const a = s(h(ix, iz), h(ix + 1, iz), fx);
  const b = s(h(ix, iz + 1), h(ix + 1, iz + 1), fx);
  return s(a, b, fz);
}

function canvasTexture(canvas, colorSpace, repeatX, repeatY) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = colorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

function fillImage(size, painter) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const image = ctx.createImageData(size, size);
  painter(image.data, size);
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function paintHillAlbedo(sample, bounds, theme) {
  const size = 1024;
  const { x0, x1, z0, z1 } = bounds;
  const dark = theme === "dark";
  return fillImage(size, (data) => {
    for (let py = 0; py < size; py++) {
      const v = 1 - (py + 0.5) / size;
      const z = z0 + v * (z1 - z0);
      for (let px = 0; px < size; px++) {
        const u = (px + 0.5) / size;
        const x = x0 + u * (x1 - x0);
        const slope = slopeDegrees(sample, x, z);
        const n = noise(x * 0.045, z * 0.045);
        const grain = noise(x * 0.22, z * 0.22);
        const rock = Math.min(1, Math.max(0, (slope - 16) / 22));
        let r;
        let g;
        let b;
        if (dark) {
          const lawn = [42 + n * 8, 62 + n * 8, 40 + grain * 5];
          const forest = [28 + n * 6, 46 + n * 6, 32];
          const stone = [48 + grain * 6, 50 + grain * 5, 46];
          const veg = n > 0.55 ? forest : lawn;
          r = mix(veg[0], stone[0], rock);
          g = mix(veg[1], stone[1], rock);
          b = mix(veg[2], stone[2], rock);
        } else {
          const lawn = [96 + n * 12, 142 + n * 10, 68 + grain * 6];
          const forest = [58 + n * 8, 108 + n * 8, 54 + grain * 4];
          const stone = [148 + grain * 8, 140 + grain * 6, 122];
          const soil = [142, 118, 82];
          const veg = n > 0.62 ? forest : n < 0.22 ? soil : lawn;
          r = mix(veg[0], stone[0], rock);
          g = mix(veg[1], stone[1], rock);
          b = mix(veg[2], stone[2], rock);
        }
        const o = (py * size + px) * 4;
        data[o] = r;
        data[o + 1] = g;
        data[o + 2] = b;
        data[o + 3] = 255;
      }
    }
  });
}

function paintHillAux(sample, bounds, mode) {
  const size = 512;
  const { x0, x1, z0, z1 } = bounds;
  return fillImage(size, (data) => {
    for (let py = 0; py < size; py++) {
      const v = 1 - (py + 0.5) / size;
      const z = z0 + v * (z1 - z0);
      for (let px = 0; px < size; px++) {
        const u = (px + 0.5) / size;
        const x = x0 + u * (x1 - x0);
        const slope = slopeDegrees(sample, x, z);
        const grain = noise(x * 0.35, z * 0.35);
        const value = mode === "rough"
          ? 168 + Math.min(60, slope * 1.4) + grain * 18
          : 118 + grain * 90 + Math.min(40, slope);
        const o = (py * size + px) * 4;
        data[o] = value;
        data[o + 1] = value;
        data[o + 2] = value;
        data[o + 3] = 255;
      }
    }
  });
}

function paintBay(kind) {
  const w = 128;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  const floors = 2;
  const fh = h / floors;
  for (let f = 0; f < floors; f++) {
    const y = f * fh;
    g.fillStyle = "#e8e8e8";
    g.fillRect(0, y, w, fh);
    g.strokeStyle = "#c4c4c4";
    g.lineWidth = 1;
    for (let row = 8; row < fh; row += 7) {
      g.beginPath();
      g.moveTo(0, y + row);
      g.lineTo(w, y + row);
      g.stroke();
    }
    g.fillStyle = "#f4f4f4";
    g.fillRect(0, y, w, 18);
    g.fillStyle = "#d0d0d0";
    g.fillRect(0, y + fh - 14, w, 14);
    g.fillStyle = "#141414";
    if (kind === "ribbon") {
      g.fillRect(6, y + 36, w - 12, fh - 64);
      g.fillStyle = "#9a9a9a";
      g.fillRect(6, y + 36, w - 12, 3);
    } else if (kind === "limestone") {
      g.fillStyle = "#f7f7f7";
      g.fillRect(0, y + 18, 10, fh - 32);
      g.fillRect(w - 10, y + 18, 10, fh - 32);
      g.fillStyle = "#242424";
      g.fillRect(22, y + 34, w - 44, fh - 62);
    } else if (kind === "context") {
      g.fillRect(34, y + 40, 60, fh - 78);
    } else {
      g.fillRect(16, y + 34, 40, fh - 64);
      g.fillRect(72, y + 34, 40, fh - 64);
      g.fillStyle = "#f2f2f2";
      g.fillRect(16, y + 30, 40, 4);
      g.fillRect(72, y + 30, 40, 4);
    }
  }
  return canvas;
}

function paintBayMask(kind, lit) {
  const w = 128;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  g.fillStyle = lit ? "#000" : "#d8d8d8";
  g.fillRect(0, 0, w, h);
  const floors = 2;
  const fh = h / floors;
  const pattern = lit ? [1, 0, 1, 0, 0, 1, 0, 1] : null;
  for (let f = 0; f < floors; f++) {
    const y = f * fh;
    const windows = kind === "ribbon"
      ? [[8, 36, w - 16, fh - 64]]
      : kind === "limestone"
        ? [[22, 34, w - 44, fh - 62]]
        : kind === "context"
          ? [[34, 40, 60, fh - 78]]
          : [[16, 34, 40, fh - 64], [72, 34, 40, fh - 64]];
    windows.forEach((rect, index) => {
      const on = !lit || pattern[(f * 2 + index) % pattern.length];
      if (lit && !on) return;
      g.fillStyle = lit ? (index % 2 ? "#ffe2b0" : "#fff1d2") : "#2a2a2a";
      if (kind === "ribbon" && lit) {
        g.fillRect(rect[0], y + rect[1], 36, rect[3]);
        g.fillRect(rect[0] + 70, y + rect[1], 28, rect[3]);
        return;
      }
      g.fillRect(rect[0], y + rect[1], rect[2], rect[3]);
    });
    if (!lit) {
      g.fillStyle = "#efefef";
      g.fillRect(0, y, w, 16);
      g.fillStyle = "#bdbdbd";
      g.fillRect(0, y + fh - 12, w, 12);
    }
  }
  return canvas;
}

function paintGravel() {
  return fillImage(128, (data, size) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = noise(x * 0.35, y * 0.35);
        const v = 150 + n * 70;
        const o = (y * size + x) * 4;
        data[o] = v;
        data[o + 1] = v - 4;
        data[o + 2] = v - 8;
        data[o + 3] = 255;
      }
    }
  });
}

function paintAsphalt() {
  return fillImage(128, (data, size) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = noise(x * 0.8, y * 0.8);
        const v = 70 + n * 28;
        const o = (y * size + x) * 4;
        data[o] = v;
        data[o + 1] = v + 1;
        data[o + 2] = v + 3;
        data[o + 3] = 255;
      }
    }
  });
}

function paintParking() {
  const canvas = paintAsphalt();
  const g = canvas.getContext("2d");
  g.strokeStyle = "rgba(220,220,210,0.35)";
  g.lineWidth = 2;
  for (let x = 16; x < 128; x += 32) {
    g.beginPath();
    g.moveTo(x, 8);
    g.lineTo(x, 120);
    g.stroke();
  }
  return canvas;
}

function trackOwned(shell, tex) {
  shell.ownedTextures.push(tex);
  return tex;
}

function stdMat(shell, params) {
  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.86,
    metalness: 0.02,
    envMapIntensity: 0.42,
    ...params,
    transparent: false,
    opacity: 1,
    depthWrite: true,
    depthTest: true,
    side: THREE.FrontSide,
  });
  shell.facadeMaterials.push(mat);
  return mat;
}

function surfaceMat(shell, color, roughness, metalness, extra) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    envMapIntensity: metalness > 0.15 ? 0.8 : 0.2,
    polygonOffset: false,
    ...extra,
  });
  shell.surfaceMaterials.push(mat);
  return mat;
}

function paintSky(sky, dark) {
  const top = new THREE.Color(dark ? 0x070b14 : 0x8eb4dc);
  const horizon = new THREE.Color(dark ? 0x1a2433 : 0xd5e2ee);
  const ground = new THREE.Color(dark ? 0x0c1014 : 0xc3b8a4);
  const pos = sky.geometry.attributes.position;
  const col = sky.geometry.attributes.color;
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 2200;
    if (y > 0.02) c.copy(horizon).lerp(top, Math.min(1, (y - 0.02) / 0.7));
    else c.copy(ground).lerp(horizon, Math.max(0, (y + 0.25) / 0.31));
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
}

export function installAtmosphere(shell) {
  const { renderer, scene } = shell;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const wide = (shell.stage.clientWidth || window.innerWidth || 1280) >= 800;
  const sun = shell.sun;
  sun.castShadow = true;
  sun.shadow.mapSize.set(wide ? 2048 : 1024, wide ? 2048 : 1024);
  sun.shadow.bias = -0.00018;
  sun.shadow.normalBias = 0.035;
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 1400;
  sun.shadow.camera.left = -620;
  sun.shadow.camera.right = 620;
  sun.shadow.camera.top = 620;
  sun.shadow.camera.bottom = -620;
  const skyGeo = new THREE.SphereGeometry(2200, 28, 16);
  skyGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(skyGeo.attributes.position.count * 3), 3));
  const sky = new THREE.Mesh(
    skyGeo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false }),
  );
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);
  shell.sky = sky;
  paintSky(sky, shell.theme === "dark");
  scene.fog = new THREE.FogExp2(0xc5d4e2, HAZE_DENSITY.light);
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.add(sky.clone());
    const target = pmrem.fromScene(envScene, 0.18);
    scene.environment = target.texture;
    shell.envMap = target.texture;
    shell.ownedTextures.push(target.texture);
    pmrem.dispose();
  } catch (e) {
    shell.envMap = null;
  }
  applyAtmosphereTheme(shell);
}

export function applyAtmosphereTheme(shell) {
  const dark = shell.theme === "dark";
  if (shell.sky) paintSky(shell.sky, dark);
  if (shell.scene && shell.scene.fog) {
    shell.scene.fog.color.set(dark ? 0x121820 : 0xc5d4e2);
    shell.scene.fog.density = dark ? HAZE_DENSITY.dark : HAZE_DENSITY.light;
  }
  if (shell.renderer) {
    shell.renderer.toneMappingExposure = dark ? 1.12 : 1.0;
    shell.renderer.setClearColor(dark ? 0x121820 : 0xd5e2ee, 1);
  }
  if (shell.terrainMesh && shell.terrainMaps) {
    shell.terrainMesh.material.map = dark ? shell.terrainMaps.dark : shell.terrainMaps.light;
    shell.terrainMesh.material.needsUpdate = true;
  }
  if (shell.boundary) {
    shell.boundary.material.color.set(dark ? 0xc8bba8 : 0x6a6156);
    shell.boundary.material.opacity = dark ? 0.45 : 0.55;
  }
  const road = shell.layerMeshes && shell.layerMeshes.road;
  if (road && road.material && road.material.emissive) {
    road.material.color.setHex(0x7a838c);
    road.material.emissive.setHex(0x3e464e);
    road.material.emissiveIntensity = dark ? 0.85 : 0.55;
  }
  const path = shell.layerMeshes && shell.layerMeshes.path;
  if (path && path.material && path.material.emissive) {
    path.material.emissive.setHex(dark ? 0x9a8468 : 0x000000);
    path.material.emissiveIntensity = dark ? 0.7 : 0;
  }
}

function pushTri(buf, ax, ay, az, bx, by, bz, cx, cy, cz, au, av, bu, bv, cu, cv) {
  buf.pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
  const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
  const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
  const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const len = Math.hypot(nx, ny, nz) || 1;
  const ox = nx / len;
  const oy = ny / len;
  const oz = nz / len;
  buf.nrm.push(ox, oy, oz, ox, oy, oz, ox, oy, oz);
  buf.uv.push(au, av, bu, bv, cu, cv);
}

function emptyBuf() {
  return { pos: [], nrm: [], uv: [] };
}

function orientCCW(open) {
  if (signedArea(open) < 0) return open.slice().reverse();
  return open.slice();
}

/**
 * Face the wall along (faceX, faceZ).
 * A single vertex-to-centroid "inward" vector points the wrong way on later
 * edges of the same ring, and FrontSide culling then drops those façades.
 */
function addWall(buf, a, b, y0, y1, faceX, faceZ) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  if (len < 1e-4 || !(y1 > y0)) return;
  const yH = y1 - y0;
  const leftX = -dz;
  const leftZ = dx;
  const useLeft = leftX * faceX + leftZ * faceZ > 0;
  if (useLeft) {
    pushTri(buf, a[0], y0, a[1], b[0], y0, b[1], b[0], y1, b[1], 0, 0, len, 0, len, yH);
    pushTri(buf, a[0], y0, a[1], b[0], y1, b[1], a[0], y1, a[1], 0, 0, len, yH, 0, yH);
  } else {
    pushTri(buf, a[0], y0, a[1], b[0], y1, b[1], b[0], y0, b[1], 0, 0, len, yH, len, 0);
    pushTri(buf, a[0], y0, a[1], a[0], y1, a[1], b[0], y1, b[1], 0, 0, 0, yH, len, yH);
  }
}

function horizontalNy(a, b, c) {
  return (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
}

function addCap(buf, open, tris, y, insetUV) {
  for (let t = 0; t < tris.length; t += 3) {
    const a = open[tris[t]];
    const b = open[tris[t + 1]];
    const c = open[tris[t + 2]];
    const up = horizontalNy(a, b, c) >= 0;
    const u = insetUV;
    if (up) {
      pushTri(buf, a[0], y, a[1], b[0], y, b[1], c[0], y, c[1], a[0] * u, a[1] * u, b[0] * u, b[1] * u, c[0] * u, c[1] * u);
    } else {
      pushTri(buf, a[0], y, a[1], c[0], y, c[1], b[0], y, b[1], a[0] * u, a[1] * u, c[0] * u, c[1] * u, b[0] * u, b[1] * u);
    }
  }
}

function addUpQuad(buf, a, b, c, d, y) {
  const up = horizontalNy(a, b, c) >= 0;
  const u = 0.2;
  if (up) {
    pushTri(buf, a[0], y, a[1], b[0], y, b[1], c[0], y, c[1], a[0] * u, a[1] * u, b[0] * u, b[1] * u, c[0] * u, c[1] * u);
    pushTri(buf, a[0], y, a[1], c[0], y, c[1], d[0], y, d[1], a[0] * u, a[1] * u, c[0] * u, c[1] * u, d[0] * u, d[1] * u);
  } else {
    pushTri(buf, a[0], y, a[1], c[0], y, c[1], b[0], y, b[1], a[0] * u, a[1] * u, c[0] * u, c[1] * u, b[0] * u, b[1] * u);
    pushTri(buf, a[0], y, a[1], d[0], y, d[1], c[0], y, c[1], a[0] * u, a[1] * u, d[0] * u, d[1] * u, c[0] * u, c[1] * u);
  }
}

export function footprintShell(ring, levels) {
  const open = orientCCW(openRing(ring));
  const baseY = levels.baseY;
  const roofY = levels.roofY;
  const skirtBottomY = levels.skirtBottomY;
  const walls = emptyBuf();
  const skirt = emptyBuf();
  const parapetOuter = emptyBuf();
  const parapetInner = emptyBuf();
  const parapetTop = emptyBuf();
  const gravel = emptyBuf();
  for (let i = 0; i < open.length; i++) {
    const a = open[i];
    const b = open[(i + 1) % open.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const outX = dz;
    const outZ = -dx;
    addWall(walls, a, b, baseY, roofY, outX, outZ);
    addWall(skirt, a, b, skirtBottomY, baseY + 0.05, outX, outZ);
    addWall(parapetOuter, a, b, roofY, roofY + 0.9, outX, outZ);
  }
  const inner = insetRing(open, 0.75);
  const innerTris = triangulateXZ(inner);
  for (let i = 0; i < inner.length; i++) {
    const a = inner[i];
    const b = inner[(i + 1) % inner.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    addWall(parapetInner, a, b, roofY, roofY + 0.9, -dz, dx);
    addUpQuad(parapetTop, open[i], open[(i + 1) % open.length], b, a, roofY + 0.9);
  }
  const tris = triangulateXZ(open);
  if (innerTris.length >= 3) addCap(gravel, inner, innerTris, roofY + 0.08, 0.2);
  else if (tris.length >= 3) addCap(gravel, open, tris, roofY + 0.08, 0.2);
  return { open, inner, walls, skirt, parapetOuter, parapetInner, parapetTop, gravel };
}

function concatBufs(parts) {
  const out = emptyBuf();
  for (const part of parts) {
    for (let i = 0; i < part.pos.length; i++) out.pos.push(part.pos[i]);
    for (let i = 0; i < part.nrm.length; i++) out.nrm.push(part.nrm[i]);
    for (let i = 0; i < part.uv.length; i++) out.uv.push(part.uv[i]);
  }
  return out;
}

function geoFrom(buf) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(buf.pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(buf.nrm, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(buf.uv, 2));
  return geo;
}

function insetRing(open, dist) {
  const c = ringCentroid(open);
  return open.map((p) => {
    const dx = c.x - p[0];
    const dz = c.z - p[1];
    const len = Math.hypot(dx, dz) || 1;
    const d = Math.min(dist, len * 0.4);
    return [p[0] + (dx / len) * d, p[1] + (dz / len) * d];
  });
}

function facadePack(shell, archetype) {
  if (!shell.facadePacks) shell.facadePacks = new Map();
  if (shell.facadePacks.has(archetype)) return shell.facadePacks.get(archetype);
  const spec = ARCHETYPE_COLOR[archetype];
  const albedo = canvasTexture(paintBay(archetype), THREE.SRGBColorSpace, 1 / spec.bay, 1 / (spec.floor * 2));
  const rough = canvasTexture(paintBayMask(archetype, false), THREE.NoColorSpace, 1 / spec.bay, 1 / (spec.floor * 2));
  const emit = canvasTexture(paintBayMask(archetype, true), THREE.SRGBColorSpace, 1 / spec.bay, 1 / (spec.floor * 2));
  for (const tex of [albedo, rough, emit]) trackOwned(shell, tex);
  const pack = { albedo, rough, emit, spec };
  shell.facadePacks.set(archetype, pack);
  return pack;
}

function makeFacadeMaterial(shell, archetype) {
  const pack = facadePack(shell, archetype);
  const mat = stdMat(shell, {
    color: pack.spec.mass,
    map: pack.albedo,
    roughnessMap: pack.rough,
    roughness: archetype === "limestone" ? 0.62 : 0.84,
    metalness: archetype === "limestone" ? 0.06 : 0.04,
    bumpMap: pack.rough,
    bumpScale: 0.045,
    emissive: new THREE.Color(0xffe6c2),
    emissiveMap: pack.emit,
    emissiveIntensity: 0,
  });
  return mat;
}

export function buildRealisticTerrain(shell) {
  const terrain = shell.terrain;
  const sample = createSmoothSampler(terrain);
  shell.sampleHeight = sample;
  const grid = visualGrid(terrain, sample);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(grid.positions, 3));
  geo.setIndex(terrainCellIndices(grid.width, VISUAL_ROWS));
  const uvs = new Float32Array(VISUAL_COLS * VISUAL_ROWS * 2);
  const colors = new Float32Array(VISUAL_COLS * VISUAL_ROWS * 3);
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < grid.heights.length; i++) {
    if (grid.heights[i] < minY) minY = grid.heights[i];
    if (grid.heights[i] > maxY) maxY = grid.heights[i];
  }
  const span = Math.max(1, maxY - minY);
  for (let j = 0; j < VISUAL_ROWS; j++) {
    for (let i = 0; i < VISUAL_COLS; i++) {
      const idx = j * VISUAL_COLS + i;
      uvs[idx * 2] = i / (VISUAL_COLS - 1);
      uvs[idx * 2 + 1] = j / (VISUAL_ROWS - 1);
      const tone = terrainColor((grid.heights[idx] - minY) / span, shell.theme);
      colors[idx * 3] = tone[0];
      colors[idx * 3 + 1] = tone[1];
      colors[idx * 3 + 2] = tone[2];
    }
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const bounds = { x0: grid.x0, x1: grid.x1, z0: grid.z0, z1: grid.z1 };
  const lightMap = trackOwned(shell, canvasTexture(paintHillAlbedo(sample, bounds, "light"), THREE.SRGBColorSpace, 1, 1));
  const darkMap = trackOwned(shell, canvasTexture(paintHillAlbedo(sample, bounds, "dark"), THREE.SRGBColorSpace, 1, 1));
  const roughMap = trackOwned(shell, canvasTexture(paintHillAux(sample, bounds, "rough"), THREE.NoColorSpace, 1, 1));
  const bumpMap = trackOwned(shell, canvasTexture(paintHillAux(sample, bounds, "bump"), THREE.NoColorSpace, 1, 1));
  shell.terrainMaps = { light: lightMap, dark: darkMap };
  const mat = new THREE.MeshStandardMaterial({
    map: shell.theme === "dark" ? darkMap : lightMap,
    roughnessMap: roughMap,
    bumpMap,
    bumpScale: 1.4,
    roughness: 0.94,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  shell.scene.add(mesh);
  shell.terrainMesh = mesh;
  shell.terrainRange = { minY, maxY, heights: grid.heights, width: grid.width };
  shell.surfaceMaterials.push(mat);
  buildBoundary(shell, sample);
}

function buildBoundary(shell, sample) {
  const ring = shell.osm.campusBoundaryXZ;
  if (!ring || ring.length < 2) return;
  const pts = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i];
    const b = ring[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(1, Math.ceil(len / 6));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const x = a[0] + (b[0] - a[0]) * t;
      const z = a[1] + (b[1] - a[1]) * t;
      pts.push(new THREE.Vector3(x, sample(x, z) + 0.4, z));
    }
  }
  if (pts.length < 2) return;
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineDashedMaterial({
    color: 0x6a6156,
    dashSize: 5,
    gapSize: 3.2,
    transparent: true,
    opacity: 0.55,
  });
  const line = new THREE.Line(geo, mat);
  line.computeLineDistances();
  shell.scene.add(line);
  shell.boundary = line;
}

function biasNormalsUp(buf, keep) {
  const k = keep;
  for (let i = 0; i < buf.nrm.length; i += 3) {
    const x = buf.nrm[i] * k;
    const y = buf.nrm[i + 1] * k + (1 - k);
    const z = buf.nrm[i + 2] * k;
    const len = Math.hypot(x, y, z) || 1;
    buf.nrm[i] = x / len;
    buf.nrm[i + 1] = y / len;
    buf.nrm[i + 2] = z / len;
  }
}

function resampleLine(points, sample, width, lift, lateral = 0) {
  const left = [];
  const right = [];
  const samples = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(1, Math.ceil(len / 3));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      samples.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  const last = points[points.length - 1];
  samples.push([last[0], last[1]]);
  const half = width / 2;
  for (let i = 0; i < samples.length; i++) {
    const prev = samples[Math.max(0, i - 1)];
    const next = samples[Math.min(samples.length - 1, i + 1)];
    let tx = next[0] - prev[0];
    let tz = next[1] - prev[1];
    const mag = Math.hypot(tx, tz) || 1;
    tx /= mag;
    tz /= mag;
    const nx = -tz;
    const nz = tx;
    const px = nx * half;
    const pz = nz * half;
    const sx = nx * lateral;
    const sz = nz * lateral;
    const p = samples[i];
    const y = sample(p[0], p[1]) + lift;
    left.push(p[0] + sx - px, y, p[1] + sz - pz);
    right.push(p[0] + sx + px, y, p[1] + sz + pz);
  }
  const pos = [];
  const uv = [];
  const nrm = [];
  const buf = { pos, nrm, uv };
  let dist = 0;
  for (let i = 0; i < samples.length - 1; i++) {
    const ax = left[i * 3];
    const ay = left[i * 3 + 1];
    const az = left[i * 3 + 2];
    const bx = right[i * 3];
    const by = right[i * 3 + 1];
    const bz = right[i * 3 + 2];
    const cx = left[(i + 1) * 3];
    const cy = left[(i + 1) * 3 + 1];
    const cz = left[(i + 1) * 3 + 2];
    const dx = right[(i + 1) * 3];
    const dy = right[(i + 1) * 3 + 1];
    const dz = right[(i + 1) * 3 + 2];
    const step = Math.hypot(samples[i + 1][0] - samples[i][0], samples[i + 1][1] - samples[i][1]);
    pushTri(buf, ax, ay, az, bx, by, bz, dx, dy, dz, 0, dist, 1, dist, 1, dist + step);
    pushTri(buf, ax, ay, az, dx, dy, dz, cx, cy, cz, 0, dist, 1, dist + step, 0, dist + step);
    dist += step;
  }
  biasNormalsUp(buf, 0.18);
  return geoFrom(buf);
}

function drapePolygon(points, sample, lift, step) {
  const open = openRing(points);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of open) {
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minZ) minZ = p[1];
    if (p[1] > maxZ) maxZ = p[1];
  }
  const buf = { pos: [], nrm: [], uv: [] };
  for (let x = minX; x < maxX; x += step) {
    for (let z = minZ; z < maxZ; z += step) {
      const cx = x + step * 0.5;
      const cz = z + step * 0.5;
      if (!pointInRing(cx, cz, open)) continue;
      const quad = [[x, z], [x + step, z], [x + step, z + step], [x, z + step]];
      const y = quad.map((p) => sample(p[0], p[1]) + lift);
      pushTri(buf, quad[0][0], y[0], quad[0][1], quad[1][0], y[1], quad[1][1], quad[2][0], y[2], quad[2][1], quad[0][0] / 8, quad[0][1] / 8, quad[1][0] / 8, quad[1][1] / 8, quad[2][0] / 8, quad[2][1] / 8);
      pushTri(buf, quad[0][0], y[0], quad[0][1], quad[2][0], y[2], quad[2][1], quad[3][0], y[3], quad[3][1], quad[0][0] / 8, quad[0][1] / 8, quad[2][0] / 8, quad[2][1] / 8, quad[3][0] / 8, quad[3][1] / 8);
    }
  }
  if (buf.pos.length < 9) return null;
  biasNormalsUp(buf, 0.22);
  return geoFrom(buf);
}

function addMesh(shell, geo, mat, shadow) {
  if (!geo) return null;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = !!shadow;
  shell.scene.add(mesh);
  return mesh;
}

export function buildCampusLayers(shell) {
  const layers = shell.layers;
  const sample = shell.sampleHeight;
  if (!layers || !sample) return;
  const asphaltTex = trackOwned(shell, canvasTexture(paintAsphalt(), THREE.SRGBColorSpace, 0.25, 0.25));
  const parkTex = trackOwned(shell, canvasTexture(paintParking(), THREE.SRGBColorSpace, 0.2, 0.2));
  const roadMat = surfaceMat(shell, 0x5a6168, 0.9, 0.04, { map: asphaltTex });
  const curbMat = surfaceMat(shell, 0xc8c0b4, 0.86, 0.02, {});
  const pathMat = surfaceMat(shell, 0xcbbfae, 0.88, 0.03, {});
  const turfMat = surfaceMat(shell, 0x3e5640, 0.9, 0.01, {});
  const trackMat = surfaceMat(shell, 0x8a5348, 0.82, 0.03, {});
  const parkMat = surfaceMat(shell, 0xc6b7a2, 0.9, 0.02, {});
  const lotMat = surfaceMat(shell, 0x4d5158, 0.9, 0.05, { map: parkTex });
  const waterMat = surfaceMat(shell, 0x1a3e46, 0.12, 0.25, {
    envMapIntensity: 1,
  });
  const rimMat = surfaceMat(shell, 0x8f877c, 0.9, 0.04, {});
  const roadGeo = [];
  const curbGeo = [];
  shell.roadMarks = [];
  shell.roadTrace = [];
  let longest = null;
  let longestLen = 0;
  for (const road of layers.roads || []) {
    let len = 0;
    for (let i = 1; i < road.points.length; i++) {
      len += Math.hypot(road.points[i][0] - road.points[i - 1][0], road.points[i][1] - road.points[i - 1][1]);
    }
    if (len > longestLen) {
      longest = road;
      longestLen = len;
    }
  }
  (layers.roads || []).forEach((road, index) => {
    const section = roadCrossSection(road.widthM || 4);
    const lift = LIFT.road + (index % 3) * 0.04;
    roadGeo.push(resampleLine(road.points, sample, section.road, lift, 0));
    if (section.shoulder >= 0.12) {
      curbGeo.push(resampleLine(road.points, sample, section.shoulder, lift - 0.04, section.lateral));
      curbGeo.push(resampleLine(road.points, sample, section.shoulder, lift - 0.04, -section.lateral));
    }
    const mid = road.points[Math.floor(road.points.length / 2)];
    if (mid) shell.roadMarks.push({ x: mid[0], y: sample(mid[0], mid[1]) + lift + 0.15, z: mid[1] });
  });
  if (longest) {
    let carried = 0;
    for (let i = 1; i < longest.points.length; i++) {
      const a = longest.points[i - 1];
      const b = longest.points[i];
      const seg = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      while (carried < seg) {
        const t = carried / seg;
        const x = a[0] + (b[0] - a[0]) * t;
        const z = a[1] + (b[1] - a[1]) * t;
        shell.roadTrace.push({ x, y: sample(x, z) + LIFT.road + 0.2, z });
        carried += 8;
      }
      carried -= seg;
    }
  }
  const pathGeo = (layers.paths || []).map((path) => resampleLine(path.points, sample, Math.max(1.4, path.widthM || 1.8), LIFT.path));
  mergeAndAdd(shell, curbGeo, curbMat, false, "curb");
  mergeAndAdd(shell, roadGeo, roadMat, false, "road");
  mergeAndAdd(shell, pathGeo, pathMat, false, "path");
  const buckets = { turf: [], track: [], park: [], lot: [] };
  for (const pitch of layers.pitches || []) {
    const geo = drapePolygon(pitch.points, sample, LIFT.pitch, 3.2);
    const subtype = pitch.subtype || "";
    if (subtype === "parking") buckets.lot.push(geo);
    else if (subtype === "track" || subtype === "stadium") buckets.track.push(geo);
    else if (subtype === "park" || subtype === "garden" || subtype === "playground") buckets.park.push(geo);
    else buckets.turf.push(geo);
  }
  mergeAndAdd(shell, buckets.turf, turfMat, false);
  mergeAndAdd(shell, buckets.track, trackMat, false);
  mergeAndAdd(shell, buckets.park, parkMat, false);
  mergeAndAdd(shell, buckets.lot, lotMat, false);
  for (const water of layers.water || []) {
    const open = openRing(water.points);
    const tris = triangulateXZ(open);
    if (tris.length < 3) continue;
    const heights = open.map((p) => sample(p[0], p[1]));
    const level = heights.slice().sort((a, b) => a - b)[Math.floor(heights.length / 2)] + LIFT.water;
    const buf = { pos: [], nrm: [], uv: [] };
    addCap(buf, open, tris, level, 0.05);
    addMesh(shell, geoFrom(buf), waterMat, false);
    const rim = insetRing(open, -1.6);
    const rimGeo = resampleLine(rim.concat([rim[0]]), sample, 1.5, LIFT.rim);
    addMesh(shell, rimGeo, rimMat, false);
  }
  buildTrees(shell, layers);
  shell.layerStats = {
    roads: (layers.roads || []).length,
    paths: (layers.paths || []).length,
    pitches: (layers.pitches || []).length,
    water: (layers.water || []).length,
    woods: (layers.woods || []).length,
    trees: shell.treeCount || 0,
  };
}

function mergeAndAdd(shell, geos, mat, shadow, layer) {
  const parts = geos.filter(Boolean);
  if (!parts.length) return null;
  let count = 0;
  for (const geo of parts) count += geo.attributes.position.count;
  const pos = new Float32Array(count * 3);
  const nrm = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  let vp = 0;
  let vt = 0;
  for (const geo of parts) {
    pos.set(geo.attributes.position.array, vp);
    if (geo.attributes.normal) nrm.set(geo.attributes.normal.array, vp);
    if (geo.attributes.uv) uv.set(geo.attributes.uv.array, vt);
    vp += geo.attributes.position.array.length;
    vt += geo.attributes.uv ? geo.attributes.uv.array.length : 0;
    geo.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  merged.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  const mesh = addMesh(shell, merged, mat, shadow);
  if (mesh) {
    mesh.userData.layer = layer || "";
    if (!shell.layerMeshes) shell.layerMeshes = {};
    shell.layerMeshes[layer || "surface"] = mesh;
  }
  return mesh;
}

function buildTrees(shell, layers) {
  const trees = placeTrees({
    terrain: shell.terrain,
    buildings: shell.osm.buildings,
    layers,
  });
  shell.treeCount = trees.length;
  shell.treePoints = trees;
  if (!trees.length) return;
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.28, 3.4, 5);
  const crownA = new THREE.ConeGeometry(1.45, 2.5, 6).toNonIndexed();
  crownA.translate(0, 2.15, 0);
  const crownB = new THREE.ConeGeometry(1.05, 2.0, 6).toNonIndexed();
  crownB.translate(0, 3.45, 0);
  const foliageGeo = mergeGeos([crownA, crownB]);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4032, roughness: 0.9, metalness: 0 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0 });
  shell.surfaceMaterials.push(trunkMat, leafMat);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
  const leaves = new THREE.InstancedMesh(foliageGeo, leafMat, trees.length);
  trunks.castShadow = true;
  trunks.receiveShadow = true;
  leaves.castShadow = (shell.stage.clientWidth || 1024) >= 800;
  leaves.receiveShadow = true;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < trees.length; i++) {
    const tree = trees[i];
    const h = tree.scale;
    dummy.position.set(tree.x, tree.y + 1.7 * h, tree.z);
    dummy.rotation.set(0, tree.hue * Math.PI * 2, 0);
    dummy.scale.set(h, tree.kind === "pine" ? h * 1.15 : h * 0.92, h);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(tree.x, tree.y + (tree.kind === "pine" ? 3.15 : 2.7) * h, tree.z);
    dummy.scale.set(tree.kind === "pine" ? h * 0.82 : h * 1.18, h, tree.kind === "pine" ? h * 0.82 : h * 1.18);
    dummy.updateMatrix();
    leaves.setMatrixAt(i, dummy.matrix);
    color.set(tree.kind === "pine" ? 0x3e4c34 : 0x667044);
    color.offsetHSL((tree.hue - 0.5) * 0.04, (tree.hue - 0.5) * 0.08, (tree.hue - 0.5) * 0.08);
    leaves.setColorAt(i, color);
    trunks.setColorAt(i, new THREE.Color(0.85 + tree.hue * 0.2, 0.75, 0.62));
  }
  trunks.instanceMatrix.needsUpdate = true;
  leaves.instanceMatrix.needsUpdate = true;
  if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
  if (trunks.instanceColor) trunks.instanceColor.needsUpdate = true;
  shell.scene.add(trunks, leaves);
  shell.trees = [trunks, leaves];
}

function mergeGeos(geos) {
  let count = 0;
  for (const geo of geos) count += geo.attributes.position.count;
  const pos = new Float32Array(count * 3);
  const nrm = new Float32Array(count * 3);
  let offset = 0;
  for (const geo of geos) {
    pos.set(geo.attributes.position.array, offset);
    nrm.set(geo.attributes.normal.array, offset);
    offset += geo.attributes.position.array.length;
    geo.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  return merged;
}

export function buildRealisticBuildings(shell) {
  const gravelTex = trackOwned(shell, canvasTexture(paintGravel(), THREE.SRGBColorSpace, 0.25, 0.25));
  for (const building of shell.osm.buildings) {
    const seat = measureFootprint(building.footprintXZ, shell.terrain);
    const roofY = seat.baseY + SCHEMATIC_HEIGHT_M;
    const built = footprintShell(building.footprintXZ, {
      baseY: seat.baseY,
      roofY,
      skirtBottomY: seat.skirtBottomY,
    });
    const open = built.open;
    if (open.length < 3 || built.walls.pos.length < 9) continue;
    const entries = shell.byOsm.get(building.osmId) || [];
    const kind = buildingKind(building.osmId, entries.length > 0);
    const archetype = archetypeFor(building.osmId, kind);
    const spec = ARCHETYPE_COLOR[archetype];
    const centroid = ringCentroid(open);
    const facade = makeFacadeMaterial(shell, archetype);
    const skirtMat = stdMat(shell, { color: spec.skirt, roughness: 0.96, metalness: 0 });
    const parapetMat = stdMat(shell, { color: spec.roof, roughness: 0.78, metalness: 0.05 });
    const gravelMat = stdMat(shell, {
      color: archetype === "crimson" ? 0x6a5348 : 0x7a7368,
      map: gravelTex,
      roughness: 0.92,
      metalness: 0.02,
    });
    const parapet = concatBufs([built.parapetOuter, built.parapetInner, built.parapetTop]);
    const mass = new THREE.Mesh(geoFrom(built.walls), facade);
    const skirtMesh = new THREE.Mesh(geoFrom(built.skirt), skirtMat);
    const roof = new THREE.Mesh(geoFrom(parapet), parapetMat);
    const gravelMesh = built.gravel.pos.length >= 9 ? new THREE.Mesh(geoFrom(built.gravel), gravelMat) : null;
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(mass.geometry, 28),
      new THREE.LineBasicMaterial({ color: spec.edge, transparent: true, opacity: archetype === "crimson" ? 0.55 : 0.16 }),
    );
    for (const mesh of [mass, skirtMesh, roof, gravelMesh]) {
      if (!mesh) continue;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    mass.userData.osmId = building.osmId;
    roof.userData.osmId = building.osmId;
    if (gravelMesh) gravelMesh.userData.osmId = building.osmId;
    const group = new THREE.Group();
    group.add(skirtMesh, mass, roof, edges);
    if (gravelMesh) group.add(gravelMesh);
    const area = Math.abs(signedArea(open));
    if (area > 220) {
      const mech = stdMat(shell, { color: 0x6d6962, roughness: 0.7, metalness: 0.22 });
      const w = Math.max(3.2, Math.min(12, Math.sqrt(area) * 0.2));
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, area > 640 ? 2.6 : 1.9, w * 0.62), mech);
      const ox = ((building.osmId % 7) - 3) * 0.7;
      const oz = (((building.osmId >> 3) % 5) - 2) * 0.7;
      box.position.set(centroid.x + ox, roofY + 0.08 + box.geometry.parameters.height / 2, centroid.z + oz);
      box.castShadow = true;
      box.receiveShadow = true;
      box.userData.osmId = building.osmId;
      group.add(box);
      shell.pickables.push(box);
      if (area > 520) {
        const hvac = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 1.4), mech);
        hvac.position.set(centroid.x - ox * 0.4, roofY + 0.7, centroid.z - oz * 0.5);
        hvac.castShadow = true;
        hvac.userData.osmId = building.osmId;
        group.add(hvac);
        shell.pickables.push(hvac);
      }
    }
    let beacon = null;
    if (archetype === "crimson") {
      const ringPts = open.map((p) => new THREE.Vector3(p[0], seat.baseY + 0.45, p[1]));
      const ring = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(ringPts),
        new THREE.LineBasicMaterial({ color: 0xc92a2a, transparent: true, opacity: 0.9 }),
      );
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.1, 4.8, 6),
        stdMat(shell, { color: 0x2a2724, roughness: 0.45, metalness: 0.35 }),
      );
      pole.position.set(centroid.x, roofY + 3.2, centroid.z);
      const lampMat = stdMat(shell, {
        color: 0xc92a2a,
        emissive: new THREE.Color(0xc92a2a),
        emissiveIntensity: 0.7,
        roughness: 0.35,
        metalness: 0.1,
      });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), lampMat);
      lamp.position.set(centroid.x, roofY + 5.7, centroid.z);
      group.add(ring, pole, lamp);
      beacon = lamp;
    }
    shell.scene.add(group);
    const record = {
      osmId: building.osmId,
      building,
      entries,
      mapped: entries.length > 0,
      kind,
      archetype,
      skirt: skirtMesh,
      mass,
      roof,
      edge: edges,
      beacon,
      group,
      seat,
      centroid,
      ring: open,
      facades: [facade],
    };
    shell.buildings.push(record);
    shell.pickables.push(mass, roof);
    if (gravelMesh) shell.pickables.push(gravelMesh);
  }
  paintRealisticBuildings(shell);
}

export function paintRealisticBuildings(shell) {
  const dark = shell.theme === "dark";
  for (const record of shell.buildings) {
    const mode = record.osmId === shell.selectedId ? "selected" : record.osmId === shell.hoverId ? "hover" : "idle";
    const boost = mode === "selected" ? 0.28 : mode === "hover" ? 0.12 : 0;
    for (const mat of record.facades || []) {
      mat.emissiveIntensity = (dark ? 0.9 : 0.06) + boost;
    }
    if (record.edge) {
      record.edge.material.opacity = record.archetype === "crimson"
        ? (mode === "idle" ? 0.62 : 0.9)
        : (mode === "idle" ? 0.07 : 0.28);
    }
    if (record.skirt && record.skirt.material && record.skirt.material.emissive) {
      record.skirt.material.emissive.setHex(0x6e675f);
      record.skirt.material.emissiveIntensity = dark ? 0.72 : 0.48;
    }
    if (record.beacon && record.beacon.material) {
      record.beacon.material.emissiveIntensity = dark ? 1.35 : 0.55;
    }
  }
}

export function repaintTerrainColors(shell) {
  if (!shell.terrainMesh || !shell.terrainRange) return;
  const { minY, maxY, heights } = shell.terrainRange;
  const span = Math.max(1, maxY - minY);
  const colors = shell.terrainMesh.geometry.attributes.color.array;
  for (let i = 0; i < heights.length; i++) {
    const tone = terrainColor((heights[i] - minY) / span, shell.theme);
    colors[i * 3] = tone[0];
    colors[i * 3 + 1] = tone[1];
    colors[i * 3 + 2] = tone[2];
  }
  shell.terrainMesh.geometry.attributes.color.needsUpdate = true;
}
