// Gestor de la inteligencia artificial: motor propio para niveles bajos y Stockfish 16 (NNUE, WASM) para los altos.

export const LEVELS = [
  {
    id: 'principiante', name: 'Principiante', elo: '~600', stars: 1,
    desc: 'Comete errores a menudo. Ideal para aprender a jugar.',
    engine: 'own', own: { depth: 1, timeMs: 400, noise: 230, randomRate: 0.2 }, minDelay: 700,
  },
  {
    id: 'aficionado', name: 'Aficionado', elo: '~1200', stars: 2,
    desc: 'Conoce la táctica básica pero todavía se equivoca.',
    engine: 'own', own: { depth: 3, timeMs: 900, noise: 40, randomRate: 0.03 }, minDelay: 650,
  },
  {
    id: 'profesional', name: 'Profesional', elo: '~1900', stars: 3,
    desc: 'Jugador de club fuerte. Castiga los errores claros.',
    engine: 'sf', sf: { elo: 1900, movetime: 700 }, own: { depth: 5, timeMs: 1500 }, minDelay: 550,
  },
  {
    id: 'mundial', name: 'Clase Mundial', elo: '~2400', stars: 4,
    desc: 'Nivel de Maestro Internacional. Muy sólido en táctica y estrategia.',
    engine: 'sf', sf: { elo: 2400, movetime: 1000 }, own: { depth: 7, timeMs: 2500 }, minDelay: 450,
  },
  {
    id: 'elite', name: 'Elite', elo: '~2850', stars: 5,
    desc: 'Gran Maestro de la élite mundial. Muy difícil de vencer.',
    engine: 'sf', sf: { elo: 2850, movetime: 1500 }, own: { depth: 9, timeMs: 4000 }, minDelay: 300,
  },
  {
    id: 'leyenda', name: 'Leyenda', elo: '3500+', stars: 6,
    desc: 'Stockfish 16 a máxima potencia. Más fuerte que Magnus Carlsen: prácticamente imbatible.',
    engine: 'sf', sf: { elo: null, movetime: 3000, clockMax: 6000 }, own: { depth: 64, timeMs: 6000 }, minDelay: 0,
  },
];

const SF_PATH = 'vendor/stockfish/stockfish-nnue-16-single.js';

export class AI {
  constructor() {
    this.own = new Worker('js/engine-worker.js');
    this.ownReq = 0;
    this.ownPending = new Map();
    this.own.onmessage = (e) => {
      const cb = this.ownPending.get(e.data.id);
      if (cb) { this.ownPending.delete(e.data.id); cb(e.data); }
    };
    this.sf = null;
    this.sfReady = false;
    this.sfListeners = [];
    this.lastScore = 0; // evaluación (centipeones) desde el punto de vista de la IA
    this.engineName = 'Motor interno';
  }

  /** Arranca Stockfish (una sola vez). Devuelve true si está disponible. */
  init() {
    if (!this.readyPromise) this.readyPromise = this._init();
    return this.readyPromise;
  }

  async _init() {
    if (typeof WebAssembly !== 'object') return false;
    try {
      this.sf = new Worker(SF_PATH);
      this.sf.onmessage = (e) => {
        const line = typeof e.data === 'string' ? e.data : String(e.data);
        for (const l of this.sfListeners.slice()) l(line);
      };
      this.sf.onerror = () => { this.sfReady = false; };
      await this._sfWait('uci', (l) => l === 'uciok', 20000);
      this._sfSend('setoption name Hash value 64');
      this._sfSend('setoption name UCI_ShowWDL value false');
      await this._sfWait('isready', (l) => l === 'readyok', 20000);
      this.sfReady = true;
      this.engineName = 'Stockfish 16 NNUE';
      return true;
    } catch (err) {
      console.warn('Stockfish no disponible, se usará el motor interno.', err);
      if (this.sf) this.sf.terminate();
      this.sf = null;
      this.sfReady = false;
      return false;
    }
  }

  _sfSend(cmd) { this.sf.postMessage(cmd); }

  _sfWait(cmd, test, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { off(); reject(new Error('timeout: ' + cmd)); }, timeout);
      const fn = (line) => { if (test(line)) { off(); resolve(line); } };
      const off = () => { clearTimeout(timer); this.sfListeners = this.sfListeners.filter((x) => x !== fn); };
      this.sfListeners.push(fn);
      if (cmd) this._sfSend(cmd);
    });
  }

  newGame() {
    this.stop();
    this.lastScore = 0;
    if (this.sfReady) {
      this._sfSend('ucinewgame');
      this._sfSend('isready');
    }
  }

  /** Detiene cualquier búsqueda en curso (el resultado se ignora mediante el token de partida). */
  stop() {
    if (this.sfReady && this._sfCurrent) this._sfSend('stop');
    // El motor propio no se puede interrumpir: reiniciamos el worker si está ocupado
    if (this.ownPending.size) {
      this.own.terminate();
      for (const cb of this.ownPending.values()) cb({ move: null, score: 0 });
      this.ownPending.clear();
      this.own = new Worker('js/engine-worker.js');
      this.own.onmessage = (e) => {
        const cb = this.ownPending.get(e.data.id);
        if (cb) { this.ownPending.delete(e.data.id); cb(e.data); }
      };
    }
  }

  _ownMove(startFen, moves, params) {
    return new Promise((resolve) => {
      const id = ++this.ownReq;
      this.ownPending.set(id, resolve);
      this.own.postMessage({ id, fen: startFen, moves, ...params });
    });
  }

  async _sfMove(startFen, moves, level, clock, aiColor) {
    // Si una búsqueda anterior se detuvo, esperamos su "bestmove" para no confundirlo con el nuevo
    while (this._sfCurrent) await this._sfCurrent.catch(() => {});
    const cfg = level.sf;
    if (cfg.elo) {
      this._sfSend('setoption name UCI_LimitStrength value true');
      this._sfSend(`setoption name UCI_Elo value ${cfg.elo}`);
    } else {
      this._sfSend('setoption name UCI_LimitStrength value false');
      this._sfSend('setoption name Skill Level value 20');
    }
    this._sfSend(`position fen ${startFen}${moves.length ? ' moves ' + moves.join(' ') : ''}`);
    // Tiempo por jugada calculado aquí (la versión WASM no respeta bien wtime/btime)
    let mt = cfg.movetime;
    if (clock) {
      const mine = aiColor === 1 ? clock.wtime : clock.btime;
      const inc = aiColor === 1 ? clock.winc : clock.binc;
      mt = Math.min(cfg.clockMax || mt, Math.max(60, mine / 30 + inc * 0.8));
      if (mine < 2000) mt = Math.min(mt, 60);
    }
    mt = Math.round(mt);
    const go = `go movetime ${mt}`;
    // Seguridad: si el motor se pasa de tiempo, lo detenemos
    const guard = setTimeout(() => { if (this._sfCurrent) this._sfSend('stop'); }, mt + 1500);
    let score = this.lastScore;
    const onInfo = (line) => {
      const m = line.match(/score (cp|mate) (-?\d+)/);
      if (m && line.startsWith('info')) score = m[1] === 'cp' ? +m[2] : (+m[2] > 0 ? 100000 : -100000);
    };
    this.sfListeners.push(onInfo);
    const pending = this._sfWait(go, (l) => l.startsWith('bestmove'), 600000);
    this._sfCurrent = pending;
    try {
      const line = await pending;
      const u = line.split(/\s+/)[1];
      if (!u || u === '(none)') return null;
      this.lastScore = score;
      return { from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] };
    } finally {
      clearTimeout(guard);
      if (this._sfCurrent === pending) this._sfCurrent = null;
      this.sfListeners = this.sfListeners.filter((x) => x !== onInfo);
    }
  }

  /**
   * Calcula la jugada de la IA.
   * startFen + moves (UCI) permiten a los motores detectar repeticiones.
   * clock: { wtime, btime, winc, binc } en ms, o null si no hay reloj.
   */
  async getMove({ startFen, moves, level, clock, aiColor }) {
    if (level.engine === 'sf') await this.init();
    if (level.engine === 'sf' && this.sfReady) {
      try {
        return await this._sfMove(startFen, moves, level, clock, aiColor);
      } catch (err) {
        console.warn('Fallo de Stockfish, se usa el motor interno', err);
      }
    }
    const params = { ...level.own };
    if (clock) {
      const mine = aiColor === 1 ? clock.wtime : clock.btime;
      params.timeMs = Math.min(params.timeMs, Math.max(150, mine / 35));
    }
    const res = await this._ownMove(startFen, moves, params);
    if (res.move) this.lastScore = res.score;
    return res.move;
  }
}
