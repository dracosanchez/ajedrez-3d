// Geometría de piezas estilo Staunton generada por torneado (lathe) y extrusión.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const SEG = 64;

function arc(cy, r, a0, a1, n = 12) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = THREE.MathUtils.degToRad(a0 + ((a1 - a0) * i) / n);
    pts.push([Math.max(0, r * Math.cos(a)), cy + r * Math.sin(a)]);
  }
  return pts;
}

// Suaviza un perfil con una curva Catmull-Rom manteniendo los extremos
function smooth(points, samples = 6) {
  const v = points.map(([x, y]) => new THREE.Vector2(x, y));
  const curve = new THREE.SplineCurve(v);
  return curve.getPoints(points.length * samples);
}

function lathe(points, smoothIt = true) {
  const pts = smoothIt ? smooth(points) : points.map(([x, y]) => new THREE.Vector2(x, y));
  // El torneado necesita radios >= 0
  pts.forEach((p) => { p.x = Math.max(0, p.x); });
  return new THREE.LatheGeometry(pts, SEG);
}

// Base común con anillos (bisel + toro)
function base(r) {
  return [
    [0, 0], [r, 0], [r, 0.035], [r * 0.985, 0.06], [r * 0.93, 0.085],
    [r * 0.86, 0.095], [r * 0.85, 0.115], [r * 0.82, 0.13], [r * 0.72, 0.145],
  ];
}

function sphere(r, y, x = 0, z = 0) {
  const g = new THREE.SphereGeometry(r, 32, 20);
  g.translate(x, y, z);
  return g;
}

function prep(geos) {
  const list = geos.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    // Uniformiza atributos para poder fusionar
    for (const name of Object.keys(ng.attributes)) {
      if (!['position', 'normal', 'uv'].includes(name)) ng.deleteAttribute(name);
    }
    if (!ng.attributes.uv) {
      ng.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((ng.attributes.position.count) * 2), 2));
    }
    return ng;
  });
  const merged = mergeGeometries(list, false);
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

function pawn() {
  const p = base(0.28).concat([
    [0.16, 0.17], [0.125, 0.23], [0.105, 0.31], [0.092, 0.39], [0.088, 0.45],
    [0.15, 0.465], [0.162, 0.49], [0.15, 0.515], [0.09, 0.53],
  ]);
  const head = arc(0.635, 0.125, -48, 90, 16);
  return prep([lathe(p), lathe(head, false)]);
}

function rook() {
  const p = base(0.3).concat([
    [0.19, 0.18], [0.178, 0.27], [0.168, 0.4], [0.162, 0.52], [0.165, 0.6],
    [0.2, 0.635], [0.228, 0.67],
  ]);
  const top = [[0.228, 0.67], [0.236, 0.69], [0.236, 0.8], [0.16, 0.8], [0.16, 0.765], [0, 0.765]];
  const geos = [lathe(p), lathe(top, false)];
  // Almenas
  const n = 5, span = (2 * Math.PI) / n, gap = 0.42;
  for (let i = 0; i < n; i++) {
    const a0 = i * span + gap / 2, a1 = (i + 1) * span - gap / 2;
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 0.236, a0, a1, false);
    shape.lineTo(0.16 * Math.cos(a1), 0.16 * Math.sin(a1));
    shape.absarc(0, 0, 0.16, a1, a0, true);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 3, curveSegments: 12 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.8, 0);
    geos.push(g);
  }
  return prep(geos);
}

function knight() {
  const b = base(0.3).concat([[0.2, 0.17], [0.0, 0.17]]);
  const geos = [lathe(b, false)];
  const pts = [
    [-0.2, 0.14], [-0.235, 0.3], [-0.225, 0.46], [-0.185, 0.6], [-0.125, 0.72], [-0.08, 0.81],
    [-0.065, 0.9], [-0.03, 0.99], [0.015, 0.915], [0.07, 0.87], [0.15, 0.8], [0.25, 0.68],
    [0.33, 0.585], [0.375, 0.53], [0.385, 0.47], [0.355, 0.425], [0.27, 0.415], [0.2, 0.44],
    [0.13, 0.5], [0.055, 0.47], [0.035, 0.38], [0.09, 0.27], [0.17, 0.14],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const shape = new THREE.Shape();
  shape.moveTo(pts[0].x, pts[0].y);
  shape.splineThru(pts.slice(1).concat([pts[0]]));
  const head = new THREE.ExtrudeGeometry(shape, {
    depth: 0.17, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.04, bevelSegments: 8, curveSegments: 64,
  });
  head.translate(0, 0, -0.085);
  // Esculpido: el hocico se estrecha, el cuello se ensancha hacia la base y las caras se abomban
  const pos = head.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const snout = THREE.MathUtils.smoothstep(x, 0.02, 0.36);
    const neck = 1 + 0.25 * (1 - THREE.MathUtils.smoothstep(y, 0.14, 0.5));
    const ear = 1 - 0.35 * THREE.MathUtils.smoothstep(y, 0.84, 0.98);
    pos.setZ(i, z * (1 - 0.42 * snout) * neck * ear);
  }
  // Normales suaves: fusionar vértices compartidos antes de recalcular
  head.deleteAttribute('normal');
  head.deleteAttribute('uv');
  const smoothHead = mergeVertices(head, 1e-4);
  smoothHead.computeVertexNormals();
  geos.push(smoothHead);
  // Ojos, fosas nasales y crin
  geos.push(sphere(0.028, 0.72, 0.12, 0.103), sphere(0.028, 0.72, 0.12, -0.103));
  geos.push(sphere(0.02, 0.5, 0.36, 0.055), sphere(0.02, 0.5, 0.36, -0.055));
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const g = new THREE.SphereGeometry(0.045, 16, 10);
    g.scale(0.8, 1, 0.55);
    g.translate(-0.19 + t * 0.12 - Math.pow(t, 2) * 0.03, 0.42 + t * 0.4, 0);
    geos.push(g);
  }
  return prep(geos);
}

function bishop() {
  const p = base(0.29).concat([
    [0.17, 0.17], [0.135, 0.25], [0.11, 0.37], [0.092, 0.5], [0.085, 0.6],
    [0.165, 0.615], [0.178, 0.64], [0.165, 0.665], [0.1, 0.675],
    [0.14, 0.69], [0.145, 0.705], [0.1, 0.72],
  ]);
  const head = [[0.1, 0.72], [0.12, 0.75], [0.138, 0.8], [0.14, 0.85], [0.128, 0.9], [0.1, 0.95], [0.06, 0.99], [0.02, 1.005], [0, 1.007]];
  return prep([lathe(p), lathe(head), sphere(0.045, 1.045)]);
}

function queen() {
  const p = base(0.32).concat([
    [0.19, 0.18], [0.15, 0.27], [0.12, 0.42], [0.102, 0.58], [0.096, 0.7],
    [0.18, 0.715], [0.193, 0.745], [0.18, 0.775], [0.11, 0.785],
    [0.16, 0.8], [0.165, 0.82], [0.11, 0.835],
  ]);
  const crown = [[0.11, 0.835], [0.13, 0.87], [0.165, 0.93], [0.2, 0.995], [0.212, 1.03], [0.18, 1.035], [0.14, 1.03], [0.125, 1.05], [0.11, 1.07], [0.08, 1.095], [0.04, 1.11], [0, 1.113]];
  const geos = [lathe(p), lathe(crown, false)];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    geos.push(sphere(0.03, 1.045, Math.cos(a) * 0.2, Math.sin(a) * 0.2));
  }
  geos.push(sphere(0.052, 1.155));
  return prep(geos);
}

function king() {
  const p = base(0.33).concat([
    [0.2, 0.18], [0.16, 0.28], [0.13, 0.44], [0.11, 0.62], [0.104, 0.75],
    [0.19, 0.765], [0.203, 0.795], [0.19, 0.825], [0.12, 0.835],
    [0.17, 0.85], [0.175, 0.87], [0.12, 0.885],
  ]);
  const crown = [[0.12, 0.885], [0.135, 0.92], [0.17, 0.99], [0.2, 1.06], [0.202, 1.09], [0.17, 1.1], [0.15, 1.115], [0.12, 1.15], [0.07, 1.18], [0, 1.19]];
  const v = new RoundedBoxGeometry(0.062, 0.24, 0.062, 2, 0.016);
  v.translate(0, 1.3, 0);
  const h = new RoundedBoxGeometry(0.19, 0.062, 0.062, 2, 0.016);
  h.translate(0, 1.33, 0);
  const neck = new THREE.CylinderGeometry(0.04, 0.055, 0.04, 24);
  neck.translate(0, 1.2, 0);
  return prep([lathe(p), lathe(crown, false), neck, v, h]);
}

let cache = null;
/** Devuelve las geometrías indexadas por tipo de pieza (1 = peón … 6 = rey). */
export function getPieceGeometries() {
  if (!cache) cache = { 1: pawn(), 2: knight(), 3: bishop(), 4: rook(), 5: queen(), 6: king() };
  return cache;
}
