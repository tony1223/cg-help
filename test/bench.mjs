import {readFile, writeFile} from 'fs/promises';
import path from 'path';
import {fileURLToPath} from 'url';
import {RealGuess, GuessResultToString, PetDefaultData} from 'cg-pet-calc';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const CASES = path.join(ROOT, 'test/fixtures/cases.json');
const PETS_OUT = path.join(ROOT, 'test/fixtures/pets-discovered.json');
const BENCH_OUT = path.join(ROOT, 'test/fixtures/bench.json');
const LABEL = process.argv[2] ?? 'baseline';
const N_PER_BUCKET = parseInt(process.argv[3] ?? '20', 10);

const cases = JSON.parse(await readFile(CASES, 'utf8'));
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
    if (knownNames.has(name)) continue;
    if (!discovered.has(name)) discovered.set(name, bps);
}
const augmentedPets = [
    ...PetDefaultData,
    ...[...discovered.entries()].map(([n, b]) => [null, n, null, ...b, 0.2]),
];

// Stratify by lvl buckets: 1, 2-20, 21-50, 51-80, 81+
const buckets = {b1: [], b2_20: [], b21_50: [], b51_80: [], b81: []};
for (const c of valid) {
    if (c.lvl === 1) buckets.b1.push(c);
    else if (c.lvl <= 20) buckets.b2_20.push(c);
    else if (c.lvl <= 50) buckets.b21_50.push(c);
    else if (c.lvl <= 80) buckets.b51_80.push(c);
    else buckets.b81.push(c);
}

// deterministic sample using msg_id ordering
function sampleFrom(arr, n) {
    return arr.slice().sort((a, b) => a.msg_id.localeCompare(b.msg_id)).slice(0, n);
}

const sample = [
    ...sampleFrom(buckets.b1, N_PER_BUCKET),
    ...sampleFrom(buckets.b2_20, N_PER_BUCKET),
    ...sampleFrom(buckets.b21_50, N_PER_BUCKET),
    ...sampleFrom(buckets.b51_80, N_PER_BUCKET),
    ...sampleFrom(buckets.b81, N_PER_BUCKET),
];
console.log(`benching ${sample.length} cases (${N_PER_BUCKET} per lvl bucket)...`);

const results = [];
let totalMs = 0;
for (let i = 0; i < sample.length; i++) {
    const c = sample[i];
    // warmup-ish: do 1 calc, then time the 2nd
    try {
        RealGuess(augmentedPets, c.pet_name, c.lvl, ...c.stats);
    } catch (e) { /* swallow */ }
    const t0 = performance.now();
    try {
        const r = RealGuess(augmentedPets, c.pet_name, c.lvl, ...c.stats);
        GuessResultToString(r, 10, 100);
    } catch (e) { /* swallow */ }
    const dt = performance.now() - t0;
    totalMs += dt;
    results.push({pet: c.pet_name, lvl: c.lvl, stats: c.stats, ms: dt});
}

results.sort((a, b) => b.ms - a.ms);
const summary = {
    label: LABEL,
    n: sample.length,
    totalMs,
    avgMs: totalMs / sample.length,
    medianMs: results[Math.floor(sample.length / 2)].ms,
    p95Ms: results[Math.floor(sample.length * 0.05)].ms,
    maxMs: results[0].ms,
    slowest: results.slice(0, 5).map(r => ({pet: r.pet, lvl: r.lvl, ms: r.ms.toFixed(0)})),
};
console.log(JSON.stringify(summary, null, 2));

let prev = {};
try {prev = JSON.parse(await readFile(BENCH_OUT, 'utf8'));} catch {}
prev[LABEL] = {summary, results};
await writeFile(BENCH_OUT, JSON.stringify(prev, null, 2), 'utf8');
console.log(`saved -> ${BENCH_OUT} (label=${LABEL})`);

if (prev.baseline && LABEL !== 'baseline') {
    const a = prev.baseline.summary, b = summary;
    console.log(`\nVS BASELINE:`);
    console.log(`  total: ${a.totalMs.toFixed(0)}ms -> ${b.totalMs.toFixed(0)}ms (${(a.totalMs/b.totalMs).toFixed(2)}x)`);
    console.log(`  avg:   ${a.avgMs.toFixed(0)}ms -> ${b.avgMs.toFixed(0)}ms (${(a.avgMs/b.avgMs).toFixed(2)}x)`);
    console.log(`  p95:   ${a.p95Ms.toFixed(0)}ms -> ${b.p95Ms.toFixed(0)}ms (${(a.p95Ms/b.p95Ms).toFixed(2)}x)`);
    console.log(`  max:   ${a.maxMs.toFixed(0)}ms -> ${b.maxMs.toFixed(0)}ms (${(a.maxMs/b.maxMs).toFixed(2)}x)`);
}
