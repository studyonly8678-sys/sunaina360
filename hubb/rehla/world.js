// رحلة في عالم النعم – عالم ثلاثي الأبعاد يتجوّل فيه سلمان
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
    p.needsUpdate = true;
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
  const eyeM = mat(0x2a1a12, { flatShading: false, roughness: 0.3 }), whiteM = mat(0xffffff, { flatShading: false, roughness: 0.4 }), browM = mat(headwear === 'hijab' ? 0x3b2414 : hair, { flatShading: false });
  const eyes = [];
  [-0.125, 0.125].forEach((ex) => {
    const eg = new THREE.Group(); eg.position.set(ex, 0.05, 0.288);
    const w = mesh(new THREE.SphereGeometry(0.085, 12, 10), whiteM); w.scale.set(0.9, 1.05, 0.5); w.castShadow = false; eg.add(w);
    const pu = mesh(new THREE.SphereGeometry(0.05, 10, 8), eyeM, ex > 0 ? -0.008 : 0.008, -0.005, 0.03); pu.scale.z = 0.5; pu.castShadow = false; eg.add(pu);
    const hl = mesh(new THREE.SphereGeometry(0.016, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0.018, 0.022, 0.055); hl.castShadow = false; eg.add(hl);
    head.add(eg); eyes.push(eg);
    const br = mesh(new THREE.BoxGeometry(0.12, 0.024, 0.03), browM, ex, 0.175, 0.3); br.rotation.z = ex > 0 ? -0.18 : 0.18; br.castShadow = false; head.add(br);
  });
  const nose = mesh(new THREE.SphereGeometry(0.035, 8, 6), skin, 0, -0.025, 0.335, { flatShading: false, roughness: 0.6 }); nose.castShadow = false; head.add(nose);
  const blinkPh = Math.random() * 5;
  anim.push((t) => { const b = ((t + blinkPh) % 4.2) < 0.13 ? 0.12 : 1; eyes[0].scale.y = b; eyes[1].scale.y = b; });
  const smile = mesh(new THREE.TorusGeometry(0.095, 0.024, 6, 14, Math.PI), 0x9c2f2f, 0, -0.105, 0.305); smile.rotation.z = Math.PI; smile.castShadow = false; head.add(smile);
  [-0.2, 0.2].forEach((ex) => { const c = mesh(new THREE.SphereGeometry(0.06, 8, 6), 0xff9aa2, ex, -0.06, 0.27, { flatShading: false }); c.castShadow = false; head.add(c); });
  if (headwear === 'ghutra') {
    const gh = mesh(new THREE.SphereGeometry(0.385, 18, 10, Math.PI / 2 + 0.8, Math.PI * 2 - 1.6, 0, Math.PI * 0.62), 0xffffff, 0, 0.03, -0.02, { flatShading: false, side: THREE.DoubleSide }); head.add(mesh(new THREE.SphereGeometry(0.385, 18, 6, 0, Math.PI * 2, 0, Math.PI * 0.3), 0xffffff, 0, 0.03, -0.02, { flatShading: false })); head.add(gh);
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

// ---------------------------------------------------------------- zones (blessings)
const ZONES = [
  { id: 'sea', x: 0, z: -31, title: '🌊 نعمة البحر', text: 'سخّر الله لنا البحر؛ نأكل منه السمك، وتسير فيه السفن.' },
  { id: 'rain', x: -36, z: -16, title: '🌧️ نعمة المطر', text: 'يُنزل الله المطر، فنشرب منه ويخضرّ الزرع.' },
  { id: 'palm', x: 36, z: -16, title: '🌴 نعمة النخيل والتمر', text: 'رزقنا الله النخيل، ونأكل من تمرها الحلو.' },
  { id: 'animals', x: -42, z: 18, title: '🐑 نعمة الحيوانات', text: 'خلق الله الأنعام؛ نشرب حليبها ونستفيد منها.' },
  { id: 'fruit', x: 42, z: 18, title: '🍎 نعمة الفواكه', text: 'فواكه ملوّنة لذيذة… رزقٌ من الله تعالى.' },
  { id: 'sun', x: 0, z: 24, title: '☀️ نعمة الشمس', text: 'تمنحنا الشمس الضوء والدفء، وتُنضج الثمار.' },
  { id: 'home', x: -22, z: 44, title: '🏠 نعمة الأسرة والبيت', text: 'بيتٌ آمن وأسرة تحبّني… نعمة من الله.' },
  { id: 'school', x: 24, z: 44, title: '🏫 نعمة العقل والعلم', text: 'كرّمني الله بالعقل، فأتعلّم في مدرستي.' },
];
$('#tot').textContent = ZONES.length;
ZONES.forEach((zn) => {
  path(0, 0, zn.x * 0.82, zn.z * 0.82);
  const ringM = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.55 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.6, 4.2, 40), ringM); ring.rotation.x = -Math.PI / 2; ring.position.set(zn.x, 0.15, zn.z); scene.add(ring);
  const sign = textSprite(zn.title.replace(/^\S+\s/, '') , { size: 62, scale: 1 }); sign.position.set(zn.x, 6.2, zn.z); scene.add(sign);
  const emo = textSprite(zn.title.split(' ')[0], { size: 70, bg: 'rgba(255,255,255,0)', border: 'rgba(0,0,0,0)', scale: 1.2 }); emo.position.set(zn.x, 7.7, zn.z); scene.add(emo);
  zn.ring = ring; zn.sign = sign; zn.found = false;
  anim.push((t) => { ring.material.opacity = zn.found ? 0.35 : 0.35 + Math.sin(t * 3 + zn.x) * 0.25; sign.position.y = 6.2 + Math.sin(t * 1.5 + zn.z) * 0.15; emo.position.y = 7.7 + Math.sin(t * 1.5 + zn.z) * 0.15; });
});

// sea zone: boat + jumping fish + seagulls
{
  const boat = new THREE.Group();
  const hull = mesh(new THREE.BoxGeometry(5, 1, 1.8), 0xb5651d, 0, 0.3, 0); boat.add(hull);
  const bow = mesh(new THREE.ConeGeometry(0.9, 1.6, 4), 0xb5651d, 3.2, 0.3, 0); bow.rotation.z = -Math.PI / 2; bow.rotation.x = Math.PI / 4; boat.add(bow);
  boat.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.5, 6), 0x7a4b25, 0, 2.6, 0));
  const sailGeo = new THREE.BufferGeometry(); sailGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.9, 0, 0, 4.7, 0, 2.6, 0.9, 0], 3)); sailGeo.computeVertexNormals();
  boat.add(new THREE.Mesh(sailGeo, new THREE.MeshStandardMaterial({ color: 0xfff8e7, side: THREE.DoubleSide })));
  boat.position.set(-12, -0.2, -52); scene.add(boat);
  anim.push((t) => { boat.position.y = -0.2 + Math.sin(t * 1.3) * 0.15; boat.rotation.z = Math.sin(t * 1.1) * 0.05; boat.position.x = -12 + Math.sin(t * 0.08) * 18; });
  const fishes = [];
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Group();
    const b = mesh(new THREE.SphereGeometry(0.4, 10, 8), [0xff8a3d, 0xffb703, 0x4aa3df][i % 3], 0, 0, 0, { flatShading: false, roughness: 0.4 }); b.scale.set(1.6, 1, 0.6); f.add(b);
    const tail = mesh(new THREE.ConeGeometry(0.32, 0.5, 4), [0xff8a3d, 0xffb703, 0x4aa3df][i % 3], -0.75, 0, 0); tail.rotation.z = Math.PI / 2; f.add(tail);
    f.userData = { x: rnd(-14, 14), z: rnd(-46, -40), ph: i * 1.3 }; scene.add(f); fishes.push(f);
  }
  anim.push((t) => fishes.forEach((f) => {
    const k = ((t * 0.5 + f.userData.ph) % 3) / 3; const jump = k < 0.35 ? k / 0.35 : -1;
    if (jump >= 0) { f.visible = true; f.position.set(f.userData.x + jump * 4, -0.3 + Math.sin(jump * Math.PI) * 2.6, f.userData.z); f.rotation.z = Math.cos(jump * Math.PI) * 0.9; }
    else f.visible = false;
  }));
  rock(8, -36, 1.4); rock(-9, -37, 1.1); palm(13, -33, 5.5, false); palm(-14, -33.5, 6, false);
  // shells & starfish on sand
  for (let i = 0; i < 6; i++) { const s = mesh(new THREE.ConeGeometry(0.25, 0.15, 5), 0xff9aa2, rnd(-12, 12), 0.05, rnd(-37, -34)); s.castShadow = false; scene.add(s); }
}
// birds (global)
{
  const birds = [];
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Group();
    const wingGeo = new THREE.BoxGeometry(0.9, 0.04, 0.3); wingGeo.translate(0.45, 0, 0);
    const w1 = mesh(wingGeo, 0xffffff); const w2 = mesh(wingGeo, 0xffffff); w2.rotation.y = Math.PI;
    b.add(mesh(new THREE.SphereGeometry(0.18, 8, 6), 0xffffff), w1, w2);
    b.userData = { r: rnd(14, 34), h: rnd(11, 17), sp: rnd(0.15, 0.3) * (i % 2 ? 1 : -1), ph: rnd(0, 6.28), w1, w2, cx: i < 4 ? 0 : -30, cz: i < 4 ? -40 : 10 };
    scene.add(b); birds.push(b);
  }
  anim.push((t) => birds.forEach((b) => {
    const u = b.userData, a = t * u.sp + u.ph;
    b.position.set(u.cx + Math.cos(a) * u.r, u.h + Math.sin(t * 2 + u.ph) * 0.5, u.cz + Math.sin(a) * u.r);
    b.rotation.y = -a + (u.sp > 0 ? 0 : Math.PI);
    const f = Math.sin(t * 9 + u.ph) * 0.6; u.w1.rotation.z = f; u.w2.rotation.z = -f;
  }));
}
// clouds
const clouds = [];
function cloud(x, y, z, s = 1, dark = false) {
  const g = new THREE.Group(); const m = mat(dark ? 0x8d99ae : 0xffffff, { flatShading: false, roughness: 1 });
  for (let i = 0; i < 6; i++) { const c = mesh(new THREE.SphereGeometry(rnd(1.4, 2.3) * s, 10, 8), m, rnd(-2.6, 2.6) * s, rnd(-0.4, 0.6) * s, rnd(-1.2, 1.2) * s); c.castShadow = !dark; g.add(c); }
  g.position.set(x, y, z); scene.add(g); return g;
}
for (let i = 0; i < 9; i++) { const c = cloud(rnd(-90, 90), rnd(26, 38), rnd(-90, 60), rnd(1, 1.8)); c.userData.sp = rnd(0.4, 1); clouds.push(c); }
anim.push((t, dt) => clouds.forEach((c) => { c.position.x += c.userData.sp * dt; if (c.position.x > 110) c.position.x = -110; }));

// rain zone
{
  const zx = -36, zz = -16;
  const dc = cloud(zx, 11, zz - 1, 1.3, true);
  const N = 700, geo = new THREE.BufferGeometry(), arr = new Float32Array(N * 6);
  const drops = []; for (let i = 0; i < N; i++) drops.push({ x: zx + rnd(-6, 6), z: zz - 1 + rnd(-4, 4), y: rnd(0, 10), s: rnd(14, 20) });
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.7 }));
  scene.add(lines);
  anim.push((t, dt) => {
    drops.forEach((d, i) => { d.y -= d.s * dt; if (d.y < 0) d.y = 10; arr.set([d.x, d.y, d.z, d.x, d.y + 0.45, d.z], i * 6); });
    geo.attributes.position.needsUpdate = true; dc.position.x = zx + Math.sin(t * 0.3) * 0.6;
  });
  const pond = mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.1, 28), 0x4fb3e8, zx - 6, 0.05, zz + 5, { roughness: 0.15, flatShading: false }); scene.add(pond); block(zx - 6, zz + 5, 3.4);
  const cols = [0xff595e, 0xff924c, 0xffca3a, 0x8ac926, 0x1982c4, 0x6a4c93];
  cols.forEach((c, i) => { const tor = new THREE.Mesh(new THREE.TorusGeometry(10 - i * 0.45, 0.22, 6, 48, Math.PI), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.75 })); tor.position.set(zx - 2, 0, zz - 9); scene.add(tor); });
  for (let i = 0; i < 8; i++) { const st = mesh(new THREE.ConeGeometry(0.18, 0.9, 5), 0x5cbf48, zx + rnd(-5, 5), 0.45, zz + rnd(-3, 3)); scene.add(st); }
  for (let i = 0; i < 5; i++) bush(zx + rnd(-8, 4), zz + rnd(4, 9), rnd(0.7, 1.1), 0x58b85c);
}
// palm grove
{
  const zx = 36, zz = -16;
  [[-4, -4], [3, -6], [6, 1], [-6, 3], [0, 6], [8, -5], [-9, -2], [4, 8]].forEach(([dx, dz]) => palm(zx + dx, zz + dz, rnd(5.5, 7.5)));
  for (let i = 0; i < 3; i++) { const b = new THREE.Group(); b.add(mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.6, 10), 0xc8a26b, 0, 0.3, 0)); for (let j = 0; j < 10; j++) b.add(mesh(new THREE.SphereGeometry(0.14, 6, 5), 0x8b4513, rnd(-0.3, 0.3), 0.65 + rnd(0, 0.2), rnd(-0.3, 0.3))); b.position.set(zx + 1.5 + i * 1.4, 0, zz + 0.5); scene.add(b); }
}
// animals
const villagers = [];
{
  const zx = -42, zz = 18;
  const fence = (x1, z1, x2, z2) => { const n = Math.round(Math.hypot(x2 - x1, z2 - z1) / 1.5); for (let i = 0; i <= n; i++) { const k = i / n; scene.add(mesh(new THREE.BoxGeometry(0.15, 1.1, 0.15), 0x9a6b3f, x1 + (x2 - x1) * k, 0.55, z1 + (z2 - z1) * k)); } const r = mesh(new THREE.BoxGeometry(0.08, 0.1, Math.hypot(x2 - x1, z2 - z1)), 0x9a6b3f, (x1 + x2) / 2, 0.8, (z1 + z2) / 2); r.rotation.y = Math.atan2(x2 - x1, z2 - z1); scene.add(r); };
  fence(zx - 8, zz - 6, zx - 8, zz + 6); fence(zx - 8, zz + 6, zx + 2, zz + 6); fence(zx - 8, zz - 6, zx + 2, zz - 6);
  for (let k = -6; k <= 6; k += 1.2) block(zx - 8, zz + k, 0.5);
  for (let k = -8; k <= 2; k += 1.2) { block(zx + k, zz + 6, 0.5); block(zx + k, zz - 6, 0.5); }
  const sheep = (x, z) => {
    const g = new THREE.Group();
    for (let i = 0; i < 7; i++) g.add(mesh(new THREE.SphereGeometry(0.42, 8, 6), 0xf8f8f2, rnd(-0.45, 0.45), 0.85 + rnd(-0.1, 0.15), rnd(-0.25, 0.25), { flatShading: false }));
    const h = mesh(new THREE.SphereGeometry(0.3, 8, 6), 0x2b2b2b, 0.75, 0.95, 0, { flatShading: false }); h.scale.set(1.2, 1, 0.9); g.add(h);
    [[-0.35, -0.2], [-0.35, 0.2], [0.35, -0.2], [0.35, 0.2]].forEach(([lx, lz]) => g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 6), 0x2b2b2b, lx, 0.3, lz)));
    g.position.set(x, 0, z); g.rotation.y = rnd(0, 6.28); scene.add(g);
    const ph = rnd(0, 6); anim.push((t) => { g.position.y = Math.abs(Math.sin(t * 2 + ph)) * 0.05; h.rotation.z = Math.sin(t * 1.3 + ph) * 0.2 - 0.2; });
  };
  sheep(zx - 4, zz - 2); sheep(zx - 2, zz + 2.5); sheep(zx - 5.5, zz + 3); sheep(zx - 1, zz - 3.5);
  // camel
  const c = new THREE.Group(); const cm = 0xd9a95b;
  const cb = mesh(new THREE.SphereGeometry(1, 10, 8), cm, 0, 2.1, 0, { flatShading: false }); cb.scale.set(1.5, 0.8, 0.75); c.add(cb);
  c.add(mesh(new THREE.SphereGeometry(0.62, 10, 8), cm, 0, 2.75, 0, { flatShading: false }));
  const neck = mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.6, 8), cm, 1.55, 2.85, 0); neck.rotation.z = -0.6; c.add(neck);
  const ch = mesh(new THREE.BoxGeometry(0.8, 0.4, 0.4), cm, 2.1, 3.55, 0); c.add(ch);
  [[-0.9, -0.4], [-0.9, 0.4], [0.9, -0.4], [0.9, 0.4]].forEach(([lx, lz]) => c.add(mesh(new THREE.CylinderGeometry(0.13, 0.1, 1.7, 6), cm, lx, 0.85, lz)));
  c.position.set(zx + 6, 0, zz + 9); c.rotation.y = 2.3; scene.add(c); block(zx + 6, zz + 9, 1.8);
  anim.push((t) => { ch.rotation.z = Math.sin(t * 0.9) * 0.08; });
  // chickens
  for (let i = 0; i < 4; i++) {
    const h = new THREE.Group(); h.add(mesh(new THREE.SphereGeometry(0.28, 8, 6), 0xffffff, 0, 0.35, 0, { flatShading: false }));
    h.add(mesh(new THREE.SphereGeometry(0.16, 8, 6), 0xffffff, 0.22, 0.6, 0)); const beak = mesh(new THREE.ConeGeometry(0.06, 0.15, 4), 0xffb703, 0.38, 0.6, 0); beak.rotation.z = -Math.PI / 2; h.add(beak);
    h.add(mesh(new THREE.BoxGeometry(0.08, 0.12, 0.05), 0xe63946, 0.22, 0.78, 0));
    const hx = zx + 5 + rnd(-2, 2), hz = zz - 2 + rnd(-2, 2); h.position.set(hx, 0, hz); scene.add(h);
    const ph = rnd(0, 6); anim.push((t) => { h.position.x = hx + Math.sin(t * 0.7 + ph) * 1.2; h.rotation.y = Math.cos(t * 0.7 + ph) > 0 ? 0 : Math.PI; h.children[1].position.y = 0.6 - Math.max(0, Math.sin(t * 5 + ph)) * 0.15; });
  }
}
// fruit garden
{
  const zx = 42, zz = 18;
  [[-5, -4, 0xe63946], [2, -6, 0xff8c1a], [6, 0, 0xe63946], [-6, 4, 0xffd23f], [1, 6, 0xff8c1a], [-1, -1, 0x9b5de5]].forEach(([dx, dz, c]) => fruitTree(zx + dx, zz + dz, c));
  const basket = new THREE.Group(); basket.add(mesh(new THREE.CylinderGeometry(0.7, 0.55, 0.6, 12), 0xc8a26b, 0, 0.3, 0));
  for (let i = 0; i < 12; i++) basket.add(mesh(new THREE.SphereGeometry(0.2, 8, 6), [0xe63946, 0xff8c1a, 0xffd23f][i % 3], rnd(-0.4, 0.4), 0.7 + rnd(0, 0.2), rnd(-0.4, 0.4), { flatShading: false }));
  basket.position.set(zx - 3, 0, zz + 1); scene.add(basket);
}
// sun zone: sunflowers looking at the sun + big glowing sun in sky
{
  const zx = 0, zz = 24;
  const sun = new THREE.Mesh(new THREE.SphereGeometry(6, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffe066, fog: false }));
  sun.position.set(40, 70, 70); scene.add(sun);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.35, fog: false })); halo.position.copy(sun.position); scene.add(halo);
  anim.push((t) => halo.scale.setScalar(1 + Math.sin(t * 2) * 0.06));
  for (let i = 0; i < 26; i++) {
    const a = rnd(0, 6.28), r = rnd(2, 6.5); const x = zx + Math.cos(a) * r, z = zz + Math.sin(a) * r * 0.7 + 3;
    const f = new THREE.Group(); const h = rnd(1.4, 2.2);
    f.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, h, 5), 0x3f8f3a, 0, h / 2, 0));
    const head = new THREE.Group(); head.position.set(0, h, 0);
    for (let p = 0; p < 10; p++) { const pt = mesh(new THREE.ConeGeometry(0.14, 0.45, 4), 0xffc300, Math.cos(p * 0.628) * 0.32, Math.sin(p * 0.628) * 0.32, 0); pt.rotation.z = p * 0.628 - Math.PI / 2; head.add(pt); }
    const disk = mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.1, 10), 0x6b3e1d, 0, 0, 0.02); disk.rotation.x = Math.PI / 2; head.add(disk);
    f.add(head); f.position.set(x, 0, z); scene.add(f);
    f.updateMatrixWorld(true); head.lookAt(40, 70, 70);
  }
}
// home & family
function building(x, z, w, d, h, color, rotY = 0) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(w, h, d), color, 0, h / 2, 0, { flatShading: true, roughness: 0.95 }));
  g.add(mesh(new THREE.BoxGeometry(w + 0.3, 0.5, d + 0.3), 0xffffff, 0, h + 0.25, 0));
  for (let i = -w / 2 + 0.6; i <= w / 2 - 0.6; i += 1.2) g.add(mesh(new THREE.BoxGeometry(0.5, 0.45, 0.5), 0xffffff, i, h + 0.7, d / 2));
  g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g); return g;
}
{
  const zx = -22, zz = 44;
  const house = building(zx, zz + 6, 10, 7, 4.2, 0xf3e3c8);
  house.add(mesh(new THREE.BoxGeometry(1.6, 2.6, 0.12), 0x8a5a35, 0, 1.3, 3.55));
  [-3, 3].forEach((wx) => { house.add(mesh(new THREE.BoxGeometry(1.4, 1.2, 0.1), 0x6fc3f0, wx, 2.4, 3.56, { roughness: 0.2 })); house.add(mesh(new THREE.BoxGeometry(1.6, 0.15, 0.25), 0xffffff, wx, 1.75, 3.6)); });
  for (let i = -4.5; i <= 4.5; i += 1.5) block(zx + i, zz + 6 - 3.6, 1);
  for (let k = -3; k <= 3; k += 1.5) { block(zx - 5, zz + 6 + k, 1); block(zx + 5, zz + 6 + k, 1); }
  const fam = [
    { robe: 0xffffff, headwear: 'ghutra', scale: 1.3, x: -1.8 }, { robe: 0x1d1d1d, headwear: 'hijab', hair: 0x1d1d1d, scale: 1.2, x: -0.3 },
    { robe: 0x7a3e9d, headwear: 'hijab', hair: 0xf8f0ff, scale: 0.85, x: 1.0 }, { robe: 0xffffff, scale: 0.8, x: 2.1 },
  ];
  fam.forEach((f, i) => { const p = person(f); p.position.set(zx + f.x, 0, zz + 1.5); p.rotation.y = 0.1; scene.add(p); villagers.push(p); block(zx + f.x, zz + 1.5, 0.55);
    const arm = p.userData.parts.arms[1]; anim.push((t) => { arm.rotation.z = 2.4 + Math.sin(t * 5 + i) * 0.35; }); });
  palm(zx - 7, zz + 1, 5.5); bush(zx + 6.5, zz + 2, 1.1, 0xe56b9a); bush(zx + 7, zz + 3.2, 0.9, 0x4caf50);
}
// school
{
  const zx = 24, zz = 44;
  const sc = building(zx, zz + 7, 14, 7, 5.2, 0xf6e7c1);
  for (let r = 0; r < 2; r++) for (let i = -5; i <= 5; i += 2.5) sc.add(mesh(new THREE.BoxGeometry(1.4, 1, 0.1), 0x6fc3f0, i, 1.5 + r * 2, 3.56, { roughness: 0.2 }));
  sc.add(mesh(new THREE.BoxGeometry(2.2, 2.6, 0.12), 0x2f6b9a, 0, 1.3, 3.56));
  for (let i = -6.5; i <= 6.5; i += 1.5) block(zx + i, zz + 7 - 3.6, 1);
  for (let k = -3; k <= 3; k += 1.5) { block(zx - 7, zz + 7 + k, 1); block(zx + 7, zz + 7 + k, 1); }
  // sign board
  const board = textSprite('مدرستي 📚', { size: 56, color: '#1a4f8a', border: '#2b8cee' }); board.position.set(zx, 6.4, zz + 3.6); scene.add(board);
  // Bahrain flag
  scene.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 8, 6), 0xdddddd, zx + 9, 4, zz + 2)); block(zx + 9, zz + 2, 0.4);
  const fc = document.createElement('canvas'); fc.width = 300; fc.height = 180; const g = fc.getContext('2d');
  g.fillStyle = '#ce1126'; g.fillRect(0, 0, 300, 180); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, 0); g.lineTo(80, 0);
  for (let i = 0; i < 5; i++) { g.lineTo(110, 18 + i * 36); g.lineTo(80, 36 + i * 36); } g.lineTo(0, 180); g.fill();
  const ft = new THREE.CanvasTexture(fc); ft.colorSpace = THREE.SRGBColorSpace;
  const fgeo = new THREE.PlaneGeometry(3, 1.8, 12, 1); const flag = new THREE.Mesh(fgeo, new THREE.MeshStandardMaterial({ map: ft, side: THREE.DoubleSide }));
  flag.position.set(zx + 10.5, 7, zz + 2); scene.add(flag);
  const fb = fgeo.attributes.position.array.slice();
  anim.push((t) => { const p = fgeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = fb[i * 3]; p.setZ(i, Math.sin(x * 2 + t * 5) * 0.15 * (x + 1.5) / 3); } p.needsUpdate = true; });
  // students
  [[-3, 0x2b8cee], [-1.5, 0xffffff], [3, 0xffffff]].forEach(([dx, col], i) => { const k = person({ robe: col === 0x2b8cee ? 0xffffff : col, headwear: i === 0 ? 'hijab' : null, hair: i === 0 ? 0xf3f3f3 : 0x3b2414, scale: 0.8 }); k.position.set(zx + dx, 0, zz + 1); scene.add(k); block(zx + dx, zz + 1, 0.5); villagers.push(k); });
  bush(zx - 8, zz + 2, 1, 0x4caf50); bush(zx - 8.5, zz + 3.5, 0.8, 0xffb3c6);
}
// scatter decor
{
  const tuft = new THREE.ConeGeometry(0.12, 0.5, 3); const tm = mat(0x5aa83e);
  const inst = new THREE.InstancedMesh(tuft, tm, 900); const d = new THREE.Object3D(); let n = 0;
  for (let i = 0; i < 2000 && n < 900; i++) {
    const x = rnd(-70, 70), z = rnd(-32, 70); if (Math.hypot(x, z) < 10) continue;
    d.position.set(x, 0.2, z); d.rotation.set(rnd(-0.2, 0.2), rnd(0, 6), rnd(-0.2, 0.2)); d.scale.setScalar(rnd(0.6, 1.3)); d.updateMatrix(); inst.setMatrixAt(n++, d.matrix);
  }
  inst.count = n; scene.add(inst);
  const fl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 6, 4), new THREE.MeshStandardMaterial({ color: 0xffffff }), 300); n = 0;
  const fcols = [0xff6f91, 0xffd23f, 0xb388ff, 0xffffff, 0xff8a3d];
  for (let i = 0; i < 600 && n < 300; i++) { const x = rnd(-70, 70), z = rnd(-30, 70); if (Math.hypot(x, z) < 10) continue; d.position.set(x, 0.32, z); d.rotation.set(0, 0, 0); d.scale.setScalar(1); d.updateMatrix(); fl.setMatrixAt(n, d.matrix); fl.setColorAt(n, new THREE.Color(fcols[n % 5])); n++; }
  fl.count = n; scene.add(fl);
  for (let i = 0; i < 14; i++) { const a = rnd(0, 6.28), r = rnd(60, 72); palm(Math.cos(a) * r, Math.max(-28, Math.sin(a) * r), rnd(6, 8), false); }
  for (let i = 0; i < 10; i++) rock(rnd(-60, 60), rnd(-25, 65), rnd(0.6, 1.4));
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
function tone(fr, d, type = 'sine', v = 0.2, when = 0) { return; if (!ac || muted) return; const t = ac.currentTime + when, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = fr; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.05); }
function chime() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.5, 'triangle', 0.18, i * 0.11)); }
function chirp() { const f = 2200 + Math.random() * 900; tone(f, 0.08, 'sine', 0.05); tone(f * 1.2, 0.08, 'sine', 0.05, 0.1); }
function step() { tone(140 + Math.random() * 40, 0.06, 'triangle', 0.05); }
function fixAr(s){ s=s.replace(/[ً-ْٰ]/g,'');
  var R=[[/(^|[^؀-ۿ])النعم(?=$|[^؀-ۿ])/g,'$1النِّعَم'],[/(^|[^؀-ۿ])نعمتين/g,'$1نِعْمَتَيْن'],[/(^|[^؀-ۿ])(ب|و|ف|ل|ك)?نعمة/g,'$1$2نِعْمَة'],[/(^|[^؀-ۿ])نعم الله/g,'$1نِعَمَ الله'],[/(^|[^؀-ۿ])نعمه(?=$|[^؀-ۿ])/g,'$1نِعَمِه']];
  R.forEach(function(r){ s=s.replace(r[0],r[1]); }); return s; }
function say(text) { return; if (muted || !window.speechSynthesis) return; try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(fixAr(text).replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, '')); u.lang = 'ar-SA'; u.rate = 0.92; const v = speechSynthesis.getVoices().find((x) => /^ar/i.test(x.lang)); if (v) u.voice = v; speechSynthesis.speak(u); } catch (e) {} }
$('#fs').onclick = () => { try { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); } catch (e) {} };

// ---------------------------------------------------------------- confetti (2D overlay)
const cc = $('#conf'), cx = cc.getContext('2d'); let parts = [];
function confetti(n = 160) { cc.width = innerWidth; cc.height = innerHeight; const cols = ['#ffb703', '#2fbf71', '#f0545c', '#2b8cee', '#9b5de5']; for (let i = 0; i < n; i++) parts.push({ x: innerWidth / 2 + rnd(-150, 150), y: innerHeight * 0.3, vx: rnd(-9, 9), vy: rnd(-14, -4), r: rnd(5, 11), c: cols[i % 5], a: rnd(0, 6), l: 0 }); }
function drawConf() { if (!parts.length) return; cx.clearRect(0, 0, cc.width, cc.height); parts.forEach((p) => { p.vy += 0.4; p.x += p.vx; p.y += p.vy; p.a += 0.2; p.l++; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.a); cx.fillStyle = p.c; cx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); cx.restore(); }); parts = parts.filter((p) => p.y < cc.height + 30 && p.l < 300); if (!parts.length) cx.clearRect(0, 0, cc.width, cc.height); }

// ---------------------------------------------------------------- discovery
let found = 0, cardT = 0;
function discover(zn) {
  zn.found = true; found++; $('#cnt').textContent = found;
  zn.ring.material.color.set(0x2fbf71);
  const tick = textSprite('✔', { size: 60, bg: '#2fbf71', border: '#ffffff', color: '#ffffff', scale: 0.9 }); tick.position.set(zn.x + zn.sign.scale.x / 2 + 0.6, 6.2, zn.z); scene.add(tick);
  $('#cT').textContent = zn.title; $('#cP').textContent = zn.text; $('#card').classList.add('on'); cardT = 6;
  chime(); confetti(90); say(zn.title + '. ' + zn.text + ' الحمد لله');
  if (found === ZONES.length) setTimeout(() => { $('#final').style.display = 'flex'; confetti(260); [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.6, 'triangle', 0.2, i * 0.15)); say('ما شاء الله! وإن تعدّوا نعمة الله لا تحصوها. الحمد لله'); }, 3200);
}

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock(); let walkPh = 0, stepT = 0, chirpT = 2, speedNow = 0;
const camPos = new THREE.Vector3(), lookAt = new THREE.Vector3();
function update(dt, t) {
  // input vector (camera-relative)
  let ix = 0, iz = 0;
  if (keys['arrowup'] || keys['w'] || keys['ص']) iz -= 1;
  if (keys['arrowdown'] || keys['s'] || keys['س']) iz += 1;
  if (keys['arrowleft'] || keys['a'] || keys['ش']) ix -= 1;
  if (keys['arrowright'] || keys['d'] || keys['ي']) ix += 1;
  ix += jv.x; iz += jv.y;
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
  updateGuide(t); drawMap(t);
  // camera
  const tx = player.position.x, tz = player.position.z;
  camPos.set(tx + Math.sin(camYaw) * Math.cos(camPitch) * camDist, 1.6 + Math.sin(camPitch) * camDist, tz + Math.cos(camYaw) * Math.cos(camPitch) * camDist);
  camera.position.lerp(camPos, Math.min(1, dt * 6)); lookAt.lerp(new THREE.Vector3(tx, 1.7, tz), Math.min(1, dt * 8)); camera.lookAt(lookAt);
  sunLight.position.set(tx + 40, 60, tz + 25); sunLight.target.position.set(tx, 0, tz);
  // villagers face player when near
  villagers.forEach((v) => { const d = v.position.distanceTo(player.position); if (d < 8) { const a = Math.atan2(player.position.x - v.position.x, player.position.z - v.position.z); let da = a - v.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da)); v.rotation.y += da * Math.min(1, dt * 3); } });
  // zones
  ZONES.forEach((zn) => { if (!zn.found && Math.hypot(player.position.x - zn.x, player.position.z - zn.z) < 5.3) discover(zn); });
  if (cardT > 0) { cardT -= dt; if (cardT <= 0) $('#card').classList.remove('on'); }
  // ambient
  if (waveGain) waveGain.gain.value = muted ? 0 : Math.max(0, 0.5 - (player.position.z + 36) * 0.02);
  chirpT -= dt; if (chirpT < 0) { chirpT = rnd(2.5, 6); chirp(); }
}
// ---------------------------------------------------------------- guide arrow, minimap, adaptive quality
const guide = new THREE.Group();
{ const c = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.0, 4), new THREE.MeshBasicMaterial({ color: 0xffb703 })); c.rotation.x = Math.PI / 2; c.scale.z = 0.35; guide.add(c);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.7), new THREE.MeshBasicMaterial({ color: 0xffb703 })); tail.position.z = -0.75; guide.add(tail); }
guide.visible = false; scene.add(guide);
const zDone = (z) => z.found || z.done;
let nearest = null;
function updateGuide(t) {
  let best = null, bd = 1e9; const px = player.position.x, pz = player.position.z;
  ZONES.forEach((z) => { if (zDone(z)) return; const d = Math.hypot(z.x - px, z.z - pz); if (d < bd) { bd = d; best = z; } });
  nearest = best; const busy = typeof quizZ !== 'undefined' && quizZ;
  if (!best || bd < 7 || busy) { guide.visible = false; return; }
  const a = Math.atan2(best.x - px, best.z - pz), r = 2.7 + Math.sin(t * 5) * 0.3;
  guide.visible = true; guide.position.set(px + Math.sin(a) * r, 0.5, pz + Math.cos(a) * r); guide.rotation.y = a; guide.scale.setScalar(1.6);
}
const mapC = $('#map'), mg = mapC ? mapC.getContext('2d') : null; let mapTick = 0;
function drawMap(t) {
  if (!mg || (mapTick++ % 3)) return;
  const S = mapC.width, c = S / 2, k = (c - 8) / 74; const X = (x) => c - x * k, Y = (z) => c - z * k;
  mg.clearRect(0, 0, S, S); mg.save(); mg.beginPath(); mg.arc(c, c, c - 4, 0, 6.283); mg.clip();
  mg.fillStyle = '#8fd06a'; mg.fillRect(0, 0, S, S);
  mg.fillStyle = '#f1d9a0'; mg.fillRect(0, Y(-33), S, S); mg.fillStyle = '#2fa8dc'; mg.fillRect(0, Y(-38), S, S);
  mg.strokeStyle = 'rgba(230,207,156,.95)'; mg.lineWidth = 4; ZONES.forEach((z) => { mg.beginPath(); mg.moveTo(c, c); mg.lineTo(X(z.x * 0.8), Y(z.z * 0.8)); mg.stroke(); });
  mg.fillStyle = '#e9d8b4'; mg.beginPath(); mg.arc(c, c, 9 * k, 0, 6.283); mg.fill(); mg.fillStyle = '#5ec4f0'; mg.beginPath(); mg.arc(c, c, 3 * k, 0, 6.283); mg.fill();
  ZONES.forEach((z) => {
    const done = zDone(z); const col = done ? (z.coop === false ? '#f0545c' : '#2fbf71') : '#ffd23f';
    if (z === nearest) { mg.strokeStyle = '#ffffff'; mg.lineWidth = 3; mg.beginPath(); mg.arc(X(z.x), Y(z.z), 11 + Math.sin(t * 5) * 3, 0, 6.283); mg.stroke(); }
    mg.fillStyle = col; mg.strokeStyle = '#3b2f1a'; mg.lineWidth = 2; mg.beginPath(); mg.arc(X(z.x), Y(z.z), 7, 0, 6.283); mg.fill(); mg.stroke();
    if (done) { mg.fillStyle = '#fff'; mg.font = 'bold 11px sans-serif'; mg.textAlign = 'center'; mg.textBaseline = 'middle'; mg.fillText(z.coop === false ? '✖' : '✔', X(z.x), Y(z.z) + 1); }
  });
  mg.translate(X(player.position.x), Y(player.position.z)); mg.rotate(-player.rotation.y);
  mg.fillStyle = '#ffffff'; mg.strokeStyle = '#d6336c'; mg.lineWidth = 3; mg.beginPath(); mg.moveTo(0, -11); mg.lineTo(8, 8); mg.lineTo(0, 4); mg.lineTo(-8, 8); mg.closePath(); mg.fill(); mg.stroke();
  mg.restore(); mg.strokeStyle = '#ffffff'; mg.lineWidth = 5; mg.beginPath(); mg.arc(c, c, c - 4, 0, 6.283); mg.stroke();
}
let qLevel = 0, qFrames = 0, qT0 = performance.now();
function adaptQuality() {
  qFrames++; const now = performance.now(); if (now - qT0 < 2500) return;
  const fps = qFrames * 1000 / (now - qT0); qFrames = 0; qT0 = now;
  if (fps < 26 && qLevel < 3) {
    qLevel++;
    if (qLevel === 1) renderer.setPixelRatio(1);
    else if (qLevel === 2) { sunLight.castShadow = false; shadowBlob.material.opacity = 0.28; }
    else { renderer.setPixelRatio(0.7); scene.fog.far = 120; }
  }
}
let started = false;
function frame() {
  const dt = Math.min(0.1, clock.getDelta()), t = clock.elapsedTime;
  anim.forEach((f) => f(t, dt));
  if (started) update(dt, t); else { camYaw += dt * 0.12; camera.position.set(Math.sin(camYaw) * 30, 16, Math.cos(camYaw) * 30 + 5); camera.lookAt(0, 2, 5); }
  renderer.render(scene, camera); drawConf(); if (started) adaptQuality();
  requestAnimationFrame(frame);
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
frame();
$('#loading').textContent = '';
$('#go').onclick = () => { started = true; camYaw = Math.PI; $('#start').style.display = 'none'; say('هيا نتجول مع سلمان في عالم النعم'); };
window.__game = { get q() { return qLevel; }, player, ZONES, keys, get found() { return found; }, teleport(x, z) { player.position.set(x, 0, z); } };
