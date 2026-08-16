// 讀攻略站（goodluck）的寵物資料。
//
// 攻略站是另一個 repo，資料是 content/data/*.csv 加上 content/images.json。
// 這裡不重抓網站、不複製一份快照 —— 直接讀同機上的 checkout，靠 mtime 判斷重讀，
// 再由 startGoodluckSync() 定期 git pull 把 checkout 拉到跟網站同一版。
//
// 路徑找法：config.goodluck_path > cg-help 隔壁的 ../goodluck > 放棄。
// 找不到不會在 import 時炸掉，讓呼叫端自己決定要顯示什麼。

import {readFile, stat} from 'fs/promises';
import {existsSync} from 'fs';
import {execFile} from 'child_process';
import {promisify} from 'util';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';
import {parse} from 'csv-parse/sync';

const run = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * 寵物的兩張來源表。欄位刻意不同：專屬寵有技能／公告／圖，一般寵沒有。
 * 順序即優先序 —— 兩表同名時（翼龍、幻影那幾隻）以專屬寵物表為準，
 * 跟攻略站 src/lib/pets.ts 的 SOURCES 對齊，改那邊記得改這邊。
 */
const SOURCES = [
    {file: '專屬寵物.csv', 來源: '永恆初心專屬'},
    {file: '魔力原始寵物.csv', 來源: '一般寵物'},
];

const IMAGE_MAP = 'content/images.json';

/** 攻略站部署在 <owner>.github.io，BASE_PATH 是根路徑（見那邊的 deploy.yml） */
export const DEFAULT_SITE = 'https://cg-originmood-dc.github.io';

const rootCache = new Map();

/**
 * 攻略站 checkout 的根目錄，找不到回 null。
 *
 * 只快取「找到」的結果 —— 找不到就每次重試，不然 bot 起來時攻略站還沒 clone 完，
 * 之後補上了也要重啟才會活過來。快取以設定值為 key，同一個 process 裡
 * 換一個 goodluck_path 問還是會重找（測試要的就是這個）。
 */
export function goodluckRoot(config = {}) {
    const key = config.goodluck_path?.trim() ?? '';
    const hit = rootCache.get(key);
    if (hit) return hit;

    const candidates = [key, join(repoRoot, '..', 'goodluck')].filter(Boolean);
    const found = candidates.find((p) => existsSync(join(p, 'content', 'data')));
    if (found) rootCache.set(key, found);
    return found ?? null;
}

/** 攻略站網址（去掉尾斜線），可用 config.goodluck_site 蓋掉 */
export function goodluckSite(config = {}) {
    return (config.goodluck_site?.trim() || DEFAULT_SITE).replace(/\/$/, '');
}

/**
 * 某隻寵物在攻略站上的詳細資料頁。
 * 路由是 src/pages/寵物資料/[name].astro，params 直接吃寵物名稱；
 * 名字有中文，這裡先 encode，貼進 Discord 才不會被斷在奇怪的地方。
 */
export function petDetailUrl(name, config = {}) {
    return `${goodluckSite(config)}/寵物資料/${encodeURIComponent(name)}`;
}

let cache = null;
let cacheStamp = '';

async function mtimeOf(path) {
    try {
        return String((await stat(path)).mtimeMs);
    } catch {
        return '';
    }
}

/**
 * 全部寵物，專屬寵在前。回傳的每筆多帶三個欄位：
 *   來源     哪張表來的
 *   imageUrl 原始站的遠端圖網址（Discord 可直接吃），沒有就空字串
 *   imageFile 本機圖檔絕對路徑，沒有就空字串
 *
 * 這兩個圖欄位是「有哪個用哪個」：1069 隻查得到遠端網址，7 隻只有本機檔
 * （用附件送），一般寵物表 247 隻完全沒圖。
 */
export async function loadPets(config = {}) {
    const root = goodluckRoot(config);
    if (!root) return [];

    const files = SOURCES.map((s) => ({...s, path: join(root, 'content', 'data', s.file)}));
    const mapPath = join(root, IMAGE_MAP);
    const stamps = await Promise.all([...files.map((f) => mtimeOf(f.path)), mtimeOf(mapPath)]);
    // root 也算進指紋，換一個 checkout 問的時候才不會拿到上一個的快取
    const stamp = [root, ...stamps].join('|');
    if (cache && stamp === cacheStamp) return cache;

    // images.json 存的是「遠端網址 -> 本機路徑」，這裡要反過來查。
    // 同一張圖被多個來源指到時以先出現的為準。
    const remoteOf = new Map();
    try {
        const raw = JSON.parse(await readFile(mapPath, 'utf8'));
        for (const [url, local] of Object.entries(raw.map ?? {})) {
            if (!remoteOf.has(local)) remoteOf.set(local, url);
        }
    } catch {
        // 沒有 images.json 就是全部走本機檔／無圖，不是錯誤
    }

    const seen = new Set();
    const out = [];
    for (const s of files) {
        let text;
        try {
            text = await readFile(s.path, 'utf8');
        } catch {
            continue;
        }
        // 解析選項跟攻略站 src/lib/pets.ts 一模一樣，兩邊讀出來的列必須一致。
        // relax_column_count 是因為一般寵物表有幾列欄數對不上（引號欄位裡夾換行）。
        const records = parse(text.replace(/^﻿/, ''), {
            columns: true,
            skip_empty_lines: true,
            relax_column_count: true,
            trim: true,
        });

        for (const r of records) {
            const name = (r.名稱 ?? '').trim();
            if (!name || seen.has(name)) continue;
            seen.add(name);

            const imagePath = (r.image ?? '').trim() || `/img/專屬寵物/${name}.gif`;
            const localFile = join(root, 'public', imagePath.replace(/^\//, ''));
            out.push({
                ...r,
                名稱: name,
                來源: s.來源,
                imageUrl: remoteOf.get(imagePath) ?? '',
                imageFile: existsSync(localFile) ? localFile : '',
            });
        }
    }

    cache = out;
    cacheStamp = stamp;
    return cache;
}

/**
 * 依名稱找寵物。先精準、再前綴、最後包含，同一層裡短名優先
 * （查「史萊姆」不該被「果凍史萊姆」蓋掉）。
 * @returns {Promise<Array>} 依相關度排序，呼叫端自己決定要取第一筆還是列清單
 */
export async function findPets(keyword, config = {}) {
    const q = (keyword ?? '').trim();
    if (!q) return [];
    const pets = await loadPets(config);

    const rank = (p) => {
        const n = p.名稱;
        if (n === q) return 0;
        if (n.startsWith(q)) return 1;
        if (n.includes(q)) return 2;
        return 3;
    };
    return pets
        .map((p) => ({p, r: rank(p)}))
        .filter((x) => x.r < 3)
        .sort((a, b) => a.r - b.r || a.p.名稱.length - b.p.名稱.length)
        .map((x) => x.p);
}

async function git(root, ...args) {
    const {stdout} = await run('git', ['-C', root, ...args], {windowsHide: true});
    return stdout.trim();
}

/**
 * 把本機的攻略站 checkout 拉到跟遠端同一版，回一句給 log 看的結果。
 *
 * 只做 fast-forward，而且工作區有未提交的東西就整個不動 —— 這個 checkout
 * 可能同時是人在編輯攻略站的地方，bot 沒有資格去動別人寫到一半的東西。
 * 拉完 CSV 的 mtime 會變，loadPets() 下一次查詢自然就重讀了。
 */
export async function syncGoodluck(config = {}) {
    const root = goodluckRoot(config);
    if (!root) return '跳過：找不到攻略站 checkout';

    try {
        await git(root, 'rev-parse', '--git-dir');
    } catch {
        return `跳過：${root} 不是 git repo`;
    }

    const dirty = await git(root, 'status', '--porcelain');
    if (dirty) {
        const n = dirty.split('\n').length;
        return `跳過：工作區有 ${n} 個未提交的變更，不動它`;
    }

    const before = await git(root, 'rev-parse', 'HEAD');
    await git(root, 'pull', '--ff-only');
    const after = await git(root, 'rev-parse', 'HEAD');
    return before === after
        ? '已是最新'
        : `更新 ${before.slice(0, 7)} -> ${after.slice(0, 7)}`;
}

/**
 * 開機拉一次，之後每 goodluck_sync_hours 小時再拉（預設 4 小時，
 * 跟寵物算檔區既有的更新頻率一致）。config.goodluck_sync 設 false 就不開。
 */
export function startGoodluckSync(config = {}) {
    if (config.goodluck_sync === false) return;

    const hours = Number(config.goodluck_sync_hours) || 4;
    const tick = async () => {
        try {
            console.log('攻略站資料同步:', await syncGoodluck(config));
        } catch (error) {
            // 拉不動就用手上這份舊的，不要讓整個 bot 陪葬
            console.error('攻略站資料同步失敗:', error.message);
        }
    };

    tick();
    return setInterval(tick, hours * 60 * 60 * 1000);
}
