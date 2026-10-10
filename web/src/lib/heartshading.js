// Realism for the anatomical heart, in three parts that share one coordinate frame:
//
//   bakeTissue()      once, when the model loads: epicardial fat that gathers along the arteries (the pale yellow
//                     shoulders a real heart has), soft occlusion in the grooves and where vessels meet the muscle
//   patchMaterial()   tissue texture (pores and mottling, patchy wet and dry shine, light that glows through thin
//                     flesh) and the beat, added to three's own physical material
//   deformPoint()     the beat itself: the ventricles shorten, narrow and wring, as a real heart does. The same
//                     maths runs in the vertex shader and here, so the labels' leader lines follow the surface
import * as THREE from "three";

// ---------------------------------------------------------------- the beat
// How far the ventricles move at full squeeze: a fraction of their width, of the heart's length, and an angle
export const BEAT = { narrow: 0.055, shorten: 0.075, wring: 0.16 };

// One set of uniforms for every part, so the muscle, the vessels and the cut ends always move together
export const beatUniforms = {
  uSys: { value: 0 },
  uCentre: { value: new THREE.Vector3() },
  uAxis: { value: new THREE.Vector3(0, -1, 0) },
  uLength: { value: 1 },
};

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// The squeeze over one heartbeat (phase 0..1): a quick contraction, a short hold, a slower relaxation.
// Matches the pressure timing of a real cycle: the atria fill the ventricles first, then the ventricles squeeze.
export function systole(phase) {
  if (phase < 0.14 || phase > 0.62) return 0;
  if (phase < 0.3) return smooth(0.14, 0.3, phase);
  if (phase < 0.38) return 1;
  return 1 - smooth(0.38, 0.62, phase);
}

const q = new THREE.Vector3(), rv = new THREE.Vector3(), cr = new THREE.Vector3();
// Where the point `p` (model space) is at squeeze `s` (0 = relaxed, 1 = fully squeezed), written into `out`
export function deformPoint(out, p, s) {
  const C = beatUniforms.uCentre.value, A = beatUniforms.uAxis.value, L = beatUniforms.uLength.value;
  if (s < 0.0005) return out.copy(p);
  q.copy(p).sub(C);
  let z = q.dot(A);
  rv.copy(q).addScaledVector(A, -z);
  const h = z / L, w = smooth(0.1, 0.5, h), hh = Math.min(1.05, Math.max(0, h));
  const th = BEAT.wring * s * w * hh;
  rv.multiplyScalar(1 - BEAT.narrow * s * w);
  cr.crossVectors(A, rv);
  rv.multiplyScalar(Math.cos(th)).addScaledVector(cr, Math.sin(th));
  z -= BEAT.shorten * s * w * hh * L;
  return out.copy(C).addScaledVector(A, z).add(rv);
}

const DEFORM_GLSL = `
uniform float uSys; uniform vec3 uCentre; uniform vec3 uAxis; uniform float uLength;
vec3 heartDeform(vec3 p) {
  if (uSys < 0.0005) return p;
  vec3 q = p - uCentre;
  float z = dot(q, uAxis);
  vec3 rv = q - uAxis * z;
  float h = z / uLength;
  float w = smoothstep(0.1, 0.5, h);
  float hh = clamp(h, 0.0, 1.05);
  float th = ${BEAT.wring.toFixed(4)} * uSys * w * hh;
  rv *= 1.0 - ${BEAT.narrow.toFixed(4)} * uSys * w;
  rv = rv * cos(th) + cross(uAxis, rv) * sin(th);
  z -= ${BEAT.shorten.toFixed(4)} * uSys * w * hh * uLength;
  return uCentre + uAxis * z + rv;
}`;

// ---------------------------------------------------------------- tissue texture
const NOISE_GLSL = `
float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s * 1.14; }
// bend the normal by the screen-space slope of a height field (the same method three uses for bump maps)
vec3 bumpNormal(vec3 surfPos, vec3 surfNorm, vec2 dHdxy, float faceDirection) {
  vec3 sx = normalize(dFdx(surfPos)), sy = normalize(dFdy(surfPos));
  vec3 r1 = cross(sy, surfNorm), r2 = cross(surfNorm, sx);
  float det = dot(sx, r1) * faceDirection;
  vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
  return normalize(abs(det) * surfNorm - grad);
}`;

// Adds the beat (and, unless `shade` is "none", the tissue texture) to a three.js physical material.
//   shade "tissue": the muscle: mottled colour, pores, patchy shine, fat that is lumpy and matt, subsurface glow
//   shade "vessel": the great vessels: the same, gentler
//   shade "none":   only the beat (the arteries: their colour must stay exactly the colour of their risk)
export function patchMaterial(material, { shade = "tissue" } = {}) {
  const shaded = shade !== "none";
  const k = shade === "tissue"
    ? { bump: 1.0, mott: 0.16, glow: 0.5, wet: 0.17 }
    : { bump: 0.5, mott: 0.07, glow: 0.18, wet: 0.1 };
  const u = { uBump: { value: k.bump }, uMott: { value: k.mott }, uGlow: { value: k.glow }, uWet: { value: k.wet },
    uFat: { value: new THREE.Color("#e2c47f") } };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, beatUniforms, shaded ? u : {});
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>
${DEFORM_GLSL}
${shaded ? "attribute float aFat; attribute float aAO; varying vec3 vObjPos; varying float vFat; varying float vAO;" : ""}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
transformed = heartDeform(transformed);
${shaded ? "vObjPos = position; vFat = aFat; vAO = aAO;" : ""}`);
    if (!shaded) return;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
uniform float uBump; uniform float uMott; uniform float uGlow; uniform float uWet; uniform vec3 uFat;
varying vec3 vObjPos; varying float vFat; varying float vAO;
${NOISE_GLSL}`)
      // colour: slow mottling, then the fat (its edge broken up by noise, so it is lobular at any zoom), then the
      // baked occlusion. `fatMask` stays in scope for the chunks below.
      .replace("#include <color_fragment>", `#include <color_fragment>
float fatMask = smoothstep(0.26, 0.62, vFat + (fbm(vObjPos * 11.0) - 0.5) * 0.34 + (fbm(vObjPos * 5.0) - 0.5) * 0.22);
{
  float m = fbm(vObjPos * 2.6) - 0.5;
  float fine = fbm(vObjPos * 17.0) - 0.5;
  diffuseColor.rgb *= 1.0 + uMott * m * 2.0 + 0.05 * fine;
  vec3 fatColour = uFat * (0.9 + 0.2 * fbm(vObjPos * 30.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, fatColour, fatMask);
  diffuseColor.rgb *= mix(1.0, vAO, 0.9);
}`)
      // shine: patchy wet and dry, and fat is matt
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + (fbm(vObjPos * 6.5) - 0.5) * uWet * 2.0 + fatMask * 0.34, 0.2, 1.0);`)
      // surface: fine pores everywhere, and larger lumps in the fat
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
{
  float hgt = fbm(vObjPos * 34.0) * 0.55 + fbm(vObjPos * 9.0) * (0.35 + fatMask * 1.1);
  normal = bumpNormal(-vViewPosition, normal, vec2(dFdx(hgt), dFdy(hgt)) * (0.16 * uBump), faceDirection);
}`)
      .replace("#include <lights_physical_fragment>", `#include <lights_physical_fragment>
#ifdef USE_CLEARCOAT
  material.clearcoat *= 1.0 - 0.75 * fatMask;
#endif`)
      // light that glows through thin flesh at the edges, warm and deep red, never on fat
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
{
  float facing = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
  totalEmissiveRadiance += uGlow * vec3(0.30, 0.035, 0.025) * pow(1.0 - facing, 2.2) * (1.0 - fatMask) * vAO;
}`);
  };
  material.customProgramCacheKey = () => `tria-heart-${shade}`;
}

// ---------------------------------------------------------------- baking
// A small value noise, to make the edge of the fat lumpy instead of a clean band
const hash = (x, y, z) => { let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); };
function vnoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(hash(ix, iy, iz), hash(ix + 1, iy, iz), sx), l(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), sx), sy),
           l(l(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), sx), l(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), sx), sy), sz);
}

// Spatial hash of a point set, for "how far is the nearest vessel" in constant time
function pointGrid(points, cell) {
  const map = new Map();
  const key = (x, y, z) => `${x},${y},${z}`;
  for (let i = 0; i < points.length; i += 3) {
    const k = key(Math.floor(points[i] / cell), Math.floor(points[i + 1] / cell), Math.floor(points[i + 2] / cell));
    let b = map.get(k); if (!b) map.set(k, (b = []));
    b.push(i);
  }
  return (x, y, z, max) => {
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    let best = max * max;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const bucket = map.get(key(cx + a, cy + b, cz + c));
      if (!bucket) continue;
      for (const i of bucket) {
        const dx = points[i] - x, dy = points[i + 1] - y, dz = points[i + 2] - z;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < best) best = d;
      }
    }
    return Math.sqrt(best);
  };
}

const subsample = (geo, every) => {
  const p = geo.getAttribute("position"), out = [];
  for (let i = 0; i < p.count; i += every) out.push(p.getX(i), p.getY(i), p.getZ(i));
  return out;
};

// Per-vertex neighbours, from the triangle list
function neighbours(geo) {
  const n = geo.getAttribute("position").count, idx = geo.index.array;
  const count = new Uint32Array(n + 1);
  for (let i = 0; i < idx.length; i += 3) for (let k = 0; k < 3; k++) count[idx[i + k] + 1] += 2;
  for (let i = 0; i < n; i++) count[i + 1] += count[i];
  const fill = count.slice(0, n), list = new Uint32Array(count[n]);
  for (let i = 0; i < idx.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const a = idx[i + k], b = idx[i + (k + 1) % 3];
      list[fill[a]++] = b; list[fill[b]++] = a;
    }
  }
  return { start: count, list };
}

// Occlusion from shape alone: a vertex that sits in a dent (its smoothed neighbourhood lies out along its normal)
// is darkened, a vertex on a bump is left alone. Two scales: crevices and the broad grooves between the chambers.
function concavity(geo, iterations) {
  const pos = geo.getAttribute("position"), nor = geo.getAttribute("normal"), n = pos.count;
  const { start, list } = neighbours(geo);
  let a = new Float32Array(pos.array), b = new Float32Array(n * 3);
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < n; i++) {
      const s = start[i], e = start[i + 1];
      if (e === s) { b[i * 3] = a[i * 3]; b[i * 3 + 1] = a[i * 3 + 1]; b[i * 3 + 2] = a[i * 3 + 2]; continue; }
      let x = 0, y = 0, z = 0;
      for (let j = s; j < e; j++) { const v = list[j] * 3; x += a[v]; y += a[v + 1]; z += a[v + 2]; }
      const inv = 1 / (e - s);
      b[i * 3] = x * inv; b[i * 3 + 1] = y * inv; b[i * 3 + 2] = z * inv;
    }
    [a, b] = [b, a];
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = (a[i * 3] - pos.getX(i)) * nor.getX(i) + (a[i * 3 + 1] - pos.getY(i)) * nor.getY(i) + (a[i * 3 + 2] - pos.getZ(i)) * nor.getZ(i);
  }
  return out;
}

const addAttribute = (geo, name, array) => geo.setAttribute(name, new THREE.BufferAttribute(array, 1));

// Prepares the loaded model. `parts` holds the geometries by name: myocardium, LAD, LCX, RCA, LM and the great
// vessels. Changes the muscle's surface (fat), gives every shaded part its `aFat` and `aAO` attributes and
// sets the beat's frame. Returns the fat amount per muscle vertex, so the caller can colour it.
export function bakeTissue(parts) {
  const myo = parts.myocardium;
  const arteries = ["LAD", "LCX", "RCA", "LM"].map((n) => parts[n]);
  const great = ["aorta", "pulmonary", "pulmonary_veins", "SVC", "IVC", "veins"].map((n) => parts[n]).filter(Boolean);
  for (const g of [myo, ...arteries, ...great]) g.computeVertexNormals();

  // --- the heart's long axis, from the left main (the base) to the end of the LAD (the apex)
  const lm = parts.LM.getAttribute("position"), lmC = new THREE.Vector3();
  for (let i = 0; i < lm.count; i++) lmC.add(new THREE.Vector3().fromBufferAttribute(lm, i));
  lmC.multiplyScalar(1 / lm.count);
  const lad = parts.LAD.getAttribute("position"), v = new THREE.Vector3(), apex = new THREE.Vector3();
  let far = -1;
  for (let i = 0; i < lad.count; i++) { v.fromBufferAttribute(lad, i); const d = v.distanceToSquared(lmC); if (d > far) { far = d; apex.copy(v); } }
  const length = Math.sqrt(far) * 1.08, axis = apex.clone().sub(lmC).normalize();
  beatUniforms.uCentre.value.copy(lmC);
  beatUniforms.uAxis.value.copy(axis);
  beatUniforms.uLength.value = length;

  // --- epicardial fat: gathers along the arteries, thick near the base and thin towards the apex, with a lumpy edge
  const nearArtery = pointGrid(arteries.flatMap((g) => subsample(g, 3)), 0.2);
  const nearAny = pointGrid([...arteries, ...great].flatMap((g) => subsample(g, 4)), 0.2);
  const pos = myo.getAttribute("position"), nor = myo.getAttribute("normal"), n = pos.count;
  const fat = new Float32Array(n), contact = new Float32Array(n);
  const FAT_REACH = 0.17, FAT_LIFT = 0.056;
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const h = (v.set(x, y, z).sub(lmC).dot(axis)) / length;
    const lumps = vnoise(x * 8, y * 8, z * 8) * 0.65 + vnoise(x * 15, y * 15, z * 15) * 0.35;
    const d = nearArtery(x, y, z, FAT_REACH + 0.1) - 0.05 + (lumps - 0.5) * 0.18;           // 0.05: the artery's own radius
    const heavy = 1 - 0.7 * smooth(0.35, 1.0, h);                                          // thinner towards the apex
    fat[i] = (1 - smooth(0.04, FAT_REACH, d)) * heavy;
    contact[i] = 1 - smooth(0.0, 0.1, nearAny(x, y, z, 0.2) - 0.05);                      // 1 right against a vessel
  }
  // spread the fat over its neighbours, so what is lifted is a soft swelling and not a ragged ridge
  {
    const { start, list } = neighbours(myo);
    let a = fat, b = new Float32Array(n);
    for (let pass = 0; pass < 7; pass++) {
      for (let i = 0; i < n; i++) {
        let s = a[i] * 2, c = 2;
        for (let j = start[i]; j < start[i + 1]; j++) { s += a[list[j]]; c++; }
        b[i] = s / c;
      }
      [a, b] = [b, a];
    }
    fat.set(a);
  }
  // lift the fat off the muscle, leaving a groove right next to each artery so the artery stays seen and legible
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const lumps = 0.7 + 0.6 * vnoise(x * 12 + 3, y * 12, z * 12);
    const groove = smooth(0.1, 0.5, fat[i]) ;                                              // fat that is really there
    const lift = FAT_LIFT * groove * lumps * smooth(0.12, 0.3, 1 - contact[i] + 0.0);
    pos.setXYZ(i, x + nor.getX(i) * lift, y + nor.getY(i) * lift, z + nor.getZ(i) * lift);
  }
  pos.needsUpdate = true;
  myo.computeVertexNormals();

  // --- soft occlusion: the grooves, the dents and wherever a vessel meets the muscle
  const shade = (geo, extra) => {
    const fine = concavity(geo, 4), broad = concavity(geo, 18), m = geo.getAttribute("position").count, ao = new Float32Array(m);
    for (let i = 0; i < m; i++) {
      const dark = 1.0 * Math.max(0, fine[i]) / 0.012 * 0.35 + Math.max(0, broad[i]) / 0.07 * 0.4 + (extra ? extra[i] * 0.5 : 0);
      ao[i] = Math.max(0.35, 1 - Math.min(0.65, dark));
    }
    addAttribute(geo, "aAO", ao);
  };
  shade(myo, contact);
  addAttribute(myo, "aFat", fat);
  for (const g of great) { shade(g); addAttribute(g, "aFat", new Float32Array(g.getAttribute("position").count)); }
  return { fat, frame: { centre: lmC, axis, length } };
}

// ---------------------------------------------------------------- studio light
// The reflections on glossy tissue are what the eye reads as wet. A room of windows (three's default) gives hard
// square glints; a photographer's set gives long soft ones: one large overhead box, a tall strip on one side, a faint
// kicker behind, over a dim warm room. Rendered once into the environment map.
export function studioScene() {
  const scene = new THREE.Scene();
  const room = new THREE.SphereGeometry(12, 32, 16);
  const shade = new Float32Array(room.attributes.position.count * 3);
  for (let i = 0; i < room.attributes.position.count; i++) {
    const t = (room.attributes.position.getY(i) / 12 + 1) / 2;                       // 0 floor .. 1 ceiling
    const c = t > 0.5 ? [0.2 + 0.34 * (t - 0.5) * 2, 0.2 + 0.34 * (t - 0.5) * 2, 0.22 + 0.36 * (t - 0.5) * 2] : [0.13 + 0.14 * t * 2, 0.11 + 0.1 * t * 2, 0.1 + 0.1 * t * 2];
    shade.set(c, i * 3);
  }
  room.setAttribute("color", new THREE.BufferAttribute(shade, 3));
  scene.add(new THREE.Mesh(room, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const panel = (w, h, at, power, tint = [1, 1, 1]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(...tint).multiplyScalar(power), side: THREE.DoubleSide }));
    m.position.set(...at); m.lookAt(0, 0, 0); scene.add(m);
  };
  panel(7, 5, [-3.5, 6.5, 5], 10.5, [1, 0.97, 0.93]);       // key: a large soft box, above and to the left
  panel(1.6, 8, [8, 1.5, 2.5], 4.2, [0.95, 0.97, 1]);     // fill: a tall strip on the right, slightly cool
  panel(5, 3, [0, 3, -9], 2.6, [1, 0.92, 0.88]);          // kicker: faint and warm, behind
  return scene;
}

// ---------------------------------------------------------------- coronary territories
// Which artery supplies which muscle, from the standard map of the left ventricle: the AHA 17-segment model
// (Cerqueira et al., Circulation 2002) with its usual coronary assignment (Pereztol-Valdés et al., Eur Heart J 2005):
//   LAD  the front wall, the front of the septum and the apex
//   LCX  the side and the back-side wall
//   RCA  the bottom (inferior) wall, and the whole right ventricle
// This replaces "whichever artery is nearest", which paints the right ventricle and the apex wherever a vessel
// happens to be close. Here the muscle is placed by its angle around the heart's long axis, measured from the front
// groove (where the LAD runs) towards the LCX, and by its height from base to apex.
export function computeTerritories(parts, frame, atrium) {
  const myo = parts.myocardium, pos = myo.getAttribute("position"), n = pos.count;
  const { centre: C, axis: A, length: L } = frame;
  const NB = 32, LO = -0.3, BIN = 0.05;
  const bin = (h) => Math.min(NB - 1, Math.max(0, Math.floor((h - LO) / BIN)));
  const p = new THREE.Vector3(), tmp = new THREE.Vector3();
  const heightOf = (x, y, z) => p.set(x, y, z).sub(C).dot(A) / L;

  // the middle of the ventricles and the front groove, level by level
  const filled = (sums, counts) => {
    const out = sums.map((s, i) => (counts[i] ? s.clone().multiplyScalar(1 / counts[i]) : null));
    for (let i = 0; i < NB; i++) {
      if (out[i]) continue;
      for (let d = 1; d < NB && !out[i]; d++) out[i] = (out[i - d] || out[i + d] || null) && (out[i - d] || out[i + d]).clone();
    }
    return out;
  };
  const cS = Array.from({ length: NB }, () => new THREE.Vector3()), cN = new Uint32Array(NB);
  const dS = Array.from({ length: NB }, () => new THREE.Vector3()), dN = new Uint32Array(NB);
  const h = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    h[i] = heightOf(pos.getX(i), pos.getY(i), pos.getZ(i));
    if (!atrium[i]) { const b = bin(h[i]); cS[b].add(tmp.fromBufferAttribute(pos, i)); cN[b]++; }
  }
  const lad = parts.LAD.getAttribute("position");
  for (let i = 0; i < lad.count; i++) { const b = bin(heightOf(lad.getX(i), lad.getY(i), lad.getZ(i))); dS[b].add(tmp.fromBufferAttribute(lad, i)); dN[b]++; }
  const centres = filled(cS, cN), grooves = filled(dS, dN);
  const across = (v, b, out) => out.copy(v).sub(centres[b]).addScaledVector(A, -v.clone().sub(centres[b]).dot(A));   // `v` seen from the axis
  const front = [], side = [];
  for (let b = 0; b < NB; b++) {
    const u = across(grooves[b], b, new THREE.Vector3()).normalize();
    front.push(u); side.push(new THREE.Vector3().crossVectors(A, u).normalize());
  }
  // which way round is "towards the LCX"? Measure it on the LCX itself
  const lcx = parts.LCX.getAttribute("position");
  let handed = 0;
  for (let i = 0; i < lcx.count; i++) {
    const hi = heightOf(lcx.getX(i), lcx.getY(i), lcx.getZ(i)); if (hi < 0.12) continue;
    const b = bin(hi); handed += across(tmp.fromBufferAttribute(lcx, i), b, new THREE.Vector3()).dot(side[b]);
  }
  const sign = handed >= 0 ? 1 : -1;

  const w = new Float32Array(n * 3), r = new THREE.Vector3(), q = new THREE.Vector3();
  const deg = 180 / Math.PI;
  for (let i = 0; i < n; i++) {
    if (atrium[i]) continue;
    const b = bin(h[i]);
    across(q.fromBufferAttribute(pos, i), b, r);
    const phi = Math.atan2(sign * r.dot(side[b]), r.dot(front[b])) * deg;            // 0 = front groove, + towards the LCX
    // left ventricle (phi > 0): front (LAD), side (LCX), bottom (RCA); right ventricle (phi < 0): RCA, LAD near the groove
    const lv = smooth(-14, 14, phi);
    const a = Math.max(0, phi), rv = Math.max(0, -phi);
    const lvLAD = 1 - smooth(40, 100, a), lvLCX = smooth(45, 95, a) * (1 - smooth(125, 165, a)), lvRCA = smooth(125, 170, a);
    let lad = lv * lvLAD + (1 - lv) * 0.65 * (1 - smooth(0, 45, rv));
    let lcx = lv * lvLCX;
    let rca = lv * lvRCA + (1 - lv) * (1 - 0.65 * (1 - smooth(0, 45, rv)));
    const apex = smooth(0.78, 0.95, h[i]);                                           // the apex belongs to the LAD
    lad = lad * (1 - apex) + 0.9 * apex; lcx = lcx * (1 - apex) + 0.05 * apex; rca = rca * (1 - apex) + 0.05 * apex;
    const s = lad + lcx + rca || 1;
    w[i * 3] = lad / s; w[i * 3 + 1] = lcx / s; w[i * 3 + 2] = rca / s;
  }
  // soften the steps that the slab-by-slab frame leaves
  const { start, list } = neighbours(myo);
  let a = w, b2 = new Float32Array(w.length);
  for (let pass = 0; pass < 5; pass++) {
    for (let i = 0; i < n; i++) {
      if (atrium[i]) { b2[i * 3] = b2[i * 3 + 1] = b2[i * 3 + 2] = 0; continue; }
      let x = a[i * 3] * 2, y = a[i * 3 + 1] * 2, z = a[i * 3 + 2] * 2, c = 2;
      for (let j = start[i]; j < start[i + 1]; j++) { const m = list[j] * 3; if (atrium[list[j]]) continue; x += a[m]; y += a[m + 1]; z += a[m + 2]; c++; }
      b2[i * 3] = x / c; b2[i * 3 + 1] = y / c; b2[i * 3 + 2] = z / c;
    }
    [a, b2] = [b2, a];
  }
  return a;
}

// ---------------------------------------------------------------- the cut ends of the vessels
// A dissected vessel shows a dark opening bounded by a lighter wall. The model has flat discs there, which read as
// black holes. Each disc is given a radial shade (deep in the middle, wall at the rim) in the colour of its vessel:
// arterial red for the aorta and pulmonary veins, venous blue for the venae cavae and the pulmonary trunk.
export function colourCaps(caps, parts) {
  const near = (names) => pointGrid(names.map((k) => parts[k]).filter(Boolean).flatMap((g) => subsample(g, 2)), 0.3);
  const red = near(["aorta", "pulmonary_veins"]), blue = near(["pulmonary", "SVC", "IVC"]);
  const pos = caps.getAttribute("position"), n = pos.count, { start, list } = neighbours(caps);
  const comp = new Int32Array(n).fill(-1), centre = [], radius = [];
  for (let s = 0; s < n; s++) {
    if (comp[s] >= 0) continue;
    const id = centre.length, stack = [s], c = new THREE.Vector3(); let count = 0;
    comp[s] = id;
    while (stack.length) {
      const i = stack.pop(); c.add(tmp3.fromBufferAttribute(pos, i)); count++;
      for (let j = start[i]; j < start[i + 1]; j++) if (comp[list[j]] < 0) { comp[list[j]] = id; stack.push(list[j]); }
    }
    centre.push(c.multiplyScalar(1 / count)); radius.push(0);
  }
  for (let i = 0; i < n; i++) radius[comp[i]] = Math.max(radius[comp[i]], tmp3.fromBufferAttribute(pos, i).distanceTo(centre[comp[i]]));
  const ART = [new THREE.Color("#220709"), new THREE.Color("#8d2227")], VEN = [new THREE.Color("#0d1024"), new THREE.Color("#3b4d8c")];
  const colours = new Float32Array(n * 3), out = new THREE.Color();
  for (let i = 0; i < n; i++) {
    tmp3.fromBufferAttribute(pos, i);
    const arterial = red(tmp3.x, tmp3.y, tmp3.z, 0.6) <= blue(tmp3.x, tmp3.y, tmp3.z, 0.6);
    const t = smooth(0.35, 1, tmp3.distanceTo(centre[comp[i]]) / (radius[comp[i]] || 1));
    const [deep, wall] = arterial ? ART : VEN;
    out.copy(deep).lerp(wall, t);
    colours.set([out.r, out.g, out.b], i * 3);
  }
  caps.setAttribute("color", new THREE.BufferAttribute(colours, 3));
}
const tmp3 = new THREE.Vector3();
