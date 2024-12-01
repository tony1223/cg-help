import { SlashCommandBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";
import { readFile } from 'fs/promises';

// ... existing config code ...

const AnnounceCommand = {
    data: new SlashCommandBuilder()
        .setName('公告')
        .setDescription('在指定頻道發布公告')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('要發布公告的頻道')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('content')
                .setDescription('公告內容')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('button_label')
                .setDescription('按鈕文字（可選）'))
        .addStringOption(option =>
            option.setName('button_type')
                .setDescription('按鈕類型')
                .addChoices(
                    { name: 'URL連結', value: 'url' },
                    { name: '命令', value: 'command' },
                ))
        .addStringOption(option =>
            option.setName('button_value')
                .setDescription('按鈕連結或命令ID'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        // 權限檢查
        const hasPermission = interaction.member.permissions.has(PermissionFlagsBits.ManageMessages) ||
        interaction.member.roles.cache.some(role => 
            ['管理員', 'Admin', 'Administrator'].includes(role.name)
        );

        if (!hasPermission) {
            return await interaction.reply({ 
                content: '你沒有權限使用此指令！', 
                ephemeral: true 
            });
        }

        const channel = interaction.options.getChannel('channel');
        const content = interaction.options.getString('content');
        const buttonLabel = interaction.options.getString('button_label');
        const buttonType = interaction.options.getString('button_type');
        const buttonValue = interaction.options.getString('button_value');

        const messageOptions = { content };

        // 如果有提供按鈕相關參數
        if (buttonLabel && buttonType && buttonValue) {
            const button = new ButtonBuilder()
                .setLabel(buttonLabel);

            if (buttonType === 'url') {
                // URL類型按鈕
                button
                    .setStyle(ButtonStyle.Link)
                    .setURL(buttonValue);
            } else {
                // 命令類型按鈕
                button
                    .setStyle(ButtonStyle.Primary)
                    .setCustomId(buttonValue);
            }

            const row = new ActionRowBuilder()
                .addComponents(button);

            messageOptions.components = [row];
        }

        try {
            await channel.send(messageOptions);
            await interaction.reply({ 
                content: '公告已發布成功！', 
                ephemeral: true 
            });
        } catch (error) {
            console.error(error);
            await interaction.reply({ 
                content: '發布公告時發生錯誤！', 
                ephemeral: true 
            });
        }
    }
};

export { AnnounceCommand }