import request from 'request';

import {SlashCommandBuilder} from "discord.js";
import {readFile} from 'fs/promises';

const config = JSON.parse(
    await readFile(
        new URL('../../config.json', import.meta.url)
    )
);

async function askGPT(word) {
    const options = {
        method: 'POST',
        url: 'https://api.openai.com/v1/chat/completions',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': config.gpt_token
        },
        json: {
            "model": "gpt-3.5-turbo",
            "messages": [{
                "role": "user",
                "content": "你是龍與地下城中的一個NPC村民，名叫阿蒙，你平常負責給予玩家稱號帶點傲嬌，但你常常處於一個不耐煩的狀態，回應的時候會有點兇。" +
                    "回復請用\'阿蒙：\' 開頭，請你以上面的設定，回應玩家以下對你所說的話: " + word
            }]
        }
    };


    return new Promise((resolve, reject) => {

        request(options, (error, response, body) => {
            if (error) {
                console.error(error);
                return;
            }
            if (body.choices.length == 0) {
                resolve([]);
                return null;
            }

            let data = body.choices[0].message.content;
            resolve(data);
        });
    })
}


///掉檔 紅色口臭鬼 1  122  102  36 33  28
const AskGptCommand = {
        data:
            new SlashCommandBuilder()
                .setName('閒聊')
                .setDescription('跟阿蒙聊天')
                .addStringOption(option =>
                    option.setName('content')
                        .setDescription('任意想說的話')),
        async execute(interaction) {


            const reason = interaction.options.getString('content') ?? '';

            if (reason.trim() == "") {
                await interaction.reply('嗯。。。我想不出更好的稱號了。');
                return false;
            }
            await interaction.deferReply();
            const word = await askGPT(reason);
            await interaction.editReply("：：" + reason + "\n\n " + word);

        }
    }
;

export {AskGptCommand}