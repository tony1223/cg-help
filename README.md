# 開源魔力寵物檔次計算機

* 魔力已二十幾年，檔次計算十幾年來已被挖掘過很多機制原理的機制，但一直沒有一個開源的計算版本
* 扣掉核心的計算外，在查詢的介面跟整合一直沒有我認為足夠友善的版版，應用程式的界面缺乏 api / lib 的設計，更缺乏界接資料庫儲存讓玩家可以自行整理的能力。
* 希望拋磚引玉，寫一個核心演算法，讓同好能夠整合，讓大家能夠更認真思考什麼是【好寵物】，能夠讓大家對寵物的認知跟評估，能有更好的工具跟產物。期待魔力寶貝這個遊戲可以再戰二十年。

# 本專案構成

* DC bot , core lib , website 三個部分組成

## basic

請記得先安裝 nodejs , npm 並於專案根目錄執行

    npm install

## core lib

請參考 src/calcpet 資料夾，工程端的用法在 src/calcpet/agent.mjs 有範例， 用 nodejs 環境直接跑以下指令即可測試。

    node src/calcpet/agent.mjs

如果想異動支援寵物清單，詳細清單在

    src/calcpet/PetData.mjs

    格式 : [編號(不重要), 寵物名稱, 寵物種族(不重要), 
           血檔次, 攻檔次, 防檔次, 敏檔次, 魔檔次, 
           0.2 (成長倍數，20=0.2 ， 30=0.3，如果你不確定就帶入 0.2)] 

## Discord bot

本專案同時做為魔力寶貝永恆初心的玩家 DC bot 使用， 相關程式碼在 discord 資料夾下。

可在這申請 discord application、bot
https://discord.com/developers/applications

做為 dc bot 使用時需在根目錄配置 config.json

    {
      "discord": "<application token >",
      "secret": "<bot secret>",
      "clientid": "<bot clientid>",
      "gpt_token": "<chatgpt token>"
    }

1. 提供 /掉檔 <寵物名稱 等級 血 魔 攻 防 敏> 計算寵物檔次
2. 提供 /閒聊 會有 chatgpt 模擬的阿蒙陪你嘴砲，如果不啟用 /閒聊 指令，gpt_token 設定可以不給。

啟動方式

    node discord/server.mjs

也歡迎大家加入永恆初心玩家DC
https://discord.com/channels/1090912861066362900/1090912861066362902

## web

請參考 src/app 下的程式碼做為入口， master 是主要 repo， 網站是靜態網站，打包後會放到 gh-pages 發布。

本地開發指令

    npm run dev

---

# Special Thanks

* 魔物觀測者在對照計算結果是否正確時，提供很大的貢獻，非常感謝
    * https://forum.gamer.com.tw/C.php?bsn=2577&snA=153442
* 本篇殘存的檔次論原理介紹，寫得非常完整詳實，在開發的過程中提供了很大的貢獻，非常感謝。
    * https://www.gamez.com.tw/thread-41432-1-1.html

# Enjoy and have fun.

* 作者 TonyQ ，很多年很多年以前的巴哈BBS魔力板板務。
* 歡迎 PR 加入貢獻列名共同作者。
