// 交易頻道發文限制檢查功能
import {readFile} from 'fs/promises';

const config = JSON.parse(
    await readFile(
        new URL('../../config.json', import.meta.url)
    )
);

import {Client, GatewayIntentBits} from 'discord.js';

// 建立交易頻道發文限制檢查函數
export async function checkTradingChannelPosts(client) {
    console.log("開始檢查交易頻道發文限制");
    try {
        // 可設定的交易頻道 ID 列表
        const tradingChannelIds = [
            // '1234567890123456789', // 範例頻道 ID，請替換為實際的交易頻道 ID
            // '1234567890123456790', // 可以添加多個頻道
            '1090917357326696458',
            '1104424616711163915',
            '1189025216995791048',
            '1110141068965584957',
            '1090955804816982016',
            '1090955849511481406',
            '1090956315263783022',
            '1110421386108878878',
            '1090956360310591580',
            '1090956395710525494',
            '1090913026204504084',

        ];

        if (tradingChannelIds.length === 0) {
            console.log("未設定交易頻道，跳過檢查");
            return;
        }

        const now = new Date();
        const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

        const guilds = await client.guilds.fetch();
        for (const oguild of guilds.values()) {
            if (oguild.id != "1090912861066362900") {
                continue;
            }

            const guild = await oguild.fetch();
            console.log(`檢查伺服器: ${guild.id}:${guild.name}`);

            for (const channelId of tradingChannelIds) {
                try {
                    const channel = await guild.channels.fetch(channelId);
                    if (!channel || !channel.isTextBased()) {
                        console.log(`頻道 ${channelId} 不存在或不是文字頻道`);
                        continue;
                    }

                    console.log(`檢查交易頻道: ${channel.name}`);

                    // 一次性獲取7天內的所有訊息
                    const allMessages = [];
                    const recentPosters = new Set();
                    let lastId = null;
                    
                    // 分批獲取訊息直到超過7天前
                    while (true) {
                        const options = { limit: 100 };
                        if (lastId) options.before = lastId;
                        
                        const messages = await channel.messages.fetch(options);
                        if (messages.size === 0) break;
                        
                        let foundOldMessage = false;
                        for (const msg of messages.values()) {
                            if (msg.createdAt <= sevenDaysAgo) {
                                foundOldMessage = true;
                                break;
                            }
                            
                            if (!msg.author.bot) {
                                allMessages.push(msg);
                                // 記錄最近24小時內發文的用戶
                                if (msg.createdAt > oneDayAgo) {
                                    recentPosters.add(msg.author.id);
                                }
                            }
                        }
                        
                        // 如果找到超過7天的訊息，停止獲取
                        if (foundOldMessage) break;
                        
                        lastId = messages.last()?.id;
                        if (!lastId) break;
                        
                        // 添加延遲避免速率限制
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }

                    console.log(`最近24小時內有 ${recentPosters.size} 位用戶發文`);
                    console.log(`過去7天內總共 ${allMessages.length} 篇訊息`);

                    // 按用戶分組訊息
                    const userMessages = new Map();
                    for (const msg of allMessages) {
                        if (!userMessages.has(msg.author.id)) {
                            userMessages.set(msg.author.id, []);
                        }
                        userMessages.get(msg.author.id).push(msg);
                    }

                    // 只檢查最近24小時內有發文的用戶
                    for (const userId of recentPosters) {
                        const messages = userMessages.get(userId) || [];
                        await processUserMessages(client, channel, userId, messages);
                    }

                } catch (error) {
                    console.error(`檢查頻道 ${channelId} 時發生錯誤:`, error);
                }
            }
        }

        console.log("交易頻道發文限制檢查完成");
    } catch (error) {
        console.error('檢查交易頻道發文限制時發生錯誤:', error);
    }
}

// 處理用戶訊息並刪除超額文章
async function processUserMessages(client, channel, userId, userMessages) {
    try {
        const user_limit_7day = 15;
        console.log(`檢查用戶 ${userId} 在頻道 ${channel.name} 的發文`);
        
        // 按時間排序（舊到新）
        userMessages.sort((a, b) => a.createdAt - b.createdAt);
        
        console.log(`用戶 ${userId} 在過去7天內發了 ${userMessages.length} 篇文章`);

        // 如果超過7篇，刪除最舊的文章
        if (userMessages.length > user_limit_7day) {
            const messagesToDelete = userMessages.slice(0, userMessages.length - 7);
            console.log(`用戶 ${userId} 超過限制，需要刪除 ${messagesToDelete.length} 篇舊文章`);

            // 獲取用戶資訊用於通知
            let userInfo = null;
            try {
                const targetUser = await client.users.fetch(userId);
                userInfo = `${targetUser.tag} (${targetUser.id})`;
            } catch (error) {
                userInfo = `未知用戶 (${userId})`;
            }

            // 記錄要刪除的訊息ID
            const deletedMessageIds = [];
            
            for (const message of messagesToDelete) {
                try {
                    deletedMessageIds.push(message.id);
                    // await message.delete();
                    console.log(`已刪除用戶 ${userId} 的訊息: ${message.id}`);
                                        
                    // 添加延遲以避免速率限制
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (deleteError) {
                    console.error(`刪除訊息 ${message.id} 時發生錯誤:`, deleteError);
                }
            }

            // 發送管理員通知
            try {
                const adminChannel = await client.channels.fetch('1409325500832415796');
                if (adminChannel && adminChannel.isTextBased()) {
                    const messageIdList = deletedMessageIds.join(', ');
                    await adminChannel.send(`🚨 **交易頻道自動處分**
**用戶：** ${userInfo}
**頻道：** ${channel.name}
**違規：** 7天內發文 ${userMessages.length} 篇（限制 7 篇）
**處理：** 已刪除 ${messagesToDelete.length} 篇舊文
**訊息ID：** ${messageIdList}`);
                }
            } catch (adminError) {
                console.error('發送管理員通知時發生錯誤:', adminError);
            }

            // 發送私訊通知用戶（可選）
            try {
                // const user = await client.users.fetch(userId);
                const user = await client.users.fetch("287251356207546369");
                const targetUser = await client.users.fetch(userId);
                await user.send(`${targetUser.displayName || targetUser.username} 您好，

您在交易頻道 ${channel.name} 的舊文章已被自動刪除，因為您在7天內發文超過 ${user_limit_7day} 篇。
請遵守版規：個別交易頻道每人每週可同時存在文章數量為 7 篇。

(本訊息由系統自動發送，請勿回覆，若有疑問請洽魔力寶貝頻道管理員)`);
            } catch (dmError) {
                console.log(`無法發送私訊給用戶 ${userId}:`, dmError.message);
            }


        }
    } catch (error) {
        console.error(`檢查用戶 ${userId} 發文時發生錯誤:`, error);
    }
}

// 如果直接執行此文件，則啟動檢查
if (import.meta.url === `file://${process.argv[1]}`) {
    const client = new Client({
        intents: [GatewayIntentBits.MessageContent,
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMembers]
    });

    client.once('ready', () => {
        console.log(`Logged in as ${client.user.tag}!`);
        checkTradingChannelPosts(client);
    });

    client.login(config.discord);
}
