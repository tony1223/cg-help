import request from 'request';

import {SlashCommandBuilder} from "discord.js";
import {readFile, stat, writeFile} from 'fs/promises';

const config = JSON.parse(
    await readFile(
        new URL('../../config.json', import.meta.url)
    )
);

const MissionRegCommand = {
        data:
            new SlashCommandBuilder()
                .setName('任務登記')
                .setDescription('登記任務')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('NPC名字'))
                .addStringOption(option =>
                    option.setName('level')
                        .setDescription('等級'))
                .addStringOption(option =>
                    option.setName('addr')
                        .setDescription('地區'))
                .addStringOption(option =>
                    option.setName('detail')
                        .setDescription('描述')),
        async execute(interaction) {

            const name = (interaction.options.getString('name') ?? '').trim();
            const level = (interaction.options.getString('level') ?? '').trim();
            const addr = (interaction.options.getString('addr') ?? '').trim();
            const detail = (interaction.options.getString('detail') ?? '').trim();

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

            var obj = {
                name, level, addr, detail,
                reporter: interaction.user.username
            };

            mission[name] = mission[name] || [];

            mission[name] = mission[name].filter(n => n.addr != obj.addr);
            mission[name].push(obj);

            await writeFile(url,
                JSON.stringify(mission));

            await writeFile(new URL('../../mission-' + new Date().getDate() + '.json', import.meta.url),
                JSON.stringify(mission));

            await interaction.editReply(name + ": 資料更新 ");

        }
    }
;

export {MissionRegCommand}