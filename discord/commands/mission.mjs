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
                        .setDescription('NPC名字或道具名稱(部分即可)')),
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

            var results = [];
            if (mission[map]) {
                results.push.apply(results, mission[map]);
            } else {
                for (var k in mission) {
                    results.push.apply(results, mission[k].filter(n => (n.item || "").indexOf(map) != -1));
                }
            }


            if (results.length) {
                let missionElement = results.map(({
                                                      name,
                                                      level,
                                                      addr,
                                                      item,
                                                      detail,
                                                      reporter
                                                  }) => name + "," + level + ",地點:" + addr + ",道具:" + item + ",備註" + detail + ", 回報人:" + reporter)
                    .join("\n");
                await interaction.editReply(map + "的查詢結果:\n" + missionElement);
            } else {
                await interaction.editReply(map + ": 無資料 ");
            }


        }
    }
;

export {MissionCommand}