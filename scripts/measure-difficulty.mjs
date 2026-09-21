// scripts/measure-difficulty.mjs —— 「雷電太容易」的量尺(v24,2026-09-21)
// 用法:node scripts/measure-difficulty.mjs [url] [秒數上限=300]     (預設 http://127.0.0.1:8011/)
//
// 問的問題:**一個不會閃、也不丟炸彈的機器人,在各難度能活多久、打到第幾波?**
// 這是 sports-balance-tester 那套「躺平三星」的雷電版:躺平 bot 活得越久 = 遊戲越沒有挑戰。
// 手動調難度數字最怕「我覺得變難了」—— 只有前後各跑一次同一支腳本,數字才算數。
//
// 兩隻 bot(都不丟炸彈、不放特技、不吃 continue):
//   躺平 idle   —— 一動不動站在出生點(遊戲本來就自動開火,所以它也在射)
//   閃避 dodge  —— 每幀預測敵彈落點,挑最安全的一條車道橫移(貪婪、只看眼前),模擬會閃的普通玩家
//
// 做法同 check-daily-determinism:整段放在**同一個同步 evaluate 區塊**,startNewGame(seed) 之後
// 自己推 update(1/60),rAF 插不進來 ⇒ 300 秒遊戲時間幾秒就跑完,而且結果可重現(固定種子)。
// ⚠ 先把 meta.credits 歸零,不然死掉會跳 continue 面板(state.running=false)被誤讀成結束——其實是同一件事,
//   但金幣數會讓「什麼時候死」跟本機商店存檔綁在一起,測試就不可重現了。
import { createRequire } from "node:module";
const require = createRequire("C:/Users/HFP/Downloads/hfpc-git/3D-Chess/package.json");
const { chromium } = require("playwright-core");

const URL = (process.argv[2] || "http://127.0.0.1:8011/").replace(/\/?$/, "/");
const CAP = Number(process.argv[3] || 300);
const SEEDS = [20260921, 777, 4242, 31337]; // 3 顆時「硬派躺平活得比普通久」的雜訊看得見,4 顆稍穩;要更準自己加
const DIFFS = ["easy", "normal", "hard", "storm"];
const BOTS = ["idle", "dodge"];

const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({ viewport: { width: 900, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
await page.goto(URL, { waitUntil: "load" });
await page.waitForFunction(() => typeof state !== "undefined" && document.body.dataset.scene === "menu");
await page.evaluate(() => { localStorage.setItem("tf-tutorial-seen", "1"); localStorage.removeItem("tf-meta-v3"); });
await page.reload({ waitUntil: "load" });
await page.waitForFunction(() => typeof state !== "undefined" && document.body.dataset.scene === "menu");

const rows = [];
for (const diff of DIFFS) {
  for (const bot of BOTS) {
    for (const seed of SEEDS) {
      const r = await page.evaluate(({ diff, bot, seed, cap }) => {
        meta.credits = 0;                       // 不給 continue
        meta.shop = Object.fromEntries(Object.keys(meta.shop || {}).map((k) => [k, 0])); // 沒買任何升級
        const sel = document.getElementById("difficultySelect");
        sel.value = diff;
        const bossRush = document.getElementById("bossRushToggle");
        if (bossRush) bossRush.checked = false;
        startNewGame(seed);
        const p = state.players[0];
        const dt = 1 / 60;
        let t = 0, frames = 0, maxWave = 1, hitsLog = [];
        const lanes = 9;
        const laneX = (i) => 28 + (i * (WORLD.width - 56)) / (lanes - 1);
        pointer.active = false;
        // ⚠ 結束條件不能看 state.running:STAGE CLEAR 那 2.6 秒 running=false 但 update() 照樣推它、之後自己恢復。
        //   首版就是這樣把「第 11 波開頭的過關演出」讀成「死了」——四種難度全在 141 秒整齊死亡,一看就假。
        const over = () => state.scene !== "play" || !!state.continueOverlay;
        while (t < cap && !over()) {
          if (bot === "dodge") {
            // 預測每顆敵彈到達玩家 y 時的 x,算每條車道的危險值(距離 <32px 算命中)
            const danger = new Array(lanes).fill(0);
            for (const b of state.enemyBullets) {
              const vy = b.vy ?? 0;
              if (vy <= 0 || b.y > p.y + 30) continue;
              const tt = (p.y - b.y) / vy;
              if (tt > 1.6) continue;
              const px = b.x + (b.vx ?? 0) * tt;
              const w = 1.6 - tt; // 越近越危險
              for (let i = 0; i < lanes; i++) if (Math.abs(laneX(i) - px) < 34) danger[i] += 1 + w;
            }
            for (const e of state.enemies) {
              if (e.y < p.y - 260 || e.y > p.y + 20) continue;
              for (let i = 0; i < lanes; i++) if (Math.abs(laneX(i) - e.x) < e.radius + 22) danger[i] += 0.8;
            }
            let best = 0, bestScore = Infinity;
            for (let i = 0; i < lanes; i++) {
              const s = danger[i] * 10 + Math.abs(laneX(i) - p.x) / 200; // 同樣安全就別跑太遠
              if (s < bestScore) { bestScore = s; best = i; }
            }
            pointer.active = true; pointer.x = laneX(best); pointer.y = WORLD.height - 120;
          }
          const hitsBefore = state.damageTaken;
          update(dt);
          if (state.damageTaken > hitsBefore) hitsLog.push(Math.floor(t));
          t += dt; frames++;
          if (state.wave > maxWave) maxWave = state.wave;
        }
        pointer.active = false;
        const alive = !over();
        const out = {
          diff, bot, seed,
          survived: Math.round(t),
          alive,
          wave: maxWave,
          stage: state.stage,
          livesLeft: alive ? p.lives : 0,
          hp: alive ? p.hp : 0,
          maxHp: p.maxHp,
          hits: hitsLog.length,
          dmg: state.damageTaken,
          bossKills: state.bossKillsRun,
          score: state.score,
          frames,
        };
        // 收乾淨,讓下一輪從選單重開
        state.running = false;
        if (typeof setScene === "function") { try { setScene("menu"); } catch {} }
        return out;
      }, { diff, bot, seed, cap: CAP });
      rows.push(r);
    }
  }
}
await browser.close();

const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);
console.log(`\n雷電難度量尺 —— 兩隻不丟炸彈的 bot,各難度 × ${SEEDS.length} 顆種子,上限 ${CAP} 秒遊戲時間\n`);
console.log(`  ${pad("難度", 8)}${pad("bot", 7)}${rpad("活了(秒)", 8)}${rpad("到第幾波", 9)}${rpad("剩命", 5)}${rpad("被打", 5)}${rpad("Boss", 5)}${rpad("分數", 9)}`);
for (const diff of DIFFS) {
  for (const bot of BOTS) {
    const rs = rows.filter((r) => r.diff === diff && r.bot === bot);
    const avg = (k) => (rs.reduce((a, r) => a + r[k], 0) / rs.length);
    const surv = rs.map((r) => (r.alive ? `${r.survived}+` : String(r.survived))).join("/");
    console.log(`  ${pad(diff, 8)}${pad(bot, 7)}${rpad(surv, 8)}${rpad(avg("wave").toFixed(1), 9)}${rpad(avg("livesLeft").toFixed(1), 5)}${rpad(avg("hits").toFixed(0), 5)}${rpad(avg("bossKills").toFixed(1), 5)}${rpad(Math.round(avg("score")), 9)}`);
  }
}
console.log("\n  「活了」欄帶 + 表示到上限還活著(每顆種子一個數);剩命/被打/Boss/分數是平均。");
if (errors.length) console.log("\n  ✗ pageerror:" + errors.join(" / "));
else console.log("  ✓ 零 pageerror");
console.log("");
process.exitCode = errors.length ? 1 : 0;
