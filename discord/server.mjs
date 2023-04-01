// Initialize dotenv
// require('dotenv').config();
import {readFile} from 'fs/promises';

const config = JSON.parse(
    await readFile(
        new URL('../config.json', import.meta.url)
    )
);


// Discord.js versions ^13.0 require us to explicitly define client intents
import {Client, GatewayIntentBits, SlashCommandBuilder, Collection, Events} from 'discord.js';

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent]
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});
//https://discord.com/api/oauth2/authorize?client_id=1091073332868300891&permissions=377957320704&scope=bot

// Log In our bot
client.login(config.discord);

import {commands} from "./commands.mjs"

client.commands = new Collection();

commands.forEach(n => {
    client.commands.set(n.data.name, n);
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    // console.log("on command", interaction)
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({content: 'There was an error while executing this command!', ephemeral: true});
        } else {
            await interaction.reply({content: 'There was an error while executing this command!', ephemeral: true});
        }
    }
});
