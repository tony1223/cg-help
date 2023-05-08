import {lusolve} from "mathjs";

import {Data, updateData} from "./PetData.mjs";


let Pts = Data;

let updatePets = async () => {
    const datas = await updateData();
    if (datas.length > 0) {
        console.log("update data:" + datas.length);
        Pts = datas;
    }
};


import {sum, calcDiff, _loopForSum, fullRates, loopForSum, minmax, GuessResultToString} from "./Utils.mjs";

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

    toArray() {
        return [this.hp, this.attack, this.defend, this.agi, this.mp];
    }

    same(stat, tolerance = 0) {

        if (Math.abs(sum(this.toArray()) - sum(stat.toArray())) > tolerance) {
            return false;
        }

        if (calcDiff(this.toArray(), stat.toArray()).filter(n => Math.abs(n) > tolerance).length) {
            return false;
        }

        return true;

        // return this.hp == stat.hp &&
        //     this.mp == stat.mp &&
        //     this.attack == stat.attack &&
        //     this.defend == stat.defend &&
        //     this.agi == stat.agi
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

const sumArray = sum;
export {RealGuess, RealGuessRaw, BP, Stat, GrowRange, sumArray, Pts, calcDiff, minmax, GuessResultToString, updatePets};

