// scripts/verify-behaviour.mjs —— 雷電 v20 九件行為驗收(Playwright-core + 系統 Edge;預設對本機 http://127.0.0.1:8011/,可傳線上網址):node scripts/verify-behaviour.mjs [url]
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("C:/Users/HFP/Downloads/hfpc-git/3D-Chess/package.json");
const { chromium } = require("playwright-core");
const OUT = (process.env.SHOT_DIR || "C:/Users/HFP/AppData/Local/Temp/claude/shoot-shots").replace(/[\/]?$/, "/");
mkdirSync(OUT, { recursive: true });
const URL = (process.argv[2] || "http://127.0.0.1:8011/").replace(/\/?$/, "/");
const browser = await chromium.launch({ channel: "msedge", headless: true });
let pass = 0, fail = 0; const errors = [];
const ok = (c, m, n = "") => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m + (n ? " → " + n : "")); } };
const ev = (page, fn, ...a) => page.evaluate(fn, ...a);
async function fresh(vp, opts = {}) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: !!opts.touch, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|serviceWorker|sw\.js|SSL/i.test(m.text())) errors.push("console: " + m.text().slice(0, 140)); });
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction(() => typeof state !== "undefined" && document.body.dataset.scene === "menu");
  if (opts.seen) await ev(page, () => localStorage.setItem("tf-tutorial-seen", "1"));
  if (opts.char) await ev(page, (c) => { meta.selectedCharacter = c; saveMeta(); }, opts.char);
  return { ctx, page };
}
const startGame = async (page) => { await ev(page, () => document.getElementById("startButton").scrollIntoView({ block: "center" })); await page.click("#startButton"); await page.waitForTimeout(300); };

// ───────── 桌機 1280×800:A 第一屏 / 畫布比例 / B 教學 + 無敵 / N slow / M 中 Boss / F 無傷 / E 換分 / C 打點 / G 音量
{
  const { ctx, page } = await fresh({ width: 1280, height: 800 });
  const a = await ev(page, () => { const b = document.getElementById("startButton").getBoundingClientRect(); const sg = document.querySelector(".stats-grid"); const c = document.getElementById("gameCanvas").getBoundingClientRect(); return { startTop: Math.round(b.top), startBottom: Math.round(b.bottom), statsHidden: getComputedStyle(sg).display === "none", fresh: document.body.classList.contains("fresh"), cw: Math.round(c.width), ch: Math.round(c.height), ratio: +(c.width / c.height).toFixed(3) }; });
  ok(a.startBottom < 800 && a.startTop > 0, `A 桌機開始鈕在第一屏(top ${a.startTop}, bottom ${a.startBottom})`);
  ok(a.statsHidden && a.fresh, "A 還沒玩過:選單態統計卡隱藏", JSON.stringify(a));
  ok(Math.abs(a.ratio - 0.6) < 0.02, `D 桌機畫布比例 3:5(${a.cw}×${a.ch} = ${a.ratio})`, JSON.stringify(a));
  await page.screenshot({ path: OUT + "v20-desktop-menu.png" });
  await startGame(page);
  const t = await ev(page, () => ({ tut: !document.getElementById("tutorialOverlay").hidden, open: state.tutorialOpen, running: state.running, grace: state.players[0].grace, scene: state.scene, statsShown: getComputedStyle(document.querySelector(".stats-grid")).display !== "none" }));
  ok(t.tut && t.open && !t.running, "B 第一次按開始 ⇒ 教學卡開著、遊戲凍住", JSON.stringify(t));
  ok(t.statsShown, "A 開打後統計卡回來(fresh 拿掉)");
  await page.screenshot({ path: OUT + "v20-desktop-tutorial.png" });
  await page.waitForTimeout(700);
  const g0 = await ev(page, () => state.players[0].grace);
  ok(Math.abs(g0 - 5) < 0.01, `B 教學卡開著時無敵不倒數(grace ${g0})`);
  await page.click("#tutorialGo");
  await page.waitForTimeout(600);
  const t2 = await ev(page, () => ({ hidden: document.getElementById("tutorialOverlay").hidden, running: state.running, grace: state.players[0].grace, seen: localStorage.getItem("tf-tutorial-seen"), skillBtnShown: !document.getElementById("skillButton").hidden && getComputedStyle(document.getElementById("skillButton")).display !== "none", skillTxt: document.getElementById("skillCd").textContent }));
  ok(t2.hidden && t2.running && t2.seen === "1", "B 按出擊 ⇒ 開打、記住已看過", JSON.stringify(t2));
  ok(t2.grace > 3.5 && t2.grace < 5, `B 開局無敵倒數中(grace ${t2.grace.toFixed(2)})`);
  ok(t2.skillBtnShown && t2.skillTxt === "SKILL", "N SKILL 鈕顯示、READY", JSON.stringify(t2));
  // 無敵期間被打不扣血
  const hp0 = await ev(page, () => { const p = state.players[0]; const hp = p.hp; damagePlayer(p, 3); return { before: hp, after: p.hp, hits: state.waveHits }; });
  ok(hp0.before === hp0.after && hp0.hits === 0, "B 無敵期間 damagePlayer 不扣血、不算被打", JSON.stringify(hp0));
  // N ⏳ slow(alpha)
  await page.keyboard.press("c");
  await page.waitForTimeout(250);
  const sk = await ev(page, () => ({ warp: !!state.timeWarp, factor: state.timeWarp && state.timeWarp.factor, cd: state.players[0].skillCd, active: state.players[0].skillActive, cls: document.getElementById("skillButton").className, txt: document.getElementById("skillCd").textContent }));
  ok(sk.warp && sk.factor === 0.35 && sk.cd > 18, "N 按 C ⇒ 時間減速啟動、冷卻 20s 開始", JSON.stringify(sk));
  ok(/is-on/.test(sk.cls) && sk.txt === "ON", "N SKILL 鈕顯示 ON", JSON.stringify(sk));
  // 敵彈在減速中走得慢:放一顆敵彈,量 0.5 秒位移
  const mv = await ev(page, async () => { state.enemyBullets.push({ x: 240, y: 100, vx: 0, vy: 200, radius: 5, color: "#f00", damage: 1 }); const y0 = 100; await new Promise((r) => setTimeout(r, 500)); const b = state.enemyBullets[state.enemyBullets.length - 1]; return { dy: b ? b.y - y0 : null, warp: !!state.timeWarp }; });
  ok(mv.dy !== null && mv.dy < 60 && mv.warp, `N 減速中敵彈 0.5s 只走 ${mv.dy && mv.dy.toFixed(0)}px(正常約 100)`, JSON.stringify(mv));
  await page.screenshot({ path: OUT + "v20-desktop-play-slow.png" });
  await page.waitForTimeout(3200);
  const sk2 = await ev(page, () => ({ warp: !!state.timeWarp, cd: Math.ceil(state.players[0].skillCd), txt: document.getElementById("skillCd").textContent, cls: document.getElementById("skillButton").className }));
  ok(!sk2.warp && sk2.cd > 10 && /is-cd/.test(sk2.cls) && /s$/.test(sk2.txt), "N 減速結束、鈕顯示冷卻秒數", JSON.stringify(sk2));
  // M 中 Boss:跳到第 4 波尾巴
  const mb = await ev(page, async () => { state.wave = 4; state.difficultyTimer = 13.95; state.players[0].grace = 0; await new Promise((r) => setTimeout(r, 400)); return { wave: state.wave, pending: state.bossPending, mid: state.bossWarning && state.bossWarning.mid }; });
  ok(mb.wave === 5 && mb.pending && mb.mid === true, "M 第 5 波 ⇒ 中 Boss 預告", JSON.stringify(mb));
  await page.waitForTimeout(2200);
  const boss = await ev(page, () => state.boss && ({ mid: state.boss.mid, radius: state.boss.radius, name: state.boss.name, hp: state.boss.maxHp, type: state.boss.type }));
  ok(boss && boss.mid && boss.radius === 44 && /中 BOSS/.test(boss.name), "M 中 Boss 出現:體型 44、名字「中 BOSS」", JSON.stringify(boss));
  const stageBossHp = await ev(page, () => scaledBossHp(220 + 0 * 140 + 1 * 80));
  ok(boss && boss.hp < stageBossHp * 0.5, `M 中 Boss 血 ${boss && boss.hp} < STAGE BOSS ${stageBossHp} 的一半`);
  // 打死中 Boss ⇒ 中 Boss 計數、不進 boss 成就
  const kill = await ev(page, () => { const before = meta.bossKills; state.boss.arrived = true; state.boss.hp = 1; damageBoss(state.boss, 5, 240, 200); return { boss: state.boss, mid: state.midBossKillsRun, run: state.bossKillsRun, metaDelta: meta.bossKills - before, ach: !!meta.achievements["boss-1"] }; });
  ok(kill.boss === null && kill.mid === 1 && kill.run === 1 && kill.metaDelta === 0, "M 中 Boss 擊破:算中 Boss、不算 Boss 成就", JSON.stringify(kill));
  // F 無傷加倍:這波沒被打 ⇒ 下一波 ×2;被打一次 ⇒ 下一波 ×1
  const fl = await ev(page, async () => { state.waveHits = 0; state.difficultyTimer = 13.95; await new Promise((r) => setTimeout(r, 300)); const m1 = state.flawlessMult; const fw = state.flawlessWaves; const p = state.players[0]; p.grace = 0; p.invincible = 0; damagePlayer(p, 1); const hits = state.waveHits; state.difficultyTimer = 13.95; await new Promise((r) => setTimeout(r, 300)); return { m1, fw, hits, m2: state.flawlessMult, wave: state.wave }; });
  ok(fl.m1 === 2 && fl.fw >= 1, `F 無傷一波 ⇒ 下一波 ×2(flawlessMult ${fl.m1})`, JSON.stringify(fl));
  ok(fl.hits === 1 && fl.m2 === 1, "F 被打一次 ⇒ 下一波回 ×1", JSON.stringify(fl));
  // 分數真的乘:flawlessMult=2 時打死一隻 value 80 的敵機
  const sc = await ev(page, () => { state.flawlessMult = 2; state.combo = { count: 0, timer: 0, multiplier: 1, max: 0 }; const s0 = state.score; destroyEnemy({ x: 100, y: 100, value: 80, elite: false, radius: 16, hp: 0 }); return state.score - s0; });
  ok(sc === 160, `F 倍率下擊破 +${sc}(80×2)`);
  // E 炸彈換分 + C 完賽打點
  const eg = await ev(page, () => { const pings = []; window.psPing = (k, t) => pings.push(k); state.runStartMs = performance.now() - 30000; const p = state.players[0]; p.bombs = 3; const s0 = state.score; endGame(); return { cash: state.bombCashout, delta: state.score - s0, pings, scene: state.scene, body: document.getElementById("messageBody").textContent, nameEntry: !document.getElementById("nameEntry").hidden }; });
  ok(eg.cash === 1500 && eg.delta === 1500, `E 結算炸彈 3 顆換 +${eg.cash}`, JSON.stringify(eg));
  ok(eg.pings.includes("flyshoot-done"), "C 完賽打點 flyshoot-done 送出", JSON.stringify(eg.pings));
  if (eg.nameEntry) { await page.fill("#nameInput", "測試"); await page.click("#nameSubmit"); await page.waitForTimeout(300); }
  const body = await ev(page, () => document.getElementById("messageBody").textContent);
  ok(/炸彈換分 \+1500/.test(body) && /無傷波/.test(body) && /中 Boss 1/.test(body), "結算文字有 無傷波 / 炸彈換分 / 中 Boss", body.slice(0, 160));
  // G 音量(選單態才看得到下拉)
  await page.selectOption("#bgmVolume", "0"); await page.selectOption("#sfxVolume", "3");
  const vol = await ev(page, () => ({ bgm: audio.volBgm, sfx: audio.volSfx, lsB: localStorage.getItem("tf-vol-bgm"), lsS: localStorage.getItem("tf-vol-sfx") }));
  ok(vol.bgm === 0 && vol.sfx === 3 && vol.lsB === "0" && vol.lsS === "3", "G 音量下拉 ⇒ audio + localStorage", JSON.stringify(vol));
  // C -boss 打點:再開一場打死 Boss
  const bp = await ev(page, () => { const pings = []; window.psPing = (k) => pings.push(k); startNewGame(); state.tutorialOpen = false; document.getElementById("tutorialOverlay").hidden = true; state.running = true; startBossWarning(null, {}); spawnBoss(null, false); state.boss.arrived = true; state.boss.hp = 1; damageBoss(state.boss, 5, 240, 200); return pings; });
  ok(bp.includes("flyshoot-boss"), "C 本場第一次打倒 Boss ⇒ flyshoot-boss", JSON.stringify(bp));
  // D 沉浸:戰鬥中按 ⛶ ⇒ 左欄收、畫布吃滿高
  await page.click("#mfsFull");
  await page.waitForTimeout(400);
  const im = await ev(page, () => { const c = document.getElementById("gameCanvas").getBoundingClientRect(); const hud = document.querySelector(".hud-panel"); return { immersive: document.body.classList.contains("immersive"), scene: document.body.dataset.scene, hudHidden: getComputedStyle(hud).display === "none", ch: Math.round(c.height), innerH: innerHeight, ratio: +(c.width / c.height).toFixed(3), btnShown: getComputedStyle(document.getElementById("mfsFull")).display !== "none" }; });
  ok(im.immersive && im.scene === "play" && im.hudHidden, "D 桌機 ⛶ ⇒ 沉浸態、戰鬥中左欄收起", JSON.stringify(im));
  ok(Math.abs(im.ch - im.innerH) < 4 && Math.abs(im.ratio - 0.6) < 0.02, `D 畫布吃滿視窗高(${im.ch}/${im.innerH})且比例 3:5`, JSON.stringify(im));
  await page.screenshot({ path: OUT + "v20-desktop-immersive.png" });
  await ctx.close();
}

// ───────── 第二次進站(已看過教學)不再跳教學;無敵提示文字出現
{
  const { ctx, page } = await fresh({ width: 1280, height: 800 }, { seen: true });
  await startGame(page);
  const t = await ev(page, () => ({ tut: !document.getElementById("tutorialOverlay").hidden, running: state.running, txt: state.texts.map((x) => x.text).join("|") }));
  ok(!t.tut && t.running, "B 看過教學 ⇒ 直接開打", JSON.stringify(t));
  ok(/開局 5 秒無敵/.test(t.txt), "B 開局提示「開局 5 秒無敵」", t.txt);
  await page.click("#tutorialButton").catch(() => {});
  await ctx.close();
}

// ───────── 手機 390×844:A 第一屏 / SKILL 鈕 / N deflect(blade)
{
  const { ctx, page } = await fresh({ width: 390, height: 844 }, { touch: true, seen: true, char: "blade" });
  const a = await ev(page, () => { const b = document.getElementById("startButton").getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), statsHidden: getComputedStyle(document.querySelector(".stats-grid")).display === "none" }; });
  ok(a.bottom < 844 && a.statsHidden, `A 手機開始鈕在第一屏(bottom ${a.bottom})、統計卡隱藏`, JSON.stringify(a));
  await page.screenshot({ path: OUT + "v20-mobile-menu.png" });
  await startGame(page);
  await page.waitForTimeout(400);
  const s1 = await ev(page, () => { const b = document.getElementById("skillButton").getBoundingClientRect(); return { shown: getComputedStyle(document.getElementById("skillButton")).display !== "none", inView: b.top >= 0 && b.bottom <= innerHeight, icon: document.getElementById("skillIcon").textContent, skill: state.players[0].skill, scrollY: Math.round(scrollY) }; });
  ok(s1.shown && s1.inView && s1.icon === "🛡" && s1.skill === "deflect", "N 手機 SKILL 鈕在畫面內、速攻機=🛡", JSON.stringify(s1));
  await page.click("#skillButton");
  await page.waitForTimeout(150);
  const df = await ev(page, async () => { const p = state.players[0]; const act = p.skillActive; state.enemyBullets.push({ x: p.x, y: p.y - 20, vx: 0, vy: 50, radius: 5, color: "#f00", damage: 1 }); await new Promise((r) => setTimeout(r, 120)); return { act, enemyLeft: state.enemyBullets.length, mine: state.bullets.filter((b) => b.color === "#8cffbf").length, hp: p.hp, maxHp: p.maxHp }; });
  ok(df.act > 2 && df.enemyLeft === 0 && df.mine >= 1 && df.hp === df.maxHp, "N 🛡 護罩把貼身敵彈變成己方子彈、不扣血", JSON.stringify(df));
  await page.screenshot({ path: OUT + "v20-mobile-play.png" });
  await ctx.close();
}

// ───────── 重裝機 charge
{
  const { ctx, page } = await fresh({ width: 1280, height: 800 }, { seen: true, char: "fortress" });
  await startGame(page);
  await page.waitForTimeout(300);
  await page.keyboard.press("c");
  const ch = await ev(page, async () => { const p = state.players[0]; const charging = p.skillCharging; await new Promise((r) => setTimeout(r, 700)); return { charging, cannon: state.beams.filter((b) => b.cannon).length, width: (state.beams.find((b) => b.cannon) || {}).width, cd: p.skillCd }; });
  ok(ch.charging > 0.3 && ch.cannon === 1 && ch.width === 96 && ch.cd > 12, "N 💥 蓄力 0.5s 後大砲光束出現(寬 96)、冷卻 14s", JSON.stringify(ch));
  // 大砲真的打到 Boss
  const dmg = await ev(page, async () => { startBossWarning(null, {}); spawnBoss(null, false); const b = state.boss; b.arrived = true; b.x = state.players[0].x; const hp0 = b.hp; state.players[0].skillCd = 0; state.players[0].skillActive = 0; useSkill(state.players[0]); await new Promise((r) => setTimeout(r, 1300)); return { hp0, hp1: state.boss ? state.boss.hp : 0, dealt: hp0 - (state.boss ? state.boss.hp : 0) }; });
  ok(dmg.dealt > 20, `N 大砲對 Boss 造成 ${dmg.dealt.toFixed(0)} 傷害(血 ${dmg.hp0})`, JSON.stringify(dmg));
  await ctx.close();
}

// ───────── 機體分頁顯示特殊技
{
  const { ctx, page } = await fresh({ width: 1280, height: 800 }, { seen: true });
  await page.click('[data-tab="select"]');
  const lines = await ev(page, () => [...document.querySelectorAll(".card-tile .skill-line")].map((e) => e.textContent.slice(0, 30)));
  ok(lines.length === 5 && lines.every((l) => /✨/.test(l)), "N 機體分頁五張卡都寫了特殊技", lines.join(" | "));
  await ctx.close();
}

// ───────── Q(v21)第三皮膚 deep + 第六 Boss hydra
{
  const { ctx, page } = await fresh({ width: 1280, height: 800 }, { seen: true });
  const sp = await ev(page, () => { const want = ["enemy_basic_deep", "enemy_elite_deep", "enemy_formation_deep"]; BOSS_TYPES.forEach((t) => ["mech", "rock", "deep"].forEach((k) => want.push("boss_" + t.id + "_" + k))); return { opt: !!document.querySelector('#skinSelect option[value="deep"]'), missing: want.filter((k) => !sprites[k]), total: want.length, types: BOSS_TYPES.length, hydra: BOSS_TYPES.some((t) => t.id === "hydra"), patterns: !!BOSS_PATTERNS.hydra && BOSS_PATTERNS.hydra.length === 3, rush: BOSS_RUSH_TYPES.length }; });
  ok(sp.opt && sp.missing.length === 0 && sp.types === 6 && sp.hydra && sp.patterns && sp.rush === 5, `Q 深海選項 + ${sp.total} 張 sprite 全預生成;BOSS_TYPES 6 種、hydra 三 phase、Boss Rush 仍 5 隻`, JSON.stringify(sp));
  await page.selectOption("#skinSelect", "deep");
  const sk = await ev(page, () => ({ skin: getSkin(), ls: localStorage.getItem("tf-skin"), body: document.getElementById("messageBody").textContent }));
  ok(sk.skin === "deep" && sk.ls === "deep" && /深海/.test(sk.body), "Q 選深海皮膚 ⇒ 存起來、選單文案換", JSON.stringify(sk));
  await page.screenshot({ path: OUT + "v21-deep-menu.png" });
  await startGame(page); await page.waitForTimeout(300);
  // v26 改量法:原本是「4.5 秒後畫面上**活著**的敵彈 > 5」的快照 —— 那是跟 v23 的 Boss 節奏綁死的:
  //   v25 起 Boss 出招間隔跟難度 bulletRate 走(普通快 30%),快照那一刻剛好只剩一組扇形彈 4~5 顆 ⇒ 假紅
  //   (線上 v25 第一輪紅過一次、本機 v26 連紅兩次,Boss 本身完全正常)。改成 4.5 秒內**累計**發出的敵彈:每 40ms 掃一次,
  //   沒看過的物件才算,順便記分裂彈/魚雷有沒有出現。改 Boss 節奏時這項若紅,先分清「節奏變了」還是「Boss 壞了」。
  const hy = await ev(page, async () => { state.players[0].grace = 0; state.players[0].invincible = 99; startBossWarning("hydra", {}); spawnBoss("hydra", false); const b = state.boss; b.arrived = true; const seen = new WeakSet(); let total = 0, split = 0, homing = 0; const t0 = performance.now(); while (performance.now() - t0 < 4500) { for (const x of state.enemyBullets) { if (!seen.has(x)) { seen.add(x); total++; if (x.split) split++; if (x.homing) homing++; } } await new Promise((r) => setTimeout(r, 40)); } return { name: b.name, type: b.type, total, split, homing, alive: !!state.boss, sprite: !!sprites["boss_hydra_deep"], enemySprite: (() => { const s = skinSprite("enemy_basic"); return !!s; })() }; });
  ok(hy.type === "hydra" && /九頭海怪/.test(hy.name), "Q 深海皮膚下 hydra 名字「九頭海怪」", JSON.stringify(hy));
  ok(hy.total > 5 && hy.alive && hy.enemySprite, `Q hydra 招式 4.5 秒內累計放出 ${hy.total} 顆彈(其中分裂彈 ${hy.split}、魚雷 ${hy.homing}),沒有例外`, JSON.stringify(hy));
  await page.screenshot({ path: OUT + "v21-deep-hydra.png" });
  const spl = await ev(page, async () => { state.enemyBullets = [{ x: 240, y: 300, vx: 0, vy: 40, radius: 9, color: "#7dffdf", damage: 1, fromBoss: true, split: { t: 0.3, count: 6, speed: 120, color: "#7dffdf" } }]; await new Promise((r) => setTimeout(r, 650)); return { n: state.enemyBullets.filter((b) => !b.split).length }; });
  ok(spl.n >= 6, `Q 分裂彈 0.3s 後變 ${spl.n} 顆小彈`, JSON.stringify(spl));
  const tor = await ev(page, async () => { const p = state.players[0]; p.x = 400; p.y = 700; state.enemyBullets = [{ x: 80, y: 200, vx: 0, vy: 120, radius: 6, color: "#b8fff0", damage: 1, fromBoss: true, homing: true, turn: 2.5, life: 4 }]; await new Promise((r) => setTimeout(r, 800)); const b = state.enemyBullets[0]; return b ? { vx: Math.round(b.vx), vy: Math.round(b.vy), x: Math.round(b.x) } : null; });
  ok(tor && tor.vx > 30, `Q 追蹤魚雷 0.8s 後朝右邊的玩家轉向(vx ${tor && tor.vx})`, JSON.stringify(tor));
  const life = await ev(page, async () => { state.enemyBullets = [{ x: 240, y: 200, vx: 0, vy: 10, radius: 6, color: "#b8fff0", damage: 1, fromBoss: true, homing: true, turn: 2.5, life: 0.3 }]; await new Promise((r) => setTimeout(r, 600)); return state.enemyBullets.length; });
  ok(life === 0, "Q 魚雷壽命到就散掉", String(life));
  const cyc = await ev(page, () => { state.boss = null; state.stage = 5; spawnBoss(null, true); const mid = state.boss.type; const midName = state.boss.name; state.boss = null; state.stage = 6; spawnBoss(null, false); const full = state.boss.type; state.boss = null; state.stage = 1; return { mid, midName, full }; });
  ok(cyc.mid === "hydra" && cyc.full === "hydra" && /中 BOSS/.test(cyc.midName), "Q 第 5 關中 Boss 預告 = hydra、第 6 關 STAGE BOSS = hydra", JSON.stringify(cyc));
  const mech = await ev(page, () => { setSkin("mech"); state.boss = null; spawnBoss("hydra", false); state.boss.arrived = true; return { n: state.boss.name, rockName: (setSkin("rock"), bossNameFor(BOSS_TYPES[5])), back: (setSkin("mech"), getSkin()) }; });
  ok(/九頭蛇艦/.test(mech.n) && /裂變雙子隕/.test(mech.rockName) && mech.back === "mech", "Q 機械皮膚「九頭蛇艦」、隕石皮膚「裂變雙子隕」", JSON.stringify(mech));
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + "v21-mech-hydra.png" });
  await ev(page, () => { setSkin("rock"); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + "v21-rock-hydra.png" });
  await ev(page, () => { setSkin("deep"); state.boss = null; for (let i = 0; i < 3; i++) { spawnEnemy({ x: 120 + i * 120, y: 120, elite: i === 1 }); } spawnFormation(); });
  await page.waitForTimeout(600);
  await page.screenshot({ path: OUT + "v21-deep-enemies.png" });
  await ctx.close();
}

// ───────── J(v22)今日任務三則給金幣
{
  const { ctx, page } = await fresh({ width: 1280, height: 800 }, { seen: true });
  const q0 = await ev(page, () => {
    const rows = [...document.querySelectorAll("#questList .quest-row")];
    const card = document.getElementById("questCard").getBoundingClientRect();
    const start = document.getElementById("startButton").getBoundingClientRect();
    const d1 = "2026-9-15", d2 = "2026-9-16";
    return { rows: rows.length, ids: rows.map((r) => r.dataset.quest), uniq: new Set(quests.ids).size, day: quests.day, today: todayKey(), pool: QUEST_POOL.length,
      belowStart: card.top >= start.bottom - 1, inView: card.bottom <= 800, sub: document.getElementById("questSub").textContent,
      same: JSON.stringify(pickDailyQuests(quests.day)) === JSON.stringify(quests.ids), stable: JSON.stringify(pickDailyQuests(d1)) === JSON.stringify(pickDailyQuests(d1)), differs: JSON.stringify(pickDailyQuests(d1)) !== JSON.stringify(pickDailyQuests(d2)),
      allInPool: quests.ids.every((id) => QUEST_POOL.some((q) => q.id === id)) };
  });
  ok(q0.rows === 3 && q0.uniq === 3 && q0.allInPool && q0.pool === 8 && q0.day === q0.today, `J 選單有今日任務卡三則(${q0.ids.join("/")})、題庫 8 種、日期=今天`, JSON.stringify(q0));
  ok(q0.belowStart && q0.inView, "J 任務卡在「開始戰鬥」底下、桌機第一屏內", JSON.stringify(q0));
  ok(q0.same && q0.stable && q0.differs, "J 同一天挑同三則(日期種子確定)、不同天不同", JSON.stringify(q0));
  ok(/還剩 3 則/.test(q0.sub) && /後換題/.test(q0.sub), "J 副標寫「還剩 3 則」與幾小時後換題", q0.sub);
  const seedChk = await ev(page, () => { setSeed(123); const a = rand(); setSeed(123); pickDailyQuests("2026-9-15"); pickDailyQuests("2026-9-16"); const b = rand(); return a === b; });
  ok(seedChk, "J 挑題不動全域 rand(今日挑戰的種子不漂)");
  await page.screenshot({ path: OUT + "v22-quest-menu.png" });
  // 第一組(固定好驗):擊破 30 / 連擊 50 / 特殊技 5
  await ev(page, () => { quests.ids = ["kill30", "combo50", "skill5"]; quests.progress = {}; quests.done = {}; quests.earned = 0; saveQuests(); renderQuests(); });
  await startGame(page);
  await page.waitForTimeout(300);
  const k = await ev(page, () => {
    const mk = () => ({ x: 100, y: 100, value: 10, elite: false, radius: 16, hp: 0 });
    const c0 = meta.credits;
    for (let i = 0; i < 29; i++) destroyEnemy(mk());
    const ls = JSON.parse(localStorage.getItem("tf-quests-v1"));
    const mid = { p: quests.progress.kill30, done: !!quests.done.kill30, credits: meta.credits - c0, ls: ls.progress.kill30, lsDay: ls.day === todayKey() };
    destroyEnemy(mk());
    const ls2 = JSON.parse(localStorage.getItem("tf-quests-v1"));
    return { mid, p: quests.progress.kill30, done: !!quests.done.kill30, credits: meta.credits - c0, run: state.questsDoneRun.slice(), earned: quests.earned, text: state.texts.some((t) => /任務完成/.test(t.text)), lsDone: !!ls2.done.kill30, metaLs: JSON.parse(localStorage.getItem("tf-meta-v3")).credits, meta: meta.credits, combo: quests.progress.combo50 };
  });
  ok(k.mid.p === 29 && !k.mid.done && k.mid.credits === 0 && k.mid.ls === 29 && k.mid.lsDay, "J 擊破 29 ⇒ 進度 29/30 已存 localStorage、還沒給錢", JSON.stringify(k.mid));
  ok(k.done && k.p === 30 && k.credits === 50 && k.run[0] === "kill30" && k.earned === 50 && k.text && k.lsDone && k.metaLs === k.meta, "J 第 30 擊 ⇒ 完成、+50 金幣當場入帳(meta 也存了)、畫面跳「任務完成」", JSON.stringify(k));
  ok(k.combo === 30, `J 連擊任務同時累到 ${k.combo}/50(max 型)`, JSON.stringify(k));
  const c = await ev(page, () => {
    const c0 = meta.credits;
    for (let i = 0; i < 20; i++) destroyEnemy({ x: 100, y: 100, value: 10, elite: false, radius: 16, hp: 0 });
    return { combo: state.combo.count, p: quests.progress.combo50, done: !!quests.done.combo50, credits: meta.credits - c0, kill: quests.progress.kill30, killDone: !!quests.done.kill30 };
  });
  ok(c.combo === 50 && c.done && c.p === 50 && c.credits === 100, "J 連擊 50 ⇒ 完成 +100", JSON.stringify(c));
  ok(c.kill === 30 && c.killDone, "J 已完成的任務不再累加(擊破停在 30)", JSON.stringify(c));
  const s = await ev(page, () => {
    const p = state.players[0]; const c0 = meta.credits;
    for (let i = 0; i < 5; i++) { p.skillCd = 0; p.skillActive = 0; p.skillCharging = 0; state.timeWarp = null; useSkill(p); }
    return { p: quests.progress.skill5, done: !!quests.done.skill5, credits: meta.credits - c0, all: questsAllDone(), earned: quests.earned, allText: state.texts.some((t) => /全數完成/.test(t.text)) };
  });
  ok(s.p === 5 && s.done && s.credits === 50 && s.all && s.earned === 200 && s.allText, "J 特殊技 5 次 ⇒ 完成 +50、三則全數完成(共 200)、跳「全數完成」", JSON.stringify(s));
  await page.screenshot({ path: OUT + "v22-quest-complete-play.png" });
  // 結算畫面一行 + 回選單卡片全綠
  await ev(page, () => { state.players[0].bombs = 0; state.score = 0; endGame(); });
  await page.waitForTimeout(300);
  const fin = await ev(page, () => ({ scene: state.scene, body: document.getElementById("messageBody").textContent, rowsDone: document.querySelectorAll("#questList .quest-row.is-done").length, sub: document.getElementById("questSub").textContent, cardCls: document.getElementById("questCard").className, hidden: document.getElementById("messageCard").hidden }));
  ok(fin.scene === "menu" && !fin.hidden && /今日任務本場完成 3 則\(\+200 金幣\)・三則全數完成/.test(fin.body), "J 結算畫面:「今日任務本場完成 3 則(+200 金幣)・三則全數完成!」", fin.body.split("\n").pop());
  ok(fin.rowsDone === 3 && /is-all-done/.test(fin.cardCls) && /✅ 今日三則全部完成,共 \+200 金幣/.test(fin.sub), "J 回選單三列全綠、卡片描綠、副標寫共 +200", JSON.stringify({ rowsDone: fin.rowsDone, sub: fin.sub, cls: fin.cardCls }));
  await page.screenshot({ path: OUT + "v22-quest-all-done.png" });
  // 換日 ⇒ 換題、歸零
  const ro = await ev(page, () => { quests.day = "2000-1-1"; saveQuests(); const changed = ensureQuestsFresh(); return { changed, day: quests.day, today: todayKey(), progress: Object.keys(quests.progress).length, done: Object.keys(quests.done).length, earned: quests.earned, rowsDone: document.querySelectorAll("#questList .quest-row.is-done").length, ls: JSON.parse(localStorage.getItem("tf-quests-v1")).day, sub: document.getElementById("questSub").textContent }; });
  ok(ro.changed && ro.day === ro.today && ro.ls === ro.today && ro.progress === 0 && ro.done === 0 && ro.earned === 0 && ro.rowsDone === 0 && /還剩 3 則/.test(ro.sub), "J 換日 ⇒ 換題、進度歸零、卡片重畫", JSON.stringify(ro));
  // 重播不算
  const rp = await ev(page, () => { quests.ids = ["kill30", "loot15", "skill5"]; quests.progress = {}; quests.done = {}; quests.earned = 0; saveQuests(); state.replayPlaying = true; destroyEnemy({ x: 100, y: 100, value: 10, elite: false, radius: 16, hp: 0 }); collectLoot(state.players[0], { kind: "heal", x: 0, y: 0, color: "#fff" }); const r = { kill: quests.progress.kill30 || 0, loot: quests.progress.loot15 || 0 }; state.replayPlaying = false; return r; });
  ok(rp.kill === 0 && rp.loot === 0, "J 重播中不算進度", JSON.stringify(rp));
  // 第二組:撿寶 15 / STAGE BOSS 不用炸彈 / 深海一場
  await ev(page, () => { quests.ids = ["loot15", "bossNoBomb", "deep1"]; quests.progress = {}; quests.done = {}; quests.earned = 0; saveQuests(); renderQuests(); setSkin("deep"); });
  await startGame(page);
  await page.waitForTimeout(300);
  const b = await ev(page, () => {
    const p = state.players[0]; const e0 = quests.earned;
    for (let i = 0; i < 15; i++) collectLoot(p, { kind: "heal", x: 0, y: 0, color: "#fff" });
    const loot = { p: quests.progress.loot15, done: !!quests.done.loot15, earned: quests.earned - e0 };
    state.boss = null; spawnBoss(null, true); state.boss.arrived = true; state.boss.hp = 1; state.bombsThrownThisRun = 0; damageBoss(state.boss, 5, 240, 200);
    const midP = quests.progress.bossNoBomb || 0;
    state.boss = null; spawnBoss(null, false); state.boss.arrived = true; state.boss.hp = 1; state.bombsThrownThisRun = 1; damageBoss(state.boss, 5, 240, 200);
    const bombedP = quests.progress.bossNoBomb || 0;
    const e1 = quests.earned;
    state.boss = null; spawnBoss(null, false); state.boss.arrived = true; state.boss.hp = 1; state.bombsThrownThisRun = 0; damageBoss(state.boss, 5, 240, 200);
    return { loot, midP, bombedP, done: !!quests.done.bossNoBomb, earned: quests.earned - e1 };
  });
  ok(b.loot.p === 15 && b.loot.done && b.loot.earned === 50, "J 撿 15 個寶物 ⇒ 完成 +50", JSON.stringify(b.loot));
  ok(b.midP === 0 && b.bombedP === 0 && b.done && b.earned === 150, "J 中 Boss / 丟過炸彈都不算;沒丟炸彈打倒 STAGE BOSS ⇒ +150", JSON.stringify(b));
  const dp = await ev(page, () => { state.runStartMs = performance.now() - 25000; state.players[0].bombs = 0; state.score = 0; const e0 = quests.earned; endGame(); return { done: !!quests.done.deep1, earned: quests.earned - e0, run: state.questsDoneRun.slice(), body: document.getElementById("messageBody").textContent }; });
  ok(dp.done && dp.earned === 50 && dp.run.includes("deep1") && /今日任務本場完成 3 則\(\+250 金幣\)・三則全數完成/.test(dp.body), "J 深海皮膚玩 20 秒以上結算 ⇒ 完成 +50;結算行寫本場 3 則 +250", JSON.stringify({ done: dp.done, earned: dp.earned, run: dp.run }));
  // 深海玩不到 20 秒不算
  await ev(page, () => { quests.ids = ["deep1", "stage2", "flawless2"]; quests.progress = {}; quests.done = {}; quests.earned = 0; saveQuests(); renderQuests(); });
  await startGame(page); await page.waitForTimeout(300);
  const sh = await ev(page, () => { state.players[0].bombs = 0; state.score = 0; endGame(); return { done: !!quests.done.deep1, p: quests.progress.deep1 || 0, body: document.getElementById("messageBody").textContent }; });
  ok(!sh.done && sh.p === 0 && /今日任務還剩 3 則,再拚一場/.test(sh.body), "J 深海玩不到 20 秒不算;結算行寫「還剩 3 則,再拚一場」", JSON.stringify({ done: sh.done, p: sh.p }));
  await ev(page, () => setSkin("mech"));
  // 第三組:無傷 2 波 / 打到第 2 關(advanceWave)
  await startGame(page); await page.waitForTimeout(300);
  const aw = await ev(page, () => {
    const e0 = quests.earned;
    state.waveHits = 0; advanceWave(); const f1 = quests.progress.flawless2 || 0;
    state.waveHits = 1; advanceWave(); const f1b = quests.progress.flawless2 || 0;
    state.waveHits = 0; advanceWave(); const f2 = { p: quests.progress.flawless2, done: !!quests.done.flawless2 };
    const s1 = quests.progress.stage2 || 0;
    state.wave = 10; state.waveHits = 1; advanceWave();
    return { f1, f1b, f2, s1, stage: state.stage, s2: quests.progress.stage2, sDone: !!quests.done.stage2, earned: quests.earned - e0 };
  });
  ok(aw.f1 === 1 && aw.f1b === 1 && aw.f2.p === 2 && aw.f2.done, "J 無傷波 1 →(被打那波不加)→ 2 ⇒ 完成", JSON.stringify(aw));
  ok(aw.s1 === 1 && aw.stage === 2 && aw.s2 === 2 && aw.sDone && aw.earned === 200, "J 關卡 1/2 → 第 11 波進第 2 關 ⇒ 完成;兩則共 +200", JSON.stringify(aw));
  await ctx.close();
}

// ───────── H(v23)?daily 深連結 + 種子分流
{
  // ① 帶 ?daily 進來 ⇒ 自動勾「每日挑戰」並直接開局(不必自己找那個勾)
  const ctx = await browser.newContext({ viewport: { width: 900, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction(() => typeof state !== "undefined");
  await ev(page, () => localStorage.setItem("tf-tutorial-seen", "1"));
  await page.goto(URL + "?daily", { waitUntil: "load" });
  await page.waitForFunction(() => typeof state !== "undefined");
  const dl = await ev(page, () => ({
    scene: state.scene, daily: state.daily, rush: state.bossRush,
    toggle: document.getElementById("dailyToggle").checked,
    rushToggle: document.getElementById("bossRushToggle")?.checked ?? false,
    seed: state.rngSeed, want: dateSeed(),
  }));
  ok(dl.scene === "play" && dl.daily === true && dl.toggle === true, "H ?daily 直接開局且「每日挑戰」已勾起", JSON.stringify(dl));
  ok(dl.seed === dl.want, "H ?daily 用的是今天的日期種子(不是隨機種子)", JSON.stringify({ seed: dl.seed, want: dl.want }));
  ok(dl.rush === false && dl.rushToggle === false, "H ?daily 一律關掉 Boss Rush(兩套排行不可混)", JSON.stringify(dl));

  // ② ?mode=daily 同義
  await page.goto(URL + "?mode=daily", { waitUntil: "load" });
  await page.waitForFunction(() => typeof state !== "undefined");
  const dl2 = await ev(page, () => ({ scene: state.scene, daily: state.daily }));
  ok(dl2.scene === "play" && dl2.daily === true, "H ?mode=daily 同義", JSON.stringify(dl2));

  // ③ 沒帶參數 ⇒ 維持停在選單(不可以自己開打)
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction(() => typeof state !== "undefined");
  const plain = await ev(page, () => ({ scene: state.scene, daily: state.daily }));
  ok(plain.scene === "menu" && plain.daily === false, "H 沒帶參數就停在選單、不代開局", JSON.stringify(plain));

  // ④ 三條流分家:視覺流抽幾次都不可以動到世界流
  const streams = await ev(page, () => {
    startNewGame(4242);
    const a = [rand(), rand(), rand()];
    startNewGame(4242);
    for (let i = 0; i < 5000; i++) vrand();        // 視覺流狂抽
    for (let i = 0; i < 500; i++) crand();          // 戰鬥流也狂抽
    const b = [rand(), rand(), rand()];
    startNewGame(4242);
    const c0 = [crand(), crand()];
    startNewGame(4242);
    for (let i = 0; i < 300; i++) rand();           // 世界流狂抽
    const c1 = [crand(), crand()];
    return { same: JSON.stringify(a) === JSON.stringify(b), combatSame: JSON.stringify(c0) === JSON.stringify(c1), a, b };
  });
  ok(streams.same, "H 視覺流/戰鬥流抽 5500 次,世界流一個數都沒被推走", JSON.stringify(streams.a) + " vs " + JSON.stringify(streams.b));
  ok(streams.combatSame, "H 世界流抽 300 次,戰鬥流也不受影響(兩邊互不推擠)", JSON.stringify(streams));

  // ⑤ 粒子不可以再吃種子流(這是舊版 daily 漂掉的主因)
  const vis = await ev(page, () => {
    startNewGame(777);
    const before = [rand(), rand()];
    startNewGame(777);
    for (let i = 0; i < 40; i++) spawnParticle(100, 100, "#fff");
    shake(9, 0.4);
    spawnFloatingText(10, 10, "x", "#fff", 12);
    const after = [rand(), rand()];
    return { ok: JSON.stringify(before) === JSON.stringify(after), before, after };
  });
  ok(vis.ok, "H 灑 40 顆粒子 + 震動 + 浮字後,世界流仍在原位", JSON.stringify(vis));
  await ctx.close();
}

// ───────── I(v23)手機橫向版面
for (const vp of [{ width: 844, height: 390 }, { width: 740, height: 360 }]) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction(() => typeof state !== "undefined" && document.body.dataset.scene === "menu");
  await ev(page, () => localStorage.setItem("tf-tutorial-seen", "1"));
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => typeof state !== "undefined" && document.body.dataset.scene === "menu");
  await ev(page, () => startNewGame());
  await page.waitForTimeout(350);
  const L = await ev(page, () => {
    const cv = document.getElementById("gameCanvas");
    const r = cv.getBoundingClientRect();
    const visW = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
    const visH = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
    let total = 0, stolen = 0;
    for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) {
      const x = r.left + (r.width * (i + 0.5)) / 12, y = r.top + (r.height * (j + 0.5)) / 12;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
      total++;
      const el = document.elementFromPoint(x, y);
      if (el && el !== cv) stolen++;
    }
    const reach = ["pauseButton", "mfsFull", "bombButton", "focusButton", "skillButton"].map((id) => {
      const e = document.getElementById(id);
      if (!e) return { id, ok: false, why: "不存在" };
      const b = e.getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return { id, ok: (e === hit || e.contains(hit)) && b.width >= 44 && b.height >= 44, w: Math.round(b.width), h: Math.round(b.height) };
    });
    return {
      cut: +((1 - (visW * visH) / (r.width * r.height)) * 100).toFixed(1),
      scroll: Math.round(document.documentElement.scrollHeight - innerHeight),
      stolen, total, reach, cols: getComputedStyle(document.querySelector(".app-shell")).gridTemplateColumns.split(" ").length,
      h: Math.round(r.height), vh: innerHeight,
    };
  });
  const tag = `I ${vp.width}×${vp.height}`;
  ok(L.cut === 0, `${tag} 畫布 0% 被切在視窗外(改版前 58.3%)`, JSON.stringify({ cut: L.cut }));
  ok(L.h >= L.vh - 2, `${tag} 畫布吃滿視窗高(高決定寬)`, JSON.stringify({ h: L.h, vh: L.vh }));
  ok(L.scroll <= 0, `${tag} 頁面不再捲動(改版前 1209px)`, JSON.stringify({ scroll: L.scroll }));
  ok(L.cols === 2, `${tag} 回到兩欄(HUD 左、畫布右)`, JSON.stringify({ cols: L.cols }));
  ok(L.stolen === 0, `${tag} 畫布零觸控被鈕/小籤接走(改版前 31/144)`, JSON.stringify({ stolen: L.stolen, total: L.total }));
  ok(L.reach.every((r) => r.ok), `${tag} 五顆鈕都點得到且 ≥44px(含「出口」暫停鈕)`, JSON.stringify(L.reach.filter((r) => !r.ok)));
  await ctx.close();
}

// I 直向不可以被橫向那組規則波及(dragtetris 0916:沒分方向 ⇒ 橫向規則把直向壓成 3%)
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction(() => typeof state !== "undefined" && document.body.dataset.scene === "menu");
  await ev(page, () => localStorage.setItem("tf-tutorial-seen", "1"));
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => typeof state !== "undefined" && document.body.dataset.scene === "menu");
  await ev(page, () => startNewGame());
  await page.waitForTimeout(350);
  const P = await ev(page, () => {
    const r = document.getElementById("gameCanvas").getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), cols: getComputedStyle(document.querySelector(".app-shell")).gridTemplateColumns.split(" ").length };
  });
  ok(P.w >= 340 && P.cols === 1, "I 直向零迴歸:仍是單欄、畫布仍吃滿寬(362×603)", JSON.stringify(P));
  await ctx.close();
}

ok(errors.length === 0, "零 pageerror / console error", errors.slice(0, 3).join(" || "));
console.log(`${fail ? "🔴" : "🟢"} ${pass} 過 / ${fail} 失敗`);
await browser.close();
process.exit(fail ? 1 : 0);
