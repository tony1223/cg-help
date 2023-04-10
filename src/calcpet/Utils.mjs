import stringWidth from 'string-width';
// import {Table} from 'embed-table';
// import {EmbedBuilder} from 'discord.js';

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


function _renderDetails(out, _results, limit, lvl) {
    out.push("===詳細情形===");
    _results = _results.slice(0, limit);
    // table
    const data = [
        (lvl == 1) ? ["掉檔", "掉檔細節", "隨機檔分布"] : ["掉檔", "掉檔細節", "隨機檔分布", "猜測加點分布"]
    ];

    for (let r of _results) {
        if (r.RandomRange) {
            if (lvl == 1) {
                data.push([
                    r.LostBP,
                    calcDiff(r.GuessRange.toArray(), r.MaxGrowBPs).join(", "),
                    r.RandomRange.join(", ")
                ])
            } else {
                data.push([
                    r.LostBP,
                    calcDiff(r.GuessRange.toArray(), r.MaxGrowBPs).join(", "),
                    r.RandomRange.join(", "),
                    r.ManualPoints.join(", ") + " "
                ])
            }
        }
    }
    out.push(mytable(data, [5, 13, 14, 16]));
    return _results;
}

function asMap(ary, fn) {
    const res = {};
    ary.forEach(n => {
        res[fn(n)] = n;
    });
    return res;
}

function _renderSummaryDetails(out, _results, limit, lvl) {

    const data = [
        ["掉檔", "掉檔細節", "機率"]
    ];
    const bps = _results.map(n => calcDiff(n.GuessRange.toArray(), n.MaxGrowBPs));
    const countFull = {};
    const countFullPerp = [];
    let countSum = 0;
    const countBPDetails = [{}, {}, {}, {}, {}];
    const countBPDetailsPerp = [{}, {}, {}, {}, {}];

    bps.forEach(n => {
        countSum++;
        let bpFull = n.join(",");
        countFullPerp[bpFull] = countFullPerp[bpFull] || 0;
        countFullPerp[bpFull]++;

        for (let i = 0; i < n.length; ++i) {
            countBPDetails[i][n[i]] = countBPDetails[i][n[i]] || 0;
            countBPDetails[i][n[i]]++;
        }
    });

    Object.keys(countFullPerp).forEach((n) => {
        countFullPerp.push([n, (Math.round((countFullPerp[n] / countSum) * 1000) / 10)]);
    });

    const perp = 5;
    let possible = asMap(countFullPerp.filter(n => n[1] > perp), n => n[0]);
    const _showResults = _results.filter(n => possible[calcDiff(n.GuessRange.toArray(), n.MaxGrowBPs).join(",")]);

    if (!_showResults.length) {
        out.push("====");
        out.push("無 " + perp + "% 以上可能解");
        return true;
    }
    out.push("===簡要統計===(只列出10% 以上可能性解)");
    for (let r of _showResults) {
        if (r.RandomRange) {
            let calcDiff1 = calcDiff(r.GuessRange.toArray(), r.MaxGrowBPs);
            if (lvl == 1) {
                data.push([
                    r.LostBP,
                    calcDiff1.join(", "),
                    possible[calcDiff1.join(",")][1] + "% "
                ])
            } else {
                data.push([
                    r.LostBP,
                    calcDiff1.join(", "),
                    possible[calcDiff1.join(",")][1] + "% ",
                    r.ManualPoints.join(", ") + " "
                ])
            }
        }
    }
    out.push(mytable(data, [5, 13, 14, 16]));
}

function GuessResultToString(results, limit, showDetails) {

    if (!results.pet.find) {
        return ('寵物名稱 [' + results.pet.name + "] 查無符合寵物.");
    }

    const lvl = results.pet.lvl;

    const out = [];

    out.push("寵物名稱:" + results.pet.name)
    out.push("寵物總檔次: " + results.bps.join(","))

    const petGrowRanges = results.bps;

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
        _renderDetails(out, _results, limit, lvl);
        // _renderSummaryDetails(out, _results, limit, lvl);
    }

    return (out.join("\n"));
}

function mytable(datas, titleWidth) {
    if (datas.length == 0) {
        return "";
    }

    const columnWidth = [];
    for (let i = 0; i < datas.length; ++i) {
        for (let j = 0; j < datas[i].length; ++j) {
            let width = stringWidth(datas[i][j]);
            if (width % 2 == 1) {
                width++;
            }
            if (columnWidth[j] == null || columnWidth[j] < width) {
                columnWidth[j] = width;
            }
            width += 2;
        }
    }

    const lstart = "+"
    const lseparate = "+"
    const border = "-";
    const cseparate = "|";
    const out = [];
    const conf = {
        lstart,
        lseparate,
        border,
        cseparate
    };

    _renderline(out, columnWidth, conf);
    _renderContent(out, datas[0], titleWidth.slice(0, columnWidth.length), conf);
    datas = datas.slice(1);
    _renderline(out, columnWidth, conf);
    for (let i = 0; i < datas.length; ++i) {
        _renderContent(out, datas[i], columnWidth, conf);
    }
    _renderline(out, columnWidth, conf);
    return out.join("");
}

function _renderContent(out, data, widths, {
    lstart,
    lseparate,
    border,
    cseparate,
}) {
    out.push("` " + lstart);
    for (let i = 0; i < widths.length; ++i) {
        let width = stringWidth("" + data[i]);
        out.push(" ");
        out.push(data[i]);

        if ((widths[i] - width) % 2 == 1) {
            out.push(" ");
            width++;
        }
        for (let j = 0; j < (widths[i] - width); j += 2) {
            out.push(" 　");
        }
        out.push(cseparate);
    }
    out.push("` " + "\n");
}

function _renderline(out, widths, {
    lstart,
    lseparate,
    border,
    cseparate,
}) {
    out.push("` " + lstart);
    out.push(border)
    for (let i = 0; i < widths.length; ++i) {
        out.push(border)
        for (let j = 0; j < widths[i]; ++j) {
            out.push(border)
        }
        out.push(lseparate);
    }
    out.push("` " + "\n");
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


export {sum, calcDiff, loopForSum, _loopForSum, fullRates, minmax, GuessResultToString};