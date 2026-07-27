// 對照兩份 cg-pet-calc 的 exact 模式輸出是否逐字相同。
//
// 用途：驗證「observer 是 opt-in、不碰原本的精確比對」這條不變量。
// 不傳 opts 的呼叫，兩份 lib 必須產生完全一樣的字串，一個 case 都不能差。
//
//   node test/compare-libs.mjs <baseline-index.js> [limit]

import {readFile} from 'fs/promises';
import path from 'path';
import {pathToFileURL, fileURLToPath} from 'url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const BASELINE = process.argv[2];
const LIMIT = parseInt(process.argv[3] ?? '500', 10);

const cur = await import('cg-pet-calc');
const base = await import(pathToFileURL(path.resolve(BASELINE)).href);

const cases = JSON.parse(await readFile(path.join(ROOT, 'test/fixtures/cases.json'), 'utf8'));
const valid = cases.filter(c =>
    !c.reply.includes('查無符合寵物')
    && !c.reply.includes('無解')
    && c.reply.includes('總掉檔'));

// 跟 regression.mjs 同一套：從歷史回覆裡補圖鑑沒有的寵物
const knownNames = new Set(cur.PetDefaultData.map(p => p[1]));
const discovered = new Map();
const PET_LINE_RE = /寵物名稱:([^\n]+)\n寵物總檔次:\s*([\d,]+)/;
for (const c of cases) {
    const m = c.reply.match(PET_LINE_RE);
    if (!m) continue;
    const name = m[1].trim();
    const bps = m[2].split(',').map(n => parseInt(n, 10));
    if (bps.length !== 5 || bps.some(Number.isNaN)) continue;
    if (knownNames.has(name) || discovered.has(name)) continue;
    discovered.set(name, bps);
}
const pets = [...cur.PetDefaultData, ...[...discovered.entries()].map(([n, b]) => [null, n, null, ...b, 0.2])];

const subset = valid.slice(-LIMIT);
let same = 0;
const diffs = [];
for (const c of subset) {
    const a = cur.GuessResultToString(cur.RealGuess(pets, c.pet_name, c.lvl, ...c.stats), 10, 100);
    const b = base.GuessResultToString(base.RealGuess(pets, c.pet_name, c.lvl, ...c.stats), 10, 100);
    if (a === b) same++;
    else diffs.push({pet: c.pet_name, lvl: c.lvl, stats: c.stats});
}

console.log(`compared ${subset.length}: identical=${same} differing=${diffs.length}`);
for (const d of diffs.slice(0, 10)) console.log(`  ${d.pet} lvl=${d.lvl} ${d.stats.join(',')}`);
