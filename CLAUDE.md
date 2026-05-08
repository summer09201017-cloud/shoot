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

1. **Constants** — `WORLD`、`POWER_CAP=20`、`ENEMY_COUNT_BOOST=1.44`、`BULLET_COUNT_BOOST=1.44`、`BOSS_TELEGRAPH_TIME=0.4`、`CONTINUE_COSTS=[100,250]`、`MAX_CONTINUES=2`
2. **RNG** — seedable rand() 給 daily challenge / replay
3. **Storage / Meta progression** — 角色、商店升級、成就持久化在 localStorage
4. **Audio** — Web Audio osc + noise，包 BGM 用 setInterval
5. **Weapons** — `default / spread / laser / homing`，4 槽切換（TAB / X / 點 chip）
6. **State** — 大物件 `state` 含 enemies / bullets / particles / telegraphs / deferredActions / stageClearOverlay / continueOverlay 等
7. **Player** — `weaponSlots: { default,spread,laser,homing }` 解鎖機制；`hp/maxHp/lives/bombs/power/shield`
8. **Enemy spawn** — random + formation（V 字/橫掃/三角）；boss 每 5 wave 出現
9. **Boss patterns** — type-driven dispatch table `BOSS_PATTERNS[type][phase][pickIdx]`
10. **Telegraphs / Deferred actions** — boss 大招前 0.4s 紅色預告線（line/ring/fan/spark），預定動作排程在 `state.deferredActions`
11. **Stage Clear / Continue** — 過 10 wave 觸發 stageClearOverlay；死亡且金幣足夠觸發 continueOverlay (15s 倒數)
12. **Update / Render** — `update(delta)` 主迴圈，包含 low-HP slow-mo (HP < 20% 時 delta × 0.65)
13. **Replay** — 錄一場 60 fps 的 input frames 存 JSON，可匯入匯出
14. **Init** — 最後檔尾呼叫 `setScene('menu')`、`registerInput()`、`requestAnimationFrame(tick)`

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

## CP 值待辦（從本次規劃）

S 級已完成：boss patterns / stage clear / continue / telegraph / slow-mo / weapon slots / power 1–20 視覺指示器。

A 級候選（半天到 1 天）：
- Boss Rush 模式 tab
- 程序化 sprite (OffscreenCanvas pre-render)
- Chiptune sequencer BGM (8-bar pattern + drum)
- 狀態異常子彈 (冰凍/燃燒/感電) 商店 perk
- 成就 → 解鎖角色/皮膚
- Replay 縮圖 + 多筆儲存

B 級（1–3 天）：腳本化關卡、新角色特殊技、Mid-boss、協力 P2 獨立 HP/Lives。
