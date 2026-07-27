// 量 DC 切到 observer 之後，實際會有多少筆輸出跟現在不一樣。
//
// observer 是 exact 的超集，所以解只會變多、掉檔範圍只會變寬。
// 這支就是去數：多少筆有變、變多少、以及最壞情況慢多少。
//
//   node test/observer-delta.mjs [limit] [lib-path]

import {readFile} from 'fs/promises';
import path from 'path';
import {pathToFileURL, fileURLToPath} from 'url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const LIMIT = parseInt(process.argv[2] ?? '500', 10);
const LIB = process.argv[3];
const {RealGuess, GuessResultToString, PetDefaultData} =
    await import(LIB ? pathToFileURL(path.resolve(LIB)).href : 'cg-pet-calc');

const cases = JSON.parse(await readFile(path.join(ROOT, 'test/fixtures/cases.json'), 'utf8'));
const valid = cases.filter(c =>
    !c.reply.includes('查無符合寵物')
    && !c.reply.includes('無解')
    && c.reply.includes('總掉檔'));

const knownNames = new Set(PetDefaultData.map(p => p[1]));
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
const pets = [...PetDefaultData, ...[...discovered.entries()].map(([n, b]) => [null, n, null, ...b, 0.2])];

const subset = valid.slice(-LIMIT);
const MODES = ['observer', 'auto'];
const stats = Object.fromEntries(MODES.map(m => [m, {changed: 0, lost: 0, rescued: 0, ms: 0, maxMs: 0, slowest: null, samples: []}]));
let exactZero = 0, exactMs = 0;

const key = r => [r.GuessRange.toArray(), r.ManualPoints, r.RandomRange].join('|');

for (const c of subset) {
    let t = performance.now();
    const e = RealGuess(pets, c.pet_name, c.lvl, ...c.stats);
    exactMs += performance.now() - t;
    const eStr = GuessResultToString(e, 10, 100);
    const eInt = (e.results ?? []).filter(r => !r.isApproximate);
    if (eInt.length === 0) exactZero++;

    for (const mode of MODES) {
        const s = stats[mode];
        t = performance.now();
        const o = RealGuess(pets, c.pet_name, c.lvl, ...c.stats, undefined, undefined, {mode});
        const dt = performance.now() - t;
        s.ms += dt;
        if (dt > s.maxMs) {s.maxMs = dt; s.slowest = c;}

        const on = o.results?.length ?? 0;
        if (eInt.length === 0 && on > 0) s.rescued++;

        // 有沒有弄丟 exact 的解 —— superset 不變量
        const seen = new Set((o.results ?? []).map(key));
        if (eInt.some(r => !seen.has(key(r)))) s.lost++;

        if (GuessResultToString(o, 10, 100) !== eStr) {
            s.changed++;
            if (s.samples.length < 5) s.samples.push({pet: c.pet_name, lvl: c.lvl, stats: c.stats, en: eInt.length, on});
        }
    }
}

const pct = n => (n / subset.length * 100).toFixed(1);
console.log(`cases:              ${subset.length}`);
console.log(`exact 整數列舉無解:  ${exactZero}`);
console.log(`exact avg ${(exactMs/subset.length).toFixed(1)}ms\n`);
for (const mode of MODES) {
    const s = stats[mode];
    console.log(`[${mode}]`);
    console.log(`  輸出有變:        ${s.changed} (${pct(s.changed)}%)`);
    console.log(`  弄丟 exact 的解:  ${s.lost} (${pct(s.lost)}%)`);
    console.log(`  接住 exact 無解:  ${s.rescued} / ${exactZero}`);
    console.log(`  avg ${(s.ms/subset.length).toFixed(1)}ms  max ${s.maxMs.toFixed(0)}ms (${s.slowest?.pet_name} lvl ${s.slowest?.lvl})`);
    for (const x of s.samples) console.log(`    ${x.pet} lvl=${x.lvl} ${x.stats.join(',')} — exact ${x.en} 解 → ${x.on} 解`);
    console.log('');
}
