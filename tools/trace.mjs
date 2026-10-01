// 最短解を1手ずつ表示する  node tools/trace.mjs '<json>' | <レベル番号>
import { LEVELS } from '../levels.js';
import { parseLevel, tryMove, letterOf, solve } from '../logic.js';
const arg = process.argv[2];
const def = /^\d+$/.test(arg) ? LEVELS[Number(arg) - 1] : JSON.parse(arg);
const lv = parseLevel(def);
let s = lv.initial;
for (const d of solve(lv).path) {
  const r = tryMove(lv, s, d); s = r.state;
  console.log('→↓←↑'[d], `(${s.x},${s.y})`, letterOf(s.c, s.r, s.mark), `rot${s.rot}`, r.events.map((e) => e.type).filter((t) => t !== 'roll').join(','));
}
