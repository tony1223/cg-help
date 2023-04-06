"use client"
import {useState, useEffect, useRef, useCallback} from 'react';

function useStateCallback(initialState) {
    const [state, setState] = useState(initialState);
    const cbRef = useRef(null); // init mutable ref container for callbacks

    const setStateCallback = useCallback((state, cb) => {
        cbRef.current = cb; // store current, passed callback in ref
        setState(state);
    }, []); // keep object reference stable, exactly like `useState`

    useEffect(() => {
        // cb.current is `null` on initial render,
        // so we only invoke callback on state *updates*
        if (cbRef.current) {
            cbRef.current(state);
            cbRef.current = null; // reset callback after execution
        }
    }, [state]);

    return [state, setStateCallback];
}

import styles from './page.module.css'
import {Pts} from "../calcpet/PetData.mjs"
import {calcDiff, minmax, RealGuessRaw} from "../calcpet/Pets.mjs"

export default function Home() {

    const [inputValue, setInputValue] = useState('');
    const [inputProps, setInputProps] = useStateCallback('');
    const [result, setResult] = useState('');

    const [suggestions, setSuggestions] = useState([]);

    const handleInputChange = (event) => {
        setInputValue(event.target.value);
        fetchSuggestions(event.target.value);
    };
    const handleInputProps = (event) => {
        setInputProps(event.target.value);
    };

    const fetchSuggestions = async (value) => {
        setSuggestions(Pts.map(n => n[1]).filter(n => n.indexOf(value) != -1));
    };

    const handleSuggestionClick = (suggestion) => {
        setInputValue('');
        setInputProps(suggestion + " ");
        setSuggestions([]);
    };

    useEffect(() => {
        if (location.hash != "") {
            const val = decodeURIComponent(location.hash.substring(1));
            setInputProps(val);
            _calcProps(val)
        } else {
            setInputProps('小蝙蝠 20 377 467 170 94 106');
        }
    }, []);
    const calcProps = () => {
        location.hash = (inputProps);
        _calcProps();
    }

    const _calcProps = (val) => {
        // console.log(inputProps);/
        const results = RealGuessRaw(val || inputProps);


        if (!results.pet.find) {
            setResult('寵物名稱 [' + results.pet.name + "] 查無符合寵物.");
            return true;
        }
        const lvl = results.pet.lvl;

        const out = [];
        out.push("輸入資料:" + inputProps);

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

        setResult(out.join("\n"));

        return true;

    }

    return (
        <main className={styles.main}>
            <h1>寵物算檔</h1>
            <div>
                <div>
                    搜尋寵物
                    <input type="text" value={inputValue} onChange={handleInputChange}/>
                    {suggestions.length > 0 && (
                        <ul style={{maxHeight: "100px", overflow: "scroll"}}>
                            {suggestions.map((suggestion) => (
                                <li key={suggestion} onClick={() => handleSuggestionClick(suggestion)}>
                                    {suggestion}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <br/>
                <hr/>
                <br/>
                <div>
                    <h2>計算檔次</h2>
                    <span>格式: &lt;寵物名稱&gt; &lt;等級&gt; &lt;血&gt; &lt;魔&gt; &lt;攻&gt; &lt;防&gt; &lt;敏&gt;</span>
                    <br/>
                    <span>範例: 92 級的粉紅炸彈 血 1500 , 魔 3241 , 攻擊 262,防禦 328 ,敏 300</span>
                    <br/>
                    <span>輸入: 粉紅炸彈 92 1500 3241 262 328 300 </span>
                    <br/>
                </div>
                <input style={{width: "400px"}} type="text" value={inputProps} onChange={handleInputProps}/>
                <button className="calc btn-primary" onClick={calcProps}>計算</button>
            </div>
            <br/>
            <br/>
            <hr/>
            <br/>
            <textarea readOnly style={{minWidth: "50%", height: "400px"}} value={result}/>
        </main>
    )
}
