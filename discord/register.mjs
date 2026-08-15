import {GatewayIntentBits, REST, Routes} from 'discord.js';
import {readFile} from "fs/promises";

const config = JSON.parse(
    await readFile(
        new URL('../config.json', import.meta.url)
    )
);


import {commands} from "./commands.mjs"

const _commands = [];
commands.forEach(n => {
    _commands.push(n.data.toJSON())
});

const rest = new REST({version: '10'}).setToken(config.discord);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(Routes.applicationCommands(config.clientid), {body: _commands});

        console.log('Successfully reloaded application (/) commands.');
        // 這支會 import commands.mjs，而 petcalc 之類的模組在載入時就排了
        // setTimeout 去抓遠端圖鑑。那些 timer 會把 event loop 撐著，
        // 註冊明明成功了卻永遠不結束，部署時看起來像卡死。直接收工。
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
})();