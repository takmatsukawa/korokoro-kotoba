// 盤面の各マスで到達可能な文字を列挙する設計補助ツール
// 使い方: node tools/reach.mjs '<json: {map, start, gates?, rot?}>'
import { parseLevel, tryMove, letterOf } from '../logic.js';
const def = JSON.parse(process.argv[2]);
const map = def.map.map((r) => r.replace(/[1-9]/g, '.'));
const lv = parseLevel({ ...def, map: map.map((r, y) => (y === 0 ? r : r)), word: '' });
const key = (s) => `${s.x},${s.y},${s.c},${s.r},${s.mark},${s.rot}`;
const seen = new Map([[key(lv.initial), 0]]);
let fr = [lv.initial];
const at = {};
let depth = 0;
while (fr.length) {
  depth++;
  const nx = [];
  for (const s of fr) for (let d = 0; d < 4; d++) {
    const r = tryMove(lv, s, d); if (!r.ok) continue;
    const k = key(r.state); if (seen.has(k)) continue;
    seen.set(k, depth); nx.push(r.state);
    const p = `${r.state.x},${r.state.y}`; const L = letterOf(r.state.c, r.state.r, r.state.mark);
    at[p] ??= new Map(); if (!at[p].has(L)) at[p].set(L, depth);
  }
  fr = nx;
}
for (let y = 0; y < lv.h; y++) for (let x = 0; x < lv.w; x++) {
  const m = at[`${x},${y}`]; if (!m) continue;
  console.log(`(${x},${y}) ${def.map[y][x]}: ` + [...m].sort((a, b) => a[1] - b[1]).map(([l, d]) => `${l}${d}`).join(' '));
}
