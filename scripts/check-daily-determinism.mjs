// scripts/check-daily-determinism.mjs —— H「daily 種子真確定性」的常駐迴歸(v23)
// 用法:node scripts/check-daily-determinism.mjs [url]      (預設 http://127.0.0.1:8011/)
//
// 問的問題只有一個:**同一顆 daily 種子,在不同幀率的機器上會不會長出同一批波次?**
//
// 為什麼非測不可:舊版只有一條種子流,而視覺特效也在抽它 —— 粒子閘門寫
// `if (Math.random() < delta * 6)`、星空每幀重生抽 `random(0, WORLD.width)`。
// 幀率一變,視覺抽走的次數就變,後面的敵人生成整個位移。
// ⚠ 這種病**畫面正常、console 乾淨、單元測試全綠**,只有「拿兩種幀率跑同一顆種子
//   再逐項比對」才照得出來 —— 所以驗法本身就是這支檔案存在的理由。
//
// 做法:在**同一個同步 evaluate 區塊**裡 startNewGame(seed) 然後手動推 update(dt),
// rAF 回呼插不進同步區塊 ⇒ 量到的完全是我們給的幀率,不是瀏覽器的。
// (這條是 skill canvas-playwright-verify 的教訓:headless 的 rAF 會成串爆發,
//  waitForTimeout 期間遊戲時間根本不動,拿它當幀率來源會量到假數字。)
import { createRequire } from "node:module";
const require = createRequire("C:/Users/HFP/Downloads/hfpc-git/3D-Chess/package.json");
const { chromium } = require("playwright-core");

const URL = (process.argv[2] || "http://127.0.0.1:8011/").replace(/\/?$/, "/");
const SECONDS = 14;
const SEED = 20260917; // 固定一顆,測的是「幀率不影響」,不是「今天是哪天」

// 三種幀率跑同一顆種子。jitter 用固定式子(不是亂數),測試自己要可重現。
const RUNS = [
  { name: "60fps 固定", dt: 1 / 60 },
  { name: "30fps 固定", dt: 1 / 30 },
  { name: "抖動 22~33ms", dt: null },
];

const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({ viewport: { width: 900, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
await page.goto(URL, { waitUntil: "load" });
await page.waitForFunction(() => typeof state !== "undefined" && document.body.dataset.scene === "menu");
await page.evaluate(() => localStorage.setItem("tf-tutorial-seen", "1"));
await page.reload({ waitUntil: "load" });
await page.waitForFunction(() => typeof state !== "undefined" && document.body.dataset.scene === "menu");

const results = [];
for (const run of RUNS) {
  const r = await page.evaluate(
    ({ seed, seconds, dt }) => {
      // ── 整段同步:startNewGame 重設種子 → 自己推 update → 收指紋,rAF 插不進來 ──
      // ⚠ 指紋一定要在「出生那一刻」抓 —— 等 update() 跑完再從 state.enemies 撈,
      //   x 已經被推了一幀,不同幀率天生差 1px,會得到「假的不一致」。首版就踩了這個。
      const fp = [];
      const origSpawn = window.spawnEnemy;
      window.spawnEnemy = function (...a) {
        const r = origSpawn.apply(this, a);
        const e = state.enemies[state.enemies.length - 1];
        // 只取「世界決定的」欄位:出生點、菁英、蛇行、速度、相位
        if (e) fp.push([Math.round(e.x), e.elite ? 1 : 0, e.zigzag ? 1 : 0, Math.round(e.speed), e.seed.toFixed(4)].join("|"));
        return r;
      };
      startNewGame(seed);
      let t = 0, i = 0;
      while (t < seconds) {
        const d = dt != null ? dt : 0.022 + ((i * 7919) % 11) / 1000; // 22~32ms 固定式抖動
        update(d);
        t += d; i++;
      }
      window.spawnEnemy = origSpawn;
      return { fp, frames: i, particles: state.particles.length };
    },
    { seed: SEED, seconds: SECONDS, dt: run.dt }
  );
  results.push({ ...run, ...r });
}

await browser.close();

console.log(`\nH daily 種子確定性 —— 同一顆種子 (${SEED})、同樣 ${SECONDS} 秒遊戲時間、三種幀率\n`);
const base = results[0];
let fail = 0;
for (const r of results) {
  console.log(`  ${r.name.padEnd(14)} 推了 ${String(r.frames).padStart(4)} 幀 · 生出 ${String(r.fp.length).padStart(3)} 隻敵人 · 場上粒子 ${r.particles}`);
}
console.log("");
for (const r of results.slice(1)) {
  const n = Math.min(base.fp.length, r.fp.length);
  const firstDiff = base.fp.slice(0, n).findIndex((v, i) => v !== r.fp[i]);
  // 時間累加的浮點誤差可能讓最後一隻差一個 ⇒ 允許長度差 1,但「共同前綴」必須逐項相同
  const lenOk = Math.abs(base.fp.length - r.fp.length) <= 1;
  if (firstDiff === -1 && lenOk) {
    console.log(`  ✓ ${r.name} 與 ${base.name} 的前 ${n} 隻敵人逐項相同(隻數差 ${Math.abs(base.fp.length - r.fp.length)})`);
  } else {
    fail++;
    console.log(`  ✗ ${r.name} 與 ${base.name} 不一致`);
    if (firstDiff !== -1) {
      console.log(`      第 ${firstDiff + 1} 隻就不同:`);
      console.log(`        ${base.name}: ${base.fp[firstDiff]}`);
      console.log(`        ${r.name}: ${r.fp[firstDiff]}`);
    }
    if (!lenOk) console.log(`      隻數差太多:${base.fp.length} vs ${r.fp.length}`);
  }
}
if (errors.length) { fail++; console.log("  ✗ 有 pageerror:" + errors.join(" / ")); }
else console.log("  ✓ 零 pageerror");

console.log(fail ? `\n🔴 ${fail} 項不一致 —— daily 還沒真確定\n` : "\n🟢 三種幀率跑出同一批波次 —— daily 種子真確定\n");
process.exit(fail ? 1 : 0);
