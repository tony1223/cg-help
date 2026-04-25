import {readFile, writeFile} from 'fs/promises';
import path from 'path';
import {fileURLToPath} from 'url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const RAW = path.join(ROOT, 'test/fixtures/raw-messages.json');
const OUT = path.join(ROOT, 'test/fixtures/cases.json');
const SUMMARY = path.join(ROOT, 'test/fixtures/cases-summary.txt');

const CMD_RE = /^\/?(算檔|算黨|掉檔|掉黨)\s+(.+)$/;
const PAIR_WINDOW_MS = 60_000;
const FOOTER_MARK = '指令: /掉檔';

const raw = JSON.parse(await readFile(RAW, 'utf8'));
console.log(`loaded ${raw.length} raw messages`);

const cases = [];
const skipped = {no_match: 0, no_reply: 0, bad_tokens: 0, bot_msg: 0, footer: 0};

for (let i = 0; i < raw.length; i++) {
    const msg = raw[i];
    if (msg.author_bot) {skipped.bot_msg++; continue;}

    const m = msg.content.match(CMD_RE);
    if (!m) {skipped.no_match++; continue;}

    const cmd = m[1];
    const rest = m[2].trim();
    const tokens = rest.split(/\s+/);

    let petName, lvl, stats;
    if (tokens.length === 6) {
        petName = tokens[0];
        lvl = 1;
        stats = tokens.slice(1).map(t => parseInt(t, 10));
    } else if (tokens.length === 7) {
        petName = tokens[0];
        lvl = parseInt(tokens[1], 10);
        stats = tokens.slice(2).map(t => parseInt(t, 10));
    } else {
        skipped.bad_tokens++;
        continue;
    }
    if (stats.some(n => Number.isNaN(n)) || Number.isNaN(lvl)) {
        skipped.bad_tokens++;
        continue;
    }

    let reply = null;
    for (let j = i + 1; j < raw.length; j++) {
        const r = raw[j];
        if (r.ts - msg.ts > PAIR_WINDOW_MS) break;
        if (!r.author_bot) break;  // next user msg arrived before bot replied -> no pair
        if (r.content.startsWith(FOOTER_MARK) || r.content.startsWith('==\n 指令:')) continue;
        reply = r;
        break;
    }
    if (!reply) {skipped.no_reply++; continue;}

    cases.push({
        msg_id: msg.id,
        ts: msg.ts,
        cmd,
        raw_input: msg.content,
        pet_name: petName,
        lvl,
        stats,
        reply: reply.content,
    });
}

console.log(`paired cases: ${cases.length}`);
console.log(`skipped:`, skipped);

const seen = new Set();
const dedup = [];
for (const c of cases) {
    const key = `${c.pet_name}|${c.lvl}|${c.stats.join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push(c);
}
console.log(`after dedup by (pet,lvl,stats): ${dedup.length}`);

const notFound = dedup.filter(c => c.reply.includes('查無符合寵物'));
const noSolution = dedup.filter(c => c.reply.includes('無解'));
const truncated = dedup.filter(c => c.reply.includes('不顯示詳細結果'));
const detailed = dedup.filter(c => c.reply.includes('===詳細情形==='));
console.log(`  pet-not-found: ${notFound.length}`);
console.log(`  no-solution: ${noSolution.length}`);
console.log(`  truncated (too many results): ${truncated.length}`);
console.log(`  with detail table: ${detailed.length}`);

const petCounts = {};
for (const c of dedup) petCounts[c.pet_name] = (petCounts[c.pet_name] || 0) + 1;
const topPets = Object.entries(petCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);

await writeFile(OUT, JSON.stringify(dedup, null, 2), 'utf8');
const summary = [
    `total cases: ${dedup.length}`,
    `pet-not-found: ${notFound.length}`,
    `no-solution: ${noSolution.length}`,
    `truncated: ${truncated.length}`,
    `with detail: ${detailed.length}`,
    '',
    'top 20 pets:',
    ...topPets.map(([n, c]) => `  ${c}\t${n}`),
].join('\n');
await writeFile(SUMMARY, summary, 'utf8');
console.log(`saved -> ${OUT}`);
console.log(`saved -> ${SUMMARY}`);
