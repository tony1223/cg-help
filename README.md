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
3. 提供 /查詢 <寵物名稱> 查檔次、屬性與技能，資料讀攻略站（見下節）。

啟動方式

    node discord/server.mjs

### /查詢 的寵物資料

資料在攻略站那個 repo（content/data/專屬寵物.csv、魔力原始寵物.csv，圖片網址
反查 content/images.json），不複製一份到這裡。所以 bot 主機上要有攻略站的
checkout。

預設找 cg-help 隔壁的 `../goodluck`，放別的地方就在 config.json 指路：

    "goodluck_path": "/srv/goodluck"

找不到的話 /查詢 會回一句「沒設定」，其他指令不受影響。

#### 定期同步

bot 開機時、之後每 4 小時，會對那個 checkout 做一次 `git pull --ff-only`，
讓資料跟網站同一版。CSV 的 mtime 一變，下一次查詢就自動重讀，不用重啟。

只做 fast-forward，而且**工作區有未提交的變更就整個跳過** —— 如果那份
checkout 同時是有人在編攻略站的地方，bot 不會去動人家寫到一半的東西
（這種時候 log 會寫「跳過：工作區有 N 個未提交的變更」）。拉不動就繼續用
手上那份舊資料，只記 log，不影響其他指令。

改頻率或關掉：

    "goodluck_sync_hours": 4,
    "goodluck_sync": false

卡片最後那行「攻略站詳細資料」連到 https://cg-originmood-dc.github.io，
換網域的話：

    "goodluck_site": "https://example.com"

### 攻略站錯誤回報端點

攻略站（https://cg-originmood-dc.github.io/）的「回報錯誤」表單會 POST 到
bot 主機，由 bot 轉發到指定頻道（程式在 discord/report-server.mjs）。
config.json 加上：

    "report": {
      "channel_id": "<接收回報的頻道 ID>",
      "port": 8377,
      "allow_origins": ["https://cg-originmood-dc.github.io"]
    }

沒設定 report 就不會開這個端點。對外需走 HTTPS（攻略站是 https，
混合內容會被瀏覽器擋），用 cloudflared 或既有反向代理皆可，快速測試：

    cloudflared tunnel --url http://localhost:8377

正式環境建議掛固定網域（named tunnel 或反代）。網址確定後，到攻略站
repo 把 src/components/ReportIssue.astro 的 REPORT_ENDPOINT 填上即生效。

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
