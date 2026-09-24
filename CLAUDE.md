# 雷電．蒼穹突擊 (Thunder Force PWA)

純 Canvas 2D + Web Audio + PWA 的垂直捲軸射擊遊戲，無框架、無外部依賴。

## 啟動方式

```bash
# 本機開發 — 雙擊或執行
run.bat              # Python http.server :8000，自動開瀏覽器
                     # Python 不在的話 fallback PowerShell HttpListener
```

PWA 必須走 HTTP/HTTPS，不能用 `file://`。

## 檔案結構

| 檔案 | 用途 |
|------|------|
| `index.html` | DOM 結構：左側 hud-panel（分數/排行 4-tab/選單/商店/成就/Replay）+ 右側 canvas-wrap |
| `app.js` | 全部遊戲邏輯（單檔 ~3800 行，無拆檔；含 procedural sprites、chiptune sequencer、boss patterns、replay buffer） |
| `styles.css` | 全部 CSS（~920 行；含 PWA mobile 手機版選單修正、weapon slots、leaderboard tabs、replay grid） |
| `sw.js` | Service Worker，HTML/JS/CSS 用 network-first，靜態資源 cache-first |
| `manifest.webmanifest` | PWA manifest |
| `run.bat` | Windows 本機 server 啟動腳本（Python → py launcher → PowerShell HttpListener fallback） |
| `assets/` | icons (192/512/apple-touch/svg) |

## 🎲 三條 RNG 流（v23，2026-09-17；使用者拍板提案 H「daily 種子真確定性」）

| 流 | 函式 | 誰可以抽 | 為什麼分開 |
|---|---|---|---|
| **world** | `rand()` / `random()` / `randInt()` | 敵人生成、編隊、掉寶種類與機率、Boss 環彈相位、過關解鎖槽位 | 這條決定「今天大家碰到什麼」。**只有世界事件能抽**，順序固定 ⇒ 同一天同一批波次 |
| **combat** | `crand()` / `crandom()` | 玩家追蹤彈散布、異常狀態（冰/燒/電）機率 | 玩家開幾槍、命中幾次因人而異；不分開就會把世界流推掉 |
| **visual** | `vrand()` / `vrandom()` / `vrandInt()` | 粒子、畫面震動、浮字偏移、星空 | **永遠是 `Math.random()`，不吃種子**。抽多少次都不影響玩法 |

- `setSeed(seed)` 同時設 world 與 combat（combat 由 `seed ^ 0x9e3779b9` 派生）；visual 沒有狀態。
- ⚠ **新增亂數前先問**：它會改變「玩家碰到什麼」嗎？會 ⇒ world；只跟這個玩家的操作有關 ⇒ combat；純畫面 ⇒ visual。
  放錯 world 流的代價是**靜默的**：畫面正常、測試全綠，只有「兩台機器跑同一天卻不同關」才看得出來。
- 刻意保留的 `Math.random()` 只有 4 個：`vrand` 的實作、兩個音訊白噪音緩衝（init 建一次）、非 daily 場次的種子來源本身。
  `scripts/patch-rng-streams.mjs` 的檔尾斷言在守這件事（多出來就紅）。
- 驗收：`node scripts/check-daily-determinism.mjs` —— 同一顆種子用 60fps / 30fps / 抖動三種幀率各跑 14 秒遊戲時間，
  逐項比對敵人指紋（出生點/菁英/蛇行/速度/相位）。
  ★ 驗法本身踩過兩個坑，都寫在那支檔頭：①指紋要在**出生那一刻**抓（等 update() 跑完再撈，x 已被推一幀，不同幀率天生差 1px ⇒ 假紅）
  ②整段要放在**同一個同步 evaluate**（rAF 插不進同步區塊，才量得到「我們給的幀率」而不是瀏覽器的）。

## 🔗 ?daily 深連結（v23，2026-09-17；提案 H 後半）

- 網址帶 `?daily` 或 `?mode=daily` ⇒ `applyDeepLink()`（app.js 檔尾，`requestAnimationFrame(tick)` 之前）代勾「每日挑戰」並直接 `startNewGame()`。
- ⚠ **刻意不叫 `audio.ensure()/unlock()`**：自動播放政策本來就會擋，硬叫只會吃掉使用者第一次觸碰螢幕的解音時機（airhockey2d/3d 0906 同一條）。
- ⚠ **一律關掉 Boss Rush**：每日挑戰與 Boss Rush 是兩套排行榜，使用者上次勾過就會被帶進「計時榜的每日場」，分數進不了今日排行。
- 第一次玩的人仍會看到教學卡（`startNewGame` 內建），深連結不跳過教學。
- 信友火花「今日挑戰」第 12 張卡指 `https://flyshoot.pages.dev/?daily`；那邊的 `verify-daily.mjs` 也加了本站一筆。

## 📱 手機橫向版面（v23，2026-09-17；使用者拍板提案 I）

- 病：`WORLD` 是 480×800 的 3:5 直式，而 `@media (max-width: 980px)` 的疊版規則讓畫布「寬決定高」
  ⇒ 橫向手機 844×390 時畫布變成 520×867 塞進 390 高。量出來：**58.3% 的遊戲區在視窗外**、頁面可捲 1209px。
- 解：橫向**回到兩欄**（橫向根本不缺寬度，844 − 234 = 610px 是空的）。全部在 `styles.css` 檔尾，
  用 `@media (max-width: 980px) and (orientation: landscape)` + `body:not(.immersive):not(.mfs-fs)` 圈起來。
  ① 畫布改「高決定寬」`height:100svh` ⇒ 234×390，**0% 被切**
  ② `.canvas-wrap { width: max-content }` 收成畫布本身的寬，角落 mini-chip 才貼著畫布
  ③ 觸控鈕改 `position: fixed` 送到視窗右側拇指區
- ⚠ **三個踩過的點，改這段前先讀**：
  ㈠ 用 `position: fixed` 前必須把 `.canvas-wrap` 的 `backdrop-filter` 關掉 —— 它會替 fixed 子元素建立 containing block，
     不關的話鈕被綁回那 234px 的框裡（本檔「手機版 backdrop-filter 陷阱」那條的第二次發作）。
  ㈡ **`.overlay` 會吃掉畫布觸控**：命/炸/連擊/武器名那些小籤原本吃 pointer events，玩家拇指放上去拖曳戰機不會動，
     而**畫布尺寸完全正常**。量到直向 10/144、橫向 31/144（21.5%）。修法是 `.overlay { pointer-events: none }`
     再把真的要點的 `.weapon-slots` 開回來。橫向另外把武器槽整片搬離畫布。
  ㈢ **暫停鈕是這個版面的「出口」，不可被蓋住**：`right:16px` 會被右上角那顆 ⛶（`#mfsFull`，fixed `right:8px`）整顆蓋住
     —— `elementFromPoint` 打在暫停鈕正中央拿到的是 ⛶ 的 svg ⇒ 零出口。已挪到 `right:72px`。
     順手把 `#mfsFull` 從 42px 補到 **44px**（艦隊觸控目標鐵則）。
- 驗收：`node scripts/measure-landscape.mjs`（三種視窗印「畫布/被切%/捲動/觸控被接走幾格」）
  + `verify-behaviour.mjs` 的 I 段（兩種橫向各 6 項 + 直向零迴歸 1 項）。
  ★ **面積數字照不出觸控竊取** —— 一定要跑 `elementFromPoint` 點陣（dragtetris 0916 同一條）。

## 📅 今日任務（v22，2026-09-15；使用者拍板提案 J「每日任務三則給金幣」，回訪動機）

- **挑題**：`QUEST_POOL` 8 種，每天用 `pickDailyQuests(todayKey())` 挑 `QUESTS_PER_DAY=3` 則 —— 同一天所有人同三則。
  ★ 用**私有 PRNG**（FNV-1a 種子 + mulberry32 洗牌），**不碰全域 `rngState`**，否則今日挑戰／Replay 的種子會漂（verify 有一項在守）。
- **兩種計法**：`mode:"sum"` 今天累加（kill30 / loot15 / skill5 / deep1 / bossNoBomb）、`mode:"max"` 取單場最高（combo50 / flawless2 / stage2）。
- **計數點**：`destroyEnemy`(kill30)、`collectLoot`(loot15)、`bumpCombo`(combo50)、`advanceWave`(flawless2 / stage2)、`useSkill`(skill5)、
  `bossDefeated` 的 `!b.mid` 區塊(bossNoBomb；中 Boss 不算、`state.bombsThrownThisRun > 0` 也不算)、`endGame`(deep1；深海皮膚且玩 >20s)。
- **獎勵**：`questComplete` 當場 `meta.credits += reward`（50~150）+ `saveMeta` + `saveQuests`，畫面跳浮字，三則全完成再跳一行。重播（`state.replayPlaying`）一律不算。
- **儲存**：`tf-quests-v1` = `{day, ids[3], progress{}, done{}, earned}`。`ensureQuestsFresh()` 在 `startNewGame` / `visibilitychange` 回前景 / 選單每 60 秒各查一次，
  換日就換題並歸零（頁面開著跨午夜、App 昨天沒關都會換）。
- **UI**：出擊分頁「開始戰鬥」下面 `#questCard`（`renderQuests()` 畫三列進度條 + 副標「還剩 N 則・X 小時後換題」；三則全完成整張卡 `.is-all-done` 描綠），
  `refreshMenuPanels()` 會重畫；結算 `showFinalMenu` 多一行「今日任務本場完成 N 則（+M 金幣）」。
- 驗收：`scripts/verify-behaviour.mjs` J 段 22 項（挑題確定性／不動全域 rand／29→30 才給錢／已完成不再累加／中 Boss 與炸彈不算／深海 20 秒門檻／
  換日歸零／重播不算／結算文案）；手機 390 與 320 寬度「任務卡不溢出」另跑量測。
- ⚠ 改文件時注意：本檔標題用的是**全角括號**`（）`。拿半角 `(` 當錨點做字串替換會**靜默沒命中**（0915 實踩一次）。

## 三皮膚 + 六 Boss（v21，2026-09-15；使用者拍板 Q「第三皮膚或新 Boss」兩個都做）

- **第三套皮膚 `deep`（🐙 深海潛航）**：`SKINS = ["mech","rock","deep"]`（`getSkin/setSkin` 用它驗證）；`drawDeepEnemyArt`（basic=水母 / elite=燈籠魚 / formation=魟魚）、`drawDeepBossArt`（六隻：巨鎧蟹 / 劍旗魚 / 深海巨鯨 / 海蛇 / 烈焰水母 / 九頭海怪）；`buildSprites` 對 `BOSS_TYPES` 全表生成 `_mech/_rock/_deep` 三套；`drawBackground` 深海皮膚換 `deepSkies` 色盤；Boss 名字走 `bossNameFor(type)`（`name/rockName/deepName`）；選單文案 `syncSkinCopy` 三段。
- **第六隻 Boss `hydra`（九頭蛇艦 / 裂變雙子隕 / 九頭海怪，色 #5df2c8）**：`BOSS_TYPES` 第 6 筆 ⇒ 第 6 關 STAGE BOSS、第 5 關中 Boss 預告版（(stage-1+1)%6）；`BOSS_PATTERNS.hydra` 三 phase 用三個新 helper：`pTwinFan`（左右砲口各瞄一次）、`pSplitShot`（敵彈帶 `split:{t,count,speed}`，updateBullets 時間到炸成一圈）、`pTorpedoes`（敵彈帶 `homing:true, turn, life`，updateBullets 朝 `nearestPlayer` 轉向、壽命到散掉）；drawBullets 對 split 畫脈動外圈、homing 畫白核 + 尾跡。`BOSS_RUSH_TYPES` 維持五隻（計時榜可比）。
- 驗收：`scripts/verify-behaviour.mjs` Q 段（皮膚選項 / 21 張 sprite 都在 / 名字 / hydra 4.5 秒放彈無例外 / 分裂彈變 6 顆 / 魚雷轉向 / 第 5 關中 Boss 與第 6 關 Boss 都是 hydra）。

## 雙皮膚系統（2026-07-10）

- 開戰前選單「戰場」select（`#skinSelect`）：`mech`（✈️ 機械戰機，原版）/ `rock`（☄️ 隕石風暴）
- 純視覺換皮：`buildSprites()` 預生成兩套 sprite（`enemy_*_mech|_rock`、`boss_<id>_mech|_rock`），
  取用走 `skinSprite(base)` / boss 用 `sprites["boss_"+type+"_"+getSkin()]`；機制/判定/掉寶/排行/Replay 全共用
- 皮膚存 `localStorage tf-skin`（`getSkin()/setSkin()`）；切換即時生效（draw 每 frame 查皮膚）
- Boss 名稱雙版本：`BOSS_TYPES[].name`（機械）/`rockName`（隕石：巨岩先鋒/裂空隕鐵/雷晶隕核/熔岩巨隕/烈焰彗核）
- 美術函式：`drawMechEnemyArt/drawMechBossArt`（原版）、`drawRockEnemyArt/drawRockBossArt`（隕石）
- 共用文案改中性（「擊破目標」）；選單 messageBody 依皮膚動態換句

## app.js 主要區塊（依執行順序）

1. **Constants** — `WORLD`、`POWER_CAP=20`、`ENEMY_COUNT_BOOST=1.728`、`BULLET_COUNT_BOOST=1.728`、`BOSS_TELEGRAPH_TIME=0.4`、`CONTINUE_COSTS=[100,250]`、`MAX_CONTINUES=2`、`STATUS_CHANCE=[0,0.18,0.32,0.48]`
2. **RNG** — seedable rand() 給 daily challenge / replay
3. **Storage / Meta progression** — 角色、商店升級、成就持久化在 localStorage；每日挑戰另存 `tf-daily-leaderboard-v1`
4. **Audio** — Web Audio chiptune sequencer：lead (square) / bass (triangle) / kick (sine sweep) / hat (noise)，每關不同調式 (`STAGE_BGM`)
5. **Sprites** — `buildSprites()` 在 init 預生成 OffscreenCanvas pixel-art ships/enemies/bosses，`drawImage` 取代手繪幾何
6. **Weapons** — `default / spread / laser / homing`，4 槽切換（TAB / X / 點 chip）
7. **State** — 大物件 `state` 含 enemies / bullets / particles / telegraphs / deferredActions / zaps / stageClearOverlay / continueOverlay 等
8. **Player** — `weaponSlots: { default,spread,laser,homing }` 解鎖；`hp/maxHp/lives/bombs/power/shield/perk`
9. **Enemy spawn** — random + formation（V 字/橫掃/三角）；boss 每 5 wave 出現；敵人有 `frozenUntil/burnUntil/burnDps` 狀態欄位
10. **Boss patterns** — type-driven dispatch `BOSS_PATTERNS[type][phase][pickIdx]`
11. **Telegraphs / Deferred / Zaps** — boss 大招前 0.4s 紅色預告線；感電連鎖用 `pushZap` 畫閃電
12. **Stage Clear / Continue** — 過 10 wave 觸發 stageClearOverlay；死亡且金幣足夠觸發 continueOverlay (15s 倒數)
13. **Update / Render** — `update(delta)` 主迴圈，包含 low-HP slow-mo (HP < 20% 時 delta × 0.65)
14. **Replay** — 錄一場 60 fps 的 input frames 存 JSON，可匯入匯出
15. **Init** — 最後檔尾呼叫 `buildSprites()`、`setScene('menu')`、`registerInput()`、`requestAnimationFrame(tick)`

## 重要設計慣例

- **xlsx-style：只改 .js / .css / .html，本機檔案 = 雲端真理**（無 build step）
- **沒有框架**：不要引入 React/Vue/Vite。所有 DOM 操作用 `document.getElementById($())`，CSS 修改用 className
- **不寫測試**：靠手動測 + console
- **PWA cache 用 network-first 給 code，cache-first 給 assets** — 改 code 後 bump `CACHE_NAME`（目前 v23）讓舊 cache 失效
- **🏷 版本兩件套(2026-09-15,v19;使用者「版本號與簡歷打不開」)**:選單最底 `<details id="verFold">`(summary 寫本版 vN + 日期,`#verTag` 白話簡歷、前幾版接到 v7)+ 右下角 `#appVerBadge` 可點(點了展開簡歷並捲到它;戰鬥中選單收起就先提示)。**改版四處一起改**:`sw.js` CACHE_NAME / summary vN / verTag 第一行 vN+日期 / 前幾版接上一版 —— `node scripts/check-vertag.mjs` 在守(本 repo 唯一的自動檢查,零依賴)。
- **手機版選單**：`@media (max-width: 980px)` 時 `body[data-scene="menu"] .canvas-wrap { display: none }`，因為 `.hud-panel` 的 `backdrop-filter: blur` 會建立 fixed-positioning containing block，導致 `position:fixed` modal 被綁住。所以我們改成「選單時直接隱藏 canvas」而非 modal overlay
- **deltaTime 在 slow-mo 時降到 0.65×**，但 audio / parallax 用真實 delta 不縮放
- **Telegraph 顏色** = pattern 子彈顏色（紅系給強攻擊）
- **Boss 5 種**：vanguard（先鋒護衛 / 直瞄）、harrier（獵風者 / 對角雷射）、leviathan（雷霆鯨 / 廣域螺旋）、wyrm（天龍 / 正弦鏈）、phoenix（不死鳥 / 密集環）

## Power 1–20 系統

- `POWER_CAP = 20`（成就 `max-power` 仍在 power=10 觸發）
- 撿到武器 = 解鎖該槽位、若已解鎖則 stack power
- HUD 底部 20 顆小燈，按 5 一階分色（藍/綠/黃/紅）
- `fireDefault` lanes 1–4 + sidePairs (power-4)；`fireSpread` 3+power 顆；`fireHoming` 2+power 顆；`fireLaser` width 6 + min(power,20)*1.4

## Continue 機制

- 死光 + `meta.credits >= continueCostNow()` 才會 offer
- 第 1 次 100 金幣，第 2 次 250 金幣，最多 2 次
- 15 秒倒數，逾時自動 endGame
- Replay 模式不 offer

## Stage Clear

- 每 10 wave 跨界（stage 1→2、2→3...）觸發
- 獎勵：+1000+200×stage 金幣、滿血、power +1、隨機解鎖一個未解鎖武器槽（若全解了改 +1 炸彈）
- 暫停 2.6 秒，clear enemies / boss / telegraphs

## 🎚 難度(v24,2026-09-21;使用者:「雷電太容易,要加強難度」)

**先量再改,改完再量** —— `node scripts/measure-difficulty.mjs [url] [秒數上限]`:兩隻**不丟炸彈、不放特技**的 bot
(躺平 idle = 站著不動;閃避 dodge = 每幀預測敵彈落點挑最安全車道)× 四種難度 × 4 顆種子,同步推 `update(1/60)`,
印「活了幾秒 / 到第幾波 / 剩命 / 被打幾發 / 打掉幾隻 Boss」。**「我覺得變難了」不算數,這張表才算。**

| v23(改前) | v24(改後) |
|---|---|
| 躺平 bot 四種難度(含彈幕)全部活滿 420 秒、打到第 30 波,普通剩 8 命 | 普通躺平 4 顆種子有 3 顆在第 4~5 波死(≈60 秒);彈幕躺平第 3 波死 |
| 閃避 bot 剩 9 命 | 普通閃避活滿但剩 2.5 命;彈幕閃避一半種子死 |

改了什麼(全在 app.js 常數區,一眼看得完):
- **命數改由難度決定** `DIFFICULTIES[].lives`:簡單 5 / 普通 3 / 硬派 3 / 彈幕 2(以前每架機體寫死 **10 命**,加上每命 6~16 HP、
  每死一次滿血補 4 盾,要被打中上百發才結束 —— 這是「太容易」的一半)。`CHARACTERS[].lives` 只剩 fallback。選單選項標籤帶命數。
- **`ENEMY_FIRE_MUL` 5 → 2.6**(小兵開火密度約 ×1.9;以前小兵首發要等 3.5~6.4 秒,4~7 秒就飄出畫面,多數一槍沒開 —— 另一半)。
  **Boss 拆出 `BOSS_FIRE_MUL = 3.6`**,Boss 彈幕只加四成,不要一口氣變彈幕地獄。
- **`waveFireMul()`**:小兵冷卻每過一波 −1.8%,第 28 波起封頂 0.5(以前第 30 波跟第 1 波一樣鬆)。不抽亂數,daily 出題不受影響。
- 硬派/彈幕倍率拉開(硬派 enemyRate 1.3 / bulletRate 1.45 / bulletSpeed 1.15;彈幕 1.6 / 1.9 / 1.3),掉寶 0.8 / 0.65
  (⚠ 敵人多 ⇒ 掉寶多 ⇒ 補血多:量尺上硬派躺平一度活得比普通久,靠的就是掉寶;敵人變多時掉寶要跟著收)。
- 簡單維持原倍率、5 命,留給小小孩。
- ⚠ 量尺的雜訊:種子 777 的躺平 bot 在普通/硬派都能活滿(那一顆的波次剛好打不到中央),4 顆種子看趨勢、別盯單顆。
- ⚠ 閃避 bot 是**幀級完美反應**,比真人強很多;它活滿不代表真人活得了。真人的參照是躺平那排。

**v25(2026-09-24)第二輪** —— 使用者實機玩過 v24:「感覺還太鬆,再難一些」。這輪刻意挑「真人有感、幀級 bot 無感」的把手:
- **彈速**:普通 1.12 / 硬派 1.28 / 彈幕 1.42(原 1 / 1.15 / 1.3),外加 `waveBulletSpeedMul()` 每波 +1%、第 26 波封頂 +25%。
  真人吃反應時間,bot 不吃 —— 所以量尺上 dodge 那排幾乎看不出差別,這是預期的,不是沒生效。
- **彈量**:普通 bulletRate 1.3 / 硬派 1.8 / 彈幕 2.3(原 1 / 1.45 / 1.9);`waveFireMul()` 斜率 0.018 → 0.025(第 21 波到封頂 0.5)。
- **開場炸彈**:Alpha/Phantom 10→6、Blade/Tempest 8→5、Fortress 12→8(炸彈是真人最大的保命符;bot 不丟,量尺量不到這一刀)。
- 普通 enemyRate 1.1、loot 0.9;硬派 enemyRate 1.4、loot 0.75;彈幕 enemyRate 1.75、loot 0.6。簡單、命數、每日出題不動。
- 量尺(4 種子):普通躺平 57~191 秒全死(平均第 8 波);硬派躺平 58~84 秒;彈幕躺平 38~42 秒;普通閃避 4 顆種子死 1 顆、活的剩 1.8 命。
- 下一刀若還要更難:先動 `DIFFICULTIES.normal.bulletSpeed`(真人最有感)或把 `LOW_HP_TIME_SCALE` 慢動作拿掉;命數 3 → 2 是最後手段。

## 已知地雷區

- **`ENEMY_FIRE_MUL`(v24 起 2.6;Boss 另有 `BOSS_FIRE_MUL` 3.6)** 是全域敵彈密度節流。改了會大幅影響難度 —— **改完必跑 measure-difficulty**
- ~~**`Math.random()` 而非 `rand()`** 用在很多地方，所以 daily seed 不能保證完全 deterministic~~
  → **v23(2026-09-17)修掉了,而且原本這條寫反了**:主因不是「有些地方寫 Math.random()」,
  而是**視覺特效在抽種子流** —— `spawnParticle` 每顆粒子從種子流抽 4 個數,又被
  `if (Math.random() < delta * 6)` 這種跟幀率綁死的閘門呼叫;星空每幀重生也抽。
  ⇒ 同一顆種子在 60fps 與 30fps 的機器上長出**完全不同的關卡**(實測:第 1 隻敵人就不同)。
  現在分成三條流,見下面「三條 RNG 流」段;迴歸 `node scripts/check-daily-determinism.mjs`。
- **音樂用 `setInterval`**，可能在分頁背景時產生時序漂移；`visibilitychange` 監聽會 togglePause
- **手機版 backdrop-filter 陷阱**：給 `.hud-panel` 加 `position: fixed` 子元素時要先取消 backdrop-filter，否則 fixed 變相對於 hud-panel
- **service worker 改了要 bump cache name**，否則 PWA 用舊 cache 直到 SW 自然更新（以前是 cache-first，現在 network-first 已經沒這問題）
- **`CORE_ASSETS` 不放 `./index.html`**(2026-09-14,v17→v18 全艦隊修):CF Pages 把 `/index.html` 308 到 `/`,快取存到 redirected 回應 ⇒ 裝成 App 打開就 ERR_FAILED(3D-Chess 幻影版實錘)。
  名單只放 `./`;runtime put 守 `ok && !redirected`;離線退路 `caches.match("./")`。補丁:skills repo `static-pwa-ship/patches/patch-sw-index.mjs --cf`;線上重演 `scripts/check-sw-nav-fleet.mjs`。
- **部署**:正式站是 **CF Pages 專案 `flyshoot`**(https://flyshoot.pages.dev,大廳卡片指它;舊站 flyshoot.netlify.app):`npx wrangler pages deploy <只含 index.html/app.js/styles.css/sw.js/manifest/assets 的目錄> --project-name flyshoot --branch main`,部署完 curl `/sw.js` 看版號。
  ⚠ `hfpc-shooting3d.pages.dev` 是**另一款遊戲**(10m 氣步槍 3D),不是本 repo。

## 開發/測試循環

1. 改 .js / .css / .html
2. 雙擊 `run.bat` 啟動 server
3. 改完 reload 即可（network-first SW 會抓新版）
4. Mobile 測試：手機連同網段，瀏覽 `http://<電腦IP>:8000`，或用 ngrok / cloudflared 開公網 tunnel

## Git 慣例

- 主分支 `main`，遠端 `origin = github.com/summer09201017-cloud/shoot.git`
- `git config core.autocrlf` 開啟，BAT 檔案存 LF 但 checkout 為 CRLF
- Commit message 中文 OK，但有 Co-Authored-By trailer 給 Claude

## CP 值待辦（從歷次規劃）

S 級已完成：boss patterns / stage clear / continue / telegraph / slow-mo / weapon slots / power 1–20 視覺指示器。

A 級已完成（全部 #8–#14）：
- 程序化 sprite (`buildSprites()`，`<canvas>` pre-render，`drawImage` 取代幾何繪製)
- Chiptune sequencer BGM (lead/bass/kick/hat 4 軌、每關不同調式、A/B pattern 交替)
- 狀態異常子彈：冰凍 / 燃燒 / 感電 SHOP perk
- 成就解鎖角色：`boss-5` → Phantom，`combo-100` → Tempest
- 每日挑戰雙排行榜：`tf-daily-leaderboard-v1` 獨立儲存，UI tab 切換
- **Boss Rush 模式**：勾選 toggle 後，連戰 5 隻 boss 計時排行；`state.bossRush + bossRushIdx + bossRushTime`，無小怪 spawn，`tf-bossrush-leaderboard-v1` 排行（依 time 升序）
- **Replay 多筆儲存（5 槽）+ 縮圖**：`tf-replays-v1` 存 ring buffer，每場結束 `makeReplayThumbnail()` 用 `canvas.toDataURL` 抽 96×160 jpeg；UI 顯示縮圖 grid，第一次點選 = 選中，第二次點選 = 重播

B 級：#15 / #16 / #17 **已於 v20（2026-09-15）完成**，見下方「v20 九件」；仍未做：
- #18 協力 P2 獨立 HP / Lives / Bombs + 復活機制

## v20 九件（2026-09-15，使用者拍板 A/B/C/D/E/F/G/M/N 一次做完）

| 代號 | 做了什麼 | 程式位置 |
|---|---|---|
| A 開始鈕第一屏 | `#messageCard` 搬到 `.brand` 底下、出擊分頁「開始戰鬥」放最前；`body.fresh`（還沒玩過）時選單態隱藏全 0 的 `.stats-grid`，`startNewGame` 拿掉 fresh | index.html / styles.css 檔尾 / app.js init |
| B 教學卡 + 開局無敵 | `#tutorialOverlay`（fixed，選單態也能從「操作教學」鈕開）；第一次按開始 `openTutorial(true)` 凍住遊戲（`state.tutorialOpen`，update() 早退、grace 不倒數），按出擊 `closeTutorial()` 才開打並寫 `tf-tutorial-seen`；`p.grace = START_GRACE`（5s）期間 `damagePlayer` 直接 return，畫虛線圈 + 倒數 | app.js openTutorial/closeTutorial/createPlayer/drawPlayers |
| C 打點 | `flyshoot-done`（endGame，玩 ≥20s、非重播）、`flyshoot-boss`（本場第一次擊破 Boss 含中 Boss） | endGame / bossDefeated |
| D 桌機 ⛶ + 畫布比例 | `#mfsDesktopStyle` 讓 pointer:fine 也顯示 mfs 放大鈕；`body.immersive`/`.mfs-fs` 在 play/paused 收掉 `.hud-panel`、畫布 `height:100svh`；★ 順手修正桌機畫布：原本 `width:520px + max-height` 被夾成 520×744（fitCanvas 兩軸各自縮放 ⇒ 橫向拉寬 16%），改成「高度決定、寬度跟 3:5」 | index.html head / styles.css 檔尾 |
| E 炸彈換分 | endGame 時 `bombCashout = bombs × BOMB_CASHOUT(500)` 加進分數（Boss Rush 計時榜與重播不算），結算文字與 `buildRunStats` 都有 | endGame |
| F 無傷加倍 | `state.waveHits`（damagePlayer 就 +1，護盾擋下也算）；`advanceWave` 開頭：上一波 0 hit ⇒ `flawlessMult = FLAWLESS_MULT(2)`，否則 1；destroyEnemy / 編隊全滅 / bossDefeated 的分數都乘它；HUD 右下印「★ 無傷加倍 ×2」 | advanceWave / destroyEnemy / drawCanvasHud |
| G 音量三檔 | audio 多 `sfxGain`（tone/noise 接它，BGM 接 `bgmGain`），`VOL_LEVELS=[0,.35,.7,1]`，`setVolume(kind,lv)`，`tf-vol-bgm`/`tf-vol-sfx`；出擊分頁兩個 select；「音效 ON/OFF」鈕仍是 master 總開關 | createAudio / registerInput |
| M 中 Boss + 腳本化波次 | `STAGE_SCRIPT[1..10]`（label/spawnMul/formationEvery/eliteMul）由 `stageScript()` 依 `waveInStage()` 取；第 5 波 `startBossWarning(null,{mid:true})` ⇒ `spawnBoss(type, mid)`：型別 = 下一關 STAGE BOSS（(stage-1+1)%5）、血 ×`MID_BOSS_HP_MUL`(0.42)、radius 44、只有 2 phase 不 ENRAGED、獎勵 ×0.4、**不算 meta.bossKills / Boss 成就**（`state.midBossKillsRun` 另計）；第 10 波仍是原本的 STAGE BOSS | spawnEnemy 上方 / startBossWarning / spawnBoss / bossUpdate / bossDefeated |
| N 機體特殊技 | `SKILLS = { slow, deflect, charge }`，CHARACTERS 各帶 `skill`（alpha/phantom=slow、blade=deflect、fortress/tempest=charge；phantom cd16 dur4、tempest cd11）；P1 按 **C**、P2 按 **R**、手機 `#skillButton`、手把 A 鈕；`useSkill` → slow 設 `state.timeWarp={t,factor:.35}`（update() 敵方那一側吃 warpDelta：updateEnemies/updateBoss/updateTelegraphs/updateDeferred/敵彈/敵方光束）、deflect 護罩期間 handleCollisions 把貼身敵彈轉成己方子彈、charge 蓄力 0.5s 後 `fireChargeCannon` 推一道 width 96 的 fromPlayer 光束；`syncSkillHud` 更新 DOM 鈕（READY / ON / Ns），canvas HUD 左下也印 | SKILLS / useSkill / fireChargeCannon / updatePlayers / handleCollisions |

驗收：`node scripts/check-vertag.mjs`（版號四處）+ 本機/線上 Playwright 行為驗收 37 項（`node scripts/verify-behaviour.mjs [url]`,先 `python -m http.server 8011` 或直接傳線上網址；含：第一屏、比例 3:5、教學凍住/無敵不倒數、減速中敵彈 0.5s 只走 35px、中 Boss 血 126 vs 300、無傷 ×2、炸彈 3 顆 +1500、兩個打點、音量、沉浸 800/800、護罩轉彈、大砲 144 傷害）。

## localStorage key 一覽

所有寫入透過 `safeSet / saveJSON`，讀取用 `safeGet / loadJSON`：

| Key | 用途 | 寫入時機 |
|------|------|--------|
| `tf-meta-v3` | 角色選擇 / 商店升級 / 成就 / boss 累計擊殺 | 商店購買、成就解鎖、選角色 |
| `tf-leaderboard-v3` | 全模式總排行（top 8 by score） | submitName 後 |
| `tf-daily-leaderboard-v1` | 每日挑戰排行（top 64，含 dateKey） | submitName 且 state.daily 時 |
| `tf-bossrush-leaderboard-v1` | Boss Rush 計時排行（top 8 by time asc） | endGame 且 bossRushDone 時 |
| `tf-replay-v1` | 單筆 last replay（legacy，仍寫入給「重播上一場」用） | saveLastReplay 結束時 |
| `tf-replays-v1` | 多筆 replay ring buffer（cap 5，含 thumbnail） | saveLastReplay 結束時 |
| `tf-muted` | "0" / "1" 音效靜音狀態 | audio.toggle |
| `tf-quests-v1` | J 今日任務:當天三則 id / 進度 / 已完成 / 今日已賺金幣 | 進度推進、完成、換日重置 |

## 角色 perk 機制

- `CHARACTERS[].perk` 字串，目前支援：
  - `phantom`: 聚焦速度 ×0.75 (=`FOCUS_FACTOR * 0.75`)、`createPlayer` 時自動 +1 僚機（cap 2）
  - `tempest`: 純數值差異（高射速、低 HP），無 runtime perk 邏輯
- 加新 perk → 在 `updatePlayers()` / `createPlayer()` 套用對應行為
- `lockedBy: "<achievement-id>"` 把角色綁到成就，`isCharacterUnlocked()` 檢查

## 狀態異常子彈

- SHOP 三項：`freeze` / `burn` / `shock`，3 級制
- 命中機率 = `STATUS_CHANCE[shopLevel]` (0/18%/32%/48%)
- 冰凍：`enemy.frozenUntil = now + 1500ms`，`updateEnemies` 內以 `moveScale = 0.25` 套用，且暫停射擊
- 燃燒：`enemy.burnUntil + burnDps`，`updateEnemies` 每 frame 扣 `dps * delta` HP
- 感電：`chainShock(source, lv)` 找最近 `lv+1` 隻敵人連線，每隻扣 `1+lv` 傷害，畫 `state.zaps` 閃電
- `maybeApplyStatus` 只對普通子彈呼叫，不對 player laser/beam（避免每 frame proc）

## Boss Rush 模式

- 勾選『Boss Rush』checkbox 後 startNewGame，`state.bossRush = true`
- `updateEnemies` 直接跳過小怪 spawn 與 wave clock，只累積 `bossRushTime`
- `bossDefeated` 後從 `BOSS_RUSH_TYPES`（vanguard → harrier → leviathan → wyrm → phoenix）取下一隻
- 5 隻全清 → `finishBossRush()` 顯示文字、2.4s 後 `endGame()`
- HP 公式：`scaledBossHp(380 + idx * 80)` — 比一般戰更硬一點
- 排行榜依 `time` 升序，`tf-bossrush-leaderboard-v1`，UI tab `data-lb="rush"` 顯示為時間格式

## Replay 多筆儲存

- `MAX_REPLAY_SLOTS = 5`，`tf-replays-v1` 存陣列
- 新錄影 prepend 到陣列頭，舊的被淘汰（FIFO）
- 寫入若 quota 失敗，會逐個剝掉最舊的重試直到成功
- `makeReplayThumbnail()` 用主 canvas `drawImage` 到 96×160 暫存 canvas → jpeg base64
- UI: replay tab 顯示 grid，每格縮圖 + 分數/wave/日期，第一次點擇選中，第二次播放

## Sprite 預生成

- `buildSprites()` 在 init 階段（fitCanvas 後、setScene 前）跑一次
- 每個 sprite = 一個獨立 `<canvas>` 在記憶體中（`document.createElement("canvas")`），用 2× 解析度繪製，原尺寸 drawImage 出來
- 鍵命名規則：`player_<id>` / `enemy_<type>` / `boss_<typeId>` / `wingman`
- 加新角色 / 敵人類型 → 在 `buildSprites` 裡 push 對應 sprite，draw 函式（`drawPlayers/drawEnemies/drawBoss`）會 fallback 到幾何繪製（保險網）
- Phoenix 與 Leviathan 的 `drawBoss` 會額外做 slow rotation（`type === "leviathan" || "phoenix"`）

## Chiptune BGM

- `STAGE_BGM[]` 儲存 5 個 stage 的 `{ root, scale[], stepMs }`
  - 1 = A minor pent / 2 = D phrygian / 3 = E dorian / 4 = G minor / 5 = A harmonic minor
- 4 軌：lead (square) / bass (triangle, 低 8 度) / kick (sine sweep 120→40 Hz) / hat (高通 noise)
- 兩 16-step pattern (`LEAD_A`/`LEAD_B`/`BASS_A`/`BASS_B`) 每 4 bar 切換
- `audio.setBgmStage(stage)` 切調式；如果 `stepMs` 改變，bgmTick 會 reschedule setInterval
- 加新關卡 → push 新 entry 到 `STAGE_BGM`
