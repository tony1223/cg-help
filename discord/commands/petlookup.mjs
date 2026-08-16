// /查詢 —— 查寵物檔次。資料來源是攻略站（goodluck）的 CSV，見 src/data/goodluck.mjs。

import {SlashCommandBuilder} from "discord.js";
import {readFile} from 'fs/promises';
import {findPets, goodluckRoot, loadPets, petDetailUrl} from "../../src/data/goodluck.mjs";

const config = JSON.parse(
    await readFile(
        new URL('../../config.json', import.meta.url)
    )
);

const NOT_CONFIGURED = '查不到攻略站資料 —— 這台機器上找不到 goodluck 的 checkout，'
    + '請在 config.json 加上 goodluck_path 指到攻略站專案資料夾。';

/** 五圍照攻略站欄位順序：體力、力量、防禦、速度、魔法 */
const STATS = ['體力', '力量', '防禦', '速度', '魔法'];

/**
 * 組出貼在頻道裡的那張卡。
 *
 * 圖網址放第一行是刻意的 —— Discord 只有在網址單獨成行時才會展開成預覽圖，
 * 塞在文字中間就只會是一條藍字。
 */
export function renderPetCard(pet) {
    const lines = [];
    if (pet.imageUrl) lines.push(pet.imageUrl);

    lines.push(`寵物名稱:${pet.名稱}`);

    const stats = STATS.map((k) => pet[k]).filter((v) => v !== undefined && v !== '');
    if (stats.length === STATS.length) lines.push(`寵物總檔次: ${stats.join(',')}`);

    if (pet.屬性) lines.push(`寵物屬性:${pet.屬性}`);
    // 一般寵物表沒有技能欄，這行就不出現，不要印一個空的「寵物技能:」
    if (pet.技能) lines.push(`寵物技能:${pet.技能}`);

    // 遮罩連結 + <> 包網址：看到的是「攻略站詳細資料」這幾個字，
    // 而且 Discord 不會再幫這條網址長出第二張預覽卡把第一行的圖擠掉。
    lines.push(`[攻略站詳細資料](<${petDetailUrl(pet.名稱, config)}>)`);

    const payload = {content: lines.join('\n')};
    // 有 7 隻只有本機圖沒有遠端網址，那幾隻改用附件送，不然就整張卡沒圖
    if (!pet.imageUrl && pet.imageFile) payload.files = [pet.imageFile];
    return payload;
}

const PetLookupCommand = {
    data: new SlashCommandBuilder()
        .setName('查詢')
        .setDescription('查詢寵物檔次、屬性與技能（資料來源：攻略站）')
        .addStringOption(option =>
            option.setName('寵物')
                .setDescription('寵物名稱，打一部分也可以')
                .setRequired(true)
                .setAutocomplete(true)),

    async execute(interaction) {
        const keyword = (interaction.options.getString('寵物') ?? '').trim();

        if (!goodluckRoot(config)) {
            return interaction.reply({content: NOT_CONFIGURED, ephemeral: true});
        }

        await interaction.deferReply();

        const hits = await findPets(keyword, config);

        if (!hits.length) {
            return interaction.editReply(`找不到「${keyword}」這隻寵物。`);
        }

        // findPets 已經把精準命中排在最前面，只有「同名的候選一大票」時才需要問
        if (hits.length > 1 && hits[0].名稱 !== keyword) {
            const shown = hits.slice(0, 20).map((p) => p.名稱);
            const more = hits.length > shown.length ? `（還有 ${hits.length - shown.length} 隻）` : '';
            return interaction.editReply(
                `「${keyword}」符合 ${hits.length} 隻，講清楚一點：\n${shown.join('、')}${more}`
            );
        }

        return interaction.editReply(renderPetCard(hits[0]));
    },

    async autocomplete(interaction) {
        const typed = (interaction.options.getFocused() ?? '').trim();
        // 還沒打字時就給表頭那幾隻墊著（沒有排序依據，就是 CSV 的順序），
        // 至少下拉選單不是空的，玩家看得出來這格會自動完成
        const pool = typed ? await findPets(typed, config) : await loadPets(config);
        await interaction.respond(
            pool.slice(0, 25).map((p) => ({name: p.名稱, value: p.名稱}))
        );
    },
};

export {PetLookupCommand};
