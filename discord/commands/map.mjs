import request from 'request';

import {SlashCommandBuilder} from "discord.js";
import {readFile} from 'fs/promises';

const config = JSON.parse(
    await readFile(
        new URL('../../config.json', import.meta.url)
    )
);

var maps = {
    "龜裂的地下道": "4",
    "牛鬼的洞窟": "4",
    "城內的地下迷宮": "2",
    "暖爐之底": "4",
    "黑暗醫生的洞窟": "4",
    "海賊的洞窟": "4",
    "迷宮裡的通道": "2",
    "霞之洞窟": "2",
    "水之洞窟": "2",
    "水之迷宮": "1",
    "土之迷宮": "1",
    "藏身之迷宮": "4",
    "貝力斯遺跡": "8",
    "終極叢林領域": "6",
    "魔王的叢林領域": "6",
    "秘密通道(S)": "6",
    "秘密通道(C)": "6",
    "秘密通道(B)": "6",
    "秘密通道(A)": "6",
    "秘密通道(D)": "6",
    "迷惘的內心迷宮": "6",
    "東醫地下室": "6",
    "暗醫藏身處": "4",
    "音樂魔域": "4",
    "罪惡根源": "4",
    "罪惡顛峰": "6",
    "奴克冰原": "4",
    "古井地下通道": "4",
    "楚國的秘密捷徑": "4",
    "芙蕾亞迷宮": "2",
    "海盜的巢穴": "30",
    "海盜暗道": "40",
    "天混界": "4",
    "巢穴": "40",
    "暗道": "40",
    "暗黑醫師的藏身處": "4",
    "謎之迷宮": "3",
    "哥布林之家": "4",
    "奇怪的洞窟": "4",
    "佈滿青苔的洞窟": "4",
    "迷路之穴": "2",
    "白龍城": "4",
    "黑龍城": "4",
    "炎之洞窟": "4",
    "阿魯巴斯的洞窟": "4",
    "黑色的祈禱": "4",
    "羅連斯研究塔": "4",
    "砂漠之祠": "6",
    "砂塵的洞窟": "4",
    "峽之洞窟": "4",
    "風之洞窟": "4",
    "迷路的龍之巢": "3",
    "貝茲雷姆的迷宮": "4",
    "科學家的牢房": "4",
    "積雪的山路": "4",
    "蜥蜴之巢": "3",
    "奇怪的坑道": "4",
    "永久凍土": "4",
    "深淵": "4",
    "詢問之地": "4",
    "布朗山": "4",
    "地下水脈": "8",
    "地下遺跡": "2.5",
    "大樹": "4",
    "無人的洞窟": "4",
    "時波之祠": "4",
    "深綠的山道": "4",
    "雷姆爾山": "4",
    "森之迷宮": "4",
    "詛咒者之洞窟": "4",
    "祕密通道": "2",
    "魔導研究塔": "4",
    "麥尼洞窟": "3",
    "島之洞窟": "3.5",
    "夢魔的迷宮": "4",
    "蟲洞": "2",
    "羽音洞窟": "5",
    "貝勒森林　外城": "4",
    "貝勒森林　火之領域": "2",
    "貝勒森林　水之領域": "2",
    "貝勒森林　土之領域": "2",
    "貝勒森林　本城": "2",
    "海底墓場外苑": "2",
    "四昏神的領域": "4",
    "深草綠洞": "4",
    "怨靈洞窟": "4",
    "白之練兵場": "8",
    "機密實驗場": "12",
    "遺跡的殘骸": "24",
    "封魔之地域": "24",
    "封魔之水域": "24",
    "封魔之火域": "24",
    "封魔之風域": "24",
    "封魔之領域": "24",
    "東方山巒的山道": "6",
    "魔族地下城": "6",
    "壁爐": "4",
    "商城閣樓": "4",
    "冰之神殿": "4",
    "火炎之谷": "4",
    "砂之塔": "4",
    "殷紅的山谷": "8",
    "彩葉原": "8",
    "墓道": "4",
    "魔族領域": "6",
    "魔族通道": "6",
    "里歐波多洞窟": "2",
    "萬縷相思結晶路": "2",
    "書屋地下": "4",
    "杜瓦之塔": "8",
    "艾汀之塔": "8",
    "諾利之塔": "8",
    "地下室": "4",
    "水之廊": "4",
    "時間": "4",
    "邊境走廊": "8"
};


const MapCommand = {
        data:
            new SlashCommandBuilder()
                .setName('重組')
                .setDescription('查詢重組時間'),
        async execute(interaction) {

            await interaction.deferReply();

            const mapconfig = JSON.parse(
                await readFile(
                    new URL('../../mapconfig.json', import.meta.url)
                )
            );


            var time = parseInt(mapconfig.host_time, 10);
            var nowTime = new Date().getTime();

            var mapNames = Object.keys(maps);
            var diff = (nowTime - time) / (1000 * 60);

            var msg = mapNames.filter(n => maps[n] == "4").map(n => {
                var minutes = parseFloat(maps[n]) * 60;

                var newtime = minutes * (Math.floor(diff / minutes) + 1);

                let date = new Date(time + newtime * 1000 * 60);
                return n + ":" + date.toLocaleDateString() + " " + date.toLocaleTimeString();
            })

            await interaction.editReply(
                msg.join("\n") + "\n\n" +
                "回報人:" + mapconfig.reporter + ", 回報最後伺服器開機時間:" + new Date(mapconfig.host_time) + ", 最後回報時間:" + new Date(mapconfig.update));

        }
    }
;

export {MapCommand}