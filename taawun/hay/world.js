// جولة في حيّ التعاون – عالم ثلاثي الأبعاد يميّز فيه التلميذ السلوك التعاوني
import * as THREE from 'three';
try { await Promise.race([Promise.all([document.fonts.load('900 60px Tajawal'), document.fonts.load('40px Lalezar')]), new Promise((r) => setTimeout(r, 2500))]); } catch (e) {}

const $ = (s) => document.querySelector(s);
const isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;

// ---------------------------------------------------------------- renderer & scene
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfeaff, 70, 170);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 400);

// sky dome with vertical gradient
{
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#3f8fe0'); gr.addColorStop(0.45, '#8fd0ff'); gr.addColorStop(0.62, '#dff3ff'); gr.addColorStop(1, '#fff3d6');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false }));
  scene.add(sky);
}
scene.add(new THREE.HemisphereLight(0xdff3ff, 0x7aa35a, 0.95));
const sunLight = new THREE.DirectionalLight(0xfff1d0, 2.1);
sunLight.position.set(40, 60, 25);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
Object.assign(sunLight.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 160 });
sunLight.shadow.bias = -0.0006;
scene.add(sunLight); scene.add(sunLight.target);

// ---------------------------------------------------------------- helpers
const M = {};
function mat(color, opt = {}) {
  const k = color + JSON.stringify(opt);
  if (!M[k]) M[k] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, flatShading: true }, opt));
  return M[k];
}
function mesh(geo, color, x = 0, y = 0, z = 0, opt) {
  const m = new THREE.Mesh(geo, typeof color === 'object' ? color : mat(color, opt));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
const rnd = (a, b) => a + Math.random() * (b - a);
const colliders = []; // {x,z,r}
function block(x, z, r) { colliders.push({ x, z, r }); }
const anim = []; // per-frame callbacks (t, dt)

// text sprite (Arabic)
function textSprite(text, opts = {}) {
  const fs = opts.size || 64, pad = 28;
  const c = document.createElement('canvas'); const g = c.getContext('2d');
  g.font = `900 ${fs}px Tajawal, Tahoma`;
  const w = Math.ceil(g.measureText(text).width) + pad * 2, h = fs + pad * 1.6;
  c.width = w; c.height = h;
  g.font = `900 ${fs}px Tajawal, Tahoma`; g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = opts.bg || 'rgba(255,253,243,.95)';
  const r = h / 2; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, r); g.fill();
  g.lineWidth = 6; g.strokeStyle = opts.border || '#f2b705'; g.stroke();
  g.fillStyle = opts.color || '#0b5e40'; g.fillText(text, w / 2, h / 2 + 4);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true }));
  const sc = (opts.scale || 1) * 0.012; sp.scale.set(w * sc, h * sc, 1);
  sp.userData.canvasW = w; return sp;
}

// ---------------------------------------------------------------- ground, beach, sea, paths
{
  const geo = new THREE.PlaneGeometry(220, 220, 80, 80); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, cols = [];
  const cA = new THREE.Color(0x7cc255), cB = new THREE.Color(0x96d46a), cS = new THREE.Color(0xf1d9a0);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const d = Math.hypot(x, z);
    let y = d > 75 ? (d - 75) * 0.25 + Math.sin(x * 0.2) * Math.cos(z * 0.2) * 1.5 : Math.sin(x * 0.15) * Math.cos(z * 0.13) * 0.18;
    if (z < -38) y = Math.min(y, -0.05 - (-38 - z) * 0.06);
    pos.setY(i, y);
    const c = z < -33 ? cS.clone() : cA.clone().lerp(cB, (Math.sin(x * 0.3) * Math.cos(z * 0.27) + 1) / 2);
    if (z < -33 && z > -36) c.lerp(cA, (z + 36) / 3);
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  ground.receiveShadow = true; ground.name = 'ground'; scene.add(ground);

  // sea
  const sg = new THREE.PlaneGeometry(260, 90, 90, 30); sg.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0x1fa3d6, roughness: 0.35, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.93 }));
  sea.position.set(0, -0.35, -86); sea.receiveShadow = true; scene.add(sea);
  const base = sg.attributes.position.array.slice();
  anim.push((t) => {
    const p = sg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3], z = base[i * 3 + 2];
      p.setY(i, Math.sin(x * 0.25 + t * 1.4) * 0.18 + Math.cos(z * 0.3 + t * 1.1) * 0.15);
    }
    p.needsUpdate = true; sg.computeVertexNormals();
  });

  // plaza
  const plaza = mesh(new THREE.CylinderGeometry(9, 9, 0.12, 40), 0xe9d8b4, 0, 0.06, 0); scene.add(plaza);
  const ring = mesh(new THREE.TorusGeometry(9, 0.25, 6, 48), 0xc9a227, 0, 0.12, 0); ring.rotation.x = Math.PI / 2; scene.add(ring);
}
function path(x1, z1, x2, z2) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const p = mesh(new THREE.BoxGeometry(2.6, 0.08, len), 0xe6cf9c, (x1 + x2) / 2, 0.04, (z1 + z2) / 2);
  p.rotation.y = Math.atan2(x2 - x1, z2 - z1); p.castShadow = false; scene.add(p);
}

// ---------------------------------------------------------------- fountain
{
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(3, 3.3, 0.8, 16), 0xf3e3c8, 0, 0.4, 0));
  g.add(mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.2, 16), 0x5ec4f0, 0, 0.75, 0, { roughness: 0.2 }));
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.45, 2.2, 8), 0xf3e3c8, 0, 1.6, 0));
  g.add(mesh(new THREE.CylinderGeometry(1.2, 0.6, 0.35, 12), 0xf3e3c8, 0, 2.7, 0));
  scene.add(g); block(0, 0, 3.6);
  const N = 160, geo = new THREE.BufferGeometry(), arr = new Float32Array(N * 3), vel = [];
  for (let i = 0; i < N; i++) { vel.push({ a: Math.random() * 6.28, s: rnd(0.6, 1.3), t: Math.random() }); }
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xbfeaff, size: 0.18, transparent: true, opacity: 0.9 }));
  scene.add(pts);
  anim.push((t, dt) => {
    for (let i = 0; i < N; i++) {
      const v = vel[i]; v.t += dt * 0.9; if (v.t > 1) v.t -= 1;
      const r = v.t * 2.2 * v.s; arr[i * 3] = Math.cos(v.a) * r; arr[i * 3 + 2] = Math.sin(v.a) * r;
      arr[i * 3 + 1] = 2.9 + v.t * 3 * v.s - 6 * v.t * v.t * v.s;
    }
    geo.attributes.position.needsUpdate = true;
  });
}

// ---------------------------------------------------------------- props
function palm(x, z, h = 6, dates = true) {
  const g = new THREE.Group(); const lean = rnd(-0.12, 0.12);
  for (let i = 0; i < 6; i++) {
    const seg = mesh(new THREE.CylinderGeometry(0.28 - i * 0.02, 0.34 - i * 0.02, h / 6, 7), i % 2 ? 0x9a6b3f : 0x87592f, Math.sin(lean) * i * h / 6, h / 12 + i * h / 6, 0);
    g.add(seg);
  }
  const top = new THREE.Vector3(Math.sin(lean) * h, h, 0);
  for (let i = 0; i < 8; i++) {
    const leaf = mesh(new THREE.ConeGeometry(0.45, 3.6, 4), i % 2 ? 0x2f9e44 : 0x3fae55);
    leaf.scale.set(1, 1, 0.25); leaf.position.copy(top);
    leaf.rotation.set(Math.PI / 2 + 0.55, 0, 0); const pivot = new THREE.Group(); pivot.position.copy(top);
    leaf.position.set(0, -0.3, 1.6); pivot.add(leaf); pivot.rotation.y = i * Math.PI / 4; g.add(pivot);
  }
  if (dates) for (let i = 0; i < 4; i++) {
    const cl = new THREE.Group(); const a = i * Math.PI / 2 + 0.4;
    for (let j = 0; j < 9; j++) cl.add(mesh(new THREE.SphereGeometry(0.13, 6, 5), j % 3 ? 0xb5651d : 0xe08a2b, rnd(-0.25, 0.25), -j * 0.09, rnd(-0.25, 0.25)));
    cl.position.set(top.x + Math.cos(a) * 0.55, h - 0.35, Math.sin(a) * 0.55); g.add(cl);
  }
  g.position.set(x, 0, z); g.rotation.y = rnd(0, 6.28); scene.add(g); block(x, z, 0.8);
  anim.push((t) => { g.rotation.z = Math.sin(t * 0.8 + x) * 0.02; });
  return g;
}
function fruitTree(x, z, fruit = 0xe63946) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.42, 2.6, 7), 0x8a5a35, 0, 1.3, 0));
  const c1 = mesh(new THREE.IcosahedronGeometry(2.1, 1), 0x3e9e45, 0, 3.6, 0); g.add(c1);
  g.add(mesh(new THREE.IcosahedronGeometry(1.5, 1), 0x4fb350, 1.2, 3.2, 0.4));
  g.add(mesh(new THREE.IcosahedronGeometry(1.4, 1), 0x4fb350, -1.1, 3.3, -0.3));
  for (let i = 0; i < 12; i++) {
    const a = rnd(0, 6.28), e = rnd(-0.3, 0.9);
    g.add(mesh(new THREE.SphereGeometry(0.22, 8, 6), fruit, Math.cos(a) * 2.05 * Math.cos(e), 3.6 + Math.sin(e) * 1.8, Math.sin(a) * 2.05 * Math.cos(e), { flatShading: false, roughness: 0.4 }));
  }
  g.position.set(x, 0, z); scene.add(g); block(x, z, 0.9);
}
function bush(x, z, s = 1, col = 0x4caf50) { const b = mesh(new THREE.IcosahedronGeometry(0.9 * s, 0), col, x, 0.6 * s, z); scene.add(b); }
function rock(x, z, s = 1) { const r = mesh(new THREE.DodecahedronGeometry(0.6 * s, 0), 0xa9a39a, x, 0.3 * s, z); r.rotation.set(rnd(0, 3), rnd(0, 3), 0); scene.add(r); }

// person builder (used for Salman and villagers)
function person({ robe = 0xffffff, skin = 0xf1c79c, hair = 0x3b2414, headwear = null, scale = 1, girl = false } = {}) {
  const g = new THREE.Group(); const parts = {};
  const body = mesh(new THREE.CylinderGeometry(0.3, 0.46, 1.15, 12), robe, 0, 0.78, 0, { flatShading: false, roughness: 0.7 }); g.add(body);
  const chest = mesh(new THREE.SphereGeometry(0.31, 12, 8), robe, 0, 1.33, 0, { flatShading: false, roughness: 0.7 }); chest.scale.set(1, 0.8, 0.9); g.add(chest);
  const head = new THREE.Group(); head.position.set(0, 1.72, 0); g.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.34, 16, 12), skin, 0, 0, 0, { flatShading: false, roughness: 0.6 }));
  const eyeM = mat(0x1d1d1d, { flatShading: false });
  [-0.12, 0.12].forEach((ex) => { const e = mesh(new THREE.SphereGeometry(0.055, 8, 6), eyeM, ex, 0.04, 0.3); e.castShadow = false; head.add(e); });
  const smile = mesh(new THREE.TorusGeometry(0.09, 0.022, 6, 12, Math.PI), 0x9c2f2f, 0, -0.1, 0.31); smile.rotation.z = Math.PI; smile.castShadow = false; head.add(smile);
  [-0.2, 0.2].forEach((ex) => { const c = mesh(new THREE.SphereGeometry(0.06, 8, 6), 0xff9aa2, ex, -0.06, 0.27, { flatShading: false }); c.castShadow = false; head.add(c); });
  if (headwear === 'ghutra') {
    const gh = mesh(new THREE.SphereGeometry(0.38, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), 0xffffff, 0, 0.04, -0.02, { flatShading: false }); head.add(gh);
    const back = mesh(new THREE.CylinderGeometry(0.36, 0.44, 0.6, 14, 1, true, Math.PI * 0.6, Math.PI * 0.8), 0xffffff, 0, -0.15, -0.02, { side: THREE.DoubleSide, flatShading: false }); back.rotation.y = Math.PI; head.add(back);
    const ag = mesh(new THREE.TorusGeometry(0.33, 0.045, 6, 24), 0x111111, 0, 0.17, 0); ag.rotation.x = Math.PI / 2; head.add(ag);
  } else if (headwear === 'hijab') {
    const hj = mesh(new THREE.SphereGeometry(0.4, 18, 12, Math.PI / 2 + 0.75, Math.PI * 2 - 1.5, 0, Math.PI * 0.72), hair, 0, 0.02, -0.03, { flatShading: false, side: THREE.DoubleSide }); head.add(hj);
    const nk = mesh(new THREE.CylinderGeometry(0.33, 0.42, 0.45, 14, 1, true, Math.PI * 0.62, Math.PI * 0.76), hair, 0, -0.22, 0, { side: THREE.DoubleSide, flatShading: false }); nk.rotation.y = Math.PI; head.add(nk);
  } else {
    for (let i = 0; i < 22; i++) {
      const a = rnd(0, 6.28), e = rnd(0.25, 1.35);
      if (Math.sin(a) > 0.55 && e < 0.9) continue; // keep face clear
      const c = mesh(new THREE.SphereGeometry(rnd(0.1, 0.14), 7, 5), hair, Math.cos(a) * Math.cos(e) * 0.33, Math.sin(e) * 0.33 + 0.04, Math.sin(a) * Math.cos(e) * 0.33 - 0.02, { flatShading: false });
      c.castShadow = false; head.add(c);
    }
  }
  const armGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.62, 8); armGeo.translate(0, -0.31, 0);
  parts.arms = [-1, 1].map((s) => {
    const a = new THREE.Group(); a.position.set(s * 0.36, 1.43, 0);
    a.add(mesh(armGeo, robe, 0, 0, 0, { flatShading: false, roughness: 0.7 }));
    a.add(mesh(new THREE.SphereGeometry(0.09, 8, 6), skin, 0, -0.64, 0, { flatShading: false }));
    a.rotation.z = s * 0.12; g.add(a); return a;
  });
  parts.feet = [-1, 1].map((s) => { const f = mesh(new THREE.BoxGeometry(0.16, 0.12, 0.3), 0x2b2b2b, s * 0.15, 0.06, 0.04); g.add(f); return f; });
  parts.head = head; parts.body = body;
  g.scale.setScalar(scale); g.userData.parts = parts;
  return g;
}

function building(x, z, w, d, h, color, rotY = 0) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(w, h, d), color, 0, h / 2, 0, { flatShading: true, roughness: 0.95 }));
  g.add(mesh(new THREE.BoxGeometry(w + 0.3, 0.5, d + 0.3), 0xffffff, 0, h + 0.25, 0));
  for (let i = -w / 2 + 0.6; i <= w / 2 - 0.6; i += 1.2) g.add(mesh(new THREE.BoxGeometry(0.5, 0.45, 0.5), 0xffffff, i, h + 0.7, d / 2));
  g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g); return g;
}
// ---------------------------------------------------------------- situations (cooperation)
const ZONES = [
  { id: 'table', x: -24, z: 30, coop: true, title: 'يساعد أمه في ترتيب المائدة', why: 'يعمل مع أمه، ويؤدي دوره في عمل خير… فهذا تعاون.' },
  { id: 'sweep', x: 36, z: 25, coop: false, title: 'يلعب بينما زملاؤه ينظّفون الساحة', why: 'تركهم يتعبون وحدهم ولم يؤدِّ دوره… فليس هذا تعاونًا.' },
  { id: 'carry', x: 16, z: 36, coop: true, title: 'يحملان الطاولة معًا', why: 'يعملان معًا، وكل واحد يحمل من جهة… فهذا تعاون.' },
  { id: 'neighbor', x: -38, z: -12, coop: true, title: 'يحملان أغراض الجار المسنّ', why: 'يساعدان جارهما في عمل خير… والجار له حق علينا.' },
  { id: 'beach', x: 0, z: -31, coop: true, title: 'ينظّفون الشاطئ معًا', why: 'يعملون معًا لخير الناس جميعًا… فهذا تعاون محمود.' },
  { id: 'wall', x: 38, z: -12, coop: false, title: 'يكتبان معًا على جدار المدرسة', why: 'اجتمعا على عمل خاطئ يُفسد المدرسة… وهذا تعاون على الإثم نهانا الله عنه.' },
  { id: 'grandma', x: -44, z: 14, coop: true, title: 'تزور الأسرة الجدّة المريضة', why: 'يتعاون الأقارب على زيارة الجدّة وإسعادها… فهذا تعاون على البرّ.' },
  { id: 'share', x: 2, z: 22, coop: false, title: 'يرفض أن يشارك أدواته مع مجموعته', why: 'لم يساعد مجموعته فتأخر عملهم… فليس هذا تعاونًا.' },
];
$('#tot').textContent = ZONES.length;
ZONES.forEach((zn, i) => {
  path(0, 0, zn.x * 0.8, zn.z * 0.8);
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.8, 4.4, 40), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.55 }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(zn.x, 0.15, zn.z); scene.add(ring);
  const sign = textSprite('🔍 الموقف ' + (i + 1), { size: 60, color: '#5e2e8f', border: '#9b5de5', scale: 0.75 }); sign.position.set(zn.x, 6.3, zn.z); scene.add(sign);
  zn.ring = ring; zn.sign = sign; zn.done = false; zn.n = i + 1;
  anim.push((t) => { ring.material.opacity = zn.done ? 0.45 : 0.35 + Math.sin(t * 3 + zn.x) * 0.25; sign.position.y = 6.3 + Math.sin(t * 1.5 + zn.z) * 0.15; });
});
const villagers = [];
function addP(opts, x, z, ry = 0, face = false) { const p = person(opts); p.position.set(x, 0, z); p.rotation.y = ry; scene.add(p); block(x, z, 0.5); if (face) villagers.push(p); return p; }
const MUM = { robe: 0x1d1d1d, headwear: 'hijab', hair: 0x1d1d1d, scale: 1.2 };
const DAD = { robe: 0xffffff, headwear: 'ghutra', scale: 1.3 };
const KID = { robe: 0xffffff, scale: 0.85 };
const GIRL = { robe: 0x7a3e9d, headwear: 'hijab', hair: 0xf3f3f3, scale: 0.85 };
const OLD = { robe: 0xefe6d2, headwear: 'ghutra', skin: 0xe9b98e, scale: 1.25 };
function table(x, z, w = 2.4, d = 1.3, col = 0xb07a45) {
  const g = new THREE.Group(); g.add(mesh(new THREE.BoxGeometry(w, 0.12, d), col, 0, 1.0, 0));
  [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([a, b]) => g.add(mesh(new THREE.BoxGeometry(0.1, 1, 0.1), col, a * (w / 2 - 0.12), 0.5, b * (d / 2 - 0.12))));
  g.position.set(x, 0, z); scene.add(g); return g;
}
function broom() { const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), 0x9a6b3f, 0, 0.8, 0)); g.add(mesh(new THREE.ConeGeometry(0.28, 0.45, 8), 0xe9c46a, 0, 0.1, 0)); return g; }
function box(s = 0.6, col = 0xc8a26b) { return mesh(new THREE.BoxGeometry(s, s * 0.8, s), col); }
function waveArms(p, sp = 3, amp = 0.5, base = -0.6) { const [l, r] = p.userData.parts.arms; const ph = Math.random() * 6; anim.push((t) => { l.rotation.x = base + Math.sin(t * sp + ph) * amp; r.rotation.x = base + Math.sin(t * sp + ph + Math.PI) * amp; }); }
function holdArms(p, x = -1.1) { p.userData.parts.arms.forEach((a) => { a.rotation.x = x; }); }

// 1) home: helping mother set the table (cooperative)
{
  const zx = -24, zz = 30;
  const house = building(zx, zz + 13, 11, 7, 4.2, 0xf3e3c8);
  house.add(mesh(new THREE.BoxGeometry(1.6, 2.6, 0.12), 0x8a5a35, 0, 1.3, 3.55));
  for (let i = -5; i <= 5; i += 1.5) block(zx + i, zz + 13 - 3.6, 1);
  table(zx, zz, 2.6, 1.4);
  for (let i = 0; i < 4; i++) { const pl = mesh(new THREE.CylinderGeometry(0.25, 0.22, 0.05, 14), 0xffffff, zx - 0.9 + i * 0.6, 1.09, zz + (i % 2 ? 0.3 : -0.3), { flatShading: false }); scene.add(pl); }
  scene.add(mesh(new THREE.SphereGeometry(0.35, 10, 8), 0x7cc576, zx, 1.25, zz, { flatShading: false }));
  block(zx, zz, 1.6);
  const mum = addP(MUM, zx + 1.9, zz + 0.2, -Math.PI / 2, true); waveArms(mum, 2.2, 0.35, -0.9);
  const kid = addP(KID, zx - 1.9, zz - 0.2, Math.PI / 2, true); holdArms(kid, -1.2);
  const plate = mesh(new THREE.CylinderGeometry(0.25, 0.22, 0.05, 14), 0xffffff, 0, 0, 0, { flatShading: false }); scene.add(plate);
  anim.push((t) => { const k = (Math.sin(t * 1.2) + 1) / 2; kid.position.x = zx - 2.6 + k * 0.7; plate.position.set(kid.position.x + 0.55, 1.35 + Math.sin(t * 2.4) * 0.03, zz - 0.2); });
}
// 2) school yard: two sweep, one plays (not cooperative)
{
  const zx = 36, zz = 25;
  [[-1.5, 0.5], [1.4, -0.8]].forEach(([dx, dz], i) => {
    const p = addP(KID, zx + dx, zz + dz, i ? 2.4 : -0.8); holdArms(p, -0.9);
    const b = broom(); b.position.set(zx + dx + 0.5, 0, zz + dz + 0.3); b.rotation.z = 0.3; scene.add(b);
    anim.push((t) => { b.rotation.z = 0.3 + Math.sin(t * 4 + i) * 0.35; p.rotation.y = (i ? 2.4 : -0.8) + Math.sin(t * 4 + i) * 0.2; });
  });
  for (let i = 0; i < 7; i++) { const leaf = mesh(new THREE.BoxGeometry(0.25, 0.02, 0.15), 0xd4a373, zx + rnd(-3, 3), 0.03, zz + rnd(-2, 2)); leaf.castShadow = false; scene.add(leaf); }
  const bench = new THREE.Group(); bench.add(mesh(new THREE.BoxGeometry(2, 0.12, 0.6), 0x9a6b3f, 0, 0.55, 0)); bench.add(mesh(new THREE.BoxGeometry(0.12, 0.55, 0.5), 0x6e4426, -0.85, 0.27, 0)); bench.add(mesh(new THREE.BoxGeometry(0.12, 0.55, 0.5), 0x6e4426, 0.85, 0.27, 0));
  bench.position.set(zx + 2.5, 0, zz + 3); scene.add(bench); block(zx + 2.5, zz + 3, 1.1);
  const lazy = person(KID); lazy.position.set(zx + 2.5, 0.25, zz + 3); lazy.rotation.y = -2.6; lazy.scale.setScalar(0.85); scene.add(lazy); holdArms(lazy, -1.3);
  const pad = mesh(new THREE.BoxGeometry(0.45, 0.08, 0.25), 0x222222); scene.add(pad);
  const lp = new THREE.Vector3(); anim.push((t) => { lazy.getWorldPosition(lp); pad.position.set(lp.x + Math.sin(-2.6) * 0.45, 1.15 + Math.sin(t * 8) * 0.02, lp.z + Math.cos(-2.6) * 0.45); pad.rotation.y = -2.6; lazy.userData.parts.head.rotation.x = 0.35; });
  scene.add(mesh(new THREE.SphereGeometry(0.06, 6, 4), 0x4cc9f0)); // spark
}
// 3) school: two boys carrying a table together (cooperative)
{
  const zx = 16, zz = 36;
  const sc = building(24, 50, 16, 7, 5.2, 0xf6e7c1);
  for (let r = 0; r < 2; r++) for (let i = -6; i <= 6; i += 2.4) sc.add(mesh(new THREE.BoxGeometry(1.4, 1, 0.1), 0x6fc3f0, i, 1.5 + r * 2, 3.56, { roughness: 0.2 }));
  sc.add(mesh(new THREE.BoxGeometry(2.2, 2.6, 0.12), 0x2f6b9a, 0, 1.3, 3.56));
  for (let i = -7.5; i <= 7.5; i += 1.5) block(24 + i, 50 - 3.6, 1);
  const board = textSprite('مدرستي 📚', { size: 56, color: '#1a4f8a', border: '#2b8cee' }); board.position.set(24, 6.4, 46.4); scene.add(board);
  scene.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 8, 6), 0xdddddd, 34, 4, 45)); block(34, 45, 0.4);
  const fc = document.createElement('canvas'); fc.width = 300; fc.height = 180; const g = fc.getContext('2d');
  g.fillStyle = '#ce1126'; g.fillRect(0, 0, 300, 180); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, 0); g.lineTo(80, 0);
  for (let i = 0; i < 5; i++) { g.lineTo(110, 18 + i * 36); g.lineTo(80, 36 + i * 36); } g.lineTo(0, 180); g.fill();
  const ft = new THREE.CanvasTexture(fc); ft.colorSpace = THREE.SRGBColorSpace;
  const fgeo = new THREE.PlaneGeometry(3, 1.8, 12, 1); const flag = new THREE.Mesh(fgeo, new THREE.MeshStandardMaterial({ map: ft, side: THREE.DoubleSide })); flag.position.set(35.5, 7, 45); scene.add(flag);
  const fb = fgeo.attributes.position.array.slice();
  anim.push((t) => { const p = fgeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = fb[i * 3]; p.setZ(i, Math.sin(x * 2 + t * 5) * 0.15 * (x + 1.5) / 3); } p.needsUpdate = true; });
  const grp = new THREE.Group(); scene.add(grp);
  const tb = table(0, 0, 2.2, 1.1); scene.remove(tb); grp.add(tb); tb.position.set(0, 0.25, 0);
  const a = person(KID); a.position.set(-1.5, 0, 0); a.rotation.y = Math.PI / 2; grp.add(a); holdArms(a, -1.0);
  const b = person({ robe: 0xffffff, scale: 0.85 }); b.position.set(1.5, 0, 0); b.rotation.y = -Math.PI / 2; grp.add(b); holdArms(b, -1.0);
  a.scale.setScalar(0.85);
  anim.push((t) => { grp.position.set(zx + Math.sin(t * 0.5) * 3, Math.abs(Math.sin(t * 3)) * 0.05, zz); grp.rotation.y = Math.PI / 2; });
}
// 4) neighbour: carrying boxes for the old neighbour (cooperative)
{
  const zx = -38, zz = -12;
  const h = building(zx - 3, zz - 9, 9, 6, 4, 0xeadbc0);
  h.add(mesh(new THREE.BoxGeometry(1.5, 2.5, 0.12), 0x5b6b7b, 0, 1.25, 3.05));
  for (let i = -4.5; i <= 4.5; i += 1.5) block(zx - 3 + i, zz - 9 + 3, 1);
  const old = addP(OLD, zx - 3, zz - 4.6, 0, true);
  const cane = mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6), 0x6e4426, zx - 2.45, 0.7, zz - 4.4); scene.add(cane);
  const car = new THREE.Group(); car.add(mesh(new THREE.BoxGeometry(2, 1, 4), 0x4aa3df, 0, 0.8, 0)); car.add(mesh(new THREE.BoxGeometry(1.8, 0.8, 2), 0xbfe3ff, 0, 1.6, 0.3));
  [[-1, -1.3], [1, -1.3], [-1, 1.3], [1, 1.3]].forEach(([a, b]) => { const w = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12), 0x222222, a, 0.4, b); w.rotation.z = Math.PI / 2; car.add(w); });
  car.position.set(zx + 4.5, 0, zz + 1); scene.add(car); block(zx + 4.5, zz, 1.5); block(zx + 4.5, zz + 2, 1.5);
  [0, 1].forEach((i) => {
    const k = person(i ? GIRL : KID); scene.add(k); holdArms(k, -1.25);
    const bx = box(0.6); scene.add(bx);
    anim.push((t) => {
      const ph = (t * 0.22 + i * 0.5) % 1, go = ph < 0.5; const u = go ? ph * 2 : (1 - ph) * 2;
      const sx = zx + 3.5, sz = zz + 0.5 + i * 1.2, ex = zx - 2.2 + i * 1.3, ez = zz - 3.6;
      k.position.set(sx + (ex - sx) * u, Math.abs(Math.sin(t * 9)) * 0.05, sz + (ez - sz) * u);
      k.rotation.y = Math.atan2((ex - sx) * (go ? 1 : -1), (ez - sz) * (go ? 1 : -1));
      bx.visible = go; bx.position.set(k.position.x + Math.sin(k.rotation.y) * 0.45, 1.25, k.position.z + Math.cos(k.rotation.y) * 0.45); bx.rotation.y = k.rotation.y;
      const w = Math.sin(t * 9) * 0.4; k.userData.parts.feet[0].position.z = 0.04 + w * 0.6; k.userData.parts.feet[1].position.z = 0.04 - w * 0.6;
      if (!go) k.userData.parts.arms.forEach((a, j) => { a.rotation.x = (j ? 1 : -1) * w; }); else holdArms(k, -1.25);
    });
  });
  [0, 1, 2].forEach((i) => { const bx = box(0.6, 0xc8a26b); bx.position.set(zx - 3.8 + i * 0.7, 0.25, zz - 3.6); scene.add(bx); });
}
// 5) beach clean-up (cooperative)
{
  const zx = 0, zz = -33;
  const bag = mesh(new THREE.SphereGeometry(0.55, 10, 8), 0x222222, zx, 0.5, zz, { flatShading: false, roughness: 0.3 }); bag.scale.set(1, 1.3, 1); scene.add(bag); block(zx, zz, 0.7);
  [[-2, 0.6], [2, 0.4], [0.3, 2]].forEach(([dx, dz], i) => {
    const k = addP(i === 1 ? GIRL : KID, zx + dx, zz + dz, Math.atan2(-dx, -dz)); holdArms(k, -0.7);
    anim.push((t) => { k.userData.parts.body.rotation.x = Math.max(0, Math.sin(t * 2 + i)) * 0.35; k.userData.parts.head.position.z = Math.max(0, Math.sin(t * 2 + i)) * 0.25; });
  });
  for (let i = 0; i < 6; i++) { const c = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8), [0xe63946, 0x4aa3df][i % 2], zx + rnd(-4, 4), 0.1, zz + rnd(-1, 2.5)); c.rotation.z = Math.PI / 2; scene.add(c); }
}
// 6) graffiti on the school wall (not cooperative)
{
  const zx = 38, zz = -12;
  const wall = mesh(new THREE.BoxGeometry(12, 3, 0.5), 0xf3e3c8, zx, 1.5, zz - 3.2); scene.add(wall);
  for (let i = -5.5; i <= 5.5; i += 1.2) block(zx + i, zz - 3.2, 0.7);
  const gc = document.createElement('canvas'); gc.width = 512; gc.height = 128; const g = gc.getContext('2d');
  g.lineWidth = 12; g.lineCap = 'round'; ['#e63946', '#2b8cee', '#2fbf71', '#9b5de5'].forEach((c, i) => { g.strokeStyle = c; g.beginPath(); g.moveTo(40 + i * 110, 90); for (let k = 0; k < 6; k++) g.lineTo(60 + i * 110 + k * 14, k % 2 ? 30 : 100); g.stroke(); });
  const gt = new THREE.CanvasTexture(gc); gt.colorSpace = THREE.SRGBColorSpace;
  const gp = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: gt, transparent: true })); gp.position.set(zx, 1.6, zz - 2.94); scene.add(gp);
  [-1.2, 1.2].forEach((dx, i) => {
    const k = addP(KID, zx + dx, zz - 1.8, Math.PI); const arm = k.userData.parts.arms[1];
    const can = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.3, 10), ['#e63946', '#2b8cee'][i] === '#e63946' ? 0xe63946 : 0x2b8cee, zx + dx + 0.4, 0.15, zz - 1.4); scene.add(can);
    anim.push((t) => { arm.rotation.x = -2.2 + Math.sin(t * 6 + i) * 0.3; arm.rotation.z = Math.sin(t * 3 + i) * 0.4; });
  });
}
// 7) relatives visiting sick grandmother (cooperative)
{
  const zx = -44, zz = 14;
  const tent = new THREE.Group();
  [[-3, -2], [3, -2], [-3, 2], [3, 2]].forEach(([a, b]) => tent.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 3, 6), 0x8a5a35, a, 1.5, b)));
  const roof = mesh(new THREE.BoxGeometry(6.8, 0.15, 4.8), 0xc0392b, 0, 3.05, 0); tent.add(roof);
  tent.add(mesh(new THREE.BoxGeometry(6.8, 0.6, 0.05), 0xf2b705, 0, 2.75, 2.4));
  tent.position.set(zx, 0, zz - 1); scene.add(tent);
  const bed = new THREE.Group(); bed.add(mesh(new THREE.BoxGeometry(1.4, 0.5, 2.4), 0xffffff, 0, 0.45, 0)); bed.add(mesh(new THREE.BoxGeometry(1.5, 0.9, 0.12), 0x8a5a35, 0, 0.6, -1.2));
  bed.add(mesh(new THREE.BoxGeometry(1.3, 0.12, 1.6), 0xff9aa2, 0, 0.75, 0.35));
  bed.position.set(zx, 0, zz - 1.5); scene.add(bed); block(zx, zz - 1.5, 1.3);
  const gm = person({ robe: 0xffffff, headwear: 'hijab', hair: 0xffffff, skin: 0xe9b98e, scale: 1 });
  gm.position.set(zx, 0.75, zz - 2.4); gm.rotation.x = -1.2; gm.scale.setScalar(0.95); scene.add(gm);
  const fam = [[DAD, -2, 0.6], [MUM, 2, 0.4], [KID, -1, 1.6], [GIRL, 1, 1.7]];
  fam.forEach(([o, dx, dz], i) => { const p = addP(o, zx + dx, zz + dz - 1, Math.atan2(-dx, -(dz + 0.6)), true); if (i === 3) { holdArms(p, -1.1); const fl = new THREE.Group(); for (let j = 0; j < 5; j++) fl.add(mesh(new THREE.SphereGeometry(0.1, 6, 4), [0xff6f91, 0xffd23f, 0xffffff][j % 3], rnd(-0.15, 0.15), rnd(0, 0.2), rnd(-0.15, 0.15))); fl.position.set(zx + dx - 0.2, 1.25, zz + dz - 1.4); scene.add(fl); } });
}
// 8) refusing to share tools in a group project (not cooperative)
{
  const zx = 2, zz = 22;
  table(zx, zz, 3, 1.6, 0xd9b38c); block(zx, zz, 1.8);
  const paper = mesh(new THREE.BoxGeometry(1.6, 0.02, 1), 0xffffff, zx, 1.08, zz); scene.add(paper);
  const pa = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), new THREE.MeshBasicMaterial({ color: 0x7cc576 })); pa.rotation.x = -Math.PI / 2; pa.position.set(zx, 1.1, zz); scene.add(pa);
  const k1 = addP(KID, zx - 0.6, zz - 1.4, 0); const k2 = addP(GIRL, zx + 0.6, zz - 1.4, 0);
  [k1, k2].forEach((k, i) => anim.push((t) => { k.userData.parts.arms[1].rotation.x = -0.6 + Math.sin(t * 2 + i) * 0.4; k.userData.parts.head.rotation.y = Math.sin(t * 0.8 + i) * 0.4 + 0.3; }));
  const sel = addP(KID, zx + 2.3, zz + 0.4, -Math.PI / 2 - 0.4);
  const [l, r] = sel.userData.parts.arms; l.rotation.set(-1.3, 0, 0.9); r.rotation.set(-1.3, 0, -0.9);
  const pc = new THREE.Group(); pc.add(mesh(new THREE.BoxGeometry(0.6, 0.12, 0.35), 0x2b8cee)); for (let i = 0; i < 6; i++) pc.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 5), [0xe63946, 0xffd23f, 0x2fbf71, 0x9b5de5, 0xff8a3d, 0x4aa3df][i], -0.25 + i * 0.1, 0.2, 0));
  scene.add(pc);
  const sp = new THREE.Vector3(); anim.push((t) => { sel.getWorldPosition(sp); pc.position.set(sp.x - 0.4, 1.3, sp.z + 0.25); sel.rotation.y = -Math.PI / 2 - 0.4 + Math.sin(t * 1.5) * 0.25; });
}
// sea, boat, birds, clouds, decor
{
  const boat = new THREE.Group();
  boat.add(mesh(new THREE.BoxGeometry(5, 1, 1.8), 0xb5651d, 0, 0.3, 0));
  boat.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.5, 6), 0x7a4b25, 0, 2.6, 0));
  const sailGeo = new THREE.BufferGeometry(); sailGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.9, 0, 0, 4.7, 0, 2.6, 0.9, 0], 3)); sailGeo.computeVertexNormals();
  boat.add(new THREE.Mesh(sailGeo, new THREE.MeshStandardMaterial({ color: 0xfff8e7, side: THREE.DoubleSide })));
  boat.position.set(-12, -0.2, -52); scene.add(boat);
  anim.push((t) => { boat.position.y = -0.2 + Math.sin(t * 1.3) * 0.15; boat.rotation.z = Math.sin(t * 1.1) * 0.05; boat.position.x = -12 + Math.sin(t * 0.08) * 18; });
  palm(13, -33, 5.5, false); palm(-14, -33.5, 6, false);
}
{
  const birds = [];
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Group(); const wingGeo = new THREE.BoxGeometry(0.9, 0.04, 0.3); wingGeo.translate(0.45, 0, 0);
    const w1 = mesh(wingGeo, 0xffffff); const w2 = mesh(wingGeo, 0xffffff); w2.rotation.y = Math.PI;
    b.add(mesh(new THREE.SphereGeometry(0.18, 8, 6), 0xffffff), w1, w2);
    b.userData = { r: rnd(14, 34), h: rnd(11, 17), sp: rnd(0.15, 0.3) * (i % 2 ? 1 : -1), ph: rnd(0, 6.28), w1, w2, cx: i < 4 ? 0 : -30, cz: i < 4 ? -40 : 10 };
    scene.add(b); birds.push(b);
  }
  anim.push((t) => birds.forEach((b) => { const u = b.userData, a = t * u.sp + u.ph; b.position.set(u.cx + Math.cos(a) * u.r, u.h + Math.sin(t * 2 + u.ph) * 0.5, u.cz + Math.sin(a) * u.r); b.rotation.y = -a + (u.sp > 0 ? 0 : Math.PI); const f = Math.sin(t * 9 + u.ph) * 0.6; u.w1.rotation.z = f; u.w2.rotation.z = -f; }));
}
{
  const clouds = [];
  const cloud = (x, y, z, s = 1) => { const g = new THREE.Group(); const m = mat(0xffffff, { flatShading: false, roughness: 1 }); for (let i = 0; i < 6; i++) g.add(mesh(new THREE.SphereGeometry(rnd(1.4, 2.3) * s, 10, 8), m, rnd(-2.6, 2.6) * s, rnd(-0.4, 0.6) * s, rnd(-1.2, 1.2) * s)); g.position.set(x, y, z); scene.add(g); return g; };
  for (let i = 0; i < 9; i++) { const c = cloud(rnd(-90, 90), rnd(26, 38), rnd(-90, 60), rnd(1, 1.8)); c.userData.sp = rnd(0.4, 1); clouds.push(c); }
  anim.push((t, dt) => clouds.forEach((c) => { c.position.x += c.userData.sp * dt; if (c.position.x > 110) c.position.x = -110; }));
}
{
  building(-8, 58, 9, 6, 4, 0xeadbc0); building(52, 4, 7, 9, 4.5, 0xf1e0c5, Math.PI / 2); building(-58, -2, 7, 9, 4, 0xf3e3c8, Math.PI / 2);
  const tuft = new THREE.ConeGeometry(0.12, 0.5, 3);
  const inst = new THREE.InstancedMesh(tuft, mat(0x5aa83e), 800); const d = new THREE.Object3D(); let n = 0;
  for (let i = 0; i < 2000 && n < 800; i++) { const x = rnd(-70, 70), z = rnd(-30, 70); if (Math.hypot(x, z) < 10 || ZONES.some((zn) => Math.hypot(x - zn.x, z - zn.z) < 5)) continue; d.position.set(x, 0.2, z); d.rotation.set(rnd(-0.2, 0.2), rnd(0, 6), rnd(-0.2, 0.2)); d.scale.setScalar(rnd(0.6, 1.3)); d.updateMatrix(); inst.setMatrixAt(n++, d.matrix); }
  inst.count = n; scene.add(inst);
  const fl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 6, 4), new THREE.MeshStandardMaterial({ color: 0xffffff }), 260); n = 0;
  const fcols = [0xff6f91, 0xffd23f, 0xb388ff, 0xffffff, 0xff8a3d];
  for (let i = 0; i < 600 && n < 260; i++) { const x = rnd(-70, 70), z = rnd(-30, 70); if (Math.hypot(x, z) < 10) continue; d.position.set(x, 0.32, z); d.rotation.set(0, 0, 0); d.scale.setScalar(1); d.updateMatrix(); fl.setMatrixAt(n, d.matrix); fl.setColorAt(n, new THREE.Color(fcols[n % 5])); n++; }
  fl.count = n; scene.add(fl);
  for (let i = 0; i < 16; i++) { const a = rnd(0, 6.28), r = rnd(60, 72); palm(Math.cos(a) * r, Math.max(-28, Math.sin(a) * r), rnd(6, 8), false); }
  [[-12, 10], [12, 10], [-14, -10], [14, -12], [22, 8], [-28, 2]].forEach(([x, z]) => palm(x, z, rnd(5.5, 7)));
  for (let i = 0; i < 10; i++) bush(rnd(-55, 55), rnd(-25, 60), rnd(0.7, 1.2), [0x4caf50, 0xe56b9a, 0x58b85c][i % 3]);
}

// ---------------------------------------------------------------- player
const player = person({ robe: 0xffffff, scale: 1 });
player.position.set(0, 0, 9); scene.add(player);
const P = player.userData.parts;
const shadowBlob = new THREE.Mesh(new THREE.CircleGeometry(0.6, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 }));
shadowBlob.rotation.x = -Math.PI / 2; shadowBlob.position.y = 0.03; scene.add(shadowBlob);
const marker = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.65, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
marker.rotation.x = -Math.PI / 2; marker.visible = false; scene.add(marker);

// ---------------------------------------------------------------- input
const keys = {};
addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; if (e.key.startsWith('Arrow')) e.preventDefault(); target = null; });
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
let camYaw = Math.PI, camPitch = 0.42, camDist = 11, target = null;
let dragging = false, lastX = 0, lastY = 0, downX = 0, downY = 0, downT = 0;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const cv = renderer.domElement;
cv.addEventListener('pointerdown', (e) => { dragging = true; lastX = downX = e.clientX; lastY = downY = e.clientY; downT = performance.now(); cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', (e) => { if (!dragging) return; camYaw -= (e.clientX - lastX) * 0.006; camPitch = Math.min(1.1, Math.max(0.18, camPitch + (e.clientY - lastY) * 0.004)); lastX = e.clientX; lastY = e.clientY; });
cv.addEventListener('pointerup', (e) => {
  dragging = false;
  if (Math.hypot(e.clientX - downX, e.clientY - downY) < 8 && performance.now() - downT < 450) {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(scene.getObjectByName('ground'))[0];
    if (hit) { target = hit.point.clone(); target.y = 0; marker.position.set(target.x, 0.06, target.z); marker.visible = true; }
  }
});
cv.addEventListener('wheel', (e) => { camDist = Math.min(20, Math.max(6, camDist + e.deltaY * 0.01)); }, { passive: true });
// joystick
const joy = $('#joy'), knob = joy.querySelector('i'); let jv = { x: 0, y: 0 };
if (isTouch) joy.style.display = 'block';
joy.addEventListener('pointerdown', (e) => { joy.setPointerCapture(e.pointerId); joyMove(e); target = null; });
joy.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') joyMove(e); });
joy.addEventListener('pointerup', () => { jv = { x: 0, y: 0 }; knob.style.transform = ''; });
function joyMove(e) { const r = joy.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2); const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } jv = { x, y }; knob.style.transform = `translate(${x * 45}px,${y * 45}px)`; }

// ---------------------------------------------------------------- audio
let ac = null, muted = false, master = null, waveGain = null;
function audio() {
  if (ac) return; try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  master = ac.createGain(); master.gain.value = 0.8; master.connect(ac.destination);
  const b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = b.getChannelData(0); let last = 0;
  for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  const src = ac.createBufferSource(); src.buffer = b; src.loop = true; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
  waveGain = ac.createGain(); waveGain.gain.value = 0; src.connect(f); f.connect(waveGain); waveGain.connect(master); src.start();
}
function tone(fr, d, type = 'sine', v = 0.2, when = 0) { if (!ac || muted) return; const t = ac.currentTime + when, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = fr; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.05); }
function chime() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.5, 'triangle', 0.18, i * 0.11)); }
function chirp() { const f = 2200 + Math.random() * 900; tone(f, 0.08, 'sine', 0.05); tone(f * 1.2, 0.08, 'sine', 0.05, 0.1); }
function step() { tone(140 + Math.random() * 40, 0.06, 'triangle', 0.05); }
function fixAr(s){ s=s.replace(/[ً-ْٰ]/g,'');
  var R=[[/(^|[^؀-ۿ])النعم(?=$|[^؀-ۿ])/g,'$1النِّعَم'],[/(^|[^؀-ۿ])نعمتين/g,'$1نِعْمَتَيْن'],[/(^|[^؀-ۿ])(ب|و|ف|ل|ك)?نعمة/g,'$1$2نِعْمَة'],[/(^|[^؀-ۿ])نعم الله/g,'$1نِعَمَ الله'],[/(^|[^؀-ۿ])نعمه(?=$|[^؀-ۿ])/g,'$1نِعَمِه']];
  R.forEach(function(r){ s=s.replace(r[0],r[1]); }); return s; }
function say(text) { if (muted || !window.speechSynthesis) return; try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(fixAr(text).replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, '')); u.lang = 'ar-SA'; u.rate = 0.92; const v = speechSynthesis.getVoices().find((x) => /^ar/i.test(x.lang)); if (v) u.voice = v; speechSynthesis.speak(u); } catch (e) {} }
$('#mute').onclick = () => { muted = !muted; $('#mute').textContent = muted ? '🔇' : '🔊'; if (master) master.gain.value = muted ? 0 : 0.8; if (muted && window.speechSynthesis) speechSynthesis.cancel(); };
$('#fs').onclick = () => { try { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); } catch (e) {} };

// ---------------------------------------------------------------- confetti (2D overlay)
const cc = $('#conf'), cx = cc.getContext('2d'); let parts = [];
function confetti(n = 160) { cc.width = innerWidth; cc.height = innerHeight; const cols = ['#ffb703', '#2fbf71', '#f0545c', '#2b8cee', '#9b5de5']; for (let i = 0; i < n; i++) parts.push({ x: innerWidth / 2 + rnd(-150, 150), y: innerHeight * 0.3, vx: rnd(-9, 9), vy: rnd(-14, -4), r: rnd(5, 11), c: cols[i % 5], a: rnd(0, 6), l: 0 }); }
function drawConf() { if (!parts.length) return; cx.clearRect(0, 0, cc.width, cc.height); parts.forEach((p) => { p.vy += 0.4; p.x += p.vx; p.y += p.vy; p.a += 0.2; p.l++; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.a); cx.fillStyle = p.c; cx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); cx.restore(); }); parts = parts.filter((p) => p.y < cc.height + 30 && p.l < 300); if (!parts.length) cx.clearRect(0, 0, cc.width, cc.height); }

// ---------------------------------------------------------------- questions
let doneN = 0, score = 0, quizZ = null, tries = 0;
function openQuiz(zn) {
  quizZ = zn; tries = 0; target = null; marker.visible = false;
  $('#qN').textContent = '🔍 الموقف ' + zn.n + ' من ' + ZONES.length; $('#qT').textContent = zn.title;
  $('#qWhy').textContent = ''; $('#qWhy').className = ''; $('#qBtns').style.display = 'flex'; $('#qNext').style.display = 'none';
  $('#quiz').classList.add('on'); tone(660, 0.2, 'triangle', 0.15); tone(880, 0.25, 'triangle', 0.15, 0.12);
  say(zn.title + '. تعاوني أم غير تعاوني؟');
}
function answer(c) {
  const zn = quizZ; if (!zn || zn.done) return;
  if (c === zn.coop) {
    if (!tries) score++; zn.done = true; doneN++; $('#cnt').textContent = doneN;
    zn.ring.material.color.set(zn.coop ? 0x2fbf71 : 0xf0545c);
    const st = textSprite(zn.coop ? '✔ تعاوني' : '✖ غير تعاوني', { size: 60, bg: zn.coop ? '#2fbf71' : '#f0545c', border: '#ffffff', color: '#ffffff', scale: 0.8 });
    st.position.set(zn.x, 7.4, zn.z); scene.add(st);
    $('#qWhy').textContent = (zn.coop ? '✔ سلوك تعاوني: ' : '✖ سلوك غير تعاوني: ') + zn.why; $('#qWhy').className = zn.coop ? 'ok' : 'no';
    $('#qBtns').style.display = 'none'; $('#qNext').style.display = 'inline-block';
    chime(); if (zn.coop) confetti(80); say((zn.coop ? 'أحسنتم! سلوك تعاوني. ' : 'أحسنتم! سلوك غير تعاوني. ') + zn.why);
  } else {
    tries++; tone(300, 0.25, 'sawtooth', 0.12); tone(200, 0.35, 'sawtooth', 0.1, 0.2);
    const q = $('#quiz'); q.classList.remove('shake'); void q.offsetWidth; q.classList.add('shake');
    $('#qWhy').textContent = '🤔 افحصوا السلوك: هل يعملون معًا؟ هل يؤدي كل واحد دوره؟ هل هو عمل خير؟'; $('#qWhy').className = 'hint';
  }
}
function closeQuiz() {
  $('#quiz').classList.remove('on'); quizZ = null;
  if (doneN === ZONES.length) setTimeout(() => {
    $('#fScore').textContent = 'ميّزتم ' + score + ' من ' + ZONES.length + ' مواقف من المحاولة الأولى 🕵️';
    $('#final').style.display = 'flex'; confetti(260); [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.6, 'triangle', 0.2, i * 0.15));
    say('أحسنتم يا أبطال! وتعاونوا على البر والتقوى، ولا تعاونوا على الإثم والعدوان');
  }, 400);
}
$('#yes').onclick = () => answer(true); $('#no').onclick = () => answer(false); $('#qNext').onclick = closeQuiz;

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock(); let walkPh = 0, stepT = 0, chirpT = 2, speedNow = 0;
const camPos = new THREE.Vector3(), lookAt = new THREE.Vector3();
function update(dt, t) {
  // input vector (camera-relative)
  let ix = 0, iz = 0;
  if (quizZ) { target = null; }
  if (keys['arrowup'] || keys['w'] || keys['ص']) iz -= 1;
  if (keys['arrowdown'] || keys['s'] || keys['س']) iz += 1;
  if (keys['arrowleft'] || keys['a'] || keys['ش']) ix -= 1;
  if (keys['arrowright'] || keys['d'] || keys['ي']) ix += 1;
  ix += jv.x; iz += jv.y; if (quizZ) { ix = 0; iz = 0; }
  let mx = 0, mz = 0;
  if (ix || iz) {
    const l = Math.min(1, Math.hypot(ix, iz)); const a = Math.atan2(ix, iz);
    const dirA = a + camYaw; mx = Math.sin(dirA) * l; mz = Math.cos(dirA) * l; marker.visible = false; target = null;
  } else if (target) {
    const dx = target.x - player.position.x, dz = target.z - player.position.z, d = Math.hypot(dx, dz);
    if (d < 0.4) { target = null; marker.visible = false; } else { mx = dx / d; mz = dz / d; }
  }
  const run = keys['shift'] ? 1.6 : 1; const want = (mx || mz) ? 6.2 * run : 0;
  speedNow += (want - speedNow) * Math.min(1, dt * 8);
  if (mx || mz) {
    const ang = Math.atan2(mx, mz); let da = ang - player.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da)); player.rotation.y += da * Math.min(1, dt * 10);
    const ml = Math.hypot(mx, mz); player.position.x += (mx / ml) * speedNow * dt; player.position.z += (mz / ml) * speedNow * dt;
    if (ix || iz) { let dy = (player.rotation.y + Math.PI) - camYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); if (iz < 0) camYaw += dy * Math.min(1, dt * 1.2); }
  }
  // collisions & bounds
  colliders.forEach((c) => { const dx = player.position.x - c.x, dz = player.position.z - c.z, d = Math.hypot(dx, dz), r = c.r + 0.5; if (d < r && d > 0.0001) { player.position.x = c.x + dx / d * r; player.position.z = c.z + dz / d * r; } });
  const pd = Math.hypot(player.position.x, player.position.z); if (pd > 68) { player.position.x *= 68 / pd; player.position.z *= 68 / pd; }
  if (player.position.z < -36.5) player.position.z = -36.5;
  // walk animation
  const moving = speedNow > 0.3; walkPh += dt * speedNow * 1.6;
  const sw = moving ? Math.sin(walkPh) : 0;
  P.arms[0].rotation.x = sw * 0.7; P.arms[1].rotation.x = -sw * 0.7;
  P.feet[0].position.z = 0.04 + sw * 0.28; P.feet[1].position.z = 0.04 - sw * 0.28;
  P.feet[0].position.y = 0.06 + Math.max(0, sw) * 0.1; P.feet[1].position.y = 0.06 + Math.max(0, -sw) * 0.1;
  player.position.y = moving ? Math.abs(Math.sin(walkPh)) * 0.09 : Math.sin(t * 2) * 0.015;
  P.head.rotation.z = moving ? Math.sin(walkPh) * 0.05 : Math.sin(t * 0.8) * 0.04;
  P.body.rotation.z = moving ? Math.sin(walkPh) * 0.04 : 0;
  shadowBlob.position.x = player.position.x; shadowBlob.position.z = player.position.z;
  if (moving) { stepT -= dt * speedNow / 6.2; if (stepT <= 0) { stepT = 0.33; step(); } }
  if (marker.visible) marker.scale.setScalar(1 + Math.sin(t * 6) * 0.15);
  // camera
  let tx = player.position.x, tz = player.position.z;
  if (quizZ) { const want = Math.atan2(tx - quizZ.x, tz - quizZ.z); let dy = want - camYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); camYaw += dy * Math.min(1, dt * 3); camPitch += (0.5 - camPitch) * Math.min(1, dt * 2); tx = (tx + quizZ.x) / 2; tz = (tz + quizZ.z) / 2; }
  camPos.set(tx + Math.sin(camYaw) * Math.cos(camPitch) * camDist, 1.6 + Math.sin(camPitch) * camDist, tz + Math.cos(camYaw) * Math.cos(camPitch) * camDist);
  camera.position.lerp(camPos, Math.min(1, dt * 6)); lookAt.lerp(new THREE.Vector3(tx, 1.7, tz), Math.min(1, dt * 8)); camera.lookAt(lookAt);
  sunLight.position.set(tx + 40, 60, tz + 25); sunLight.target.position.set(tx, 0, tz);
  // villagers face player when near
  villagers.forEach((v) => { const d = v.position.distanceTo(player.position); if (d < 8) { const a = Math.atan2(player.position.x - v.position.x, player.position.z - v.position.z); let da = a - v.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da)); v.rotation.y += da * Math.min(1, dt * 3); } });
  // zones
  if (!quizZ) ZONES.forEach((zn) => { if (!zn.done && Math.hypot(player.position.x - zn.x, player.position.z - zn.z) < 5.3) openQuiz(zn); });
  // ambient
  if (waveGain) waveGain.gain.value = muted ? 0 : Math.max(0, 0.5 - (player.position.z + 36) * 0.02);
  chirpT -= dt; if (chirpT < 0) { chirpT = rnd(2.5, 6); chirp(); }
}
let started = false;
function frame() {
  const dt = Math.min(0.1, clock.getDelta()), t = clock.elapsedTime;
  anim.forEach((f) => f(t, dt));
  if (started) update(dt, t); else { camYaw += dt * 0.12; camera.position.set(Math.sin(camYaw) * 30, 16, Math.cos(camYaw) * 30 + 5); camera.lookAt(0, 2, 5); }
  renderer.render(scene, camera); drawConf();
  requestAnimationFrame(frame);
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
frame();
$('#loading').textContent = '';
$('#go').onclick = () => { audio(); started = true; camYaw = Math.PI; $('#start').style.display = 'none'; say('هيا نتجول مع سلمان في حي التعاون'); };
window.__game = { player, ZONES, keys, answer, closeQuiz, get done() { return doneN; }, get score() { return score; }, teleport(x, z) { player.position.set(x, 0, z); } };
