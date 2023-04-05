import {lusolve} from "mathjs";

import {Pts} from "./PetData.mjs";


class Stat {
    constructor(lvl, hp, mp, attack, defend, agi) {
        this.lvl = lvl;
        this.hp = hp;
        this.mp = mp;
        this.attack = attack;
        this.defend = defend;
        this.agi = agi;
    }

    guessGrow(growRange, rate) {
        const hp = growRange.hpp, atk = growRange.attackp, def = growRange.defendp, agi = growRange.agip,
            mp = growRange.mpp;
        const stat = new BP(hp * rate, atk * rate, def * rate, agi * rate, mp * rate).calcRealNum();
        // stat.print();
        stat.lvl = this.lvl;
        return stat;
    }

    // 寵物所有能力由BP決定, 血魔攻防敏各有20點的基本值, 精神跟回復基本值為
    // 100點,
    //       生命 魔力 攻擊  防禦   敏捷   精神   回復
    // +體力   8   1   0.2  0.2    0.1   -0.3   0.8
    // +力量   2   2   2.7  0.3    0.2   -0.1  -0.1
    // +強度   3   2   0.3  3      0.2    0.2  -0.1
    // +速度   3   2   0.3  0.3    2     -0.1   0.2
    // +魔法   1  10   0.2  0.2    0.1    0.8  -0.3

    toBP() {
        const hp = this.hp, mp = this.mp, atk = this.attack,
            defStat = this.defend, agi = this.agi;

        const martrix = [
            [8, 2, 3, 3, 1],
            [1, 2, 2, 2, 10],
            [0.2, 2.7, 0.3, 0.3, 0.2],
            [0.2, 0.3, 3, 0.3, 0.2],
            [0.1, 0.2, 0.2, 2, 0.1],
        ];

        // 血魔攻防敏各有20點的基本值, 精神跟回復基本值 100點,
        const base = 20;
        const b = [hp - base, mp - base, atk -
        base, defStat - base, agi - base];

        // 使用 numpy-equivalent 库求解线性方程组
        const x = lusolve(martrix, b);

        return new BP(
            x[0][0],
            x[1][0],
            x[2][0],
            x[3][0],
            x[4][0],
        );
    }

    str() {
        return ["lvl:" + this.lvl +
        ",hp:", this.hp +
        ",mp:", this.mp +
        ",attack:", this.attack +
        ",defend:", this.defend +
        ",agi:", this.agi].join("");
    }

    equal(stat) {
        return this.same(stat);
    }

    same(stat) {
        return this.hp == stat.hp &&
            this.mp == stat.mp &&
            this.attack == stat.attack &&
            this.defend == stat.defend &&
            this.agi == stat.agi
    }
}

class BP {
    constructor(hp, attack, defend, agi, mp) {
        this.hpp = hp;
        this.mpp = mp;
        this.attackp = attack;
        this.defendp = defend;
        this.agip = agi;
    }

    // 寵物所有能力由BP決定, 血魔攻防敏各有20點的基本值, 精神跟回復基本值為
    // 100點,
    //       生命 魔力 攻擊  防禦   敏捷   精神   回復
    // +體力   8   1   0.2  0.2    0.1   -0.3   0.8
    // +力量   2   2   2.7  0.3    0.2   -0.1  -0.1
    // +強度   3   2   0.3  3      0.2    0.2  -0.1
    // +速度   3   2   0.3  0.3    2     -0.1   0.2
    // +魔法   1  10   0.2  0.2    0.1    0.8  -0.3
    calcHP() {
        const martrix = [8, 2, 3, 3, 1];
        return this.hpp * martrix[0] + this.attackp * martrix[1] +
            +this.defendp * martrix[2] + this.agip * martrix[3] + this.mpp * martrix[4];
    }

    calcMP() {
        const martrix = [1, 2, 2, 2, 10];
        return this.hpp * martrix[0] + this.attackp * martrix[1] +
            +this.defendp * martrix[2] + this.agip * martrix[3] + this.mpp * martrix[4];
    }

    toArray() {
        return [this.hpp, this.attackp, this.defendp, this.agip, this.mpp];
    }

    calcATK() {
        const martrix = [0.2, 2.7, 0.3, 0.3, 0.2];
        return this.hpp * martrix[0] + this.attackp * martrix[1] +
            +this.defendp * martrix[2] + this.agip * martrix[3] + this.mpp * martrix[4];
    }


    calcDEF() {
        const martrix = [0.2, 0.3, 3, 0.3, 0.2];
        return this.hpp * martrix[0] + this.attackp * martrix[1] +
            +this.defendp * martrix[2] + this.agip * martrix[3] + this.mpp * martrix[4];
    }

    calcAGI() {
        const martrix = [0.1, 0.2, 0.2, 2, 0.1];
        return this.hpp * martrix[0] + this.attackp * martrix[1] +
            +this.defendp * martrix[2] + this.agip * martrix[3] + this.mpp * martrix[4];
    }

    calcWIS() {
        const martrix = [-0.3, -0.1, 0.2, -0.1, 0.8];
        return this.hpp * martrix[0] + this.attackp * martrix[1] +
            +this.defendp * martrix[2] + this.agip * martrix[3] + this.mpp * martrix[4];
    }

    calcRes() {
        const martrix = [0.8, -0.1, -0.1, 0.2, -0.3,];
        return this.hpp * martrix[0] + this.attackp * martrix[1] +
            +this.defendp * martrix[2] + this.agip * martrix[3] + this.mpp * martrix[4];
    }

    contains(anotherBP) {
        return this.hpp <= anotherBP.hpp
            && this.mpp <= anotherBP.mpp
            && this.attackp <= anotherBP.attackp
            && this.defendp <= anotherBP.defendp
            && this.agip <= anotherBP.agip;
    }

    sum() {
        return this.hpp
            + this.mpp
            + this.attackp
            + this.defendp
            + this.agip;
    }

    calcRealNum() {
        const propBase = 20;

        const fixPos = (n) => {
            return Math.floor(Math.round(n * 10000) / 10000);
        }
        const s = new Stat(0, ...[
            fixPos(this.calcHP()) + propBase,
            fixPos(this.calcMP()) + propBase,
            fixPos(this.calcATK()) + propBase,
            fixPos(this.calcDEF()) + propBase,
            fixPos(this.calcAGI()) + propBase,
            fixPos(this.calcWIS()) + 100,
            fixPos(this.calcRes()) + 100
        ]);//.map(n=> Math.floor(n)));

        return s;
    }

    str() {
        return ("hp:", this.hpp +
        ",mp:", this.mpp +
        ",attack:", this.attackp +
        ",defend:", this.defendp +
        ",agi:", this.agip);
    }

}


function sum(array) {
    let total = 0;

    array.forEach(value => {
        total += value;
    });

    return total;
}


function loopForSum(sum, fields, limits, cb) {
    _loopForSum(sum, fields, limits, 0, [], cb);
}

function _loopForSum(sum, fields, limits, nowSum, tmps, cb) {
    if (fields == tmps.length) {
        if (nowSum == sum) {
            cb(...tmps);
        }
        return true;
    }

    for (let i = 0; i <= sum; ++i) {
        if ((nowSum + i) <= sum && i <= limits[tmps.length]) {
            _loopForSum(sum, fields, limits, nowSum + i, [...tmps, i], cb);
        } else {
            break;
        }
    }

    return true;
}

const calcDiff = function (ar1, ar2) {
    let out = [];
    for (let i = 0; i < ar1.length; ++i) {
        out[i] = ar2[i] - ar1[i];
    }
    return out;
}


const fullRates = {
    "0": 0.00,
    "1": 0.04,
    "2": 0.08,
    "3": 0.12,
    "4": 0.16,
    "5": 0.205,
    "6": 0.25,
    "7": 0.29,
    "8": 0.33,
    "9": 0.37,
    "10": 0.415,
    "11": 0.46,
    "12": 0.50,
    "13": 0.54,
    "14": 0.58,
    "15": 0.625,
    "16": 0.67,
    "17": 0.71,
    "18": 0.75,
    "19": 0.79,
    "20": 0.835,
    "21": 0.88,
    "22": 0.92,
    "23": 0.96,
    "24": 1.00,
    "25": 1.045,
    "26": 1.09,
    "27": 1.13,
    "28": 1.17,
    "29": 1.21,
    "30": 1.255,
    "31": 1.30,
    "32": 1.34,
    "33": 1.38,
    "34": 1.42,
    "35": 1.465,
    "36": 1.51,
    "37": 1.55,
    "38": 1.59,
    "39": 1.63,
    "40": 1.675,
    "41": 1.72,
    "42": 1.76,
    "43": 1.80,
    "44": 1.84,
    "45": 1.885,
    "46": 1.93,
    "47": 1.97,
    "48": 2.01,
    "49": 2.05,
    "50": 2.095
}

// 家寵
// 總BP =  GrowSum*rate + 2 (隨機) + (n-1)*seed + (n-1)

// 野寵 
// 總BP = 

class GrowRange {

    constructor(hp, attack, defend, agi, mp, bprate) {
        this.hpp = parseFloat(hp);
        this.mpp = parseFloat(mp);
        this.attackp = parseFloat(attack);
        this.defendp = parseFloat(defend);
        this.agip = parseFloat(agi);
        if (bprate == null) {
            this.bprate = 0.2;
        } else {
            this.bprate = bprate;
        }
    }

    contains(anotherGrow) {
        return this.hpp <= anotherGrow.hpp
            && this.mpp <= anotherGrow.mpp
            && this.attackp <= anotherGrow.attackp
            && this.defendp <= anotherGrow.defendp
            && this.agip <= anotherGrow.agip;
    }

    drop(hpp, atkp, defp, agip, mpp) {
        return new GrowRange(this.hpp - Math.abs(hpp), this.attackp - Math.abs(atkp),
            this.defendp - Math.abs(defp), this.agip - Math.abs(agip),
            this.mpp - Math.abs(mpp), this.bprate);

    }

    same(agw) {
        return this.hpp == agw.hpp
            && this.mpp == agw.mpp
            && this.attackp == agw.attackp
            && this.defendp == agw.defendp
            && this.agip == agw.agip;

    }

    toArray() {
        return [this.hpp, this.attackp, this.defendp, this.agip, this.mpp];
    }


    sum() {
        return this.hpp
            + this.mpp
            + this.attackp
            + this.defendp
            + this.agip;
    }

    calcBPAtLevel(lvl, lvlpoint) {

        const bps = [
            this.hpp * this.bprate,
            this.attackp * this.bprate,
            this.defendp * this.bprate,
            this.agip * this.bprate,
            this.mpp * this.bprate,
        ];

        const lvldiff = lvl - 1;

        const shift = 0;
        bps[0] = bps[0] + (fullRates[this.hpp - shift] * lvldiff);
        bps[1] = bps[1] + (fullRates[this.attackp - shift] * lvldiff);
        bps[2] = bps[2] + (fullRates[this.defendp - shift] * lvldiff);
        bps[3] = bps[3] + (fullRates[this.agip - shift] * lvldiff);
        bps[4] = bps[4] + (fullRates[this.mpp - shift] * lvldiff);

        if (lvlpoint == null) {
            lvlpoint = lvldiff;
        }

        return {
            baseBP: new BP(...bps),
            sumBaseBP: sum(bps) + (10 * this.bprate),
            sumFullBP: sum(bps) + (10 * this.bprate) + lvlpoint
        };

    }

    mockLoopRange(grow, cb) {
        cb(sum(this.bps()), grow);

    }

    loopRange(cb) {
        const sumBP = sum(this.bps())
        const v1 = [this.hpp - 4, this.hpp + 11];
        const v2 = [this.attackp - 4, this.attackp + 11];
        const v3 = [this.defendp - 4, this.defendp + 11];
        const v4 = [this.agip - 4, this.agip + 11];
        const v5 = [this.mpp - 4, this.mpp + 11];

        for (var a = v1[0]; a <= v1[1]; a++) {
            for (var b = v2[0]; b <= v2[1]; b++) {
                for (var c = v3[0]; c <= v3[1]; c++) {
                    for (var d = v4[0]; d <= v4[1]; d++) {
                        for (var e = v5[0]; e <= v5[1]; e++) {
                            cb(sumBP, new GrowRange(a, b, c, d, e, this.bprate));
                        }
                    }
                }
            }
        }
    }

    bps() {
        return [this.hpp, this.attackp, this.defendp, this.agip, this.mpp];
    }

    guesslv1(stat, bprate) {
        const result = [];
        this.loopRange((sumBP, growRange) => {
            const guess = stat.guessGrow(growRange, bprate);
            if (guess.equal(stat)) {
                result.push({
                    SumGrowBPs: sumBP,
                    MaxGrowBPs: this.bps(),
                    GuessRange: growRange,
                    LostBP: growRange.sum() - 10 - sumBP,
                    PossibleLost: possibleLostRange(growRange, this.bps()),
                    ManualPoints: [0, 0, 0, 0, 0],
                    RandomRange: null,
                    guess
                });
            }
        })
        return result;
    }

    guess(stat, targetGrow = null) {

        let res = this.guessWithSpecficLvlPoint(stat, stat.lvl - 1, targetGrow);

        // if (stat.lvl == 1) {
        //     return this.guesslv1(stat, bprate);
        // }

        if (res.length == 0 && stat.lvl != 1) {
            res = this.guessWithSpecficLvlPoint(stat, 0, targetGrow);
        }

        return res;
    }


    guessWithSpecficLvlPoint(stat, point, targetGrow) {
        const result = [];

        const calcBP = stat.toBP();

        const statUp = new Stat(stat.lvl, stat.hp + 1, stat.mp + 1, stat.attack + 1,
            stat.defend + 1, stat.agi + 1);
        const calcUpBp = statUp.toBP();

        const oSum = calcBP.sum();
        const oUpSum = calcUpBp.sum();

        const results = [];

        if (targetGrow) {
            this.mockLoopRange(this.drop(...targetGrow.toArray()), (sumBP, growRange) => {
                return this._handleGuessingGrowRange(growRange, stat, point, oSum,
                    oUpSum, calcUpBp, results, result, sumBP);
            })
            return result;
        }
        // this.mockLoopRange(this.drop(2, 1, 0, 1, 0), (sumBP, growRange) => {
        this.loopRange((sumBP, growRange) => {
            return this._handleGuessingGrowRange(growRange, stat, point, oSum,
                oUpSum, calcUpBp, results, result, sumBP);
        })

        return result;
    }


    _handleGuessingGrowRange(growRange, stat, point, oSum, oUpSum, calcUpBp, results, result, sumBP) {
        if (!growRange.contains(this)) {
            return false;
        }
        const res = growRange.calcBPAtLevel(stat.lvl, point);

        if ((res.sumFullBP >= oSum && res.sumFullBP <= oUpSum)) {
            const softLimit = calcDiff(res.baseBP.toArray(), calcUpBp.toArray()).map(n => n + 1);
            loopForSum(point, 5, softLimit, (a, b, c, d, e) => {
                loopForSum(10, 5, [10, 10, 10, 10, 10], (a1, b1, c1, d1, e1) => {
                    const bps = res.baseBP.toArray();
                    const bp = new BP(bps[0] + a + growRange.bprate * a1,
                        bps[1] + b + growRange.bprate * b1,
                        bps[2] + c + growRange.bprate * c1,
                        bps[3] + d + growRange.bprate * d1,
                        bps[4] + e + growRange.bprate * e1,
                    );

                    const calcState = bp.calcRealNum();
                    if (calcState.same(stat)) {
                        results.push({growRange,})
                        result.push({
                            SumGrowBPs: sumBP,
                            MaxGrowBPs: this.bps(),
                            GuessRange: growRange,
                            LostBP: growRange.sum() - sumBP,
                            PossibleLost: possibleLostRange(growRange, this.bps()),
                            guess: calcState,
                            ManualPoints: [a, b, c, d, e],
                            RandomRange: [a1, b1, c1, d1, e1]
                        });
                    }

                })
            });
        }
    }


}

function GuessResultToString(results) {

    if (!results.pet.find) {
        return ('寵物名稱 [' + results.pet.name + "] 查無符合寵物.");
    }
    const lvl = results.pet.lvl;

    const out = [];

    out.push("寵物名稱:" + results.pet.name)
    // out.push("寵物總檔次", results.bps.join(","))

    const petGrowRanges = results.bps;
    const limit = 10000;
    const showDetails = 10000;
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

    return (out.join("\n"));
}

function possibleLostRange(growRange, maxBP) {
    const maxBasePos = 10;

    const sureLost = [];
    const guessRange = growRange.toArray();
    for (var i = 0; i < guessRange.length; ++i) {
        if (guessRange[i] < maxBP[i]) {
            sureLost[i] = maxBP[i] - guessRange[i];
        } else {
            sureLost[i] = 0;
        }
    }
    const sumSureLost = sum(sureLost);

    const sureBaseOver = [];
    for (var i = 0; i < guessRange.length; ++i) {
        if (guessRange[i] > maxBP[i]) {
            sureBaseOver[i] = guessRange[i] - maxBP[i];
        } else {
            sureBaseOver[i] = 0;
        }
    }
    let sumSureBase = sum(sureBaseOver);

    const possibleLostRange = [];
    for (var i = 0; i < guessRange.length; ++i) {
        const min = maxBP[i] - 5;
        let max = maxBP[i];
        const thisoverBase = guessRange[i] - maxBP[i];
        const otherOverbase = sumSureBase - thisoverBase;
        let localMax = maxBasePos - otherOverbase;
        possibleLostRange[i] = [
            Math.max(0, max - guessRange[i]),
            Math.min(4, max + localMax - guessRange[i])];
    }


    // console.log("穩掉", sumSureLost, "分布", sureLost);
    // console.log("基本檔穩超過", sumSureBase, "分布", sureBaseOver);
    // console.log("可能掉檔分布", possibleLostRange.map(n => n[0] + "~" + n[1]));

    return {
        sumSureLost, sureLost,
        possibleLostRange: possibleLostRange.map(n => n[0] + "~" + n[1])
    }
}

function testcase1() {

    const rng = new GrowRange(11, 15, 28, 28, 33);

    const stat = new Stat(1, 81, 112, 34, 39, 33);
    const results = rng.guess(stat, bprate);

    for (var r of results) {
        console.log(r.FullGrowBPs, r.lostBP, r.SumGrowBPs);
        console.log(r.guess.toString());
    }

}


function RealGuessRaw(input) {
    const token = input.trim().split(/ /);
    return RealGuess(token[0], ...token.slice(1).map(n => parseInt(n)));
}

function RealGuess(name, lvl, hp, mp, attack, def, agi, targetGrow) {

    const pet = Pts.filter(n => n[1] == name)[0];
    if (pet == null) {
        return {pet: {name: name, find: false, lvl: lvl}};
    }


    const bps = [pet[3], pet[4], pet[5], pet[6], pet[7]];
    try {
        const bprate = pet[8] == null ? 0.2 : parseFloat(pet[8]);
        const rng = new GrowRange(...bps, bprate);

        const stat = new Stat(lvl, hp, mp, attack, def, agi);
        const results = rng.guess(stat, targetGrow);

        return {pet: {name: pet[1], find: true, lvl: lvl}, bps, results};
    } catch (err) {
        console.log(err);
        throw err;
    }
}

function minmax(datas) {
    if (datas == null || !datas.length) {
        return [null, null];
    }
    let min = datas[0];
    let max = datas[0];
    for (let i = 1; i < datas.length; ++i) {
        if (min > datas[i]) {
            min = datas[i];
        }
        if (max < datas[i]) {
            max = datas[i];
        }
    }
    if (min == max) {
        return [min];
    }
    return [min, max];
}

const sumArray = sum;
export {RealGuess, RealGuessRaw, BP, Stat, GrowRange, sumArray, Pts, calcDiff, minmax, GuessResultToString};

