import {SlashCommandBuilder} from "discord.js";

import {RealGuess} from "../calcpet/Pets.mjs"
import fs from "fs";
///掉檔 紅色口臭鬼 1  122  102  36 33  28
const pingCommand = {
        data:
            new SlashCommandBuilder()
                .setName('掉檔')
                .setDescription('寵次檔次計算')
                .addStringOption(option =>
                    option.setName('petdata')
                        .setDescription('寵物名稱 <等級(一級可不寫)> 血 魔 攻 防 敏')),
        async execute(interaction) {

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
            logResult.command = "Calc";
            logResult.input = reason;


            if (!fs.existsSync("log")) {
                fs.mkdirSync("log");
            }
            const today = new Date();

            if (!reason) {
                logResult.error = "No Data";
                await interaction.reply('沒有輸入任何資訊');

                fs.appendFileSync("./log/" + today.getFullYear() + "" + today.getMonth() + "" + today.getDate() + ".txt",
                    "\r\n" + JSON.stringify(logResult), 'utf8'
                )

                return false;
            }

            const tokens = reason.split(/[ ]+/);
            // console.log(tokens);

            let lvl = 0;
            if (tokens.length == 6) {
                lvl = 1;
            } else {
                lvl = parseInt(tokens[1]);
            }
            const params = [
                parseInt(tokens[2], 10),
                parseInt(tokens[3], 10),
                parseInt(tokens[4], 10),
                parseInt(tokens[5], 10),
                parseInt(tokens[6], 10),
            ];

            const results = RealGuess(tokens[0],
                lvl, ...params);

            logResult.results = results;

            if (results.pet == null) {
                await interaction.reply('寵物名稱 [' + tokens[0] + "] 查無符合寵物.");

                fs.appendFileSync("./log/" + today.getFullYear() + "" + today.getMonth() + "" + today.getDate() + ".txt",
                    "\r\n" + JSON.stringify(logResult), 'utf8'
                )
                return false;
            }

            const out = [];
            out.push("輸入資料:" + reason);

            out.push("寵物名稱:" + results.pet.name)
            // out.push("寵物總檔次", results.bps.join(","))
            out.push("===計算結果===");
            if (results.results.length == 0) {
                out.push("無解")
            }
            for (var r of results.results) {
                out.push("* 掉檔:" + r.LostBP, ["至少掉檔", r.PossibleLost.sureLost.join(",")]);
                // out.push(r.guess.str());
                // out.push(["可能檔次", r.GuessBPs.join(","), r.LostBP, r.SumGrowBPs].join(","));
                // out.push(["穩掉", r.PossibleLost.sumSureLost, "分布", r.PossibleLost.sureLost.join(",")].join(","));
                // console.log("基本檔穩超過", r.PossibleLost.sumSureBase, "分布", r.PossibleLost.sureBaseOver);
                out.push(["可能掉檔分布", r.PossibleLost.possibleLostRange.join(",")].join(","));
            }
            // interaction.options.console.log(interaction)

            //紀錄資料之後驗算確認用
            fs.appendFileSync("./log/" + today.getFullYear() + "" + today.getMonth() + "" + today.getDate() + ".txt",
                "\r\n" + JSON.stringify(logResult), 'utf8'
            )

            await interaction.reply(out.join("\n"));
        }
    }
;
const commands = [
    pingCommand
]
export {commands};