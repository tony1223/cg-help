import request from 'request';

import {SlashCommandBuilder} from "discord.js";
import {readFile, stat, writeFile} from 'fs/promises';

const config = JSON.parse(
    await readFile(
        new URL('../../config.json', import.meta.url)
    )
);

const MissionCommand = {
        data:
            new SlashCommandBuilder()
                .setName('任務')
                .setDescription('查詢任務位置')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('NPC名字')),
        async execute(interaction) {

            const map = (interaction.options.getString('name') ?? '').trim();
            await interaction.deferReply({ephemeral: true});

            let url = new URL('../../mission.json', import.meta.url);

            try {
                let stats = await stat(url);
            } catch (Ex) {
                await writeFile(url, JSON.stringify({}));
            }

            var res = await readFile(
                url
            )

            var mission = {};
            if (res != null) {
                mission = JSON.parse(res);
            }

            if (mission[map] && mission[map].length) {
                let missionElement = mission[map].map(({
                                                           name,
                                                           level,
                                                           addr,
                                                           detail,
                                                           reporter
                                                       }) => name + "," + level + "," + addr + "," + detail + ", 回報人:" + reporter)
                    .join("\n");
                await interaction.editReply(map + "的查詢結果:\n" + missionElement);
            } else {
                await interaction.editReply(map + ": 無資料 ");
            }


        }
    }
;

export {MissionCommand}