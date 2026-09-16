// scripts/measure-landscape.mjs —— I 手機橫向版面的「量尺」:同一支腳本改版前後各跑一次,只印數字。
// 用法:node scripts/measure-landscape.mjs [url]        (預設 http://127.0.0.1:8011/)
//
// 為什麼要有這支:橫向手機的病是「畫布被撐成 520×867 塞進 390 高」——測試全綠、
// console 乾淨,只有量到「畫布佔視窗多少 %」與「有多少畫面在視窗外」才看得出來。
import { createRequire } from "node:module";
const require = createRequire("C:/Users/HFP/Downloads/hfpc-git/3D-Chess/package.json");
const { chromium } = require("playwright-core");
import { mkdirSync } from "node:fs";
const SHOT = (process.env.SHOT_DIR || "C:/Users/HFP/AppData/Local/Temp/claude/shoot-shots").replace(/[\/]?$/, "/");
mkdirSync(SHOT, { recursive: true });

const URL = (process.argv[2] || "http://127.0.0.1:8011/").replace(/\/?$/, "/");
const VIEWPORTS = [
  { name: "直向 iPhone 390×844", vp: { width: 390, height: 844 } },
  { name: "橫向 iPhone 844×390", vp: { width: 844, height: 390 } },
  { name: "橫向小機 740×360", vp: { width: 740, height: 360 } },
];

const browser = await chromium.launch({ channel: "msedge", headless: true });
const rows = [];

for (const { name, vp } of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction(() => typeof state !== "undefined" && document.body.dataset.scene === "menu");
  // 跳過教學卡,直接進戰鬥態(要量的是玩的時候的版面)
  await page.evaluate(() => localStorage.setItem("tf-tutorial-seen", "1"));
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => typeof state !== "undefined" && document.body.dataset.scene === "menu");
  await page.evaluate(() => startNewGame());
  await page.waitForTimeout(400);

  const m = await page.evaluate(() => {
    const c = document.getElementById("gameCanvas").getBoundingClientRect();
    const vw = innerWidth, vh = innerHeight;
    // 畫布真正看得到的那塊(與視窗矩形相交)
    const visW = Math.max(0, Math.min(c.right, vw) - Math.max(c.left, 0));
    const visH = Math.max(0, Math.min(c.bottom, vh) - Math.max(c.top, 0));
    return {
      vw, vh,
      w: Math.round(c.width), h: Math.round(c.height),
      top: Math.round(c.top), left: Math.round(c.left),
      visW: Math.round(visW), visH: Math.round(visH),
      // 看得見的畫布面積 ÷ 視窗面積
      pct: +((visW * visH) / (vw * vh) * 100).toFixed(1),
      // 畫布有多少比例被切在視窗外(玩不到的遊戲區)
      cut: +((1 - (visW * visH) / (c.width * c.height)) * 100).toFixed(1),
      hudH: Math.round(document.querySelector(".hud-panel")?.getBoundingClientRect().height || 0),
      scrollY: Math.round(document.documentElement.scrollHeight - vh),
    };
  });

  // ★ 觸控竊取:面積數字**照不出**「浮動鈕壓在畫布上」——那會讓玩家拖不動戰機,
  //   而畫布大小前後完全一樣。用 elementFromPoint 在畫布上鋪 12×12 點陣實際問一次。
  //   (dragtetris 0916 實錘:橫向 9/144 = 6.3% 被工具列接走,面積前後沒變。)
  const steal = await page.evaluate(() => {
    const cv = document.getElementById("gameCanvas");
    const r = cv.getBoundingClientRect();
    let total = 0, stolen = 0; const who = {};
    for (let i = 0; i < 12; i++) {
      for (let j = 0; j < 12; j++) {
        const x = r.left + (r.width * (i + 0.5)) / 12;
        const y = r.top + (r.height * (j + 0.5)) / 12;
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
        total++;
        const el = document.elementFromPoint(x, y);
        if (el && el !== cv) {
          stolen++;
          const k = el.id || el.className || el.tagName;
          who[k] = (who[k] || 0) + 1;
        }
      }
    }
    return { total, stolen, who };
  });

  await page.screenshot({ path: SHOT + "landscape-" + vp.width + "x" + vp.height + ".png" });
  rows.push({ name, ...m, steal });
  await ctx.close();
}

await browser.close();

console.log("\n畫面  視窗      畫布(CSS px)  看得到      佔視窗   被切掉   HUD高   頁面可捲   畫布被鈕壓住");
console.log("─".repeat(88));
for (const r of rows) {
  console.log(
    `${r.name.padEnd(20)} ${String(r.vw + "×" + r.vh).padEnd(9)} ` +
    `${String(r.w + "×" + r.h).padEnd(13)} ${String(r.visW + "×" + r.visH).padEnd(11)} ` +
    `${String(r.pct + "%").padEnd(8)} ${String(r.cut + "%").padEnd(8)} ` +
    `${String(r.hudH).padEnd(7)} ${String(r.scrollY + "px").padEnd(9)} ` +
    `${r.steal.stolen}/${r.steal.total}${r.steal.stolen ? " ← " + Object.keys(r.steal.who).join(",") : ""}`
  );
}
console.log("");
