import { SlashCommandBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";

const TwinRoleCommand = {
    data: new SlashCommandBuilder()
        .setName('雙子身分組')
        .setDescription('在指定頻道創建一個用於獲取[雙子]身分組的按鈕')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        // 權限檢查
        const hasPermission = interaction.member.permissions.has(PermissionFlagsBits.ManageRoles) ||
            interaction.member.roles.cache.some(role => 
                ['管理員', 'Admin', 'Administrator'].includes(role.name)
            );

        if (!hasPermission) {
            return await interaction.reply({ 
                content: '你沒有權限使用此指令！', 
                ephemeral: true 
            });
        }

        // 指定頻道ID
        const targetChannelId = '1090953718691794994';

        // 檢查是否在指定頻道執行
        try {
            const targetChannel = await interaction.guild.channels.fetch(targetChannelId);
            
            if (!targetChannel) {
                return await interaction.reply({
                    content: '找不到目標頻道！',
                    ephemeral: true
                });
            }

            // 創建按鈕
            const button = new ButtonBuilder()
                .setCustomId('get-twin-role')
                .setLabel('獲取身分組進入頻道')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder()
                .addComponents(button);

            // 發送消息到指定頻道
            await targetChannel.send({
                content: '已看完規定, 點擊下方按鈕獲取[雙子]身分組！',
                components: [row]
            });

            await interaction.reply({
                content: `已在頻道 <#${targetChannelId}> 創建[雙子]身分組按鈕！`,
                ephemeral: true
            });
            
        } catch (error) {
            console.error('創建雙子身分組按鈕時出錯:', error);
            await interaction.reply({
                content: '執行指令時發生錯誤！',
                ephemeral: true
            });
        }
    },

    // 處理按鈕交互
    async handleButtonInteraction(interaction) {
        // 檢查是否是我們的按鈕
        if (interaction.customId !== 'get-twin-role') return;

        try {
            // 查找[雙子]身分組
            const twinRole = interaction.guild.roles.cache.find(role => role.name === '雙子');
            // 查找[法蘭發言證]身分組
            const speakRole = interaction.guild.roles.cache.find(role => role.name === '法蘭發言證');
            
            if (!twinRole || !speakRole) {
                let missing = [];
                if (!twinRole) missing.push('[雙子]');
                if (!speakRole) missing.push('[法蘭發言證]');
                return await interaction.reply({
                    content: `找不到${missing.join('、')}身分組！請聯繫管理員。`,
                    ephemeral: true
                });
            }

            // 檢查用戶是否已有[雙子]和[法蘭發言證]身分組
            const hasTwin = interaction.member.roles.cache.has(twinRole.id);
            const hasSpeak = interaction.member.roles.cache.has(speakRole.id);

            if (hasTwin && hasSpeak) {
                return await interaction.reply({
                    content: '你已經擁有[雙子]和[法欄發言證]身分組了！',
                    ephemeral: true
                });
            }

            // 要添加的身分組
            const rolesToAdd = [];
            if (!hasTwin) rolesToAdd.push(twinRole);
            if (!hasSpeak) rolesToAdd.push(speakRole);

            await interaction.member.roles.add(rolesToAdd);

            let msg = '成功獲取';
            if (!hasTwin && !hasSpeak) {
                msg += '[雙子]和[法欄發言證]身分組！';
            } else if (!hasTwin) {
                msg += '[雙子]身分組！';
            } else if (!hasSpeak) {
                msg += '[法欄發言證]身分組！';
            }

            await interaction.reply({
                content: msg,
                ephemeral: true
            });
            
        } catch (error) {
            console.error('授予雙子或法欄發言證身分組時出錯:', error);
            await interaction.reply({
                content: '處理請求時發生錯誤！請稍後再試或聯繫管理員。',
                ephemeral: true
            });
        }
    }
};

export { TwinRoleCommand }