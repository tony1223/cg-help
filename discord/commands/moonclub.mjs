// 月亮俱樂部的每日對話提醒。
//
// 任務規則見 https://forum.gamer.com.tw/G2.php?bsn=2577&sn=3820 ——
// 要連續 97 天跟肯、百合、聖子、鐵虎四位公關對話，「每次對話須至少間隔 24 小時」，
// 漏掉就是整條進度卡住，所以才需要機器人盯著。
//
// 一個人可以登記多個角色，各自獨立計時。時間到了在 #月亮俱樂部同好會 @ 他，
// 附一顆 [已對話] 按鈕；按下去就把 24 小時重新起算、天數 +1。
// 逾時會每天再催一次，最多三次就停手，不會無限洗頻。

import {
    SlashCommandBuilder, ButtonBuilder, ButtonStyle,
    ActionRowBuilder, EmbedBuilder, PermissionFlagsBits,
    ModalBuilder, TextInputBuilder, TextInputStyle,
} from 'discord.js';
import {readFile, writeFile, rename, mkdir} from 'fs/promises';
import {fileURLToPath} from 'url';
import path from 'path';

const CHANNEL_ID = '1538012518264475710';   // #月亮俱樂部同好會

// 進度存在 git 工作目錄外面。這是執行期狀態，放 repo 裡的話哪天有人在伺服器上
// git clean -fdx，使用者累積幾十天的進度就一起沒了 —— 而且只有本人記得自己
// 解到第幾天，救不回來。開發機（Windows）沒有 /var/lib，退回 repo 根目錄，
// 那邊有 gitignore 擋著。
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

let dataDir = process.env.CG_DATA_DIR
    ?? (process.platform === 'win32' ? REPO_ROOT : '/var/lib/cg-help');
try {
    await mkdir(dataDir, {recursive: true});
} catch (e) {
    // 這是 top-level await，直接讓它 throw 會使整個 bot 起不來（掉檔、地圖、
    // 身分組全部陪葬）。退回 repo 根目錄至少功能還能動，但要吼出來，
    // 因為那裡就是原本想避開的 git clean 風險位置。
    console.error(`[月亮] 建不出 ${dataDir}：${e.message}`);
    console.error('[月亮] 暫時改用 repo 根目錄，該處會被 git clean -fdx 清除，請盡快修正權限。');
    dataDir = REPO_ROOT;
}
const STORE_PATH = path.join(dataDir, 'moonclub.json');
const TMP_PATH = STORE_PATH + '.tmp';

const DAY = 24 * 60 * 60 * 1000;
const TZ = 8 * 60 * 60 * 1000;              // 台灣時間
const QUIET_END_HOUR = 8;                   // 深夜不提醒時，順延到早上這個鐘點
const MAX_REMINDERS = 3;                    // 逾時最多再催幾次
const MAX_CHARS = 20;                       // 一個人最多登記幾個角色
const TOTAL_DAYS = 97;
const TICK = 5 * 60 * 1000;

// 值得先提醒一聲的日子。key 是「即將進入的那一天」。
const MILESTONES = {
    2: '第 2 天：二次對話，可遇到優奈（分支）或史凱勒；職業技能也是這天換',
    3: '第 3 天：跑推薦路線（肯／百合／聖子／鐵虎，可擇一或全解）',
    6: '第 6 天：白天以外找珍妮，拿 7 日紀念招待狀 → VIP 證 →「董事長」稱號',
    14: '第 14 天：白天以外找珍妮，拿 15 日紀念招待狀 → 月之戒指',
    28: '第 28 天：白天以外找珍妮，拿 30 日紀念招待狀 → 石怪的作成方法',
    97: '第 97 天：流行手冊四冊 → LV1 優奈 +「遊手好閒的人」稱號，任務完成',
};

// ---------------------------------------------------------------- 儲存

let store = {chars: []};
let writing = Promise.resolve();

try {
    store = JSON.parse(await readFile(STORE_PATH, 'utf8'));
    if (!Array.isArray(store.chars)) store.chars = [];
} catch {
    // 檔案還不存在，用空的開始
}

// 寫入串起來排隊，避免兩個按鈕同時觸發時互相蓋掉。
// 先寫暫存檔再 rename，中途掛掉不會留下半截 JSON。
function save() {
    writing = writing.then(async () => {
        await writeFile(TMP_PATH, JSON.stringify(store, null, 2));
        await rename(TMP_PATH, STORE_PATH);
    }).catch((e) => console.error('[月亮] 寫檔失敗:', e));
    return writing;
}

let seq = 0;
const newId = () => (Date.now().toString(36) + (seq++).toString(36)).slice(-9);

// ---------------------------------------------------------------- 時間

const twDate = (ts) => new Date(ts + TZ);
const fmt = (ts) => twDate(ts).toISOString().slice(5, 16).replace('T', ' ');

function human(ms) {
    const m = Math.round(Math.abs(ms) / 60000);
    if (m < 60) return `${m} 分鐘`;
    const h = Math.floor(m / 60);
    if (h < 24) return m % 60 ? `${h} 小時 ${m % 60} 分` : `${h} 小時`;
    const d = Math.floor(h / 24);
    return h % 24 ? `${d} 天 ${h % 24} 小時` : `${d} 天`;
}

// 深夜順延：使用者沒開夜間提醒的話，落在 00:00~07:59 的提醒挪到早上 8 點。
function applyQuiet(ts, nightOk) {
    if (nightOk) return ts;
    const d = twDate(ts);
    if (d.getUTCHours() >= QUIET_END_HOUR) return ts;
    d.setUTCHours(QUIET_END_HOUR, 0, 0, 0);
    return d.getTime() - TZ;
}

const readyAt = (c) => c.lastDone + DAY;                       // 遊戲裡最早可以再對話的時間
const remindAt = (c) => applyQuiet(
    c.remindCount === 0 ? readyAt(c) : c.lastRemindAt + DAY, c.nightOk);

// ---------------------------------------------------------------- 顯示

function statusLine(c, now = Date.now()) {
    const ready = readyAt(c);
    if (c.stopped) return `⏸ 已停止提醒（逾時 ${human(now - ready)}），按 [已對話] 可恢復`;
    if (now < ready) return `⏳ 還要 ${human(ready - now)}（${fmt(ready)} 可解）`;
    if (c.remindCount === 0) return `✅ 現在就可以去解了`;
    return `⚠️ 逾時 ${human(now - ready)}，已提醒 ${c.remindCount}/${MAX_REMINDERS} 次`;
}

function describe(c, now = Date.now()) {
    const next = MILESTONES[c.day + 1];
    return [
        `**${c.name}**　第 ${c.day}/${TOTAL_DAYS} 天`,
        `　${statusLine(c, now)}`,
        `　上次對話：${fmt(c.lastDone)}`,
        next ? `　📌 ${next}` : null,
    ].filter(Boolean).join('\n');
}

const doneButton = (c) => new ButtonBuilder()
    .setCustomId(`moon:done:${c.id}`)
    .setLabel(`已對話：${c.name}`)
    .setEmoji('🌙')
    .setStyle(ButtonStyle.Success);

// Discord 一列最多 5 顆、最多 5 列
function buttonRows(chars, extra = []) {
    const btns = [...chars.slice(0, 25 - extra.length).map(doneButton), ...extra];
    const rows = [];
    for (let i = 0; i < btns.length; i += 5) {
        rows.push(new ActionRowBuilder().addComponents(btns.slice(i, i + 5)));
    }
    return rows;
}

// 剛登記的人按 [已對話] 也沒用（還沒滿 24 小時），所以改給這顆：
// 「其實我今天還沒去」，按了就把計時往回撥一天，下一輪就會提醒。
const notYetButton = (c) => new ButtonBuilder()
    .setCustomId(`moon:notyet:${c.id}`)
    .setLabel('其實今天還沒對話')
    .setStyle(ButtonStyle.Secondary);

const mine = (userId) => store.chars.filter((c) => c.userId === userId);

// 斜線指令跟面板按鈕都會走到這裡，登記規則只留一份
async function registerChar({userId, name, day = 1, justDone = true, nightOk = false}) {
    name = (name ?? '').trim();
    if (!name) return {error: '角色名稱不能空白。'};
    if (name.length > 24) return {error: '角色名稱太長了，24 字以內。'};
    if (mine(userId).some((c) => c.name.toLowerCase() === name.toLowerCase())) {
        return {error: `你已經登記過「${name}」了，要改進度用 \`/月亮 修改\`。`};
    }
    if (mine(userId).length >= MAX_CHARS) {
        return {error: `一個人最多登記 ${MAX_CHARS} 個角色。`};
    }

    const char = {
        id: newId(),
        userId,
        name,
        day,
        // 說「還沒對話」就往前推一天，下一輪 tick 立刻提醒
        lastDone: justDone ? Date.now() : Date.now() - DAY,
        lastRemindAt: 0,
        remindCount: 0,
        nightOk,
        stopped: false,
        createdAt: Date.now(),
    };
    store.chars.push(char);
    await save();
    return {char};
}

const registeredReply = (c, justDone) => ({
    content: `已登記 🌙\n\n${describe(c)}\n\n提醒會發在 <#${CHANNEL_ID}>。`,
    components: justDone
        ? [new ActionRowBuilder().addComponents(notYetButton(c))]
        : buttonRows([c]),
});

// 名字可以只打縮寫：先找完全相同，再找開頭相符，最後找有包含的
function match(userId, query) {
    const list = mine(userId);
    const q = query.trim().toLowerCase();
    const exact = list.filter((c) => c.name.toLowerCase() === q);
    if (exact.length) return exact;
    const prefix = list.filter((c) => c.name.toLowerCase().startsWith(q));
    if (prefix.length) return prefix;
    return list.filter((c) => c.name.toLowerCase().includes(q));
}

// ---------------------------------------------------------------- 指令

const MoonClubCommand = {
    data: new SlashCommandBuilder()
        .setName('月亮')
        .setDescription('月亮俱樂部每日對話提醒')
        .addSubcommand((s) => s
            .setName('登記')
            .setDescription('登記一個角色，每 24 小時提醒你去跟公關對話')
            .addStringOption((o) => o
                .setName('角色').setDescription('角色名稱，打縮寫也可以').setRequired(true))
            .addIntegerOption((o) => o
                .setName('進度').setDescription(`目前第幾天（1~${TOTAL_DAYS}，預設 1）`)
                .setMinValue(1).setMaxValue(TOTAL_DAYS))
            .addBooleanOption((o) => o
                .setName('剛對話過').setDescription('預設是。選否表示現在就該去解了'))
            .addBooleanOption((o) => o
                .setName('夜間提醒').setDescription('預設否，凌晨 0~8 點的提醒會順延到早上 8 點')))
        .addSubcommand((s) => s
            .setName('查詢')
            .setDescription('列出自己登記中的角色'))
        .addSubcommand((s) => s
            .setName('修改')
            .setDescription('改天數或夜間提醒設定')
            .addStringOption((o) => o
                .setName('角色').setDescription('角色名稱或縮寫').setRequired(true))
            .addIntegerOption((o) => o
                .setName('進度').setDescription(`改成第幾天（1~${TOTAL_DAYS}）`)
                .setMinValue(1).setMaxValue(TOTAL_DAYS))
            .addBooleanOption((o) => o
                .setName('夜間提醒').setDescription('凌晨 0~8 點要不要提醒')))
        .addSubcommand((s) => s
            .setName('取消')
            .setDescription('取消登記')
            .addStringOption((o) => o
                .setName('角色').setDescription('角色名稱或縮寫').setRequired(true)))
        .addSubcommand((s) => s
            .setName('面板')
            .setDescription('（管理員）在頻道張貼常駐的查詢面板')),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const uid = interaction.user.id;

        if (sub === '面板') return panel(interaction);

        await interaction.deferReply({ephemeral: true});

        if (sub === '登記') {
            const justDone = interaction.options.getBoolean('剛對話過') ?? true;
            const {char, error} = await registerChar({
                userId: uid,
                name: interaction.options.getString('角色'),
                day: interaction.options.getInteger('進度') ?? 1,
                justDone,
                nightOk: interaction.options.getBoolean('夜間提醒') ?? false,
            });
            if (error) return interaction.editReply(error);
            return interaction.editReply(registeredReply(char, justDone));
        }

        if (sub === '查詢') {
            const list = mine(uid);
            if (!list.length) {
                return interaction.editReply('你還沒登記任何角色，用 `/月亮 登記` 開始。');
            }
            const now = Date.now();
            const sorted = [...list].sort((a, b) => readyAt(a) - readyAt(b));
            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle(`🌙 你的月亮俱樂部進度（${list.length} 個角色）`)
                    .setDescription(sorted.map((c) => describe(c, now)).join('\n\n'))
                    .setColor(0x5865F2)],
                components: buttonRows(sorted.filter((c) => now >= readyAt(c))),
            });
        }

        if (sub === '修改') {
            const found = match(uid, interaction.options.getString('角色'));
            if (found.length !== 1) return interaction.editReply(ambiguous(found));
            const c = found[0];
            const day = interaction.options.getInteger('進度');
            const night = interaction.options.getBoolean('夜間提醒');
            if (day === null && night === null) {
                return interaction.editReply('沒有指定要改什麼。');
            }
            if (day !== null) c.day = day;
            if (night !== null) c.nightOk = night;
            await save();
            return interaction.editReply(`已更新\n\n${describe(c)}`);
        }

        if (sub === '取消') {
            const found = match(uid, interaction.options.getString('角色'));
            if (found.length !== 1) return interaction.editReply(ambiguous(found));
            store.chars = store.chars.filter((c) => c.id !== found[0].id);
            await save();
            return interaction.editReply(`已取消登記「${found[0].name}」，不會再提醒。`);
        }
    },

    async handleButtonInteraction(interaction) {
        const id = interaction.customId;
        if (!id.startsWith('moon:')) return;

        // 面板上的「開始參加」：跳表單問角色名稱。
        // showModal 必須是這次互動的第一個回應，前面不能 defer。
        if (id === 'moon:join') {
            return interaction.showModal(new ModalBuilder()
                .setCustomId('moon:join')
                .setTitle('參加月亮俱樂部')
                .addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder()
                        .setCustomId('name')
                        .setLabel('角色名稱')
                        .setPlaceholder('打縮寫也可以，之後提醒會顯示這個名字')
                        .setStyle(TextInputStyle.Short)
                        .setMaxLength(24)
                        .setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder()
                        .setCustomId('day')
                        .setLabel(`目前解到第幾天？（留空當作第 1 天）`)
                        .setPlaceholder('1')
                        .setStyle(TextInputStyle.Short)
                        .setMaxLength(3)
                        .setRequired(false)),
                ));
        }

        if (id.startsWith('moon:notyet:')) {
            const c = store.chars.find((x) => x.id === id.slice(12));
            if (!c) {
                return interaction.reply({content: '找不到這個登記。', ephemeral: true});
            }
            if (c.userId !== interaction.user.id) {
                return interaction.reply({content: '這不是你登記的角色。', ephemeral: true});
            }
            c.lastDone = Date.now() - DAY;
            c.lastRemindAt = 0;
            c.remindCount = 0;
            c.stopped = false;
            await save();
            return interaction.reply({
                content: `好，改成現在就該去解。\n\n${describe(c)}`,
                ephemeral: true,
            });
        }

        if (id === 'moon:mine') {
            const list = mine(interaction.user.id);
            if (!list.length) {
                return interaction.reply({
                    content: '你還沒登記任何角色，用 `/月亮 登記` 開始。', ephemeral: true,
                });
            }
            const now = Date.now();
            const sorted = [...list].sort((a, b) => readyAt(a) - readyAt(b));
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle(`🌙 你的月亮俱樂部進度（${list.length} 個角色）`)
                    .setDescription(sorted.map((c) => describe(c, now)).join('\n\n'))
                    .setColor(0x5865F2)],
                components: buttonRows(sorted.filter((c) => now >= readyAt(c))),
                ephemeral: true,
            });
        }

        if (id.startsWith('moon:done:')) {
            const c = store.chars.find((x) => x.id === id.slice(10));
            if (!c) {
                return interaction.reply({content: '找不到這個登記，可能已經取消了。', ephemeral: true});
            }
            // 提醒是公開發在頻道的，別人也看得到按鈕，擋一下
            if (c.userId !== interaction.user.id) {
                return interaction.reply({content: '這不是你登記的角色。', ephemeral: true});
            }

            const early = Date.now() < readyAt(c);
            if (early && !c.stopped) {
                return interaction.reply({
                    content: `「${c.name}」還沒滿 24 小時，再等 ${human(readyAt(c) - Date.now())}。\n`
                        + '遊戲規定每次對話至少間隔 24 小時，太早去會白跑一趟。',
                    ephemeral: true,
                });
            }

            c.day = Math.min(c.day + 1, TOTAL_DAYS);
            c.lastDone = Date.now();
            c.lastRemindAt = 0;
            c.remindCount = 0;
            c.stopped = false;
            await save();

            const done = c.day >= TOTAL_DAYS;
            return interaction.reply({
                content: done
                    ? `🎉 **${c.name}** 第 ${TOTAL_DAYS} 天，任務完成！\n`
                        + '記得拿流行手冊四冊找珍妮換 LV1 優奈跟「遊手好閒的人」稱號。\n'
                        + '不需要再提醒的話用 `/月亮 取消`。'
                    : `🌙 記錄好了\n\n${describe(c)}`,
                ephemeral: true,
            });
        }
    },

    async handleModalSubmit(interaction) {
        if (interaction.customId !== 'moon:join') return;

        const raw = (interaction.fields.getTextInputValue('day') ?? '').trim();
        const day = raw === '' ? 1 : Number(raw);
        if (!Number.isInteger(day) || day < 1 || day > TOTAL_DAYS) {
            return interaction.reply({
                content: `「${raw}」不是有效的天數，請填 1~${TOTAL_DAYS} 的整數（或留空）。`,
                ephemeral: true,
            });
        }

        const {char, error} = await registerChar({
            userId: interaction.user.id,
            name: interaction.fields.getTextInputValue('name'),
            day,
        });
        if (error) return interaction.reply({content: error, ephemeral: true});
        return interaction.reply({...registeredReply(char, true), ephemeral: true});
    },
};

const ambiguous = (found) => found.length === 0
    ? '找不到這個角色，用 `/月亮 查詢` 看看你登記了哪些。'
    : `符合的角色有好幾個：${found.map((c) => c.name).join('、')}。請打完整一點。`;

async function panel(interaction) {
    const allowed = interaction.member?.permissions?.has(PermissionFlagsBits.ManageMessages);
    if (!allowed) {
        return interaction.reply({content: '這個指令只有管理員能用。', ephemeral: true});
    }
    const channel = await interaction.client.channels.fetch(CHANNEL_ID);
    await channel.send({
        embeds: [new EmbedBuilder()
            .setTitle('🌙 月亮俱樂部 每日對話提醒')
            .setDescription([
                '任務要連續 97 天跟肯、百合、聖子、鐵虎四位公關對話，',
                '**每次對話至少間隔 24 小時**，漏掉進度就卡住。',
                '',
                '按 **[開始參加]** 填角色名稱就開始追蹤，一個人可以登記多個角色。',
                `時間到會在這個頻道 @ 你，按 [已對話] 重新計時。`,
                `逾時會每天再催一次，最多 ${MAX_REMINDERS} 次就停。`,
                '',
                '也可以用指令：`/月亮 登記`、`/月亮 查詢`、`/月亮 修改`、`/月亮 取消`',
            ].join('\n'))
            .setColor(0x5865F2)],
        components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('moon:join')
                .setLabel('開始參加').setEmoji('🌙').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('moon:mine')
                .setLabel('我的角色').setStyle(ButtonStyle.Primary))],
    });
    return interaction.reply({content: `已張貼面板到 <#${CHANNEL_ID}>。`, ephemeral: true});
}

// ---------------------------------------------------------------- 排程

async function tick(client) {
    const now = Date.now();
    const due = store.chars.filter((c) => !c.stopped && now >= remindAt(c));
    if (!due.length) return;

    let channel;
    try {
        channel = await client.channels.fetch(CHANNEL_ID);
    } catch (e) {
        console.error('[月亮] 抓不到頻道，這輪跳過:', e.message);
        return;
    }

    // 同一個人多個角色到期就併成一則，不要連續 tag 好幾次
    const byUser = new Map();
    for (const c of due) {
        if (!byUser.has(c.userId)) byUser.set(c.userId, []);
        byUser.get(c.userId).push(c);
    }

    for (const [userId, chars] of byUser) {
        chars.sort((a, b) => readyAt(a) - readyAt(b));
        try {
            await channel.send({
                content: `<@${userId}> 🌙 月亮俱樂部該去對話了`,
                embeds: [new EmbedBuilder()
                    .setDescription(chars.map((c) => describe(c, now)).join('\n\n'))
                    .setFooter({text: '解完按下方按鈕重新計時'})
                    .setColor(0xFEE75C)],
                components: buttonRows(chars),
            });
        } catch (e) {
            console.error(`[月亮] 提醒 ${userId} 失敗:`, e.message);
            continue;   // 沒發出去就不要記次數，下輪再試
        }

        for (const c of chars) {
            c.remindCount++;
            c.lastRemindAt = now;
            if (c.remindCount >= MAX_REMINDERS) {
                c.stopped = true;
                console.log(`[月亮] ${c.name} 逾時 ${MAX_REMINDERS} 次，停止提醒`);
            }
        }
    }
    await save();
}

function startMoonClubReminder(client) {
    const run = () => tick(client).catch((e) => console.error('[月亮] tick 出錯:', e));
    run();
    setInterval(run, TICK);
    console.log(`[月亮] 提醒排程啟動，${store.chars.length} 個角色追蹤中`);
}

// tick 另外匯出給 test/moonclub.mjs 用 —— 測試要能單步推進，
// 不能真的掛上 setInterval。
export {MoonClubCommand, startMoonClubReminder, tick as moonClubTick};
