/*
 * Motor de ajedrez propio (alfa-beta con búsqueda de quietud, tabla de transposición y profundización iterativa).
 * Se usa para los niveles Principiante y Aficionado, y como respaldo si Stockfish no está disponible.
 * Mensaje de entrada: { id, fen, moves: [uci...], depth, timeMs, noise, randomRate }
 * Respuesta: { id, move: { from, to, promotion }, score }
 */
importScripts('chess.js');
const { Chess, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, FLAG } = self.ChessLib;

const VAL = [0, 100, 320, 330, 500, 900, 0];
// Tablas pieza-casilla (vista de las blancas, fila 8 primero)
const PST = {
  [PAWN]: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  [KNIGHT]: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  [BISHOP]: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  [ROOK]: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  [QUEEN]: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
};
const KING_MID = [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20];
const KING_END = [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50];
const PHASE_W = [0, 0, 1, 1, 2, 4, 0];

function evaluate(c) {
  const b = c.board;
  let mg = 0, phase = 0, wb = 0, bb = 0, matW = 0, matB = 0;
  let wk = 0, bk = 0;
  for (let s = 0; s < 64; s++) {
    const p = b[s];
    if (!p) continue;
    const t = p > 0 ? p : -p;
    const idx = p > 0 ? (7 - (s >> 3)) * 8 + (s & 7) : s;
    phase += PHASE_W[t];
    if (t === KING) { if (p > 0) wk = s; else bk = s; continue; }
    const v = VAL[t] + PST[t][idx];
    if (p > 0) { mg += v; matW += VAL[t]; if (t === BISHOP) wb++; }
    else { mg -= v; matB += VAL[t]; if (t === BISHOP) bb++; }
  }
  if (phase > 24) phase = 24;
  const wki = (7 - (wk >> 3)) * 8 + (wk & 7), bki = bk;
  mg += (KING_MID[wki] * phase + KING_END[wki] * (24 - phase)) / 24;
  mg -= (KING_MID[bki] * phase + KING_END[bki] * (24 - phase)) / 24;
  if (wb >= 2) mg += 30;
  if (bb >= 2) mg -= 30;
  // Ayuda para dar mate en finales: acorralar al rey rival y acercar el propio
  if (phase < 8) {
    const diff = matW - matB;
    if (Math.abs(diff) >= 300) {
      const loser = diff > 0 ? bk : wk, winner = diff > 0 ? wk : bk;
      const lf = loser & 7, lr = loser >> 3;
      const center = Math.max(3 - lf, lf - 4) + Math.max(3 - lr, lr - 4);
      const dist = Math.abs(lf - (winner & 7)) + Math.abs(lr - (winner >> 3));
      const bonus = center * 10 + (14 - dist) * 4;
      mg += diff > 0 ? bonus : -bonus;
    }
  }
  return mg * c.turn;
}

const INF = 1e9, MATE = 1e6, MAX_PLY = 64;
const EXACT = 0, LOWER = 1, UPPER = 2;
let nodes = 0, deadline = 0, killers = [], tt = new Map(), history = new Int32Array(64 * 64);
const ABORT = {};

function sameMove(a, b) { return a && b && a.from === b.from && a.to === b.to && a.promo === b.promo; }

function orderMoves(moves, ttMove, ply) {
  const k = killers[ply] || [];
  for (const m of moves) {
    let s = 0;
    if (sameMove(m, ttMove)) s = 1e7;
    else if (m.captured) s = 1e6 + VAL[Math.abs(m.captured)] * 10 - VAL[Math.abs(m.piece)] / 10;
    else if (m.promo) s = 9e5;
    else if (sameMove(m, k[0])) s = 8e5;
    else if (sameMove(m, k[1])) s = 7e5;
    else s = history[m.from * 64 + m.to];
    m._s = s;
  }
  moves.sort((a, b) => b._s - a._s);
}

function isRepetition(c) {
  const st = c.stack, n = st.length;
  for (let i = n - 2, steps = 2; i >= 0 && steps <= c.half; i -= 2, steps += 2) {
    if (st[i].hLo === c.hLo && st[i].hHi === c.hHi) return true;
  }
  return false;
}

function qsearch(c, alpha, beta, ply) {
  if ((++nodes & 2047) === 0 && Date.now() > deadline) throw ABORT;
  const stand = evaluate(c);
  if (stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  if (ply >= MAX_PLY) return stand;
  const moves = c.genMoves([], true);
  orderMoves(moves, null, ply);
  const us = c.turn;
  for (const m of moves) {
    if (!m.promo && stand + VAL[Math.abs(m.captured)] + 200 < alpha) continue;
    c.makeMove(m);
    if (c.isAttacked(c.kingSq(us), -us)) { c.unmakeMove(m); continue; }
    const score = -qsearch(c, -beta, -alpha, ply + 1);
    c.unmakeMove(m);
    if (score >= beta) return score;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function negamax(c, depth, alpha, beta, ply) {
  if ((++nodes & 2047) === 0 && Date.now() > deadline) throw ABORT;
  if (ply > 0 && (c.half >= 100 || isRepetition(c))) return 0;
  const us = c.turn;
  const inCheck = c.isAttacked(c.kingSq(us), -us);
  if (inCheck) depth++;
  if (depth <= 0) return qsearch(c, alpha, beta, ply);

  const e = tt.get(c.hLo);
  let ttMove = null;
  if (e && e.hi === c.hHi) {
    ttMove = e.move;
    if (ply > 0 && e.depth >= depth) {
      if (e.flag === EXACT) return e.score;
      if (e.flag === LOWER && e.score >= beta) return e.score;
      if (e.flag === UPPER && e.score <= alpha) return e.score;
    }
  }

  // Poda de movimiento nulo
  if (!inCheck && ply > 0 && depth >= 3 && evaluate(c) >= beta) {
    let hasPieces = false;
    for (let s = 0; s < 64; s++) { const p = c.board[s] * us; if (p > PAWN && p < KING) { hasPieces = true; break; } }
    if (hasPieces) {
      const ep = c.ep, lo = c.hLo, hi = c.hHi;
      c.turn = -us; c.ep = -1; c.hLo ^= 0x5bd1e995; c.hHi ^= 0x1b873593;
      c.stack.push({ castling: c.castling, ep, half: c.half, hLo: lo, hHi: hi, k0: c.kings[0], k1: c.kings[1] });
      let score;
      try { score = -negamax(c, depth - 3, -beta, -beta + 1, ply + 1); }
      finally { c.stack.pop(); c.turn = us; c.ep = ep; c.hLo = lo; c.hHi = hi; }
      if (score >= beta) return beta;
    }
  }

  const moves = c.genMoves([], false);
  orderMoves(moves, ttMove, ply);
  let best = -INF, bestMove = null, legal = 0;
  const alpha0 = alpha;
  for (const m of moves) {
    c.makeMove(m);
    if (c.isAttacked(c.kingSq(us), -us)) { c.unmakeMove(m); continue; }
    legal++;
    let score;
    if (legal > 4 && depth >= 3 && !m.captured && !m.promo && !inCheck) {
      score = -negamax(c, depth - 2, -alpha - 1, -alpha, ply + 1);
      if (score > alpha) score = -negamax(c, depth - 1, -beta, -alpha, ply + 1);
    } else {
      score = -negamax(c, depth - 1, -beta, -alpha, ply + 1);
    }
    c.unmakeMove(m);
    if (score > best) {
      best = score; bestMove = m;
      if (score > alpha) {
        alpha = score;
        if (alpha >= beta) {
          if (!m.captured) {
            const k = killers[ply] || (killers[ply] = []);
            if (!sameMove(k[0], m)) { k[1] = k[0]; k[0] = m; }
            history[m.from * 64 + m.to] += depth * depth;
          }
          break;
        }
      }
    }
  }
  if (!legal) return inCheck ? -MATE + ply : 0;
  const flag = best <= alpha0 ? UPPER : best >= beta ? LOWER : EXACT;
  if (tt.size > 1500000) tt.clear();
  tt.set(c.hLo, { hi: c.hHi, depth, score: best, flag, move: bestMove && { from: bestMove.from, to: bestMove.to, promo: bestMove.promo } });
  return best;
}

function rootScores(c, depth) {
  // Puntúa todas las jugadas de la raíz (para los niveles que cometen errores "humanos")
  const legal = c.moves();
  const out = [];
  for (const m of legal) {
    c.makeMove(m);
    const s = -negamax(c, depth - 1, -INF, INF, 1);
    c.unmakeMove(m);
    out.push({ m, s });
  }
  return out;
}

function gauss() {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function search(req) {
  const c = new Chess(req.fen);
  for (const u of req.moves || []) c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  const legal = c.moves();
  if (!legal.length) return null;
  nodes = 0; killers = []; history.fill(0);
  deadline = Date.now() + (req.timeMs || 1000);

  // Niveles débiles: jugada aleatoria ocasional y ruido en la evaluación
  if (req.randomRate && Math.random() < req.randomRate) {
    return { m: legal[(Math.random() * legal.length) | 0], s: 0 };
  }
  if (req.noise) {
    let scored;
    try { scored = rootScores(c, Math.max(1, req.depth)); }
    catch (e) { if (e !== ABORT) throw e; scored = legal.map((m) => ({ m, s: 0 })); }
    let best = null, bestV = -INF;
    for (const x of scored) {
      const v = x.s + gauss() * req.noise;
      if (v > bestV) { bestV = v; best = x; }
    }
    return best;
  }

  let bestMove = legal[0], bestScore = 0;
  for (let d = 1; d <= (req.depth || 64); d++) {
    try {
      const score = negamax(c, d, -INF, INF, 0);
      const e = tt.get(c.hLo);
      if (e && e.hi === c.hHi && e.move) {
        const m = legal.find((x) => sameMove(x, e.move));
        if (m) { bestMove = m; bestScore = score; }
      }
      if (Math.abs(score) > MATE - 100) break;
    } catch (e) {
      if (e !== ABORT) throw e;
      break;
    }
    if (Date.now() > deadline - (req.timeMs || 1000) * 0.45 && d >= 2) break;
  }
  return { m: bestMove, s: bestScore };
}

self.onmessage = (ev) => {
  const req = ev.data;
  const res = search(req);
  const m = res && res.m;
  self.postMessage({
    id: req.id,
    move: m ? {
      from: self.ChessLib.sqName(m.from),
      to: self.ChessLib.sqName(m.to),
      promotion: m.promo ? ' pnbrqk'[Math.abs(m.promo)] : undefined,
    } : null,
    score: res ? Math.round(res.s) : 0,
  });
};
