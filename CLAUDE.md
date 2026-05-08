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
| `index.html` | DOM 結構：左側 hud-panel（分數/排行/選單/商店/成就/Replay）+ 右側 canvas-wrap |
| `app.js` | 全部遊戲邏輯（單檔 ~3000 行，無拆檔） |
| `styles.css` | 全部 CSS（含 PWA mobile 手機版選單修正） |
| `sw.js` | Service Worker，HTML/JS/CSS 用 network-first，靜態資源 cache-first |
| `manifest.webmanifest` | PWA manifest |
| `run.bat` | Windows 本機 server 啟動腳本 |
| `assets/` | icons (192/512/apple-touch/svg) |

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
- **PWA cache 用 network-first 給 code，cache-first 給 assets** — 改 code 後 bump `CACHE_NAME`（目前 v11）讓舊 cache 失效
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

## 已知地雷區

- **`ENEMY_FIRE_MUL = 5`** 是全域 boss 子彈密度節流。改了會大幅影響難度
- **`Math.random()` 而非 `rand()`** 用在很多地方，所以 daily seed 不能保證完全 deterministic（replay 也會有微小 drift，現有功能容忍）
- **音樂用 `setInterval`**，可能在分頁背景時產生時序漂移；`visibilitychange` 監聽會 togglePause
- **手機版 backdrop-filter 陷阱**：給 `.hud-panel` 加 `position: fixed` 子元素時要先取消 backdrop-filter，否則 fixed 變相對於 hud-panel
- **service worker 改了要 bump cache name**，否則 PWA 用舊 cache 直到 SW 自然更新（以前是 cache-first，現在 network-first 已經沒這問題）

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

B 級（1–3 天）：腳本化關卡、Mid-boss、協力 P2 獨立 HP/Lives。

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
