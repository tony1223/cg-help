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
    } catch (error) {
        console.error(error);
    }
})();