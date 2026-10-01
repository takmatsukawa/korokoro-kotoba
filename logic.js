// ゲームロジック（描画に依存しない純粋な処理）。ブラウザと Node の両方から読み込む。

// 50音表。GOJUON[行][段]。null は空欄（や行・わ行・ん）。
export const GOJUON = [
  ['あ', 'い', 'う', 'え', 'お'],
  ['か', 'き', 'く', 'け', 'こ'],
  ['さ', 'し', 'す', 'せ', 'そ'],
  ['た', 'ち', 'つ', 'て', 'と'],
  ['な', 'に', 'ぬ', 'ね', 'の'],
  ['は', 'ひ', 'ふ', 'へ', 'ほ'],
  ['ま', 'み', 'む', 'め', 'も'],
  ['や', null, 'ゆ', null, 'よ'],
  ['ら', 'り', 'る', 'れ', 'ろ'],
  ['わ', null, null, null, 'を'],
  ['ん', null, null, null, null],
];
export const GYO = GOJUON.length; // 11
export const DAN = 5;

const DAKU = { か: 'がぎぐげご', さ: 'ざじずぜぞ', た: 'だぢづでど', は: 'ばびぶべぼ' };
const HANDAKU = { は: 'ぱぴぷぺぽ' };

// mark: 0 = なし, 1 = 濁点モード, 2 = 半濁点モード
export function letterOf(c, r, mark = 0) {
  const head = GOJUON[c][0];
  if (mark === 1 && DAKU[head]) return DAKU[head][r];
  if (mark === 2 && HANDAKU[head]) return HANDAKU[head][r];
  return GOJUON[c][r];
}

export function cursorOf(ch) {
  for (let c = 0; c < GYO; c++) {
    const r = GOJUON[c].indexOf(ch);
    if (r >= 0) return [c, r];
  }
  throw new Error(`50音表にない文字: ${ch}`);
}

// 画面上の方向。0:右 1:下(手前) 2:左 3:上(奥)
export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

// サイコロ自身の向き(rot)を考慮した、50音表上での移動量
export function localDir(d, rot) {
  return (((d - rot) % 4) + 4) % 4;
}

// 50音表のカーソルを動かす。0:右の行へ 1:下の段へ 2:左の行へ 3:上の段へ。空欄は飛ばし、端は反対側へ回り込む
export function stepCursor(c, r, local) {
  const dc = local === 0 ? 1 : local === 2 ? -1 : 0;
  const dr = local === 1 ? 1 : local === 3 ? -1 : 0;
  for (let i = 0; i < 12; i++) {
    c = (c + dc + GYO) % GYO;
    r = (r + dr + DAN) % DAN;
    if (GOJUON[c][r]) return [c, r];
  }
  return [c, r];
}

// サイコロを方向 d に転がしたときの上面の文字
export function previewLetter(s, d) {
  const [c, r] = stepCursor(s.c, s.r, localDir(d, s.rot));
  return letterOf(c, r, s.mark);
}

// ---- 盤面 ----
// 記号: ' ' 穴(進入不可)  '.' 床  '#' 岩  'S' スタート  '~' 氷  '@' 回転床
//       'D' 濁点床  'P' 半濁点床  'x' ひび床(一度離れると崩れて穴になる)
//       '1'-'9' 文字マス(お題の n 文字目。押すと、離れたあと印のブロックになり通れない)
//       'A'-'Z' 文字の門(def.gates)
export function parseLevel(def) {
  const word = [...def.word];
  const h = def.map.length;
  const w = Math.max(...def.map.map((row) => row.length));
  const cells = [];
  let start = null;
  const slots = [];
  const cracks = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      const ch = def.map[y][x] ?? ' ';
      let cell;
      if (ch === ' ') cell = { t: 'void' };
      else if (ch === '.') cell = { t: 'floor' };
      else if (ch === '#') cell = { t: 'rock' };
      else if (ch === 'S') { cell = { t: 'floor' }; start = [x, y]; }
      else if (ch === '~') cell = { t: 'ice' };
      else if (ch === '@') cell = { t: 'turn' };
      else if (ch === 'D') cell = { t: 'daku' };
      else if (ch === 'P') cell = { t: 'handaku' };
      else if (ch === 'x') { cell = { t: 'crack', k: cracks.length }; cracks.push([x, y]); }
      else if (ch >= '1' && ch <= '9') {
        const i = ch.charCodeAt(0) - 49;
        cell = { t: 'slot', i, letter: word[i] };
        slots[i] = [x, y];
      } else if (ch >= 'A' && ch <= 'Z') {
        const letter = def.gates?.[ch];
        if (!letter) throw new Error(`門 ${ch} の文字が未定義`);
        cell = { t: 'gate', letter };
      } else throw new Error(`不明な記号: ${ch}`);
      row.push(cell);
    }
    cells.push(row);
  }
  if (!start) throw new Error('スタートがない');
  if (slots.length !== word.length || slots.some((s) => !s)) throw new Error(`文字マスの数がお題と合わない: ${def.word}`);
  const [c, r] = cursorOf(def.start);
  return {
    def, word, w, h, cells, slots, cracks,
    initial: { x: start[0], y: start[1], c, r, mark: 0, rot: def.rot ?? 0, filled: 0, broken: 0, moves: 0 },
  };
}

export function cellAt(lv, x, y) {
  if (x < 0 || y < 0 || x >= lv.w || y >= lv.h) return { t: 'void' };
  return lv.cells[y][x];
}

// その状態で (x, y) に入れないか（穴・岩・押し終えた文字マス・崩れたひび床）
export function isBlocked(lv, s, x, y) {
  const cell = cellAt(lv, x, y);
  if (cell.t === 'void' || cell.t === 'rock') return true;
  if (cell.t === 'slot' && s.filled & (1 << cell.i) && !lv.noSeal) return true;
  if (cell.t === 'crack' && s.broken & (1 << cell.k)) return true;
  return false;
}

export function isWin(lv, s) {
  return s.filled === (1 << lv.word.length) - 1;
}

// 1手進める。結果の状態と、演出用のイベント列を返す。
export function tryMove(lv, s, d) {
  const [dx, dy] = DIRS[d];
  const nx = s.x + dx, ny = s.y + dy;
  const target = cellAt(lv, nx, ny);
  if (isBlocked(lv, s, nx, ny)) return { ok: false, events: [{ type: 'bump', d }] };

  const [c, r] = stepCursor(s.c, s.r, localDir(d, s.rot));
  const letter = letterOf(c, r, s.mark);
  if (target.t === 'gate' && target.letter !== letter) {
    return { ok: false, events: [{ type: 'gateBlock', d, x: nx, y: ny, letter, need: target.letter }] };
  }

  const ns = { ...s, x: nx, y: ny, c, r, moves: s.moves + 1 };
  const events = [{ type: 'roll', d, from: [s.x, s.y], to: [nx, ny], letter }];

  // 離れたマスの変化：ひび床は崩れ、押し終えた文字マスは印のブロックになる
  const left = cellAt(lv, s.x, s.y);
  if (left.t === 'crack') {
    ns.broken |= 1 << left.k;
    events.push({ type: 'crumble', k: left.k, x: s.x, y: s.y });
  } else if (left.t === 'slot' && s.filled & (1 << left.i)) {
    events.push({ type: 'seal', i: left.i, x: s.x, y: s.y });
  }

  // 氷の上は転がらずに滑る（文字は変わらない）
  if (target.t === 'ice') {
    let x = nx, y = ny;
    while (cellAt(lv, x, y).t === 'ice') {
      const next = cellAt(lv, x + dx, y + dy);
      if (isBlocked(lv, ns, x + dx, y + dy)) break;
      if (next.t === 'gate' && next.letter !== letter) break;
      x += dx; y += dy;
    }
    if (x !== nx || y !== ny) {
      events.push({ type: 'slide', d, from: [nx, ny], to: [x, y] });
      ns.x = x; ns.y = y;
    }
  }

  const here = cellAt(lv, ns.x, ns.y);
  if (here.t === 'turn') {
    ns.rot = (ns.rot + 1) % 4;
    events.push({ type: 'turn' });
  } else if (here.t === 'daku') {
    ns.mark = ns.mark === 1 ? 0 : 1;
    events.push({ type: 'mark', mark: ns.mark });
  } else if (here.t === 'handaku') {
    ns.mark = ns.mark === 2 ? 0 : 2;
    events.push({ type: 'mark', mark: ns.mark });
  }

  if (here.t === 'slot' && !(ns.filled & (1 << here.i))) {
    const now = letterOf(ns.c, ns.r, ns.mark);
    if (now === here.letter) {
      ns.filled |= 1 << here.i;
      events.push({ type: 'stamp', i: here.i, x: ns.x, y: ns.y, letter: now });
    } else {
      events.push({ type: 'miss', i: here.i, letter: now, need: here.letter });
    }
  }
  if (isWin(lv, ns)) events.push({ type: 'win' });
  return { ok: true, state: ns, events };
}

export const stateKey = (s) => `${s.x},${s.y},${s.c},${s.r},${s.mark},${s.rot},${s.filled},${s.broken}`;

// 幅優先探索で最短手数を求める（レベル検証・星の基準用）
export function solve(lv, limit = 2_000_000, from = lv.initial) {
  const key = stateKey;
  const start = { ...from, moves: 0 };
  if (isWin(lv, start)) return { moves: 0, path: [], explored: 1 };
  const prev = new Map([[key(start), null]]);
  let frontier = [start];
  let n = 0;
  while (frontier.length) {
    const next = [];
    for (const s of frontier) {
      for (let d = 0; d < 4; d++) {
        const res = tryMove(lv, s, d);
        if (!res.ok) continue;
        const k = key(res.state);
        if (prev.has(k)) continue;
        prev.set(k, [key(s), d]);
        if (isWin(lv, res.state)) {
          const path = [];
          let cur = k;
          while (prev.get(cur)) { const [p, dd] = prev.get(cur); path.unshift(dd); cur = p; }
          return { moves: path.length, path, explored: prev.size };
        }
        next.push(res.state);
        if (++n > limit) return null;
      }
    }
    frontier = next;
  }
  return null;
}

// 最短手数と、最短解が何通りあるか（レベル設計の検証用）
export function countOptimal(lv, cap = 3_000_000) {
  let layer = new Map([[stateKey(lv.initial), { s: lv.initial, n: 1 }]]);
  const seen = new Set(layer.keys());
  let depth = 0, total = 0;
  while (layer.size && total < cap) {
    depth++;
    const next = new Map();
    let wins = 0;
    for (const { s, n } of layer.values()) for (let d = 0; d < 4; d++) {
      const r = tryMove(lv, s, d); if (!r.ok) continue;
      const k = stateKey(r.state);
      if (seen.has(k) && !next.has(k)) continue;
      if (isWin(lv, r.state)) { wins += n; continue; }
      const e = next.get(k);
      if (e) e.n += n; else { next.set(k, { s: r.state, n }); seen.add(k); total++; }
    }
    if (wins) return { par: depth, paths: wins };
    layer = next;
  }
  return null;
}

