// Verificación del generador de movimientos con posiciones perft estándar: node test/perft.js
global.self = global;
require('../js/chess.js');
const { Chess } = self.ChessLib;

function perft(c, d) {
  if (d === 0) return 1;
  const ms = c.moves();
  if (d === 1) return ms.length;
  let n = 0;
  for (const m of ms) { c.makeMove(m); n += perft(c, d - 1); c.unmakeMove(m); }
  return n;
}

const cases = [
  ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 4, 197281],
  ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 3, 97862],
  ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', 5, 674624],
  ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', 4, 422333],
  ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', 3, 62379],
];
let ok = true;
for (const [fen, d, exp] of cases) {
  const c = new Chess(fen);
  const t = Date.now();
  const n = perft(c, d);
  const pass = n === exp && c.fen() === new Chess(fen).fen();
  ok = ok && pass;
  console.log(`${pass ? 'OK ' : 'FAIL'} depth ${d}: ${n} (esperado ${exp}) ${Date.now() - t}ms`);
}

// Reglas de final de partida
const g = new Chess();
for (const u of ['f2f3', 'e7e5', 'g2g4', 'd8h4']) g.move({ from: u.slice(0, 2), to: u.slice(2, 4) });
console.log('Mate del loco:', g.history.map((h) => h.san).join(' '), JSON.stringify(g.status()));
ok = ok && g.status().reason === 'checkmate';
const r = new Chess();
for (const u of ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8']) r.move({ from: u.slice(0, 2), to: u.slice(2, 4) });
console.log('Triple repetición:', JSON.stringify(r.status()));
ok = ok && r.status().reason === 'threefold';
const s = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
console.log('Ahogado:', JSON.stringify(s.status()));
ok = ok && s.status().reason === 'stalemate';
const p = new Chess('8/P7/8/8/8/8/k6K/8 w - - 0 1');
const pm = p.move({ from: 'a7', to: 'a8', promotion: 'n' });
console.log('Promoción a caballo:', pm.san);
ok = ok && pm.san === 'a8=N';
process.exit(ok ? 0 : 1);
