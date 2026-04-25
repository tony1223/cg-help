import {readFile, writeFile} from 'fs/promises';
import path from 'path';
import {fileURLToPath} from 'url';
import {RealGuess, GuessResultToString, PetDefaultData} from 'cg-pet-calc';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const CASES = path.join(ROOT, 'test/fixtures/cases.json');
const OUT = path.join(ROOT, 'test/fixtures/regression-report.json');
const PETS_OUT = path.join(ROOT, 'test/fixtures/pets-discovered.json');
const PROGRESS = path.join(ROOT, 'test/fixtures/regression-progress.json');

const LIMIT = parseInt(process.argv[2] ?? '0', 10) || Infinity;
const FROM = process.argv[3] ?? 'recent';
const SHOW_LIMIT = 10;
const SHOW_DETAILS = 100;

const cases = JSON.parse(await readFile(CASES, 'utf8'));

// Skip pet-not-found and no-solution cases — they don't carry the bound invariants we want to verify
const valid = cases.filter(c =>
    !c.reply.includes('查無符合寵物')
    && !c.reply.includes('無解')
    && c.reply.includes('總掉檔'));
console.log(`total cases ${cases.length}, valid (skip not-found/no-solution) ${valid.length}`);

// Augment PetDefaultData with pets discovered in bot replies
const knownNames = new Set(PetDefaultData.map(p => p[1]));
const discovered = new Map();
const PET_LINE_RE = /寵物名稱:([^\n]+)\n寵物總檔次:\s*([\d,]+)/;
for (const c of cases) {
    const m = c.reply.match(PET_LINE_RE);
    if (!m) continue;
    const name = m[1].trim();
    const bps = m[2].split(',').map(n => parseInt(n, 10));
    if (bps.length !== 5 || bps.some(Number.isNaN)) continue;
    if (knownNames.has(name)) continue;
    if (!discovered.has(name)) discovered.set(name, bps);
}
console.log(`discovered ${discovered.size} extra pets from replies`);
await writeFile(PETS_OUT, JSON.stringify([...discovered.entries()].map(([n, b]) => [null, n, null, ...b, 0.2]), null, 2), 'utf8');
const augmentedPets = [
    ...PetDefaultData,
    ...[...discovered.entries()].map(([n, b]) => [null, n, null, ...b, 0.2]),
];

let subset;
if (FROM === 'recent') subset = valid.slice(-LIMIT);
else if (FROM === 'old') subset = valid.slice(0, LIMIT);
else if (FROM === 'all') subset = valid;
else subset = valid.slice(0, LIMIT);
console.log(`running ${subset.length} cases...`);

// Parse the bound lines:
//   "總掉檔: -12 , 掉檔可能解範圍: \t3 ~ 4 , 3 ~ 4 , 0 ~ 3 , 1 , 0 ~ 4"
//   "總掉檔: -15 , 定檔 : \t2 , 4 , 4 , 1 , 4"
//   "總掉檔: -9 ~ -8 , 掉檔可能解範圍: \t0 ~ 4 , 0 ~ 4 , 0 ~ 4 , 0 ~ 4 , 0 ~ 4"
const BOUND_RE = /總掉檔:\s*([^,]+?)\s*,\s*(?:定檔\s*:|掉檔可能解範圍:)\s*([^\n]+)/;

function parseRange(s) {
    s = s.trim();
    const m = s.match(/^(-?\d+)\s*~\s*(-?\d+)$/);
    if (m) return [parseInt(m[1], 10), parseInt(m[2], 10)];
    const n = parseInt(s, 10);
    if (!Number.isNaN(n)) return [n, n];
    return null;
}

function parseBounds(text) {
    const m = text.match(BOUND_RE);
    if (!m) return null;
    const lostBP = parseRange(m[1]);
    const fields = m[2].split(',').map(parseRange);
    if (!lostBP || fields.length !== 5 || fields.some(f => !f)) return null;
    return {lostBP, fields};
}

function boundsEq(a, b) {
    if (!a || !b) return false;
    if (a.lostBP[0] !== b.lostBP[0] || a.lostBP[1] !== b.lostBP[1]) return false;
    for (let i = 0; i < 5; i++) {
        if (a.fields[i][0] !== b.fields[i][0] || a.fields[i][1] !== b.fields[i][1]) return false;
    }
    return true;
}

const report = [];
let matched = 0, mismatched = 0, errored = 0, unparseable = 0, slow = 0;
let totalMs = 0, maxMs = 0;
let slowestCase = null;
const startedAt = Date.now();

for (let i = 0; i < subset.length; i++) {
    const c = subset[i];
    const t0 = performance.now();
    let actual, error;
    try {
        const results = RealGuess(augmentedPets, c.pet_name, c.lvl, ...c.stats);
        actual = GuessResultToString(results, SHOW_LIMIT, SHOW_DETAILS);
    } catch (e) {
        error = e.message;
    }
    const dt = performance.now() - t0;
    totalMs += dt;
    if (dt > maxMs) {maxMs = dt; slowestCase = c;}
    if (dt > 1000) slow++;

    if (error) {
        errored++;
        report.push({i, ts: c.ts, pet: c.pet_name, lvl: c.lvl, stats: c.stats, status: 'error', error, ms: dt});
    } else {
        const expected = parseBounds(c.reply);
        const got = parseBounds(actual);
        if (!expected || !got) {
            unparseable++;
            report.push({i, ts: c.ts, pet: c.pet_name, lvl: c.lvl, stats: c.stats, status: 'unparseable',
                expected_raw: c.reply.slice(0, 200), got_raw: actual?.slice(0, 200), ms: dt});
        } else if (boundsEq(expected, got)) {
            matched++;
        } else {
            mismatched++;
            report.push({i, ts: c.ts, pet: c.pet_name, lvl: c.lvl, stats: c.stats, status: 'mismatch',
                expected, got, ms: dt});
        }
    }

    if ((i + 1) % 100 === 0) {
        const elapsedSec = (Date.now() - startedAt) / 1000;
        const rate = (i + 1) / elapsedSec;
        const etaSec = (subset.length - i - 1) / rate;
        console.log(`  ${i+1}/${subset.length} matched=${matched} mismatch=${mismatched} unp=${unparseable} err=${errored} slow=${slow} avg=${(totalMs/(i+1)).toFixed(0)}ms eta=${(etaSec/60).toFixed(1)}min`);
        // checkpoint progress every 100 cases
        await writeFile(PROGRESS, JSON.stringify({
            done: i + 1, total: subset.length, matched, mismatched, unparseable, errored, slow,
            avgMs: totalMs / (i + 1), maxMs, etaSec,
        }), 'utf8');
    }
}

console.log(`\nDONE`);
console.log(`  matched:    ${matched}`);
console.log(`  mismatched: ${mismatched}`);
console.log(`  unparseable:${unparseable}`);
console.log(`  errored:    ${errored}`);
console.log(`  slow (>1s): ${slow}`);
console.log(`  avg:        ${(totalMs/subset.length).toFixed(1)}ms`);
console.log(`  max:        ${maxMs.toFixed(0)}ms (${slowestCase?.pet_name} lvl ${slowestCase?.lvl})`);
console.log(`  total:      ${(totalMs/1000).toFixed(1)}s`);

await writeFile(OUT, JSON.stringify({
    summary: {n: subset.length, matched, mismatched, unparseable, errored, slow, totalMs, maxMs, avgMs: totalMs/subset.length},
    diffs: report,
}, null, 2), 'utf8');
console.log(`saved -> ${OUT}`);
