import { LEVELS } from './levels.js';
import { GOJUON, GYO, DAN, parseLevel, tryMove, solve, stepCursor, localDir, letterOf, cursorOf } from './logic.js';
import { World } from './scene.js';
import { Sound } from './sound.js';

const $ = (id) => document.getElementById(id);
const sound = new Sound();
const world = new World($('stage'));

// HUD に隠れない画面領域。カメラはこの中に盤面を収める
world.getSafe = () => {
  const W = innerWidth, H = innerHeight;
  if ($('hud').hidden) return { left: 0, top: 0, right: W, bottom: H };
  const top = document.querySelector('#hud .top').getBoundingClientRect();
  const bottom = document.querySelector('#hud .bottom').getBoundingClientRect();
  const g = $('gojuon').getBoundingClientRect();
  const safe = { left: 12, top: top.bottom + 8, right: W - 12, bottom: bottom.top - 8 };
  if (g.top > H * 0.45) safe.bottom = Math.min(safe.bottom, g.top - 8);
  else safe.right = Math.min(safe.right, g.left - 12);
  const dp = $('dpad');
  if (getComputedStyle(dp).display !== 'none') safe.left = Math.max(safe.left, dp.getBoundingClientRect().right + 8);
  return safe;
};

// ---- セーブデータ（失敗しても遊べるように try/catch） ----
const SAVE_KEY = 'korokoro-kotoba-v2';
// clear[i]: 1 = ヒントを使ってクリア, 2 = ヒントなしでクリア
let save = { clear: {}, muted: false };
try { save = { ...save, ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') }; } catch {}
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} };
sound.muted = save.muted;

// ---- ゲーム状態 ----
let levelIndex = 0;
let lv = null;
let state = null;
let history = [];
let busy = false;
let queued = null;
let hintUsed = false;
let finished = false;

// 手数制限は最短手数ぴったり
const remaining = () => LEVELS[levelIndex].par - state.moves;
const OUT_OF_MOVES = '手数切れ！「もどす」で戻るか「さいしょから」やりなおそう';

function startLevel(i) {
  levelIndex = i;
  const def = LEVELS[i];
  lv = parseLevel(def);
  state = lv.initial;
  history = [];
  hintUsed = false;
  finished = false;
  busy = false;
  queued = null;
  showScreen(null);
  $('hud').hidden = false;
  $('stage-no').textContent = `ステージ ${i + 1} / ${LEVELS.length}`;
  $('par').textContent = def.par;
  buildGojuon();
  updateHud();
  world.loadLevel(lv, state);
  toast(def.hint, 6000);
}

function updateHud() {
  const def = LEVELS[levelIndex];
  $('moves').textContent = remaining();
  $('moves').parentElement.parentElement.classList.toggle('warn', remaining() <= 2);
  const word = $('word');
  word.innerHTML = `<span class="emoji">${def.emoji}</span>`;
  lv.word.forEach((ch, i) => {
    const done = state.filled & (1 << i);
    const el = document.createElement('div');
    el.className = 'slot' + (done ? ' done' : '');
    el.innerHTML = `<small>${i + 1}</small>${ch}`;
    word.appendChild(el);
  });
  $('btn-undo').disabled = history.length === 0;
  updateGojuon();
}

// ---- 50音表 HUD ----
let gojuonCells = [];
function buildGojuon() {
  const el = $('gojuon');
  el.innerHTML = '';
  gojuonCells = [];
  for (let r = 0; r < DAN; r++) {
    for (let c = 0; c < GYO; c++) {
      const d = document.createElement('div');
      d.className = 'cell' + (GOJUON[c][r] ? '' : ' empty');
      gojuonCells.push(d);
      el.appendChild(d);
    }
  }
  const mark = document.createElement('div');
  mark.className = 'mark';
  mark.id = 'mark';
  el.appendChild(mark);
}
function updateGojuon() {
  const arrows = '→↓←↑';
  const need = new Map();
  lv.word.forEach((ch, i) => {
    if (state.filled & (1 << i)) return;
    need.set(ch, true);
  });
  for (let r = 0; r < DAN; r++) {
    for (let c = 0; c < GYO; c++) {
      const el = gojuonCells[r * GYO + c];
      if (!GOJUON[c][r]) continue;
      const ch = letterOf(c, r, state.mark);
      el.textContent = ch;
      el.className = 'cell';
      if (need.has(ch)) el.classList.add('need');
      if (c === state.c && r === state.r) el.classList.add('cur');
      el.removeAttribute('data-arrow');
    }
  }
  // 各方向に転がしたときの行き先
  for (let d = 0; d < 4; d++) {
    const [c, r] = stepCursor(state.c, state.r, localDir(d, state.rot));
    const el = gojuonCells[r * GYO + c];
    if (el.classList.contains('cur')) continue;
    el.classList.add('next');
    el.dataset.arrow = (el.dataset.arrow ?? '') + arrows[d];
  }
  const m = $('mark');
  const rotTxt = state.rot ? `　向き: ${'↑→↓←'[state.rot]}（${state.rot * 90}°）` : '';
  m.innerHTML = (state.mark === 1 ? '<b>゛濁点モード</b>' : state.mark === 2 ? '<b>゜半濁点モード</b>' : 'ふつうモード') + rotTxt;
}

// ---- 操作 ----
async function move(d) {
  if (finished || !lv) return;
  if (busy) { queued = d; return; }
  const def = LEVELS[levelIndex];
  if (remaining() <= 0) {
    sound.play('miss');
    toast(OUT_OF_MOVES);
    return;
  }
  const res = tryMove(lv, state, d);
  busy = true;
  sound.resume();
  if (!res.ok) {
    const ev = res.events[0];
    if (ev.type === 'gateBlock') toast(`この門は「${ev.need}」でないと通れない（いまは「${ev.letter}」）`);
    await world.play(state, state, res.events, sfx);
  } else {
    history.push(state);
    const prev = state;
    state = res.state;
    for (const ev of res.events) {
      if (ev.type === 'miss') toast(`ここは「${ev.need}」のマス。いまは「${ev.letter}」`);
      if (ev.type === 'stamp') setTimeout(updateHud, 120);
    }
    updateHud();
    await world.play(prev, state, res.events, sfx);
    if (res.events.some((e) => e.type === 'win')) return win();
    if (remaining() <= 0) toast(OUT_OF_MOVES, 4000);
    else if ([0, 1, 2, 3].every((dd) => !tryMove(lv, state, dd).ok)) toast('身動きがとれない！「もどす」で戻ろう', 4000);
  }
  busy = false;
  if (queued !== null) { const q = queued; queued = null; move(q); }
}

function sfx(name, ev) {
  sound.play(name, ev);
}

function undo() {
  if (busy || finished || !history.length) return;
  state = history.pop();
  world.sync(state);
  sound.play('undo');
  updateHud();
}
function retry() {
  if (busy) return;
  startLevel(levelIndex);
}
function hint() {
  if (busy || finished) return;
  const res = solve(lv, 400000, state);
  if (!res || res.moves > remaining()) {
    toast(res ? `ここからだと最短でも ${res.moves} 手。もう間に合わないので「もどす」で戻ろう` : 'ここからはもう完成できない。「もどす」で戻ろう', 4000);
    return;
  }
  hintUsed = true;
  const d = res.path[0];
  world.flashHint(d);
  toast(`次の一手は「${'→↓←↑'[d]}」`, 3000);
}

function win() {
  finished = true;
  busy = false;
  const def = LEVELS[levelIndex];
  const key = String(levelIndex);
  save.clear[key] = Math.max(save.clear[key] ?? 0, hintUsed ? 1 : 2);
  persist();
  sound.speak(def.word);
  setTimeout(() => {
    $('result-emoji').textContent = def.emoji;
    $('result-word').textContent = def.word;
    $('result-badge').textContent = hintUsed ? '💡 ヒントつきでクリア' : '🏅 ノーヒントクリア！';
    $('result-badge').className = 'badge' + (hintUsed ? '' : ' gold');
    $('result-text').textContent = `${state.moves} 手ぴったりで完成！`;
    $('btn-next').textContent = levelIndex + 1 < LEVELS.length ? 'つぎへ' : 'ステージ選択へ';
    showScreen('result-screen');
  }, 500);
}

// ---- 画面 ----
function showScreen(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
}
function openSelect() {
  if (busy) return;
  const grid = $('stage-grid');
  grid.innerHTML = '';
  LEVELS.forEach((def, i) => {
    const clear = save.clear[String(i)] ?? 0;
    const unlocked = i === 0 || (save.clear[String(i - 1)] ?? 0) > 0 || clear > 0;
    const b = document.createElement('button');
    b.className = clear ? 'cleared' : '';
    b.disabled = !unlocked;
    b.innerHTML = `<span class="n">${i + 1}</span><span class="e">${unlocked ? def.emoji : '🔒'}</span>` +
      `<span class="w">${unlocked ? def.word : '？？'}</span><span class="s">${['　', '💡', '🏅'][clear]}</span>`;
    b.onclick = () => { sound.resume(); startLevel(i); };
    grid.appendChild(b);
  });
  showScreen('select-screen');
}

let toastTimer = 0;
function toast(msg, ms = 2200) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

// ---- 入力 ----
const KEYS = { ArrowRight: 0, ArrowDown: 1, ArrowLeft: 2, ArrowUp: 3, d: 0, s: 1, a: 2, w: 3, D: 0, S: 1, A: 2, W: 3 };
addEventListener('keydown', (e) => {
  const playing = !$('hud').hidden && document.querySelector('.screen:not([hidden])') === null;
  if (e.key in KEYS && playing) { e.preventDefault(); move(KEYS[e.key]); return; }
  if (!playing) {
    if (e.key === 'Enter' && !$('result-screen').hidden) $('btn-next').click();
    else if (e.key === 'Enter' && !$('title-screen').hidden) $('btn-start').click();
    return;
  }
  const k = e.key.toLowerCase();
  if (k === 'z' || k === 'backspace') undo();
  else if (k === 'r') retry();
  else if (k === 'h') hint();
  else if (k === 'm') toggleSound();
  else if (k === 'escape') openSelect();
});

// スワイプ
let touchStart = null;
$('stage').addEventListener('pointerdown', (e) => { touchStart = [e.clientX, e.clientY]; });
$('stage').addEventListener('pointerup', (e) => {
  if (!touchStart) return;
  const dx = e.clientX - touchStart[0], dy = e.clientY - touchStart[1];
  touchStart = null;
  if (Math.hypot(dx, dy) < 30) return;
  move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3));
});
for (const b of document.querySelectorAll('#dpad button')) {
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); move(Number(b.dataset.d)); });
}

function toggleSound() {
  sound.muted = !sound.muted;
  save.muted = sound.muted;
  persist();
  $('btn-sound').textContent = sound.muted ? '🔇' : '🔊';
}

$('btn-start').onclick = () => {
  sound.resume();
  const firstUncleared = LEVELS.findIndex((_, i) => !save.clear[String(i)]);
  if (firstUncleared <= 0) startLevel(0);
  else openSelect();
};
$('btn-back-title').onclick = () => showScreen(lv ? null : 'title-screen');
$('btn-menu').onclick = openSelect;
$('btn-undo').onclick = undo;
$('btn-retry').onclick = retry;
$('btn-hint').onclick = hint;
$('btn-sound').onclick = toggleSound;
$('btn-sound').textContent = sound.muted ? '🔇' : '🔊';
$('btn-result-retry').onclick = () => startLevel(levelIndex);
$('btn-next').onclick = () => (levelIndex + 1 < LEVELS.length ? startLevel(levelIndex + 1) : openSelect());

// タイトル画面の背景にステージ1を表示しておく（フォント読み込み後にテクスチャを作る）
await document.fonts.load('900 100px "Zen Maru Gothic"').catch(() => {});
lv = parseLevel(LEVELS[0]);
state = lv.initial;
world.loadLevel(lv, state);
lv = null;

// デバッグ・動作確認用
window.__game = { startLevel, move, get state() { return state; }, LEVELS, cursorOf };
