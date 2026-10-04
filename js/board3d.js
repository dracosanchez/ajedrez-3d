// Escena 3D: tablero, piezas, iluminación realista, animaciones e interacción (clic o arrastrar).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { getPieceGeometries } from './pieces.js';
import { makeBoardTexture, makeFrameTexture, makeTableTexture, makePieceGrainTexture, makeGlowTexture } from './textures.js';

const FRAME = 9.7;          // ancho del marco
const TABLE_Y = -0.34;      // altura de la mesa
const LIFT = 0.12;          // elevación de la pieza seleccionada
const DRAG_Y = 0.55;        // altura al arrastrar

const ease = {
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  outBack: (t) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outBounce: (t) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

export const sqToPos = (sq, y = 0) => new THREE.Vector3((sq & 7) - 3.5, y, 3.5 - (sq >> 3));
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export class Board3D {
  /**
   * opts: {
   *   canSelect(sq) -> bool, getTargets(sq) -> [{to, capture}], onMove(from, to),
   * }
   */
  constructor(container, opts) {
    this.container = container;
    this.opts = opts;
    this.pieces = new Array(64).fill(null);
    this.graveyard = { 1: [], '-1': [] };
    this.anims = [];
    this.selected = -1;
    this.targets = [];
    this.down = null;
    this.interactive = true;
    this.theme = 'marble';

    const renderer = (this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(0x111317);
    scene.fog = new THREE.Fog(0x111317, 22, 46);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
    this.camera.position.set(0, 11.5, 9.8);

    // Escuchamos el puntero antes que OrbitControls para poder bloquear la cámara al tocar una pieza
    const el = renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => this._onDown(e));
    window.addEventListener('pointermove', (e) => this._onMove(e));
    window.addEventListener('pointerup', (e) => this._onUp(e));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('wheel', () => { this._autoDist = false; }, { passive: true });

    const controls = (this.controls = new OrbitControls(this.camera, el));
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 7;
    controls.maxDistance = 26;
    controls.minPolarAngle = 0.12;
    controls.maxPolarAngle = 1.28;
    controls.rotateSpeed = 0.6;

    this._setupLights();
    this._setupMaterials();
    this._buildBoard();
    this._buildHighlights();

    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_Y);

    this.clock = new THREE.Clock();
    const ro = new ResizeObserver(() => this._resize());
    ro.observe(container);
    this._resize(true);
    renderer.setAnimationLoop(() => this._frame());
  }

  /** Pausa o reanuda el render (cuando se alterna con la vista 2D). */
  setActive(on) {
    this.renderer.setAnimationLoop(on ? () => this._frame() : null);
    if (on) this._resize();
  }

  // ---------- Escena ----------
  _setupLights() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xe8eeff, 0x2b1d12, 0.45));
    const key = new THREE.DirectionalLight(0xfff1dc, 2.6);
    key.position.set(5.5, 13, 6.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const c = key.shadow.camera;
    c.left = -9; c.right = 9; c.top = 9; c.bottom = -9; c.near = 2; c.far = 40;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.025;
    key.shadow.radius = 4;
    s.add(key);
    const fill = new THREE.DirectionalLight(0xbcd2ff, 0.55);
    fill.position.set(-7, 6, -5);
    s.add(fill);
    const spot = new THREE.SpotLight(0xffe2b8, 28, 30, 0.6, 0.7, 1.6);
    spot.position.set(0, 14, 0);
    spot.target.position.set(0, 0, 0);
    s.add(spot, spot.target);
  }

  _setupMaterials() {
    const whiteGrain = makePieceGrainTexture(0xf1e6cf, 0xc9b18a, 0.35);
    const blackGrain = makePieceGrainTexture(0x1d1917, 0x3a2f28, 0.5);
    this.mat = {
      1: new THREE.MeshPhysicalMaterial({ map: whiteGrain, color: 0xffffff, roughness: 0.3, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.16, envMapIntensity: 0.9 }),
      '-1': new THREE.MeshPhysicalMaterial({ map: blackGrain, color: 0xffffff, roughness: 0.28, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.0 }),
    };
    this.geos = getPieceGeometries();
  }

  _buildBoard() {
    const r = this.renderer;
    // Mesa
    this.tableMat = new THREE.MeshStandardMaterial({ map: makeTableTexture(r), roughness: 0.55, metalness: 0, envMapIntensity: 0.4 });
    const table = new THREE.Mesh(new THREE.CircleGeometry(40, 96), this.tableMat);
    table.rotation.x = -Math.PI / 2;
    table.position.y = TABLE_Y;
    table.receiveShadow = true;
    this.scene.add(table);

    // Marco
    this.frameTopMat = new THREE.MeshPhysicalMaterial({ roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2, envMapIntensity: 0.7 });
    this.frameSideMat = new THREE.MeshPhysicalMaterial({ color: 0x2a1a0f, roughness: 0.4, clearcoat: 0.6, envMapIntensity: 0.6 });
    const frameH = -TABLE_Y - 0.02;
    const frameGeo = new RoundedBoxGeometry(FRAME, frameH, FRAME, 4, 0.06);
    const frame = new THREE.Mesh(frameGeo, this.frameSideMat);
    frame.position.y = TABLE_Y + frameH / 2;
    frame.castShadow = true;
    frame.receiveShadow = true;
    this.scene.add(frame);
    // Tapa con coordenadas (plano encima del marco)
    const top = new THREE.Mesh(new THREE.PlaneGeometry(FRAME - 0.1, FRAME - 0.1), this.frameTopMat);
    top.rotation.x = -Math.PI / 2;
    top.position.y = -0.019;
    top.receiveShadow = true;
    this.scene.add(top);

    // Superficie de juego (8x8)
    this.boardMat = new THREE.MeshPhysicalMaterial({ roughness: 0.22, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.12, envMapIntensity: 0.6 });
    const sideMat = new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.5 });
    const boardTop = (this.boardTop = new THREE.Mesh(new THREE.BoxGeometry(8, 0.04, 8), [sideMat, sideMat, this.boardMat, sideMat, sideMat, sideMat]));
    boardTop.position.y = -0.02;
    boardTop.receiveShadow = true;
    this.scene.add(boardTop);
    this.setTheme(this.theme);
  }

  setTheme(name) {
    this.theme = name;
    const r = this.renderer;
    if (this.boardMat.map) this.boardMat.map.dispose();
    if (this.frameTopMat.map) this.frameTopMat.map.dispose();
    this.boardMat.map = makeBoardTexture(name, r);
    this.boardMat.roughness = name === 'marble' ? 0.22 : 0.4;
    this.boardMat.clearcoat = name === 'marble' ? 0.6 : 0.4;
    this.boardMat.clearcoatRoughness = 0.22;
    this.boardMat.needsUpdate = true;
    this.frameTopMat.map = makeFrameTexture(name, r, FRAME - 0.1);
    this.frameTopMat.needsUpdate = true;
  }

  _buildHighlights() {
    const plane = new THREE.PlaneGeometry(1, 1);
    plane.rotateX(-Math.PI / 2);
    const mk = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.hl = new THREE.Group();
    this.scene.add(this.hl);
    this.lastFrom = new THREE.Mesh(plane, mk(0xf4c95d, 0.32));
    this.lastTo = new THREE.Mesh(plane, mk(0xf4c95d, 0.42));
    this.selMesh = new THREE.Mesh(plane, mk(0x4fc3f7, 0.45));
    this.hoverMesh = new THREE.Mesh(plane, mk(0xffffff, 0.18));
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: makeGlowTexture('rgba(255,40,30,1)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.checkMesh = glow;
    for (const m of [this.lastFrom, this.lastTo, this.selMesh, this.hoverMesh, this.checkMesh]) {
      m.visible = false;
      m.position.y = 0.004;
      this.hl.add(m);
    }
    this.dotGeo = new THREE.CircleGeometry(0.15, 32).rotateX(-Math.PI / 2);
    this.ringGeo = new THREE.RingGeometry(0.36, 0.47, 48).rotateX(-Math.PI / 2);
    this.dotMat = new THREE.MeshBasicMaterial({ color: 0x1e88e5, transparent: true, opacity: 0.55, depthWrite: false });
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xe53935, transparent: true, opacity: 0.6, depthWrite: false });
    this.targetMarkers = new THREE.Group();
    this.scene.add(this.targetMarkers);
  }

  _resize(initial = false) {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Ajusta la distancia para que el tablero quepa en pantallas estrechas
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const needed = Math.max(13.5, 5.4 / Math.tan(hfov / 2), 5.6 / Math.tan(vfov / 2));
    this.controls.maxDistance = Math.max(26, needed + 4);
    if (initial || this._autoDist) {
      const dir = this.camera.position.clone().sub(this.controls.target).normalize();
      this.camera.position.copy(dir.multiplyScalar(needed));
      this._autoDist = true;
    }
    this.camera.updateProjectionMatrix();
  }

  // ---------- Piezas ----------
  _makePiece(p) {
    const color = p > 0 ? 1 : -1;
    const type = Math.abs(p);
    const wrapper = new THREE.Group();
    const mesh = new THREE.Mesh(this.geos[type], this.mat[color]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // Caballos mirando al rival; el resto con una pequeña rotación natural
    if (type === 2) mesh.rotation.y = color === 1 ? Math.PI / 2 : -Math.PI / 2;
    else if (type === 3) mesh.rotation.y = color === 1 ? 0 : Math.PI;
    else mesh.rotation.y = (Math.random() - 0.5) * 0.5;
    wrapper.add(mesh);
    wrapper.userData = { piece: p, color, type, sq: -1 };
    mesh.userData.wrapper = wrapper;
    this.scene.add(wrapper);
    return wrapper;
  }

  _remove(obj) {
    if (!obj) return;
    this.scene.remove(obj);
  }

  /** Coloca todas las piezas sin animación. captured: { 1: [piezas blancas capturadas], -1: [...] } */
  setPosition(board, captured = { 1: [], '-1': [] }) {
    this.anims.length = 0;
    for (const p of this.pieces) this._remove(p);
    for (const c of [1, -1]) for (const p of this.graveyard[c]) this._remove(p);
    this.pieces = new Array(64).fill(null);
    this.graveyard = { 1: [], '-1': [] };
    for (let sq = 0; sq < 64; sq++) {
      const p = board[sq];
      if (!p) continue;
      const w = this._makePiece(p);
      w.position.copy(sqToPos(sq));
      w.userData.sq = sq;
      this.pieces[sq] = w;
    }
    for (const c of [1, -1]) {
      for (const p of captured[c] || []) {
        const w = this._makePiece(p);
        const slot = this._graveSlot(c, this.graveyard[c].length);
        w.position.copy(slot);
        w.scale.setScalar(0.82);
        this.graveyard[c].push(w);
      }
    }
    this.clearSelection();
  }

  _graveSlot(color, i) {
    // Piezas blancas capturadas a la izquierda (vista de blancas), negras a la derecha
    const col = Math.floor(i / 8), row = i % 8;
    const sx = color === 1 ? -1 : 1;
    const x = sx * (FRAME / 2 + 0.55 + col * 0.62);
    const z = color === 1 ? -3.4 + row * 0.97 : 3.4 - row * 0.97;
    return new THREE.Vector3(x, TABLE_Y, z);
  }

  // ---------- Animaciones ----------
  _tween(duration, update, easing = (t) => t, tag = null) {
    return new Promise((resolve) => {
      this.anims.push({ start: performance.now(), duration, update, easing, resolve, tag });
    });
  }

  _cancelTag(tag) {
    const gone = this.anims.filter((a) => a.tag === tag);
    this.anims = this.anims.filter((a) => a.tag !== tag);
    for (const a of gone) a.resolve();
  }

  _fly(obj, to, { height, duration, endY = 0, spin = 0, scaleTo = null }) {
    const start = obj.position.clone();
    const dx = to.x - start.x, dz = to.z - start.z;
    const dist = Math.hypot(dx, dz);
    const axis = dist > 0.001 ? new THREE.Vector3(dz / dist, 0, -dx / dist) : new THREE.Vector3(1, 0, 0);
    const startRotY = obj.rotation.y;
    const startScale = obj.scale.x;
    const peak = Math.max(start.y, endY) + height;
    return this._tween(duration, (t, raw) => {
      obj.position.x = start.x + dx * t;
      obj.position.z = start.z + dz * t;
      // Trayectoria parabólica que pasa por la altura máxima
      const base = start.y + (endY - start.y) * raw;
      const arc = 4 * raw * (1 - raw) * (peak - (start.y + endY) / 2);
      obj.position.y = base + arc;
      const tilt = -0.14 * Math.sin(2 * Math.PI * raw) * Math.min(1, dist / 2);
      obj.quaternion.setFromAxisAngle(axis, tilt);
      if (spin) obj.rotateY(startRotY + spin * t);
      if (scaleTo !== null) obj.scale.setScalar(startScale + (scaleTo - startScale) * t);
    }, ease.inOutCubic);
  }

  _landPos(sq) { return sqToPos(sq); }

  /** Anima un movimiento ya validado (objeto de ChessLib con from, to, piece, captured, promo, flags). */
  async animateMove(m, FLAG) {
    const obj = this.pieces[m.from];
    if (!obj) return;
    this.pieces[m.from] = null;
    let capSq = m.to;
    if (m.flags & FLAG.EP) capSq = m.to + (m.piece > 0 ? -8 : 8);
    const captured = m.captured ? this.pieces[capSq] : null;
    if (captured) this.pieces[capSq] = null;

    const to = this._landPos(m.to);
    const dist = obj.position.distanceTo(to);
    const isKnight = Math.abs(m.piece) === 2;
    const duration = Math.min(720, 360 + dist * 45);
    const height = isKnight ? 0.75 : 0.22 + Math.min(0.5, dist * 0.07);
    const jobs = [this._fly(obj, to, { height, duration })];
    obj.userData.sq = m.to;
    this.pieces[m.to] = obj;

    if (captured) {
      jobs.push(delay(duration * 0.62).then(() => this._toGraveyard(captured)));
    }
    if (m.flags & (FLAG.KCASTLE | FLAG.QCASTLE)) {
      const rf = m.flags & FLAG.KCASTLE ? m.to + 1 : m.to - 2;
      const rt = m.flags & FLAG.KCASTLE ? m.to - 1 : m.to + 1;
      const rook = this.pieces[rf];
      this.pieces[rf] = null;
      if (rook) {
        rook.userData.sq = rt;
        this.pieces[rt] = rook;
        jobs.push(delay(duration * 0.45).then(() => this._fly(rook, this._landPos(rt), { height: 0.45, duration: 480 })));
      }
    }
    await Promise.all(jobs);
    if (m.promo) await this._promote(obj, m.to, m.promo);
  }

  _toGraveyard(obj) {
    const color = obj.userData.color;
    const slot = this._graveSlot(color, this.graveyard[color].length);
    this.graveyard[color].push(obj);
    obj.userData.sq = -1;
    return this._fly(obj, slot, { height: 1.4, duration: 760, endY: TABLE_Y, spin: Math.PI * (Math.random() > 0.5 ? 1 : -1), scaleTo: 0.82 });
  }

  async _promote(oldObj, sq, promo) {
    const neo = this._makePiece(promo);
    neo.position.copy(sqToPos(sq));
    neo.scale.setScalar(0.001);
    neo.userData.sq = sq;
    const oy = oldObj.position.y;
    await this._tween(520, (t) => {
      oldObj.scale.setScalar(Math.max(0.001, 1 - t));
      oldObj.position.y = oy - 0.2 * t;
      neo.scale.setScalar(Math.max(0.001, ease.outBack(t)));
      neo.rotation.y = -Math.PI * 1.5 * (1 - t);
    }, (t) => t);
    this._remove(oldObj);
    this.pieces[sq] = neo;
  }

  /** Devuelve una pieza soltada fuera de lugar a su casilla. */
  returnPiece(sq) {
    const obj = this.pieces[sq];
    if (!obj) return Promise.resolve();
    this.clearSelection();
    return this._fly(obj, sqToPos(sq), { height: 0.1, duration: 260 });
  }

  /** El rey derrotado cae sobre el tablero. */
  toppleKing(sq) {
    const obj = this.pieces[sq];
    if (!obj) return Promise.resolve();
    const ang = Math.random() * Math.PI * 2;
    const d = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
    const axis = new THREE.Vector3(0, 1, 0).cross(d).normalize();
    const R = 0.3, start = obj.position.clone(), final = 1.38;
    return this._tween(1100, (t) => {
      const th = final * t;
      obj.quaternion.setFromAxisAngle(axis, th);
      obj.position.copy(start).addScaledVector(d, R * (1 - Math.cos(th))).add(new THREE.Vector3(0, R * Math.sin(th) * 0.55, 0));
    }, ease.outBounce);
  }

  /** Gira la cámara para mirar desde el lado de `color` (1 blancas, -1 negras). */
  setOrientation(color, animate = true) {
    const target = color === 1 ? 0 : Math.PI;
    const offset = this.camera.position.clone().sub(this.controls.target);
    const sph = new THREE.Spherical().setFromVector3(offset);
    let delta = target - sph.theta;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta <= -Math.PI) delta += 2 * Math.PI;
    if (Math.abs(delta) < 0.01) return Promise.resolve();
    const from = sph.theta;
    const apply = (theta) => {
      sph.theta = theta;
      this.camera.position.setFromSpherical(sph).add(this.controls.target);
      this.camera.lookAt(this.controls.target);
    };
    if (!animate) { apply(from + delta); this.controls.update(); return Promise.resolve(); }
    this._camAnim = true;
    this.controls.enabled = false;
    return this._tween(1250, (t) => apply(from + delta * t), ease.inOutCubic).then(() => {
      this._camAnim = false;
      this.controls.enabled = true;
      this.controls.update();
    });
  }

  // ---------- Resaltados ----------
  setLastMove(from, to) {
    if (from < 0) { this.lastFrom.visible = this.lastTo.visible = false; return; }
    this.lastFrom.position.set((from & 7) - 3.5, 0.004, 3.5 - (from >> 3));
    this.lastTo.position.set((to & 7) - 3.5, 0.004, 3.5 - (to >> 3));
    this.lastFrom.visible = this.lastTo.visible = true;
  }

  setCheck(sq) {
    if (sq < 0) { this.checkMesh.visible = false; return; }
    this.checkMesh.position.set((sq & 7) - 3.5, 0.006, 3.5 - (sq >> 3));
    this.checkMesh.visible = true;
  }

  select(sq) {
    this._dropLift();
    this.selected = sq;
    this.targets = this.opts.getTargets(sq);
    this.selMesh.position.set((sq & 7) - 3.5, 0.005, 3.5 - (sq >> 3));
    this.selMesh.visible = true;
    this.targetMarkers.clear();
    for (const t of this.targets) {
      const m = new THREE.Mesh(t.capture ? this.ringGeo : this.dotGeo, t.capture ? this.ringMat : this.dotMat);
      m.position.set((t.to & 7) - 3.5, 0.008, 3.5 - (t.to >> 3));
      this.targetMarkers.add(m);
    }
    const obj = this.pieces[sq];
    if (obj) {
      this._lifted = obj;
      const y0 = obj.position.y;
      this._tween(140, (t) => { obj.position.y = y0 + (LIFT - y0) * t; }, ease.outCubic, 'lift');
    }
  }

  _dropLift() {
    const obj = this._lifted;
    this._lifted = null;
    this._cancelTag('lift');
    if (obj && obj.userData.sq >= 0 && this.pieces[obj.userData.sq] === obj) {
      const y0 = obj.position.y;
      if (y0 > 0.001) this._tween(140, (t) => { obj.position.y = y0 * (1 - t); }, ease.outCubic, 'lift');
    }
  }

  clearSelection(keepLift = false) {
    if (!keepLift) this._dropLift();
    else this._lifted = null;
    this.selected = -1;
    this.targets = [];
    this.selMesh.visible = false;
    this.hoverMesh.visible = false;
    this.targetMarkers.clear();
  }

  // ---------- Entrada ----------
  _setNdc(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
  }

  _boardSqFromRay() {
    const hit = this.raycaster.intersectObject(this.boardTop, false)[0];
    if (!hit) return -1;
    const f = Math.floor(hit.point.x + 4), r = Math.floor(4 - hit.point.z);
    return f >= 0 && f < 8 && r >= 0 && r < 8 ? r * 8 + f : -1;
  }

  _pick(e) {
    this._setNdc(e);
    const meshes = [];
    for (const w of this.pieces) if (w) meshes.push(w.children[0]);
    const hit = this.raycaster.intersectObjects(meshes, false)[0];
    const pieceSq = hit ? hit.object.userData.wrapper.userData.sq : -1;
    const boardSq = this._boardSqFromRay();
    // Las piezas altas tapan a las de detrás: priorizamos lo que tenga sentido para el jugador
    if (this.selected >= 0) {
      if (pieceSq >= 0 && this._isTarget(pieceSq)) return pieceSq;
      if (boardSq >= 0 && this._isTarget(boardSq)) return boardSq;
    }
    const movable = (sq) => sq >= 0 && this.pieces[sq] && this.opts.canSelect(sq) && this.opts.getTargets(sq).length > 0;
    if (movable(pieceSq)) return pieceSq;
    if (movable(boardSq)) return boardSq;
    return pieceSq >= 0 ? pieceSq : boardSq;
  }

  _isTarget(sq) { return this.targets.some((t) => t.to === sq); }

  _onDown(e) {
    if (e.button !== 0 || !this.interactive) return;
    const sq = this._pick(e);
    this.down = { x: e.clientX, y: e.clientY, sq, dragging: false, canDrag: false, wasSelected: this.selected === sq };
    if (sq < 0) return;
    if (this.selected >= 0 && this._isTarget(sq)) { this.controls.enabled = false; return; }
    if (this.pieces[sq] && this.opts.canSelect(sq)) {
      this.controls.enabled = false;
      if (this.selected !== sq) this.select(sq);
      this.down.canDrag = true;
    }
  }

  _onMove(e) {
    if (!this.interactive) return;
    const d = this.down;
    if (d && d.canDrag) {
      if (!d.dragging && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) {
        d.dragging = true;
        this._cancelTag('lift');
        this.renderer.domElement.style.cursor = 'grabbing';
      }
      if (d.dragging) {
        this._setNdc(e);
        const p = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.dragPlane, p)) {
          const obj = this.pieces[d.sq];
          if (obj) {
            p.x = THREE.MathUtils.clamp(p.x, -5, 5);
            p.z = THREE.MathUtils.clamp(p.z, -5, 5);
            obj.position.set(p.x, DRAG_Y, p.z);
          }
        }
        const over = this._boardSqFromRay();
        this._showHover(over >= 0 && this._isTarget(over) ? over : -1);
      }
      return;
    }
    if (e.target !== this.renderer.domElement) return;
    // Cursor y casilla bajo el puntero
    const sq = this._pick(e);
    const hot = sq >= 0 && ((this.selected >= 0 && this._isTarget(sq)) || (this.pieces[sq] && this.opts.canSelect(sq)));
    this.renderer.domElement.style.cursor = hot ? 'pointer' : 'default';
    this._showHover(this.selected >= 0 && this._isTarget(sq) ? sq : -1);
  }

  _showHover(sq) {
    if (sq < 0) { this.hoverMesh.visible = false; return; }
    this.hoverMesh.position.set((sq & 7) - 3.5, 0.006, 3.5 - (sq >> 3));
    this.hoverMesh.visible = true;
  }

  _onUp(e) {
    const d = this.down;
    this.down = null;
    this.controls.enabled = !this._camAnim;
    if (!d || !this.interactive) return;
    this.renderer.domElement.style.cursor = 'default';
    if (d.dragging) {
      this._setNdc(e);
      const to = this._boardSqFromRay();
      const from = this.selected;
      if (to >= 0 && this._isTarget(to)) {
        this.clearSelection(true);
        this.opts.onMove(from, to);
      } else {
        this.returnPiece(d.sq);
      }
      return;
    }
    const sq = this._pick(e);
    if (sq !== d.sq) return; // fue un giro de cámara
    if (this.selected >= 0 && this._isTarget(sq)) {
      const from = this.selected;
      this.clearSelection(true);
      this.opts.onMove(from, sq);
    } else if (sq >= 0 && this.pieces[sq] && this.opts.canSelect(sq)) {
      if (d.wasSelected) this.clearSelection();
    } else {
      this.clearSelection();
    }
  }

  // ---------- Bucle ----------
  _frame() {
    const now = performance.now();
    if (this.anims.length) {
      const done = [];
      for (const a of this.anims.slice()) {
        const raw = Math.min(1, Math.max(0, (now - a.start) / a.duration));
        a.update(a.easing(raw), raw);
        if (raw >= 1) done.push(a);
      }
      if (done.length) {
        this.anims = this.anims.filter((a) => !done.includes(a));
        for (const a of done) a.resolve();
      }
    }
    if (this.checkMesh.visible) {
      const t = this.clock.getElapsedTime();
      this.checkMesh.material.opacity = 0.65 + 0.3 * Math.sin(t * 5);
    }
    if (!this._camAnim) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
