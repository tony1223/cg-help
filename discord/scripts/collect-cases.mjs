import {Client, GatewayIntentBits} from 'discord.js';
import {readFile, writeFile, mkdir} from 'fs/promises';
import {existsSync} from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const TARGET_CHANNEL = '1091664168039493673';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUTPUT_PATH = path.join(ROOT, 'test/fixtures/raw-messages.json');

const HARD_LIMIT = parseInt(process.argv[2] ?? '0', 10) || Infinity;

const config = JSON.parse(
    await readFile(path.join(ROOT, 'config.json'), 'utf8')
);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    let exitCode = 0;
    try {
        const channel = await client.channels.fetch(TARGET_CHANNEL);
        if (!channel) throw new Error(`Channel ${TARGET_CHANNEL} not found / no access`);
        console.log(`Channel: #${channel.name} (${channel.id})`);

        const all = [];
        let before;
        let batch = 0;

        while (all.length < HARD_LIMIT) {
            const messages = await channel.messages.fetch({limit: 100, before});
            if (messages.size === 0) break;

            for (const m of messages.values()) {
                all.push({
                    id: m.id,
                    ts: m.createdTimestamp,
                    author_id: m.author.id,
                    author_name: m.author.username,
                    author_bot: m.author.bot,
                    content: m.content,
                    reference_id: m.reference?.messageId ?? null,
                });
            }

            const last = messages.last();
            before = last.id;
            batch++;
            console.log(`  batch ${batch}: +${messages.size}, total ${all.length}, oldest=${new Date(last.createdTimestamp).toISOString()}`);

            if (messages.size < 100) break;
        }

        all.sort((a, b) => a.ts - b.ts);

        const outDir = path.dirname(OUTPUT_PATH);
        if (!existsSync(outDir)) await mkdir(outDir, {recursive: true});
        await writeFile(OUTPUT_PATH, JSON.stringify(all, null, 2), 'utf8');
        console.log(`saved ${all.length} messages -> ${OUTPUT_PATH}`);
    } catch (err) {
        console.error('error:', err);
        exitCode = 1;
    } finally {
        await client.destroy();
        process.exit(exitCode);
    }
});

client.on('error', (e) => console.error('client error:', e));

await client.login(config.discord);
