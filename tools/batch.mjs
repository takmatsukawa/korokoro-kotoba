// 盤面（文字マスなし）に対して単語リストを総当たりし、
// 「最短解が少ない」「仕掛けを外すと手数か解の有無が変わる」配置を探す
// node tools/batch.mjs '<json: {map, start, gates?, minPar?, maxPar?, words?}>'
import { parseLevel, tryMove, letterOf, countOptimal, solve } from '../logic.js';
const WORDS = 'いか うし ねこ すし たこ ほね かめ くま さる とり いぬ かに なす もも くり あめ ゆき ほし つき はな ふね いす かさ たけ もち くつ ほん おに なし すいか さかな きつね たぬき めろん りんご ひよこ とまと れもん みかん こあら あひる とけい たいこ さくら きのこ ひな せみ かき あり くも たね はと えき やま うみ そら かお て め'.split(' ');
const def = JSON.parse(process.argv[2]);
const words = def.words ?? WORDS;
const base = parseLevel({ ...def, word: '' });
const key = (s) => `${s.x},${s.y},${s.c},${s.r},${s.mark},${s.rot},${s.broken}`;
const seen = new Set([key(base.initial)]);
let fr = [base.initial], depth = 0;
const where = {};
while (fr.length && depth < (def.maxD ?? 16)) {
  depth++;
  const nx = [];
  for (const s of fr) for (let d = 0; d < 4; d++) {
    const r = tryMove(base, s, d); if (!r.ok) continue;
    const k = key(r.state); if (seen.has(k)) continue;
    seen.add(k); nx.push(r.state);
    const L = letterOf(r.state.c, r.state.r, r.state.mark);
    if (def.map[r.state.y][r.state.x] === '.') (where[L] ??= new Set()).add(`${r.state.x},${r.state.y}`);
  }
  fr = nx;
}
const specials = { '~': 'ice', '@': 'turn', 'x': 'crack', D: 'daku', P: 'handaku' };
const used = Object.keys(specials).filter((ch) => def.map.some((r) => r.includes(ch)));
const out = [];
for (const w of words) {
  const letters = [...w];
  if (new Set(letters).size !== letters.length) continue;
  const cand = letters.map((L) => [...(where[L] ?? [])]);
  if (cand.some((c) => !c.length)) continue;
  const rec = (i, chosen) => {
    if (i === letters.length) {
      const map = def.map.map((r) => [...r]);
      chosen.forEach(([x, y], j) => (map[y][x] = String(j + 1)));
      const m = map.map((r) => r.join(''));
      const d2 = { ...def, word: w, map: m };
      const res = countOptimal(parseLevel(d2), 300000);
      if (!res || res.par < (def.minPar ?? 0) || res.par > (def.maxPar ?? 99)) return;
      if (res.paths > (def.maxPaths ?? 6)) return;
      // 各仕掛けが効いているか
      const need = def.need ?? used;
      const eff = used.map((ch) => {
        const r2 = solve(parseLevel({ ...d2, map: m.map((r) => r.split(ch).join('.')) }), 300000);
        const same = r2 && r2.moves === res.par;
        if (same && need.includes(ch)) return null;
        return `${specials[ch]}:${r2 ? r2.moves : '×'}`;
      });
      if (eff.some((e) => e === null)) return;
      if (def.gates) {
        const keys = Object.keys(def.gates);
        const r2 = solve(parseLevel({ ...d2, map: m.map((r) => [...r].map((c) => (keys.includes(c) ? '.' : c)).join('')) }), 300000);
        if (r2 && r2.moves === res.par) return;
        // 最短解が門を実際にくぐっていること
        const lv0 = parseLevel(d2);
        let st = lv0.initial, through = false;
        for (const d of solve(lv0, 300000).path) {
          st = tryMove(lv0, st, d).state;
          if (keys.includes(m[st.y][st.x])) through = true;
        }
        if (!through) return;
        eff.push(`gate:${r2 ? r2.moves : '×'}`);
      }
      // ひっかけ：最初の一手のうち、もう最短では解けなくなるもの
      const lv = parseLevel(d2);
      let traps = 0;
      for (let d = 0; d < 4; d++) {
        const r1 = tryMove(lv, lv.initial, d);
        if (!r1.ok) continue;
        const r2 = solve(lv, 300000, r1.state);
        if (!r2 || r2.moves + 1 > res.par) traps++;
      }
      eff.push(`罠${traps}`);
      out.push({ w, ...res, m, eff, traps });
      return;
    }
    for (const p of cand[i]) {
      const [x, y] = p.split(',').map(Number);
      if (chosen.some(([a, b]) => a === x && b === y)) continue;
      rec(i + 1, [...chosen, [x, y]]);
    }
  };
  rec(0, []);
}
out.sort((a, b) => a.paths - b.paths || b.traps - a.traps || b.par - a.par);
const shown = new Map();
for (const r of out) {
  if ((shown.get(r.w) ?? 0) >= 2) continue;
  shown.set(r.w, (shown.get(r.w) ?? 0) + 1);
  console.log(`${r.w} par=${r.par} 解${r.paths} [${r.eff.join(' ')}]  ${r.m.join(' | ')}`);
}
console.log(`${out.length}件`);
