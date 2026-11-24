// Bathroom 3D tour — Three.js, no build step.
// Units are FEET. Plan coordinates: x = east (from the vanity wall), y = north (from the bedroom wall).
// Three.js mapping: (x, height, y) -> new Vector3(x, height, -y).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { WebGLPathTracer } from 'three-gpu-pathtracer';

// ---------------------------------------------------------------------------
// DIMENSIONS — estimated from the photos (8-ft double vanity, 36" door, 9-ft ceiling).
// Replace with tape-measured values and everything else follows.
// ---------------------------------------------------------------------------
const DIM = {
  W: 11.0,          // room width, vanity wall -> toilet/shower wall
  D: 8.5,           // room depth, bedroom wall -> window wall
  H: 9.0,           // ceiling height
  vanity: { depth: 1.83, y0: 0.25, len: 8.0, bottom: 0.75, top: 2.83, sinks: [2.4, 6.1] },
  mirror: { y0: 0.4, y1: 8.1, h0: 3.45, h1: 7.1 },
  clerestory: { y0: 0.6, y1: 7.9, h0: 7.45, h1: 8.6 },
  window: { x0: 2.65, x1: 5.15, sill: 3.1, head: 7.0 },
  doorway: { x0: 2.3, x1: 5.3, head: 7.6 },
  shower: { x0: 5.9, y0: 3.25, benchDepth: 1.35, benchH: 1.5, curbW: 0.33, curbH: 0.33, glassTop: 7.6, doorY: 6.0 },
  toilet: { x: 10.0, y: 1.6 },
  eye: 5.3,
};
const S = DIM.shower;
const benchY1 = S.y0 + S.benchDepth;

const TEXTURE_SIZES_FT = {
  floor_greige: 8, floor_graphite: 8, floor_original: 8, floor_herringbone: 6 * Math.SQRT2 * 0.5,
  wall_veincut: 8, shower_greige: 4, shower_mosaic_original: 4, floor_oak_bedroom: 4,
  floor_ivory: 8, floor_terrazzo: 8, mosaic_taupe: 2, zellige_white: 4, tile_sage: 4, oak_fluted: 2,
};

const FLOORS = {
  greige: {
    tex: 'floor_greige', shower: 'shower_greige', cap: 0xcac1b4,
    title: 'Warm greige porcelain · 24×48"',
    spec: 'Large-format matte porcelain, limestone look, stacked grid parallel to the vanity, 1/16" matching grout. Shower: same tile in 12×24 to a linear drain.',
  },
  herringbone: {
    tex: 'floor_herringbone', shower: 'shower_greige', cap: 0xcac1b4,
    title: 'White-oak-look porcelain herringbone · 6×36"',
    spec: 'Wood-look porcelain planks in a 45° herringbone. Waterproof, and warms up the room to match the bedroom oak. Shower floor in greige 12×24.',
  },
  graphite: {
    tex: 'floor_graphite', shower: 'floor_graphite', cap: 0x6a6a68,
    title: 'Graphite concrete-look porcelain · 32×32"',
    spec: 'Dark honed porcelain with a soft concrete texture. High contrast with the white walls and quartz; ties in with the espresso vanity.',
  },
  ivory: {
    tex: 'floor_ivory', shower: 'floor_ivory', cap: 0xe6dccd,
    title: 'Ivory limestone porcelain · 24×24"',
    spec: 'Honed warm-ivory limestone look with soft cloudy movement and hairline grout. The softest, most spa-like option.',
  },
  terrazzo: {
    tex: 'floor_terrazzo', shower: 'floor_terrazzo', cap: 0xe9e4da,
    title: 'Light terrazzo porcelain · 24×24"',
    spec: 'Warm white base with cream, grey, terracotta and sage chips. Playful but refined, and great at hiding water spots.',
  },
  original: {
    tex: 'floor_original', shower: 'shower_mosaic_original', cap: null,
    title: 'Existing: grey vein-cut stone · 12×24"',
    spec: 'Current floor: busy grey wood-grain strips that read dated and visually shrink the room.',
  },
};

// Concept styles. Each is a complete look; floor and fixture finish can still be swapped on top.
const STYLES = {
  minimal: {
    name: 'Warm Minimal', floor: 'greige', finish: 'black', led: true,
    showerWall: 'wall_veincut', cap: null, mirror: 'single', sconce: 'mirror', faucet: 'deck', vanity: 'espresso', pulls: 'steel',
    wall: 0xefece7, wainscot: null, backsplash: null, shade: null, niche: 'small', rug: false,
    desc: 'Keeps the stone shower and big mirror, with a calm large-format floor, matte black fixtures and LED glow. The least disruptive option.',
  },
  spa: {
    name: 'Soft Spa', floor: 'ivory', finish: 'nickel', led: true,
    showerWall: 'mosaic_taupe', cap: 0xe6dccd, mirror: 'rect2', sconce: 'cyl', faucet: 'wall', vanity: 'espresso', pulls: 'none',
    wall: 0xf2eee8, wainscot: 'mosaic_taupe', backsplash: 'mosaic_taupe', shade: 'shade_linen', niche: 'linear', rug: true,
    desc: 'Hotel-spa calm: ivory stone floor, taupe textured mosaic on the shower and window wall, twin black-framed mirrors with nickel sconces, wall-mounted faucets, long lit niche and a linen shade.',
  },
  japandi: {
    name: 'Japandi Warmth', floor: 'herringbone', finish: 'brass', led: true,
    showerWall: 'zellige_white', cap: 0xb08458, mirror: 'round2', sconce: 'drum', faucet: 'deck', vanity: 'oak', pulls: 'none',
    wall: 0xe9e1d4, wainscot: null, backsplash: null, shade: 'shade_bamboo', niche: 'small', rug: false,
    desc: 'Natural and warm: oak-look herringbone, fluted white-oak vanity fronts, round brass mirrors, white zellige shower, limewash walls and a bamboo shade.',
  },
  terrazzo: {
    name: 'Terrazzo & Sage', floor: 'terrazzo', finish: 'brass', led: false,
    showerWall: 'tile_sage', cap: 0xe9e4da, mirror: 'arch2', sconce: 'globe', faucet: 'deck', vanity: 'espresso', pulls: 'brass',
    wall: 0xf3f1ec, wainscot: null, backsplash: 'tile_sage', shade: 'shade_sheer', niche: 'small', rug: false,
    desc: 'Fresh and a bit playful: light terrazzo floor, glossy sage vertical-stack tile in the shower and backsplash, arched brass mirrors and globe sconces.',
  },
};

// ---------------------------------------------------------------------------
const $ = (s) => document.querySelector(s);
const isTouch = matchMedia('(pointer: coarse)').matches;
const canvasWrap = $('#stage');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.75 : 2));
renderer.setSize(canvasWrap.clientWidth, canvasWrap.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.82;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
canvasWrap.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(canvasWrap.clientWidth, canvasWrap.clientHeight);
labelRenderer.domElement.className = 'labels';
canvasWrap.appendChild(labelRenderer.domElement);

RectAreaLightUniformsLib.init();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f1ec);
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex;
scene.environmentIntensity = 0.4;

const camera = new THREE.PerspectiveCamera(65, canvasWrap.clientWidth / canvasWrap.clientHeight, 0.05, 300);
camera.rotation.order = 'YXZ';

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------
const manager = new THREE.LoadingManager();
const loaderEl = $('#loader');
manager.onProgress = (_u, done, total) => { $('#loaderBar').style.width = `${Math.round((done / total) * 100)}%`; };
manager.onLoad = () => { loaderEl.classList.add('done'); requestRender(); showHint(); };
const texLoader = new THREE.TextureLoader(manager);
const texCache = {};
function tex(name) {
  if (!texCache[name]) {
    const t = texLoader.load(`textures/${name}.jpg`, () => requestRender());
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texCache[name] = t;
  }
  return texCache[name];
}
const HAS_NORMAL = new Set(['floor_greige', 'floor_graphite', 'floor_original', 'floor_herringbone', 'floor_ivory', 'floor_terrazzo', 'wall_veincut', 'shower_greige', 'shower_mosaic_original', 'mosaic_taupe', 'zellige_white', 'tile_sage', 'oak_fluted', 'floor_oak_bedroom']);
const texNCache = {};
function texN(name) {
  if (!HAS_NORMAL.has(name)) return null;
  if (!texNCache[name]) {
    const t = texLoader.load(`textures/${name}_n.jpg`, () => requestRender());
    t.colorSpace = THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texNCache[name] = t;
  }
  return texNCache[name];
}
// Apply a tiled colour + normal map at true physical scale
function applyTex(mat, name, w, h, normalScale = 1) {
  mat.map = tiled(name, w, h);
  const n = texN(name);
  if (n) {
    const c = n.clone(); if (c.image) c.needsUpdate = true;
    c.repeat.copy(mat.map.repeat);
    mat.normalMap = c; mat.normalScale.set(normalScale, normalScale);
  } else mat.normalMap = null;
  mat.color.set(0xffffff);
  mat.needsUpdate = true;
}
function tiled(name, w, h) {
  const t = tex(name).clone();
  if (t.image) t.needsUpdate = true; // clones share the source; it updates itself once loaded
  const s = TEXTURE_SIZES_FT[name] || 8;
  t.repeat.set(w / s, h / s);
  return t;
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------
const M = {
  wall: new THREE.MeshStandardMaterial({ color: 0xefece7, roughness: 0.92 }),
  ceiling: new THREE.MeshStandardMaterial({ color: 0xf6f4f0, roughness: 0.95 }),
  trim: new THREE.MeshStandardMaterial({ color: 0xf7f6f3, roughness: 0.6 }),
  vanity: new THREE.MeshStandardMaterial({ color: 0x241c19, roughness: 0.45 }),
  vanityGap: new THREE.MeshStandardMaterial({ color: 0x0c0907, roughness: 0.9 }),
  quartz: new THREE.MeshPhysicalMaterial({ color: 0xece7df, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
  porcelain: new THREE.MeshPhysicalMaterial({ color: 0xfbfbfa, roughness: 0.12, clearcoat: 1 }),
  pull: new THREE.MeshStandardMaterial({ color: 0xc9c9c9, metalness: 1, roughness: 0.28 }),
  fixture: new THREE.MeshStandardMaterial({ color: 0x1d1d1d, metalness: 0.35, roughness: 0.48 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xdff0ea, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.6 }),
  glassEdge: new THREE.MeshStandardMaterial({ color: 0x9cc9b6, roughness: 0.1, transparent: true, opacity: 0.55 }),
  frosted: new THREE.MeshPhysicalMaterial({ color: 0xdfeee8, roughness: 0.55, transparent: true, opacity: 0.86 }),
  darkGlass: new THREE.MeshPhysicalMaterial({ color: 0x1b2226, roughness: 0.06, metalness: 0.2, envMapIntensity: 1.2 }),
  black: new THREE.MeshStandardMaterial({ color: 0x232323, roughness: 0.6, metalness: 0.4 }),
  sconce: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3e0, emissiveIntensity: 1.0, roughness: 0.4 }),
  can: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff5e6, emissiveIntensity: 2.2 }),
  led: new THREE.MeshStandardMaterial({ color: 0xffd7a3, emissive: 0xffb469, emissiveIntensity: 3 }),
  plantPot: new THREE.MeshStandardMaterial({ color: 0xf2f0ec, roughness: 0.5 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x4f8a3a, roughness: 0.7, side: THREE.DoubleSide }),
  amber: new THREE.MeshPhysicalMaterial({ color: 0x8a4a14, roughness: 0.15, transmission: 0, clearcoat: 1 }),
  board: new THREE.MeshStandardMaterial({ color: 0x8c3b33, roughness: 0.9 }),
  towel: new THREE.MeshStandardMaterial({ color: 0xf8f7f4, roughness: 1 }),
  oakWall: new THREE.MeshStandardMaterial({ color: 0xebe8e3, roughness: 0.95 }),
  bed: new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.9 }),
  chair: new THREE.MeshStandardMaterial({ color: 0x8e9196, roughness: 0.95 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.6 }),
  vpull: new THREE.MeshStandardMaterial({ color: 0xc9c9c9, metalness: 1, roughness: 0.28 }),
  frame: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.4, roughness: 0.45 }),
  rug: new THREE.MeshStandardMaterial({ roughness: 1 }),
  shade: new THREE.MeshStandardMaterial({ roughness: 0.95, side: THREE.DoubleSide }),
  tileAccent: new THREE.MeshStandardMaterial({ roughness: 0.5 }),
  backsplash: new THREE.MeshStandardMaterial({ roughness: 0.4 }),
  drum: new THREE.MeshStandardMaterial({ color: 0xf3e9d8, emissive: 0xffd9a8, emissiveIntensity: 0.9, roughness: 0.9 }),
};
const floorMat = new THREE.MeshStandardMaterial({ roughness: 0.55, envMapIntensity: 0.6 });
const showerFloorMat = new THREE.MeshStandardMaterial({ roughness: 0.6, envMapIntensity: 0.5 });
const capMat = new THREE.MeshStandardMaterial({ roughness: 0.5 });
const showerWallMats = [];
const veinMat = (w, h) => {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.42, envMapIntensity: 0.7 });
  applyTex(m, 'wall_veincut', w, h);
  showerWallMats.push({ m, w, h });
  return m;
};

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------
const root = new THREE.Group();
scene.add(root);
const wallGroups = { N: new THREE.Group(), S: new THREE.Group(), E: new THREE.Group(), W: new THREE.Group() };
Object.values(wallGroups).forEach((g) => root.add(g));

function B(x0, x1, y0, y1, h0, h1, mat, parent = root, opts = {}) {
  const geo = opts.rounded
    ? new RoundedBoxGeometry(x1 - x0, h1 - h0, y1 - y0, 3, opts.rounded)
    : new THREE.BoxGeometry(x1 - x0, h1 - h0, y1 - y0);
  const m = new THREE.Mesh(geo, mat);
  m.position.set((x0 + x1) / 2, (h0 + h1) / 2, -(y0 + y1) / 2);
  m.castShadow = opts.cast !== false;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
// Plane on a wall. face: 'N' (on north wall facing south), 'S', 'E', 'W'
function wallPlane(face, a0, a1, h0, h1, mat, offset = 0.005, parent = root) {
  const w = a1 - a0, h = h1 - h0;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  const c = (a0 + a1) / 2, ch = (h0 + h1) / 2;
  if (face === 'N') { m.position.set(c, ch, -(DIM.D - offset)); }
  if (face === 'S') { m.position.set(c, ch, -offset); m.rotation.y = Math.PI; }
  if (face === 'E') { m.position.set(DIM.W - offset, ch, -c); m.rotation.y = -Math.PI / 2; }
  if (face === 'W') { m.position.set(offset, ch, -c); m.rotation.y = Math.PI / 2; }
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const V = (x, h, y) => new THREE.Vector3(x, h, -y);

// ---------------------------------------------------------------------------
// Architecture
// ---------------------------------------------------------------------------
const { W, D, H } = DIM;
const T = 0.4; // wall thickness

// floor
const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.set(W / 2, 0, -D / 2);
floor.receiveShadow = true;
floor.name = 'floor';
root.add(floor);

// ceiling
const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W + 2 * T, D + 2 * T), M.ceiling);
ceiling.rotation.x = Math.PI / 2;
ceiling.position.set(W / 2, H, -D / 2);
root.add(ceiling);

// West wall (vanity) with clerestory opening
const C = DIM.clerestory;
B(-T, 0, -T, D + T, 0, C.h0, M.wall, wallGroups.W);
B(-T, 0, -T, C.y0, C.h0, H, M.wall, wallGroups.W);
B(-T, 0, C.y1, D + T, C.h0, H, M.wall, wallGroups.W);
B(-T, 0, C.y0, C.y1, C.h1, H, M.wall, wallGroups.W);
B(-T + 0.05, -T + 0.12, C.y0, C.y1, C.h0, C.h1, M.darkGlass, wallGroups.W);
// clerestory trim
B(-0.02, 0.06, C.y0 - 0.25, C.y1 + 0.25, C.h0 - 0.2, C.h0, M.trim, wallGroups.W);
B(-0.02, 0.06, C.y0 - 0.25, C.y1 + 0.25, C.h1, C.h1 + 0.2, M.trim, wallGroups.W);

// North wall (window)
const Wn = DIM.window;
B(-T, Wn.x0, D, D + T, 0, H, M.wall, wallGroups.N);
B(Wn.x1, W + T, D, D + T, 0, H, M.wall, wallGroups.N);
B(Wn.x0, Wn.x1, D, D + T, 0, Wn.sill, M.wall, wallGroups.N);
B(Wn.x0, Wn.x1, D, D + T, Wn.head, H, M.wall, wallGroups.N);
// window unit
{
  const g = wallGroups.N;
  const fw = 0.22;
  B(Wn.x0, Wn.x1, D + 0.12, D + 0.3, Wn.sill, Wn.sill + fw, M.trim, g);
  B(Wn.x0, Wn.x1, D + 0.12, D + 0.3, Wn.head - fw, Wn.head, M.trim, g);
  B(Wn.x0, Wn.x0 + fw, D + 0.12, D + 0.3, Wn.sill, Wn.head, M.trim, g);
  B(Wn.x1 - fw, Wn.x1, D + 0.12, D + 0.3, Wn.sill, Wn.head, M.trim, g);
  const mid = (Wn.sill + Wn.head) / 2;
  B(Wn.x0, Wn.x1, D + 0.14, D + 0.26, mid - 0.08, mid + 0.08, M.trim, g);
  // casing + stool
  B(Wn.x0 - 0.3, Wn.x1 + 0.3, D - 0.06, D, Wn.head, Wn.head + 0.3, M.trim, g);
  B(Wn.x0 - 0.3, Wn.x0, D - 0.06, D, Wn.sill - 0.25, Wn.head + 0.3, M.trim, g);
  B(Wn.x1, Wn.x1 + 0.3, D - 0.06, D, Wn.sill - 0.25, Wn.head + 0.3, M.trim, g);
  B(Wn.x0 - 0.35, Wn.x1 + 0.35, D - 0.28, D + 0.12, Wn.sill - 0.08, Wn.sill, M.trim, g);
  B(Wn.x0 - 0.3, Wn.x1 + 0.3, D - 0.06, D, Wn.sill - 0.35, Wn.sill - 0.08, M.trim, g);
  const view = tex('window_view');
  const viewMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: view, emissiveIntensity: 1.6 });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(Wn.x1 - Wn.x0, Wn.head - Wn.sill), viewMat);
  p.position.set((Wn.x0 + Wn.x1) / 2, (Wn.sill + Wn.head) / 2, -(D + 0.32));
  g.add(p);
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(Wn.x1 - Wn.x0, Wn.head - Wn.sill), M.glass);
  pane.position.set((Wn.x0 + Wn.x1) / 2, (Wn.sill + Wn.head) / 2, -(D + 0.2));
  g.add(pane);
}

// East wall
B(W, W + T, -T, D + T, 0, H, M.wall, wallGroups.E);

// South wall with doorway
const Dw = DIM.doorway;
B(-T, Dw.x0, -T, 0, 0, H, M.wall, wallGroups.S);
B(Dw.x1, W + T, -T, 0, 0, H, M.wall, wallGroups.S);
B(Dw.x0, Dw.x1, -T, 0, Dw.head, H, M.wall, wallGroups.S);
// jamb returns
B(Dw.x0 - 0.04, Dw.x0, -T, 0, 0, Dw.head, M.trim, wallGroups.S);
B(Dw.x1, Dw.x1 + 0.04, -T, 0, 0, Dw.head, M.trim, wallGroups.S);

// Baseboards
const bb = 0.33;
B(0, 0.04, DIM.vanity.y0 + DIM.vanity.len, D, 0, bb, M.trim);
B(0, Dw.x0, 0, 0.04, 0, bb, M.trim);
B(Dw.x1, W, 0, 0.04, 0, bb, M.trim);
B(0, S.x0, D - 0.04, D, 0, bb, M.trim);
B(W - 0.04, W, 0, S.y0, 0, bb, M.trim);
B(0, 0.04, 0, DIM.vanity.y0, 0, bb, M.trim);

// ---------------------------------------------------------------------------
// Vanity, mirror, sconces
// ---------------------------------------------------------------------------
const Va = DIM.vanity;
const vy0 = Va.y0, vy1 = Va.y0 + Va.len, vx1 = Va.depth;
B(0, vx1 - 0.05, vy0, vy1, Va.bottom, Va.top - 0.1, M.vanity);
// fronts: [y0,y1,type]  d2 = two drawers, doors = pair of doors
const vanityPulls = [];
const vanityFrontMat = new THREE.MeshStandardMaterial({ color: 0x241c19, roughness: 0.45 });
const sections = [[vy0, vy0 + 1.4, 'd2'], [vy0 + 1.4, vy0 + 3.0, 'doors'], [vy0 + 3.0, vy0 + 5.0, 'd2'], [vy0 + 5.0, vy0 + 6.6, 'doors'], [vy0 + 6.6, vy1, 'd2']];
const fz0 = Va.bottom, fz1 = Va.top - 0.1;
for (const [a, b, type] of sections) {
  const g = 0.012;
  if (type === 'd2') {
    const mid = (fz0 + fz1) / 2;
    for (const [h0, h1] of [[fz0, mid], [mid, fz1]]) {
      B(vx1 - 0.05, vx1, a + g, b - g, h0 + g, h1 - g, vanityFrontMat);
      const hc = (h0 + h1) / 2 + 0.12;
      vanityPulls.push(B(vx1, vx1 + 0.08, (a + b) / 2 - 0.42, (a + b) / 2 + 0.42, hc - 0.02, hc + 0.02, M.vpull));
    }
  } else {
    const mid = (a + b) / 2;
    for (const [y0, y1, side] of [[a, mid, 1], [mid, b, -1]]) {
      B(vx1 - 0.05, vx1, y0 + g, y1 - g, fz0 + g, fz1 - g, vanityFrontMat);
      const yc = side > 0 ? y1 - 0.15 : y0 + 0.15;
      vanityPulls.push(B(vx1, vx1 + 0.08, yc - 0.02, yc + 0.02, fz1 - 0.9, fz1 - 0.2, M.vpull));
    }
  }
  B(vx1 - 0.06, vx1 - 0.04, a - 0.01, a + 0.01, fz0, fz1, M.vanityGap, root, { cast: false });
}
// counter + backsplash
B(0, vx1 + 0.06, vy0 - 0.02, vy1 + 0.02, Va.top - 0.1, Va.top, M.quartz);
B(0, 0.06, vy0, vy1, Va.top, Va.top + 0.33, M.quartz);
B(0, vx1 + 0.06, vy1, vy1 + 0.06, Va.top, Va.top + 0.33, M.quartz);
// sinks (undermount basin illusion) + faucets
const basinTex = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 128);
  const gr = x.createRadialGradient(128, 64, 10, 128, 64, 130);
  gr.addColorStop(0, '#e9eaea'); gr.addColorStop(0.75, '#fbfbfb'); gr.addColorStop(1, '#d3d4d4');
  x.fillStyle = gr; x.fillRect(0, 0, 256, 128);
  x.fillStyle = '#8b8d8f'; x.beginPath(); x.arc(128, 64, 7, 0, 7); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const basinMat = new THREE.MeshPhysicalMaterial({ map: basinTex, roughness: 0.1, clearcoat: 1 });
const deckFaucets = new THREE.Group(); root.add(deckFaucets);
const wallFaucets = new THREE.Group(); root.add(wallFaucets);
for (const sy of Va.sinks) {
  const b = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.95), basinMat);
  b.rotation.x = -Math.PI / 2; b.rotation.z = Math.PI / 2;
  b.position.set(0.95, Va.top + 0.002, -sy);
  root.add(b);
  // gooseneck faucet
  const fx = 0.3;
  const path = new THREE.CatmullRomCurve3([V(fx, Va.top, sy), V(fx, Va.top + 0.9, sy), V(fx + 0.12, Va.top + 1.12, sy), V(fx + 0.38, Va.top + 1.0, sy), V(fx + 0.48, Va.top + 0.75, sy)]);
  const f = new THREE.Mesh(new THREE.TubeGeometry(path, 40, 0.045, 12, false), M.fixture);
  f.castShadow = true; deckFaucets.add(f);
  for (const s of [-1, 1]) {
    B(fx - 0.05, fx + 0.12, sy + s * 0.55 - 0.05, sy + s * 0.55 + 0.05, Va.top, Va.top + 0.12, M.fixture, deckFaucets);
    B(fx - 0.05, fx + 0.2, sy + s * 0.55 - 0.02, sy + s * 0.55 + 0.02, Va.top + 0.12, Va.top + 0.17, M.fixture, deckFaucets);
  }
  B(fx - 0.07, fx + 0.07, sy - 0.07, sy + 0.07, Va.top, Va.top + 0.05, M.fixture, deckFaucets);
  // wall-mounted spout + two handles (Soft Spa)
  const wh = Va.top + 1.15;
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.62, 16), M.fixture);
  sp.rotation.z = Math.PI / 2; sp.position.set(0.38, wh, -sy); wallFaucets.add(sp);
  B(0.06, 0.12, sy - 0.12, sy + 0.12, wh - 0.12, wh + 0.12, M.fixture, wallFaucets);
  for (const s of [-1, 1]) {
    B(0.06, 0.1, sy + s * 0.5 - 0.08, sy + s * 0.5 + 0.08, wh - 0.08, wh + 0.08, M.fixture, wallFaucets);
    B(0.1, 0.28, sy + s * 0.5 - 0.025, sy + s * 0.5 + 0.025, wh - 0.025, wh + 0.025, M.fixture, wallFaucets);
  }
}
// soap + plant on counter
{
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.45, 20), M.black);
  s.position.set(0.55, Va.top + 0.22, -(Va.sinks[0] + 0.95)); root.add(s);
  addPlant(0.45, Va.top, vy1 - 0.45, 0.8);
}
function addPlant(x, h, y, scale = 1) {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.32, 20), M.plantPot);
  pot.position.y = 0.16; pot.castShadow = true; g.add(pot);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.8, 6), M.leaf);
  stem.position.y = 0.7; g.add(stem);
  const leafGeo = new THREE.SphereGeometry(0.16, 10, 6); leafGeo.scale(1, 0.12, 0.45);
  for (let i = 0; i < 16; i++) {
    const l = new THREE.Mesh(leafGeo, M.leaf);
    const a = (i / 16) * Math.PI * 2 + (i % 3);
    const r = 0.18 + (i % 4) * 0.04;
    l.position.set(Math.cos(a) * r, 0.75 + (i % 5) * 0.09, Math.sin(a) * r);
    l.rotation.set((i % 2 ? 0.4 : -0.3), -a, 0.5);
    l.castShadow = true; g.add(l);
  }
  g.scale.setScalar(scale);
  g.position.set(x, h, -y);
  root.add(g);
  return g;
}

// mirror (real-time reflection)
const Mi = DIM.mirror;
const mirror = new Reflector(new THREE.PlaneGeometry(Mi.y1 - Mi.y0, Mi.h1 - Mi.h0), {
  textureWidth: isTouch ? 768 : 1280, textureHeight: isTouch ? 384 : 640, color: 0xd9dedd, clipBias: 0.003,
});
mirror.rotation.y = Math.PI / 2;
mirror.position.set(0.035, (Mi.h0 + Mi.h1) / 2, -(Mi.y0 + Mi.y1) / 2);
root.add(mirror);
// sconces mounted on the mirror
const sconceYs = [0.95, 4.25, 7.55];
const mirrorSconces = new THREE.Group(); root.add(mirrorSconces);
for (const y of sconceYs) {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.55, 24), M.sconce);
  c.position.set(0.2, 5.65, -y); mirrorSconces.add(c);
  B(0.04, 0.14, y - 0.03, y + 0.03, 5.0, 6.3, M.pull, mirrorSconces);
  const pl = new THREE.PointLight(0xffe2bf, 0.9, 9, 2);
  pl.position.set(0.45, 5.65, -y); root.add(pl);
}
// towel bar on north wall, towel ring on partition
B(0.7, 2.0, D - 0.1, D - 0.04, 4.85, 4.93, M.fixture);
{
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 8, 30), M.fixture);
  ring.position.set(1.25, 4.3, -0.06); root.add(ring);
  const tw = B(1.0, 1.5, 0.04, 0.12, 3.4, 4.3, M.towel);
  tw.userData.after = true;
}

// vanity LED (after)
const ledStrip = B(vx1 - 0.25, vx1 - 0.15, vy0 + 0.1, vy1 - 0.1, Va.bottom - 0.02, Va.bottom, M.led, root, { cast: false });
const ledLight = new THREE.RectAreaLight(0xffb87a, 9, Va.len - 0.3, 0.35);
ledLight.position.set(vx1 - 0.3, Va.bottom - 0.03, -(vy0 + vy1) / 2);
ledLight.rotation.x = -Math.PI / 2;
ledLight.rotation.z = Math.PI / 2;
root.add(ledLight);

// ---------------------------------------------------------------------------
// Concept pieces: twin mirrors, wall sconces, wainscot, backsplash, shades, rug
// ---------------------------------------------------------------------------
const mirrorSets = { single: mirror };
function twinMirrors(kind) {
  const g = new THREE.Group(); root.add(g);
  for (const sy of Va.sinks) {
    let geo, frame;
    const cx = 0.045;
    if (kind === 'round2') {
      const r = 1.2, ch = 5.85;
      geo = new THREE.CircleGeometry(r, 72);
      frame = new THREE.Mesh(new THREE.TorusGeometry(r + 0.02, 0.035, 10, 90), M.fixture);
      frame.rotation.y = Math.PI / 2; frame.position.set(cx, ch, -sy); g.add(frame);
      const m = new Reflector(geo, { textureWidth: isTouch ? 512 : 1024, textureHeight: isTouch ? 512 : 1024, color: 0xd9dedd, clipBias: 0.003 });
      m.rotation.y = Math.PI / 2; m.position.set(cx, ch, -sy); g.add(m);
      continue;
    }
    const w = 2.0, h0 = 4.45, h1 = 7.2;
    const shape = new THREE.Shape();
    const inner = (sh, pad) => {
      const hw = w / 2 + pad;
      sh.moveTo(-hw, -pad);
      sh.lineTo(hw, -pad);
      if (kind === 'arch2') { const top = h1 - h0 - hw; sh.lineTo(hw, top); sh.absarc(0, top, hw, 0, Math.PI, false); }
      else { sh.lineTo(hw, h1 - h0 + pad); sh.lineTo(-hw, h1 - h0 + pad); }
      sh.lineTo(-hw, -pad);
      return sh;
    };
    inner(shape, 0);
    const m = new Reflector(new THREE.ShapeGeometry(shape, 48), { textureWidth: isTouch ? 512 : 1024, textureHeight: isTouch ? 640 : 1280, color: 0xd9dedd, clipBias: 0.003 });
    m.rotation.y = Math.PI / 2; m.position.set(cx, h0, -sy); g.add(m);
    const outer = inner(new THREE.Shape(), 0.06);
    outer.holes.push(new THREE.Path(inner(new THREE.Shape(), 0).getPoints(64)));
    const fr = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: 0.06, bevelEnabled: false, curveSegments: 48 }), kind === 'rect2' ? M.frame : M.fixture);
    fr.rotation.y = Math.PI / 2; fr.position.set(0.0, h0, -sy); fr.castShadow = true; g.add(fr);
  }
  return g;
}
mirrorSets.rect2 = twinMirrors('rect2');
mirrorSets.round2 = twinMirrors('round2');
mirrorSets.arch2 = twinMirrors('arch2');

const wallSconces = {};
{
  const ys = [0.9, 4.25, 7.6];
  const cyl = new THREE.Group(), drum = new THREE.Group(), globe = new THREE.Group();
  for (const y of ys) {
    B(0.0, 0.05, y - 0.08, y + 0.08, 5.3, 6.5, M.fixture, cyl);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.1, 24), M.sconce); c.position.set(0.22, 5.9, -y); cyl.add(c);
    B(0.05, 0.22, y - 0.03, y + 0.03, 5.85, 5.95, M.fixture, cyl);
    B(0.0, 0.05, y - 0.07, y + 0.07, 5.65, 5.95, M.fixture, drum);
    B(0.05, 0.3, y - 0.02, y + 0.02, 5.78, 5.82, M.fixture, drum);
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.42, 28, 1, true), M.drum); d.position.set(0.38, 5.95, -y); drum.add(d);
    B(0.0, 0.05, y - 0.07, y + 0.07, 5.7, 5.9, M.fixture, globe);
    B(0.05, 0.25, y - 0.02, y + 0.02, 5.78, 5.82, M.fixture, globe);
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.26, 28, 18), M.sconce); s.position.set(0.42, 5.8, -y); globe.add(s);
  }
  Object.assign(wallSconces, { cyl, drum, globe });
  Object.values(wallSconces).forEach((g) => root.add(g));
}

const wainscot = wallPlane('N', 0, S.x0, 0, DIM.window.sill - 0.3, M.tileAccent, 0.013, wallGroups.N);
const backsplash = wallPlane('W', vy0, vy1, Va.top, Va.top + 1.5, M.backsplash, 0.07);
const shade = B(DIM.window.x0 + 0.1, DIM.window.x1 - 0.1, D + 0.03, D + 0.07, DIM.window.head - 1.7, DIM.window.head - 0.05, M.shade, wallGroups.N);
const shadeRail = B(DIM.window.x0 + 0.1, DIM.window.x1 - 0.1, D + 0.02, D + 0.08, DIM.window.head - 1.75, DIM.window.head - 1.68, M.trim, wallGroups.N);
const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 5.6), M.rug);
rug.rotation.x = -Math.PI / 2; rug.position.set(3.35, 0.012, -(vy0 + vy1) / 2); rug.receiveShadow = true; root.add(rug);

// ---------------------------------------------------------------------------
// Shower
// ---------------------------------------------------------------------------
const showerFloor = new THREE.Mesh(new THREE.PlaneGeometry(W - S.x0 - S.curbW, D - benchY1), showerFloorMat);
showerFloor.rotation.x = -Math.PI / 2;
showerFloor.position.set((S.x0 + S.curbW + W) / 2, 0.025, -(benchY1 + D) / 2);
showerFloor.receiveShadow = true; showerFloor.name = 'floor';
root.add(showerFloor);
// tile walls
wallPlane('N', S.x0, W, 0, H, veinMat(W - S.x0, H), 0.01, wallGroups.N);
wallPlane('E', S.y0, D, 0, H, veinMat(D - S.y0, H), 0.01, wallGroups.E);
// tiled pilaster at the door hinge
B(S.x0, S.x0 + 0.35, D - 0.3, D, 0, H, veinMat(0.35, H));
// bench + curb
B(S.x0, W, S.y0, benchY1, 0, S.benchH - 0.08, veinMat(W - S.x0, S.benchH));
const benchCap = B(S.x0 - 0.03, W, S.y0 - 0.03, benchY1, S.benchH - 0.08, S.benchH, capMat);
B(S.x0, S.x0 + S.curbW, benchY1, D - 0.3, 0, S.curbH - 0.06, veinMat(D - benchY1, S.curbH));
const curbCap = B(S.x0 - 0.02, S.x0 + S.curbW + 0.02, benchY1, D - 0.3, S.curbH - 0.06, S.curbH, capMat);
// linear drain (after) / square drain (before)
const linearDrain = B(S.x0 + 0.7, W - 0.4, D - 0.42, D - 0.32, 0.026, 0.04, M.fixture, root, { cast: false });
const squareDrain = B(8.3, 8.6, 5.8, 6.1, 0.026, 0.035, M.pull, root, { cast: false });
// glass
const gx = S.x0 + S.curbW / 2;
const glassMeshes = [];
function glassPanel(x0, x1, y0, y1, h0, h1) {
  const m = B(x0, x1, y0, y1, h0, h1, M.glass, root, { cast: false });
  m.renderOrder = 2; glassMeshes.push(m); return m;
}
glassPanel(gx - 0.02, gx + 0.02, S.y0 + 0.05, benchY1, S.benchH, S.glassTop);
glassPanel(gx - 0.02, gx + 0.02, benchY1, S.doorY - 0.03, S.curbH, S.glassTop);
glassPanel(gx - 0.02, gx + 0.02, S.doorY, D - 0.32, S.curbH + 0.05, S.glassTop);
glassPanel(S.x0 + 0.02, W - 0.02, S.y0 + 0.12, S.y0 + 0.16, S.benchH, S.glassTop);
// clamps, hinges, handle
for (const [x, y, h] of [[gx, S.y0 + 0.2, S.benchH + 0.05], [gx, benchY1 + 0.25, S.curbH + 0.05], [S.x0 + 0.5, S.y0 + 0.14, S.benchH + 0.05], [W - 0.3, S.y0 + 0.14, S.benchH + 0.05], [gx, D - 0.32, 1.2], [gx, D - 0.32, 6.4]]) {
  B(x - 0.06, x + 0.06, y - 0.06, y + 0.06, h - 0.09, h + 0.09, M.fixture);
}
B(gx - 0.45, gx + 0.45, S.doorY + 0.3, S.doorY + 0.34, 3.6, 3.66, M.fixture); // towel-bar handle through door
// shower fixtures (north wall interior)
{
  const y = D - 0.05;
  const arm = B(7.05, 7.15, y - 0.55, y, 6.85, 6.95, M.fixture);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.06, 32), M.fixture);
  head.position.set(7.1, 6.8, -(y - 0.6)); root.add(head);
  B(6.85, 7.35, y - 0.05, y, 3.75, 4.25, M.fixture); // valve trim
  B(7.06, 7.14, y - 0.3, y - 0.05, 3.9, 3.96, M.fixture);
  for (const [x, h] of [[7.1, 4.75], [7.1, 5.2], [7.9, 4.6], [7.9, 3.7]]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 20), M.fixture);
    r.rotation.x = Math.PI / 2; r.position.set(x, h, -(y - 0.03)); root.add(r);
  }
  // hand shower on east wall
  const ex = W - 0.05;
  B(ex - 0.06, ex, 6.1 - 0.03, 6.1 + 0.03, 3.6, 6.6, M.fixture);
  B(ex - 0.32, ex - 0.06, 6.1 - 0.04, 6.1 + 0.04, 5.5, 6.25, M.fixture);
  const hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(ex - 0.2, 5.5, 6.1), V(ex - 0.15, 3.6, 6.0), V(ex - 0.1, 3.0, 6.4), V(ex - 0.1, 3.6, 6.7), V(ex - 0.05, 4.1, 6.75)]), 40, 0.02, 6), M.fixture);
  root.add(hose);
}
// niche on east wall
const nicheY0 = 7.0, nicheY1 = 7.8, nicheH0 = 3.6, nicheH1 = 5.0;
const nicheBack = new THREE.Mesh(new THREE.PlaneGeometry(nicheY1 - nicheY0, nicheH1 - nicheH0), M.board);
nicheBack.position.set(W - 0.02, (nicheH0 + nicheH1) / 2, -(nicheY0 + nicheY1) / 2);
nicheBack.rotation.y = -Math.PI / 2;
root.add(nicheBack);
const nicheAfter = new THREE.Group();
root.add(nicheAfter);
{
  const back = new THREE.Mesh(new THREE.PlaneGeometry(nicheY1 - nicheY0, nicheH1 - nicheH0), veinMat(0.8, 1.4));
  back.position.set(W - 0.012, (nicheH0 + nicheH1) / 2, -(nicheY0 + nicheY1) / 2);
  back.rotation.y = -Math.PI / 2; nicheAfter.add(back);
  B(W - 0.3, W - 0.02, nicheY0, nicheY1, nicheH1 - 0.03, nicheH1, M.led, nicheAfter, { cast: false });
  B(W - 0.32, W - 0.01, nicheY0, nicheY1, nicheH0 - 0.05, nicheH0, capMat, nicheAfter);
  for (const dy of [0.25, 0.5]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.42, 16), M.amber);
    b.position.set(W - 0.15, nicheH0 + 0.21, -(nicheY0 + dy)); nicheAfter.add(b);
  }
  const nl = new THREE.PointLight(0xffc98f, 0.6, 3, 2);
  nl.position.set(W - 0.4, nicheH1 - 0.2, -(nicheY0 + nicheY1) / 2); nicheAfter.add(nl);
}

const nicheLinear = new THREE.Group(); root.add(nicheLinear);
{
  const y0 = benchY1 + 0.3, y1 = D - 0.4, h0 = 4.3, h1 = 5.0;
  B(W - 0.34, W - 0.01, y0, y1, h0 - 0.06, h0, capMat, nicheLinear);
  B(W - 0.34, W - 0.01, y0, y1, h1, h1 + 0.04, capMat, nicheLinear);
  B(W - 0.3, W - 0.27, y0, y1, h1 - 0.04, h1, M.led, nicheLinear, { cast: false });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(y1 - y0, h1 - h0), new THREE.MeshStandardMaterial({ color: 0xcdbfae, roughness: 0.6 }));
  back.rotation.y = -Math.PI / 2; back.position.set(W - 0.008, (h0 + h1) / 2, -(y0 + y1) / 2); nicheLinear.add(back);
  for (const dy of [0.4, 0.62]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.42, 16), M.amber);
    b.position.set(W - 0.16, h0 + 0.21, -(y0 + dy)); nicheLinear.add(b);
  }
  const nl = new THREE.RectAreaLight(0xffc98f, 4, y1 - y0, 0.2);
  nl.position.set(W - 0.2, h1 - 0.05, -(y0 + y1) / 2); nl.rotation.x = -Math.PI / 2; nl.rotation.z = Math.PI / 2; nicheLinear.add(nl);
}

// ---------------------------------------------------------------------------
// Toilet nook, barn door
// ---------------------------------------------------------------------------
{
  const t = DIM.toilet;
  const body = B(t.x - 0.25, W - 0.05, t.y - 0.62, t.y + 0.62, 0, 1.3, M.porcelain, root, { rounded: 0.28 });
  B(t.x - 0.3, W - 0.15, t.y - 0.6, t.y + 0.6, 1.3, 1.42, M.porcelain, root, { rounded: 0.05 });
  B(t.x + 0.6, W - 0.05, t.y - 0.6, t.y + 0.6, 1.42, 2.1, M.porcelain, root, { rounded: 0.2 });
  // TP holder & panel on south wall
  B(9.1, 9.3, 0.04, 0.12, 2.35, 2.45, M.fixture);
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.35, 24), M.towel);
  roll.rotation.x = Math.PI / 2; roll.position.set(9.2, 2.2, -0.25); root.add(roll);
  B(9.0, 9.45, 0.02, 0.06, 3.6, 4.15, M.trim);
  // bin + plant (after)
  const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.9, 24), M.black);
  bin.position.set(10.6, 0.45, -0.45); root.add(bin); bin.userData.after = true;
}
// Barn door parked east of the opening
const barn = new THREE.Group();
wallGroups.S.add(barn); // hides with the south wall in the dollhouse cutaway
{
  const x0 = Dw.x1 + 0.1, x1 = x0 + 3.3, y0 = 0.18, y1 = 0.32, h1 = 7.2;
  const st = 0.42;
  B(x0, x0 + st, y0, y1, 0.05, h1, M.trim, barn);
  B(x1 - st, x1, y0, y1, 0.05, h1, M.trim, barn);
  B(x0, x1, y0, y1, h1 - st, h1, M.trim, barn);
  B(x0, x1, y0, y1, 0.05, 0.75, M.trim, barn);
  B(x0 + st, x1 - st, y0 + 0.05, y1 - 0.05, 0.75, h1 - st, M.frosted, barn, { cast: false });
  B(x0 + 0.1, x0 + 0.2, y1, y1 + 0.03, 3.2, 3.7, M.pull, barn);
  // rail
  B(Dw.x0 - 0.3, x1 + 0.3, 0.05, 0.1, 7.45, 7.65, M.black, barn);
  for (const x of [x0 + 0.3, x1 - 0.3]) {
    B(x - 0.08, x + 0.08, 0.1, 0.2, 6.8, 7.75, M.black, barn);
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 20), M.black);
    w.rotation.x = Math.PI / 2; w.position.set(x, 7.75, -0.17); barn.add(w);
  }
}
// switch plate near doorway
B(Dw.x1 + 3.6, Dw.x1 + 4.1, 0.0, 0.03, 4.0, 4.4, M.trim);

// threshold (after)
const threshold = B(Dw.x0, Dw.x1, -0.12, 0.02, 0, 0.02, M.black, root, { cast: false });

// ---------------------------------------------------------------------------
// Ceiling fixtures & lights
// ---------------------------------------------------------------------------
const cans = [[3.8, 2.0], [3.8, 6.2], [8.5, 6.2], [9.6, 1.6], [6.8, 2.2]];
for (const [x, y] of cans) {
  const d = new THREE.Mesh(new THREE.CircleGeometry(0.22, 24), M.can);
  d.rotation.x = Math.PI / 2; d.position.set(x, H - 0.01, -y); root.add(d);
  const r = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 24), M.trim);
  r.rotation.x = Math.PI / 2; r.position.set(x, H - 0.012, -y); root.add(r);
  const pl = new THREE.PointLight(0xfff1df, 2.6, 16, 1.6);
  pl.position.set(x, H - 0.4, -y); root.add(pl);
}
// exhaust fan grille
B(5.6, 6.4, 0.6, 1.4, H - 0.03, H, M.trim);

const hemi = new THREE.HemisphereLight(0xfffaf2, 0xd8d0c4, 0.35);
scene.add(hemi);
// daylight through the window (casts the window patch onto the floor)
const sun = new THREE.DirectionalLight(0xfff6e8, 2.2);
sun.position.set(3.0, 14, -(D + 9));
sun.target.position.set(4.0, 0, -(D - 3.5));
sun.castShadow = true;
sun.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
sun.shadow.bias = -0.0008;
sun.shadow.radius = 4;
scene.add(sun, sun.target);
// key ceiling spot for soft contact shadows
const key = new THREE.SpotLight(0xfff0dc, 9, 22, 1.2, 0.8, 1.4);
key.position.set(5.5, H - 0.3, -4.2);
key.target.position.set(5.5, 0, -4.2);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.bias = -0.0006;
scene.add(key, key.target);

// ---------------------------------------------------------------------------
// Bedroom beyond (context)
// ---------------------------------------------------------------------------
{
  const g = new THREE.Group(); g.name = 'bedroom'; root.add(g);
  const bfMat = new THREE.MeshStandardMaterial({ roughness: 0.5 }); applyTex(bfMat, 'floor_oak_bedroom', 16, 12);
  const bf = new THREE.Mesh(new THREE.PlaneGeometry(16, 12), bfMat);
  bf.rotation.x = -Math.PI / 2; bf.position.set(5, 0, 6.4); bf.receiveShadow = true; g.add(bf);
  B(-3, 13, -12.4, -12, 0, H + 1, M.oakWall, g);
  B(-3.4, -3, -12.4, -T, 0, H + 1, M.oakWall, g);
  B(13, 13.4, -12.4, -T, 0, H + 1, M.oakWall, g);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(16.4, 12.4), M.ceiling);
  top.rotation.x = Math.PI / 2; top.position.set(5, H + 1, 6.2); g.add(top);
  B(-2.9, 2.2, -9.5, -3.5, 0, 2.0, M.bed, g, { rounded: 0.2 });
  B(-3.0, -2.7, -9.5, -3.5, 0, 4.0, M.bed, g, { rounded: 0.1 });
  B(-2.8, -1.0, -3.4, -1.8, 0, 2.0, M.wood, g);
  B(5.5, 8.0, -10.5, -8.2, 0, 2.6, M.chair, g, { rounded: 0.3 });
  const bl = new THREE.PointLight(0xfff0dd, 6, 20, 1.5);
  bl.position.set(4, H - 0.5, 6); g.add(bl);
  g.attach(addPlant(1.0, 0, -1.2, 2.2));
}
// bathroom plants
addPlant(10.55, 0, 0.75, 0.75).userData.after = true;

// ---------------------------------------------------------------------------
// Design state
// ---------------------------------------------------------------------------
const state = { phase: 'after', style: 'minimal', floor: 'greige', finish: 'black', led: true, mode: 'walk' };
const afterOnly = [];
root.traverse((o) => { if (o.userData.after) afterOnly.push(o); });

const FINISHES = {
  black: { color: 0x1d1d1d, metalness: 0.35, roughness: 0.48, label: 'Matte black' },
  chrome: { color: 0xf2f2f2, metalness: 1, roughness: 0.1, label: 'Polished chrome' },
  nickel: { color: 0xe3dccf, metalness: 1, roughness: 0.2, label: 'Polished nickel' },
  brass: { color: 0xc9a46a, metalness: 1, roughness: 0.32, label: 'Brushed brass' },
};
function setMap(mat, key, w, h) { applyTex(mat, key, w, h); }
function applyDesign() {
  const after = state.phase === 'after';
  const st = after ? STYLES[state.style] : { ...STYLES.minimal, showerWall: 'wall_veincut', mirror: 'single', sconce: 'mirror', faucet: 'deck', vanity: 'espresso', pulls: 'steel', wall: 0xefece7, wainscot: null, backsplash: null, shade: null, rug: false };
  const fkey = after ? state.floor : 'original';
  const F = FLOORS[fkey];
  applyTex(floorMat, F.tex, W, D);
  floorMat.roughness = fkey === 'herringbone' ? 0.48 : fkey === 'original' ? 0.38 : fkey === 'terrazzo' ? 0.35 : 0.6;
  floorMat.needsUpdate = true;
  const sw = W - S.x0 - S.curbW, sd = D - benchY1;
  const showerFloorKey = after && state.style === 'japandi' ? 'floor_ivory' : F.shower;
  applyTex(showerFloorMat, showerFloorKey, sw, sd);
  const cap = after ? (st.cap ?? F.cap) : null;
  if (cap == null) { applyTex(capMat, 'wall_veincut', 6, 2); }
  else { capMat.map = null; capMat.normalMap = null; capMat.color.set(cap); }
  capMat.needsUpdate = true;
  for (const { m, w, h } of showerWallMats) {
    applyTex(m, st.showerWall, w, h, st.showerWall === 'zellige_white' ? 0.8 : 1);
    m.roughness = st.showerWall === 'zellige_white' || st.showerWall === 'tile_sage' ? 0.18 : 0.42;
    m.needsUpdate = true;
  }

  const fin = FINISHES[after ? state.finish : 'chrome'];
  M.fixture.color.set(fin.color); M.fixture.metalness = fin.metalness; M.fixture.roughness = fin.roughness;
  Object.entries(mirrorSets).forEach(([k, g]) => { g.visible = k === st.mirror; });
  mirrorSconces.visible = st.sconce === 'mirror';
  Object.entries(wallSconces).forEach(([k, g]) => { g.visible = k === st.sconce; });
  deckFaucets.visible = st.faucet === 'deck'; wallFaucets.visible = st.faucet === 'wall';
  if (st.vanity === 'oak') { vanityFrontMat.map = tex('oak_fluted'); vanityFrontMat.normalMap = texN('oak_fluted'); vanityFrontMat.color.set(0xffffff); vanityFrontMat.roughness = 0.6; }
  else { vanityFrontMat.map = null; vanityFrontMat.normalMap = null; vanityFrontMat.color.set(0x241c19); vanityFrontMat.roughness = 0.45; }
  vanityFrontMat.needsUpdate = true;
  M.vanity.color.set(st.vanity === 'oak' ? 0x9c7a55 : 0x241c19);
  vanityPulls.forEach((p) => { p.visible = st.pulls !== 'none'; });
  M.vpull.color.set(st.pulls === 'brass' ? 0xc9a46a : 0xc9c9c9);
  M.wall.color.set(st.wall);
  wainscot.visible = !!st.wainscot; if (st.wainscot) setMap(M.tileAccent, st.wainscot, S.x0, DIM.window.sill);
  backsplash.visible = !!st.backsplash; if (st.backsplash) setMap(M.backsplash, st.backsplash, Va.len, 1.5);
  shade.visible = shadeRail.visible = !!st.shade; if (st.shade) { M.shade.map = tex(st.shade); M.shade.needsUpdate = true; }
  rug.visible = !!st.rug; if (st.rug) { M.rug.map = tex('rug_runner'); M.rug.needsUpdate = true; }

  const ledOn = after && state.led;
  ledStrip.visible = ledOn; ledLight.visible = ledOn;
  linearDrain.visible = after; squareDrain.visible = !after;
  nicheAfter.visible = after && st.niche === 'small'; nicheLinear.visible = after && st.niche === 'linear'; nicheBack.visible = !after;
  threshold.visible = after;
  afterOnly.forEach((o) => { o.visible = after; });

  $('#specTitle').textContent = after ? `${STYLES[state.style].name} · ${F.title}` : F.title;
  $('#specText').textContent = after ? `${STYLES[state.style].desc} Fixtures: ${fin.label.toLowerCase()}.` : F.spec;
  const pressed = (sel, fn) => document.querySelectorAll(sel).forEach((b) => b.setAttribute('aria-pressed', String(fn(b))));
  pressed('[data-style]', (b) => after && b.dataset.style === state.style);
  pressed('[data-floor]', (b) => after && b.dataset.floor === state.floor);
  pressed('[data-phase]', (b) => b.dataset.phase === state.phase);
  pressed('[data-finish]', (b) => after && b.dataset.finish === state.finish);
  $('#ledBtn').setAttribute('aria-pressed', String(state.led));
  document.body.classList.toggle('is-before', !after);
  onSceneChanged();
}
function setStyle(key) {
  const st = STYLES[key];
  Object.assign(state, { phase: 'after', style: key, floor: st.floor, finish: st.finish, led: st.led });
  applyDesign();
}

// ---------------------------------------------------------------------------
// Dimension labels (dollhouse)
// ---------------------------------------------------------------------------
const labels = new THREE.Group();
scene.add(labels);
function ftin(v) { const ft = Math.floor(v + 1e-6); const inch = Math.round((v - ft) * 12); return inch === 12 ? `${ft + 1}′-0″` : `${ft}′-${inch}″`; }
function label(text, pos, cls = '') {
  const el = document.createElement('div'); el.className = `dim ${cls}`; el.textContent = text;
  const o = new CSS2DObject(el); o.position.copy(pos); labels.add(o); return o;
}
label(`${ftin(W)} wide`, V(W / 2, 0.1, -0.9));
label(`${ftin(D)} deep`, V(-1.2, 0.1, D / 2));
label(`Vanity ${ftin(Va.len)}`, V(vx1 + 0.4, Va.top + 0.4, (vy0 + vy1) / 2), 'small');
label(`Shower ${ftin(W - S.x0)} × ${ftin(D - S.y0)}`, V((S.x0 + W) / 2, 0.3, (benchY1 + D) / 2), 'small');
label(`Door ${ftin(Dw.x1 - Dw.x0)}`, V((Dw.x0 + Dw.x1) / 2, 0.2, 0.6), 'small');
label(`Ceiling ${ftin(H)}`, V(W + 0.5, H, D + 0.5), 'small');
label(`Floor ≈ ${Math.round(W * D - (W - S.x0) * (D - S.y0))} sq ft + shower ≈ ${Math.round((W - S.x0 - S.curbW) * (D - benchY1))} sq ft`, V(4.2, 0.1, 3.2), 'area');
labels.visible = false;

// ---------------------------------------------------------------------------
// Camera control: walk (first-person, tap-to-move) & dollhouse (orbit)
// ---------------------------------------------------------------------------
const SPOTS = {
  entry: { x: 3.9, y: 0.95, yaw: 0.45, pitch: -0.36, label: 'Entry' },
  vanity: { x: 5.35, y: 4.6, yaw: Math.PI / 2 - 0.12, pitch: -0.28, label: 'Vanity' },
  window: { x: 3.7, y: 2.4, yaw: -0.05, pitch: -0.3, label: 'Window' },
  shower: { x: 3.3, y: 1.6, yaw: -0.72, pitch: -0.3, label: 'Shower' },
  inside: { x: 6.75, y: 7.75, yaw: -2.35, pitch: -0.32, label: 'In the shower' },
  toilet: { x: 6.3, y: 1.65, yaw: -Math.PI / 2, pitch: -0.36, label: 'Toilet nook' },
  door: { x: 4.6, y: 3.6, yaw: Math.PI - 0.12, pitch: -0.26, label: 'Barn door' },
};
const look = { yaw: SPOTS.entry.yaw, pitch: SPOTS.entry.pitch };
const pos = new THREE.Vector3(SPOTS.entry.x, DIM.eye, -SPOTS.entry.y);
let tween = null;

function clampWalk(x, y) {
  x = THREE.MathUtils.clamp(x, vx1 + 0.55, W - 0.55);
  y = THREE.MathUtils.clamp(y, 0.55, D - 0.55);
  if (x > S.x0 - 0.4 && y > S.y0 - 0.45 && y < benchY1 + 0.35) y = (y < (S.y0 + benchY1) / 2) ? S.y0 - 0.45 : benchY1 + 0.35;
  if (x > DIM.toilet.x - 0.9 && y < DIM.toilet.y + 1.0) x = DIM.toilet.x - 0.9;
  return [x, y];
}

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enabled = false;
orbit.enableDamping = true;
orbit.target.set(W / 2, 1.5, -D / 2);
orbit.minDistance = 8; orbit.maxDistance = 40;
orbit.maxPolarAngle = Math.PI * 0.46;
orbit.addEventListener('change', requestRender);

function setMode(mode) {
  state.mode = mode;
  ptDirty = true;
  stopAuto();
  document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  document.body.classList.toggle('is-doll', mode === 'doll');
  if (mode === 'doll') {
    orbit.enabled = true;
    camera.fov = 45; camera.updateProjectionMatrix();
    camera.position.set(W / 2 - 5, 20, 8.5);
    orbit.target.set(W / 2, 1.0, -D / 2);
    orbit.update();
    ceiling.visible = false; labels.visible = true; root.getObjectByName('bedroom').visible = false;
  } else {
    orbit.enabled = false;
    camera.fov = baseFov; camera.updateProjectionMatrix();
    ceiling.visible = true; labels.visible = false; root.getObjectByName('bedroom').visible = true;
    Object.values(wallGroups).forEach((g) => { g.visible = true; });
  }
  ring.visible = false;
  requestRender();
}

function goTo(spotKey, dur = 1100) {
  const s = SPOTS[spotKey];
  if (state.mode !== 'walk') setMode('walk');
  const from = { x: pos.x, y: -pos.z, yaw: look.yaw, pitch: look.pitch };
  let dyaw = s.yaw - from.yaw;
  dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
  tween = { t0: performance.now(), dur, from, to: { x: s.x, y: s.y, yaw: from.yaw + dyaw, pitch: s.pitch } };
  document.querySelectorAll('[data-spot]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.spot === spotKey)));
  requestRender();
}
function walkTo(x, y) {
  [x, y] = clampWalk(x, y);
  const d = Math.hypot(x - pos.x, y + pos.z);
  tween = { t0: performance.now(), dur: THREE.MathUtils.clamp(d * 160, 350, 1100), from: { x: pos.x, y: -pos.z, yaw: look.yaw, pitch: look.pitch }, to: { x, y, yaw: look.yaw, pitch: look.pitch } };
  document.querySelectorAll('[data-spot]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  requestRender();
}
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// floor target ring
const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }));
ring.rotation.x = -Math.PI / 2; ring.visible = false; ring.renderOrder = 5;
scene.add(ring);

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const pickables = [floor, showerFloor];
function floorHit(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(pickables, false);
  return hits[0] || null;
}

// pointer handling (works for touch, pen and mouse)
const pointers = new Map();
let drag = null, pinch0 = 0, fov0 = 0;
const el = renderer.domElement;
el.addEventListener('pointerdown', (e) => {
  el.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  stopAuto(); hideHint();
  if (state.mode !== 'walk') return;
  if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: 0 };
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); fov0 = camera.fov; drag = null; }
});
el.addEventListener('pointermove', (e) => {
  if (state.mode !== 'walk') return;
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2 && pinch0) {
    const [a, b] = [...pointers.values()];
    camera.fov = THREE.MathUtils.clamp(fov0 * (pinch0 / Math.hypot(a.x - b.x, a.y - b.y)), 35, 95);
    camera.updateProjectionMatrix(); requestRender(); return;
  }
  if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    const k = (camera.fov / baseFov) * (isTouch ? 0.006 : 0.0042);
    look.yaw += dx * k; look.pitch = THREE.MathUtils.clamp(look.pitch + dy * k, -1.25, 1.1);
    tween = null; requestRender();
  } else if (e.pointerType === 'mouse') {
    const h = floorHit(e);
    ring.visible = !!h;
    if (h) { const [x, y] = clampWalk(h.point.x, -h.point.z); ring.position.set(x, h.object === showerFloor ? 0.04 : 0.012, -y); }
    requestRender();
  }
});
function endPointer(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch0 = 0;
  if (state.mode === 'walk' && drag && pointers.size === 0) {
    const tap = drag.moved < 8 && performance.now() - drag.t < 450;
    if (tap) {
      const h = floorHit(e);
      if (h) {
        const [x, y] = clampWalk(h.point.x, -h.point.z);
        ring.position.set(x, 0.03, -y); ring.visible = true;
        setTimeout(() => { if (e.pointerType !== 'mouse') { ring.visible = false; requestRender(); } }, 700);
        walkTo(x, y);
      }
    }
    drag = null;
  }
}
el.addEventListener('pointerup', endPointer);
el.addEventListener('pointercancel', endPointer);
el.addEventListener('pointerleave', () => { if (!isTouch) { ring.visible = false; requestRender(); } });
el.addEventListener('wheel', (e) => {
  if (state.mode !== 'walk') return;
  e.preventDefault();
  camera.fov = THREE.MathUtils.clamp(camera.fov + e.deltaY * 0.03, 35, 90);
  camera.updateProjectionMatrix(); requestRender();
}, { passive: false });
el.addEventListener('dblclick', (e) => e.preventDefault());

// keyboard (desktop)
const keys = new Set();
addEventListener('keydown', (e) => { if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) { keys.add(e.code); stopAuto(); hideHint(); requestRender(); } });
addEventListener('keyup', (e) => keys.delete(e.code));

// auto tour
const tourOrder = ['entry', 'vanity', 'window', 'shower', 'inside', 'toilet', 'door'];
let autoTimer = null;
function startAuto() {
  let i = 0;
  const step = () => { goTo(tourOrder[i % tourOrder.length], 1800); i++; autoTimer = setTimeout(step, 4200); };
  $('#autoBtn').setAttribute('aria-pressed', 'true');
  step();
}
function stopAuto() { if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; $('#autoBtn').setAttribute('aria-pressed', 'false'); } }

// ---------------------------------------------------------------------------
// Render loop (renders on demand to save battery)
// ---------------------------------------------------------------------------
let needsRender = true;
let onSceneChanged = () => { ptDirty = true; requestRender(); };
function requestRender() { needsRender = true; }

// Raster pipeline (used while moving): scene + ground-truth-style ambient occlusion
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, canvasWrap.clientWidth, canvasWrap.clientHeight);
gtao.updateGtaoMaterial({ radius: 1.1, distanceExponent: 1.4, thickness: 1.5, scale: 1.15, samples: isTouch ? 8 : 16, distanceFallOff: 1, screenSpaceRadius: false });
gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: isTouch ? 8 : 16 });
composer.addPass(gtao);
composer.addPass(new OutputPass());

// Photo mode: when the view is still, progressively path-trace it
// (global illumination, soft shadows, true reflections and glass)
const PT_MAX = isTouch ? 220 : 900;
let pt = null, ptOn = false, ptDirty = true, ptSupported = true, idleAt = performance.now();
let photoMode = true;
const ptMirrorMat = new THREE.MeshStandardMaterial({ color: 0xeef1f1, metalness: 1, roughness: 0.01 });
const reflectors = [];
scene.traverse((o) => { if (o.isReflector) reflectors.push(o); });
const ptBadge = $('#ptBadge');
function swapForPT(on) {
  for (const r of reflectors) {
    if (on) { r.userData.rmat ??= r.material; r.material = ptMirrorMat; } else if (r.userData.rmat) r.material = r.userData.rmat;
  }
  // emissive surfaces are hard for a path tracer to sample; let the real lights do the work
  const em = on ? { can: 0.7, sconce: 0.45, led: 1.2, drum: 0.4 } : { can: 2.2, sconce: 1.0, led: 3, drum: 0.9 };
  M.can.emissiveIntensity = em.can; M.sconce.emissiveIntensity = em.sconce; M.led.emissiveIntensity = em.led; M.drum.emissiveIntensity = em.drum;
  renderer.toneMappingExposure = on ? 1.5 : 0.82;
  if (on) {
    // thin glass: stochastic transparency lets light (and shadow rays) through, like real 3/8" panels
    Object.assign(M.glass, { transmission: 0, opacity: 0.1, transparent: true, roughness: 0.0 });
    Object.assign(M.frosted, { transmission: 1, opacity: 1, transparent: false, roughness: 0.45, ior: 1.5, thickness: 0.05 });
    scene.environment = null;
  } else {
    Object.assign(M.glass, { transmission: 0, opacity: 0.13, transparent: true, roughness: 0.03 });
    Object.assign(M.frosted, { transmission: 0, opacity: 0.86, transparent: true, roughness: 0.55 });
    scene.environment = envTex;
  }
  M.glass.needsUpdate = M.frosted.needsUpdate = true;
}
function enterPT() {
  try {
    if (!pt) {
      pt = new WebGLPathTracer(renderer);
      pt.tiles.set(isTouch ? 3 : 2, isTouch ? 3 : 2);
      pt.renderScale = isTouch ? 0.5 : Math.min(1, 1.5 / renderer.getPixelRatio());
      pt.bounces = 5;
      pt.transmissiveBounces = 8;
      pt.filterGlossyFactor = 0.35;
      pt.minSamples = isTouch ? 16 : 28; // keep showing the live view until the photo is clean enough
      pt.fadeDuration = 450;
      pt.renderDelay = 0;
      pt.dynamicLowRes = false;
    }
    swapForPT(true);
    if (ptDirty) { pt.setScene(scene, camera); ptDirty = false; }
    else { pt.updateMaterials(); pt.updateCamera(); }
    ptOn = true;
    ptBadge.classList.add('show');
  } catch (e) {
    console.warn('Photo mode unavailable on this device:', e);
    ptSupported = false; swapForPT(false); ptBadge.classList.remove('show');
  }
}
function exitPT() {
  if (!ptOn) return;
  ptOn = false; swapForPT(false);
  ptBadge.classList.remove('show');
}
const camDir = new THREE.Vector3();
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state.mode === 'walk') {
    if (tween) {
      const t = Math.min(1, (now - tween.t0) / tween.dur), k = ease(t);
      const f = tween.from, to = tween.to;
      pos.x = f.x + (to.x - f.x) * k; pos.z = -(f.y + (to.y - f.y) * k);
      look.yaw = f.yaw + (to.yaw - f.yaw) * k; look.pitch = f.pitch + (to.pitch - f.pitch) * k;
      if (t >= 1) tween = null;
      needsRender = true;
    }
    if (keys.size) {
      const sp = 4.5 * dt;
      const fwd = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const str = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
      const turn = (keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0);
      look.yaw += turn * 1.8 * dt;
      const nx = pos.x - Math.sin(look.yaw) * fwd * sp + Math.cos(look.yaw) * str * sp;
      const ny = -pos.z + Math.cos(look.yaw) * fwd * sp + Math.sin(look.yaw) * str * sp;
      const [cx, cy] = clampWalk(nx, ny);
      pos.x = cx; pos.z = -cy; needsRender = true;
    }
    camera.position.copy(pos);
    camera.rotation.set(look.pitch, look.yaw, 0);
  } else {
    orbit.update();
    // cut away walls between the camera and the room
    camera.getWorldDirection(camDir);
    const cp = camera.position;
    const vis = [cp.z < 0.5, cp.z > -D - 0.5, cp.x > -0.5, cp.x < W + 0.5];
    ['S', 'N', 'W', 'E'].forEach((k, i) => { if (wallGroups[k].visible !== vis[i]) { wallGroups[k].visible = vis[i]; ptDirty = true; } });
  }
  if (needsRender) {
    needsRender = false;
    exitPT();
    composer.render();
    if (labels.visible) labelRenderer.render(scene, camera);
    idleAt = now;
  } else if (photoMode && ptSupported && !ptOn && now - idleAt > 650 && !document.hidden) {
    enterPT();
  }
  if (ptOn && pt.samples < PT_MAX) {
    pt.renderSample();
    const pct = Math.min(100, Math.round((pt.samples / PT_MAX) * 100));
    ptBadge.firstElementChild.textContent = pct >= 100 ? 'Photo render ✓' : `Photo render ${pct}%`;
    ptBadge.style.setProperty('--p', `${pct}%`);
  }
  requestAnimationFrame(frame);
}

function walkFov(aspect) {
  const minH = THREE.MathUtils.degToRad(62);
  const v = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(minH / 2) / aspect));
  return THREE.MathUtils.clamp(Math.max(62, v), 55, 88);
}
let baseFov = 65;
function resize() {
  const w = canvasWrap.clientWidth, h = canvasWrap.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h); labelRenderer.setSize(w, h); composer.setSize(w, h); gtao.setSize(w, h);
  camera.aspect = w / h;
  const nb = walkFov(camera.aspect);
  if (state.mode === 'walk') camera.fov = THREE.MathUtils.clamp(camera.fov + (nb - baseFov), 35, 95);
  baseFov = nb;
  camera.updateProjectionMatrix(); requestRender();
}
addEventListener('resize', resize);
new ResizeObserver(resize).observe(canvasWrap);

// ---------------------------------------------------------------------------
// UI wiring
// ---------------------------------------------------------------------------
document.querySelectorAll('[data-style]').forEach((b) => b.addEventListener('click', () => setStyle(b.dataset.style)));
document.querySelectorAll('[data-floor]').forEach((b) => b.addEventListener('click', () => { state.phase = 'after'; state.floor = b.dataset.floor; applyDesign(); }));
document.querySelectorAll('[data-phase]').forEach((b) => b.addEventListener('click', () => { state.phase = b.dataset.phase; applyDesign(); }));
document.querySelectorAll('[data-finish]').forEach((b) => b.addEventListener('click', () => { state.finish = b.dataset.finish; state.phase = 'after'; applyDesign(); }));
document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
document.querySelectorAll('[data-spot]').forEach((b) => b.addEventListener('click', () => { stopAuto(); goTo(b.dataset.spot); }));
$('#ledBtn').addEventListener('click', () => { state.led = !state.led; state.phase = 'after'; applyDesign(); });
$('#photoBtn').addEventListener('click', () => { photoMode = !photoMode; $('#photoBtn').setAttribute('aria-pressed', String(photoMode)); requestRender(); });
$('#autoBtn').addEventListener('click', () => { if (autoTimer) stopAuto(); else startAuto(); });
$('#moreBtn').addEventListener('click', () => {
  const open = document.body.classList.toggle('sheet-open');
  $('#moreBtn').setAttribute('aria-expanded', String(open));
});

const sheetEl = document.querySelector('.sheet');
new ResizeObserver(() => {
  document.documentElement.style.setProperty('--sheet-h', `${Math.round(sheetEl.getBoundingClientRect().height)}px`);
}).observe(sheetEl);

let hintTimer;
function showHint() {
  const h = $('#hint');
  h.classList.add('show');
  hintTimer = setTimeout(hideHint, 6000);
}
function hideHint() { clearTimeout(hintTimer); $('#hint')?.classList.remove('show'); }

// deep links: tour.html?spot=shower&floor=herringbone&phase=before&mode=doll
const qs = new URLSearchParams(location.search);
if (FLOORS[qs.get('floor')] && qs.get('floor') !== 'original') state.floor = qs.get('floor');
if (qs.get('phase') === 'before') state.phase = 'before';
if (STYLES[qs.get('style')]) { const st = STYLES[qs.get('style')]; Object.assign(state, { style: qs.get('style'), floor: st.floor, finish: st.finish, led: st.led }); }
if (FLOORS[qs.get('floor')] && qs.get('floor') !== 'original') state.floor = qs.get('floor');
applyDesign();
if (qs.get('mode') === 'doll') setMode('doll');
else if (SPOTS[qs.get('spot')]) { const s = SPOTS[qs.get('spot')]; pos.set(s.x, DIM.eye, -s.y); look.yaw = s.yaw; look.pitch = s.pitch; }
requestAnimationFrame(frame);

// expose for debugging / screenshots
window.__tour = { goTo, setMode, state, applyDesign, requestRender, setStyle, get ptSamples() { return pt ? pt.samples : 0; }, get ptOn() { return ptOn; } };
