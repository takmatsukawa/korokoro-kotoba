// 全レベルを解いて最短手数を表示する。node tools/check.mjs [レベル番号]
import { LEVELS } from '../levels.js';
import { parseLevel, solve } from '../logic.js';
const only = process.argv[2] ? Number(process.argv[2]) : null;
const arrow = '→↓←↑';
LEVELS.forEach((def, i) => {
  if (only !== null && only !== i + 1) return;
  const lv = parseLevel(def);
  const t = Date.now();
  const res = solve(lv);
  const info = res ? `par=${res.moves} limit=${def.limit ?? '-'} ${res.path.map((d) => arrow[d]).join('')} (${res.explored}状態)` : '解なし';
  const warn = def.par !== res?.moves ? ` ⚠par定義=${def.par}` : "";
  console.log(`${String(i + 1).padStart(2)} ${def.word.padEnd(5, '　')} ${info} ${Date.now() - t}ms${warn}`);
});
