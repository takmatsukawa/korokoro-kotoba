// ステージの「狙い」を検証する
//   最短手数 / 最短解の本数 / 各仕掛けを無効にしたときの最短手数 / ひっかけ（最初の一手ごとの最短手数）
// node tools/analyze.mjs <レベル番号>   または   node tools/analyze.mjs '<json>'
import { LEVELS } from '../levels.js';
import { parseLevel, tryMove, solve, countOptimal } from '../logic.js';

const arg = process.argv[2];
const def = /^\d+$/.test(arg) ? LEVELS[Number(arg) - 1] : JSON.parse(arg);

const lv = parseLevel(def);
const base = countOptimal(lv);
console.log(`${def.word}: par=${base?.par ?? '解なし'} 最短解=${base?.paths ?? 0}通り`);
const res = solve(lv);
if (res) console.log('  解:', res.path.map((d) => '→↓←↑'[d]).join(''));

// 仕掛けを外したら？
const swaps = { '~': '氷', '@': '回転床', 'x': 'ひび床', D: '濁点床', P: '半濁点床' };
for (const [ch, name] of Object.entries(swaps)) {
  if (!def.map.some((r) => r.includes(ch))) continue;
  const m = def.map.map((r) => r.split(ch).join('.'));
  const r2 = solve(parseLevel({ ...def, map: m }));
  console.log(`  ${name}→ただの床: ${r2 ? r2.moves + '手' : '解なし'}`);
}
if (def.gates) {
  const keys = Object.keys(def.gates);
  const r2 = solve(parseLevel({ ...def, map: def.map.map((r) => [...r].map((c) => (keys.includes(c) ? '.' : c)).join('')) }));
  console.log(`  門→ただの床: ${r2 ? r2.moves + '手' : '解なし'}`);
}
const ns = parseLevel(def); ns.noSeal = true;
const r3 = solve(ns);
console.log(`  印ブロックなし: ${r3 ? r3.moves + '手' : '解なし'}`);
// 最初の一手ごと
const firsts = [0, 1, 2, 3].map((d) => {
  const r = tryMove(lv, lv.initial, d);
  if (!r.ok) return null;
  const s2 = solve(lv, 2_000_000, r.state);
  return `${'→↓←↑'[d]}:${s2 ? s2.moves + 1 : '×'}`;
}).filter(Boolean);
console.log('  最初の一手:', firsts.join(' '));
