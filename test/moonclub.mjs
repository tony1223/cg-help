// 月亮俱樂部提醒的邏輯測試。
//
//   node --test test/moonclub.mjs
//
// 用假的 interaction / client 驅動真正的 execute() 與 handleButtonInteraction()，
// 不連 Discord。時間靠覆寫 Date.now() 推進 —— 24 小時門檻、深夜順延、
// 催三次就停這些規則光看程式碼很難確定，一定要跑過。
//
// 資料目錄用 CG_DATA_DIR 指到暫存區，完全碰不到正式的 moonclub.json。
// 必須在 import 模組「之前」設好 —— 模組載入時就會決定路徑並讀檔。

import {test, after, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, rm} from 'fs/promises';
import {tmpdir} from 'os';
import path from 'path';

const DATA_DIR = await mkdtemp(path.join(tmpdir(), 'moonclub-test-'));
process.env.CG_DATA_DIR = DATA_DIR;

const {MoonClubCommand, moonClubTick, gamePeriod, npcsAt} =
    await import('../discord/commands/moonclub.mjs');

const STORE = path.join(DATA_DIR, 'moonclub.json');
const realNow = Date.now;

after(async () => {
    Date.now = realNow;
    await rm(DATA_DIR, {recursive: true, force: true});
});

// ---------------------------------------------------------------- 工具

const TW = (s) => Date.parse(s + '+08:00');
const HOUR = 3600_000;
const DAY = 24 * HOUR;

let NOW = TW('2026-08-15T12:00:00');
Date.now = () => NOW;
const advance = (ms) => { NOW += ms; };
const setClock = (s) => { NOW = TW(s); };

const sent = [];
const fakeChannel = {send: async (m) => { sent.push(m); return m; }};
const fakeClient = {channels: {fetch: async () => fakeChannel}};

function makeInteraction({sub, opts = {}, userId = 'U1', customId = null, fields = null} = {}) {
    const replies = [];
    const modals = [];
    return {
        replies,
        modals,
        i: {
            user: {id: userId},
            customId,
            member: {permissions: {has: () => true}},
            client: fakeClient,
            options: {
                getSubcommand: () => sub,
                getString: (k) => opts[k] ?? null,
                getInteger: (k) => (k in opts ? opts[k] : null),
                getBoolean: (k) => (k in opts ? opts[k] : null),
            },
            fields: {getTextInputValue: (k) => fields?.[k] ?? ''},
            showModal: async (m) => { modals.push(m); return m; },
            deferReply: async () => {},
            editReply: async (r) => { replies.push(r); return r; },
            reply: async (r) => { replies.push(r); return r; },
        },
    };
}

async function run(args) {
    const {i, replies} = makeInteraction(args);
    await MoonClubCommand.execute(i);
    return replies[replies.length - 1];
}

async function click(customId, userId = 'U1') {
    const {i, replies} = makeInteraction({customId, userId});
    await MoonClubCommand.handleButtonInteraction(i);
    return replies[replies.length - 1];
}

// 回傳被叫出來的 modal（沒有就是 undefined）
async function clickForModal(customId, userId = 'U1') {
    const {i, modals} = makeInteraction({customId, userId});
    await MoonClubCommand.handleButtonInteraction(i);
    return modals[0]?.toJSON?.() ?? modals[0];
}

async function submitModal(fields, userId = 'U1', customId = 'moon:join') {
    const {i, replies} = makeInteraction({customId, userId, fields});
    await MoonClubCommand.handleModalSubmit(i);
    return replies[replies.length - 1];
}

// reply 可能是字串或 {content, embeds}，統一攤成文字好比對
function text(r) {
    if (!r) return '';
    if (typeof r === 'string') return r;
    const emb = (r.embeds ?? []).map((e) => {
        const d = e.data ?? e;
        return [d.title, d.description].filter(Boolean).join('\n');
    });
    return [r.content, ...emb].filter(Boolean).join('\n');
}

const buttonIds = (r) => (r?.components ?? [])
    .flatMap((row) => (row.components ?? []).map((b) => (b.data ?? b).custom_id));

const store = async () => JSON.parse(await readFile(STORE, 'utf8'));
const find = async (name) => (await store()).chars.find((c) => c.name === name);

// 前面測試留下的角色會隨時鐘推進一起到期，所以計數一律限定在自己的使用者，
// 順便讓「多人同時到期」變成每個 test 的預設情境。
const sentFor = (userId) => sent.filter((m) => m.content?.includes(`<@${userId}>`));

// 每個 test 各自用不重複的角色名，避免互相干擾
let nameSeq = 0;
const uniq = () => `角色${++nameSeq}`;

beforeEach(() => { sent.length = 0; });

// ---------------------------------------------------------------- 登記

test('登記後建立角色，預設從第 1 天、24 小時後才可解', async () => {
    setClock('2026-08-15T12:00:00');
    const name = uniq();
    const r = await run({sub: '登記', opts: {角色: name}});
    assert.match(text(r), /已登記/);
    assert.match(text(r), new RegExp(`${name}.*第 1/97 天`));
    assert.match(text(r), /還要 1 天/);

    const c = (await store()).chars.find((x) => x.name === name);
    assert.equal(c.day, 1);
    assert.equal(c.remindCount, 0);
    assert.equal(c.stopped, false);
    assert.equal(c.lastDone, NOW);
});

test('登記時選「剛對話過:否」→ 立刻就該去解', async () => {
    const name = uniq();
    const r = await run({sub: '登記', opts: {角色: name, 剛對話過: false}});
    assert.match(text(r), /現在就可以去解了/);
});

test('登記可指定進度，並提示下一個里程碑', async () => {
    const name = uniq();
    const r = await run({sub: '登記', opts: {角色: name, 進度: 13}});
    assert.match(text(r), /第 13\/97 天/);
    assert.match(text(r), /第 14 天.*月之戒指/);
});

test('同一人不能重複登記同名角色', async () => {
    const name = uniq();
    await run({sub: '登記', opts: {角色: name}});
    const r = await run({sub: '登記', opts: {角色: name}});
    assert.match(text(r), /已經登記過/);
});

test('不同人可以各自登記同名角色', async () => {
    const name = uniq();
    await run({sub: '登記', opts: {角色: name}, userId: 'UA'});
    const r = await run({sub: '登記', opts: {角色: name}, userId: 'UB'});
    assert.match(text(r), /已登記/);
});

// ---------------------------------------------------------------- 面板：開始參加

test('[開始參加] 會跳出填角色名稱的表單', async () => {
    const m = await clickForModal('moon:join', 'UJ1');
    assert.equal(m.custom_id, 'moon:join');
    const inputs = m.components.flatMap((r) => r.components.map((c) => c.custom_id));
    assert.deepEqual(inputs, ['name', 'day']);
    const name = m.components[0].components[0];
    assert.equal(name.required, true);
    assert.equal(m.components[1].components[0].required, false, '天數可以留空');
});

test('表單送出就完成登記，天數留空當作第 1 天', async () => {
    setClock('2026-08-15T12:00:00');
    const r = await submitModal({name: '表單角色', day: ''}, 'UJ2');
    assert.match(text(r), /已登記/);
    assert.equal(r.ephemeral, true, '登記結果只給本人看');
    const c = await find('表單角色');
    assert.equal(c.day, 1);
    assert.equal(c.userId, 'UJ2');
    assert.equal(c.lastDone, NOW, '預設當作剛對話過');
});

test('表單可以指定天數', async () => {
    const r = await submitModal({name: '表單角色2', day: '27'}, 'UJ3');
    assert.match(text(r), /第 27\/97 天/);
    assert.match(text(r), /第 28 天.*石怪/);
});

test('表單天數亂填會被擋，且不建立角色', async () => {
    for (const bad of ['abc', '0', '-3', '98', '3.5']) {
        const r = await submitModal({name: `壞天數${bad}`, day: bad}, 'UJ4');
        assert.match(text(r), /不是有效的天數/, `「${bad}」應該被擋`);
        assert.equal(await find(`壞天數${bad}`), undefined, `「${bad}」不該留下資料`);
    }
});

test('表單登記重複名字會被擋', async () => {
    await submitModal({name: '重複仔', day: ''}, 'UJ5');
    const r = await submitModal({name: '重複仔', day: ''}, 'UJ5');
    assert.match(text(r), /已經登記過/);
});

test('剛登記完可以按 [其實今天還沒對話] 改成立刻提醒', async () => {
    setClock('2026-08-15T12:00:00');
    const r = await submitModal({name: '還沒去的人', day: ''}, 'UJ6');
    assert.match(text(r), /還要 1 天/);

    // 登記結果附的按鈕就是這顆
    const ids = buttonIds(r);
    assert.equal(ids.length, 1);
    assert.match(ids[0], /^moon:notyet:/);

    const after = await click(ids[0], 'UJ6');
    assert.match(text(after), /現在就可以去解了/);
    assert.equal((await find('還沒去的人')).lastDone, NOW - DAY);

    await moonClubTick(fakeClient);
    assert.equal(sentFor('UJ6').length, 1, '改完下一輪就該提醒');
});

test('[其實今天還沒對話] 別人按不動', async () => {
    await submitModal({name: '別人的角色', day: ''}, 'UJ7');
    const c = await find('別人的角色');
    const r = await click(`moon:notyet:${c.id}`, 'UJ8');
    assert.match(text(r), /不是你登記的角色/);
});

// ---------------------------------------------------------------- 24 小時門檻

test('不滿 24 小時按 [已對話] 會被擋下，天數不變', async () => {
    setClock('2026-08-15T12:00:00');
    const name = uniq();
    await run({sub: '登記', opts: {角色: name}});
    const c = (await store()).chars.find((x) => x.name === name);

    advance(23 * HOUR);
    const r = await click(`moon:done:${c.id}`);
    assert.match(text(r), /還沒滿 24 小時/);
    assert.match(text(r), /再等 1 小時/);

    const after = (await store()).chars.find((x) => x.name === name);
    assert.equal(after.day, 1, '被擋下時天數不該增加');
});

test('滿 24 小時後按 [已對話] → 天數 +1、重新計時', async () => {
    setClock('2026-08-15T12:00:00');
    const name = uniq();
    await run({sub: '登記', opts: {角色: name, 進度: 5}});
    const c = (await store()).chars.find((x) => x.name === name);

    advance(DAY);
    const r = await click(`moon:done:${c.id}`);
    assert.match(text(r), /第 6\/97 天/);

    const after = (await store()).chars.find((x) => x.name === name);
    assert.equal(after.day, 6);
    assert.equal(after.lastDone, NOW);
    assert.equal(after.remindCount, 0);
});

test('別人的角色按不動', async () => {
    const name = uniq();
    await run({sub: '登記', opts: {角色: name}, userId: 'UA'});
    const c = (await store()).chars.find((x) => x.name === name);
    const r = await click(`moon:done:${c.id}`, 'UB');
    assert.match(text(r), /不是你登記的角色/);
});

test('已取消的登記按下去不會炸', async () => {
    const r = await click('moon:done:nonexistent');
    assert.match(text(r), /找不到這個登記/);
});

// ---------------------------------------------------------------- 遊戲內時段
//
// 這一組是整支程式最不能猜的部分：報錯時段會叫人去找一個不在的 NPC，
// 白跑一趟就是斷一天，97 天重來。對照表出自攻略站 魔力豆知識。

const periodAt = (s) => gamePeriod(TW(s));
const clockOf = (ts) => new Date(ts + 8 * HOUR).toISOString().slice(11, 16);
const ALL_NPC = ['肯', '百合', '聖子', '鐵虎'];

test('時段邊界：白天偶 02~46、黃昏偶 47~奇 01、晚上奇 02~46、清晨奇 47~偶 01', () => {
    const cases = [
        ['12:02', '白天'], ['12:30', '白天'], ['12:46', '白天'],
        ['12:47', '黃昏'], ['13:00', '黃昏'], ['13:01', '黃昏'],
        ['13:02', '晚上'], ['13:30', '晚上'], ['13:46', '晚上'],
        ['13:47', '清晨'], ['14:00', '清晨'], ['14:01', '清晨'],
        ['14:02', '白天'],
    ];
    for (const [hm, want] of cases) {
        assert.equal(periodAt(`2026-08-15T${hm}:00`).name, want, `${hm} 應該是${want}`);
    }
});

test('四段剛好鋪滿兩小時，沒有縫也沒有重疊', () => {
    const count = {};
    for (let m = 0; m < 120; m++) {
        const p = gamePeriod(TW('2026-08-15T12:00:00') + m * 60000);
        count[p.name] = (count[p.name] ?? 0) + 1;
    }
    // 白天／晚上各 45 分，黃昏／清晨各 15 分 —— 四段「不等長」是這套的重點
    assert.deepEqual(count, {白天: 45, 黃昏: 15, 晚上: 45, 清晨: 15});
});

test('算得出這一段何時結束、下一段是什麼', () => {
    const p = periodAt('2026-08-15T12:30:00');
    assert.equal(p.name, '白天');
    assert.equal(clockOf(p.endsAt), '12:47');
    assert.equal(p.next.name, '黃昏');

    // 清晨跨過整點，結束時間會落在下一個偶數小時
    const dawn = periodAt('2026-08-15T13:50:00');
    assert.equal(dawn.name, '清晨');
    assert.equal(clockOf(dawn.endsAt), '14:02');
    assert.equal(dawn.next.name, '白天');
});

test('對得上巴哈那篇的實例（17:15 是晚上、聖子要等清晨、鐵虎要等白天）', () => {
    // https://forum.gamer.com.tw/G2.php?bsn=2577&sn=10057
    // 該篇把 :47 口語講成 :45，時段判定以攻略站的對照表為準
    assert.equal(periodAt('2026-08-15T17:15:00').name, '晚上');
    assert.ok(!npcsAt('晚上').includes('聖子'), '晚上聖子不理人，這是該篇的前提');

    assert.equal(periodAt('2026-08-15T17:47:00').name, '清晨');
    assert.ok(npcsAt('清晨').includes('聖子'), '清晨才找得到聖子');

    assert.equal(periodAt('2026-08-15T18:02:00').name, '白天');
    assert.ok(npcsAt('白天').includes('鐵虎'), '換到白天鐵虎就補上了');
});

test('任何時段都剛好三個人在，四個人各缺席一段', () => {
    for (const name of ['白天', '黃昏', '晚上', '清晨']) {
        assert.equal(npcsAt(name).length, 3, `${name} 應該剛好三個人可對話`);
    }
    const absent = ['白天', '黃昏', '晚上', '清晨']
        .map((n) => ALL_NPC.find((x) => !npcsAt(n).includes(x)));
    assert.deepEqual([...absent].sort(), [...ALL_NPC].sort(), '每個人該剛好缺席一段');
});

test('「缺的那位下一段就找得到」—— 提醒是這樣寫的，那就得是真的', () => {
    for (let m = 0; m < 120; m++) {
        const p = gamePeriod(TW('2026-08-15T12:00:00') + m * 60000);
        const missing = ALL_NPC.find((x) => !npcsAt(p.name).includes(x));
        assert.ok(npcsAt(p.next.name).includes(missing),
            `${p.name} 缺 ${missing}，但下一段 ${p.next.name} 也沒有他`);
    }
});

test('提醒會附上現在能找誰、缺的那位幾點補上', async () => {
    setClock('2026-08-15T12:30:00');            // 白天
    const name = uniq();
    await run({sub: '登記', opts: {角色: name, 剛對話過: false}, userId: 'UT1'});

    sent.length = 0;
    await moonClubTick(fakeClient);

    const body = text(sentFor('UT1')[0]);
    assert.match(body, /現在是 \*\*白天\*\*（到 12:47）/);
    assert.match(body, /可找 百合、聖子、鐵虎/);
    assert.match(body, /肯不在，12:47 進入 \*\*黃昏\*\* 後就找得到/);
});

test('提醒落在不同時段就換一組人', async () => {
    setClock('2026-08-15T13:30:00');            // 晚上
    const name = uniq();
    await run({sub: '登記', opts: {角色: name, 剛對話過: false}, userId: 'UT2'});

    sent.length = 0;
    await moonClubTick(fakeClient);

    const body = text(sentFor('UT2')[0]);
    assert.match(body, /現在是 \*\*晚上\*\*（到 13:47）/);
    assert.match(body, /可找 肯、百合、鐵虎/);
    assert.match(body, /聖子不在，13:47 進入 \*\*清晨\*\* 後就找得到/);
});

// ---------------------------------------------------------------- 報到訊息

test('報到後在頻道公開留一則，讓大家知道他還在跑', async () => {
    setClock('2026-08-15T12:00:00');
    const name = uniq();
    await run({sub: '登記', opts: {角色: name, 進度: 5}, userId: 'UCI1'});
    const c = await find(name);

    advance(DAY);
    sent.length = 0;
    const r = await click(`moon:done:${c.id}`, 'UCI1');

    // 給本人的細節仍然是暗的，只有他自己看得到
    assert.equal(r.ephemeral, true);

    const [msg, ...rest] = sentFor('UCI1');
    assert.ok(msg, '頻道上沒有留下報到訊息 —— 這樣看起來就像沒人回應提醒');
    assert.equal(rest.length, 0, '一次報到只該發一則');
    assert.match(msg.content, new RegExp(`${name}.*第 6/97 天`));
    assert.match(msg.content, /報到/);
});

test('報到訊息不 ping 當事人 —— 他剛按完按鈕，不用再戳一次', async () => {
    const name = uniq();
    await run({sub: '登記', opts: {角色: name}, userId: 'UCI2'});
    const c = await find(name);

    advance(DAY);
    sent.length = 0;
    await click(`moon:done:${c.id}`, 'UCI2');

    const [msg] = sentFor('UCI2');
    assert.deepEqual(msg.allowedMentions, {parse: []},
        '沒關掉 mention 的話每天報到都會多戳自己一下');
});

test('報到剛好踩到里程碑就順便公告今天要做什麼', async () => {
    const name = uniq();
    await run({sub: '登記', opts: {角色: name, 進度: 13}, userId: 'UCI3'});
    const c = await find(name);

    advance(DAY);
    sent.length = 0;
    await click(`moon:done:${c.id}`, 'UCI3');

    // 進到第 14 天 = MILESTONES[14]，是「今天」該做的事，不是預告
    const [msg] = sentFor('UCI3');
    assert.match(msg.content, /第 14\/97 天/);
    assert.match(msg.content, /月之戒指/);
});

test('沒解成功就沒有報到訊息 —— 擋下來的、別人按的都不算', async () => {
    const name = uniq();
    await run({sub: '登記', opts: {角色: name}, userId: 'UCI4'});
    const c = await find(name);

    sent.length = 0;
    await click(`moon:done:${c.id}`, 'UCI4');          // 不滿 24 小時，被擋
    assert.equal(sentFor('UCI4').length, 0, '被擋下來還發報到，等於幫他造假出席');

    await click(`moon:done:${c.id}`, 'UCI5');          // 不是本人
    assert.equal(sent.length, 0, '別人按了也不該掛在當事人頭上');

    await click(`moon:notyet:${c.id}`, 'UCI4');        // 「其實今天還沒對話」
    assert.equal(sentFor('UCI4').length, 0, '這是說還沒解，不是報到');
});

test('走完 97 天的那一則是公開的完成宣告', async () => {
    const name = uniq();
    await run({sub: '登記', opts: {角色: name, 進度: 96}, userId: 'UCI6'});
    const c = await find(name);

    advance(DAY);
    sent.length = 0;
    await click(`moon:done:${c.id}`, 'UCI6');

    const [msg] = sentFor('UCI6');
    assert.match(msg.content, /🎉/);
    assert.match(msg.content, /完成/);
    assert.ok(!msg.content.includes('📌'), '都完成了就不用再提示今天要做什麼');
});

test('報到訊息發不出去也不能影響進度 —— 記錄早就存好了', async () => {
    const name = uniq();
    await run({sub: '登記', opts: {角色: name, 進度: 20}, userId: 'UCI7'});
    const c = await find(name);

    advance(DAY);
    const broken = fakeChannel.send;
    fakeChannel.send = async () => { throw new Error('頻道爆炸'); };
    try {
        const r = await click(`moon:done:${c.id}`, 'UCI7');
        assert.match(text(r), /第 21\/97 天/, '本人還是要收到確認');
    } finally {
        fakeChannel.send = broken;
    }

    assert.equal((await find(name)).day, 21, '廣播失敗把進度吃掉了');
});

// ---------------------------------------------------------------- 提醒排程

test('到期會在頻道 @ 使用者並附 [已對話] 按鈕', async () => {
    setClock('2026-08-15T12:00:00');
    const name = uniq();
    await run({sub: '登記', opts: {角色: name}, userId: 'U9'});

    advance(DAY - 60_000);
    await moonClubTick(fakeClient);
    assert.equal(sentFor('U9').length, 0, '還沒到期不該提醒');

    advance(2 * 60_000);
    await moonClubTick(fakeClient);
    const msgs = sentFor('U9');
    assert.equal(msgs.length, 1);
    assert.match(text(msgs[0]), new RegExp(name));
    assert.equal(buttonIds(msgs[0]).length, 1);

    assert.equal((await find(name)).remindCount, 1);
});

test('同一人多個角色同時到期只發一則，按鈕分開', async () => {
    setClock('2026-08-15T12:00:00');
    const a = uniq(); const b = uniq();
    await run({sub: '登記', opts: {角色: a}, userId: 'U7'});
    await run({sub: '登記', opts: {角色: b}, userId: 'U7'});

    advance(DAY + 60_000);
    await moonClubTick(fakeClient);
    const msgs = sentFor('U7');
    assert.equal(msgs.length, 1, '應該併成一則，不要 tag 兩次');
    assert.equal(buttonIds(msgs[0]).length, 2);
    assert.match(text(msgs[0]), new RegExp(a));
    assert.match(text(msgs[0]), new RegExp(b));
});

test('逾時每天再催一次，滿三次就停止', async () => {
    setClock('2026-08-15T12:00:00');
    const name = uniq();
    await run({sub: '登記', opts: {角色: name}, userId: 'U8'});

    advance(DAY + 60_000);
    for (let n = 1; n <= 3; n++) {
        await moonClubTick(fakeClient);
        assert.equal((await find(name)).remindCount, n, `第 ${n} 次提醒`);
        assert.equal(sentFor('U8').length, n, `第 ${n} 次應該真的發出訊息`);
        advance(DAY);
    }
    assert.equal((await find(name)).stopped, true, '催滿三次要停');

    advance(10 * DAY);
    await moonClubTick(fakeClient);
    assert.equal(sentFor('U8').length, 3, '停止後不該再發');
});

test('停止提醒後按 [已對話] 可以復活', async () => {
    setClock('2026-08-15T12:00:00');
    const name = uniq();
    await run({sub: '登記', opts: {角色: name}, userId: 'U6'});
    const c = (await store()).chars.find((x) => x.name === name);

    advance(DAY + 60_000);
    for (let n = 0; n < 3; n++) { await moonClubTick(fakeClient); advance(DAY); }
    assert.equal((await store()).chars.find((x) => x.name === name).stopped, true);

    const r = await click(`moon:done:${c.id}`, 'U6');
    assert.match(text(r), /第 2\/97 天/);
    const after = (await store()).chars.find((x) => x.name === name);
    assert.equal(after.stopped, false);
    assert.equal(after.remindCount, 0);
});

// ---------------------------------------------------------------- 深夜順延

test('預設不吵人：凌晨到期的提醒順延到早上 8 點', async () => {
    setClock('2026-08-14T03:30:00');           // 到期會落在隔天 03:30
    const name = uniq();
    await run({sub: '登記', opts: {角色: name}, userId: 'U5'});

    setClock('2026-08-15T03:31:00');           // 已滿 24 小時，但還在深夜
    await moonClubTick(fakeClient);
    assert.equal(sentFor('U5').length, 0, '凌晨不該提醒');

    setClock('2026-08-15T07:59:00');
    await moonClubTick(fakeClient);
    assert.equal(sentFor('U5').length, 0);

    setClock('2026-08-15T08:00:00');
    await moonClubTick(fakeClient);
    assert.equal(sentFor('U5').length, 1, '早上 8 點才提醒');
});

test('開了夜間提醒就照實在凌晨提醒', async () => {
    setClock('2026-08-14T03:30:00');
    const name = uniq();
    await run({sub: '登記', opts: {角色: name, 夜間提醒: true}, userId: 'U4'});

    setClock('2026-08-15T03:31:00');
    await moonClubTick(fakeClient);
    assert.equal(sentFor('U4').length, 1, '使用者要求凌晨也提醒');
});

test('順延不影響「幾點可以解」的判定 —— 凌晨仍可按已對話', async () => {
    setClock('2026-08-14T03:30:00');
    const name = uniq();
    await run({sub: '登記', opts: {角色: name}, userId: 'U3'});
    const c = (await store()).chars.find((x) => x.name === name);

    setClock('2026-08-15T04:00:00');           // 遊戲上已可解，只是機器人還沒吵
    const r = await click(`moon:done:${c.id}`, 'U3');
    assert.match(text(r), /第 2\/97 天/, '順延只是延後通知，不該擋住手動回報');
});

// ---------------------------------------------------------------- 查詢與縮寫

test('查詢列出所有角色，可解的才給按鈕', async () => {
    setClock('2026-08-15T12:00:00');
    const a = uniq(); const b = uniq();
    await run({sub: '登記', opts: {角色: a}, userId: 'UQ'});
    advance(DAY);
    await run({sub: '登記', opts: {角色: b}, userId: 'UQ'});

    const r = await run({sub: '查詢', userId: 'UQ'});
    assert.match(text(r), new RegExp(a));
    assert.match(text(r), new RegExp(b));
    assert.equal(buttonIds(r).length, 1, '只有到期的那個給按鈕');
});

test('沒登記時查詢有引導訊息', async () => {
    const r = await run({sub: '查詢', userId: 'UEMPTY'});
    assert.match(text(r), /還沒登記/);
});

test('可以用縮寫指到角色', async () => {
    await run({sub: '登記', opts: {角色: '月光小廚師'}, userId: 'UN'});
    const r = await run({sub: '修改', opts: {角色: '月光', 進度: 20}, userId: 'UN'});
    assert.match(text(r), /第 20\/97 天/);
});

test('縮寫指到多個角色會要求講清楚，且不動任何資料', async () => {
    await run({sub: '登記', opts: {角色: '阿明A'}, userId: 'UM'});
    await run({sub: '登記', opts: {角色: '阿明B'}, userId: 'UM'});
    const r = await run({sub: '修改', opts: {角色: '阿明', 進度: 50}, userId: 'UM'});
    assert.match(text(r), /符合的角色有好幾個/);
    const chars = (await store()).chars.filter((c) => c.userId === 'UM');
    assert.ok(chars.every((c) => c.day === 1), '曖昧時不該改到任何一個');
});

test('完全相同的名字優先於前綴相符', async () => {
    await run({sub: '登記', opts: {角色: '小明'}, userId: 'UE'});
    await run({sub: '登記', opts: {角色: '小明的分身'}, userId: 'UE'});
    const r = await run({sub: '修改', opts: {角色: '小明', 進度: 30}, userId: 'UE'});
    assert.match(text(r), /第 30\/97 天/);
});

test('取消後不再提醒', async () => {
    setClock('2026-08-15T12:00:00');
    const name = uniq();
    await run({sub: '登記', opts: {角色: name}, userId: 'UD'});
    const r = await run({sub: '取消', opts: {角色: name}, userId: 'UD'});
    assert.match(text(r), /已取消登記/);

    advance(2 * DAY);
    await moonClubTick(fakeClient);
    assert.ok(!sent.some((m) => text(m).includes(name)));
});

test('取消找不到的角色會說找不到', async () => {
    const r = await run({sub: '取消', opts: {角色: '不存在的人'}, userId: 'UD'});
    assert.match(text(r), /找不到這個角色/);
});

// ---------------------------------------------------------------- 終點

test('推到第 97 天會顯示完成訊息且不再往上加', async () => {
    setClock('2026-08-15T12:00:00');
    const name = uniq();
    await run({sub: '登記', opts: {角色: name, 進度: 96}, userId: 'UF'});
    const c = (await store()).chars.find((x) => x.name === name);

    advance(DAY);
    const r = await click(`moon:done:${c.id}`, 'UF');
    assert.match(text(r), /任務完成/);
    assert.match(text(r), /遊手好閒的人/);

    advance(DAY);
    await click(`moon:done:${c.id}`, 'UF');
    assert.equal((await store()).chars.find((x) => x.name === name).day, 97, '不該超過 97');
});

