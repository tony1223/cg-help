// /查詢 的資料層與輸出格式。
//
// 資料在另一個 repo（攻略站 goodluck），不在這台機器上就整包跳過 ——
// 這些 case 驗的是「我們怎麼讀那份資料」，不是「那份資料的內容」。
//
//   node --test test/petlookup.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {findPets, goodluckRoot, loadPets, petDetailUrl, syncGoodluck} from '../src/data/goodluck.mjs';
import {renderPetCard} from '../discord/commands/petlookup.mjs';

const root = goodluckRoot({});
const skip = root ? false : '找不到攻略站 checkout（config.goodluck_path 或 ../goodluck）';

test('兩張表都讀得到，而且有去重', {skip}, async () => {
    const pets = await loadPets({});
    assert.ok(pets.length > 1200, `只讀到 ${pets.length} 隻，來源表大概少讀了一張`);

    const names = pets.map((p) => p.名稱);
    assert.equal(new Set(names).size, names.length, '有同名的寵物沒被去掉');

    const 來源 = new Set(pets.map((p) => p.來源));
    assert.deepEqual([...來源].sort(), ['一般寵物', '永恆初心專屬']);
});

test('引號裡夾換行的那一列沒有被切壞', {skip}, async () => {
    // 水藍鼠的入手方法是個跨行的引號欄位。用 split('\n') 解會把它切成兩列，
    // 後面整張表的欄位跟著位移 —— 這條就是在守那件事。
    const [水藍鼠] = await findPets('水藍鼠', {});
    assert.ok(水藍鼠, '水藍鼠不見了，CSV 大概被切壞了');
    assert.deepEqual(
        [水藍鼠.體力, 水藍鼠.力量, 水藍鼠.防禦, 水藍鼠.速度, 水藍鼠.魔法],
        ['11', '15', '28', '28', '33'],
    );
    assert.match(水藍鼠.入手方法, /\n/, '跨行欄位應該原樣保留，包含那個換行');
});

test('查得到的名字都是真的查得到 —— 精準 > 前綴 > 包含', {skip}, async () => {
    // 「史萊姆」本尊要排在「果凍史萊姆」前面，不然精準命中會被長名字蓋掉
    const hits = await findPets('史萊姆', {});
    assert.equal(hits[0].名稱, '史萊姆');
    assert.ok(hits.length > 1, '應該還有一票 XX史萊姆');

    assert.deepEqual(await findPets('這隻寵物不存在', {}), []);
    assert.deepEqual(await findPets('  ', {}), [], '空字串不該把整份表倒出來');
});

test('輸出格式跟當初要求的那張卡一字不差', {skip}, async () => {
    const [雨傘節] = await findPets('雨傘節', {});
    const {content, files} = renderPetCard(雨傘節);

    assert.equal(content, [
        'https://files.originmood.com/pic/7fd53469e896a57ba33b04e23ccfc033/picture/d5ecda41e3a9e876ecba677b34d9930d.gif',
        '寵物名稱:雨傘節',
        '寵物總檔次: 24,48,15,23,13',
        '寵物屬性:地8水2',
        '寵物技能:石化攻擊LV11、毒性攻擊LV11',
        '[攻略站詳細資料](<https://cg-originmood-dc.github.io/寵物資料/'
            + '%E9%9B%A8%E5%82%98%E7%AF%80>)',
    ].join('\n'));

    // 有遠端網址就不該再多送一份附件
    assert.equal(files, undefined);
});

test('詳細資料連結指得到攻略站真的產得出來的頁面', {skip}, async () => {
    // 攻略站的路由是 src/pages/寵物資料/[name].astro，getStaticPaths 直接把
    // 寵物名稱當 params.name，所以網址就是 /寵物資料/{名稱}。這條在守
    // 「網址規則跟那邊的路由對得上」，那邊改路由這裡要跟著改。
    assert.equal(
        petDetailUrl('雨傘節'),
        'https://cg-originmood-dc.github.io/寵物資料/%E9%9B%A8%E5%82%98%E7%AF%80',
    );
    assert.equal(
        petDetailUrl('雨傘節', {goodluck_site: 'https://example.com/'}),
        'https://example.com/寵物資料/%E9%9B%A8%E5%82%98%E7%AF%80',
        '尾斜線要被吃掉，不然會變成兩條斜線',
    );

    // 每一隻都有頁面：那邊的 getStaticPaths 走的是 listPets()，跟我們同一份表
    const pets = await loadPets({});
    for (const p of pets.slice(0, 100)) {
        assert.ok(petDetailUrl(p.名稱).startsWith('https://'), `${p.名稱} 的連結長歪了`);
    }
});

test('圖片那行後面接連結，不會把預覽圖擠掉', {skip}, async () => {
    const [雨傘節] = await findPets('雨傘節', {});
    const lines = renderPetCard(雨傘節).content.split('\n');

    // 第一行單獨一條圖網址，Discord 才會展開成圖
    assert.match(lines[0], /^https:\/\/\S+\.gif$/);
    // 最後一行的網址包在 <> 裡，不會再長出第二張預覽卡跟圖搶版面
    assert.match(lines.at(-1), /^\[攻略站詳細資料]\(<https:\/\/[^\s>]+>\)$/);
});

test('圖網址是反查 images.json 來的，不是自己拼的', {skip}, async () => {
    const pets = await loadPets({});
    const 專屬 = pets.filter((p) => p.來源 === '永恆初心專屬');
    const 有網址 = 專屬.filter((p) => p.imageUrl);
    assert.ok(
        有網址.length / 專屬.length > 0.95,
        `專屬寵只有 ${有網址.length}/${專屬.length} 查得到遠端圖，反查大概斷了`,
    );
    for (const p of 有網址.slice(0, 50)) {
        assert.match(p.imageUrl, /^https:\/\//, `${p.名稱} 的圖網址長得不對：${p.imageUrl}`);
    }
});

test('沒有技能欄的一般寵物不會印出空的「寵物技能:」', {skip}, async () => {
    const [虎人] = await findPets('虎人', {});
    assert.equal(虎人.來源, '一般寵物');

    const {content, files} = renderPetCard(虎人);
    assert.ok(!content.includes('寵物技能'), `不該有技能行：\n${content}`);
    assert.ok(!content.includes('undefined'), `漏欄位漏出來了：\n${content}`);
    assert.equal(content.split('\n')[0], '寵物名稱:虎人', '沒圖時第一行就該是名字');
    assert.equal(files, undefined, '一般寵物沒有圖，不該硬送附件');
});

test('只有本機圖沒有遠端網址的，改用附件送', {skip}, async () => {
    const pets = await loadPets({});
    const 只有本機 = pets.filter((p) => !p.imageUrl && p.imageFile);
    assert.ok(只有本機.length, '沒有這種寵物的話這條就沒在守什麼了，確認一下 images.json');

    const {content, files} = renderPetCard(只有本機[0]);
    assert.equal(files.length, 1);
    assert.ok(!content.startsWith('http'), '走附件時不該還有一行圖網址');
});

// --- 定期同步 ---------------------------------------------------------------
// 這幾條全部在暫存目錄裡自己開 repo 做，不碰真的攻略站 checkout、也不連網。

function tempCheckout(init) {
    const dir = mkdtempSync(join(tmpdir(), 'goodluck-test-'));
    mkdirSync(join(dir, 'content', 'data'), {recursive: true});
    writeFileSync(join(dir, 'content', 'data', '專屬寵物.csv'), '名稱\n測試寵\n');
    init?.(dir);
    return dir;
}

const git = (dir, ...args) => execFileSync('git', ['-C', dir, ...args], {stdio: 'pipe'});

test('不是 git repo 就不要亂動', async (t) => {
    const dir = tempCheckout();
    t.after(() => rmSync(dir, {recursive: true, force: true}));

    assert.match(await syncGoodluck({goodluck_path: dir}), /不是 git repo/);
});

test('工作區髒的時候絕對不 pull —— 那可能是有人正在編攻略站', async (t) => {
    const dir = tempCheckout((d) => {
        git(d, 'init', '-q');
        git(d, 'config', 'user.email', 'test@example.com');
        git(d, 'config', 'user.name', 'test');
        git(d, 'add', '-A');
        git(d, 'commit', '-qm', 'init');
    });
    t.after(() => rmSync(dir, {recursive: true, force: true}));

    // 模擬「有人改到一半」
    writeFileSync(join(dir, 'content', 'data', '專屬寵物.csv'), '名稱\n改到一半的寵\n');
    const before = String(git(dir, 'status', '--porcelain'));

    assert.match(await syncGoodluck({goodluck_path: dir}), /未提交的變更/);
    assert.equal(String(git(dir, 'status', '--porcelain')), before, '同步把別人的修改弄掉了');
});

test('拉不動的時候要炸出來，不要謊報成功', async (t) => {
    // 乾淨但沒有 upstream，git pull --ff-only 會失敗。
    // 這條在守「syncGoodluck 不會把失敗吞掉回一句『已是最新』」——
    // 真的吞掉的話，資料默默停在舊版沒人會發現。
    const dir = tempCheckout((d) => {
        git(d, 'init', '-q');
        git(d, 'config', 'user.email', 'test@example.com');
        git(d, 'config', 'user.name', 'test');
        git(d, 'add', '-A');
        git(d, 'commit', '-qm', 'init');
    });
    t.after(() => rmSync(dir, {recursive: true, force: true}));

    await assert.rejects(() => syncGoodluck({goodluck_path: dir}));
});

test('沒設定攻略站路徑時同步只是跳過，不是錯誤', async () => {
    // 指到一個不存在的路徑，而且這台機器上剛好也沒有 ../goodluck 的話就是跳過；
    // 有的話會 fallback 過去，那條路徑另外三條在顧。
    const missing = join(tmpdir(), 'goodluck-does-not-exist-' + process.pid);
    const result = await syncGoodluck({goodluck_path: missing});
    assert.ok(
        /跳過/.test(result) || /已是最新|更新 /.test(result),
        `預期跳過或走 fallback，實際拿到：${result}`,
    );
});
