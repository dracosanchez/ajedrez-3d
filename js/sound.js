// Sonidos sintetizados con Web Audio (golpe de madera, jaque, fin de partida). Sin archivos externos.
export class Sound {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.noise = null;
  }

  _ctx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      const len = Math.floor(this.ctx.sampleRate * 0.2);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  _knock(t, vol = 1, pitch = 1) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1500 * pitch;
    bp.Q.value = 1.4;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.55 * vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(bp).connect(g).connect(c.destination);
    src.start(t);
    src.stop(t + 0.12);
    // Cuerpo grave del golpe
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(230 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(90 * pitch, t + 0.08);
    const og = c.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.5 * vol, t + 0.005);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(og).connect(c.destination);
    o.start(t);
    o.stop(t + 0.14);
  }

  _tone(t, freq, dur, vol = 0.18, type = 'sine') {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  play(kind) {
    if (!this.enabled) return;
    const c = this._ctx();
    if (!c) return;
    const t = c.currentTime + 0.01;
    switch (kind) {
      case 'move': this._knock(t, 0.9, 1); break;
      case 'capture': this._knock(t, 1.1, 0.8); this._knock(t + 0.07, 0.7, 1.25); break;
      case 'castle': this._knock(t, 0.9, 1); this._knock(t + 0.16, 0.8, 0.9); break;
      case 'check': this._knock(t, 1, 1); this._tone(t + 0.03, 988, 0.25, 0.12, 'triangle'); break;
      case 'select': this._knock(t, 0.25, 1.6); break;
      case 'start': this._tone(t, 523, 0.18, 0.1); this._tone(t + 0.12, 784, 0.3, 0.1); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => this._tone(t + i * 0.12, f, 0.5, 0.12, 'triangle')); break;
      case 'lose': [440, 392, 330, 262].forEach((f, i) => this._tone(t + i * 0.16, f, 0.55, 0.12, 'triangle')); break;
      case 'draw': [523, 523, 659].forEach((f, i) => this._tone(t + i * 0.14, f, 0.4, 0.1, 'triangle')); break;
      case 'lowtime': this._tone(t, 1400, 0.08, 0.08, 'square'); break;
      default: break;
    }
  }
}
