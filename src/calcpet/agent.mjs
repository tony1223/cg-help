import {RealGuess, GuessResultToString, GrowRange} from "./Pets.mjs"

// const results = RealGuess("紅色口臭鬼", 1, 122, 102, 36,33, 28);

const testcases = [
    // "水藍鼠 21 329 676 84 119 91",
    // "小蝙蝠 20 377 467 170 94 106",
    // "小蝙蝠 23 521 435 129 101 109",
    // "烈焰龍蝦 38 956 523 318 171 123",
    // "火焰之刃 1 82 121 45 41 28",
    // "螳螂 1 95 83 50 39 33"
    // "烈焰龍蝦 38 956 523 318 171 123",
    // "黃蜂 30 657 381 197 102 158",
    // "夜行貓人 86 1883 1395 411 331 537",
    // "改造烈風哥布林 113 2287 1375 990 483 296",
    // "聖誕水藍鼠 98 2308 1327 935 328 281",
    // "粉紅炸彈 92 1500 3241 262 328 300",
    // "粉紅炸彈 97 1521 3379 235 339 296",
    // "紅色口臭鬼 1 122 102 36 33 28",
    // "火焰之刃 1 82 121 45 41 28",
    // "天使路西法 14 377 444 50 66 56", // new GrowRange(2, 1, 0, 1, 0)
    // "水龍蜥 1 125 67 44 46 27",
    // "海盜 52 805 655 254 228 172",
    // "改造烈風哥布林 112 76 51 39 33 ",
    // "虎頭蜂 14 291 258 120 58 89 -5"
    "純白液態史萊姆 59 1815 701 280 189 140 13"
]

for (var testcase of testcases) {
    console.log("輸入資料:" + testcase);
    const token = testcase.split(/ /).filter(n => n != "");

    const params = token.slice(1).map(n => parseInt(n));
    const lvl = params.length == 5 ? 1 : params[0];
    const otherparams = params.length == 5 ? params : params.slice(1);
    const results = RealGuess(token[0], lvl,
        ...otherparams
    );
    const limit = 10;
    const showDetails = 100;
    console.log(GuessResultToString(results, limit, showDetails));
}