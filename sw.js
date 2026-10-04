// Service worker: guarda el juego en caché para que funcione sin conexión una vez instalado.
const VERSION = 'ajedrez-v2';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/main.js', 'js/chess.js', 'js/ai.js', 'js/engine-worker.js', 'js/board2d.js', 'js/board3d.js',
  'js/pieces.js', 'js/textures.js', 'js/clock.js', 'js/sound.js',
  'vendor/three/three.module.js',
  'vendor/three/addons/controls/OrbitControls.js',
  'vendor/three/addons/environments/RoomEnvironment.js',
  'vendor/three/addons/geometries/RoundedBoxGeometry.js',
  'vendor/three/addons/utils/BufferGeometryUtils.js',
  'vendor/stockfish/stockfish-nnue-16-single.js',
  'vendor/stockfish/stockfish-nnue-16-single.wasm',
  'vendor/qrcode/qrcode.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Red primero (para recibir actualizaciones) y caché si no hay conexión
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
  );
});
