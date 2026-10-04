/*
 * Reglas oficiales del ajedrez (Leyes del Ajedrez FIDE).
 * Script clásico: se usa tanto en la página (window.ChessLib) como en el Web Worker del motor propio.
 *
 * Representación: tablero de 64 casillas, índice = fila * 8 + columna (a1 = 0, h8 = 63).
 * Piezas: 0 vacío, blancas positivas (1..6), negras negativas (-1..-6).
 */
(function (global) {
  'use strict';

  const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
  const WHITE = 1, BLACK = -1;
  const FLAG = { CAPTURE: 1, EP: 2, DOUBLE: 4, KCASTLE: 8, QCASTLE: 16, PROMO: 32 };
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const FILES = 'abcdefgh';
  const PIECE_CHARS = ' pnbrqk';
  const SAN_LETTERS = ' PNBRQK';

  const sqName = (s) => FILES[s & 7] + ((s >> 3) + 1);
  const sqIndex = (n) => (n.charCodeAt(1) - 49) * 8 + (n.charCodeAt(0) - 97);

  // Tablas precalculadas de destinos y rayos
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const KN = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  const KNIGHT_T = [], KING_T = [], RAYS = [];
  const onBoard = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;
  for (let s = 0; s < 64; s++) {
    const f = s & 7, r = s >> 3;
    KNIGHT_T[s] = KN.filter(([df, dr]) => onBoard(f + df, r + dr)).map(([df, dr]) => (r + dr) * 8 + f + df);
    KING_T[s] = DIRS.filter(([df, dr]) => onBoard(f + df, r + dr)).map(([df, dr]) => (r + dr) * 8 + f + df);
    RAYS[s] = DIRS.map(([df, dr]) => {
      const ray = [];
      let a = f + df, b = r + dr;
      while (onBoard(a, b)) { ray.push(b * 8 + a); a += df; b += dr; }
      return ray;
    });
  }

  // Derechos de enroque: 1 = O-O blancas, 2 = O-O-O blancas, 4 = O-O negras, 8 = O-O-O negras
  const CASTLE_MASK = new Array(64).fill(15);
  CASTLE_MASK[4] = 15 & ~3; CASTLE_MASK[0] = 15 & ~2; CASTLE_MASK[7] = 15 & ~1;
  CASTLE_MASK[60] = 15 & ~12; CASTLE_MASK[56] = 15 & ~8; CASTLE_MASK[63] = 15 & ~4;

  // Claves Zobrist (dos enteros de 32 bits)
  let seed = 0x9e3779b9;
  const rnd = () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) | 0;
  };
  const ZPL = new Int32Array(768), ZPH = new Int32Array(768);
  for (let i = 0; i < 768; i++) { ZPL[i] = rnd(); ZPH[i] = rnd(); }
  const ZCL = new Int32Array(16), ZCH = new Int32Array(16);
  for (let i = 0; i < 16; i++) { ZCL[i] = rnd(); ZCH[i] = rnd(); }
  const ZEL = new Int32Array(8), ZEH = new Int32Array(8);
  for (let i = 0; i < 8; i++) { ZEL[i] = rnd(); ZEH[i] = rnd(); }
  const ZSL = rnd(), ZSH = rnd();
  const zIndex = (p, sq) => (p > 0 ? p - 1 : 5 - p) * 64 + sq;

  const mv = (from, to, piece, captured, promo, flags) => ({ from, to, piece, captured, promo, flags });

  class Chess {
    constructor(fen) { this.load(fen || START_FEN); }

    load(fen) {
      const parts = fen.trim().split(/\s+/);
      this.board = new Int8Array(64);
      this.kings = [4, 60];
      let r = 7, f = 0;
      for (const ch of parts[0]) {
        if (ch === '/') { r--; f = 0; continue; }
        if (ch >= '1' && ch <= '8') { f += +ch; continue; }
        const t = PIECE_CHARS.indexOf(ch.toLowerCase());
        const c = ch === ch.toUpperCase() ? WHITE : BLACK;
        this.board[r * 8 + f] = t * c;
        if (t === KING) this.kings[c === WHITE ? 0 : 1] = r * 8 + f;
        f++;
      }
      this.turn = parts[1] === 'b' ? BLACK : WHITE;
      const cs = parts[2] || '-';
      this.castling = (cs.includes('K') ? 1 : 0) | (cs.includes('Q') ? 2 : 0) | (cs.includes('k') ? 4 : 0) | (cs.includes('q') ? 8 : 0);
      this.ep = parts[3] && parts[3] !== '-' ? sqIndex(parts[3]) : -1;
      this.half = parseInt(parts[4], 10) || 0;
      this.full = parseInt(parts[5], 10) || 1;
      this.stack = [];
      this.history = [];
      this._computeHash();
      this.repKeys = [this.repKey()];
    }

    fen() {
      let out = '';
      for (let r = 7; r >= 0; r--) {
        let empty = 0;
        for (let f = 0; f < 8; f++) {
          const p = this.board[r * 8 + f];
          if (!p) { empty++; continue; }
          if (empty) { out += empty; empty = 0; }
          const ch = PIECE_CHARS[Math.abs(p)];
          out += p > 0 ? ch.toUpperCase() : ch;
        }
        if (empty) out += empty;
        if (r) out += '/';
      }
      let cs = (this.castling & 1 ? 'K' : '') + (this.castling & 2 ? 'Q' : '') + (this.castling & 4 ? 'k' : '') + (this.castling & 8 ? 'q' : '');
      return `${out} ${this.turn === WHITE ? 'w' : 'b'} ${cs || '-'} ${this.ep >= 0 ? sqName(this.ep) : '-'} ${this.half} ${this.full}`;
    }

    kingSq(color) { return this.kings[color === WHITE ? 0 : 1]; }

    _computeHash() {
      let lo = 0, hi = 0;
      for (let s = 0; s < 64; s++) {
        const p = this.board[s];
        if (p) { const i = zIndex(p, s); lo ^= ZPL[i]; hi ^= ZPH[i]; }
      }
      lo ^= ZCL[this.castling]; hi ^= ZCH[this.castling];
      if (this.ep >= 0) { lo ^= ZEL[this.ep & 7]; hi ^= ZEH[this.ep & 7]; }
      if (this.turn === BLACK) { lo ^= ZSL; hi ^= ZSH; }
      this.hLo = lo; this.hHi = hi;
    }

    _hp(p, sq) { const i = zIndex(p, sq); this.hLo ^= ZPL[i]; this.hHi ^= ZPH[i]; }

    /** ¿Está la casilla atacada por el bando `by`? */
    isAttacked(sq, by) {
      const b = this.board, f = sq & 7;
      if (by === WHITE) {
        if (f > 0 && sq >= 9 && b[sq - 9] === PAWN) return true;
        if (f < 7 && sq >= 7 && b[sq - 7] === PAWN) return true;
      } else {
        if (f > 0 && sq + 7 < 64 && b[sq + 7] === -PAWN) return true;
        if (f < 7 && sq + 9 < 64 && b[sq + 9] === -PAWN) return true;
      }
      const kn = KNIGHT * by, kg = KING * by, rk = ROOK * by, bs = BISHOP * by, qn = QUEEN * by;
      for (const t of KNIGHT_T[sq]) if (b[t] === kn) return true;
      for (const t of KING_T[sq]) if (b[t] === kg) return true;
      const rays = RAYS[sq];
      for (let d = 0; d < 8; d++) {
        const ray = rays[d];
        for (let i = 0; i < ray.length; i++) {
          const c = b[ray[i]];
          if (c) {
            if (c === qn || (d < 4 ? c === rk : c === bs)) return true;
            break;
          }
        }
      }
      return false;
    }

    inCheck(color = this.turn) { return this.isAttacked(this.kingSq(color), -color); }

    /** Genera movimientos pseudo-legales del bando que mueve. */
    genMoves(out, capturesOnly = false) {
      const b = this.board, us = this.turn;
      for (let s = 0; s < 64; s++) {
        const p = b[s];
        if (!p || (p > 0) !== (us > 0)) continue;
        switch (p * us) {
          case PAWN: this._pawnMoves(s, p, out, capturesOnly); break;
          case KNIGHT: for (const t of KNIGHT_T[s]) this._addStep(s, t, p, out, capturesOnly); break;
          case BISHOP: this._slide(s, p, 4, 8, out, capturesOnly); break;
          case ROOK: this._slide(s, p, 0, 4, out, capturesOnly); break;
          case QUEEN: this._slide(s, p, 0, 8, out, capturesOnly); break;
          case KING:
            for (const t of KING_T[s]) this._addStep(s, t, p, out, capturesOnly);
            if (!capturesOnly) this._castleMoves(s, out);
            break;
        }
      }
      return out;
    }

    _addStep(s, t, p, out, capOnly) {
      const c = this.board[t];
      if (!c) { if (!capOnly) out.push(mv(s, t, p, 0, 0, 0)); }
      else if ((c > 0) !== (p > 0)) out.push(mv(s, t, p, c, 0, FLAG.CAPTURE));
    }

    _slide(s, p, d0, d1, out, capOnly) {
      const b = this.board, rays = RAYS[s];
      for (let d = d0; d < d1; d++) {
        const ray = rays[d];
        for (let i = 0; i < ray.length; i++) {
          const t = ray[i], c = b[t];
          if (!c) { if (!capOnly) out.push(mv(s, t, p, 0, 0, 0)); continue; }
          if ((c > 0) !== (p > 0)) out.push(mv(s, t, p, c, 0, FLAG.CAPTURE));
          break;
        }
      }
    }

    _promos(s, t, p, captured, flags, out, capOnly) {
      const us = p > 0 ? 1 : -1;
      const types = capOnly ? [QUEEN] : [QUEEN, ROOK, BISHOP, KNIGHT];
      for (const ty of types) out.push(mv(s, t, p, captured, ty * us, flags | FLAG.PROMO));
    }

    _pawnMoves(s, p, out, capOnly) {
      const b = this.board, us = p > 0 ? 1 : -1;
      const dir = us === WHITE ? 8 : -8;
      const startR = us === WHITE ? 1 : 6, promoR = us === WHITE ? 7 : 0;
      const f = s & 7, one = s + dir;
      if (!b[one]) {
        if ((one >> 3) === promoR) this._promos(s, one, p, 0, 0, out, capOnly);
        else if (!capOnly) {
          out.push(mv(s, one, p, 0, 0, 0));
          if ((s >> 3) === startR && !b[one + dir]) out.push(mv(s, one + dir, p, 0, 0, FLAG.DOUBLE));
        }
      }
      for (let df = -1; df <= 1; df += 2) {
        const nf = f + df;
        if (nf < 0 || nf > 7) continue;
        const t = one + df, c = b[t];
        if (c && (c > 0) !== (us > 0)) {
          if ((t >> 3) === promoR) this._promos(s, t, p, c, FLAG.CAPTURE, out, capOnly);
          else out.push(mv(s, t, p, c, 0, FLAG.CAPTURE));
        } else if (!c && t === this.ep) {
          out.push(mv(s, t, p, -us * PAWN, 0, FLAG.EP | FLAG.CAPTURE));
        }
      }
    }

    _castleMoves(s, out) {
      const b = this.board, us = this.turn, cr = this.castling;
      if (us === WHITE && s === 4) {
        if ((cr & 1) && !b[5] && !b[6] && b[7] === ROOK && !this.isAttacked(4, BLACK) && !this.isAttacked(5, BLACK) && !this.isAttacked(6, BLACK))
          out.push(mv(4, 6, KING, 0, 0, FLAG.KCASTLE));
        if ((cr & 2) && !b[3] && !b[2] && !b[1] && b[0] === ROOK && !this.isAttacked(4, BLACK) && !this.isAttacked(3, BLACK) && !this.isAttacked(2, BLACK))
          out.push(mv(4, 2, KING, 0, 0, FLAG.QCASTLE));
      } else if (us === BLACK && s === 60) {
        if ((cr & 4) && !b[61] && !b[62] && b[63] === -ROOK && !this.isAttacked(60, WHITE) && !this.isAttacked(61, WHITE) && !this.isAttacked(62, WHITE))
          out.push(mv(60, 62, -KING, 0, 0, FLAG.KCASTLE));
        if ((cr & 8) && !b[59] && !b[58] && !b[57] && b[56] === -ROOK && !this.isAttacked(60, WHITE) && !this.isAttacked(59, WHITE) && !this.isAttacked(58, WHITE))
          out.push(mv(60, 58, -KING, 0, 0, FLAG.QCASTLE));
      }
    }

    makeMove(m) {
      const b = this.board, us = this.turn;
      this.stack.push({ castling: this.castling, ep: this.ep, half: this.half, hLo: this.hLo, hHi: this.hHi, k0: this.kings[0], k1: this.kings[1] });
      this.hLo ^= ZCL[this.castling]; this.hHi ^= ZCH[this.castling];
      if (this.ep >= 0) { this.hLo ^= ZEL[this.ep & 7]; this.hHi ^= ZEH[this.ep & 7]; }

      const p = m.piece;
      b[m.from] = 0; this._hp(p, m.from);
      if (m.flags & FLAG.EP) {
        const cs = m.to - 8 * us;
        b[cs] = 0; this._hp(-us * PAWN, cs);
      } else if (m.captured) {
        this._hp(m.captured, m.to);
      }
      const placed = m.promo || p;
      b[m.to] = placed; this._hp(placed, m.to);

      if (m.flags & FLAG.KCASTLE) {
        const rf = m.to + 1, rt = m.to - 1;
        b[rt] = b[rf]; b[rf] = 0; this._hp(ROOK * us, rf); this._hp(ROOK * us, rt);
      } else if (m.flags & FLAG.QCASTLE) {
        const rf = m.to - 2, rt = m.to + 1;
        b[rt] = b[rf]; b[rf] = 0; this._hp(ROOK * us, rf); this._hp(ROOK * us, rt);
      }
      if (p === KING * us) this.kings[us === WHITE ? 0 : 1] = m.to;

      this.castling &= CASTLE_MASK[m.from] & CASTLE_MASK[m.to];
      this.ep = (m.flags & FLAG.DOUBLE) ? m.from + 8 * us : -1;
      this.half = (p * us === PAWN || m.captured) ? 0 : this.half + 1;
      if (us === BLACK) this.full++;
      this.turn = -us;

      this.hLo ^= ZCL[this.castling]; this.hHi ^= ZCH[this.castling];
      if (this.ep >= 0) { this.hLo ^= ZEL[this.ep & 7]; this.hHi ^= ZEH[this.ep & 7]; }
      this.hLo ^= ZSL; this.hHi ^= ZSH;
    }

    unmakeMove(m) {
      const st = this.stack.pop();
      const us = -this.turn, b = this.board;
      this.turn = us;
      b[m.from] = m.piece;
      if (m.flags & FLAG.EP) { b[m.to] = 0; b[m.to - 8 * us] = m.captured; }
      else b[m.to] = m.captured;
      if (m.flags & FLAG.KCASTLE) { const rf = m.to + 1, rt = m.to - 1; b[rf] = b[rt]; b[rt] = 0; }
      else if (m.flags & FLAG.QCASTLE) { const rf = m.to - 2, rt = m.to + 1; b[rf] = b[rt]; b[rt] = 0; }
      this.castling = st.castling; this.ep = st.ep; this.half = st.half;
      this.hLo = st.hLo; this.hHi = st.hHi;
      this.kings[0] = st.k0; this.kings[1] = st.k1;
      if (us === BLACK) this.full--;
    }

    /** Movimientos legales (opcionalmente filtrados por casilla de origen). */
    moves(square) {
      const pseudo = this.genMoves([], false), us = this.turn, legal = [];
      for (const m of pseudo) {
        if (square !== undefined && m.from !== square) continue;
        this.makeMove(m);
        if (!this.isAttacked(this.kingSq(us), -us)) legal.push(m);
        this.unmakeMove(m);
      }
      return legal;
    }

    /** Clave de repetición según FIDE: misma colocación, turno, enroques y captura al paso posible. */
    repKey() {
      let epPart = '-';
      if (this.ep >= 0) {
        const pseudo = this.genMoves([], true).filter((m) => m.flags & FLAG.EP);
        const us = this.turn;
        for (const m of pseudo) {
          this.makeMove(m);
          const ok = !this.isAttacked(this.kingSq(us), -us);
          this.unmakeMove(m);
          if (ok) { epPart = String(this.ep); break; }
        }
      }
      return Array.prototype.join.call(this.board, ',') + '|' + this.turn + '|' + this.castling + '|' + epPart;
    }

    san(m, legal) {
      let s;
      if (m.flags & FLAG.KCASTLE) s = 'O-O';
      else if (m.flags & FLAG.QCASTLE) s = 'O-O-O';
      else {
        const t = Math.abs(m.piece);
        if (t === PAWN) {
          s = (m.captured ? FILES[m.from & 7] + 'x' : '') + sqName(m.to);
          if (m.promo) s += '=' + SAN_LETTERS[Math.abs(m.promo)];
        } else {
          let d = '';
          const others = legal.filter((o) => o.piece === m.piece && o.to === m.to && o.from !== m.from);
          if (others.length) {
            const sameFile = others.some((o) => (o.from & 7) === (m.from & 7));
            const sameRank = others.some((o) => (o.from >> 3) === (m.from >> 3));
            if (!sameFile) d = FILES[m.from & 7];
            else if (!sameRank) d = String((m.from >> 3) + 1);
            else d = sqName(m.from);
          }
          s = SAN_LETTERS[t] + d + (m.captured ? 'x' : '') + sqName(m.to);
        }
      }
      this.makeMove(m);
      if (this.inCheck()) s += this.moves().length ? '+' : '#';
      this.unmakeMove(m);
      return s;
    }

    /**
     * Juega un movimiento. input: { from, to, promotion } con casillas como índice o 'e2', y
     * promoción como 'q' | 'r' | 'b' | 'n'. Devuelve el movimiento (con san y uci) o null si es ilegal.
     */
    move(input) {
      const from = typeof input.from === 'string' ? sqIndex(input.from) : input.from;
      const to = typeof input.to === 'string' ? sqIndex(input.to) : input.to;
      const promoType = input.promotion ? PIECE_CHARS.indexOf(String(input.promotion).toLowerCase()) : QUEEN;
      const legal = this.moves();
      const m = legal.find((x) => x.from === from && x.to === to && (!x.promo || Math.abs(x.promo) === promoType));
      if (!m) return null;
      const san = this.san(m, legal);
      const color = this.turn;
      this.makeMove(m);
      const rec = Object.assign({}, m, {
        san, color,
        uci: sqName(m.from) + sqName(m.to) + (m.promo ? PIECE_CHARS[Math.abs(m.promo)] : ''),
      });
      // makeMove empujó estado en la pila; el registro del historial lo reutiliza al deshacer
      this.history.push(rec);
      this.repKeys.push(this.repKey());
      return rec;
    }

    undo() {
      const h = this.history.pop();
      if (!h) return null;
      this.unmakeMove(h);
      this.repKeys.pop();
      return h;
    }

    repetitionCount() {
      const last = this.repKeys[this.repKeys.length - 1];
      let n = 0;
      for (const k of this.repKeys) if (k === last) n++;
      return n;
    }

    /** Posición muerta por material insuficiente (ningún bando puede dar mate). */
    isInsufficientMaterial() {
      const pieces = [];
      for (let s = 0; s < 64; s++) {
        const p = this.board[s];
        if (p && Math.abs(p) !== KING) pieces.push({ t: Math.abs(p), s });
      }
      if (pieces.length === 0) return true;
      if (pieces.length === 1 && (pieces[0].t === KNIGHT || pieces[0].t === BISHOP)) return true;
      if (pieces.every((x) => x.t === BISHOP)) {
        const sc = (s) => ((s & 7) + (s >> 3)) & 1;
        const c0 = sc(pieces[0].s);
        if (pieces.every((x) => sc(x.s) === c0)) return true;
      }
      return false;
    }

    /**
     * ¿Puede `color` dar mate con alguna secuencia de jugadas legales? (art. 6.9 FIDE: si a un jugador
     * se le cae la bandera y el rival no puede dar mate, la partida es tablas).
     */
    canMate(color) {
      const mine = [], theirs = [];
      for (let s = 0; s < 64; s++) {
        const p = this.board[s];
        if (!p || Math.abs(p) === KING) continue;
        ((p > 0) === (color > 0) ? mine : theirs).push({ t: Math.abs(p), s });
      }
      if (!mine.length) return false;
      if (mine.length === 1 && (mine[0].t === KNIGHT || mine[0].t === BISHOP) && !theirs.length) return false;
      const all = mine.concat(theirs);
      if (all.every((x) => x.t === BISHOP)) {
        const sc = (s) => ((s & 7) + (s >> 3)) & 1;
        if (all.every((x) => sc(x.s) === sc(all[0].s))) return false;
      }
      return true;
    }

    /** Estado de la partida tras la última jugada. */
    status() {
      const legal = this.moves();
      if (!legal.length) {
        if (this.inCheck()) return { over: true, result: this.turn === WHITE ? '0-1' : '1-0', reason: 'checkmate', winner: -this.turn };
        return { over: true, result: '1/2-1/2', reason: 'stalemate', winner: 0 };
      }
      if (this.isInsufficientMaterial()) return { over: true, result: '1/2-1/2', reason: 'insufficient', winner: 0 };
      if (this.repetitionCount() >= 3) return { over: true, result: '1/2-1/2', reason: 'threefold', winner: 0 };
      if (this.half >= 100) return { over: true, result: '1/2-1/2', reason: 'fifty', winner: 0 };
      return { over: false };
    }
  }

  global.ChessLib = { Chess, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, WHITE, BLACK, FLAG, START_FEN, sqName, sqIndex };
})(typeof self !== 'undefined' ? self : this);
