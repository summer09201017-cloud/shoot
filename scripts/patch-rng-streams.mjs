// scripts/patch-rng-streams.mjs —— v23 H:把剩下的亂數呼叫分流到 world / combat / visual 三條。
// 一次性補丁,跑完就留著當紀錄(也方便別的 repo 照抄)。每一條都是精確字串 + 事後斷言,
// 對不到就整支中止不寫檔 —— 本 repo 踩過「replace 靜默沒命中、commit 照樣綠」的坑。
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "C:/Users/HFP/Downloads/hfpc-git/shoot/app.js";
let src = readFileSync(FILE, "utf8");

// [分類] world = 決定「玩家碰到什麼」 / combat = 這個玩家自己的骰子 / visual = 純畫面
const EDITS = [
  // ── world:敵人生成 ────────────────────────────────────────────────
  ["const elite = opts.elite ?? Math.random() < eliteChance;",
   "const elite = opts.elite ?? rand() < eliteChance;", "world 敵人菁英判定"],
  ["const zigzag = opts.zigzag ?? Math.random() < 0.34;",
   "const zigzag = opts.zigzag ?? rand() < 0.34;", "world 敵人蛇行"],
  ["    const dir = Math.random() < 0.5 ? 1 : -1;",
   "    const dir = rand() < 0.5 ? 1 : -1;", "world 編隊方向"],

  // ── world:Boss 彈幕角度(決定你要閃什麼) ─────────────────────────
  ['{ fire: pRing("#ff5d5d", 20, 180, BOSS_TELEGRAPH_TIME, () => Math.random() * Math.PI), cooldown: 1.2 },',
   '{ fire: pRing("#ff5d5d", 20, 180, BOSS_TELEGRAPH_TIME, () => rand() * Math.PI), cooldown: 1.2 },', "world Boss 環彈相位 a"],
  ['{ fire: pRing("#ff5d5d", 24, 200, BOSS_TELEGRAPH_TIME, () => Math.random() * Math.PI), cooldown: 0.9 },',
   '{ fire: pRing("#ff5d5d", 24, 200, BOSS_TELEGRAPH_TIME, () => rand() * Math.PI), cooldown: 0.9 },', "world Boss 環彈相位 b"],

  // ── world:掉寶(掉什麼、掉不掉) ──────────────────────────────────
  ["  let roll = Math.random() * total;",
   "  let roll = rand() * total;", "world 寶物種類"],
  ["  if (!bombed && Math.random() < dropChance) spawnLoot(enemy.x, enemy.y);",
   "  if (!bombed && rand() < dropChance) spawnLoot(enemy.x, enemy.y);", "world 掉寶機率"],
  ["  else if (bombed && Math.random() < 0.05) spawnLoot(enemy.x, enemy.y);",
   "  else if (bombed && rand() < 0.05) spawnLoot(enemy.x, enemy.y);", "world 炸彈掉寶機率"],

  // ── world:過關隨機解鎖武器槽 ─────────────────────────────────────
  ["      const pick = lockedSlots[Math.floor(Math.random() * lockedSlots.length)];",
   "      const pick = lockedSlots[Math.floor(rand() * lockedSlots.length)];", "world 過關解鎖槽位"],

  // ── combat:玩家武器散布(開幾槍因人而異,不可推擠世界流) ─────────
  ["    const a = -Math.PI / 2 + random(-0.5, 0.5);",
   "    const a = -Math.PI / 2 + crandom(-0.5, 0.5);", "combat 追蹤彈角度"],
  ["      x: p.x + random(-8, 8), y: p.y - 14, radius: 5,",
   "      x: p.x + crandom(-8, 8), y: p.y - 14, radius: 5,", "combat 追蹤彈起點"],

  // ── combat:異常狀態機率(命中幾次因人而異) ──────────────────────
  ["  if (fL > 0 && Math.random() < STATUS_CHANCE[fL]) {",
   "  if (fL > 0 && crand() < STATUS_CHANCE[fL]) {", "combat 冰凍機率"],
  ["  if (bL > 0 && Math.random() < STATUS_CHANCE[bL]) {",
   "  if (bL > 0 && crand() < STATUS_CHANCE[bL]) {", "combat 燃燒機率"],
  ["  if (sL > 0 && Math.random() < STATUS_CHANCE[sL]) {",
   "  if (sL > 0 && crand() < STATUS_CHANCE[sL]) {", "combat 感電機率"],

  // ── visual:粒子閘門(跟幀率綁死,絕不可進種子流) ────────────────
  ['      if (Math.random() < delta * 6) spawnParticle(e.x, e.y, "#ff8a3a");',
   '      if (vrand() < delta * 6) spawnParticle(e.x, e.y, "#ff8a3a");', "visual 燃燒粒子閘門"],
  ['        if (Math.random() < 0.3) spawnParticle(e.x, e.y, "#fff39a");',
   '        if (vrand() < 0.3) spawnParticle(e.x, e.y, "#fff39a");', "visual 冰凍粒子閘門"],

  // ── visual:畫面震動 / 浮字抖動 ───────────────────────────────────
  ["  const sx = state.shake.intensity > 0 ? (Math.random() - 0.5) * state.shake.intensity : 0;",
   "  const sx = state.shake.intensity > 0 ? (vrand() - 0.5) * state.shake.intensity : 0;", "visual 震動 x"],
  ["  const sy = state.shake.intensity > 0 ? (Math.random() - 0.5) * state.shake.intensity : 0;",
   "  const sy = state.shake.intensity > 0 ? (vrand() - 0.5) * state.shake.intensity : 0;", "visual 震動 y"],
  ["      const ox = (Math.random() - 0.5) * 12;",
   "      const ox = (vrand() - 0.5) * 12;", "visual 浮字偏移 x"],
  ["      const oy = (Math.random() - 0.5) * 12;",
   "      const oy = (vrand() - 0.5) * 12;", "visual 浮字偏移 y"],

  // ── visual:Boss 爆炸的粒子「位置」(數量固定 60,但位置純畫面) ──
  ["  for (let i = 0; i < 60; i++) spawnParticle(b.x + random(-30, 30), b.y + random(-30, 30), b.color);",
   "  for (let i = 0; i < 60; i++) spawnParticle(b.x + vrandom(-30, 30), b.y + vrandom(-30, 30), b.color);", "visual Boss 爆炸粒子位置"],
];

let done = 0;
for (const [from, to, label] of EDITS) {
  const n = src.split(from).length - 1;
  if (n !== 1) {
    console.error(`✗ 中止:「${label}」錨點命中 ${n} 次(需要剛好 1 次)`);
    process.exit(1);
  }
  src = src.replace(from, to);
  console.log(`  ✓ ${label}`);
  done++;
}

writeFileSync(FILE, src);

// ── 事後斷言:剩下的 Math.random() 只能是「刻意保留」的三處 ──────────
const after = readFileSync(FILE, "utf8");
const left = after.split("\n")
  .map((l, i) => [i + 1, l])
  // 註解行不算(本檔自己的說明就寫著 Math.random,拿它當漏網會是假紅)
  .filter(([, l]) => /Math\.random\(/.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l));
const ALLOWED = [
  "data[i] = (Math.random() * 2 - 1)",          // 音訊白噪音緩衝(init 建一次)
  "seed = (Math.random() * 0xffffffff) >>> 0",  // 非 daily 場次的亂數種子來源本身
  "const vrand = () => Math.random();",          // 視覺流的實作
];
const bad = left.filter(([, l]) => !ALLOWED.some((a) => l.includes(a)));
console.log(`\n改了 ${done} 處;剩下 ${left.length} 個 Math.random(),其中刻意保留 ${left.length - bad.length} 個`);
if (bad.length) {
  console.error("✗ 還有沒分類的 Math.random():");
  bad.forEach(([n, l]) => console.error(`   app.js:${n}  ${l.trim().slice(0, 90)}`));
  process.exit(1);
}
console.log("🟢 三條流分類完成,零漏網");
