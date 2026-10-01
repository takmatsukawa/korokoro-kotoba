// 盤面とお題から文字マスの置き場所を全探索し、「最短解が少なく、手数がほどよい」配置を提案する
// node tools/design.mjs '<json: {map, start, word, gates?, minPar?, maxPar?, maxD?, top?}>'
import { parseLevel, tryMove, letterOf, countOptimal } from '../logic.js';
const def = JSON.parse(process.argv[2]);
const word = [...def.word];
const base = parseLevel({ ...def, word: '' });
// 各マスで各文字が作れるか（文字マス抜きの盤面で）
const key = (s) => `${s.x},${s.y},${s.c},${s.r},${s.mark},${s.rot},${s.broken}`;
const seen = new Set([key(base.initial)]);
let fr = [base.initial], depth = 0;
const best = {};
while (fr.length && depth < (def.maxD ?? 14)) {
  depth++;
  const nx = [];
  for (const s of fr) for (let d = 0; d < 4; d++) {
    const r = tryMove(base, s, d); if (!r.ok) continue;
    const k = key(r.state); if (seen.has(k)) continue;
    seen.add(k); nx.push(r.state);
    const L = letterOf(r.state.c, r.state.r, r.state.mark);
    if (def.map[r.state.y][r.state.x] === '.') { best[L] ??= {}; best[L][`${r.state.x},${r.state.y}`] ??= depth; }
  }
  fr = nx;
}
const cand = word.map((L) => Object.keys(best[L] ?? {}));
word.forEach((L, i) => console.log(L, cand[i].length + 'マス'));
const results = [];
const rec = (i, chosen) => {
  if (i === word.length) {
    const map = def.map.map((r) => [...r]);
    chosen.forEach(([x, y], j) => (map[y][x] = String(j + 1)));
    const m = map.map((r) => r.join(''));
    const res = countOptimal(parseLevel({ ...def, map: m }), 400000);
    if (res && res.par >= (def.minPar ?? 0) && res.par <= (def.maxPar ?? 99)) results.push({ ...res, map: m });
    return;
  }
  for (const p of cand[i]) {
    const [x, y] = p.split(',').map(Number);
    if (chosen.some(([a, b]) => a === x && b === y)) continue;
    rec(i + 1, [...chosen, [x, y]]);
  }
};
rec(0, []);
results.sort((a, b) => a.paths - b.paths || b.par - a.par);
console.log(`${results.length}配置`);
for (const r of results.slice(0, def.top ?? 4)) console.log(`par=${r.par} 解${r.paths}通り  ` + r.map.join(' | '));
