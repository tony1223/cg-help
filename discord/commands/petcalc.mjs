import {SlashCommandBuilder} from "discord.js";
import {RealGuess, GuessResultToString, updatePets, Pts} from "../../src/calcpet/Pets.mjs"
import fs from "fs";

updatePets();
setInterval(updatePets, 1000 * 60 * 60 * 4);

function findOverlap(a, b) {
    if (b == null) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        const ind = b.indexOf(a[i]);
        if (ind !== -1) {
            return true; // 有找到重疊字，回傳 true
        }
    }
    return false; // 沒有找到重疊字，回傳 false
}

///掉檔 紅色口臭鬼 1  122  102  36 33  28
const PetCalcCommand = {
        data:
            new SlashCommandBuilder()
                .setName('掉檔')
                .setDescription('寵次檔次計算')
                .addStringOption(option =>
                    option.setName('petdata')
                        .setDescription('寵物名稱 <等級(一級可不寫)> 血 魔 攻 防 敏')),
        isSupportMessage: function (msg) {
            const token = msg.content.split(/ +/gi);

            if (PetCalcCommand.lookup(token[0]) || PetCalcCommand.lookup(token[1])) {
                return true;
            }
            return false;
        },
        lookup(text) {
            const commands = ["算檔", "算黨", "掉檔", "掉黨"];
            return commands.filter(n => text == n || text.indexOf(n) != -1).length;
        },
        handleMessage: (msg) => {

            const cont = msg.content;
            const token = cont.split(/ +/gi);
            let reason = null;

            if (PetCalcCommand.lookup(token[0])) {
                reason = cont.substring(cont.indexOf(token[0]) + token[0].length)
            } else {
                reason = cont.substring(cont.indexOf(token[1]) + token[1].length)
            }
            return PetCalcCommand.handler(reason, (res) => {
                    msg.channel.send(res);
                    msg.channel.send(("\n==\n 指令: /掉檔 寵物名稱 <等級(一級可不寫)> 血 魔 攻 防 敏 "));
                },
                {});
        },
        handler: async function (reason, reply, logResult) {

            logResult.command = "Calc";
            logResult.input = reason;

            if (!fs.existsSync("log")) {
                fs.mkdirSync("log");
            }
            const today = new Date();

            if (!reason) {
                logResult.error = "No Data";
                await reply({content: '沒有輸入任何資訊', ephemeral: true});

                fs.appendFileSync("./log/" + today.getFullYear() + "" + today.getMonth() + "" + today.getDate() + ".txt",
                    "\r\n" + JSON.stringify(logResult), 'utf8'
                )

                return false;
            }

            const tokens = reason.trim().split(/[ ]+/);
            // console.log(tokens);

            let lvl = 0;
            let params = [];

            if (tokens.length == 6) {
                lvl = 1;
                params = [
                    parseInt(tokens[1], 10),
                    parseInt(tokens[2], 10),
                    parseInt(tokens[3], 10),
                    parseInt(tokens[4], 10),
                    parseInt(tokens[5], 10),
                ];
            } else {
                lvl = parseInt(tokens[1]);
                params = [
                    parseInt(tokens[2], 10),
                    parseInt(tokens[3], 10),
                    parseInt(tokens[4], 10),
                    parseInt(tokens[5], 10),
                    parseInt(tokens[6], 10),
                ];
            }

            const petName = tokens[0];
            const results = RealGuess(petName,
                lvl, ...params);

            logResult.results = results;

            if (!results.pet.find) {
                const possibleNames = Pts.filter(n => n[1].length == petName.length && findOverlap(n[1], petName)).map(n => "[" + n[1] + "]");

                let msg = "";
                if (possibleNames.length) {
                    msg = "你是否要找以下這些寵物？ " + possibleNames.join("、") + " ";
                }
                await reply({content: '寵物名稱 [' + petName + "] 查無符合寵物.\n" + msg, ephemeral: true});

                fs.appendFileSync("./log/" + today.getFullYear() + "" + today.getMonth() + "" + today.getDate() + ".txt",
                    "\r\n" + JSON.stringify(logResult), 'utf8'
                )
                return false;
            }
            const limit = 10;
            const showDetails = 100;
            const res = "輸入資料:" + reason.trim() + "\n" + GuessResultToString(results, limit, showDetails);


            //紀錄資料之後驗算確認用
            fs.appendFileSync("./log/" + today.getFullYear() + "" + today.getMonth() + "" + today.getDate() + ".txt",
                "\r\n" + JSON.stringify(logResult), 'utf8'
            )

            await reply({content: res, ephemeral: true});
        }, async execute(interaction) {

            await interaction.deferReply({ephemeral: true});
            const logResult = ({
                user: {
                    id: interaction.user.id,
                    username: interaction.user.username,
                    discriminator: interaction.user.discriminator,
                },
                guild: {
                    id: interaction.guild.id,
                    name: interaction.guild.name
                }
            });

            console.log("receive action from " + interaction.user.username + "#" + interaction.user.id);
            const reason = interaction.options.getString('petdata') ?? '';
            return await this.handler(reason, (msg) => {
                interaction.editReply(msg);
            }, logResult);
            // await interaction.reply(out.join("\n"));
        }
    }
;

export {PetCalcCommand}