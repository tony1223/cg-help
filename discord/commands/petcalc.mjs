import {SlashCommandBuilder} from "discord.js";
import {RealGuess, calcDiff, minmax} from "../../src/calcpet/Pets.mjs"
import fs from "fs";
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
            if (token[1] == "算檔" ||
                token[1] == "掉檔"
            ) {
                return true;
            }
        },
        handleMessage: (msg) => {

            const cont = msg.content;
            const token = cont.split(/ +/gi);
            const reason = cont.substring(cont.indexOf(token[1]) + token[1].length);
            return PetCalcCommand.handler(reason, (res) => {
                    msg.channel.send(res);
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

            const results = RealGuess(tokens[0],
                lvl, ...params);

            logResult.results = results;

            if (!results.pet.find) {
                await reply({content: '寵物名稱 [' + tokens[0] + "] 查無符合寵物.", ephemeral: true});

                fs.appendFileSync("./log/" + today.getFullYear() + "" + today.getMonth() + "" + today.getDate() + ".txt",
                    "\r\n" + JSON.stringify(logResult), 'utf8'
                )
                return false;
            }

            const out = [];
            out.push("輸入資料:" + reason);

            out.push("寵物名稱:" + results.pet.name)
            // out.push("寵物總檔次", results.bps.join(","))

            const petGrowRanges = results.bps;
            const limit = 10;
            const showDetails = 100;
            if (results.results.length > limit) {
                if (results.results.length > showDetails) {
                    out.push("===計算結果===(共有 " + (results.results.length - limit) + " 個結果，超過 " + showDetails + "個組合，不顯示詳細結果), 分布是 血 攻 防 敏 魔 順序");
                } else {
                    out.push("===計算結果===(只列出 " + limit + " 個結果, 共有: " + (results.results.length) + " 個可能解), 分布是 血 攻 防 敏 魔 順序");
                }
            } else {
                out.push("===計算結果===(所有), 分布是 血 攻 防 敏 魔 順序");
            }

            let _results = results.results;
            if (lvl != 1) {
                _results = _results.sort((n, n2) => {
                    let cp1 = n.ManualPoints.filter(n => n == 0).length;
                    let cp2 = n2.ManualPoints.filter(n => n == 0).length;

                    if (cp1 != cp2) {
                        return cp2 - cp1;
                    }

                    let diffMX1 = minmax(n.ManualPoints);
                    let diffMX2 = minmax(n2.ManualPoints);
                    let diff1 = diffMX1.length == 1 ? diffMX1[0] : (diffMX1[1] - diffMX1[0]);
                    let diff2 = diffMX2.length == 1 ? diffMX2[0] : (diffMX2[1] - diffMX2[0]);

                    return diff2 - diff1;

                });
            }

            if (_results.length) {
                const lostBP = minmax(_results.map(n => n.LostBP));
                const ranges = [
                    minmax(_results.map(n => petGrowRanges[0] - n.GuessRange.hpp)).join(" ~ "),
                    minmax(_results.map(n => petGrowRanges[1] - n.GuessRange.attackp)).join(" ~ "),
                    minmax(_results.map(n => petGrowRanges[2] - n.GuessRange.defendp)).join(" ~ "),
                    minmax(_results.map(n => petGrowRanges[3] - n.GuessRange.agip)).join(" ~ "),
                    minmax(_results.map(n => petGrowRanges[4] - n.GuessRange.mpp)).join(" ~ ")
                ];
                const fixed = ranges.filter(n => n.indexOf("~") != -1).length == 0;
                if (fixed) {
                    out.push("總掉檔: " + lostBP.join(" ~ ") + " , 定檔 : \t" + ranges.join(" , "))
                } else {
                    out.push("總掉檔: " + lostBP.join(" ~ ") + " , 掉檔可能解範圍: \t" + ranges.join(" , "))
                }
            }

            if (_results.length == 0) {
                out.push(" 無解 (可以確認是否有未點點數或裝備寵物裝備中) ")
            }

            if (_results.length < showDetails && _results.length != 0) {
                out.push("===詳細情形===");
                _results = _results.slice(0, limit);
                for (let r of _results) {
                    if (r.RandomRange) {
                        if (lvl == 1) {
                            out.push("* 掉檔:" + r.LostBP + " , " + "本解確定掉檔 " +
                                calcDiff(r.GuessRange.toArray(), r.MaxGrowBPs).join(", ") + " "
                                + "\n\t" + ["隨機檔分布\t", r.RandomRange.join(",")].join(", "));
                        } else {
                            out.push("* 掉檔:" + r.LostBP + " , " + "本解確定掉檔 " +
                                calcDiff(r.MaxGrowBPs, r.GuessRange.toArray()).join(", ") + " "
                                + "\n\t" + ["隨機檔分布\t", r.RandomRange.join(",")].join(", ")
                                + "\t加點分布\t" + r.ManualPoints.join(", "));
                        }

                    }
                }
            }
            //紀錄資料之後驗算確認用
            fs.appendFileSync("./log/" + today.getFullYear() + "" + today.getMonth() + "" + today.getDate() + ".txt",
                "\r\n" + JSON.stringify(logResult), 'utf8'
            )

            await reply({content: out.join("\n"), ephemeral: true});
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