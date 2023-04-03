import {RealGuess} from "./Pets.mjs"

// const results = RealGuess("紅色口臭鬼", 1, 122, 102, 36,33, 28);

const testcases = [
    "小蝙蝠 20 377 467 170 94 106"
    // "小蝙蝠 23 521 435 129 101 109",
    // "烈焰龍蝦 38 956 523 318 171 123",
//      "火焰之刃 1 82 121 45 41 28",
//     "烈焰龍蝦 38 956 523 318 171 123",
//     "黃蜂 30 657 381 197 102 158",
//     "夜行貓人 86 1883 1395 411 331 537",
//     "改造烈風哥布林 113 2287 1375 990 483 296",
//     "聖誕水藍鼠 98 2308 1327 935 328 281",
//     "粉紅炸彈 92 1500 3241 262 328 300",
//     "粉紅炸彈 97 1521 3379 235 339 296",
//     "紅色口臭鬼 1 122 102 36 33 28",
//     "火焰之刃 1 82 121 45 41 28"
]

for (var testcase of testcases) {
    const token = testcase.split(/ /);

    const results = RealGuess(token[0], ...token.slice(1).map(n => parseInt(n)));

    console.log("寵物名稱:" + results.pet.name)
    console.log("寵物總檔次", results.bps.join(","))
    console.log("===檔次計算===");
    if (results.results.length == 0) {
        console.log("無解")
    }
    for (var r of results.results) {
        // console.log(r.guess.str());
        console.log("可能檔次", r.GuessRange.toArray().join(","), r.LostBP, r.SumGrowBPs);
        console.log("穩掉", r.PossibleLost.sumSureLost, "分布", r.PossibleLost.sureLost.join(","));
        // console.log("基本檔穩超過", r.PossibleLost.sumSureBase, "分布", r.PossibleLost.sureBaseOver);
        console.log("可能掉檔分布", r.PossibleLost.possibleLostRange.join(","));
    }
}