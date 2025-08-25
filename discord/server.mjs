// Initialize dotenv
// require('dotenv').config();
import {readFile,writeFile} from 'fs/promises';

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




    // 引入交易頻道檢查功能
    import('./crontab/checkTradingChannelPosts.mjs').then(module => {
        const { checkTradingChannelPosts } = module;
        
        // 立即執行一次
        checkTradingChannelPosts(client);
        
        // 每小時檢查一次交易頻道發文限制
        setInterval(() => checkTradingChannelPosts(client), 2 * 60 * 60 * 1000);
    });


    // 建立檢查函數
    async function checkNewbieRoles() {
	    console.log("開始檢查");
        try {
            // 讀取已儲存的加入時間記錄
            let joinDates = {};
            try {
                const data = await readFile(new URL('../joinDates.json', import.meta.url));
                joinDates = JSON.parse(data);
            } catch (error) {
                console.log('無法讀取 joinDates.json，將創建新檔案');
            }

            let hasUpdates = false; // 追蹤是否有更新
            const guilds = await client.guilds.fetch();
            for (const oguild of guilds.values()) {

		if (oguild.id != "1090912861066362900"){
			continue;
		}

		const guild = await oguild.fetch();
		console.log(guild.id+":"+guild.name);
                // 尋找「新進勇者」角色
		    //
		const roles = await guild.roles.fetch();
		const newbieRole = roles.find(role => role.name === '新進成員');		    
                //const newbieRole = guild.roles.cache.find(role => role.name === '新進成員');
                if (!newbieRole) continue;



 const senRole = roles.find(role => role.name === '資深成員');		

        const members = await guild.members.fetch();
        
        // 過濾有特定身分組的成員
        const roleMembers = members.filter(member => 
            member.roles.cache.some(role => role.name === "新進成員")
        );
		    
                for (const member of members.values()) {
                    const userId = member.id;
                    const currentJoinTime = member.joinedAt.getTime();
                    
                    // 如果目前的加入時間比儲存的更新，則更新記錄
                    if (!joinDates[userId] || currentJoinTime > joinDates[userId]) {
                        joinDates[userId] = currentJoinTime;
                        hasUpdates = true;
                    }

                    // 使用儲存的時間來判斷角色
                    const joinedAt = new Date(joinDates[userId]);
                    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);			
                    const oneMonthAgo = new Date(Date.now() - 62 * 24 * 60 * 60 * 1000);

                    const isSen = member.roles.cache.some(role => role.name === "資深成員");

                    const isNew = member.roles.cache.some(role => role.name === "新進成員");
//		    const userid = 558267933470752774;

                    if(!isNew && joinedAt && joinedAt > oneMonthAgo){
                        console.log("new rejoin:"+member.joinedAt);
                            await member.roles.add(newbieRole);
                            console.log(`已新增 ${member.user.tag} 的新進成員角色`);

                    }
                    // 如果加入時間超過一個月，移除角色
                    if (joinedAt && !isSen && joinedAt < oneYearAgo) {
                        console.log("sen join:"+member.joinedAt);			    
                        await member.roles.add(senRole);
                        console.log(`已新增 ${member.user.tag} 的資深成員角色`);
                    }
                }      
                // 取得所有具有該角色的成員
//                const members = newbieRole.members;
//                console.log(members);
                // 檢查每個成員的加入時間
                for (const member of roleMembers.values()) {
		    console.log("join:"+member.joinedAt);
                    const joinedAt = member.joinedAt;
                    const oneMonthAgo = new Date(Date.now() - 62 * 24 * 60 * 60 * 1000);
                    
                    // 如果加入時間超過2個月，移除角色
                    if (joinedAt && joinedAt < oneMonthAgo) {
                        await member.roles.remove(newbieRole);
                        console.log(`已移除 ${member.user.tag} 的新進成員角色`);
                    }
                }
            }
     // 只在有更新時才寫入檔案
        if (hasUpdates) {
            await writeFile(
                new URL('../joinDates.json', import.meta.url),
                JSON.stringify(joinDates, null, 2)
            );
            console.log('已更新加入時間記錄');
        }
		console.log("結束檢查");
        } catch (error) {
            console.error('檢查新進勇者角色時發生錯誤:', error);
        }

   
    }

    // 立即執行一次
    checkNewbieRoles();
    
    // 設定定期檢查
    setInterval(checkNewbieRoles, 24 * 60 * 60 * 1000);

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
    // Handle button interactions
    if (interaction.isButton()) {
        // Find commands that have button handlers
        const buttonHandlers = commands.filter(cmd => cmd.handleButtonInteraction);
        
        for (const handler of buttonHandlers) {
            try {
                await handler.handleButtonInteraction(interaction);
            } catch (error) {
                console.error('Error handling button interaction:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '處理按鈕時發生錯誤！',
                        ephemeral: true
                    });
                }
            }
        }
        return;
    }

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
