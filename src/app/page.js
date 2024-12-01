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

import {RealGuess, GuessResultToString, PetDefaultData,calcDiff, minmax, RealGuessRaw} from "cg-pet-calc"

const Pts = PetDefaultData;

export default function Home() {
    const [petInputs, setPetInputs] = useState({
        name: '',
        level: '1',  // 預設等級為 1
        stats: ''    // 血魔攻防敏的字串
    });
    const [resultNopoint, setResultNopoint] = useState('');
    const [resultPoint, setResultPoint] = useState('');
    const [resultLevel, setResultLevel] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [resultTab, setResultTab] = useState('point');

    const handleInputChange = (field, value) => {
        setPetInputs(prev => ({
            ...prev,
            [field]: value
        }));
        if (field === 'name') {
            fetchSuggestions(value);
        }
    };

    const fetchSuggestions = async (value) => {
        setSuggestions(Pts.map(n => n[1]).filter(n => n.indexOf(value) != -1));
    };

    const handleSuggestionClick = (suggestion) => {
        setPetInputs(prev => ({
            ...prev,
            name: suggestion
        }));
        setSuggestions([]);
    };

    useEffect(() => {
        if (location.hash != "") {
            const val = decodeURIComponent(location.hash.substring(1));
            setPetInputs(prev => ({
                ...prev,
                stats: val
            }));
            _calcProps(val)
        } else {
            setPetInputs(prev => ({
                ...prev,
                name: '小蝙蝠',
                level: '20',
                stats: '377 467 170 94 106'
            }));
        }
    }, []);
    const calcProps = () => {
        const inputString = `${petInputs.name} ${petInputs.level} ${petInputs.stats}`;
        location.hash = (inputString);
        _calcProps(inputString);
        
        // Add smooth scroll to result textarea
        document.querySelector('textarea').scrollIntoView({ behavior: 'smooth' });
    }

    const _calcProps = (val) => {
        // Split the input string into parts if val is provided
        let inputName, inputLevel, inputStats;
        if (val) {
            const parts = val.trim().split(/\s+/);
            // Find the first number in the array to determine where stats begin
            const firstNumberIndex = parts.findIndex(part => !isNaN(part));
            if (firstNumberIndex > 0) {
                inputName = parts.slice(0, firstNumberIndex).join(' ');
                inputLevel = parts[firstNumberIndex];
                inputStats = parts.slice(firstNumberIndex + 1).join(' ');
                petInputs.name = inputName;
                petInputs.level = inputLevel;
                petInputs.stats = inputStats;
            }
        }
        _pointResult(val,petInputs,setResultPoint)

        setResultTab('point');
        return true;

    }

    const _pointResult = (val,petInputs,setResult) => {

        // Use the split values or fall back to petInputs
        const results = RealGuessRaw(PetDefaultData, val || petInputs.stats);
        
        if (!results.pet.find) {
            setResult('寵物名稱 [' + (petInputs.name || results.pet.name) + "] 查無符合寵物.");
            return true;
        }
        
        // Update petInputs with the parsed values if they exist
        if (petInputs.name && petInputs.level && petInputs.stats) {
            setPetInputs(prev => ({
                ...prev,
                name: petInputs.name,
                level: petInputs.level,
                stats: petInputs.stats
            }));
        }

        const lvl = results.pet.lvl;

        const out = [];
        out.push("輸入資料:" + petInputs.stats);
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
    }

    return (
        <main className="flex flex-col justify-center items-center pt-12 w-full">
            <h1 className="text-3xl font-bold">寵物算檔</h1>
            <form className="my-5 w-full max-w-2xl" onSubmit={(e) => { e.preventDefault() }}>
                <div className="card card-body">
                    <h2 className="card-title">計算檔次</h2>
                    
                    <div className="grid grid-cols-1 gap-4">
                        {/* 寵物名稱區塊 */}
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text">寵物名稱</span>
                            </label>
                            <input 
                                type="text" 
                                className="input input-bordered" 
                                value={petInputs.name}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                placeholder="輸入寵物名稱"
                            />
                            {suggestions.length > 0 && (
                                <ul className="mt-1 max-h-32 overflow-scroll bg-base-200 rounded-lg">
                                    {suggestions.map((suggestion) => (
                                        <li 
                                            key={suggestion} 
                                            onClick={() => handleSuggestionClick(suggestion)}
                                            className="p-2 hover:bg-base-300 cursor-pointer"
                                        >
                                            {suggestion}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* 等級區塊 */}
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text">等級</span>
                            </label>
                            <input 
                                type="number" 
                                className="input input-bordered" 
                                value={petInputs.level}
                                onChange={(e) => handleInputChange('level', e.target.value)}
                                placeholder="預設為1級"
                            />
                        </div>

                        {/* 能力值區塊 */}
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text">能力值 (血 魔 攻 防 敏)</span>
                                <span className="label-text-alt">請依序輸入數值，以空格分隔</span>
                            </label>
                            <input 
                                type="text" 
                                className="input input-bordered" 
                                value={petInputs.stats}
                                onChange={(e) => handleInputChange('stats', e.target.value)}
                                placeholder="例如: 1500 3241 262 328 300"
                            />
                        </div>

                        <div className="mt-4">
                            <button className="btn btn-primary w-full" onClick={calcProps}>
                                計算
                            </button>
                        </div>
                    </div>

                    {/* 說明區塊 */}
                    <div className="mt-4 text-sm opacity-75">
                        <p>格式說明：</p>
                        <p>1. 寵物名稱：輸入完整寵物名稱</p>
                        <p>2. 等級：預設為1級，可以依需求調整</p>
                        <p>3. 能力值：依序輸入 血量 魔力 攻擊 防禦 敏捷，數值間用空格分隔</p>
                        <p>範例：粉紅炸彈 92級的數值為 1500 3241 262 328 300</p>
                    </div>
                </div>
            </form>
            <div className="mt-8 min-w-[50%]">
                <div className="tabs tabs-boxed">
                    <a 
                        className={`tab ${resultTab === 'point' ? 'tab-active' : ''}`}
                        onClick={() => setResultTab('point')}
                    >
                        有加點(限全加，目前不支援部分加點)
                    </a>
                    <a 
                        className={`tab ${resultTab === 'nopoint' ? 'tab-active' : ''}`}
                        onClick={() => setResultTab('nopoint')}
                    >
                        無加點
                    </a>
                    <a 
                        className={`tab ${resultTab === 'level' ? 'tab-active' : ''}`}
                        onClick={() => setResultTab('level')}
                    >
                        等級推估
                    </a>
                </div>
                
                <div className="mt-2">
                    {resultTab === 'point' && (
                        <textarea 
                            className="textarea textarea-bordered h-[400px] w-full" 
                            readOnly 
                            value={resultPoint} 
                        />
                    )}                    
                    {resultTab === 'nopoint' && (
                        <textarea 
                            className="textarea textarea-bordered h-[400px] w-full" 
                            readOnly 
                            value={resultNopoint} 
                        />
                    )}
                    {resultTab === 'level' && (
                        <textarea 
                            className="textarea textarea-bordered h-[400px] w-full" 
                            readOnly 
                            value={resultLevel} 
                        />
                    )}
                </div>
            </div>
        </main>
    )
}
