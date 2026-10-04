// Controlador de la aplicación: partida, turnos, IA, reloj e interfaz.
import { Board2D } from './board2d.js';
import { AI, LEVELS } from './ai.js';
import { ChessClock } from './clock.js';
import { Sound } from './sound.js';

const { Chess, FLAG, WHITE, START_FEN } = window.ChessLib;
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CLOCKS = [
  { id: 'none', label: 'Sin reloj', base: 0, inc: 0 },
  { id: '1+0', label: '1+0', sub: 'Bala', base: 1, inc: 0 },
  { id: '3+0', label: '3+0', sub: 'Blitz', base: 3, inc: 0 },
  { id: '3+2', label: '3+2', sub: 'Blitz', base: 3, inc: 2 },
  { id: '5+0', label: '5+0', sub: 'Blitz', base: 5, inc: 0 },
  { id: '5+3', label: '5+3', sub: 'Blitz', base: 5, inc: 3 },
  { id: '10+0', label: '10+0', sub: 'Rápida', base: 10, inc: 0 },
  { id: '15+10', label: '15+10', sub: 'Rápida', base: 15, inc: 10 },
  { id: '30+0', label: '30+0', sub: 'Clásica', base: 30, inc: 0 },
  { id: '90+30', label: '90+30', sub: 'FIDE', base: 90, inc: 30 },
  { id: 'custom', label: 'Personalizado' },
];
const FIGURINE = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘' };
const SOLID = { 1: '♟', 2: '♞', 3: '♝', 4: '♜', 5: '♛', 6: '♚' };
const VALUE = { 1: 1, 2: 3, 3: 3, 4: 5, 5: 9, 6: 0 };
const REASONS = {
  checkmate: 'Jaque mate',
  stalemate: 'Rey ahogado',
  insufficient: 'Material insuficiente para dar mate',
  threefold: 'Triple repetición de la posición',
  fifty: 'Regla de los 50 movimientos',
  timeout: 'Tiempo agotado',
  'timeout-draw': 'Tiempo agotado, pero el rival no tiene material para dar mate',
  resign: 'Abandono',
  agreement: 'Tablas de mutuo acuerdo',
};

const DEFAULTS = { mode: 'ai', level: 2, color: 'w', clock: '10+0', customMin: 10, customInc: 5, rotate: true, theme: 'marble', view: '3d' };
const PUBLIC_URL = 'https://dracosanchez.github.io/ajedrez-3d/';

function loadSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('ajedrez3d.settings') || '{}') }; }
  catch { return { ...DEFAULTS }; }
}
function saveSettings(s) {
  try { localStorage.setItem('ajedrez3d.settings', JSON.stringify(s)); } catch { /* sin almacenamiento */ }
}

const state = {
  game: new Chess(),
  cfg: { ...loadSettings() },     // configuración de la partida en curso
  draft: null,                    // configuración que se edita en el diálogo
  humanColor: WHITE,
  orientation: WHITE,
  over: false,
  result: null,
  busy: false,
  aiThinking: false,
  token: 0,
  started: false,
  lowWarned: { 1: false, '-1': false },
};

const sound = new Sound();
const ai = new AI();
const clock = new ChessClock({ onTick: renderClocks, onFlag });
let board;
const boards = {};
const boardOpts = () => ({ canSelect, getTargets, onMove: onHumanMove });

/** Crea (la primera vez) y activa la vista 2D o 3D, sincronizando la posición actual. */
async function setView(view) {
  if (view !== '2d' && view !== '3d') view = '3d';
  if (!boards[view]) {
    if (view === '3d') {
      $('#loading').classList.remove('hide');
      await sleep(50); // deja pintar la pantalla de carga antes de generar texturas
      try {
        const { Board3D } = await import('./board3d.js');
        boards['3d'] = new Board3D($('#scene'), boardOpts());
      } catch (err) {
        console.error(err);
        $('#loading').classList.add('hide');
        toast('Tu dispositivo no admite la vista 3D. Se usa la vista 2D.');
        return setView('2d');
      }
      $('#loading').classList.add('hide');
    } else {
      boards['2d'] = new Board2D($('#scene2d'), boardOpts());
    }
  }
  if (board && board !== boards[view]) board.clearSelection();
  for (const [k, b] of Object.entries(boards)) b.setActive(k === view);
  $('#scene').hidden = view !== '3d';
  $('#scene2d').hidden = view !== '2d';
  board = boards[view];
  state.view = view;
  $('#btn-view').textContent = view === '3d' ? '2D' : '3D';
  $('#btn-view').title = view === '3d' ? 'Cambiar a vista 2D (V)' : 'Cambiar a vista 3D (V)';
  window.ajedrez = { board, state, ai };
  if (board.theme !== state.cfg.theme) board.setTheme(state.cfg.theme);
  syncBoard();
  await board.setOrientation(state.orientation, false);
}

async function toggleView() {
  if (state.busy) return;
  const v = state.view === '3d' ? '2d' : '3d';
  state.cfg.view = v;
  saveSettings(state.cfg);
  await setView(v);
}

// ---------------------------------------------------------------- utilidades
const level = () => LEVELS[state.cfg.level] || LEVELS[0];
const colorName = (c) => (c === WHITE ? 'blancas' : 'negras');
const isHumanTurn = () => state.cfg.mode === 'pvp' || state.game.turn === state.humanColor;
const figurine = (san) => san.replace(/[KQRBN]/g, (ch) => FIGURINE[ch]);

function clockSpec(cfg) {
  if (cfg.clock === 'custom') return { base: Math.max(0.5, +cfg.customMin || 10) * 60000, inc: Math.max(0, +cfg.customInc || 0) * 1000 };
  const c = CLOCKS.find((x) => x.id === cfg.clock) || CLOCKS[0];
  return { base: c.base * 60000, inc: c.inc * 1000 };
}

function playerName(color) {
  if (state.cfg.mode === 'pvp') return color === WHITE ? 'Blancas' : 'Negras';
  return color === state.humanColor ? 'Tú' : `IA · ${level().name}`;
}

function capturedLists() {
  const out = { 1: [], '-1': [] };
  for (const h of state.game.history) if (h.captured) out[h.captured > 0 ? 1 : -1].push(h.captured);
  return out;
}

let toastTimer;
function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

function confirmDialog(title, text, yes = 'Sí', no = 'No') {
  return new Promise((resolve) => {
    $('#confirm-title').textContent = title;
    $('#confirm-text').textContent = text;
    $('#confirm-yes').textContent = yes;
    $('#confirm-no').textContent = no;
    const m = $('#modal-confirm');
    m.hidden = false;
    const done = (v) => { m.hidden = true; $('#confirm-yes').onclick = $('#confirm-no').onclick = null; resolve(v); };
    $('#confirm-yes').onclick = () => done(true);
    $('#confirm-no').onclick = () => done(false);
  });
}

// ---------------------------------------------------------------- render
function renderAll() {
  renderCards();
  renderClocks();
  renderMoves();
  renderStatus();
  renderButtons();
  const l = level();
  $('#subtitle').textContent = state.cfg.mode === 'pvp'
    ? 'Modo 2 jugadores'
    : `Contra la IA · ${l.name} (${l.elo})`;
}

function renderCards() {
  const caps = capturedLists();
  const material = (list) => list.reduce((s, p) => s + VALUE[Math.abs(p)], 0);
  for (const [id, color] of [['#player-bottom', state.orientation], ['#player-top', -state.orientation]]) {
    const el = $(id);
    el.dataset.color = color;
    el.querySelector('.dot').className = 'dot ' + (color === WHITE ? 'w' : 'b');
    el.querySelector('.name').textContent = playerName(color);
    // Piezas que ha capturado este jugador (las del rival)
    const taken = caps[-color].slice().sort((a, b) => VALUE[Math.abs(b)] - VALUE[Math.abs(a)]);
    const adv = material(caps[-color]) - material(caps[color]);
    const cls = color === WHITE ? 'cap-b' : 'cap-w';
    el.querySelector('.captured').innerHTML =
      taken.map((p) => `<span class="${cls}">${SOLID[Math.abs(p)]}</span>`).join('') +
      (adv > 0 ? `<span class="adv">+${adv}</span>` : '');
    el.classList.toggle('active', !state.over && state.started && state.game.turn === color);
  }
}

function renderClocks() {
  for (const id of ['#player-bottom', '#player-top']) {
    const el = $(id);
    const color = +el.dataset.color || WHITE;
    const c = el.querySelector('.clock');
    if (!clock.enabled) { c.classList.add('off'); continue; }
    c.classList.remove('off');
    const t = clock.time[color];
    c.textContent = ChessClock.format(t);
    c.classList.toggle('low', t < 20000);
    // Aviso sonoro de poco tiempo para el jugador humano
    if (t < 10000 && t > 0 && !state.lowWarned[color] && clock.running && clock.active === color) {
      state.lowWarned[color] = true;
      if (state.cfg.mode === 'pvp' || color === state.humanColor) sound.play('lowtime');
    }
  }
}

function renderMoves() {
  const h = state.game.history;
  const ol = $('#moves');
  let html = '';
  for (let i = 0; i < h.length; i += 2) {
    const last = h.length - 1;
    html += `<li><span class="num">${i / 2 + 1}.</span>` +
      `<span class="mv${i === last ? ' last' : ''}">${figurine(h[i].san)}</span>` +
      `<span class="mv${i + 1 === last ? ' last' : ''}">${h[i + 1] ? figurine(h[i + 1].san) : ''}</span></li>`;
  }
  ol.innerHTML = html;
  $('#moves-empty').hidden = h.length > 0;
  const wrap = ol.parentElement;
  wrap.scrollTop = wrap.scrollHeight;
}

function renderStatus() {
  const el = $('#status');
  const g = state.game;
  el.className = 'status';
  if (state.over) {
    el.classList.add('over');
    const r = state.result;
    const who = r.winner === 0 ? 'Tablas' : r.winner === WHITE ? 'Ganan las blancas' : 'Ganan las negras';
    el.textContent = `${who} · ${REASONS[r.reason] || ''}`;
    return;
  }
  if (!state.started) { el.textContent = 'Configura una nueva partida'; return; }
  const check = g.inCheck();
  if (check) el.classList.add('check');
  if (state.aiThinking) {
    el.innerHTML = `${check ? '¡Jaque! · ' : ''}<span class="thinking">La IA está pensando</span>`;
    return;
  }
  let txt;
  if (state.cfg.mode === 'pvp') txt = `Turno de las ${colorName(g.turn)}`;
  else txt = g.turn === state.humanColor ? 'Tu turno' : 'Turno de la IA';
  el.textContent = check ? `¡Jaque! · ${txt}` : txt;
}

function renderButtons() {
  const h = state.game.history;
  const hardEnd = state.over && ['timeout', 'timeout-draw', 'resign', 'agreement'].includes(state.result.reason);
  $('#btn-undo').disabled = state.busy || !h.length || hardEnd || (state.cfg.mode === 'ai' && !h.some((m) => m.color === state.humanColor));
  $('#btn-draw').disabled = state.over || !state.started || !h.length;
  $('#btn-resign').disabled = state.over || !state.started;
  $('#btn-pgn').disabled = !h.length;
}

function renderEngineInfo() {
  const el = $('#engine-info');
  if (ai.sfReady) el.innerHTML = 'Motor: <b>Stockfish 16 NNUE</b> + motor propio · Reglas FIDE';
  else if (ai.readyPromise) el.innerHTML = 'Motor: <b>motor propio</b> (Stockfish no disponible: los niveles altos serán más débiles)';
  else el.textContent = 'Cargando motor…';
}

// ---------------------------------------------------------------- tablero
function canSelect(sq) {
  if (!state.started || state.over || state.busy || state.aiThinking) return false;
  const p = state.game.board[sq];
  if (!p) return false;
  const c = p > 0 ? 1 : -1;
  if (c !== state.game.turn) return false;
  return state.cfg.mode === 'pvp' || c === state.humanColor;
}

function getTargets(sq) {
  const seen = new Map();
  for (const m of state.game.moves(sq)) seen.set(m.to, { to: m.to, capture: !!m.captured });
  return [...seen.values()];
}

function askPromotion(color) {
  return new Promise((resolve) => {
    const m = $('#modal-promo');
    const box = $('#promo-choices');
    box.className = 'promo-choices ' + (color === WHITE ? 'w' : 'b');
    m.hidden = false;
    const done = (v) => {
      m.hidden = true;
      box.onclick = null;
      $('#promo-cancel').onclick = null;
      resolve(v);
    };
    box.onclick = (e) => { const b = e.target.closest('button'); if (b) done(b.dataset.p); };
    $('#promo-cancel').onclick = () => done(null);
  });
}

async function onHumanMove(from, to) {
  if (!isHumanTurn() || state.busy || state.over) { board.returnPiece(from); return; }
  const cands = state.game.moves(from).filter((m) => m.to === to);
  if (!cands.length) { board.returnPiece(from); return; }
  let promotion;
  if (cands[0].promo) {
    promotion = await askPromotion(state.game.turn);
    if (!promotion) { board.returnPiece(from); return; }
  }
  $('#hint').classList.add('hide');
  await applyMove({ from, to, promotion });
}

async function applyMove(input) {
  const g = state.game;
  const token = state.token;
  const mover = g.turn;
  const m = g.move(input);
  if (!m) return false;
  state.busy = true;
  board.clearSelection(true);
  board.setCheck(-1);
  clock.moveMade(mover);
  clock.pause();
  renderAll();

  await board.animateMove(m, FLAG);
  if (token !== state.token) return true;

  const check = g.inCheck();
  sound.play(check ? 'check' : m.captured ? 'capture' : (m.flags & (FLAG.KCASTLE | FLAG.QCASTLE)) ? 'castle' : 'move');
  board.setLastMove(m.from, m.to);
  board.setCheck(check ? g.kingSq(g.turn) : -1);

  const st = g.status();
  if (st.over) {
    state.busy = false;
    endGame(st);
    return true;
  }

  if (state.cfg.mode === 'pvp' && state.cfg.rotate) {
    state.orientation = g.turn;
    renderCards();
    renderClocks();
    await board.setOrientation(g.turn, true);
    if (token !== state.token) return true;
  }
  clock.resume();
  state.busy = false;
  renderAll();
  if (state.cfg.mode === 'ai' && g.turn !== state.humanColor) aiMove();
  return true;
}

async function aiMove() {
  const g = state.game;
  const token = state.token;
  state.aiThinking = true;
  renderStatus();
  renderButtons();
  const t0 = performance.now();
  const l = level();
  const clk = clock.enabled
    ? { wtime: clock.time[1], btime: clock.time[-1], winc: clock.inc, binc: clock.inc }
    : null;
  let mv = null;
  try {
    mv = await ai.getMove({
      startFen: START_FEN,
      moves: g.history.map((h) => h.uci),
      level: l,
      clock: clk,
      aiColor: g.turn,
    });
  } catch (err) {
    console.error(err);
  }
  const elapsed = performance.now() - t0;
  if (elapsed < l.minDelay) await sleep(l.minDelay - elapsed);
  if (token !== state.token || state.over) return;
  state.aiThinking = false;
  renderEngineInfo();
  // Respaldo: si el motor no devolvió nada válido, juega una jugada legal
  if (!mv || !g.moves().some((m) => window.ChessLib.sqName(m.from) === mv.from && window.ChessLib.sqName(m.to) === mv.to)) {
    const legal = g.moves();
    const r = legal[(Math.random() * legal.length) | 0];
    mv = { from: r.from, to: r.to, promotion: 'q' };
  }
  await applyMove(mv);
}

// ---------------------------------------------------------------- partida
async function startGame(cfg) {
  state.token++;
  ai.newGame();
  state.cfg = { ...cfg };
  saveSettings(state.cfg);
  state.game = new Chess();
  state.over = false;
  state.result = null;
  state.busy = true;
  state.aiThinking = false;
  state.started = true;
  state.lowWarned = { 1: false, '-1': false };
  state.humanColor = cfg.color === 'b' ? -1 : cfg.color === 'r' ? (Math.random() < 0.5 ? 1 : -1) : 1;
  state.orientation = cfg.mode === 'ai' ? state.humanColor : WHITE;
  const token = state.token;

  if (state.view !== cfg.view) await setView(cfg.view);
  if (token !== state.token) return;
  if (board.theme !== cfg.theme) board.setTheme(cfg.theme);
  board.setPosition(state.game.board);
  board.setLastMove(-1);
  board.setCheck(-1);
  const { base, inc } = clockSpec(cfg);
  clock.setup(base, inc);
  renderAll();
  sound.play('start');
  await board.setOrientation(state.orientation, true);
  if (token !== state.token) return;
  state.busy = false;
  clock.start(WHITE);
  renderAll();
  if (cfg.mode === 'ai' && state.humanColor !== WHITE) aiMove();
  if (cfg.mode === 'ai' && state.humanColor === WHITE) toast(`Juegas con blancas contra ${level().name}. ¡Suerte!`);
  if (cfg.mode === 'ai' && state.humanColor !== WHITE) toast(`Juegas con negras contra ${level().name}. ¡Suerte!`);
}

function endGame(st) {
  if (state.over) return;
  state.over = true;
  state.result = st;
  state.token++;
  state.aiThinking = false;
  ai.stop();
  clock.stop();
  board.clearSelection();
  renderAll();

  const g = state.game;
  if (st.reason === 'checkmate') board.toppleKing(g.kingSq(g.turn));
  const human = state.humanColor;
  if (state.cfg.mode === 'ai') sound.play(st.winner === 0 ? 'draw' : st.winner === human ? 'win' : 'lose');
  else sound.play(st.winner === 0 ? 'draw' : 'win');

  let title, icon;
  if (state.cfg.mode === 'ai') {
    if (st.winner === 0) { title = 'Tablas'; icon = '½'; }
    else if (st.winner === human) { title = level().id === 'leyenda' ? '¡Has vencido a la Leyenda!' : '¡Victoria!'; icon = '🏆'; }
    else { title = 'Derrota'; icon = human === WHITE ? '♔' : '♚'; }
  } else {
    title = st.winner === 0 ? 'Tablas' : st.winner === WHITE ? 'Ganan las blancas' : 'Ganan las negras';
    icon = st.winner === 0 ? '½' : '🏆';
  }
  $('#over-icon').textContent = icon;
  $('#over-title').textContent = title;
  $('#over-reason').textContent = REASONS[st.reason] || '';
  $('#over-score').textContent = st.result.replace('1/2', '½').replace('1/2', '½');
  setTimeout(() => { if (state.over && state.result === st) $('#modal-over').hidden = false; }, st.reason === 'checkmate' ? 1300 : 500);
}

function onFlag(loser) {
  if (state.over || !state.started) return;
  const winner = -loser;
  if (!state.game.canMate(winner)) endGame({ over: true, result: '1/2-1/2', reason: 'timeout-draw', winner: 0 });
  else endGame({ over: true, result: winner === WHITE ? '1-0' : '0-1', reason: 'timeout', winner });
}

function syncBoard() {
  const g = state.game;
  board.setPosition(g.board, capturedLists());
  const last = g.history[g.history.length - 1];
  board.setLastMove(last ? last.from : -1, last ? last.to : -1);
  board.setCheck(g.inCheck() ? g.kingSq(g.turn) : -1);
}

async function undo() {
  const g = state.game;
  if (state.busy || !g.history.length) return;
  if (state.aiThinking) { state.token++; ai.stop(); state.aiThinking = false; }
  const wasOver = state.over;
  if (state.cfg.mode === 'ai') {
    g.undo();
    while (g.turn !== state.humanColor && g.history.length) g.undo();
  } else {
    g.undo();
  }
  state.over = false;
  state.result = null;
  $('#modal-over').hidden = true;
  syncBoard();
  if (clock.enabled && (clock.running || wasOver)) clock.start(g.turn);
  if (state.cfg.mode === 'pvp' && state.cfg.rotate && state.orientation !== g.turn) {
    state.orientation = g.turn;
    board.setOrientation(g.turn, true);
  }
  renderAll();
  if (state.cfg.mode === 'ai' && g.turn !== state.humanColor) aiMove();
}

async function offerDraw() {
  if (state.over || !state.started) return;
  const g = state.game;
  if (state.cfg.mode === 'pvp') {
    const other = colorName(-g.turn);
    const ok = await confirmDialog('Oferta de tablas', `Las ${colorName(g.turn)} ofrecen tablas. ¿Aceptan las ${other}?`, 'Aceptar', 'Rechazar');
    if (ok && !state.over) endGame({ over: true, result: '1/2-1/2', reason: 'agreement', winner: 0 });
    else toast(`Las ${other} rechazan las tablas`);
    return;
  }
  if (state.aiThinking) { toast('Espera a que la IA haga su jugada'); return; }
  // La IA acepta si su posición es peor o si la partida está muy igualada y avanzada
  const s = ai.lastScore;
  const accept = s <= -150 || (Math.abs(s) <= 25 && g.history.length >= 60) || g.half >= 70;
  if (accept) {
    toast('La IA acepta las tablas');
    endGame({ over: true, result: '1/2-1/2', reason: 'agreement', winner: 0 });
  } else {
    toast('La IA rechaza las tablas');
  }
}

async function resign() {
  if (state.over || !state.started) return;
  const loser = state.cfg.mode === 'ai' ? state.humanColor : state.game.turn;
  const q = state.cfg.mode === 'ai' ? '¿Seguro que quieres abandonar la partida?' : `¿Las ${colorName(loser)} abandonan la partida?`;
  if (!(await confirmDialog('Rendirse', q, 'Rendirse', 'Seguir jugando'))) return;
  if (state.over) return;
  endGame({ over: true, result: loser === WHITE ? '0-1' : '1-0', reason: 'resign', winner: -loser });
}

function buildPgn() {
  const g = state.game;
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const { base, inc } = clockSpec(state.cfg);
  const res = state.over ? state.result.result : '*';
  const headers = [
    ['Event', state.cfg.mode === 'pvp' ? 'Partida de 2 jugadores' : `Partida contra la IA (${level().name})`],
    ['Site', 'Ajedrez 3D'],
    ['Date', `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`],
    ['White', playerName(WHITE)],
    ['Black', playerName(-1)],
    ['Result', res],
    ['TimeControl', base ? `${base / 1000}+${inc / 1000}` : '-'],
  ];
  if (state.over) headers.push(['Termination', REASONS[state.result.reason] || '']);
  let body = '';
  g.history.forEach((h, i) => { body += (i % 2 === 0 ? `${i / 2 + 1}. ` : '') + h.san + ' '; });
  body += res;
  const lines = [];
  let line = '';
  for (const w of body.split(' ')) {
    if ((line + ' ' + w).trim().length > 80) { lines.push(line.trim()); line = ''; }
    line += ' ' + w;
  }
  lines.push(line.trim());
  return headers.map(([k, v]) => `[${k} "${v}"]`).join('\n') + '\n\n' + lines.join('\n') + '\n';
}

async function copyPgn() {
  const pgn = buildPgn();
  try {
    await navigator.clipboard.writeText(pgn);
    toast('Partida copiada al portapapeles (PGN)');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = pgn;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('Partida copiada al portapapeles (PGN)'); }
    catch { toast('No se pudo copiar'); }
    ta.remove();
  }
}

// ---------------------------------------------------------------- diálogo de nueva partida
function buildNewGameDialog() {
  $('#levels').innerHTML = LEVELS.map((l, i) => `
    <button class="level${l.id === 'leyenda' ? ' legend' : ''}" data-i="${i}">
      <div class="lv-top"><span class="lv-name">${l.name}</span><span class="lv-elo">${l.elo} Elo</span></div>
      <div class="lv-bar">${Array.from({ length: 6 }, (_, k) => `<i class="${k < l.stars ? 'f' : ''}"></i>`).join('')}</div>
      <div class="lv-desc">${l.desc}</div>
    </button>`).join('');
  $('#clocks').innerHTML = CLOCKS.map((c) => `<button class="chip" data-id="${c.id}">${c.label}${c.sub ? `<small>${c.sub}</small>` : ''}</button>`).join('');

  $('#levels').addEventListener('click', (e) => {
    const b = e.target.closest('.level');
    if (b) { state.draft.level = +b.dataset.i; refreshDialog(); }
  });
  $('#clocks').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (b) { state.draft.clock = b.dataset.id; refreshDialog(); }
  });
  for (const seg of $$('#modal-new .seg')) {
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) { state.draft[seg.dataset.name] = b.dataset.value; refreshDialog(); }
    });
  }
  $('#opt-rotate').addEventListener('change', (e) => { state.draft.rotate = e.target.checked; });
  $('#cc-min').addEventListener('input', (e) => { state.draft.customMin = +e.target.value; });
  $('#cc-inc').addEventListener('input', (e) => { state.draft.customInc = +e.target.value; });
  $('#new-cancel').addEventListener('click', closeNewGame);
  $('#new-start').addEventListener('click', () => {
    $('#modal-new').hidden = true;
    startGame(state.draft);
  });
}

function refreshDialog() {
  const d = state.draft;
  $$('#levels .level').forEach((b) => b.classList.toggle('on', +b.dataset.i === d.level));
  $$('#clocks .chip').forEach((b) => b.classList.toggle('on', b.dataset.id === d.clock));
  for (const seg of $$('#modal-new .seg')) {
    seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.value === d[seg.dataset.name]));
  }
  $$('#modal-new .ai-only').forEach((el) => { el.hidden = d.mode !== 'ai'; });
  $$('#modal-new .pvp-only').forEach((el) => { el.hidden = d.mode !== 'pvp'; });
  $('#opt-rotate').checked = !!d.rotate;
  $('#custom-clock').hidden = d.clock !== 'custom';
  $('#cc-min').value = d.customMin;
  $('#cc-inc').value = d.customInc;
}

function openNewGame() {
  state.draft = { ...state.cfg };
  refreshDialog();
  $('#new-cancel').hidden = !state.started;
  $('#modal-over').hidden = true;
  $('#modal-new').hidden = false;
  if (state.started && !state.over) clock.pause();
}

function closeNewGame() {
  $('#modal-new').hidden = true;
  if (state.started && !state.over && !state.busy) clock.resume();
}

// ---------------------------------------------------------------- arranque
async function init() {
  state.orientation = state.cfg.mode === 'ai' && state.cfg.color === 'b' ? -1 : 1;
  await setView(state.cfg.view);
  $('#loading').classList.add('hide');

  buildNewGameDialog();
  renderAll();
  renderEngineInfo();
  ai.init().then(renderEngineInfo);

  $('#btn-new').addEventListener('click', openNewGame);
  $('#btn-undo').addEventListener('click', undo);
  $('#btn-draw').addEventListener('click', offerDraw);
  $('#btn-resign').addEventListener('click', resign);
  $('#btn-pgn').addEventListener('click', copyPgn);
  $('#btn-flip').addEventListener('click', flip);
  $('#btn-view').addEventListener('click', toggleView);
  $('#btn-sound').addEventListener('click', toggleSound);
  $('#btn-install').addEventListener('click', openInstall);
  $('#install-close').addEventListener('click', () => { $('#modal-install').hidden = true; });
  $('#over-close').addEventListener('click', () => { $('#modal-over').hidden = true; });
  $('#over-new').addEventListener('click', openNewGame);
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || !$('#modal-new').hidden) return;
    if (e.key === 'f' || e.key === 'F') flip();
    else if (e.key === 's' || e.key === 'S') toggleSound();
    else if (e.key === 'v' || e.key === 'V') toggleView();
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    else if (e.key === 'Escape') board.clearSelection();
  });
  setTimeout(() => $('#hint').classList.add('hide'), 12000);
  setupPwa();
  openNewGame();
}

// ---------------------------------------------------------------- instalación (PWA) y QR
let installPrompt = null;
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function setupPwa() {
  const secure = window.isSecureContext && 'serviceWorker' in navigator;
  if (secure) navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service worker no registrado', err));
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    $('#modal-install').hidden = true;
    toast('¡Ajedrez 3D instalado!');
  });
  if (isStandalone()) $('#btn-install').hidden = true;
}

function openInstall() {
  const url = location.hostname.endsWith('github.io') ? location.href.split(/[?#]/)[0] : PUBLIC_URL;
  try {
    const qr = window.qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    $('#qr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
  } catch (err) {
    console.warn(err);
    $('#qr').textContent = url;
  }
  $('#qr-url').textContent = url;
  const btn = $('#install-pc');
  btn.hidden = !installPrompt;
  btn.onclick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') installPrompt = null;
    btn.hidden = !installPrompt;
  };
  $('#modal-install').hidden = false;
}

function flip() {
  if (state.busy) return;
  state.orientation = -state.orientation;
  board.setOrientation(state.orientation, true);
  renderCards();
  renderClocks();
}

function toggleSound() {
  sound.enabled = !sound.enabled;
  $('#btn-sound').classList.toggle('muted', !sound.enabled);
  if (sound.enabled) sound.play('select');
}

init();
