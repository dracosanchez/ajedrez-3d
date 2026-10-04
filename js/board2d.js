// Tablero 2D clásico (HTML/CSS). Misma interfaz pública que Board3D para poder alternar entre vistas.

const GLYPH = { 1: '♟', 2: '♞', 3: '♝', 4: '♜', 5: '♛', 6: '♚' };
const TEXT = '︎'; // fuerza presentación de texto (evita emojis en móviles)
const MOVE_MS = 230;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export class Board2D {
  constructor(container, opts) {
    this.container = container;
    this.opts = opts;
    this.theme = 'marble';
    this.orientation = 1;
    this.pieces = new Array(64).fill(null);
    this.selected = -1;
    this.targets = [];
    this.down = null;

    const root = (this.root = document.createElement('div'));
    root.className = 'b2d';
    root.innerHTML = '<div class="b2-frame"><div class="b2-board"><div class="b2-squares"></div><div class="b2-hl"></div><div class="b2-pieces"></div></div></div>';
    container.appendChild(root);
    this.boardEl = root.querySelector('.b2-board');
    this.squaresEl = root.querySelector('.b2-squares');
    this.hlEl = root.querySelector('.b2-hl');
    this.piecesEl = root.querySelector('.b2-pieces');

    this.squareEls = [];
    for (let i = 0; i < 64; i++) {
      const d = document.createElement('div');
      this.squaresEl.appendChild(d);
      this.squareEls.push(d);
    }
    this.lastEls = [this._hl('b2-last'), this._hl('b2-last')];
    this.selEl = this._hl('b2-sel');
    this.checkEl = this._hl('b2-check');
    this.hoverEl = this._hl('b2-hover');
    this.markers = [];

    this.boardEl.addEventListener('pointerdown', (e) => this._onDown(e));
    this.boardEl.addEventListener('pointermove', (e) => this._onMove(e));
    this.boardEl.addEventListener('pointerup', (e) => this._onUp(e));
    this.boardEl.addEventListener('pointercancel', () => this._cancelDrag());
    this.boardEl.addEventListener('contextmenu', (e) => e.preventDefault());

    new ResizeObserver(() => this._resize()).observe(container);
    this._resize();
    this.setTheme(this.theme);
    this._layoutSquares();
  }

  setActive() {}

  // ---------- Geometría ----------
  _cell(sq) {
    const f = sq & 7, r = sq >> 3;
    return this.orientation === 1 ? { col: f, row: 7 - r } : { col: 7 - f, row: r };
  }

  _sqAt(clientX, clientY) {
    const rect = this.boardEl.getBoundingClientRect();
    const col = Math.floor(((clientX - rect.left) / rect.width) * 8);
    const row = Math.floor(((clientY - rect.top) / rect.height) * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return -1;
    return this.orientation === 1 ? (7 - row) * 8 + col : row * 8 + (7 - col);
  }

  _pos(el, sq) {
    const { col, row } = this._cell(sq);
    el.style.transform = `translate(${col * 100}%, ${row * 100}%)`;
  }

  _resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    // El marco añade un 2,2 % de relleno por lado
    const size = Math.max(160, Math.floor((Math.min(w, h) - (w < 600 ? 8 : 40)) / 1.044));
    this.root.style.setProperty('--size', size + 'px');
  }

  _layoutSquares() {
    for (let sq = 0; sq < 64; sq++) {
      const el = this.squareEls[sq];
      const f = sq & 7, r = sq >> 3;
      const { col, row } = this._cell(sq);
      el.className = 'b2-sq ' + ((f + r) % 2 ? 'light' : 'dark');
      el.style.gridColumn = col + 1;
      el.style.gridRow = row + 1;
      let labels = '';
      if (col === 0) labels += `<span class="b2-rank">${r + 1}</span>`;
      if (row === 7) labels += `<span class="b2-file">${'abcdefgh'[f]}</span>`;
      el.innerHTML = labels;
    }
    this.pieces.forEach((el, sq) => { if (el) this._pos(el, sq); });
    for (const el of [...this.lastEls, this.selEl, this.checkEl, this.hoverEl]) {
      if (el.dataset.sq) this._pos(el, +el.dataset.sq);
    }
    for (const m of this.markers) this._pos(m, +m.dataset.sq);
  }

  _hl(cls) {
    const d = document.createElement('div');
    d.className = 'b2-cell ' + cls;
    d.hidden = true;
    this.hlEl.appendChild(d);
    return d;
  }

  _showHl(el, sq) {
    if (sq < 0) { el.hidden = true; delete el.dataset.sq; return; }
    el.dataset.sq = sq;
    this._pos(el, sq);
    el.hidden = false;
  }

  // ---------- Piezas ----------
  _makePiece(p) {
    const el = document.createElement('div');
    el.className = 'b2-piece ' + (p > 0 ? 'w' : 'b');
    el.innerHTML = `<span>${GLYPH[Math.abs(p)]}${TEXT}</span>`;
    el.dataset.p = p;
    this.piecesEl.appendChild(el);
    return el;
  }

  setTheme(name) {
    this.theme = name;
    this.root.dataset.theme = name;
  }

  setPosition(board) {
    this.piecesEl.innerHTML = '';
    this.pieces = new Array(64).fill(null);
    for (let sq = 0; sq < 64; sq++) {
      if (!board[sq]) continue;
      const el = this._makePiece(board[sq]);
      el.classList.add('instant');
      this._pos(el, sq);
      this.pieces[sq] = el;
    }
    void this.piecesEl.offsetWidth;
    this.pieces.forEach((el) => el && el.classList.remove('instant'));
    this.clearSelection();
  }

  async animateMove(m, FLAG) {
    const el = this.pieces[m.from];
    if (!el) return;
    this.pieces[m.from] = null;
    let capSq = m.to;
    if (m.flags & FLAG.EP) capSq = m.to + (m.piece > 0 ? -8 : 8);
    const captured = m.captured ? this.pieces[capSq] : null;
    if (captured) this.pieces[capSq] = null;

    el.classList.remove('dragging', 'lifted');
    el.style.zIndex = 5;
    this._pos(el, m.to);
    this.pieces[m.to] = el;

    if (m.flags & (FLAG.KCASTLE | FLAG.QCASTLE)) {
      const rf = m.flags & FLAG.KCASTLE ? m.to + 1 : m.to - 2;
      const rt = m.flags & FLAG.KCASTLE ? m.to - 1 : m.to + 1;
      const rook = this.pieces[rf];
      this.pieces[rf] = null;
      if (rook) { this.pieces[rt] = rook; setTimeout(() => this._pos(rook, rt), 90); }
    }
    if (captured) setTimeout(() => captured.classList.add('gone'), MOVE_MS * 0.6);
    await wait(MOVE_MS + 110);
    el.style.zIndex = '';
    if (captured) captured.remove();
    if (m.promo) {
      el.dataset.p = m.promo;
      el.querySelector('span').textContent = GLYPH[Math.abs(m.promo)] + TEXT;
      el.classList.add('promoted');
      await wait(320);
      el.classList.remove('promoted');
    }
  }

  returnPiece(sq) {
    const el = this.pieces[sq];
    this.clearSelection();
    if (el) { el.classList.remove('dragging', 'lifted'); this._pos(el, sq); }
    return wait(MOVE_MS);
  }

  toppleKing(sq) {
    const el = this.pieces[sq];
    if (el) el.classList.add('toppled');
    return wait(600);
  }

  async setOrientation(color, animate = true) {
    if (color === this.orientation) return;
    if (animate) {
      this.root.classList.add('spinning');
      await wait(720);
    }
    this.root.classList.add('no-anim');
    this.root.classList.remove('spinning');
    this.orientation = color;
    this._layoutSquares();
    void this.root.offsetWidth;
    this.root.classList.remove('no-anim');
  }

  // ---------- Resaltados ----------
  setLastMove(from, to) {
    this._showHl(this.lastEls[0], from);
    this._showHl(this.lastEls[1], from < 0 ? -1 : to);
  }

  setCheck(sq) { this._showHl(this.checkEl, sq); }

  select(sq) {
    this.clearSelection();
    this.selected = sq;
    this.targets = this.opts.getTargets(sq);
    this._showHl(this.selEl, sq);
    for (const t of this.targets) {
      const m = document.createElement('div');
      m.className = 'b2-cell ' + (t.capture ? 'b2-ring' : 'b2-dot');
      m.dataset.sq = t.to;
      this._pos(m, t.to);
      this.hlEl.appendChild(m);
      this.markers.push(m);
    }
    if (this.pieces[sq]) this.pieces[sq].classList.add('lifted');
  }

  clearSelection() {
    if (this.selected >= 0 && this.pieces[this.selected]) this.pieces[this.selected].classList.remove('lifted');
    this.selected = -1;
    this.targets = [];
    this._showHl(this.selEl, -1);
    this._showHl(this.hoverEl, -1);
    for (const m of this.markers) m.remove();
    this.markers = [];
  }

  _isTarget(sq) { return this.targets.some((t) => t.to === sq); }

  // ---------- Entrada ----------
  _onDown(e) {
    if (e.button !== 0) return;
    const sq = this._sqAt(e.clientX, e.clientY);
    this.down = { x: e.clientX, y: e.clientY, sq, dragging: false, canDrag: false, wasSelected: this.selected === sq };
    if (sq < 0) return;
    if (this.selected >= 0 && this._isTarget(sq)) return;
    if (this.pieces[sq] && this.opts.canSelect(sq)) {
      if (this.selected !== sq) this.select(sq);
      this.down.canDrag = true;
      this.boardEl.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  }

  _onMove(e) {
    const d = this.down;
    if (!d) {
      const sq = this._sqAt(e.clientX, e.clientY);
      const hot = sq >= 0 && ((this.selected >= 0 && this._isTarget(sq)) || (this.pieces[sq] && this.opts.canSelect(sq)));
      this.boardEl.style.cursor = hot ? 'pointer' : 'default';
      return;
    }
    if (!d.canDrag) return;
    if (!d.dragging && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) d.dragging = true;
    if (!d.dragging) return;
    const el = this.pieces[d.sq];
    if (!el) return;
    const rect = this.boardEl.getBoundingClientRect();
    const s = rect.width / 8;
    el.classList.add('dragging');
    el.style.transform = `translate(${e.clientX - rect.left - s / 2}px, ${e.clientY - rect.top - s / 2}px)`;
    const over = this._sqAt(e.clientX, e.clientY);
    this._showHl(this.hoverEl, over >= 0 && this._isTarget(over) ? over : -1);
  }

  _cancelDrag() {
    const d = this.down;
    this.down = null;
    if (d && d.dragging) this.returnPiece(d.sq);
  }

  _onUp(e) {
    const d = this.down;
    this.down = null;
    if (!d) return;
    const sq = this._sqAt(e.clientX, e.clientY);
    if (d.dragging) {
      const from = this.selected;
      this._showHl(this.hoverEl, -1);
      if (sq >= 0 && this._isTarget(sq)) { this._resetSelectionKeepPiece(); this.opts.onMove(from, sq); }
      else this.returnPiece(d.sq);
      return;
    }
    if (sq !== d.sq) return;
    if (this.selected >= 0 && this._isTarget(sq)) {
      const from = this.selected;
      this._resetSelectionKeepPiece();
      this.opts.onMove(from, sq);
    } else if (sq >= 0 && this.pieces[sq] && this.opts.canSelect(sq)) {
      if (d.wasSelected) this.clearSelection();
    } else {
      this.clearSelection();
    }
  }

  _resetSelectionKeepPiece() {
    this.selected = -1;
    this.targets = [];
    this._showHl(this.selEl, -1);
    for (const m of this.markers) m.remove();
    this.markers = [];
  }
}
