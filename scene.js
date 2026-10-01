// Three.js による描画と演出
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { DIRS, letterOf, previewLetter, cellAt, isBlocked } from './logic.js';

const FONT = '"Zen Maru Gothic", "Hiragino Maru Gothic ProN", sans-serif';
const DIE = 0.86;
const H = DIE / 2;
const UP = new THREE.Vector3(0, 1, 0);
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeOutBack = (t) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;

// ---- テクスチャ ----
const texCache = new Map();
function canvasTex(key, draw, size = 256) {
  if (texCache.has(key)) return texCache.get(key);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  draw(g, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  texCache.set(key, tex);
  return tex;
}
function text(g, s, ch, color, scale = 0.72, weight = 900) {
  g.fillStyle = color;
  g.font = `${weight} ${Math.round(s * scale)}px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(ch, s / 2, s / 2 + s * 0.04);
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}
const dieFaceTex = (ch) => canvasTex(`die:${ch}`, (g, s) => text(g, s, ch, '#3b2f2a', 0.74));
const previewTex = (ch, ok) => canvasTex(`pv:${ch}:${ok}`, (g, s) => {
  roundRect(g, s * 0.12, s * 0.12, s * 0.76, s * 0.76, s * 0.18);
  g.fillStyle = ok ? 'rgba(255,255,255,0.88)' : 'rgba(255,220,220,0.85)';
  g.fill();
  g.lineWidth = s * 0.04;
  g.strokeStyle = ok ? 'rgba(59,47,42,0.55)' : 'rgba(232,72,59,0.8)';
  g.stroke();
  text(g, s, ch, ok ? '#3b2f2a' : 'rgba(232,72,59,0.9)', 0.5);
  if (!ok) {
    g.strokeStyle = 'rgba(232,72,59,0.9)';
    g.lineWidth = s * 0.05;
    g.beginPath(); g.moveTo(s * 0.2, s * 0.2); g.lineTo(s * 0.8, s * 0.8); g.stroke();
  }
});
const slotTex = (n, ch, done) => canvasTex(`slot:${n}:${ch}:${done}`, (g, s) => {
  if (done) {
    g.fillStyle = 'rgba(232,72,59,0.12)';
    g.beginPath(); g.arc(s / 2, s / 2, s * 0.44, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#e8483b'; g.lineWidth = s * 0.06;
    g.beginPath(); g.arc(s / 2, s / 2, s * 0.4, 0, Math.PI * 2); g.stroke();
    text(g, s, ch, '#e8483b', 0.56);
  } else {
    g.setLineDash([s * 0.08, s * 0.06]);
    g.strokeStyle = 'rgba(59,47,42,0.45)'; g.lineWidth = s * 0.035;
    roundRect(g, s * 0.08, s * 0.08, s * 0.84, s * 0.84, s * 0.14); g.stroke();
    text(g, s, ch, 'rgba(59,47,42,0.28)', 0.56);
    g.font = `900 ${s * 0.2}px ${FONT}`;
    g.fillStyle = '#e8483b';
    g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText(String(n + 1), s * 0.14, s * 0.12);
  }
});
const symbolTex = (kind) => canvasTex(`sym:${kind}`, (g, s) => {
  if (kind === 'turn') {
    g.strokeStyle = '#ff8a3d'; g.lineWidth = s * 0.08; g.lineCap = 'round';
    g.beginPath(); g.arc(s / 2, s / 2, s * 0.3, -Math.PI * 0.4, Math.PI * 1.25); g.stroke();
    const a = Math.PI * 1.25, ax = s / 2 + Math.cos(a) * s * 0.3, ay = s / 2 + Math.sin(a) * s * 0.3;
    g.fillStyle = '#ff8a3d';
    g.beginPath(); g.moveTo(ax + s * 0.12, ay - s * 0.02); g.lineTo(ax - s * 0.06, ay - s * 0.12); g.lineTo(ax - s * 0.04, ay + s * 0.1); g.fill();
  } else if (kind === 'ice') {
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = s * 0.035; g.lineCap = 'round';
    for (const [x, y, l] of [[0.2, 0.3, 0.25], [0.45, 0.62, 0.3], [0.62, 0.22, 0.18]]) {
      g.beginPath(); g.moveTo(s * x, s * (y + l)); g.lineTo(s * (x + l), s * y); g.stroke();
    }
  } else {
    const daku = kind === 'daku';
    g.fillStyle = daku ? '#4a90e2' : '#ef6fa8';
    g.beginPath(); g.arc(s / 2, s / 2, s * 0.38, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineWidth = s * 0.075;
    if (daku) {
      for (const ox of [-0.09, 0.09]) {
        g.beginPath(); g.moveTo(s * (0.45 + ox), s * 0.33); g.lineTo(s * (0.55 + ox), s * 0.65); g.stroke();
      }
    } else {
      g.beginPath(); g.arc(s / 2, s / 2, s * 0.16, 0, Math.PI * 2); g.stroke();
    }
  }
});
const crackTex = () => canvasTex('crack', (g, s) => {
  g.strokeStyle = 'rgba(110,80,60,0.75)'; g.lineWidth = s * 0.025; g.lineCap = 'round'; g.lineJoin = 'round';
  const paths = [
    [[0.5, 0.5], [0.38, 0.36], [0.3, 0.2], [0.18, 0.1]],
    [[0.5, 0.5], [0.66, 0.42], [0.8, 0.3]],
    [[0.5, 0.5], [0.56, 0.66], [0.5, 0.8], [0.58, 0.92]],
    [[0.5, 0.5], [0.34, 0.58], [0.16, 0.62]],
    [[0.38, 0.36], [0.24, 0.42]],
    [[0.66, 0.42], [0.72, 0.6], [0.88, 0.66]],
  ];
  for (const pts of paths) {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x * s, y * s) : g.moveTo(x * s, y * s)));
    g.stroke();
  }
});
const sealTex = (ch) => canvasTex(`seal:${ch}`, (g, s) => {
  g.strokeStyle = '#fff'; g.lineWidth = s * 0.05;
  g.beginPath(); g.arc(s / 2, s / 2, s * 0.4, 0, Math.PI * 2); g.stroke();
  text(g, s, ch, '#fff', 0.56);
});
const plaqueTex = (ch) => canvasTex(`plaque:${ch}`, (g, s) => {
  g.fillStyle = '#2d2420'; roundRect(g, s * 0.06, s * 0.06, s * 0.88, s * 0.88, s * 0.1); g.fill();
  g.strokeStyle = '#f2c14e'; g.lineWidth = s * 0.05; g.stroke();
  text(g, s, ch, '#f2c14e', 0.66);
});

const gateFloorTex = (ch) => canvasTex(`gatefloor:${ch}`, (g, s) => {
  g.fillStyle = 'rgba(224,69,47,0.14)';
  roundRect(g, s * 0.1, s * 0.1, s * 0.8, s * 0.8, s * 0.16); g.fill();
  text(g, s, ch, 'rgba(224,69,47,0.75)', 0.58);
});

// 法線 normal・上方向 up の向きに板を置く
function orientPlane(mesh, normal, up, offset) {
  const right = new THREE.Vector3().crossVectors(up, normal);
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal));
  mesh.position.copy(normal).multiplyScalar(offset);
}

export class World {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0xc89a72, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-4, 10, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -10;
    sun.shadow.camera.right = sun.shadow.camera.top = 10;
    sun.shadow.radius = 4;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);

    const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.ShadowMaterial({ opacity: 0.12 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.32;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.board = new THREE.Group();
    this.scene.add(this.board);
    this.fx = new THREE.Group();
    this.scene.add(this.fx);

    // サイコロ
    this.die = new THREE.Group();
    const body = new THREE.Mesh(
      new RoundedBoxGeometry(DIE, DIE, DIE, 5, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xfffdf6, roughness: 0.45 }),
    );
    body.castShadow = true;
    this.die.add(body);
    this.faces = [];
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(DIE * 0.84, DIE * 0.84),
        new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }),
      );
      this.die.add(m);
      this.faces.push(m);
    }
    this.scene.add(this.die);

    this.previews = DIRS.map(() => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.52), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      this.fx.add(m);
      return m;
    });

    this.tweens = [];
    this.particles = [];
    this.clock = new THREE.Clock();
    this.resize();
    addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.flushTweens(); });
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ---- 基本 ----
  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.fitCamera();
  }
  // HUD に隠れない領域（getSafe が返す px 矩形）に盤面が収まるよう、距離と表示位置を合わせる
  fitCamera() {
    if (!this.lv) return;
    const W = innerWidth, Hh = innerHeight;
    const safe = this.getSafe?.() ?? { left: 0, top: 0, right: W, bottom: Hh };
    const sw = Math.max(80, safe.right - safe.left), sh = Math.max(80, safe.bottom - safe.top);
    const { w, h } = this.lv;
    const pts = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [-0.3, 1.0]) pts.push(new THREE.Vector3(sx * (w / 2 + 0.1), y, sz * (h / 2 + 0.1)));
    const dir = new THREE.Vector3(0, 1.6, 1).normalize();
    const cam = this.camera;
    cam.clearViewOffset();
    const bbox = (dist) => {
      cam.position.copy(dir).multiplyScalar(dist);
      cam.lookAt(0, 0, 0);
      cam.updateMatrixWorld();
      cam.updateProjectionMatrix();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of pts) {
        const v = p.clone().project(cam);
        const px = (v.x + 1) / 2 * W, py = (1 - v.y) / 2 * Hh;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
      return { x0, x1, y0, y1 };
    };
    let lo = 2, hi = 80;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      const b = bbox(mid);
      if (b.x1 - b.x0 <= sw && b.y1 - b.y0 <= sh) hi = mid; else lo = mid;
    }
    const b = bbox(Math.min(hi, 40));
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    const tx = (safe.left + safe.right) / 2, ty = (safe.top + safe.bottom) / 2;
    cam.setViewOffset(W, Hh, cx - tx, cy - ty, W, Hh);
    cam.updateProjectionMatrix();
  }
  pos(x, y) {
    return new THREE.Vector3(x - (this.lv.w - 1) / 2, 0, y - (this.lv.h - 1) / 2);
  }
  tween(duration, fn) {
    // 非表示タブでは描画ループが止まるので、演出を飛ばして即完了させる
    if (document.hidden) { fn(1); return Promise.resolve(); }
    return new Promise((resolve) => this.tweens.push({ t: 0, duration, fn, resolve }));
  }
  flushTweens() {
    for (const tw of this.tweens.splice(0)) { tw.fn(1); tw.resolve(); }
  }
  wait(sec) { return this.tween(sec, () => {}); }
  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const time = this.clock.elapsedTime;
    for (const tw of [...this.tweens]) {
      tw.t = Math.min(1, tw.t + dt / tw.duration);
      tw.fn(tw.t);
      if (tw.t >= 1) { this.tweens.splice(this.tweens.indexOf(tw), 1); tw.resolve(); }
    }
    for (const p of [...this.particles]) {
      p.life -= dt;
      p.v.y -= 9 * dt;
      p.mesh.position.addScaledVector(p.v, dt);
      p.mesh.rotation.x += p.spin * dt;
      p.mesh.rotation.z += p.spin * 0.7 * dt;
      p.mesh.material.opacity = Math.min(1, p.life * 2);
      if (p.life <= 0) { this.fx.remove(p.mesh); this.particles.splice(this.particles.indexOf(p), 1); }
    }
    this.previews.forEach((m, i) => { m.position.y = 0.03 + Math.sin(time * 3 + i) * 0.015; });
    for (const t of this.spinners ?? []) t.rotation.y = time * 0.6;
    this.renderer.render(this.scene, this.camera);
  }

  // ---- 盤面 ----
  loadLevel(lv, state) {
    this.lv = lv;
    this.board.clear();
    this.slotDecals = [];
    this.seals = [];
    this.cracks = [];
    this.gates = {};
    this.spinners = [];
    this.turnDecals = {};
    const tileGeo = new RoundedBoxGeometry(0.96, 0.3, 0.96, 3, 0.07);
    const decalGeo = new THREE.PlaneGeometry(0.9, 0.9);
    const mats = {
      a: new THREE.MeshStandardMaterial({ color: 0xfff1d6, roughness: 0.85 }),
      b: new THREE.MeshStandardMaterial({ color: 0xf6e0bb, roughness: 0.85 }),
      ice: new THREE.MeshStandardMaterial({ color: 0xa9e2ff, roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.88 }),
      slot: new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.7 }),
      rock: new THREE.MeshStandardMaterial({ color: 0x9a8f86, roughness: 0.95, flatShading: true }),
      red: new THREE.MeshStandardMaterial({ color: 0xe0452f, roughness: 0.55 }),
      black: new THREE.MeshStandardMaterial({ color: 0x2d2420, roughness: 0.6 }),
      crack: new THREE.MeshStandardMaterial({ color: 0xe2c9a6, roughness: 0.95 }),
      seal: new THREE.MeshStandardMaterial({ color: 0xd8402f, roughness: 0.5 }),
    };
    const decal = (tex, p, y = 0.002) => {
      const m = new THREE.Mesh(decalGeo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.7, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(p.x, y, p.z);
      m.receiveShadow = true;
      this.board.add(m);
      return m;
    };
    for (let y = 0; y < lv.h; y++) for (let x = 0; x < lv.w; x++) {
      const cell = lv.cells[y][x];
      if (cell.t === 'void') continue;
      const p = this.pos(x, y);
      const mat = cell.t === 'ice' ? mats.ice : cell.t === 'slot' ? mats.slot : cell.t === 'crack' ? mats.crack : (x + y) % 2 ? mats.b : mats.a;
      const tile = new THREE.Mesh(tileGeo, mat);
      tile.position.set(p.x, -0.15, p.z);
      tile.receiveShadow = true;
      tile.castShadow = true;
      this.board.add(tile);
      if (cell.t === 'ice') decal(symbolTex('ice'), p);
      if (cell.t === 'turn') this.turnDecals[`${x},${y}`] = decal(symbolTex('turn'), p);
      if (cell.t === 'daku' || cell.t === 'handaku') decal(symbolTex(cell.t), p);
      if (cell.t === 'slot') {
        this.slotDecals[cell.i] = decal(slotTex(cell.i, cell.letter, false), p);
        this.seals[cell.i] = this.buildSeal(p, cell.letter, mats);
      }
      if (cell.t === 'crack') this.cracks[cell.k] = { tile, decal: decal(crackTex(), p), p };
      if (cell.t === 'rock') {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), mats.rock);
        rock.position.set(p.x, 0.26, p.z);
        rock.scale.set(1, 0.75, 1);
        rock.rotation.set(Math.random(), Math.random() * 6, Math.random() * 0.3);
        rock.castShadow = rock.receiveShadow = true;
        this.board.add(rock);
      }
      if (cell.t === 'gate') {
        this.gates[`${x},${y}`] = this.buildGate(p, cell.letter, mats);
        decal(gateFloorTex(cell.letter), p);
      }
    }
    this.fitCamera();
    this.sync(state);
  }
  // 押し終えた文字マスにせり上がる「印」のブロック
  buildSeal(p, ch, mats) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.5, 0.78, 3, 0.1), mats.seal);
    body.position.y = 0.25;
    body.castShadow = body.receiveShadow = true;
    const top = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.66), new THREE.MeshStandardMaterial({ map: sealTex(ch), transparent: true, roughness: 0.6 }));
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.502;
    g.add(body, top);
    g.position.copy(p);
    g.visible = false;
    this.board.add(g);
    return g;
  }
  buildGate(p, ch, mats) {
    const g = new THREE.Group();
    const pillar = new THREE.CylinderGeometry(0.05, 0.06, 1.15, 12);
    for (const sx of [-0.4, 0.4]) {
      const m = new THREE.Mesh(pillar, mats.red);
      m.position.set(sx, 0.575, 0);
      m.castShadow = true;
      g.add(m);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.08, 0.12), mats.black);
    top.position.y = 1.2;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.07, 0.09), mats.red);
    beam.position.y = 1.0;
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshBasicMaterial({ map: plaqueTex(ch) }));
    plaque.position.set(0, 1.1, 0.07);
    const back = plaque.clone();
    back.rotation.y = Math.PI;
    back.position.z = -0.07;
    g.add(top, beam, plaque, back);
    top.castShadow = beam.castShadow = true;
    g.position.copy(p);
    this.board.add(g);
    return g;
  }

  // 状態に合わせて即座に表示を合わせる（やりなおし・もどす用）
  // fromPlay: 演出の最後に呼ばれたとき。進行中の崩れ・せり上がり演出は止めない
  sync(state, fromPlay = false) {
    this.state = state;
    if (!fromPlay) this.animToken = (this.animToken ?? 0) + 1;
    this.die.position.copy(this.pos(state.x, state.y)).setY(H);
    this.die.quaternion.identity();
    this.die.scale.setScalar(1);
    this.paintDie(state);
    this.slotDecals.forEach((m, i) => {
      const done = !!(state.filled & (1 << i));
      m.material.map = slotTex(i, this.lv.word[i], done);
      m.material.needsUpdate = true;
      m.scale.setScalar(1);
      const [sx, sy] = this.lv.slots[i];
      const seal = this.seals[i];
      if (fromPlay && seal.userData.anim === this.animToken) return;
      seal.visible = done && !(state.x === sx && state.y === sy);
      seal.scale.set(1, 1, 1);
    });
    this.cracks.forEach((c, k) => {
      const broken = !!(state.broken & (1 << k));
      if (fromPlay && c.anim === this.animToken) return;
      c.tile.visible = c.decal.visible = !broken;
      c.tile.position.set(c.p.x, -0.15, c.p.z);
      c.tile.rotation.set(0, 0, 0);
      c.tile.scale.setScalar(1);
      c.decal.position.set(c.p.x, 0.002, c.p.z);
    });
    this.showPreviews(state);
  }

  // ---- サイコロの面 ----
  topUp(rot) {
    return new THREE.Vector3(0, 0, -1).applyAxisAngle(UP, -rot * Math.PI / 2);
  }
  rollQuat(d, angle = Math.PI / 2) {
    const [dx, dz] = DIRS[d];
    return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(dz, 0, -dx), angle);
  }
  paintDie(s) {
    const U = this.topUp(s.rot);
    const set = (m, ch, normal, up) => {
      m.material.map = dieFaceTex(ch);
      m.material.needsUpdate = true;
      orientPlane(m, normal, up, H + 0.003);
    };
    set(this.faces[0], letterOf(s.c, s.r, s.mark), UP.clone(), U);
    for (let d = 0; d < 4; d++) {
      // d 方向へ転がすと上に来る面に、そのとき上になる文字を描く
      const inv = this.rollQuat(d).invert();
      set(this.faces[d + 1], previewLetter(s, d), UP.clone().applyQuaternion(inv), U.clone().applyQuaternion(inv));
    }
  }
  showPreviews(s, visible = true) {
    this.previews.forEach((m, d) => {
      const [dx, dy] = DIRS[d];
      const cell = cellAt(this.lv, s.x + dx, s.y + dy);
      if (!visible || isBlocked(this.lv, s, s.x + dx, s.y + dy)) { m.visible = false; return; }
      const ch = previewLetter(s, d);
      const ok = cell.t !== 'gate' || cell.letter === ch;
      m.visible = true;
      m.material.map = previewTex(ch, ok);
      m.material.needsUpdate = true;
      const p = this.pos(s.x + dx, s.y + dy);
      m.position.x = p.x;
      m.position.z = p.z;
    });
  }

  // ---- 演出 ----
  async play(prev, next, events, sfx) {
    let cur = { ...prev };
    this.showPreviews(prev, false);
    for (const ev of events) {
      if (ev.type === 'roll') {
        sfx('roll');
        await this.animRoll(ev.d, 0.17);
        cur = { ...cur, x: ev.to[0], y: ev.to[1], c: next.c, r: next.r };
        this.die.position.copy(this.pos(cur.x, cur.y)).setY(H);
        this.die.quaternion.identity();
        this.paintDie(cur);
      } else if (ev.type === 'slide') {
        sfx('slide');
        const a = this.pos(...ev.from), b = this.pos(...ev.to);
        const n = Math.abs(ev.to[0] - ev.from[0]) + Math.abs(ev.to[1] - ev.from[1]);
        await this.tween(0.07 * n + 0.05, (t) => {
          const e = 1 - (1 - t) ** 2;
          this.die.position.lerpVectors(a, b, e).setY(H);
        });
        cur = { ...cur, x: ev.to[0], y: ev.to[1] };
      } else if (ev.type === 'turn') {
        sfx('turn');
        const decalM = this.turnDecals[`${cur.x},${cur.y}`];
        const base = decalM?.rotation.z ?? 0;
        await this.tween(0.32, (t) => {
          const e = easeOutBack(t);
          this.die.quaternion.setFromAxisAngle(UP, -e * Math.PI / 2);
          this.die.position.y = H + Math.sin(t * Math.PI) * 0.15;
          if (decalM) decalM.rotation.z = base - e * Math.PI / 2;
        });
        cur = { ...cur, rot: next.rot };
        this.die.quaternion.identity();
        this.paintDie(cur);
      } else if (ev.type === 'mark') {
        sfx('mark');
        await this.tween(0.3, (t) => {
          this.die.position.y = H + Math.sin(t * Math.PI) * 0.45;
          if (t > 0.5 && cur.mark !== next.mark) { cur = { ...cur, mark: next.mark }; this.paintDie(cur); }
        });
        this.burst(this.die.position, ev.mark === 2 ? [0xef6fa8, 0xffc4dd] : ev.mark === 1 ? [0x4a90e2, 0xbfe0ff] : [0xcccccc], 14, 0.6);
      } else if (ev.type === 'stamp') {
        sfx('stamp', ev);
        const m = this.slotDecals[ev.i];
        m.material.map = slotTex(ev.i, ev.letter, true);
        m.material.needsUpdate = true;
        this.burst(this.pos(ev.x, ev.y).setY(0.4), [0xe8483b, 0xffb347, 0xffe08a, 0x7fd1b9], 36, 1);
        await this.tween(0.28, (t) => {
          const s = 1 - Math.sin(t * Math.PI) * 0.22;
          this.die.scale.set(1 + (1 - s) * 0.6, s, 1 + (1 - s) * 0.6);
          this.die.position.y = H * s;
          m.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.3);
        });
        this.die.scale.setScalar(1);
      } else if (ev.type === 'crumble') {
        sfx('crumble');
        this.animCrumble(ev.k);
      } else if (ev.type === 'seal') {
        sfx('seal');
        const seal = this.seals[ev.i];
        const token = (seal.userData.anim = this.animToken);
        seal.visible = true;
        this.tween(0.3, (t) => {
          if (seal.userData.anim === token && this.animToken === token) seal.scale.set(1, Math.max(0.01, easeOutBack(t)), 1);
        }).then(() => { if (seal.userData.anim === token) seal.userData.anim = -1; });
      } else if (ev.type === 'miss') {
        sfx('miss');
        await this.shake(0.25);
      } else if (ev.type === 'bump' || ev.type === 'gateBlock') {
        sfx(ev.type);
        if (ev.type === 'gateBlock') this.shakeGate(ev.x, ev.y);
        await this.animBump(ev.d);
      } else if (ev.type === 'win') {
        await this.celebrate(sfx);
      }
    }
    this.sync(next, true);
  }
  async animRoll(d, dur) {
    const [dx, dz] = DIRS[d];
    const from = this.die.position.clone();
    await this.tween(dur, (t) => {
      const e = ease(t);
      const th = e * Math.PI / 2;
      this.die.quaternion.copy(this.rollQuat(d, th));
      this.die.position.set(from.x + dx * e, H * (Math.cos(th) + Math.sin(th)), from.z + dz * e);
    });
  }
  animCrumble(k) {
    const c = this.cracks[k];
    const token = (c.anim = this.animToken);
    c.decal.visible = false;
    const spin = (Math.random() - 0.5) * 2;
    this.burst(c.p.clone().setY(0), [0xe2c9a6, 0xb89a78], 10, 0.4);
    const live = () => c.anim === token && this.animToken === token;
    this.tween(0.6, (t) => {
      if (!live()) return;
      c.tile.position.y = -0.15 - t * t * 4;
      c.tile.rotation.set(t * spin, 0, t * spin * 0.7);
      c.tile.scale.setScalar(1 - t * 0.5);
    }).then(() => {
      if (!live()) return;
      c.tile.visible = false;
      c.anim = -1;
    });
  }
  async animBump(d) {
    const [dx, dz] = DIRS[d];
    const from = this.die.position.clone();
    await this.tween(0.22, (t) => {
      const k = Math.sin(t * Math.PI);
      this.die.quaternion.copy(this.rollQuat(d, k * 0.22));
      this.die.position.set(from.x + dx * k * 0.1, from.y, from.z + dz * k * 0.1);
    });
    this.die.quaternion.identity();
    this.die.position.copy(from);
  }
  async shake(dur) {
    const from = this.die.position.clone();
    await this.tween(dur, (t) => { this.die.position.x = from.x + Math.sin(t * 40) * 0.05 * (1 - t); });
    this.die.position.copy(from);
  }
  shakeGate(x, y) {
    const g = this.gates[`${x},${y}`];
    if (!g) return;
    this.tween(0.35, (t) => { g.rotation.z = Math.sin(t * 30) * 0.06 * (1 - t); });
  }
  async celebrate(sfx) {
    sfx('win');
    const from = this.die.position.clone();
    for (let i = 0; i < 3; i++) this.burst(from.clone().setY(1), [0xe8483b, 0xffb347, 0xffe08a, 0x7fd1b9, 0x4a90e2, 0xef6fa8], 50, 1.6);
    await this.tween(0.8, (t) => {
      this.die.position.y = from.y + Math.sin(t * Math.PI) * 1.2;
      this.die.quaternion.setFromAxisAngle(UP, ease(t) * Math.PI * 2);
    });
    this.die.quaternion.identity();
  }
  burst(at, colors, n, power) {
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.09, 0.14),
        new THREE.MeshBasicMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide, transparent: true }),
      );
      mesh.position.copy(at);
      const a = Math.random() * Math.PI * 2;
      const v = new THREE.Vector3(Math.cos(a), 2.2 + Math.random() * 2.5, Math.sin(a)).multiplyScalar(power);
      v.x *= 1.5; v.z *= 1.5;
      this.fx.add(mesh);
      this.particles.push({ mesh, v, life: 1 + Math.random() * 0.6, spin: (Math.random() - 0.5) * 20 });
    }
  }
  // ヒント：進むべき方向のプレビューを点滅させる
  flashHint(d) {
    const m = this.previews[d];
    if (!m.visible) return;
    this.tween(1.2, (t) => m.scale.setScalar(1 + Math.abs(Math.sin(t * Math.PI * 3)) * 0.6)).then(() => m.scale.setScalar(1));
  }
}

