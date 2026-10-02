// flowstate: procedural heart, coronary arteries and torso rendered with Three.js.
//
// Heart-local frame: +y points to the base (top), the apex is at the bottom.
// theta is the angle around the long axis: 0 = anterior (+z), 90° = patient's left (+x),
// ±180° = posterior, -90° = patient's right (-x). h runs from -1 (apex) to +1 (top of the atria).
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

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
// Risk ramp shared with the page (see --risk-* in style.css)
const LOW = new THREE.Color("#2f9a68"), MID = new THREE.Color("#e0a21a"), HIGH = new THREE.Color("#c8352b");

// Score 0..1 anchored so that each model's cut-off sits exactly at the ochre midpoint;
// the colour reaches full green 30 points below the cut-off and full red 30 points above it
const RAMP_SPAN = 0.3;
export function riskScore(p, threshold) {
  return p < threshold
    ? 0.5 * Math.max(0, 1 - (threshold - p) / RAMP_SPAN)
    : 0.5 + 0.5 * Math.min(1, (p - threshold) / RAMP_SPAN);
}
export function riskColor(score) {
  const c = new THREE.Color();
  return score < 0.5
    ? c.lerpColors(LOW, MID, (score / 0.5) ** 2)
    : c.lerpColors(MID, HIGH, ((score - 0.5) / 0.5) ** 0.7);
}

// ---------------------------------------------------------------- viewer
export function createHeartViewer(container, { onSelect, reduceMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = "label-layer";
  container.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  const HOME = { pos: new THREE.Vector3(0.85, 0.85, 5.5), target: new THREE.Vector3(0.2, 0.45, 0) };
  camera.position.copy(HOME.pos);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(HOME.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 2.6;
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
  const heart = new THREE.Group();
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
  const nv = pos.count;
  const baseColors = new Float32Array(nv * 3);
  const terr = new Float32Array(nv * 3);
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
  const myocardium = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ vertexColors: true, ...tissue }));
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
  for (const [name, spec] of Object.entries(ARTERIES)) {
    // Not tone-mapped, so the rendered hue matches the label swatch and the panel B dot
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xa8807a, toneMapped: false, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25,
    });
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
      const anchor = new THREE.Object3D();
      const normal = surfaceNormal(q.x, q.y);
      const onArtery = surfacePoint(q.x, q.y).addScaledVector(normal, 0.05);
      anchor.position.copy(onArtery).addScaledVector(normal, 0.62);
      if (LABEL_NUDGE[name]) anchor.position.add(LABEL_NUDGE[name]);
      anchor.userData.normal = normal;
      heart.add(anchor);
      // Leader line from the artery to its label, as in an anatomy figure
      const leader = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([onArtery, anchor.position.clone()]),
        new THREE.LineBasicMaterial({ color: 0x14171c, transparent: true, opacity: 0.6 }),
      );
      heart.add(leader);
      const div = document.createElement("button");
      div.className = "vessel-label";
      div.type = "button";
      div.innerHTML = `<span class="sw"></span><b>${name}</b><span class="pct"></span>`;
      div.setAttribute("aria-label", `${name}: select this artery`);
      div.addEventListener("click", (e) => { e.stopPropagation(); select(name); onSelect?.(name); });
      const obj = new CSS2DObject(div);
      anchor.add(obj);
      labels[name] = { anchor, div, leader };
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

  // --- torso: translucent chest, ribs, sternum and spine for anatomical context
  const torso = new THREE.Group();
  scene.add(torso);
  const skinPts = [[2.1, -3.3], [2.3, -2.3], [2.48, -1.1], [2.66, 0.2], [2.78, 1.35], [2.66, 2.25], [2.15, 2.85],
    [1.15, 3.15], [0.72, 3.35], [0.66, 4.0]].map(([r, y]) => new THREE.Vector2(r, y));
  const skinGeo = new THREE.LatheGeometry(skinPts, 72);
  skinGeo.scale(1.22, 1, 0.74);
  const skin = new THREE.Mesh(skinGeo, new THREE.MeshStandardMaterial({
    color: 0x6b7079, transparent: true, opacity: 0.03, depthWrite: false, side: THREE.DoubleSide, roughness: 0.6,
  }));
  skin.renderOrder = 2;
  torso.add(skin);
  const BONE = new THREE.MeshStandardMaterial({ color: 0x8c9198, transparent: true, opacity: 0.16, roughness: 0.7, depthWrite: false });
  const gap = 0.55;
  for (let k = 0; k < 10; k++) {
    const y = 2.35 - k * 0.48;
    const f = Math.sin(Math.PI * (0.25 + 0.75 * k / 9));
    const rg = new THREE.TorusGeometry(1, 0.045, 8, 96, 2 * Math.PI - gap);
    rg.rotateZ(Math.PI / 2 + gap / 2);
    rg.rotateX(Math.PI / 2);
    rg.scale(1.7 + 1.15 * f, 1, 1.15 + 0.62 * f);
    const rib = new THREE.Mesh(rg, BONE);
    rib.position.y = y;
    rib.rotation.x = 0.28;
    rib.renderOrder = 1;
    torso.add(rib);
  }
  const sternum = new THREE.Mesh(new THREE.BoxGeometry(0.34, 2.5, 0.1), BONE);
  sternum.position.set(0, 1.05, 1.72);
  sternum.rotation.x = -0.12;
  torso.add(sternum);
  for (let y = -3.1; y < 3.3; y += 0.36) {
    const vert = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.26, 16), BONE);
    vert.position.set(0, y, -1.62);
    torso.add(vert);
  }

  // ---------------------------------------------------------------- state
  let risks = null;
  let selected = null;
  let hovered = null;
  let showTerritories = false;
  let beating = true;
  let bpm = 70;
  let camTween = null;
  const vesselColor = { LAD: new THREE.Color(0x888888), LCX: new THREE.Color(0x888888), RCA: new THREE.Color(0x888888) };

  function recolorMyocardium() {
    const colors = g.attributes.color;
    const names = ["LAD", "LCX", "RCA"];
    for (let i = 0; i < nv; i++) {
      let r = baseColors[i * 3], gg = baseColors[i * 3 + 1], b = baseColors[i * 3 + 2];
      if (risks) {
        for (let k = 0; k < 3; k++) {
          const name = names[k];
          // Selected artery: highlight the muscle it supplies. "Risk map": tint every territory.
          const strength = selected === name ? 0.32 : showTerritories ? (selected ? 0.16 : 0.4) : 0;
          if (!strength) continue;
          const w = terr[i * 3 + k] * strength;
          const c = vesselColor[name];
          r += (c.r - r) * w; gg += (c.g - gg) * w; b += (c.b - b) * w;
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
      div.querySelector(".pct").textContent = `${Math.round(next[name].probability * 100)}%`;
      div.querySelector(".sw").style.background = `#${vesselColor[name].getHexString()}`;
      div.setAttribute("aria-label", `${name}: ${Math.round(next[name].probability * 100)}% predicted risk. Select this artery`);
      div.classList.toggle("high", next[name].high);
    }
    refreshVessels();
    recolorMyocardium();
  }

  function select(name) {
    selected = name;
    for (const [n, { div }] of Object.entries(labels)) {
      div.classList.toggle("selected", n === name);
      div.setAttribute("aria-pressed", String(n === name));
    }
    refreshVessels();
    recolorMyocardium();
    if (name) {
      const dist = camera.position.distanceTo(controls.target);
      const dir = VIEW_DIRS[name].clone().normalize();
      camTween = { from: camera.position.clone(), to: controls.target.clone().addScaledVector(dir, dist), t0: performance.now() };
      if (reduceMotion) camTween.t0 = -Infinity;
    }
  }

  // ---------------------------------------------------------------- interaction
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downAt = null;
  function pick(ev) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([myocardium, ...vesselMeshes], false)[0];
    return hit && hit.object.userData.vessel ? hit.object.userData.vessel : null;
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
  new ResizeObserver(resize).observe(container);
  resize();

  const clock = new THREE.Clock();
  let phase = 0;
  const camDir = new THREE.Vector3(), wp = new THREE.Vector3(), wn = new THREE.Vector3();
  renderer.setAnimationLoop((time) => {
    const dt = clock.getDelta();
    if (beating) {
      phase = (phase + dt * bpm / 60) % 1;
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

  return {
    setRisks,
    select,
    setHeartRate: (value) => { bpm = THREE.MathUtils.clamp(value || 70, 30, 180); },
    setBeating: (on) => { beating = on; },
    setTorso: (on) => { torso.visible = on; },
    setTerritories: (on) => { showTerritories = on; recolorMyocardium(); },
    resetView: () => {
      camTween = { from: camera.position.clone(), to: HOME.pos.clone(), t0: reduceMotion ? -Infinity : performance.now() };
      controls.target.copy(HOME.target);
    },
  };
}
