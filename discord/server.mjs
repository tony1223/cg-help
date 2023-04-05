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

// const client = new Client({
//     intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
// });
const client = new Client({
    intents: [GatewayIntentBits.MessageContent,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers]
});


client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});
//https://discord.com/api/oauth2/authorize?client_id=1091073332868300891&permissions=377957320704&scope=bot

import {commands} from "./commands.mjs"

client.commands = new Collection();

commands.forEach(n => {
    client.commands.set(n.data.name, n);
});

/**
 *  Message {
  channelId: '1091084222850158635',
  guildId: '1074775571260784741',
  id: '1093034724471091270',
  createdTimestamp: 1680670185917,
  type: 0,
  system: false,
  content: '@魔力小幫手 asdsadsadasd',
  author: User {
    id: '287251356207546369',
    bot: false,
    system: false,
    flags: UserFlagsBitField { bitfield: 0 },
    username: 'tonyq',
    discriminator: '1711',
    avatar: '498dbac91c42d389a21be2cbede90e65',
    banner: undefined,
    accentColor: undefined
  },
  pinned: false,
  tts: false,
  nonce: '1093034713041338368',
  embeds: [],
  components: [],
  attachments: Collection(0) [Map] {},
  stickers: Collection(0) [Map] {},
  position: null,
  roleSubscriptionData: null,
  editedTimestamp: null,
  reactions: ReactionManager { message: [Circular *1] },
  mentions: MessageMentions {
    everyone: false,
    users: Collection(0) [Map] {},
    roles: Collection(0) [Map] {},
    _members: null,
    _channels: null,
    _parsedUsers: null,
    crosspostedChannels: Collection(0) [Map] {},
    repliedUser: null
  },
  webhookId: null,
  groupActivityApplication: null,
  applicationId: null,
  activity: null,
  flags: MessageFlagsBitField { bitfield: 0 },
  reference: null,
  interaction: null
}

 */
client.on("messageCreate", (msg) => {
    if (msg.author.bot) return;
    if (msg.author.id === client.user.id) return;

    const comand = commands.filter(n => n.isSupportMessage && n.isSupportMessage(msg));

    comand.forEach(n => {
        n.handleMessage(msg);
    });

    // console.log("messageCreate");
    // msg.channel.send("Success!");
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

// Log In our bot
client.login(config.discord);