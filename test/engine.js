// Prueba rápida del motor propio en Node: node test/engine.js
const path = require('path');
global.self = global;
global.importScripts = (f) => require(path.join(__dirname, '../js', f));
let out;
global.postMessage = (m) => { out = m; };
self.postMessage = global.postMessage;
require('../js/engine-worker.js');
const run = (req) => { const t = Date.now(); self.onmessage({ data: req }); return { ...out, ms: Date.now() - t }; };
console.log('Inicio d5 1.5s:', run({ id: 1, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', depth: 64, timeMs: 1500 }));
console.log('Mate en 1 (Qxf7#):', run({ id: 2, fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4', depth: 64, timeMs: 1000 }));
console.log('Captura dama colgada:', run({ id: 3, fen: 'rnb1kbnr/pppp1ppp/8/4p3/3qP3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 0 1', depth: 64, timeMs: 1000 }));
console.log('Principiante:', run({ id: 4, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', depth: 1, timeMs: 300, noise: 220, randomRate: 0.18 }));
console.log('Aficionado:', run({ id: 5, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', depth: 3, timeMs: 800, noise: 45, randomRate: 0.03 }));
