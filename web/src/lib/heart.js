// Tria: 3D heart and coronary arteries rendered with Three.js.
//
// The anatomy comes from the HuBMAP Human Reference Atlas female heart v1.0 (CC BY 4.0, by Kristen Browne,
// from Visible Human data), trimmed and capped into models/heart.glb by tools/build_heart_glb.py.
// A procedural heart (below) is built first and shown only if that file cannot be loaded.
//
// Heart-local frame: +y points to the base (top), the apex is at the bottom.
// theta is the angle around the long axis: 0 = anterior (+z), 90° = patient's left (+x),
// ±180° = posterior, -90° = patient's right (-x). h runs from -1 (apex) to +1 (top of the atria).
import * as THREE from "three";
import { riskHexFromScore } from "./riskramp";
import { bakeTissue, beatUniforms, colourCaps, computeTerritories, deformPoint, patchMaterial, studioScene, systole } from "./heartshading";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const DEG = Math.PI / 180;
const H = 1.25;          // half-height of the heart
const SX = 1.08;         // left-right width factor
const SZ = 0.9;          // front-back depth factor
const AV = 0.42;         // height of the atrioventricular groove (between ventricles and atria)
const POST_GROOVE = -160 * DEG;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const gauss = (x, s) => Math.exp(-(x * x) / (2 * s * s));
const angDiff = (a, b) => {
  let d = (a - b) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
};
// The anterior interventricular groove drifts towards the patient's left near the apex
const antGroove = (h) => (20 + 18 * (AV - h) / (AV + 1)) * DEG;

// Smooth value noise, used for a natural, slightly irregular surface
function hash3(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  let acc = 0;
  for (let dx = 0; dx <= 1; dx++) for (let dy = 0; dy <= 1; dy++) for (let dz = 0; dz <= 1; dz++) {
    acc += (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w) * hash3(xi + dx, yi + dy, zi + dz);
  }
  return acc;
}
const fbm = (x, y, z) => 0.55 * noise3(x, y, z) + 0.3 * noise3(2.03 * x, 2.03 * y, 2.03 * z)
  + 0.15 * noise3(4.1 * x, 4.1 * y, 4.1 * z);

const ventMask = (h) => 1 - smoothstep(AV - 0.08, AV + 0.1, h);

// Radius of the heart surface at height h and angle th
function radius(h, th) {
  const u = Math.min(1, (h + 1) / 1.25);
  const rv = Math.pow(Math.max(0, Math.sin(u * Math.PI / 2)), 0.75);    // ventricles: rounded cone
  const ha = (h - AV) / (1 - AV);
  const ra = 0.8 * Math.sqrt(Math.max(0, 1 - ha * ha));                 // atria: smaller dome
  const vent = ventMask(h);
  let r = vent * rv + (1 - vent) * ra;
  const grooveFade = smoothstep(-0.97, -0.6, h);
  r *= 1 - 0.10 * gauss(h - AV, 0.05);                                             // AV groove
  r *= 1 - 0.05 * gauss(angDiff(th, antGroove(h)), 0.09) * vent * grooveFade;      // anterior IV groove
  r *= 1 - 0.045 * gauss(angDiff(th, POST_GROOVE), 0.09) * vent * grooveFade;      // posterior IV groove
  r *= 1 + 0.07 * gauss(angDiff(th, -35 * DEG), 0.7) * vent;                       // right ventricle bulge
  r *= 1 + 0.18 * gauss(angDiff(th, -95 * DEG), 0.55) * (1 - vent);                // right atrium
  r *= 1 + 0.10 * gauss(angDiff(th, 160 * DEG), 0.6) * (1 - vent);                 // left atrium
  const s = Math.sin(th), c = Math.cos(th);
  r *= 1 + 0.035 * (fbm(2.2 * s + 5, 2.2 * h, 2.2 * c) - 0.5);
  return r;
}

function surfacePoint(h, th, out = new THREE.Vector3()) {
  const r = radius(h, th);
  return out.set(Math.sin(th) * r * SX, h * H, Math.cos(th) * r * SZ);
}

function surfaceNormal(h, th) {
  const e = 1e-3;
  const p = surfacePoint(h, th);
  const ph = surfacePoint(h + e, th).sub(p);
  const pt = surfacePoint(h, th + e).sub(p);
  return new THREE.Vector3().crossVectors(pt, ph).normalize();
}

// ---------------------------------------------------------------- coronary arteries
// Control points are [h, theta in degrees] on the heart surface.
const LAD_MAIN = [[0.46, 18], ...[0.44, 0.3, 0.12, -0.08, -0.28, -0.48, -0.66, -0.82].map((h) => [h, antGroove(h) / DEG]),
  [-0.93, 52], [-0.985, 112]];
const ARTERIES = {
  LM: { main: [[0.53, -2], [0.5, 9], [0.46, 18]], r: [0.064, 0.06], branches: [] },
  LAD: {
    main: LAD_MAIN, r: [0.06, 0.02],
    branches: [
      [[0.18, antGroove(0.18) / DEG], [0.04, 42], [-0.14, 58], [-0.34, 70]],
      [[-0.22, antGroove(-0.22) / DEG], [-0.36, 46], [-0.54, 58], [-0.7, 64]],
    ],
  },
  LCX: {
    main: [[0.46, 18], [0.44, 38], [0.42, 65], [0.42, 95], [0.42, 125], [0.43, 152]], r: [0.056, 0.024],
    branches: [
      [[0.42, 80], [0.22, 86], [-0.05, 92], [-0.35, 96]],
      [[0.42, 120], [0.2, 126], [-0.08, 130], [-0.32, 132]],
    ],
  },
  RCA: {
    main: [[0.53, -14], [0.45, -32], [0.42, -60], [0.42, -95], [0.42, -128], [0.41, -152], [0.36, -160],
      [0.15, -160], [-0.15, -159], [-0.45, -156], [-0.7, -150], [-0.84, -142]], r: [0.06, 0.02],
    branches: [
      [[0.42, -92], [0.18, -94], [-0.12, -97], [-0.42, -99]],
    ],
  },
};

// Camera direction (world space) that best shows each artery: LAD from the front,
// LCX from the patient's left and behind, RCA from the right and below
const VIEW_DIRS = {
  LAD: new THREE.Vector3(0.15, 0.12, 1),
  LCX: new THREE.Vector3(1, 0.05, -0.45),
  RCA: new THREE.Vector3(-0.85, -0.35, 0.5),
};

// Where along each artery its floating label sits (fraction of the path)
const LABEL_AT = { LAD: 0.45, LCX: 0.2, RCA: 0.2 };
// Extra label offset in heart-local space: the LCX label is pushed out past the right edge of the heart
// so it never sits over the aorta or pulmonary trunk; its leader still runs to the artery
const LABEL_NUDGE = { LCX: new THREE.Vector3(0.45, -0.7, 0.1) };

// Tube along a path of surface points; radius tapers from r0 to r1
function surfaceTube(ctrl, r0, r1, material) {
  const param = new THREE.CatmullRomCurve3(ctrl.map(([h, t]) => new THREE.Vector3(h, t * DEG, 0)), false, "centripetal");
  const samples = param.getSpacedPoints(90);
  const pts = samples.map((q, i) => {
    const rad = r0 + (r1 - r0) * (i / (samples.length - 1));
    return surfacePoint(q.x, q.y).addScaledVector(surfaceNormal(q.x, q.y), rad * 0.6);
  });
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  const mesh = new THREE.Mesh(taperedTube(curve, r0, r1, 140, 14), material);
  mesh.userData.curve = curve;
  mesh.userData.param = param;
  return mesh;
}

function taperedTube(curve, r0, r1, segments, radial) {
  const geo = new THREE.TubeGeometry(curve, segments, 1, radial, false);
  const pos = geo.attributes.position;
  const c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    curve.getPointAt(u, c);
    const rad = r0 + (r1 - r0) * Math.pow(u, 0.8);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(rad).add(c);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

// Myocardial territory weights per vessel (simplified AHA 17-segment mapping)
function territoryWeights(h, th) {
  const vent = ventMask(h);
  let lad = gauss(angDiff(th, 30 * DEG), 0.85) + 1.3 * (1 - smoothstep(-0.92, -0.55, h));
  let lcx = gauss(angDiff(th, 125 * DEG), 0.55);
  let rca = gauss(angDiff(th, -150 * DEG), 0.6) + 0.9 * gauss(angDiff(th, -75 * DEG), 0.6);
  lad *= lad; lcx *= lcx; rca *= rca;
  const sum = lad + lcx + rca + 1e-6;
  return [vent * lad / sum, vent * lcx / sum, vent * rca / sum];
}

// ---------------------------------------------------------------- risk colours
// The ramp itself lives in riskramp.ts, which the page and the PDF use too, so the colours cannot drift apart
export const riskColor = (score) => new THREE.Color(riskHexFromScore(score));

// ---------------------------------------------------------------- viewer
export function createHeartViewer(container, { onSelect, reduceMotion = false, zoom = true, labels: showLabels = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.14;
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = "label-layer";
  if (!showLabels) labelRenderer.domElement.style.display = "none";     // `display`, because `visibility` is toggled while the model loads
  container.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studioScene(), 0.05).texture;

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  const HOME = { pos: new THREE.Vector3(0.85, 0.85, 5.5), target: new THREE.Vector3(0.2, 0.45, 0) };
  const viewDirs = { ...VIEW_DIRS };
  camera.position.copy(HOME.pos);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(HOME.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 2.6;
  if (!zoom) {            // on a page that scrolls: the wheel and vertical swipes scroll the page, sideways drags turn the heart
    controls.enableZoom = false;
    renderer.domElement.style.touchAction = "pan-y";
  }
  controls.maxDistance = 14;

  scene.add(new THREE.HemisphereLight(0xfff6f0, 0x5e4c48, 0.6));
  const key = new THREE.DirectionalLight(0xfff3e8, 2.1);
  key.position.set(3, 5, 6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.45);
  fill.position.set(-4, 1, 5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xe4ecff, 1.1);
  rim.position.set(-3, 3, -6);
  scene.add(rim);

  // Heart group: tilted so the apex points down, forward and to the patient's left
  let heart = new THREE.Group();
  heart.position.set(0.35, 0, 0);
  heart.rotation.set(-0.35, 0, 0.72);
  scene.add(heart);

  // --- myocardium
  // Sample every artery path once, so epicardial fat can follow the vessels as it does in a real heart
  const arteryPts = [];
  for (const spec of Object.values(ARTERIES)) {
    for (const path of [spec.main, ...spec.branches]) {
      const c = new THREE.CatmullRomCurve3(path.map(([h, t]) => new THREE.Vector3(h, t * DEG, 0)), false, "centripetal");
      for (const q of c.getSpacedPoints(60)) arteryPts.push(surfacePoint(q.x, q.y));
    }
  }
  const nearArtery = (p) => {
    let best = Infinity;
    for (const a of arteryPts) {
      const d = p.distanceToSquared(a);
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  };

  let g = new THREE.SphereGeometry(1, 240, 180);
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  g = mergeVertices(g, 1e-5);
  const pos = g.attributes.position;
  let nv = pos.count;
  let baseColors = new Float32Array(nv * 3);
  let terr = new Float32Array(nv * 3);
  let fatAt = new Float32Array(nv);            // how much of each muscle vertex is fat (it is never tinted)
  const arteryDots = {};                       // each artery as a few hundred points, for clicking near it
  let heartCentre = new THREE.Vector3();
  // Real tissue colours: dark red myocardium, purplish atria, yellow epicardial fat in the grooves
  const MUSCLE_DARK = new THREE.Color("#3e0e11"), MUSCLE_LIGHT = new THREE.Color("#66201d");
  const ATRIUM = new THREE.Color("#43141f"), FAT = new THREE.Color("#ead6a8"), FAT_DEEP = new THREE.Color("#cdae74");
  const tmp = new THREE.Vector3(), col = new THREE.Color(), fatCol = new THREE.Color();
  for (let i = 0; i < nv; i++) {
    tmp.fromBufferAttribute(pos, i);
    const h = THREE.MathUtils.clamp(tmp.y, -1, 1);
    const th = Math.atan2(tmp.x, tmp.z);
    surfacePoint(h, th, tmp);

    const vent = ventMask(h), fade = smoothstep(-0.97, -0.6, h);
    const s = Math.sin(th), c = Math.cos(th);
    const groove = Math.max(gauss(h - AV, 0.045),
      gauss(angDiff(th, antGroove(h)), 0.07) * vent * fade,
      gauss(angDiff(th, POST_GROOVE), 0.07) * vent * fade);
    const dArt = nearArtery(tmp);
    // deposit width and thickness wander along each groove, and thin out towards the apex
    const wander = fbm(5 * s + 1, 5 * h, 5 * c), thick = 0.55 + 0.6 * fbm(3 * s, 3 * h + 8, 3 * c);
    const distal = 0.45 + 0.55 * smoothstep(-0.9, 0.3, h);
    let fat = Math.max(
      gauss(h - AV, 0.05 + 0.05 * wander),
      gauss(angDiff(th, antGroove(h)), 0.07 + 0.09 * wander) * vent * fade * distal,
      gauss(angDiff(th, POST_GROOVE), 0.07 + 0.09 * wander) * vent * fade * distal,
      gauss(dArt, 0.03 + 0.045 * wander) * distal,
    ) * thick;
    // irregular fat patches over the base and the right ventricle, thinning towards the apex
    fat = Math.max(fat, 0.5 * smoothstep(0.5, 0.8, fbm(2.4 * s + 7, 2.4 * h, 2.4 * c)) * smoothstep(-0.45, 0.2, h) * vent);
    fat = clamp01(fat * (0.75 + 0.5 * fbm(6 * s + 11, 6 * h, 6 * c)));

    // fat lobules sit slightly proud of the muscle, but never over an artery
    const bulge = 0.012 * fat * (0.6 + 0.8 * fbm(14 * s, 14 * h + 5, 14 * c)) * (1 - gauss(dArt, 0.035));
    const relief = 0.006 * (fbm(24 * s + 2, 24 * h, 24 * c) - 0.5) * (1 - fat);
    tmp.multiplyScalar(1 + bulge + relief);
    pos.setXYZ(i, tmp.x, tmp.y, tmp.z);

    col.copy(MUSCLE_DARK).lerp(MUSCLE_LIGHT, fbm(4.2 * s + 3, 4.2 * h, 4.2 * c));
    col.lerp(ATRIUM, (1 - vent) * 0.85);
    fatCol.copy(FAT_DEEP).lerp(FAT, fbm(9 * s, 9 * h + 2, 9 * c));
    col.lerp(fatCol, smoothstep(0.15, 0.75, fat));
    col.multiplyScalar(0.9 + 0.2 * fbm(16 * s, 16 * h + 9, 16 * c));    // fine muscle-fibre mottling
    col.multiplyScalar(1 - 0.22 * groove * (1 - fat));                    // shade the grooves
    baseColors.set([col.r, col.g, col.b], i * 3);
    const w = territoryWeights(h, th).map((x) => x * (1 - 0.7 * fat));
    terr.set(w, i * 3);
  }
  g.computeVertexNormals();
  g.setAttribute("color", new THREE.BufferAttribute(baseColors.slice(), 3));
  // Wet pericardial sheen: clearcoat for the gloss, red sheen for light scattering in tissue
  const tissue = {
    roughness: 0.48, clearcoat: 0.45, clearcoatRoughness: 0.3, metalness: 0, envMapIntensity: 0.75,
    sheen: 0.2, sheenColor: new THREE.Color("#9c3328"), sheenRoughness: 0.5,
  };
  let myocardium = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ vertexColors: true, ...tissue }));
  heart.add(myocardium);

  // --- atrial appendages: small, lobulated ear-shaped pouches at the base
  function auricle(h, thDeg, dir, len, wid, thick, color) {
    const ag = new THREE.SphereGeometry(1, 48, 28);
    const ap = ag.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < ap.count; i++) {
      v.fromBufferAttribute(ap, i);
      const u = (v.x + 1) / 2;                                // 0 at the root, 1 at the tip
      const taper = 1 - 0.5 * u;
      const lobes = 1 + 0.09 * Math.sin(7 * u * Math.PI + 1.3) * Math.max(0, v.y);
      v.y *= taper * lobes;
      v.z *= taper;
      v.y -= 0.35 * u * u;                                    // the tip curls down over the groove
      ap.setXYZ(i, v.x * len, v.y * wid, v.z * thick);
    }
    ag.computeVertexNormals();
    const n = surfaceNormal(h, thDeg * DEG);
    const t = surfacePoint(h, (thDeg + dir) * DEG).sub(surfacePoint(h, thDeg * DEG)).normalize();
    const b = new THREE.Vector3().crossVectors(n, t).normalize();
    t.crossVectors(b, n).normalize();
    const mesh = new THREE.Mesh(ag, new THREE.MeshPhysicalMaterial({ color, ...tissue }));
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(t, b, n));
    mesh.position.copy(surfacePoint(h, thDeg * DEG)).addScaledVector(n, thick * 0.35).addScaledVector(t, len * 0.55);
    heart.add(mesh);
  }
  auricle(0.56, 62, -12, 0.34, 0.17, 0.1, 0x4c1620);    // left atrial appendage, beside the pulmonary trunk
  auricle(0.6, -52, 12, 0.36, 0.2, 0.11, 0x501722);     // right atrial appendage, over the aortic root

  // --- coronary arteries
  const vesselMaterials = {};
  const vesselMeshes = [];
  const labels = {};
  const arteryMaterial = () => new THREE.MeshPhysicalMaterial({
    // Not tone-mapped, so the rendered hue matches the label swatch and the panel B dot
    color: 0xa8807a, toneMapped: false, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25,
  });
  // Floating label with a leader line from the artery, as in an anatomy figure
  function makeLabel(name, onArtery, anchorPos, normal, parent) {
    const anchor = new THREE.Object3D();
    anchor.position.copy(anchorPos);
    anchor.userData.normal = normal;
    parent.add(anchor);
    const leader = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([onArtery, anchorPos.clone()]),
      new THREE.LineBasicMaterial({ color: 0x14171c, transparent: true, opacity: 0.6 }),
    );
    leader.visible = showLabels;
    parent.add(leader);
    const div = document.createElement("button");
    div.className = "vessel-label";
    div.type = "button";
    div.innerHTML = `<span class="sw" style="background:#888888"></span><b class="nm">${labelNames[name] ?? name}</b><span class="pct"></span>`;
    div.setAttribute("aria-label", `${name}: select this artery`);
    div.addEventListener("click", (e) => { e.stopPropagation(); select(name); onSelect?.(name); });
    anchor.add(new CSS2DObject(div));
    labels[name] = { anchor, div, leader, rest: onArtery.clone() };
  }
  let labelNames = {};
  for (const [name, spec] of Object.entries(ARTERIES)) {
    const mat = arteryMaterial();
    vesselMaterials[name] = mat;
    const main = surfaceTube(spec.main, spec.r[0], spec.r[1], mat);
    main.userData.vessel = name === "LM" ? null : name;
    heart.add(main);
    if (name !== "LM") vesselMeshes.push(main);
    for (const b of spec.branches) {
      const br = surfaceTube(b, 0.036, 0.014, mat);
      br.userData.vessel = name;
      heart.add(br);
      vesselMeshes.push(br);
    }
    if (name !== "LM") {
      const q = main.userData.param.getPointAt(LABEL_AT[name]);
      const normal = surfaceNormal(q.x, q.y);
      const onArtery = surfacePoint(q.x, q.y).addScaledVector(normal, 0.05);
      const anchorPos = onArtery.clone().addScaledVector(normal, 0.62);
      if (LABEL_NUDGE[name]) anchorPos.add(LABEL_NUDGE[name]);
      makeLabel(name, onArtery, anchorPos, normal, heart);
    }
  }

  // --- great vessels (world space, anchored to the heart base), cut short as in a dissected specimen
  heart.updateMatrixWorld(true);
  const great = new THREE.Group();
  scene.add(great);
  const anchorAt = (h, th, inset) => heart.localToWorld(surfacePoint(h, th * DEG).multiplyScalar(inset));
  const vesselWall = (color, sheen = 0.25) => new THREE.MeshPhysicalMaterial({
    color, roughness: 0.45, clearcoat: 0.45, clearcoatRoughness: 0.3, sheen, sheenColor: new THREE.Color("#e8b8a8"),
  });
  const AORTA = vesselWall(0xd9b9a6);    // thick elastic wall: pale cream-pink
  const PULM_A = vesselWall(0xc99d8f);
  const VEIN = vesselWall(0x2e2038, 0);  // venae cavae: thin wall, dark blood shows through
  const PULM_V = vesselWall(0x4e1d26, 0);
  const LUMEN_A = new THREE.MeshStandardMaterial({ color: 0x3a0d10, roughness: 0.8, side: THREE.DoubleSide });
  const LUMEN_V = new THREE.MeshStandardMaterial({ color: 0x1a1018, roughness: 0.8, side: THREE.DoubleSide });
  const zAxis = new THREE.Vector3(0, 0, 1);
  // Tapered vessel that ends in a cut, showing its dark lumen
  const vessel = (points, r0, r1, mat, lumen) => {
    const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
    great.add(new THREE.Mesh(taperedTube(curve, r0, r1, 120, 24), mat));
    const cut = new THREE.Mesh(new THREE.CircleGeometry(r1 * 0.97, 28), lumen);
    cut.position.copy(curve.getPointAt(1));
    cut.quaternion.setFromUnitVectors(zAxis, curve.getTangentAt(1));
    great.add(cut);
    return curve;
  };
  const add = (a, x, y, z) => a.clone().add(new THREE.Vector3(x, y, z));
  const A0 = anchorAt(0.62, -8, 0.7);
  const aorta = vessel([A0, add(A0, -0.06, 0.55, 0.08), add(A0, 0.02, 1.1, -0.04), add(A0, 0.3, 1.34, -0.4),
    add(A0, 0.62, 1.08, -0.78), add(A0, 0.7, 0.62, -0.9)], 0.21, 0.18, AORTA, LUMEN_A);
  for (const [u, dx, dz] of [[0.42, -0.3, 0.05], [0.52, 0.0, 0.03], [0.62, 0.3, -0.02]]) {
    const s0 = aorta.getPointAt(u);
    vessel([s0, add(s0, dx * 0.5, 0.42, dz), add(s0, dx, 0.78, dz)], 0.08, 0.062, AORTA, LUMEN_A);
  }
  const P0 = anchorAt(0.55, 28, 0.8);
  const B = add(P0, 0.2, 0.82, -0.05);
  vessel([P0, add(P0, 0.12, 0.45, 0.1), B], 0.18, 0.16, PULM_A, LUMEN_A);
  vessel([B, add(B, 0.4, 0.08, -0.3), add(B, 0.72, -0.04, -0.52)], 0.11, 0.09, PULM_A, LUMEN_A);
  vessel([B, add(B, -0.4, 0.1, -0.3), add(B, -0.8, 0.02, -0.48)], 0.11, 0.09, PULM_A, LUMEN_A);
  const S0 = anchorAt(0.82, -80, 0.8);
  vessel([S0, add(S0, 0.02, 0.5, 0.02), add(S0, 0.03, 0.95, 0.03)], 0.14, 0.12, VEIN, LUMEN_V);
  const I0 = anchorAt(0.45, -150, 0.85);
  vessel([I0, add(I0, 0.0, -0.3, -0.04), add(I0, 0.02, -0.5, -0.06)], 0.15, 0.14, VEIN, LUMEN_V);
  for (const th of [135, 165, 195, 225]) {
    const v0 = anchorAt(0.66, th, 0.85);
    const out = heart.localToWorld(surfacePoint(0.66, th * DEG).multiplyScalar(1.5)).sub(v0).setLength(0.36);
    vessel([v0, v0.clone().addScaledVector(out, 0.5), v0.clone().add(out)], 0.06, 0.052, PULM_V, LUMEN_V);
  }

  // ---------------------------------------------------------------- anatomical heart (Human Reference Atlas)
  // Hide the procedural heart while the anatomical one loads; show it only as a fallback.
  heart.visible = false;
  great.visible = false;
  labelRenderer.domElement.style.visibility = "hidden";
  let anatomyState = "loading";
  const showFallback = () => {
    if (anatomyState !== "loading") return;
    anatomyState = "procedural";
    heart.visible = true;
    great.visible = true;
    labelRenderer.domElement.style.visibility = "";
  };
  const fallbackTimer = setTimeout(showFallback, 10000);

  function useAnatomy(model) {
    if (anatomyState !== "loading") return;
    anatomyState = "anatomical";
    clearTimeout(fallbackTimer);
    const part = (n) => model.getObjectByName(n);

    // retire the procedural heart and its labels
    for (const { div, anchor } of Object.values(labels)) { div.remove(); anchor.removeFromParent(); }
    for (const k of Object.keys(labels)) delete labels[k];
    scene.remove(heart);
    scene.remove(great);
    vesselMeshes.length = 0;

    const anat = new THREE.Group();
    scene.add(anat);
    heart = anat;

    // myocardium: baked tissue colour (sRGB) and coronary territory weights from the build script
    const myo = part("myocardium");
    const geo = myo.geometry;
    // fat along the arteries, occlusion in the grooves, and the beat's frame (see heartshading.js)
    const { fat, frame } = bakeTissue(Object.fromEntries(["myocardium", "LAD", "LCX", "RCA", "LM", "aorta", "pulmonary", "pulmonary_veins", "SVC", "IVC", "veins"]
      .map((n) => [n, part(n)?.geometry]).filter(([, g]) => g)));
    framed = true;
    const tissueAttr = geo.getAttribute("_tissue");
    nv = geo.getAttribute("position").count;
    baseColors = new Float32Array(nv * 3);
    const c = new THREE.Color();
    const atrium = new Uint8Array(nv);                  // the build script paints atria pinker than ventricles
    for (let i = 0; i < nv; i++) {
      c.setRGB(tissueAttr.getX(i), tissueAttr.getY(i), tissueAttr.getZ(i), THREE.SRGBColorSpace);
      baseColors.set([c.r, c.g, c.b], i * 3);
      atrium[i] = tissueAttr.getY(i) > 0.17 ? 1 : 0;
    }
    fatAt = fat;
    // which artery supplies which muscle: the standard 17-segment map, not "the nearest artery"
    terr = computeTerritories(Object.fromEntries(["myocardium", "LAD", "LCX", "RCA"].map((n) => [n, part(n).geometry])), frame, atrium);
    geo.setAttribute("color", new THREE.BufferAttribute(baseColors.slice(), 3));
    g = geo;
    // Clean, glossy textbook finish (smooth colours are baked by the build script)
    const gloss = {
      roughness: 0.4, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.24, envMapIntensity: 0.8,
      sheen: 0.12, sheenColor: new THREE.Color("#ff9a9a"), sheenRoughness: 0.4,
    };
    const muscle = new THREE.MeshPhysicalMaterial({ vertexColors: true, ...gloss });
    patchMaterial(muscle, { shade: "tissue" });
    myocardium = new THREE.Mesh(geo, muscle);
    anat.add(myocardium);

    // coronary arteries, coloured by risk
    for (const name of ["LAD", "LCX", "RCA", "LM"]) {
      const mat = arteryMaterial();
      mat.side = THREE.DoubleSide;           // the capped vessel ends are fans of either winding
      patchMaterial(mat, { shade: "none" }); // the beat only: an artery's colour is its risk, so nothing may change it
      vesselMaterials[name] = mat;
      const src = part(name);
      const mesh = new THREE.Mesh(src.geometry, mat);
      mesh.userData.vessel = name === "LM" ? null : name;
      anat.add(mesh);
      if (name !== "LM") vesselMeshes.push(mesh);
    }

    // great vessels and cardiac veins in textbook colours: oxygenated red, deoxygenated blue
    const glossy = (color) => new THREE.MeshPhysicalMaterial({ color, ...gloss, sheen: 0 });
    const RED_VESSEL = glossy(0x9e2626), BLUE_VESSEL = glossy(0x35579f), BLUE_VEIN = glossy(0x2a4689);
    BLUE_VEIN.side = THREE.DoubleSide;
    for (const m of [RED_VESSEL, BLUE_VESSEL, BLUE_VEIN]) patchMaterial(m, { shade: "vessel" });
    // cut vessel ends, drawn as a dark lumen like a textbook specimen
    const LUMEN = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, side: THREE.DoubleSide });
    patchMaterial(LUMEN, { shade: "none" });
    if (part("caps")) colourCaps(part("caps").geometry, Object.fromEntries(["aorta", "pulmonary", "pulmonary_veins", "SVC", "IVC"].map((n) => [n, part(n)?.geometry])));
    for (const [name, mat] of [["aorta", RED_VESSEL], ["pulmonary", BLUE_VESSEL], ["pulmonary_veins", RED_VESSEL],
      ["SVC", BLUE_VESSEL], ["IVC", BLUE_VESSEL], ["veins", BLUE_VEIN], ["caps", LUMEN]]) {
      const src = part(name);
      if (!src) continue;
      anat.add(new THREE.Mesh(src.geometry, mat));
    }

    // labels and camera views from the real artery positions
    const box = new THREE.Box3().setFromObject(myocardium);
    const centre = box.getCenter(new THREE.Vector3());

    // soft contact shadow under the apex (a blurred disc, no shadow maps: cheap on any laptop)
    const shadowCanvas = Object.assign(document.createElement("canvas"), { width: 128, height: 128 });
    const sg = shadowCanvas.getContext("2d");
    const grad = sg.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, "rgba(20,23,28,0.32)");
    grad.addColorStop(1, "rgba(20,23,28,0)");
    sg.fillStyle = grad;
    sg.fillRect(0, 0, 128, 128);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.7), new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false, toneMapped: false,
    }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(centre.x, box.min.y - 0.12, centre.z);
    scene.add(shadow);
    const front = new THREE.Vector3(0, 0, 1);
    // Each label keeps a fixed side of the figure (RCA left, LAD lower right, LCX upper right) and anchors on the
    // visible point of its artery that lies furthest that way, so labels sit outside the heart's outline
    const SIDE = {
      RCA: new THREE.Vector3(-1, 0.15, 0).normalize(),
      LAD: new THREE.Vector3(0.8, -0.6, 0).normalize(),
      LCX: new THREE.Vector3(0.75, 0.65, 0).normalize(),
    };
    for (const name of ["LAD", "LCX", "RCA"]) {
      const p = part(name).geometry.getAttribute("position");
      const v = new THREE.Vector3(), best = new THREE.Vector3();
      let bestScore = -Infinity;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const rel = v.clone().sub(centre);
        // LAD and RCA: the visible front point furthest towards the label's side. LCX runs mostly behind the
        // heart, so it uses its furthest up-and-out point (the lateral edge near the base) wherever it is.
        if (name !== "LCX" && rel.z < -0.05) continue;
        const score = rel.dot(SIDE[name]) + (name === "LCX" ? 0.15 : 0.4) * rel.z;
        if (score > bestScore) { bestScore = score; best.copy(v); }
      }
      const out = SIDE[name].clone().add(new THREE.Vector3(0, 0, 0.25)).normalize();
      // "facing" direction for the behind-the-heart check: mostly forward, a little towards the label's side
      const facing = SIDE[name].clone().multiplyScalar(0.3).add(front).normalize();
      makeLabel(name, best.clone(), best.clone().addScaledVector(out, 0.55), facing, anat);
      // the camera goes to where the muscle this artery supplies faces, and stays level so the heart is never upside down
      const k = ["LAD", "LCX", "RCA"].indexOf(name), mp = geo.getAttribute("position"), from = new THREE.Vector3(), toward = new THREE.Vector3();
      let weight = 0;
      for (let i = 0; i < nv; i++) {
        const w = terr[i * 3 + k] ** 2;
        if (w < 0.04) continue;
        toward.add(from.fromBufferAttribute(mp, i).multiplyScalar(w)); weight += w;
      }
      const d = toward.multiplyScalar(1 / (weight || 1)).sub(centre).normalize().add(front.clone().multiplyScalar(0.3));
      d.y = Math.min(0.5, Math.max(-0.12, d.y));
      viewDirs[name] = d.normalize();
      // a few hundred points along the artery, to find it from a click that lands near it
      const pts = new Float32Array(Math.ceil(p.count / 3) * 3);
      for (let i = 0, j = 0; i < p.count; i += 3, j += 3) { pts[j] = p.getX(i); pts[j + 1] = p.getY(i); pts[j + 2] = p.getZ(i); }
      arteryDots[name] = pts;
    }
    heartCentre.copy(centre);
    HOME.pos.set(0.25, 0.7, 8.4);
    HOME.target.copy(centre).add(new THREE.Vector3(0, 0.5, 0));
    controls.target.copy(HOME.target);
    camera.position.copy(HOME.pos);
    labelRenderer.domElement.style.visibility = "";

    // re-apply the current state to the new meshes
    if (risks) setRisks(risks);
    select(selected);
    refreshVessels();
  }

  let disposed = false;
  new GLTFLoader().load("models/heart.glb", (gltf) => { if (!disposed) useAnatomy(gltf.scene); }, undefined, (err) => {
    console.warn("Anatomical heart not loaded, using the procedural heart.", err);
    showFallback();
  });

  // ---------------------------------------------------------------- state
  let risks = null;
  let selected = null;
  let hovered = null;
  let showTerritories = false;
  let beating = true;
  let bpm = 70;
  let camTween = null;
  const vesselColor = { LAD: new THREE.Color(0x888888), LCX: new THREE.Color(0x888888), RCA: new THREE.Color(0x888888) };

  // Paints each artery's territory in the artery's risk colour. Blending a colour into dark red gives brown and
  // olive, so a territory takes the risk colour itself, scaled by how bright the muscle underneath is, which keeps
  // the shading and the texture. Each territory uses only its own colour and its own strength, never a mix, so the
  // seam between two is a clean edge and an unselected neighbour never leaks into the one that is selected.
  //   selected: its territory is painted strongly and the rest left alone
  //   Risk map: every territory is painted
  //   both:     the selected one strongly, the others faintly
  // Fat is never painted.
  function recolorMyocardium() {
    const colors = g.attributes.color;
    const names = ["LAD", "LCX", "RCA"];
    const strength = names.map((n) => (selected === n ? 0.8 : showTerritories ? (selected ? 0.3 : 0.58) : 0));
    const painting = risks && strength.some((s) => s > 0);
    const edge = (x) => { const t = Math.min(1, Math.max(0, (x - 0.38) / 0.24)); return t * t * (3 - 2 * t); };
    for (let i = 0; i < nv; i++) {
      let r = baseColors[i * 3], gg = baseColors[i * 3 + 1], b = baseColors[i * 3 + 2];
      if (painting) {
        const lit = Math.min(1.25, Math.max(0.6, 0.62 + (0.2126 * r + 0.7152 * gg + 0.0722 * b) * 7.5));
        for (let k = 0; k < 3; k++) {
          if (!strength[k]) continue;
          const cover = strength[k] * edge(terr[i * 3 + k]) * (1 - 0.85 * fatAt[i]);
          if (cover <= 0) continue;
          const c = vesselColor[names[k]];
          r += (c.r * lit - r) * cover; gg += (c.g * lit - gg) * cover; b += (c.b * lit - b) * cover;
        }
      }
      colors.setXYZ(i, r, gg, b);
    }
    colors.needsUpdate = true;
  }

  function refreshVessels(time = 0) {
    for (const name of ["LAD", "LCX", "RCA"]) {
      const mat = vesselMaterials[name];
      const c = vesselColor[name];
      const pulse = selected === name ? (reduceMotion ? 0.12 : 0.1 + 0.08 * Math.sin(time * 0.006)) : 0;
      const boost = hovered === name ? 0.15 : 0;
      const dim = selected && selected !== name ? 0.6 : 1;
      mat.color.copy(c).multiplyScalar(0.6 * dim);
      mat.emissive.copy(c).multiplyScalar(0.52 * dim + pulse + boost);
    }
    vesselMaterials.LM.color.set(0x8e3d34);
    vesselMaterials.LM.emissive.set(0x3a1a16);
  }

  function setRisks(next) {
    risks = next;
    for (const name of ["LAD", "LCX", "RCA"]) {
      vesselColor[name] = riskColor(next[name].score);
      const { div } = labels[name];
      const text = next[name].text ?? `${Math.round(next[name].probability * 100)}%`;
      div.querySelector(".pct").textContent = text;
      div.querySelector(".sw").style.background = `#${vesselColor[name].getHexString()}`;
      div.setAttribute("aria-label", `${name}: ${text} predicted risk. Select this artery`);
      div.classList.toggle("high", next[name].high);
    }
    refreshVessels();
    recolorMyocardium();
  }

  function select(name) {
    selected = name;
    for (const [n, { div }] of Object.entries(labels)) {
      div.classList.toggle("dim", name !== null && n !== name);
      div.classList.toggle("selected", n === name);
      div.setAttribute("aria-pressed", String(n === name));
    }
    refreshVessels();
    recolorMyocardium();
    if (name) {
      const dist = camera.position.distanceTo(controls.target);
      const dir = viewDirs[name].clone().normalize();
      camTween = { from: camera.position.clone(), to: controls.target.clone().addScaledVector(dir, dist), t0: performance.now() };
      if (reduceMotion) camTween.t0 = -Infinity;
    }
  }

  // ---------------------------------------------------------------- interaction
  const pointer = new THREE.Vector2();
  let downAt = null;
  // An artery is a few pixels wide, so a click has to count when it lands near one, not only on it. (The fat
  // that lies beside the artery stands slightly proud of it, so a click on the artery's edge often hits fat first.)
  // The nearest visible artery within reach of the click is the one clicked. Each artery is a few hundred points,
  // placed where the artery is NOW: the beat moves the surface in the shader, which three's ray casting cannot see,
  // so a ray would be tested against a heart that is no longer where it is drawn.
  // "Visible" is the half of the heart that faces the camera, which is exact enough for a body this convex.
  const dot = new THREE.Vector3(), rest = new THREE.Vector3(), toCamera = new THREE.Vector3(), outward = new THREE.Vector3();
  const placed = (pts, j) => deformPoint(dot, rest.set(pts[j], pts[j + 1], pts[j + 2]), lastS);
  function nearestArtery(px, py, reach, rect, only = null) {
    toCamera.copy(camera.position).sub(heartCentre).normalize();
    let best = reach, name = null, at = null;
    for (const [n, pts] of Object.entries(arteryDots)) {
      if (only && n !== only) continue;
      for (let j = 0; j < pts.length; j += 3) {
        placed(pts, j);
        if (outward.copy(dot).sub(heartCentre).normalize().dot(toCamera) < -0.02) continue;     // on the far side
        dot.project(camera);
        if (dot.z > 1) continue;
        const sx = (dot.x * 0.5 + 0.5) * rect.width, sy = (-dot.y * 0.5 + 0.5) * rect.height;
        const d = Math.hypot(sx - px, sy - py);
        if (d < best) { best = d; name = n; at = { x: sx, y: sy }; }
      }
    }
    return { name, at, dist: best };
  }
  function pick(ev) {
    const rect = renderer.domElement.getBoundingClientRect();
    const px = ev.clientX - rect.left, py = ev.clientY - rect.top;
    return nearestArtery(px, py, ev.pointerType === "touch" ? 24 : 13, rect).name;
  }
  renderer.domElement.addEventListener("pointerdown", (ev) => { downAt = [ev.clientX, ev.clientY]; });
  renderer.domElement.addEventListener("pointerup", (ev) => {
    if (!downAt || Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) > 5) return;
    const v = pick(ev);
    select(v);
    onSelect?.(v);
  });
  renderer.domElement.addEventListener("pointermove", (ev) => {
    if (ev.buttons) return;
    const v = pick(ev);
    if (v !== hovered) {
      hovered = v;
      renderer.domElement.style.cursor = v ? "pointer" : "grab";
      refreshVessels();
    }
  });

  // ---------------------------------------------------------------- render loop
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    labelRenderer.setSize(w, h);
    camera.aspect = w / h;
    // Narrow (portrait) frames widen the field of view so the artery labels stay inside the figure
    camera.fov = camera.aspect < 1.1 ? Math.min(62, 38 * (1.1 / camera.aspect)) : 38;
    camera.updateProjectionMatrix();
  }
  const sizeWatch = new ResizeObserver(resize);
  sizeWatch.observe(container);
  resize();

  const clock = new THREE.Clock();
  let phase = 0;
  // Squeeze the heart to `s` (0..1): the shaders read the uniform, and each label's leader line is moved to
  // where its artery now is, with the same maths, so it stays on the surface
  let lastS = -1, frozen = null, framed = false;        // `framed`: the anatomical model is loaded, so the beat can deform it
  const moved = new THREE.Vector3();
  function pose(s) {
    if (Math.abs(s - lastS) < 1e-4) return;
    lastS = s;
    beatUniforms.uSys.value = s;
    for (const { leader, rest } of Object.values(labels)) {
      if (!rest) continue;
      deformPoint(moved, rest, s);
      const p = leader.geometry.getAttribute("position");
      p.setXYZ(0, moved.x, moved.y, moved.z);
      p.needsUpdate = true;
    }
  }
  const camDir = new THREE.Vector3(), wp = new THREE.Vector3(), wn = new THREE.Vector3();
  renderer.setAnimationLoop((time) => {
    const dt = clock.getDelta();
    if (beating) phase = (phase + dt * bpm / 60) % 1;
    if (framed) {
      pose(frozen ?? (beating ? systole(phase) : 0));
    } else if (beating) {
      const atrial = phase < 0.12 ? Math.sin(Math.PI * phase / 0.12) : 0;
      const ventricular = phase > 0.14 && phase < 0.5 ? Math.sin(Math.PI * (phase - 0.14) / 0.36) ** 1.5 : 0;
      const radial = 1 - 0.034 * ventricular - 0.007 * atrial;
      heart.scale.set(radial, 1 - 0.016 * ventricular, radial);
      heart.rotation.y = -0.025 * ventricular;
    } else {
      heart.scale.setScalar(1);
      heart.rotation.y = 0;
    }
    if (camTween) {
      const k = clamp01((performance.now() - camTween.t0) / 900);
      const e = k * k * (3 - 2 * k);
      camera.position.lerpVectors(camTween.from, camTween.to, e);
      if (k >= 1) camTween = null;
    }
    if (selected) refreshVessels(time);
    controls.update();

    // fade labels that sit on the far side of the heart
    for (const { anchor, div, leader } of Object.values(labels)) {
      anchor.getWorldPosition(wp);
      wn.copy(anchor.userData.normal).transformDirection(heart.matrixWorld);
      camDir.copy(camera.position).sub(wp).normalize();
      const behind = wn.dot(camDir) < -0.05;
      div.classList.toggle("behind", behind);
      leader.material.opacity = behind ? 0.15 : 0.6;
    }
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
    // keep every label at least 12px inside the figure, nudging with `translate` (CSS2D owns `transform`)
    const box = container.getBoundingClientRect();
    for (const { div } of Object.values(labels)) {
      const r = div.getBoundingClientRect();
      const prev = div._nudge || 0;
      const left = r.left - prev, right = r.right - prev;
      let dx = 0;
      if (left < box.left + 12) dx = box.left + 12 - left;
      else if (right > box.right - 12) dx = box.right - 12 - right;
      if (dx !== prev) { div.style.translate = `${dx}px 0`; div._nudge = dx; }
    }
  });

  const api = {
    setRisks,
    select,
    // Display names for the artery labels (plain-words mode)
    setLabelNames: (names) => {
      labelNames = { ...names };
      for (const [n, { div }] of Object.entries(labels)) div.querySelector(".nm").textContent = names[n] ?? n;
    },
    // Still image of the current view, used for printing (WebGL canvases do not print reliably)
    // `scale` renders above screen resolution (for the PDF report), then restores the canvas
    snapshot: (scale = 1) => {
      const ratio = renderer.getPixelRatio(), w = container.clientWidth, h = container.clientHeight;
      if (scale !== 1) { renderer.setPixelRatio(ratio * scale); renderer.setSize(w, h, false); }
      const squeeze = lastS;                       // printed relaxed, whatever moment of the beat it is
      if (framed) pose(0);
      renderer.render(scene, camera);
      const url = renderer.domElement.toDataURL("image/png");
      if (framed && squeeze > 0) pose(squeeze);
      if (scale !== 1) { renderer.setPixelRatio(ratio); renderer.setSize(w, h, false); renderer.render(scene, camera); }
      return url;
    },
    setHeartRate: (value) => { bpm = THREE.MathUtils.clamp(value || 70, 30, 180); },
    // How far (in pixels) the nearest visible artery is from a point of the figure: for the tests, to find empty space
    distanceToArteries: (x, y) => nearestArtery(x, y, 1e9, renderer.domElement.getBoundingClientRect()).dist,
    // Where an artery is on screen, in pixels from the figure's top left: the nearest visible point to the middle
    screenPointOf: (name) => {
      const rect = renderer.domElement.getBoundingClientRect(), cx = rect.width / 2, cy = rect.height / 2;
      toCamera.copy(camera.position).sub(heartCentre).normalize();
      const shown = {};
      for (const [n, pts] of Object.entries(arteryDots)) {
        shown[n] = [];
        for (let j = 0; j < pts.length; j += 3) {
          placed(pts, j);
          if (outward.copy(dot).sub(heartCentre).normalize().dot(toCamera) < 0.1 || dot.project(camera).z > 1) continue;
          shown[n].push({ x: (dot.x * 0.5 + 0.5) * rect.width, y: (-dot.y * 0.5 + 0.5) * rect.height });
        }
      }
      let best = null, bestScore = -Infinity;
      for (const p of shown[name] ?? []) {
        let clearance = 60;
        for (const [n, list] of Object.entries(shown)) if (n !== name) for (const q of list) clearance = Math.min(clearance, Math.hypot(p.x - q.x, p.y - q.y));
        const score = clearance - 0.02 * Math.hypot(p.x - cx, p.y - cy);
        if (score > bestScore) { bestScore = score; best = p; }
      }
      return best;
    },
    // Put the camera on the side of the heart given by a direction (x right, y up, z towards the viewer): for tests and stills
    lookFrom: (x, y, z) => {
      const dist = camera.position.distanceTo(controls.target);
      camera.position.copy(controls.target).addScaledVector(new THREE.Vector3(x, y, z).normalize(), dist);
      camTween = null;
    },
    setBeating: (on) => { beating = on; frozen = null; },
    // Hold the heart at one moment of the squeeze (0 relaxed .. 1 fully squeezed); used by the tests and for stills
    freezeAt: (s) => { frozen = s; },
    setTerritories: (on) => { showTerritories = on; recolorMyocardium(); },
    // Stop rendering and remove the canvas and labels (React unmounts the viewer this way)
    dispose: () => {
      disposed = true;
      clearTimeout(fallbackTimer);
      renderer.setAnimationLoop(null);
      sizeWatch.disconnect();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labelRenderer.domElement.remove();
    },
    resetView: () => {
      camTween = { from: camera.position.clone(), to: HOME.pos.clone(), t0: reduceMotion ? -Infinity : performance.now() };
      controls.target.copy(HOME.target);
    },
  };
  container.__viewer = api;          // a handle for the browser tests
  return api;
}
