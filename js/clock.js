// Reloj de ajedrez con incremento Fischer (el incremento se suma al completar la jugada).
export class ChessClock {
  constructor({ onTick, onFlag }) {
    this.onTick = onTick;
    this.onFlag = onFlag;
    this.enabled = false;
    this.time = { 1: 0, '-1': 0 };
    this.inc = 0;
    this.active = 0;
    this.running = false;
    this.paused = false;
    this.timer = setInterval(() => this._tick(), 100);
  }

  setup(baseMs, incMs) {
    this.enabled = baseMs > 0;
    this.time = { 1: baseMs, '-1': baseMs };
    this.inc = incMs;
    this.active = 0;
    this.running = false;
    this.paused = false;
    this.onTick();
  }

  start(color) {
    if (!this.enabled) return;
    this.active = color;
    this.last = performance.now();
    this.running = true;
    this.paused = false;
  }

  /** Llamar justo después de que `color` complete su jugada. */
  moveMade(color) {
    if (!this.enabled) return;
    this._sync();
    this.time[color] += this.inc;
    this.active = -color;
    this.last = performance.now();
    this.onTick();
  }

  /** Pausa breve durante animaciones para no restar tiempo al jugador. */
  pause() { this._sync(); this.paused = true; }
  resume() { if (this.paused) { this.paused = false; this.last = performance.now(); } }

  stop() { this._sync(); this.running = false; this.onTick(); }

  setTimes(w, b) { this.time[1] = w; this.time[-1] = b; this.onTick(); }

  _sync() {
    if (!this.running || this.paused || !this.active) return;
    const now = performance.now();
    this.time[this.active] -= now - this.last;
    this.last = now;
    if (this.time[this.active] <= 0) {
      this.time[this.active] = 0;
      this.running = false;
      const loser = this.active;
      this.onTick();
      this.onFlag(loser);
    }
  }

  _tick() {
    if (!this.enabled || !this.running) return;
    this._sync();
    this.onTick();
  }

  static format(ms) {
    if (ms <= 0) return '0:00.0';
    const total = ms / 1000;
    if (total < 10) return `0:0${total.toFixed(1)}`;
    const s = Math.ceil(total - 1e-9);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
  }
}
