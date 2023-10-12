import request from 'request';

import {SlashCommandBuilder} from "discord.js";
import {readFile, writeFile} from 'fs/promises';

const config = JSON.parse(
    await readFile(
        new URL('../../config.json', import.meta.url)
    )
);

let url = new URL('../../mapconfig.json', import.meta.url);


const MapRegCommand = {
        data:
            new SlashCommandBuilder()
                .setName('登記重組')
                .setDescription('登記重組時間')
                .addStringOption(option =>
                    option.setName('time')
                        .setDescription('YYYY/MM/DD HH:MM')),
        async execute(interaction) {

            const map = interaction.options.getString('time') ?? '';
            await writeFile(
                url, JSON.stringify({
                    host_time: new Date(map).getTime(),
                    reporter: interaction.user.username,
                    update: new Date().getTime()
                })
            )

            await interaction.deferReply();
            await interaction.editReply("更新時間為:" + new Date(map).toString());

        }
    }
;

export {MapRegCommand}