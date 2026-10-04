// Texturas procedurales (mármol y madera) generadas en canvas: no requieren imágenes externas.
import * as THREE from 'three';

function makePerlin(seed) {
  const perm = Array.from({ length: 256 }, (_, i) => i);
  let s = seed % 2147483647 || 1;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const grad = (h, x, y) => {
    switch (h & 7) {
      case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y;
      case 4: return x; case 5: return -x; case 6: return y; default: return -y;
    }
  };
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (t, a, b) => a + t * (b - a);
  return (x, y) => {
    const fx = Math.floor(x), fy = Math.floor(y);
    const X = fx & 255, Y = fy & 255;
    x -= fx; y -= fy;
    const u = fade(x), v = fade(y);
    const a = p[X] + Y, b = p[X + 1] + Y;
    return lerp(v, lerp(u, grad(p[a], x, y), grad(p[b], x - 1, y)), lerp(u, grad(p[a + 1], x, y - 1), grad(p[b + 1], x - 1, y - 1)));
  };
}

const noise = makePerlin(1337);
function fbm(x, y, oct = 5) {
  let v = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += amp * noise(x * f, y * f); f *= 2; amp *= 0.5; }
  return v;
}

const hex = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// Paletas de cada tema
const THEMES = {
  marble: {
    light: { base: hex(0xf1eee8), alt: hex(0xd9d5cc), vein: hex(0x8e8a84), kind: 'marble' },
    dark: { base: hex(0x1b1c1f), alt: hex(0x2a2b30), vein: hex(0x8b8d96), kind: 'marble', invert: true },
    frame: { a: hex(0x24170f), b: hex(0x3d2818), label: '#d9b25f' },
  },
  wood: {
    light: { base: hex(0xe6c896), alt: hex(0xcfa66b), vein: hex(0xb88a52), kind: 'wood' },
    dark: { base: hex(0x6b3f22), alt: hex(0x4a2814), vein: hex(0x3a1e0e), kind: 'wood' },
    frame: { a: hex(0x2a170b), b: hex(0x452814), label: '#e8c98a' },
  },
};

function shadePixel(spec, x, y, ox, oy, rot) {
  // x, y en píxeles dentro de la casilla; ox, oy desplazamiento único por casilla
  let u = x, v = y;
  if (rot) { u = y; v = x; }
  if (spec.kind === 'marble') {
    const n = fbm((u + ox) * 0.006, (v + oy) * 0.006, 5);
    const w = Math.abs(Math.sin((u + ox) * 0.012 + (v + oy) * 0.007 + n * 7.5));
    const vein = Math.pow(1 - w, 9) + 0.35 * Math.pow(1 - Math.abs(Math.sin(n * 18 + u * 0.004)), 14);
    const cloud = fbm((u + ox) * 0.02 + 40, (v + oy) * 0.02, 3) * 0.5 + 0.5;
    let col = mix(spec.base, spec.alt, cloud * 0.8);
    col = mix(col, spec.vein, Math.min(1, vein * (spec.invert ? 0.55 : 0.7)));
    return col;
  }
  // Madera: vetas alargadas
  const n = fbm((u + ox) * 0.004, (v + oy) * 0.045, 4);
  const rings = Math.sin((u + ox) * 0.03 + n * 12) * 0.5 + 0.5;
  const fine = fbm((u + ox) * 0.08, (v + oy) * 0.8, 2) * 0.5 + 0.5;
  let col = mix(spec.base, spec.alt, rings * 0.65);
  col = mix(col, spec.vein, Math.pow(fine, 3) * 0.5);
  return col;
}

/** Textura del tablero completo 8x8 (fila 8 arriba, columna a a la izquierda). */
export function makeBoardTexture(themeName, renderer) {
  const theme = THEMES[themeName] || THEMES.marble;
  const S = 128, N = S * 8;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = N;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(N, N);
  const d = img.data;
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const light = (f + r) % 2 === 1;
      const spec = light ? theme.light : theme.dark;
      const ox = f * 977 + r * 331, oy = r * 613 + f * 197;
      const rot = theme.light.kind === 'wood' ? (f + r) % 2 === 0 : (f * 3 + r) % 2 === 0;
      const py0 = (7 - r) * S, px0 = f * S;
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          let col = shadePixel(spec, x, y, ox, oy, rot);
          // Juntas finas entre casillas
          const edge = Math.min(x, y, S - 1 - x, S - 1 - y);
          if (edge < 1) col = mix(col, [20, 18, 16], 0.45);
          const i = ((py0 + y) * N + px0 + x) * 4;
          d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

/** Textura del marco con coordenadas a-h y 1-8. `size` en unidades del mundo del marco. */
export function makeFrameTexture(themeName, renderer, size) {
  const theme = THEMES[themeName] || THEMES.marble;
  const N = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = N;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(N, N);
  const d = img.data;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const n = fbm(x * 0.003, y * 0.03, 4);
      const rings = Math.sin(x * 0.02 + n * 10) * 0.5 + 0.5;
      const col = mix(theme.frame.a, theme.frame.b, rings * 0.8);
      const i = (y * N + x) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const px = N / size; // píxeles por unidad
  const half = N / 2;
  // Filete dorado alrededor del tablero
  ctx.strokeStyle = theme.frame.label;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 3;
  ctx.strokeRect(half - 4.08 * px, half - 4.08 * px, 8.16 * px, 8.16 * px);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = theme.frame.label;
  ctx.font = `600 ${Math.round(px * 0.3)}px Georgia, 'Times New Roman', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const off = 4.42 * px;
  for (let i = 0; i < 8; i++) {
    const c = half + (i - 3.5) * px;
    const file = 'abcdefgh'[i];
    ctx.fillText(file, c, half + off);
    ctx.save(); ctx.translate(c, half - off); ctx.rotate(Math.PI); ctx.fillText(file, 0, 0); ctx.restore();
    const rank = String(8 - i);
    ctx.fillText(rank, half - off, c);
    ctx.save(); ctx.translate(half + off, c); ctx.rotate(Math.PI); ctx.fillText(rank, 0, 0); ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

/** Madera oscura de la mesa (repetible). */
export function makeTableTexture(renderer) {
  const N = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = N;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(N, N);
  const d = img.data;
  const a = hex(0x1a120c), b = hex(0x2c1d12);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // Ruido periódico en x para que la textura se pueda repetir sin costuras visibles
      const n = fbm(Math.sin((x / N) * Math.PI * 2) * 2 + 10, y * 0.02, 4);
      const rings = Math.sin(y * 0.05 + n * 9) * 0.5 + 0.5;
      const fine = fbm(x * 0.5, y * 0.02, 2) * 0.5 + 0.5;
      const col = mix(mix(a, b, rings), [12, 8, 5], Math.pow(fine, 4) * 0.6);
      const i = (y * N + x) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

/** Veta sutil para las piezas (boj y ébano). */
export function makePieceGrainTexture(baseHex, veinHex, strength) {
  const N = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = N;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(N, N);
  const d = img.data;
  const a = hex(baseHex), b = hex(veinHex);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const n = fbm(Math.sin((x / N) * Math.PI * 2) * 1.5 + 5, y * 0.02, 4);
      const g = Math.sin(y * 0.09 + n * 8) * 0.5 + 0.5;
      const col = mix(a, b, Math.pow(g, 3) * strength);
      const i = (y * N + x) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Gradiente radial para el resplandor del jaque. */
export function makeGlowTexture(color) {
  const N = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = N;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  g.addColorStop(0, color);
  g.addColorStop(0.55, color.replace(/[\d.]+\)$/, '0.45)'));
  g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, N, N);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
