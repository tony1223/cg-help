/**
 * 攻略站「回報錯誤」接收端。
 *
 * cg-originmood-dc.github.io 是 GitHub Pages 純靜態站，沒有後端可收表單；
 * bot 主機本來就 24 小時在線，這裡起一個極小的 HTTP 端點收回報，
 * 由 bot 轉發到指定的 Discord 頻道。
 *
 * config.json 加上（沒設定 report 就完全不啟動，對既有 bot 零影響）：
 *
 *   "report": {
 *     "channel_id": "<接收回報的頻道 ID>",
 *     "port": 8377,
 *     "allow_origins": ["https://cg-originmood-dc.github.io"]
 *   }
 *
 * 對外需走 HTTPS（攻略站是 https，混合內容會被瀏覽器擋）：
 * 用 cloudflared tunnel 或既有反向代理把 https 網域指到這個 port。
 */
import { createServer } from 'node:http';
import { EmbedBuilder } from 'discord.js';

const LIMITS = { page: 300, title: 200, message: 2000, contact: 100, ua: 200 };
const MAX_BODY = 16 * 1024;

// 單一 IP：10 分鐘 3 則；全站：1 小時 30 則（分散式灌水的保險絲）
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IP = 3;
const GLOBAL_WINDOW_MS = 60 * 60 * 1000;
const MAX_GLOBAL = 30;

const perIp = new Map();
let globalHits = [];

function allowIp(ip) {
    const now = Date.now();
    globalHits = globalHits.filter((t) => now - t < GLOBAL_WINDOW_MS);
    if (globalHits.length >= MAX_GLOBAL) return false;
    const hits = (perIp.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
    if (hits.length >= MAX_PER_IP) {
        perIp.set(ip, hits);
        return false;
    }
    hits.push(now);
    perIp.set(ip, hits);
    globalHits.push(now);
    return true;
}

function clientIp(req) {
    return (
        req.headers['cf-connecting-ip'] ||
        (req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() ||
        req.socket.remoteAddress ||
        'unknown'
    );
}

const cut = (v, n) => String(v ?? '').trim().slice(0, n);

function json(res, status, body, cors) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...cors });
    res.end(JSON.stringify(body));
}

export function startReportServer(client, config) {
    const cfg = config.report;
    if (!cfg?.channel_id) {
        console.log('[report] config.report.channel_id 未設定，網站回報端點不啟動');
        return null;
    }
    const port = cfg.port ?? 8377;
    const origins = cfg.allow_origins ?? ['https://cg-originmood-dc.github.io'];

    const server = createServer((req, res) => {
        const origin = req.headers.origin ?? '';
        const cors = origins.includes(origin)
            ? {
                  'access-control-allow-origin': origin,
                  'access-control-allow-methods': 'POST',
                  'access-control-allow-headers': 'content-type',
                  'access-control-max-age': '86400',
                  vary: 'origin',
              }
            : { vary: 'origin' };

        if (req.method === 'GET' && req.url === '/healthz') return json(res, 200, { ok: true }, cors);
        if (req.method === 'OPTIONS') {
            res.writeHead(204, cors);
            return res.end();
        }
        if (req.method !== 'POST' || req.url !== '/report') return json(res, 404, { ok: false }, cors);
        if (!origins.includes(origin)) return json(res, 403, { ok: false, error: 'origin' }, cors);

        let raw = '';
        let over = false;
        req.on('data', (chunk) => {
            raw += chunk;
            if (raw.length > MAX_BODY && !over) {
                over = true;
                json(res, 413, { ok: false, error: 'size' }, cors);
                req.destroy();
            }
        });
        req.on('end', async () => {
            if (over) return;
            let body;
            try {
                body = JSON.parse(raw);
            } catch {
                return json(res, 400, { ok: false, error: 'json' }, cors);
            }

            // 蜜罐欄位有值＝機器人填的，假裝成功打發掉
            if (cut(body.hp, 10)) return json(res, 200, { ok: true }, cors);

            const message = cut(body.message, LIMITS.message);
            const page = cut(body.page, LIMITS.page);
            if (!message) return json(res, 400, { ok: false, error: 'empty' }, cors);
            if (!origins.some((o) => page === o || page.startsWith(o + '/'))) {
                return json(res, 400, { ok: false, error: 'page' }, cors);
            }
            if (!allowIp(clientIp(req))) return json(res, 429, { ok: false, error: 'rate' }, cors);

            try {
                const channel = await client.channels.fetch(cfg.channel_id);
                const contact = cut(body.contact, LIMITS.contact);
                const ua = cut(req.headers['user-agent'], LIMITS.ua);
                const embed = new EmbedBuilder()
                    .setTitle(cut(body.title, LIMITS.title) || '（無標題）')
                    .setURL(page)
                    .setDescription(message)
                    .addFields(
                        { name: '頁面', value: page },
                        ...(contact ? [{ name: '聯絡方式', value: contact }] : []),
                        ...(ua ? [{ name: '瀏覽器', value: ua }] : []),
                    )
                    .setColor(0xe65100)
                    .setTimestamp();
                await channel.send({
                    content: '📩 網站錯誤回報',
                    embeds: [embed],
                    allowedMentions: { parse: [] },
                });
                json(res, 200, { ok: true }, cors);
            } catch (err) {
                console.error('[report] 轉發到頻道失敗:', err);
                json(res, 500, { ok: false, error: 'send' }, cors);
            }
        });
    });

    server.on('error', (err) => console.error('[report] HTTP server 錯誤:', err));
    server.listen(port, () => {
        console.log(`[report] 網站回報端點 http://localhost:${port}/report → 頻道 ${cfg.channel_id}`);
    });
    return server;
}
