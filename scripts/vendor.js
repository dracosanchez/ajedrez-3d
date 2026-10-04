// Copia a vendor/ solo los archivos de terceros que usa el juego, para poder publicarlo sin node_modules.
// Se ejecuta automáticamente tras `npm install` (postinstall) o con `npm run vendor`.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const NM = path.join(ROOT, 'node_modules');
const OUT = path.join(ROOT, 'vendor');

const FILES = [
  ['three/build/three.module.js', 'three/three.module.js'],
  ['three/examples/jsm/controls/OrbitControls.js', 'three/addons/controls/OrbitControls.js'],
  ['three/examples/jsm/environments/RoomEnvironment.js', 'three/addons/environments/RoomEnvironment.js'],
  ['three/examples/jsm/geometries/RoundedBoxGeometry.js', 'three/addons/geometries/RoundedBoxGeometry.js'],
  ['three/examples/jsm/utils/BufferGeometryUtils.js', 'three/addons/utils/BufferGeometryUtils.js'],
  ['three/LICENSE', 'three/LICENSE'],
  ['stockfish/src/stockfish-nnue-16-single.js', 'stockfish/stockfish-nnue-16-single.js'],
  ['stockfish/src/stockfish-nnue-16-single.wasm', 'stockfish/stockfish-nnue-16-single.wasm'],
  ['stockfish/Copying.txt', 'stockfish/Copying.txt'],
  ['qrcode-generator/qrcode.js', 'qrcode/qrcode.js'],
];

for (const [from, to] of FILES) {
  const src = path.join(NM, from);
  const dst = path.join(OUT, to);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}
console.log(`vendor/: ${FILES.length} archivos copiados`);
