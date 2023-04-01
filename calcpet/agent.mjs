import {RealGuess} from "./Pets.mjs"

// const results = RealGuess("紅色口臭鬼", 1, 122, 102, 36, 33, 28);

const token = "小白龍 1 82 68 4 34 38".split(/ /);
const results = RealGuess(token[0], ...token.slice(1).map(n => parseInt(n)));


console.log("寵物名稱:" + results.pet.name)
console.log("寵物總檔次", results.bps.join(","))
console.log("===檔次計算===");
if (results.results.length == 0) {
    console.log("無解")
}
for (var r of results.results) {
    console.log(r.guess.str());
    console.log("可能檔次", r.GuessBPs.join(","), r.LostBP, r.SumGrowBPs);
    console.log("穩掉", r.PossibleLost.sumSureLost, "分布", r.PossibleLost.sureLost.join(","));
    // console.log("基本檔穩超過", r.PossibleLost.sumSureBase, "分布", r.PossibleLost.sureBaseOver);
    console.log("可能掉檔分布", r.PossibleLost.possibleLostRange.join(","));
}