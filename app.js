// =====================================================================
//  雷電．蒼穹突擊  —  full feature build
//  Boss + multi-phase patterns, weapons (basic / spread / laser / homing),
//  wingmen, formations, parallax stages, combo, focus, hitstop+shake,
//  damage popups, pause, adaptive DPR, gamepad, local 2P co-op,
//  achievements, shop, characters, daily seed, replay, name entry.
// =====================================================================

const $ = (id) => document.getElementById(id);
const canvas = $("gameCanvas");
const ctx = canvas.getContext("2d");

const els = {
  score: $("scoreValue"), lives: $("livesValue"), bombs: $("bombValue"),
  health: $("healthValue"), healthBar: $("healthBar"), power: $("powerValue"),
  combo: $("comboValue"), stage: $("stageValue"), weapon: $("weaponValue"),
  credits: $("creditsValue"),
  overlayLives: $("overlayLives"), overlayBombs: $("overlayBombs"),
  comboChip: $("comboChip"), comboMult: $("comboMult"), comboCount: $("comboCount"),
  weaponChip: $("weaponChip"), weaponSlots: $("weaponSlots"),
  bossStat: $("bossStat"), bossBar: $("bossBar"), bossValue: $("bossValue"), bossName: $("bossName"),
  message: $("messageCard"), messageTag: $("messageTag"), messageTitle: $("messageTitle"), messageBody: $("messageBody"),
  startBtn: $("startButton"),
  bombBtn: $("bombButton"), focusBtn: $("focusButton"), pauseBtn: $("pauseButton"),
  installBtn: $("installButton"),
  pauseOverlay: $("pauseOverlay"), resumeBtn: $("resumeButton"), quitBtn: $("quitButton"),
  nameEntry: $("nameEntry"), nameInput: $("nameInput"), nameSubmit: $("nameSubmit"),
  continueOverlay: $("continueOverlay"), continueMsg: $("continueMsg"),
  continueTimer: $("continueTimer"), continueAcceptBtn: $("continueAcceptBtn"),
  continueDeclineBtn: $("continueDeclineBtn"),
  stageClearOverlay: $("stageClearOverlay"), stageClearTitle: $("stageClearTitle"), stageClearBody: $("stageClearBody"),
  leaderboard: $("leaderboardList"), lbTabs: $("leaderboardTabs"), soundBtn: $("soundButton"),
  coopToggle: $("coopToggle"), dailyToggle: $("dailyToggle"),
  bossRushToggle: $("bossRushToggle"), recordToggle: $("recordToggle"),
  difficultySelect: $("difficultySelect"),
  characterGrid: $("characterGrid"), shopGrid: $("shopGrid"), shopCredits: $("shopCredits"),
  achList: $("achList"),
  replayBtn: $("replayButton"), exportReplayBtn: $("exportReplayButton"),
  importReplayBtn: $("importReplayButton"), replayImport: $("replayImport"),
  replaySlots: $("replaySlots"),
  tabs: $("menuTabs"),
};

// =====================================================================
//  Constants
// =====================================================================

const WORLD = { width: 480, height: 800 };
const FOCUS_FACTOR = 0.45;
const COMBO_TIMEOUT = 2.6;
const BOSS_WAVE_INTERVAL = 5;
const STAGE_WAVES = 10;
const MAX_REPLAY_FRAMES = 60 * 60 * 6;
const ENEMY_COUNT_BOOST = 1.728;
const BULLET_COUNT_BOOST = 1.728;
const LOOT_MAGNET_RADIUS = 118;
const LOOT_FOCUS_MAGNET_RADIUS = 178;
const LOOT_MAGNET_SPEED = 330;
// Enemy bullet density throttle. Higher = fewer bullets.
// Multiplies enemy fire cooldowns and boss pattern timers.
const ENEMY_FIRE_MUL = 5;
const POWER_CAP = 20;
const LOW_HP_RATIO = 0.2;
const LOW_HP_TIME_SCALE = 0.65;
const BOSS_TELEGRAPH_TIME = 0.4;
const BOSS_TELEGRAPH_FAST = 0.22;
const STAGE_CLEAR_DURATION = 2.6;
const CONTINUE_TIME_LIMIT = 15;
const CONTINUE_COSTS = [100, 250];
const MAX_CONTINUES = 2;

const DIFFICULTIES = {
  easy: {
    label: "簡單",
    enemyRate: 0.82,
    enemyHp: 0.78,
    bulletRate: 0.75,
    bulletSpeed: 0.88,
    bossHp: 0.8,
    loot: 1.22,
  },
  normal: {
    label: "普通",
    enemyRate: 1,
    enemyHp: 1,
    bulletRate: 1,
    bulletSpeed: 1,
    bossHp: 1,
    loot: 1,
  },
  hard: {
    label: "硬派",
    enemyRate: 1.18,
    enemyHp: 1.18,
    bulletRate: 1.14,
    bulletSpeed: 1.08,
    bossHp: 1.18,
    loot: 0.92,
  },
  storm: {
    label: "彈幕",
    enemyRate: 1.42,
    enemyHp: 1.35,
    bulletRate: 1.34,
    bulletSpeed: 1.15,
    bossHp: 1.38,
    loot: 0.84,
  },
};

const STORAGE = {
  leaderboard: "tf-leaderboard-v3",
  dailyLeaderboard: "tf-daily-leaderboard-v1",
  bossRushLeaderboard: "tf-bossrush-leaderboard-v1",
  muted: "tf-muted",
  meta: "tf-meta-v3",
  replay: "tf-replay-v1",       // legacy single-slot
  replays: "tf-replays-v1",     // new ring-buffer of up to 5 entries
};
const MAX_REPLAY_SLOTS = 5;
const BOSS_RUSH_TYPES = ["vanguard", "harrier", "leviathan", "wyrm", "phoenix"];

function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

// =====================================================================
//  Math / Seedable RNG
// =====================================================================

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a, b, t) => a + (b - a) * t;

let rngState = 0xa1b2c3 >>> 0;
function setSeed(seed) {
  rngState = ((seed | 0) >>> 0) || 0xdeadbeef;
}
function rand() {
  rngState = (rngState + 0x6d2b79f5) >>> 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const random = (lo, hi) => lo + rand() * (hi - lo);
const randInt = (lo, hi) => Math.floor(random(lo, hi + 1));

function dateSeed(date = new Date()) {
  const k = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  let h = 5381;
  for (let i = 0; i < k.length; i++) h = ((h << 5) + h + k.charCodeAt(i)) | 0;
  return h >>> 0;
}

// =====================================================================
//  Storage helpers
// =====================================================================

const safeGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const loadJSON = (k, fallback) => {
  try { const v = safeGet(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};
const saveJSON = (k, v) => safeSet(k, JSON.stringify(v));

// =====================================================================
//  Meta progression
// =====================================================================

const CHARACTERS = [
  { id: "alpha",    name: "Alpha 標準",   desc: "平衡型，火力均衡。",
    hp: 10, lives: 10, bombs: 10, fireRate: 0.22, speed: 280, dmg: 1, color: "#66e4ff", startShield: 0 },
  { id: "blade",    name: "Blade 速攻",   desc: "速度與射速優異，但 HP 低。",
    hp: 7,  lives: 10, bombs: 8,  fireRate: 0.16, speed: 360, dmg: 1, color: "#ff9a62", startShield: 0 },
  { id: "fortress", name: "Fortress 重裝", desc: "高 HP、雙倍傷害、自帶護盾，但較慢。",
    hp: 16, lives: 10, bombs: 12, fireRate: 0.28, speed: 220, dmg: 2, color: "#8cffbf", startShield: 6 },
  { id: "phantom",  name: "Phantom 幻影", desc: "聚焦再 -25% 速度，僚機 +1。需擊破 5 隻 Boss 解鎖。",
    hp: 9,  lives: 10, bombs: 10, fireRate: 0.20, speed: 300, dmg: 1, color: "#d7a6ff", startShield: 2,
    perk: "phantom", lockedBy: "boss-5" },
  { id: "tempest",  name: "Tempest 風暴", desc: "射速 ×1.4、HP 低。需 100 連擊解鎖。",
    hp: 6,  lives: 10, bombs: 8,  fireRate: 0.13, speed: 340, dmg: 1, color: "#ff5d8f", startShield: 0,
    perk: "tempest", lockedBy: "combo-100" },
];

function isCharacterUnlocked(c) {
  if (!c.lockedBy) return true;
  return !!meta.achievements[c.lockedBy];
}

const SHOP = [
  { id: "hp",      name: "強化裝甲", desc: "起始 HP +2",      max: 6, cost: (lv) => 80 * (lv + 1) },
  { id: "fire",    name: "射速強化", desc: "射擊冷卻 -8%",    max: 5, cost: (lv) => 100 * (lv + 1) },
  { id: "bomb",    name: "炸彈倉",   desc: "起始炸彈 +2",     max: 4, cost: (lv) => 90 * (lv + 1) },
  { id: "power",   name: "預設火力", desc: "起始火力等級 +1", max: 3, cost: (lv) => 150 * (lv + 1) },
  { id: "wingman", name: "預載僚機", desc: "出生帶 1 隻僚機", max: 2, cost: (lv) => 220 * (lv + 1) },
  { id: "shield",  name: "起始護盾", desc: "出生帶護盾 +3",   max: 4, cost: (lv) => 120 * (lv + 1) },
  { id: "credit",  name: "金幣加成", desc: "得幣 +15%",       max: 4, cost: (lv) => 130 * (lv + 1) },
  { id: "freeze",  name: "冰凍砲",   desc: "命中機率冰凍敵人 1.5s", max: 3, cost: (lv) => 180 * (lv + 1) },
  { id: "burn",    name: "燃燒砲",   desc: "命中機率持續灼傷 3s",   max: 3, cost: (lv) => 180 * (lv + 1) },
  { id: "shock",   name: "感電砲",   desc: "命中機率對附近敵人連鎖", max: 3, cost: (lv) => 200 * (lv + 1) },
];

// Per-shop-level proc chance for status effects.
const STATUS_CHANCE = [0, 0.18, 0.32, 0.48];

const ACHIEVEMENTS = [
  { id: "first-blood", name: "初擊",          desc: "擊落第一架敵機" },
  { id: "wave-10",     name: "前進到 10 波",   desc: "達成 wave 10" },
  { id: "wave-25",     name: "守望者",         desc: "達成 wave 25" },
  { id: "boss-1",      name: "首殺 Boss",      desc: "擊破第一隻 Boss" },
  { id: "boss-5",      name: "Boss 殺手",      desc: "累計擊破 5 隻 Boss" },
  { id: "no-bomb-10",  name: "純技巧",         desc: "整場不放炸彈通過 wave 10" },
  { id: "no-hit-boss", name: "完美防禦",       desc: "擊破 Boss 全程未受傷" },
  { id: "combo-50",    name: "連擊大師",       desc: "達成 50 連擊" },
  { id: "combo-100",   name: "彈幕舞者",       desc: "達成 100 連擊" },
  { id: "max-power",   name: "滿火力",         desc: "把火力等級堆到 7" },
  { id: "all-weapons", name: "武器全收集",     desc: "在同一場使用過所有武器" },
  { id: "co-op",       name: "戰友",           desc: "完成一場雙人協力" },
  { id: "daily",       name: "今日勇者",       desc: "完成今日挑戰" },
  { id: "score-50k",   name: "5 萬俱樂部",     desc: "單場分數 ≥ 50000" },
];

const defaultMeta = () => ({
  selectedCharacter: "alpha",
  credits: 0,
  shop: { hp: 0, fire: 0, bomb: 0, power: 0, wingman: 0, shield: 0, credit: 0, freeze: 0, burn: 0, shock: 0 },
  achievements: {},
  bossKills: 0,
});
const meta = Object.assign(defaultMeta(), loadJSON(STORAGE.meta, {}));
meta.shop = Object.assign(defaultMeta().shop, meta.shop || {});
meta.achievements = meta.achievements || {};
function saveMeta() { saveJSON(STORAGE.meta, meta); }

function getCharacter() {
  const sel = CHARACTERS.find((c) => c.id === meta.selectedCharacter);
  if (sel && isCharacterUnlocked(sel)) return sel;
  return CHARACTERS[0];
}

function unlockAch(id) {
  if (meta.achievements[id]) return;
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  meta.achievements[id] = Date.now();
  saveMeta();
  spawnFloatingText(WORLD.width / 2, 130, `成就：${a ? a.name : id}`, "#ffd86c", 22);
  audio.victory();
}

// =====================================================================
//  Audio (SFX + lightweight BGM)
// =====================================================================

const audio = createAudio();

function createAudio() {
  let context = null, master = null, bgmGain = null;
  let muted = safeGet(STORAGE.muted) === "1";
  let lastShot = 0;
  let bgmTimer = null;

  function ensure() {
    if (context) {
      if (context.state === "suspended") context.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    context = new AC();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.18;
    master.connect(context.destination);
    bgmGain = context.createGain();
    bgmGain.gain.value = 0.5;
    bgmGain.connect(master);
  }

  function tone(freq, dur, type = "square", gain = 0.35, slide = 1) {
    ensure();
    if (!context || muted) return;
    const now = context.currentTime;
    const o = context.createOscillator();
    const g = context.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, now);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), now + dur);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g); g.connect(master);
    o.start(now); o.stop(now + dur + 0.02);
  }

  function noise(dur, gain = 0.28) {
    ensure();
    if (!context || muted) return;
    const n = Math.floor(context.sampleRate * dur);
    const buf = context.createBuffer(1, n, context.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = context.createBufferSource();
    const f = context.createBiquadFilter();
    const g = context.createGain();
    src.buffer = buf;
    f.type = "lowpass"; f.frequency.value = 1200;
    g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  }

  // Chiptune-style sequencer. Per-stage key + 2 alternating 16-step patterns.
  // Channels: lead (square), bass (triangle), kick (sine sweep), hat (noise).
  const STAGE_BGM = [
    // stage 1 — A minor pentatonic
    { root: 110, scale: [0, 3, 5, 7, 10, 12, 15], stepMs: 135 },
    // stage 2 — D phrygian (darker)
    { root: 98,  scale: [0, 1, 3, 5, 7, 8, 10],   stepMs: 130 },
    // stage 3 — E dorian (mysterious)
    { root: 82,  scale: [0, 2, 3, 5, 7, 9, 10],   stepMs: 125 },
    // stage 4 — G minor (heavier)
    { root: 98,  scale: [0, 2, 3, 5, 7, 8, 10],   stepMs: 120 },
    // stage 5 — A harmonic minor (epic)
    { root: 110, scale: [0, 2, 3, 5, 7, 8, 11],   stepMs: 118 },
  ];
  // 16-step patterns. null = rest. Numbers index into the scale (negative = down octave, +7 up octave).
  const LEAD_A = [0, null, 4, null, 7, null, 4, null,  2, null, 5, null, 9, 7, 4, 2];
  const LEAD_B = [7, 4, 0, 4, 7, null, 9, 7,           5, 2, null, 2, 5, 7, 5, 2];
  const BASS_A = [0, null, null, null, 0, null, null, null,  4, null, null, null, 4, null, null, null];
  const BASS_B = [0, null, 0, null, 5, null, null, null,     4, null, 4, null, 7, null, null, null];
  const KICK   = [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
  const HAT    = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0];

  let bgmStage = 1;
  function setBgmStage(stage) { bgmStage = stage; }

  function noteHz(cfg, scaleIdx) {
    if (scaleIdx == null) return null;
    const oct = Math.floor(scaleIdx / cfg.scale.length);
    const i = ((scaleIdx % cfg.scale.length) + cfg.scale.length) % cfg.scale.length;
    const semitones = cfg.scale[i] + oct * 12;
    return cfg.root * Math.pow(2, semitones / 12);
  }
  function playBgmTone(t0, freq, dur, type, gain) {
    if (!context || !freq) return;
    const o = context.createOscillator();
    const g = context.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(bgmGain);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function playBgmKick(t0) {
    if (!context) return;
    const o = context.createOscillator();
    const g = context.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(120, t0);
    o.frequency.exponentialRampToValueAtTime(40, t0 + 0.12);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    o.connect(g); g.connect(bgmGain);
    o.start(t0); o.stop(t0 + 0.18);
  }
  function playBgmHat(t0) {
    if (!context) return;
    const n = Math.floor(context.sampleRate * 0.04);
    const buf = context.createBuffer(1, n, context.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = context.createBufferSource();
    src.buffer = buf;
    const f = context.createBiquadFilter();
    f.type = "highpass"; f.frequency.value = 5000;
    const g = context.createGain();
    g.gain.value = 0.06;
    src.connect(f); f.connect(g); g.connect(bgmGain);
    src.start(t0); src.stop(t0 + 0.05);
  }

  let bgmStep = 0;
  let bgmBar = 0;
  let currentStepMs = 0;

  function bgmTick() {
    if (!context) return;
    const cfg = STAGE_BGM[(bgmStage - 1) % STAGE_BGM.length];
    const usingB = (bgmBar % 4) >= 2;
    const leadPat = usingB ? LEAD_B : LEAD_A;
    const bassPat = usingB ? BASS_B : BASS_A;
    const i = bgmStep % 16;
    const t0 = context.currentTime;
    if (!muted) {
      const leadIdx = leadPat[i];
      if (leadIdx != null) playBgmTone(t0, noteHz(cfg, leadIdx + 7), 0.18, "square", 0.05);
      const bassIdx = bassPat[i];
      if (bassIdx != null) playBgmTone(t0, noteHz(cfg, bassIdx - 7), 0.32, "triangle", 0.075);
      if (KICK[i]) playBgmKick(t0);
      if (HAT[i]) playBgmHat(t0);
    }
    bgmStep++;
    if (bgmStep % 16 === 0) bgmBar++;
    // Re-tune interval if stage changed
    if (cfg.stepMs !== currentStepMs && bgmTimer) {
      clearInterval(bgmTimer);
      currentStepMs = cfg.stepMs;
      bgmTimer = setInterval(bgmTick, currentStepMs);
    }
  }

  function startBgm() {
    ensure();
    if (!context || bgmTimer) return;
    bgmStep = 0;
    bgmBar = 0;
    const cfg = STAGE_BGM[(bgmStage - 1) % STAGE_BGM.length];
    currentStepMs = cfg.stepMs;
    bgmTick();
    bgmTimer = setInterval(bgmTick, currentStepMs);
  }

  function stopBgm() {
    if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
  }

  return {
    ensure,
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      safeSet(STORAGE.muted, muted ? "1" : "0");
      if (master) master.gain.value = muted ? 0 : 0.18;
      if (!muted) tone(520, 0.08, "sine", 0.22, 1.4);
    },
    startBgm, stopBgm, setBgmStage,
    shoot() {
      const now = performance.now();
      if (now - lastShot < 90) return;
      lastShot = now; tone(720, 0.05, "square", 0.12, 1.8);
    },
    laser()    { tone(1300, 0.04, "sawtooth", 0.05, 0.9); },
    homing()   { tone(880, 0.06, "triangle", 0.1, 1.4); },
    explosion(){ noise(0.16, 0.25); tone(170, 0.12, "sawtooth", 0.16, 0.55); },
    bossBoom() { noise(0.6, 0.55); tone(70, 0.5, "sawtooth", 0.4, 0.3); },
    bomb()     { noise(0.36, 0.46); tone(120, 0.32, "sawtooth", 0.28, 0.35); },
    hit()      { tone(150, 0.1, "triangle", 0.2, 0.7); },
    loot()     { tone(660, 0.07, "sine", 0.22, 1.5); setTimeout(() => tone(990, 0.08, "sine", 0.18, 1.25), 70); },
    bossArrive(){ tone(90, 0.28, "sawtooth", 0.24, 1.8); setTimeout(() => tone(180, 0.2, "sawtooth", 0.18, 1.2), 160); },
    victory()  { tone(520, 0.1, "sine", 0.25, 1.3); setTimeout(() => tone(780, 0.12, "sine", 0.22, 1.3), 100); setTimeout(() => tone(1040, 0.16, "sine", 0.2, 1.1), 220); },
    combo(level){ tone(520 + level * 22, 0.05, "square", 0.08, 1.4); },
  };
}

// =====================================================================
//  Weapons
// =====================================================================

const WEAPONS = {
  default: { name: "基本砲",   color: "#9afcff", chip: "武器：基本" },
  spread:  { name: "散彈砲",   color: "#ff9a62", chip: "武器：散彈" },
  laser:   { name: "雷射砲",   color: "#fff39a", chip: "武器：雷射" },
  homing:  { name: "追蹤雷射", color: "#d7a6ff", chip: "武器：追蹤" },
};

// =====================================================================
//  Procedural sprite cache (drawn once at init, reused via drawImage)
// =====================================================================

const sprites = {};

function makeSprite(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = Math.round(w * 2);
  c.height = Math.round(h * 2);
  const cx = c.getContext("2d");
  cx.scale(2, 2);
  cx.translate(w / 2, h / 2);
  draw(cx);
  return { canvas: c, w, h };
}

function drawShip(cx, primary, accent, style) {
  cx.shadowColor = primary;
  cx.shadowBlur = 12;
  cx.fillStyle = "#162236";
  cx.beginPath();
  if (style === "blade") {
    cx.moveTo(0, -28); cx.lineTo(8, -16); cx.lineTo(20, 18); cx.lineTo(8, 14);
    cx.lineTo(0, 16); cx.lineTo(-8, 14); cx.lineTo(-20, 18); cx.lineTo(-8, -16);
  } else if (style === "fortress") {
    cx.moveTo(0, -28); cx.lineTo(14, -20); cx.lineTo(26, -8); cx.lineTo(26, 14);
    cx.lineTo(10, 20); cx.lineTo(0, 14); cx.lineTo(-10, 20); cx.lineTo(-26, 14);
    cx.lineTo(-26, -8); cx.lineTo(-14, -20);
  } else if (style === "phantom") {
    cx.moveTo(0, -22); cx.lineTo(22, 4); cx.lineTo(16, 16); cx.lineTo(0, 12);
    cx.lineTo(-16, 16); cx.lineTo(-22, 4);
  } else if (style === "tempest") {
    cx.moveTo(0, -26); cx.lineTo(8, -8); cx.lineTo(22, 4); cx.lineTo(12, 18);
    cx.lineTo(0, 10); cx.lineTo(-12, 18); cx.lineTo(-22, 4); cx.lineTo(-8, -8);
  } else {
    cx.moveTo(0, -24); cx.lineTo(18, 16); cx.lineTo(0, 10); cx.lineTo(-18, 16);
  }
  cx.closePath();
  cx.fill();
  cx.shadowBlur = 0;

  // Color highlight
  cx.fillStyle = primary;
  cx.beginPath();
  cx.moveTo(0, -16); cx.lineTo(9, 8); cx.lineTo(0, 4); cx.lineTo(-9, 8);
  cx.closePath();
  cx.fill();

  // Cockpit
  cx.fillStyle = accent;
  cx.beginPath();
  cx.ellipse(0, -8, 4, 6, 0, 0, Math.PI * 2);
  cx.fill();

  // Tiny side wing lights
  cx.fillStyle = "#fff";
  cx.fillRect(-1.5, -2, 3, 3);
}

function drawEnemyArt(cx, type, color, r) {
  cx.shadowColor = color;
  cx.shadowBlur = 8;
  cx.fillStyle = type === "elite" ? "#3a2705" : (type === "formation" ? "#0e1a36" : "#3a0a0a");
  cx.beginPath();
  if (type === "formation") {
    cx.moveTo(0, r * 0.9);
    cx.lineTo(r, -r * 0.3); cx.lineTo(r * 0.6, -r * 0.7); cx.lineTo(0, -r * 0.4);
    cx.lineTo(-r * 0.6, -r * 0.7); cx.lineTo(-r, -r * 0.3);
  } else if (type === "elite") {
    cx.moveTo(0, r);
    cx.lineTo(r * 0.7, r * 0.4); cx.lineTo(r, -r * 0.5); cx.lineTo(r * 0.4, -r * 0.7);
    cx.lineTo(0, -r * 0.5); cx.lineTo(-r * 0.4, -r * 0.7); cx.lineTo(-r, -r * 0.5);
    cx.lineTo(-r * 0.7, r * 0.4);
  } else {
    cx.moveTo(0, r);
    cx.lineTo(r, -r); cx.lineTo(0, -r * 0.3); cx.lineTo(-r, -r);
  }
  cx.closePath();
  cx.fill();
  cx.shadowBlur = 0;

  cx.fillStyle = color;
  cx.beginPath();
  cx.moveTo(0, r * 0.55);
  cx.lineTo(r * 0.6, -r * 0.45);
  cx.lineTo(0, -r * 0.05);
  cx.lineTo(-r * 0.6, -r * 0.45);
  cx.closePath();
  cx.fill();

  cx.fillStyle = "#0a1320";
  cx.fillRect(-r * 0.28, -r * 0.65, r * 0.56, r * 0.4);
  cx.fillStyle = type === "elite" ? "#fff39a" : "#9afcff";
  cx.fillRect(-r * 0.18, -r * 0.55, r * 0.36, r * 0.1);

  if (type === "elite") {
    cx.fillStyle = "#ffd86c";
    cx.fillRect(-r * 0.9, -r * 0.55, r * 0.18, r * 0.16);
    cx.fillRect(r * 0.72, -r * 0.55, r * 0.18, r * 0.16);
  }
}

function drawBossArt(cx, type) {
  const r = 70;
  cx.shadowBlur = 22;
  if (type === "vanguard") {
    cx.shadowColor = "#ff8866";
    cx.fillStyle = "#3a1410";
    cx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + Math.PI / 2;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) cx.moveTo(x, y); else cx.lineTo(x, y);
    }
    cx.closePath(); cx.fill();
    cx.shadowBlur = 0;
    cx.fillStyle = "#ff8866";
    cx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + Math.PI / 2;
      const x = Math.cos(a) * r * 0.72, y = Math.sin(a) * r * 0.72;
      if (i === 0) cx.moveTo(x, y); else cx.lineTo(x, y);
    }
    cx.closePath(); cx.fill();
    cx.fillStyle = "#1a0808";
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + Math.PI / 2;
      const x = Math.cos(a) * r * 0.85, y = Math.sin(a) * r * 0.85;
      cx.beginPath(); cx.arc(x, y, 6, 0, Math.PI * 2); cx.fill();
    }
    cx.fillStyle = "#0c1322";
    cx.beginPath(); cx.arc(0, 0, r * 0.42, 0, Math.PI * 2); cx.fill();
  } else if (type === "harrier") {
    cx.shadowColor = "#ffb84d";
    cx.fillStyle = "#3a2410";
    cx.beginPath();
    cx.moveTo(0, -r); cx.lineTo(r * 0.5, -r * 0.4); cx.lineTo(r, r * 0.3);
    cx.lineTo(r * 0.6, r * 0.4); cx.lineTo(r * 0.3, r * 0.2); cx.lineTo(0, r * 0.7);
    cx.lineTo(-r * 0.3, r * 0.2); cx.lineTo(-r * 0.6, r * 0.4); cx.lineTo(-r, r * 0.3);
    cx.lineTo(-r * 0.5, -r * 0.4);
    cx.closePath(); cx.fill();
    cx.shadowBlur = 0;
    cx.fillStyle = "#ffb84d";
    cx.beginPath();
    cx.moveTo(0, -r * 0.7); cx.lineTo(r * 0.3, -r * 0.2); cx.lineTo(r * 0.4, r * 0.1);
    cx.lineTo(0, r * 0.4); cx.lineTo(-r * 0.4, r * 0.1); cx.lineTo(-r * 0.3, -r * 0.2);
    cx.closePath(); cx.fill();
    cx.fillStyle = "#0c1322";
    cx.fillRect(-r * 0.18, -r * 0.45, r * 0.36, r * 0.4);
    cx.fillStyle = "#ffd866";
    cx.fillRect(-r * 0.13, -r * 0.4, r * 0.26, r * 0.1);
  } else if (type === "leviathan") {
    cx.shadowColor = "#a266ff";
    cx.fillStyle = "#1d0e3a";
    cx.beginPath();
    cx.ellipse(0, 0, r, r * 0.85, 0, 0, Math.PI * 2);
    cx.fill();
    cx.shadowBlur = 0;
    cx.strokeStyle = "#a266ff";
    cx.lineWidth = 5;
    cx.beginPath(); cx.arc(0, 0, r * 0.7, 0, Math.PI * 2); cx.stroke();
    cx.fillStyle = "#a266ff";
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const x = Math.cos(a) * r * 0.85, y = Math.sin(a) * r * 0.7;
      cx.beginPath(); cx.arc(x, y, 5, 0, Math.PI * 2); cx.fill();
    }
    cx.fillStyle = "#0c1322";
    cx.beginPath(); cx.arc(0, 0, r * 0.4, 0, Math.PI * 2); cx.fill();
  } else if (type === "wyrm") {
    cx.shadowColor = "#66ff9f";
    cx.fillStyle = "#0a3a25";
    cx.beginPath();
    cx.moveTo(0, -r); cx.lineTo(r * 0.55, -r * 0.5); cx.lineTo(r * 0.85, 0);
    cx.lineTo(r * 0.5, r * 0.5); cx.lineTo(r * 0.2, r); cx.lineTo(-r * 0.2, r);
    cx.lineTo(-r * 0.5, r * 0.5); cx.lineTo(-r * 0.85, 0); cx.lineTo(-r * 0.55, -r * 0.5);
    cx.closePath(); cx.fill();
    cx.shadowBlur = 0;
    cx.fillStyle = "#66ff9f";
    for (let row = -1; row <= 2; row++) {
      const dx = row % 2 ? 9 : 0;
      for (let col = -2; col <= 2; col++) {
        cx.beginPath();
        cx.ellipse(col * 18 + dx, row * 16, 6, 5, 0, 0, Math.PI * 2);
        cx.fill();
      }
    }
    cx.fillStyle = "#0c1322";
    cx.beginPath();
    cx.arc(-r * 0.3, -r * 0.25, 9, 0, Math.PI * 2);
    cx.arc(r * 0.3, -r * 0.25, 9, 0, Math.PI * 2);
    cx.fill();
    cx.fillStyle = "#ffd866";
    cx.beginPath();
    cx.arc(-r * 0.3, -r * 0.25, 4, 0, Math.PI * 2);
    cx.arc(r * 0.3, -r * 0.25, 4, 0, Math.PI * 2);
    cx.fill();
  } else if (type === "phoenix") {
    cx.shadowColor = "#ff5d5d";
    cx.fillStyle = "#3a0a0a";
    cx.beginPath();
    cx.moveTo(0, -r); cx.lineTo(r * 0.4, -r * 0.6); cx.lineTo(r, -r * 0.2);
    cx.lineTo(r * 0.9, r * 0.1); cx.lineTo(r * 0.6, r * 0.3); cx.lineTo(r * 0.2, r * 0.5);
    cx.lineTo(0, r * 0.85); cx.lineTo(-r * 0.2, r * 0.5); cx.lineTo(-r * 0.6, r * 0.3);
    cx.lineTo(-r * 0.9, r * 0.1); cx.lineTo(-r, -r * 0.2); cx.lineTo(-r * 0.4, -r * 0.6);
    cx.closePath(); cx.fill();
    cx.shadowBlur = 0;
    cx.fillStyle = "#ff5d5d";
    cx.beginPath();
    cx.moveTo(0, -r * 0.7); cx.lineTo(r * 0.3, -r * 0.4); cx.lineTo(r * 0.5, 0);
    cx.lineTo(r * 0.3, r * 0.2); cx.lineTo(0, r * 0.5); cx.lineTo(-r * 0.3, r * 0.2);
    cx.lineTo(-r * 0.5, 0); cx.lineTo(-r * 0.3, -r * 0.4);
    cx.closePath(); cx.fill();
    cx.fillStyle = "#ffaa44";
    cx.beginPath();
    cx.moveTo(r * 0.95, -r * 0.15); cx.lineTo(r * 0.62, r * 0.05); cx.lineTo(r * 0.85, 0);
    cx.closePath();
    cx.moveTo(-r * 0.95, -r * 0.15); cx.lineTo(-r * 0.62, r * 0.05); cx.lineTo(-r * 0.85, 0);
    cx.closePath(); cx.fill();
    cx.fillStyle = "#0c1322";
    cx.beginPath(); cx.arc(0, -r * 0.35, 7, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = "#fff";
    cx.beginPath(); cx.arc(0, -r * 0.35, 3, 0, Math.PI * 2); cx.fill();
  }
}

function buildSprites() {
  // Player ships — accent color drives the team color
  sprites.player_alpha    = makeSprite(48, 56, (cx) => drawShip(cx, "#66e4ff", "#cfe9ff", "alpha"));
  sprites.player_blade    = makeSprite(48, 56, (cx) => drawShip(cx, "#ff9a62", "#ffd8b8", "blade"));
  sprites.player_fortress = makeSprite(56, 60, (cx) => drawShip(cx, "#8cffbf", "#d4ffe2", "fortress"));
  sprites.player_phantom  = makeSprite(48, 52, (cx) => drawShip(cx, "#d7a6ff", "#ecd4ff", "phantom"));
  sprites.player_tempest  = makeSprite(48, 56, (cx) => drawShip(cx, "#ff5d8f", "#ffc4d6", "tempest"));

  sprites.wingman = makeSprite(24, 24, (cx) => {
    cx.shadowColor = "#a8ffea"; cx.shadowBlur = 6;
    cx.fillStyle = "#0a3030";
    cx.beginPath(); cx.moveTo(0, -10); cx.lineTo(8, 8); cx.lineTo(-8, 8); cx.closePath(); cx.fill();
    cx.shadowBlur = 0;
    cx.fillStyle = "#a8ffea";
    cx.beginPath(); cx.moveTo(0, -7); cx.lineTo(5, 4); cx.lineTo(-5, 4); cx.closePath(); cx.fill();
    cx.fillStyle = "#fff";
    cx.beginPath(); cx.arc(0, 0, 1.5, 0, Math.PI * 2); cx.fill();
  });

  sprites.enemy_basic     = makeSprite(40, 40, (cx) => drawEnemyArt(cx, "basic",     "#ff6d6d", 18));
  sprites.enemy_elite     = makeSprite(60, 60, (cx) => drawEnemyArt(cx, "elite",     "#ffd86c", 26));
  sprites.enemy_formation = makeSprite(36, 36, (cx) => drawEnemyArt(cx, "formation", "#a8c8ff", 16));

  ["vanguard", "harrier", "leviathan", "wyrm", "phoenix"].forEach((id) => {
    sprites["boss_" + id] = makeSprite(170, 170, (cx) => drawBossArt(cx, id));
  });
}

// =====================================================================
//  Game state
// =====================================================================

const state = {
  scene: "menu",
  running: false,
  gameOver: false,
  score: 0,
  wave: 1,
  stage: 1,
  difficulty: "normal",
  spawnTimer: 0,
  formationTimer: 0,
  difficultyTimer: 0,
  bossPending: false,
  bossWarning: null,
  particles: [],
  bullets: [],
  enemyBullets: [],
  enemies: [],
  loot: [],
  texts: [],
  flashes: [],
  beams: [],
  telegraphs: [],
  deferredActions: [],
  zaps: [],
  starLayers: [],
  boss: null,
  lastBossWave: 0,
  shake: { intensity: 0, time: 0 },
  hitstop: 0,
  combo: { count: 0, timer: 0, multiplier: 1, max: 0 },
  scoreSaved: false,
  players: [],
  coop: false,
  daily: false,
  bossRush: false,
  bossRushIdx: 0,
  bossRushTime: 0,
  bossRushDone: false,
  recording: false,
  weaponsUsed: new Set(),
  bombsThrownThisRun: 0,
  bossDamageTaken: 0,
  bossKillsRun: 0,
  enemyKills: 0,
  lootCollected: 0,
  damageTaken: 0,
  runStartMs: 0,
  lastRunStats: null,
  lastEarnedCredits: 0,
  rngSeed: 0,
  replayFrames: [],
  replayPlaying: false,
  replayInputs: null,
  replayCursor: 0,
  vKeys: null,
  vPointer: null,
  stageClearOverlay: null,
  continueOverlay: null,
  continuesUsed: 0,
  slowMoActive: false,
};

let lastTimestamp = 0;
let leaderboard = loadLeaderboard();
let dailyLeaderboard = loadDailyLeaderboard();
let bossRushLeaderboard = loadBossRushLeaderboard();
let deferredPrompt = null;
let pendingHighScore = null;
let lastReplay = loadJSON(STORAGE.replay, null);
let replays = loadReplays();

function loadReplays() {
  const arr = loadJSON(STORAGE.replays, null);
  if (Array.isArray(arr)) return arr;
  // Migrate legacy single replay if no list yet
  const legacy = loadJSON(STORAGE.replay, null);
  return legacy && legacy.frames ? [legacy] : [];
}

function saveReplays() {
  try { saveJSON(STORAGE.replays, replays.slice(0, MAX_REPLAY_SLOTS)); } catch {}
}

function makeReplayThumbnail() {
  // Snapshot the current canvas at 96x160, downscaled, return data URL.
  try {
    const t = document.createElement("canvas");
    t.width = 96; t.height = 160;
    const tc = t.getContext("2d");
    tc.fillStyle = "#040810";
    tc.fillRect(0, 0, t.width, t.height);
    tc.drawImage(canvas, 0, 0, t.width, t.height);
    return t.toDataURL("image/jpeg", 0.55);
  } catch {
    return null;
  }
}

function difficultyConfig() {
  return DIFFICULTIES[state.difficulty] || DIFFICULTIES.normal;
}

function enemyRate() {
  return ENEMY_COUNT_BOOST * difficultyConfig().enemyRate;
}

function bulletRate() {
  return BULLET_COUNT_BOOST * difficultyConfig().bulletRate;
}

function scaledEnemyHp(value) {
  return Math.max(1, Math.ceil(value * difficultyConfig().enemyHp));
}

function scaledBossHp(value) {
  return Math.max(1, Math.ceil(value * difficultyConfig().bossHp));
}

function scaledBulletSpeed(value) {
  return value * difficultyConfig().bulletSpeed;
}

// =====================================================================
//  Adaptive resolution
// =====================================================================

function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || WORLD.width;
  const cssH = canvas.clientHeight || WORLD.height;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(canvas.width / WORLD.width, 0, 0, canvas.height / WORLD.height, 0, 0);
}

window.addEventListener("resize", fitCanvas);
if (window.ResizeObserver) {
  new ResizeObserver(fitCanvas).observe(canvas);
}

// =====================================================================
//  Player / wingman factories
// =====================================================================

function createPlayer(idx) {
  const c = getCharacter();
  const baseHp = c.hp + meta.shop.hp * 2;
  const baseBombs = c.bombs + meta.shop.bomb * 2;
  const startPower = 1 + meta.shop.power;
  // Phantom perk: +1 wingman at start (cap at 2)
  const baseWingmen = meta.shop.wingman + (c.perk === "phantom" ? 1 : 0);
  const wingmenCount = Math.min(2, baseWingmen);
  const wingmen = [];
  for (let i = 0; i < wingmenCount; i++) wingmen.push(createWingman(i));
  return {
    id: idx,
    char: c.id,
    color: c.color,
    perk: c.perk || null,
    x: idx === 1 ? WORLD.width / 2 + 60 : (state.coop ? WORLD.width / 2 - 60 : WORLD.width / 2),
    y: WORLD.height - 120,
    radius: 18,
    hitRadius: 5,
    speed: c.speed,
    hp: baseHp,
    maxHp: baseHp,
    lives: idx === 0 ? c.lives : 0,
    bombs: idx === 0 ? baseBombs : 0,
    power: startPower,
    weapon: "default",
    weaponSlots: { default: true, spread: false, laser: false, homing: false },
    shield: meta.shop.shield * 3 + (c.startShield || 0),
    invincible: 0,
    fireCooldown: 0,
    fireRate: c.fireRate * (1 - meta.shop.fire * 0.08),
    dmgBonus: c.dmg,
    focused: false,
    wingmen,
  };
}
function createWingman(slot) {
  return { x: 0, y: 0, slot, fireCooldown: 0 };
}

// =====================================================================
//  HUD
// =====================================================================

function loadLeaderboard() {
  const arr = loadJSON(STORAGE.leaderboard, []);
  return Array.isArray(arr)
    ? arr.filter((e) => Number.isFinite(e.score)).sort((a, b) => b.score - a.score).slice(0, 8)
    : [];
}

function loadDailyLeaderboard() {
  const arr = loadJSON(STORAGE.dailyLeaderboard, []);
  return Array.isArray(arr)
    ? arr.filter((e) => Number.isFinite(e.score) && e.dateKey).sort((a, b) => b.score - a.score)
    : [];
}

function loadBossRushLeaderboard() {
  const arr = loadJSON(STORAGE.bossRushLeaderboard, []);
  return Array.isArray(arr)
    ? arr.filter((e) => Number.isFinite(e.time)).sort((a, b) => a.time - b.time).slice(0, 8)
    : [];
}

function saveLeaderboard() {
  saveJSON(STORAGE.leaderboard, leaderboard.slice(0, 8));
}

function saveDailyLeaderboard() {
  // Keep at most 64 entries to limit storage; sort already done.
  saveJSON(STORAGE.dailyLeaderboard, dailyLeaderboard.slice(0, 64));
}

function saveBossRushLeaderboard() {
  saveJSON(STORAGE.bossRushLeaderboard, bossRushLeaderboard.slice(0, 8));
}

let leaderboardTab = "all"; // 'all' | 'today' | 'daily'

function renderLeaderboard() {
  els.leaderboard.replaceChildren();
  let entries;
  let emptyMsg;
  if (leaderboardTab === "today") {
    const tk = todayKey();
    entries = dailyLeaderboard.filter((e) => e.dateKey === tk).slice(0, 8);
    emptyMsg = "今日尚無紀錄（勾選『今日挑戰』再出擊）";
  } else if (leaderboardTab === "daily") {
    entries = dailyLeaderboard.slice(0, 8);
    emptyMsg = "尚無每日挑戰紀錄";
  } else if (leaderboardTab === "rush") {
    entries = bossRushLeaderboard.slice(0, 8);
    emptyMsg = "尚無 Boss Rush 紀錄";
  } else {
    entries = leaderboard;
    emptyMsg = "尚無紀錄";
  }
  if (entries.length === 0) {
    const li = document.createElement("li");
    li.textContent = emptyMsg;
    els.leaderboard.append(li);
    return;
  }
  entries.forEach((entry) => {
    const li = document.createElement("li");
    const score = document.createElement("strong");
    if (leaderboardTab === "rush") {
      score.textContent = formatDuration(Math.round(entry.time || 0));
      const tag = entry.tag || "";
      li.append(score, `　${tag}　${entry.cleared ? "通關" : "未通關"}　${entry.date || ""}`);
    } else {
      score.textContent = `${entry.score}`;
      const tag = entry.tag || "";
      const tail = leaderboardTab === "daily" && entry.dateKey
        ? `　${tag}　Wave ${entry.wave}　${entry.dateKey}`
        : `　${tag}　Wave ${entry.wave}　${entry.date}`;
      li.append(score, tail);
    }
    els.leaderboard.append(li);
  });
}

function syncHud() {
  const p = state.players[0];
  els.score.textContent = Math.floor(state.score);
  els.combo.textContent = `×${state.combo.multiplier.toFixed(1)}`;
  els.stage.textContent = `${state.stage}-${(state.wave - 1) % STAGE_WAVES + 1}`;
  els.credits.textContent = meta.credits;
  if (p) {
    els.lives.textContent = p.lives;
    els.health.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    els.healthBar.style.width = `${clamp((p.hp / p.maxHp) * 100, 0, 100)}%`;
    els.bombs.textContent = p.bombs;
    els.power.textContent = `${p.power} / ${POWER_CAP}`;
    els.weapon.textContent = WEAPONS[p.weapon].name;
    els.weaponChip.textContent = WEAPONS[p.weapon].chip;
    els.overlayLives.textContent = p.lives;
    els.overlayBombs.textContent = p.bombs;
    syncWeaponSlots(p);
  }
  if (state.combo.count > 0) {
    els.comboChip.hidden = false;
    els.comboMult.textContent = state.combo.multiplier.toFixed(1);
    els.comboCount.textContent = state.combo.count;
  } else {
    els.comboChip.hidden = true;
  }
  if (state.boss) {
    els.bossStat.hidden = false;
    els.bossName.textContent = state.boss.name || "Boss";
    els.bossBar.style.width = `${clamp((state.boss.hp / state.boss.maxHp) * 100, 0, 100)}%`;
    els.bossValue.textContent = `${Math.ceil(state.boss.hp)} / ${state.boss.maxHp}`;
  } else {
    els.bossStat.hidden = true;
  }
}

const WEAPON_ORDER = ["default", "spread", "laser", "homing"];
const WEAPON_SHORT = { default: "基本", spread: "散彈", laser: "雷射", homing: "追蹤" };

function syncWeaponSlots(p) {
  if (!els.weaponSlots) return;
  if (els.weaponSlots.children.length !== WEAPON_ORDER.length) {
    els.weaponSlots.replaceChildren();
    WEAPON_ORDER.forEach((w) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "weapon-slot";
      el.dataset.w = w;
      el.textContent = WEAPON_SHORT[w];
      el.addEventListener("click", () => {
        const me = state.players[0];
        if (!me) return;
        if (w === "default" || me.weaponSlots[w]) {
          me.weapon = w;
          syncHud();
        }
      });
      els.weaponSlots.append(el);
    });
  }
  Array.from(els.weaponSlots.children).forEach((node) => {
    const w = node.dataset.w;
    const unlocked = w === "default" || !!p.weaponSlots[w];
    node.classList.toggle("is-unlocked", unlocked);
    node.classList.toggle("is-active", p.weapon === w);
  });
}

function cycleWeapon(p) {
  if (!p) return;
  const cur = WEAPON_ORDER.indexOf(p.weapon);
  for (let i = 1; i <= WEAPON_ORDER.length; i++) {
    const nxt = WEAPON_ORDER[(cur + i) % WEAPON_ORDER.length];
    if (nxt === "default" || p.weaponSlots[nxt]) {
      p.weapon = nxt;
      audio.loot();
      spawnFloatingText(p.x, p.y - 30, WEAPONS[nxt].name, WEAPONS[nxt].color, 14);
      syncHud();
      return;
    }
  }
}

// =====================================================================
//  Particles / floating text / shake / hitstop
// =====================================================================

function spawnParticle(x, y, color) {
  state.particles.push({
    x, y, vx: random(-180, 180), vy: random(-180, 180),
    size: random(2, 5), ttl: random(0.3, 0.9), color,
  });
}
function spawnExplosion(x, y, color, count) {
  for (let i = 0; i < count; i++) spawnParticle(x, y, color);
}
function spawnFloatingText(x, y, text, color, size) {
  state.texts.push({ x, y, vy: -42, text, color: color || "#ffffff", ttl: 1, size: size || 16, age: 0 });
}
function shake(intensity, duration) {
  state.shake.intensity = Math.max(state.shake.intensity, intensity);
  state.shake.time = Math.max(state.shake.time, duration);
}
function hitstop(duration) {
  state.hitstop = Math.max(state.hitstop, duration);
}

// =====================================================================
//  Spawning
// =====================================================================

function spawnEnemy(opts = {}) {
  const stage = state.stage;
  const eliteChance = Math.min(0.08 + state.wave * 0.012, 0.32);
  const elite = opts.elite ?? Math.random() < eliteChance;
  const zigzag = opts.zigzag ?? Math.random() < 0.34;
  const boost = stage * 0.5;
  state.enemies.push({
    x: opts.x ?? random(40, WORLD.width - 40),
    y: opts.y ?? -40,
    radius: elite ? 24 : 16,
    speed: elite ? random(85, 130) + boost : random(110, 180) + state.wave * 4 + boost,
    hp: scaledEnemyHp(elite ? 8 + state.wave + stage : 2 + Math.floor(state.wave / 2) + Math.floor(stage / 2)),
    maxHp: scaledEnemyHp(elite ? 8 + state.wave + stage : 2 + Math.floor(state.wave / 2) + Math.floor(stage / 2)),
    shootCooldown: ((elite ? random(0.6, 1.4) : random(1.2, 2.2)) * ENEMY_FIRE_MUL) / bulletRate(),
    fireRate: ((elite ? random(0.75, 1.2) : random(1.4, 2.6)) * ENEMY_FIRE_MUL) / bulletRate(),
    zigzag,
    seed: random(0, Math.PI * 2),
    value: elite ? 220 : 80,
    elite,
    formation: opts.formation ?? null,
    pathFn: opts.pathFn ?? null,
    pathTime: 0,
  });
}

function spawnFormation() {
  state.formationTimer = random(14, 24) / enemyRate();
  const id = `f${Date.now()}-${randInt(0, 999)}`;
  const kind = randInt(0, 2);
  const baseCount = kind === 0 ? 6 : kind === 1 ? 5 : 7;
  const count = Math.max(1, Math.round(baseCount * enemyRate()));

  if (kind === 0) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    for (let i = 0; i < count; i++) {
      const startX = dir > 0 ? -40 - i * 36 : WORLD.width + 40 + i * 36;
      const e = makeFormationEnemy(id);
      e.x = startX;
      e.y = 110;
      e.pathFn = ((index) => (en) => {
        en.x += dir * 130 * (1 / 60);
        en.y = 110 + Math.sin((en.x / 60) + index * 0.4) * 70;
      })(i);
      state.enemies.push(e);
    }
  } else if (kind === 1) {
    for (let i = 0; i < count; i++) {
      const e = makeFormationEnemy(id);
      e.x = WORLD.width / 2 + (i - 2) * 36;
      e.y = -40 - Math.abs(i - 2) * 22;
      e.speed = 110 + state.stage * 6;
      state.enemies.push(e);
    }
  } else {
    const baseX = random(80, WORLD.width - 80);
    let spawned = 0;
    for (let r = 0; r < 4 && spawned < count; r++) {
      for (let c = 0; c <= r && spawned < count; c++) {
        const e = makeFormationEnemy(id);
        e.x = baseX + (c - r / 2) * 32;
        e.y = -40 - r * 28;
        e.speed = 95 + state.stage * 5;
        state.enemies.push(e);
        spawned++;
      }
    }
  }
}

function makeFormationEnemy(id) {
  const stage = state.stage;
  const hp = scaledEnemyHp(2 + Math.floor(state.wave / 3) + Math.floor(stage / 2));
  return {
    x: 0, y: -40, radius: 14,
    speed: 130 + stage * 5,
    hp, maxHp: hp,
    shootCooldown: (random(1.2, 2.6) * ENEMY_FIRE_MUL) / bulletRate(),
    fireRate: (random(1.6, 2.8) * ENEMY_FIRE_MUL) / bulletRate(),
    zigzag: false, seed: random(0, Math.PI * 2),
    value: 60, elite: false, formation: id,
    pathFn: null, pathTime: 0,
  };
}

// =====================================================================
//  Boss
// =====================================================================

const BOSS_TYPES = [
  { id: "vanguard",  name: "STAGE BOSS：先鋒護衛",  color: "#ff8866" },
  { id: "harrier",   name: "STAGE BOSS：獵風者",    color: "#ffb84d" },
  { id: "leviathan", name: "STAGE BOSS：雷霆鯨",    color: "#a266ff" },
  { id: "wyrm",      name: "STAGE BOSS：天龍",      color: "#66ff9f" },
  { id: "phoenix",   name: "STAGE BOSS：不死鳥",    color: "#ff5d5d" },
];

function startBossWarning(forcedTypeId) {
  state.bossPending = true;
  state.bossWarning = {
    timer: 2.6,
    total: 2.6,
    wave: state.wave,
    forcedType: forcedTypeId || null,
  };
  audio.bossArrive();
  spawnFloatingText(WORLD.width / 2, 96, "WARNING", "#ff6d6d", 34);
  spawnFloatingText(WORLD.width / 2, 134, "BOSS APPROACHING", "#ffd86c", 18);
  shake(10, 0.5);
}

function spawnBoss(forcedTypeId) {
  let type = BOSS_TYPES[(state.stage - 1) % BOSS_TYPES.length];
  if (forcedTypeId) {
    const found = BOSS_TYPES.find((t) => t.id === forcedTypeId);
    if (found) type = found;
  }
  const tier = Math.floor((state.wave - 1) / BOSS_WAVE_INTERVAL);
  const hpBase = state.bossRush ? 380 + state.bossRushIdx * 80 : 220 + tier * 140 + state.stage * 80;
  const hp = scaledBossHp(hpBase);
  state.boss = {
    type: type.id,
    name: type.name,
    color: type.color,
    x: WORLD.width / 2,
    y: -120,
    targetY: 130,
    radius: 64,
    hp, maxHp: hp,
    phase: 1,
    phaseTime: 0,
    patternTimer: 0.5,
    moveTimer: 0,
    moveDir: 1,
    pattern: 0,
    enraged: false,
    arrived: false,
  };
  state.bossDamageTaken = 0;
  state.bossWarning = null;
  state.bossPending = false;
  shake(8, 0.4);
}

function bossUpdate(b, delta) {
  if (!b.arrived) {
    b.y += (b.targetY - b.y) * Math.min(1, delta * 1.6);
    if (Math.abs(b.y - b.targetY) < 1) b.arrived = true;
    return;
  }

  const ratio = b.hp / b.maxHp;
  const phase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
  if (phase !== b.phase) {
    b.phase = phase;
    b.patternTimer = 0;
    spawnFloatingText(b.x, b.y - 80, `PHASE ${phase}`, "#ffd86c", 22);
    shake(6, 0.3);
  }
  if (phase >= 3 && !b.enraged) {
    b.enraged = true;
    spawnFloatingText(b.x, b.y - 80, "ENRAGED", "#ff6d6d", 26);
  }

  b.moveTimer -= delta;
  if (b.moveTimer <= 0) {
    b.moveDir = -b.moveDir;
    b.moveTimer = random(1.2, 2.2);
  }
  const moveSpeed = 50 + phase * 30 + state.stage * 6;
  b.x += b.moveDir * moveSpeed * delta;
  b.x = clamp(b.x, 90, WORLD.width - 90);
  b.y = b.targetY + Math.sin(performance.now() / 600) * 6;

  b.patternTimer -= delta;
  if (b.patternTimer <= 0) runBossPattern(b);
}

function pushTelegraph(t) {
  state.telegraphs.push(Object.assign({ age: 0 }, t));
}
function pushDeferred(delay, fn) {
  state.deferredActions.push({ delay, fn });
}
function pushZap(x1, y1, x2, y2, color) {
  state.zaps.push({ x1, y1, x2, y2, color: color || "#9adfff", ttl: 0.22, age: 0 });
}

function maybeApplyStatus(enemy) {
  if (!enemy || enemy.hp <= 0) return;
  const now = performance.now();
  const fL = meta.shop.freeze | 0;
  if (fL > 0 && Math.random() < STATUS_CHANCE[fL]) {
    enemy.frozenUntil = Math.max(enemy.frozenUntil || 0, now + 1500);
  }
  const bL = meta.shop.burn | 0;
  if (bL > 0 && Math.random() < STATUS_CHANCE[bL]) {
    enemy.burnUntil = Math.max(enemy.burnUntil || 0, now + 3000);
    enemy.burnDps = 1 + bL;
  }
  const sL = meta.shop.shock | 0;
  if (sL > 0 && Math.random() < STATUS_CHANCE[sL]) {
    chainShock(enemy, sL);
  }
}

function chainShock(source, lv) {
  const range = 80 + lv * 30;
  const dmg = 1 + lv;
  const targets = state.enemies
    .filter((e) => e !== source && e.hp > 0 && distance(e, source) < range)
    .sort((a, b) => distance(a, source) - distance(b, source))
    .slice(0, lv + 1);
  targets.forEach((t) => {
    t.hp -= dmg;
    pushZap(source.x, source.y, t.x, t.y);
    spawnFloatingText(t.x, t.y - 10, `${dmg}`, "#9adfff", 11);
  });
  audio.laser();
}

// Pattern helpers — return { telegraph: fn, fire: fn, cooldown }
function pAimedFan(color, count, spread, speed, telegraphTime = BOSS_TELEGRAPH_TIME) {
  return (b) => {
    const t = nearestPlayer(b);
    const ang = Math.atan2(t.y - b.y, t.x - b.x);
    pushTelegraph({ kind: "fan", x: b.x, y: b.y + 20, angle: ang, spread: spread * (count - 1), color, ttl: telegraphTime });
    pushDeferred(telegraphTime, () => {
      const half = (count - 1) / 2;
      for (let i = -half; i <= half; i++) bossBullet(b, ang + i * spread, speed, color, 1, 5);
    });
  };
}
function pRing(color, count, speed, telegraphTime = BOSS_TELEGRAPH_TIME, baseAngFn = null) {
  return (b) => {
    pushTelegraph({ kind: "ring", x: b.x, y: b.y + 20, color, ttl: telegraphTime });
    pushDeferred(telegraphTime, () => {
      const baseAng = baseAngFn ? baseAngFn(b) : 0;
      for (let i = 0; i < count; i++) bossBullet(b, baseAng + (i / count) * Math.PI * 2, speed, color, 1, 5);
    });
  };
}
function pSpiral(color, count, speed, telegraphTime = BOSS_TELEGRAPH_FAST) {
  return (b) => {
    const baseAng = (b.pattern * 0.6) % (Math.PI * 2);
    if (telegraphTime > 0) pushTelegraph({ kind: "spark", x: b.x, y: b.y + 20, color, ttl: telegraphTime });
    pushDeferred(telegraphTime, () => {
      for (let i = 0; i < count; i++) bossBullet(b, baseAng + (i / count) * Math.PI * 2, speed, color, 1, 5);
    });
  };
}
function pSinChain(color, count, speed, telegraphTime = BOSS_TELEGRAPH_TIME) {
  return (b) => {
    const t = nearestPlayer(b);
    const ang = Math.atan2(t.y - b.y, t.x - b.x);
    pushTelegraph({ kind: "fan", x: b.x, y: b.y + 20, angle: ang, spread: 0.6, color, ttl: telegraphTime });
    pushDeferred(telegraphTime, () => {
      for (let i = 0; i < count; i++) {
        const wob = Math.sin(i * 0.55) * 0.28;
        bossBullet(b, ang + wob, speed + i * 8, color, 1, 5);
      }
    });
  };
}
function pLaserSweep(color = "#ff5dff") {
  return (b) => {
    pushTelegraph({ kind: "line", x: b.x, y: b.y + 30, angle: Math.PI / 2 - 0.4, color, ttl: BOSS_TELEGRAPH_TIME });
    pushDeferred(BOSS_TELEGRAPH_TIME, () => fireBossLaser(b));
  };
}
function pSpawnAdds(count) {
  return (b) => {
    pushTelegraph({ kind: "ring", x: b.x, y: b.y + 30, color: "#a8c8ff", ttl: 0.3 });
    pushDeferred(0.3, () => {
      for (let i = 0; i < count; i++) {
        const off = (i - (count - 1) / 2) * 50;
        spawnEnemy({ x: b.x + off, y: b.y + 40, elite: false });
      }
    });
  };
}
function pCrossLasers() {
  return (b) => {
    pushTelegraph({ kind: "line", x: b.x, y: b.y + 30, angle: Math.PI / 2 - 0.55, color: "#ffaa55", ttl: BOSS_TELEGRAPH_TIME });
    pushTelegraph({ kind: "line", x: b.x, y: b.y + 30, angle: Math.PI / 2 + 0.55, color: "#ffaa55", ttl: BOSS_TELEGRAPH_TIME });
    pushDeferred(BOSS_TELEGRAPH_TIME, () => {
      state.beams.push({ x: b.x, y: b.y + 30, angle: Math.PI / 2 - 0.55, sweep: 0, duration: 0.9, age: 0, width: 14, color: "#ffaa55", damage: 1 });
      state.beams.push({ x: b.x, y: b.y + 30, angle: Math.PI / 2 + 0.55, sweep: 0, duration: 0.9, age: 0, width: 14, color: "#ffaa55", damage: 1 });
      audio.laser();
    });
  };
}

// Each boss type: 3 phases, each with pattern array of { fire, cooldown }
const BOSS_PATTERNS = {
  // 先鋒護衛 — 直瞄 + 散射，傳統壓制
  vanguard: [
    [
      { fire: pAimedFan("#ff8866", 5, 0.12, 220), cooldown: 0.7 },
      { fire: pRing("#ff9966", 12, 160), cooldown: 1.5 },
    ],
    [
      { fire: pAimedFan("#ffaaaa", 7, 0.08, 240), cooldown: 0.8 },
      { fire: pSpiral("#ff77aa", 6, 180), cooldown: 0.32 },
      { fire: pSpawnAdds(2), cooldown: 2.4 },
    ],
    [
      { fire: pRing("#ff5d5d", 18, 200), cooldown: 1.1 },
      { fire: pLaserSweep("#ff5dff"), cooldown: 1.7 },
      { fire: pAimedFan("#ff5d5d", 9, 0.06, 260), cooldown: 1.0 },
    ],
  ],
  // 獵風者 — 高速橫掃 + 對角雷射
  harrier: [
    [
      { fire: pAimedFan("#ffb84d", 3, 0.18, 260), cooldown: 0.55 },
      { fire: pAimedFan("#ffd866", 5, 0.1, 290), cooldown: 0.85 },
    ],
    [
      { fire: pCrossLasers(), cooldown: 1.4 },
      { fire: pAimedFan("#ffb84d", 7, 0.09, 280), cooldown: 0.7 },
      { fire: pSpiral("#ffd866", 4, 220), cooldown: 0.28 },
    ],
    [
      { fire: pCrossLasers(), cooldown: 1.2 },
      { fire: pAimedFan("#ff9d2f", 9, 0.07, 300), cooldown: 0.75 },
      { fire: pRing("#ffd866", 14, 220), cooldown: 1.0 },
    ],
  ],
  // 雷霆鯨 — 廣域螺旋彈幕
  leviathan: [
    [
      { fire: pSpiral("#a266ff", 8, 170), cooldown: 0.36 },
      { fire: pRing("#c499ff", 14, 180), cooldown: 1.4 },
    ],
    [
      { fire: pSpiral("#a266ff", 8, 180), cooldown: 0.28 },
      { fire: pSpiral("#ff77ff", 6, 160, 0), cooldown: 0.28 },
      { fire: pAimedFan("#c499ff", 5, 0.1, 240), cooldown: 0.85 },
    ],
    [
      { fire: pSpiral("#a266ff", 10, 190), cooldown: 0.22 },
      { fire: pSpiral("#ff77ff", 8, 170, 0), cooldown: 0.22 },
      { fire: pLaserSweep("#a266ff"), cooldown: 1.6 },
    ],
  ],
  // 天龍 — 跟隨正弦波的鏈式彈幕
  wyrm: [
    [
      { fire: pSinChain("#66ff9f", 6, 200), cooldown: 0.9 },
      { fire: pAimedFan("#66ffcc", 4, 0.14, 220), cooldown: 0.7 },
    ],
    [
      { fire: pSinChain("#66ff9f", 8, 210), cooldown: 0.8 },
      { fire: pSinChain("#a8ffcc", 6, 180, 0.3), cooldown: 0.8 },
      { fire: pRing("#66ffcc", 10, 170), cooldown: 1.2 },
    ],
    [
      { fire: pSinChain("#66ff9f", 10, 220), cooldown: 0.7 },
      { fire: pSinChain("#ffd866", 8, 200, 0.3), cooldown: 0.7 },
      { fire: pRing("#66ffcc", 16, 200), cooldown: 1.0 },
      { fire: pSpawnAdds(3), cooldown: 2.2 },
    ],
  ],
  // 不死鳥 — 密集環形 + 階段三全螢幕灼燒
  phoenix: [
    [
      { fire: pRing("#ff5d5d", 18, 170), cooldown: 1.4 },
      { fire: pAimedFan("#ff7777", 5, 0.1, 230), cooldown: 0.7 },
    ],
    [
      { fire: pRing("#ff5d5d", 20, 180, BOSS_TELEGRAPH_TIME, () => Math.random() * Math.PI), cooldown: 1.2 },
      { fire: pAimedFan("#ff9d9d", 7, 0.08, 250), cooldown: 0.7 },
      { fire: pSpiral("#ffaa66", 6, 170), cooldown: 0.3 },
    ],
    [
      { fire: pRing("#ff5d5d", 24, 200, BOSS_TELEGRAPH_TIME, () => Math.random() * Math.PI), cooldown: 0.9 },
      { fire: pCrossLasers(), cooldown: 1.4 },
      { fire: pSpiral("#ffaa66", 8, 200), cooldown: 0.22 },
      { fire: pAimedFan("#ff5d5d", 9, 0.06, 270), cooldown: 0.95 },
    ],
  ],
};

function runBossPattern(b) {
  const phaseIdx = clamp(b.phase - 1, 0, 2);
  const phasePool = (BOSS_PATTERNS[b.type] || BOSS_PATTERNS.vanguard)[phaseIdx];
  const pick = (b.pattern++) % phasePool.length;
  const def = phasePool[pick];
  def.fire(b);
  b.patternTimer = def.cooldown * (ENEMY_FIRE_MUL / bulletRate());
}

function bossBullet(b, angle, speed, color, dmg, radius) {
  state.enemyBullets.push({
    x: b.x, y: b.y + 20,
    vx: Math.cos(angle) * scaledBulletSpeed(speed), vy: Math.sin(angle) * scaledBulletSpeed(speed),
    radius, color, damage: dmg, fromBoss: true,
  });
}

function fireBossLaser(b) {
  state.beams.push({
    x: b.x, y: b.y + 30,
    angle: Math.PI / 2 - 0.4,
    sweep: 0.8,
    duration: 1.2,
    age: 0,
    width: 18,
    color: "#ff5dff",
    damage: 1,
  });
  audio.laser();
}

// =====================================================================
//  Player firing
// =====================================================================

function fireWeapon(p) {
  if (p.weapon === "default") fireDefault(p);
  else if (p.weapon === "spread") fireSpread(p);
  else if (p.weapon === "laser") fireLaser(p);
  else if (p.weapon === "homing") fireHoming(p);

  p.wingmen.forEach((w) => {
    if (w.fireCooldown <= 0) {
      const dmg = (1 + Math.floor(p.power / 4)) * p.dmgBonus;
      state.bullets.push({
        x: w.x, y: w.y - 14, radius: 4,
        vx: 0, vy: -480,
        damage: dmg, color: "#9afcff", spread: 0,
        owner: p.id,
      });
      w.fireCooldown = Math.max(0.1, p.fireRate * 1.2);
    }
  });

  audio.shoot();
  state.weaponsUsed.add(p.weapon);
  if (state.weaponsUsed.size >= 4) unlockAch("all-weapons");
}

function findClosestTarget(from) {
  let best = null, bestD = Infinity;
  for (const e of state.enemies) {
    const d = distance(from, e);
    if (d < bestD) { bestD = d; best = e; }
  }
  if (state.boss && state.boss.arrived) {
    const d = distance(from, state.boss);
    if (d < bestD) { bestD = d; best = state.boss; }
  }
  return best;
}

function fireDefault(p) {
  const lanes = Math.min(p.power, 4);
  const offsets = { 1: [0], 2: [-12, 12], 3: [-18, 0, 18], 4: [-24, -8, 8, 24] }[lanes];
  const dmg = (1 + Math.floor(p.power / 2)) * p.dmgBonus;
  offsets.forEach((offset, idx) => {
    state.bullets.push({
      x: p.x + offset, y: p.y - 14, radius: 5,
      vx: 0, vy: -520,
      damage: dmg,
      color: "#9afcff", spread: lanes > 2 ? (idx - (offsets.length - 1) / 2) * 18 : 0,
      owner: p.id,
    });
  });
  // Power 5..10: extra diagonal side bullets
  const sidePairs = Math.max(0, p.power - 4);
  for (let i = 1; i <= sidePairs; i++) {
    const ang = 0.12 + i * 0.05;
    [-1, 1].forEach((dir) => {
      state.bullets.push({
        x: p.x + dir * 12, y: p.y - 8, radius: 4,
        vx: Math.sin(ang) * dir * 480, vy: -Math.cos(ang) * 480,
        damage: dmg, color: "#9afcff", spread: 0, owner: p.id,
      });
    });
  }
}

function fireSpread(p) {
  const cone = Math.min(0.18 + p.power * 0.04, 0.65);
  const count = 3 + p.power; // 4..13
  const dmg = (1 + Math.floor(p.power / 3)) * p.dmgBonus;
  for (let i = 0; i < count; i++) {
    const a = -Math.PI / 2 + (i - (count - 1) / 2) * cone / Math.max(1, (count - 1) / 2);
    state.bullets.push({
      x: p.x, y: p.y - 14, radius: 5,
      vx: Math.cos(a) * 480, vy: Math.sin(a) * 480,
      damage: dmg, color: "#ff9a62", spread: 0, owner: p.id,
    });
  }
}

function fireLaser(p) {
  const angle = -Math.PI / 2;
  const dmg = (1 + Math.floor(p.power * 0.6)) * p.dmgBonus; // 1..13 at power 20
  state.beams.push({
    x: p.x, y: p.y - 18,
    angle,
    sweep: 0,
    duration: 0.18,
    age: 0,
    width: 6 + Math.min(p.power, POWER_CAP) * 1.4, // 7.4 .. 34
    color: "#fff39a",
    damage: dmg * 0.5,
    fromPlayer: true,
    owner: p.id,
  });
  audio.laser();
}

function fireHoming(p) {
  const count = 2 + p.power; // 3..12
  const dmg = (1 + Math.floor(p.power / 3)) * p.dmgBonus;
  for (let i = 0; i < count; i++) {
    const a = -Math.PI / 2 + random(-0.5, 0.5);
    state.bullets.push({
      x: p.x + random(-8, 8), y: p.y - 14, radius: 5,
      vx: Math.cos(a) * 380, vy: Math.sin(a) * 380,
      damage: dmg, color: "#d7a6ff", spread: 0, owner: p.id,
      homing: true, life: 2.4,
    });
  }
  audio.homing();
}

// =====================================================================
//  Loot
// =====================================================================

function spawnLoot(x, y, opts = {}) {
  const pool = [
    { kind: "heal",    weight: 24, color: "#8cffbf" },
    { kind: "power",   weight: 22, color: "#66e4ff" },
    { kind: "bomb",    weight: 14, color: "#ff9a62" },
    { kind: "shield",  weight: 14, color: "#d7a6ff" },
    { kind: "spread",  weight: 9,  color: "#ff7c57" },
    { kind: "laser",   weight: 8,  color: "#fff39a" },
    { kind: "homing",  weight: 7,  color: "#cc66ff" },
    { kind: "wingman", weight: 4,  color: "#a8ffea" },
    { kind: "credit",  weight: 8,  color: "#ffd86c" },
  ];
  const total = pool.reduce((s, x) => s + x.weight, 0);
  let roll = Math.random() * total;
  const picked = pool.find((it) => (roll -= it.weight) <= 0) || pool[0];
  state.loot.push({
    x, y, radius: opts.large ? 12 : 10,
    speed: random(80, 130),
    drift: random(-26, 26),
    kind: picked.kind,
    color: picked.color,
  });
}

function collectLoot(p, item) {
  state.lootCollected += 1;
  const stackPower = () => {
    p.power = clamp(p.power + 1, 1, POWER_CAP);
    if (p.power >= 10) unlockAch("max-power");
  };
  const grantWeapon = (kind) => {
    if (p.weaponSlots[kind]) {
      stackPower();
    } else {
      p.weaponSlots[kind] = true;
    }
    p.weapon = kind;
  };
  switch (item.kind) {
    case "heal":
      p.hp = clamp(p.hp + 3, 0, p.maxHp);
      break;
    case "power":
      stackPower();
      break;
    case "bomb":
      p.bombs += 1;
      break;
    case "shield":
      p.shield = clamp(p.shield + 4, 0, 16);
      break;
    case "spread":
      grantWeapon("spread");
      break;
    case "laser":
      grantWeapon("laser");
      break;
    case "homing":
      grantWeapon("homing");
      break;
    case "wingman":
      if (p.wingmen.length < 2) p.wingmen.push(createWingman(p.wingmen.length));
      else stackPower();
      break;
    case "credit":
      meta.credits += Math.round(50 * (1 + meta.shop.credit * 0.15));
      saveMeta();
      break;
  }
  for (let i = 0; i < 12; i++) spawnParticle(item.x, item.y, item.color);
  spawnFloatingText(item.x, item.y, kindLabel(item.kind), item.color, 14);
  audio.loot();
  syncHud();
}

function kindLabel(k) {
  return ({
    heal: "+HP", power: "POWER", bomb: "+BOMB", shield: "SHIELD",
    spread: "散彈", laser: "雷射", homing: "追蹤雷射", wingman: "+僚機", credit: "+金幣",
  })[k] || k;
}

// =====================================================================
//  Bombs
// =====================================================================

function useBomb() {
  if (!state.running) return;
  const p = state.players[0];
  if (!p || p.bombs <= 0) return;
  p.bombs -= 1;
  state.bombsThrownThisRun += 1;

  const threshold = WORLD.height * 0.32;
  const threatened = state.enemies.filter((e) => e.y > threshold);
  threatened.sort((a, b) => b.y - a.y);
  const targets = threatened.slice(0, Math.ceil(threatened.length * 0.85));
  const set = new Set(targets);
  state.enemies = state.enemies.filter((e) => {
    if (!set.has(e)) return true;
    destroyEnemy(e, true);
    return false;
  });
  if (state.boss && state.boss.arrived) {
    damageBoss(state.boss, 30 + state.stage * 5, p.x, p.y, true);
  }
  state.enemyBullets = [];
  state.telegraphs = [];
  state.deferredActions = [];
  state.flashes.push({ ttl: 0.5, alpha: 0.95 });
  shake(14, 0.5); hitstop(0.05);
  audio.bomb();
  syncHud();
}

// =====================================================================
//  Damage / death
// =====================================================================

function destroyEnemy(enemy, bombed = false) {
  const baseScore = enemy.value;
  const earned = Math.round(baseScore * state.combo.multiplier);
  state.score += earned;
  bumpCombo();
  state.enemyKills += 1;
  if (state.enemyKills === 1) unlockAch("first-blood");

  spawnFloatingText(enemy.x, enemy.y - 12, `+${earned}`,
    state.combo.multiplier >= 2 ? "#ffd86c" : "#ffffff", 14);

  spawnExplosion(enemy.x, enemy.y, enemy.elite ? "#ffd86c" : "#66e4ff", enemy.elite ? 24 : 12);
  shake(enemy.elite ? 4 : 2, 0.12);
  audio.explosion();

  if (enemy.formation) {
    const sib = state.enemies.some((e) => e !== enemy && e.formation === enemy.formation);
    if (!sib) {
      const bonus = 500 + state.stage * 100;
      state.score += Math.round(bonus * state.combo.multiplier);
      spawnFloatingText(enemy.x, enemy.y - 30, `編隊全滅 +${bonus}`, "#ffd86c", 18);
      spawnLoot(enemy.x, enemy.y, { large: true });
    }
  }

  const dropChance = (enemy.elite ? 0.78 : 0.22) * difficultyConfig().loot;
  if (!bombed && Math.random() < dropChance) spawnLoot(enemy.x, enemy.y);
  else if (bombed && Math.random() < 0.05) spawnLoot(enemy.x, enemy.y);
}

function damageBoss(b, dmg, x, y, fromBomb = false) {
  if (!b.arrived) return;
  b.hp -= dmg;
  if (!fromBomb) {
    spawnFloatingText(x, y - 20, `${Math.ceil(dmg)}`,
      state.combo.multiplier >= 2 ? "#ffd86c" : "#ffffff", 12);
  }
  shake(2, 0.06);
  if (b.hp <= 0) bossDefeated(b);
}

function bossDefeated(b) {
  const earn = Math.round((1500 + state.stage * 400) * state.combo.multiplier);
  state.score += earn;
  spawnFloatingText(b.x, b.y, `BOSS +${earn}`, "#ffd86c", 26);
  for (let i = 0; i < 60; i++) spawnParticle(b.x + random(-30, 30), b.y + random(-30, 30), b.color);
  shake(20, 0.7); hitstop(0.18);
  audio.bossBoom();

  for (let i = 0; i < 5; i++) spawnLoot(b.x + random(-30, 30), b.y, { large: true });
  meta.credits += Math.round(200 * (1 + meta.shop.credit * 0.15));
  meta.bossKills += 1;
  state.bossKillsRun += 1;
  saveMeta();

  unlockAch("boss-1");
  if (meta.bossKills >= 5) unlockAch("boss-5");
  if (state.bossDamageTaken === 0) unlockAch("no-hit-boss");

  state.boss = null;
  state.bossPending = false;
  state.bossWarning = null;

  if (state.bossRush && !state.bossRushDone) {
    state.bossRushIdx += 1;
    if (state.bossRushIdx >= BOSS_RUSH_TYPES.length) {
      finishBossRush();
    } else {
      // Brief breather, then warning + next boss
      pushDeferred(1.5, () => {
        const nextType = BOSS_RUSH_TYPES[state.bossRushIdx];
        startBossWarning(nextType);
      });
    }
  }
  syncHud();
}

function finishBossRush() {
  state.bossRushDone = true;
  spawnFloatingText(WORLD.width / 2, WORLD.height / 2, "BOSS RUSH CLEAR", "#66e4ff", 32);
  // Submit time to dedicated leaderboard at endGame
  pushDeferred(2.4, () => endGame());
}

function damagePlayer(p, amount) {
  if (p.invincible > 0 || !state.running) return;
  let pending = amount;
  if (p.shield > 0) {
    const blocked = Math.min(p.shield, pending);
    p.shield -= blocked;
    pending -= blocked;
    spawnFloatingText(p.x, p.y - 10, "BLOCK", "#d7a6ff", 12);
  }
  if (pending > 0) {
    p.hp -= pending;
    state.damageTaken += pending;
    if (state.boss && state.boss.arrived) state.bossDamageTaken += pending;
  }
  p.invincible = 1.2;
  state.flashes.push({ ttl: 0.18, alpha: 0.4, color: "#ff6d6d" });
  shake(10, 0.25); hitstop(0.03);
  audio.hit();
  resetCombo();

  if (p.hp <= 0) {
    if (state.players[0]) state.players[0].lives -= 1;
    if (state.players[0] && state.players[0].lives <= 0) {
      p.hp = 0;
      checkGameEnd();
      return;
    }
    p.hp = p.maxHp;
    p.shield = Math.max(p.shield, 4);
    p.invincible = 2.2;
    p.power = Math.max(1, p.power - 1);
    p.weapon = "default";
    state.flashes.push({ ttl: 0.5, alpha: 0.72, color: "#ffd86c" });
  }
  syncHud();
}

function checkGameEnd() {
  const p1 = state.players[0];
  if (!p1 || p1.lives > 0) return;
  if (canOfferContinue()) {
    offerContinue();
    return;
  }
  endGame();
}

function canOfferContinue() {
  if (state.replayPlaying) return false;
  if (state.continuesUsed >= MAX_CONTINUES) return false;
  return meta.credits >= continueCostNow();
}

function continueCostNow() {
  return CONTINUE_COSTS[Math.min(state.continuesUsed, CONTINUE_COSTS.length - 1)];
}

function offerContinue() {
  const cost = continueCostNow();
  state.continueOverlay = { timer: CONTINUE_TIME_LIMIT, cost };
  state.running = false;
  audio.stopBgm();
  els.continueOverlay.hidden = false;
  els.continueMsg.textContent = `花費 ${cost} 金幣滿血復活（剩餘金幣 ${meta.credits}）`;
  els.continueTimer.textContent = CONTINUE_TIME_LIMIT;
}

function acceptContinue() {
  if (!state.continueOverlay) return;
  const cost = state.continueOverlay.cost;
  if (meta.credits < cost) { declineContinue(); return; }
  meta.credits -= cost;
  saveMeta();
  state.continuesUsed += 1;
  state.continueOverlay = null;
  els.continueOverlay.hidden = true;

  const p = state.players[0];
  if (p) {
    p.lives = Math.max(p.lives, 3);
    p.hp = p.maxHp;
    p.bombs = Math.max(p.bombs, 3);
    p.invincible = 3;
    p.shield = Math.max(p.shield, 6);
  }
  state.enemyBullets = [];
  state.telegraphs = [];
  state.deferredActions = [];
  state.running = true;
  audio.startBgm();
  spawnFloatingText(WORLD.width / 2, WORLD.height / 2 - 60, "REVIVED!", "#ffd86c", 30);
  shake(10, 0.4);
  syncHud();
}

function declineContinue() {
  state.continueOverlay = null;
  els.continueOverlay.hidden = true;
  endGame();
}

// =====================================================================
//  Combo
// =====================================================================

function bumpCombo() {
  state.combo.count += 1;
  state.combo.timer = COMBO_TIMEOUT;
  state.combo.multiplier = clamp(1 + state.combo.count * 0.05, 1, 5);
  if (state.combo.count > state.combo.max) state.combo.max = state.combo.count;
  if (state.combo.count >= 50) unlockAch("combo-50");
  if (state.combo.count >= 100) unlockAch("combo-100");
  if (state.combo.count % 10 === 0) {
    audio.combo(state.combo.count / 10);
    spawnFloatingText(WORLD.width / 2, WORLD.height / 2 - 100,
      `${state.combo.count} COMBO`, "#ffd86c", 18);
  }
}

function resetCombo() {
  if (state.combo.count > 0) {
    state.combo.count = 0;
    state.combo.multiplier = 1;
  }
}

// =====================================================================
//  Input
// =====================================================================

const keys = new Set();
const pointer = { active: false, x: WORLD.width / 2, y: WORLD.height - 120 };

const KEY_MAPS = {
  p1: { left: ["ArrowLeft"], right: ["ArrowRight"], up: ["ArrowUp"], down: ["ArrowDown"], focus: ["ShiftLeft", "ShiftRight"], bomb: ["Space"] },
  p2: { left: ["KeyA"], right: ["KeyD"], up: ["KeyW"], down: ["KeyS"], focus: ["KeyE"], bomb: ["KeyQ"] },
};

function effectiveKeys() {
  return state.replayPlaying && state.vKeys ? state.vKeys : keys;
}
function effectivePointer() {
  return state.replayPlaying && state.vPointer ? state.vPointer : pointer;
}
function isHeld(map, key) {
  const k = effectiveKeys();
  return map[key].some((c) => k.has(c));
}

function pollGamepad() {
  if (!navigator.getGamepads) return;
  const pads = navigator.getGamepads();
  for (const pad of pads) {
    if (!pad) continue;
    const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
    if (ax > 0.2) keys.add("ArrowRight"); else keys.delete("ArrowRight");
    if (ax < -0.2) keys.add("ArrowLeft"); else keys.delete("ArrowLeft");
    if (ay > 0.2) keys.add("ArrowDown"); else keys.delete("ArrowDown");
    if (ay < -0.2) keys.add("ArrowUp"); else keys.delete("ArrowUp");
    if (pad.buttons[1] && pad.buttons[1].pressed) {
      if (!keys.has("__bombHeld")) { keys.add("__bombHeld"); useBomb(); }
    } else { keys.delete("__bombHeld"); }
    if (pad.buttons[2] && pad.buttons[2].pressed) keys.add("ShiftLeft");
    else keys.delete("ShiftLeft");
    if (pad.buttons[9] && pad.buttons[9].pressed) {
      if (!keys.has("__pauseHeld")) { keys.add("__pauseHeld"); togglePause(); }
    } else { keys.delete("__pauseHeld"); }
    break;
  }
}

// =====================================================================
//  Replay
// =====================================================================

function captureFrameInput(delta) {
  state.replayFrames.push({
    dt: Math.round(delta * 1000),
    k: [...keys].filter((c) => !c.startsWith("__")),
    pa: pointer.active ? 1 : 0,
    px: Math.round(pointer.x),
    py: Math.round(pointer.y),
  });
  if (state.replayFrames.length > MAX_REPLAY_FRAMES) {
    state.recording = false;
  }
}

function startReplay(payload) {
  if (!payload || !payload.frames || payload.frames.length === 0) {
    spawnFloatingText(WORLD.width / 2, WORLD.height / 2, "沒有錄影資料", "#ff6d6d", 22);
    return;
  }
  meta.selectedCharacter = payload.char || meta.selectedCharacter;
  state.coop = !!payload.coop;
  state.daily = !!payload.daily;
  state.difficulty = payload.difficulty || "normal";
  if (els.difficultySelect) els.difficultySelect.value = state.difficulty;
  state.replayPlaying = true;
  state.replayInputs = payload;
  state.replayCursor = 0;
  state.recording = false;
  startNewGame(payload.seed >>> 0);
  els.message.hidden = true;
  spawnFloatingText(WORLD.width / 2, 100, "REPLAY", "#66e4ff", 24);
}

function applyReplayFrame() {
  if (!state.replayPlaying || !state.replayInputs) return null;
  const frame = state.replayInputs.frames[state.replayCursor++];
  if (!frame) {
    state.replayPlaying = false;
    state.vKeys = null; state.vPointer = null;
    return null;
  }
  state.vKeys = new Set(frame.k);
  state.vPointer = { active: !!frame.pa, x: frame.px, y: frame.py };
  return frame.dt / 1000;
}

function saveLastReplay() {
  if (state.replayFrames.length === 0) return;
  const entry = {
    seed: state.rngSeed,
    char: meta.selectedCharacter,
    coop: state.coop,
    daily: state.daily,
    difficulty: state.difficulty,
    frames: state.replayFrames.slice(-MAX_REPLAY_FRAMES),
    score: Math.floor(state.score),
    wave: state.wave,
    date: Date.now(),
    thumb: makeReplayThumbnail(),
  };
  lastReplay = entry;
  try { saveJSON(STORAGE.replay, entry); } catch {}

  // Prepend to replay list (most recent first), evict oldest beyond cap.
  // Quota fallback: keep stripping the oldest until save succeeds.
  replays = [entry, ...replays].slice(0, MAX_REPLAY_SLOTS);
  let attempts = MAX_REPLAY_SLOTS;
  while (attempts-- > 0) {
    try { saveJSON(STORAGE.replays, replays); break; }
    catch {
      if (replays.length <= 1) { try { saveJSON(STORAGE.replays, []); } catch {} break; }
      replays = replays.slice(0, replays.length - 1);
    }
  }
}

// =====================================================================
//  Update — main pipelines
// =====================================================================

function updateTelegraphs(delta) {
  state.telegraphs = state.telegraphs.filter((t) => {
    t.age += delta;
    return t.age < t.ttl;
  });
}

function updateZaps(delta) {
  state.zaps = state.zaps.filter((z) => {
    z.age += delta;
    return z.age < z.ttl;
  });
}

function updateDeferred(delta) {
  if (!state.deferredActions.length) return;
  const remaining = [];
  for (const d of state.deferredActions) {
    d.delay -= delta;
    if (d.delay <= 0) {
      try { d.fn(); } catch (e) { /* swallow */ }
    } else {
      remaining.push(d);
    }
  }
  state.deferredActions = remaining;
}

function updateStageClear(delta) {
  const o = state.stageClearOverlay;
  if (!o) return;
  o.timer -= delta;
  if (o.timer <= 0) {
    state.stageClearOverlay = null;
    els.stageClearOverlay.hidden = true;
    state.running = true;
    audio.startBgm();
  }
}

function updateContinueOverlay(delta) {
  const o = state.continueOverlay;
  if (!o) return;
  o.timer -= delta;
  els.continueTimer.textContent = Math.max(0, Math.ceil(o.timer));
  if (o.timer <= 0) declineContinue();
}

function update(delta) {
  if (state.scene !== "play") {
    updateStarsParallax(delta);
    updateParticles(delta);
    updateFloatingText(delta);
    updateShake(delta);
    return;
  }

  // Continue overlay blocks all gameplay updates
  if (state.continueOverlay) {
    updateStarsParallax(delta);
    updateParticles(delta);
    updateFloatingText(delta);
    updateShake(delta);
    updateContinueOverlay(delta);
    return;
  }

  if (state.hitstop > 0) {
    state.hitstop -= delta;
    updateParticles(delta);
    updateFloatingText(delta);
    updateShake(delta);
    return;
  }

  // Stage Clear pause — only animate ambient
  if (state.stageClearOverlay) {
    updateStarsParallax(delta);
    updateParticles(delta);
    updateFloatingText(delta);
    updateShake(delta);
    updateStageClear(delta);
    return;
  }

  // Low HP slow-mo (only when player alive and below threshold)
  const p1 = state.players[0];
  state.slowMoActive = !!(p1 && p1.hp > 0 && p1.hp / p1.maxHp < LOW_HP_RATIO);
  const gameDelta = state.slowMoActive ? delta * LOW_HP_TIME_SCALE : delta;

  pollGamepad();
  updateStarsParallax(delta); // ambient at real time
  updatePlayers(gameDelta);
  updateBullets(gameDelta);
  updateBeams(gameDelta);
  updateEnemies(gameDelta);
  updateBoss(gameDelta);
  updateLoot(gameDelta);
  updateTelegraphs(gameDelta);
  updateDeferred(gameDelta);
  updateZaps(gameDelta);
  updateParticles(gameDelta);
  updateFloatingText(gameDelta);
  updateShake(delta);
  updateCombo(gameDelta);
  handleCollisions();
}

function updateCombo(delta) {
  if (state.combo.count > 0) {
    state.combo.timer -= delta;
    if (state.combo.timer <= 0) resetCombo();
  }
}

function updateShake(delta) {
  if (state.shake.time > 0) {
    state.shake.time -= delta;
    state.shake.intensity *= 0.9;
    if (state.shake.time <= 0) state.shake.intensity = 0;
  }
}

function updateStarsParallax(delta) {
  state.starLayers.forEach((layer) => {
    layer.stars.forEach((star) => {
      star.y += layer.speed * delta;
      if (star.y > WORLD.height) {
        star.y = -5;
        star.x = random(0, WORLD.width);
      }
    });
  });
}

function updatePlayers(delta) {
  state.players.forEach((p, idx) => {
    const map = idx === 0 ? KEY_MAPS.p1 : KEY_MAPS.p2;
    let dx = 0, dy = 0;
    if (isHeld(map, "left")) dx -= 1;
    if (isHeld(map, "right")) dx += 1;
    if (isHeld(map, "up")) dy -= 1;
    if (isHeld(map, "down")) dy += 1;
    p.focused = isHeld(map, "focus");

    if (idx === 0) {
      const pt = effectivePointer();
      if (pt.active) {
        const mx = pt.x - p.x;
        const my = pt.y - p.y;
        const d = Math.hypot(mx, my);
        if (d > 5) { dx = mx / d; dy = my / d; }
      }
    }

    const mag = Math.hypot(dx, dy) || 1;
    const focusMul = p.perk === "phantom" ? FOCUS_FACTOR * 0.75 : FOCUS_FACTOR;
    const speed = p.speed * (p.focused ? focusMul : 1);
    p.x += (dx / mag) * speed * delta;
    p.y += (dy / mag) * speed * delta;
    p.x = clamp(p.x, 28, WORLD.width - 28);
    p.y = clamp(p.y, 48, WORLD.height - 34);

    p.fireCooldown -= delta;
    p.invincible -= delta;
    p.wingmen.forEach((w) => { w.fireCooldown -= delta; });
    if (p.fireCooldown <= 0) {
      fireWeapon(p);
      const fr = p.fireRate * (p.focused ? 0.6 : 1) * Math.max(0.4, 1 - p.power * 0.04);
      p.fireCooldown = fr;
    }

    p.wingmen.forEach((w, i) => {
      const sign = i === 0 ? -1 : 1;
      const tx = p.x + sign * 28;
      const ty = p.y + 12;
      w.x = lerp(w.x || tx, tx, Math.min(1, delta * 8));
      w.y = lerp(w.y || ty, ty, Math.min(1, delta * 8));
    });
  });
}

function updateBullets(delta) {
  state.bullets = state.bullets.filter((b) => {
    if (b.homing && b.life > 0) {
      b.life -= delta;
      let nearest = null, bestDist = Infinity;
      for (const e of state.enemies) {
        const d = distance(b, e);
        if (d < bestDist) { bestDist = d; nearest = e; }
      }
      if (state.boss && state.boss.arrived) {
        const d = distance(b, state.boss);
        if (d < bestDist) { nearest = state.boss; }
      }
      if (nearest) {
        const ang = Math.atan2(nearest.y - b.y, nearest.x - b.x);
        const turn = 6 * delta;
        const cur = Math.atan2(b.vy, b.vx);
        let diff = ang - cur;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const newAng = cur + clamp(diff, -turn, turn);
        const sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(newAng) * sp;
        b.vy = Math.sin(newAng) * sp;
      }
    }
    b.x += (b.vx ?? 0) * delta;
    b.y += (b.vy ?? -520) * delta;
    b.x += (b.spread ?? 0) * delta;
    return b.y > -20 && b.y < WORLD.height + 20 && b.x > -40 && b.x < WORLD.width + 40 &&
           (b.life === undefined || b.life > 0);
  });

  state.enemyBullets = state.enemyBullets.filter((b) => {
    b.x += b.vx * delta;
    b.y += b.vy * delta;
    return b.x > -30 && b.x < WORLD.width + 30 && b.y > -30 && b.y < WORLD.height + 30;
  });
}

function updateBeams(delta) {
  state.beams = state.beams.filter((b) => {
    b.age += delta;
    if (b.fromPlayer) {
      const owner = state.players.find((p) => p.id === b.owner);
      if (owner) { b.x = owner.x; b.y = owner.y - 18; }
    } else {
      b.angle += b.sweep * delta;
    }
    return b.age < b.duration;
  });
}

function updateEnemies(delta) {
  state.spawnTimer -= delta;
  state.formationTimer -= delta;
  state.difficultyTimer += delta;

  // Boss Rush mode: no organic enemy spawns, no wave clock; track elapsed timer.
  if (state.bossRush) {
    if (!state.bossRushDone) state.bossRushTime += delta;
  } else {
    if (state.difficultyTimer >= 14) advanceWave();
    if (!state.boss && !state.bossPending) {
      if (state.spawnTimer <= 0) {
        spawnEnemy();
        state.spawnTimer = Math.max(0.24, (1.4 - state.wave * 0.07) / enemyRate());
      }
      if (state.formationTimer <= 0) spawnFormation();
    }
  }

  const now = performance.now();
  state.enemies.forEach((e) => {
    const frozen = e.frozenUntil && now < e.frozenUntil;
    const moveScale = frozen ? 0.25 : 1;
    e.pathTime = (e.pathTime || 0) + delta * moveScale;
    if (e.pathFn) {
      // Path-following enemies move along their path; while frozen, sample
      // positions at a slowed virtual time by re-running the path with
      // current pathTime (already scaled). This stays cheap because pathFn
      // is a simple closure over the index.
      e.pathFn(e, e.pathTime);
    } else {
      e.y += e.speed * delta * moveScale;
      if (e.zigzag) e.x += Math.sin((e.y / 55) + e.seed) * 65 * delta * moveScale;
    }

    if (!frozen) {
      e.shootCooldown -= delta;
      if (e.shootCooldown <= 0 && e.y > 40) {
        fireEnemyBullet(e);
        e.shootCooldown = e.fireRate;
      }
    }

    // Burn DOT
    if (e.burnUntil && now < e.burnUntil && e.burnDps) {
      e.hp -= e.burnDps * delta;
      if (Math.random() < delta * 6) spawnParticle(e.x, e.y, "#ff8a3a");
    }
  });
  state.enemies = state.enemies.filter((e) =>
    e.y < WORLD.height + 60 && e.x > -120 && e.x < WORLD.width + 120
  );
}

function fireEnemyBullet(enemy) {
  const target = nearestPlayer(enemy);
  const angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
  const speed = scaledBulletSpeed(enemy.elite ? 230 : 190);
  state.enemyBullets.push({
    x: enemy.x, y: enemy.y + enemy.radius * 0.6,
    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    radius: enemy.elite ? 7 : 5, color: "#ff7c57",
    damage: enemy.elite ? 2 : 1,
  });
}

function nearestPlayer(from) {
  let best = state.players[0];
  let bestD = best ? distance(best, from) : Infinity;
  for (let i = 1; i < state.players.length; i++) {
    const d = distance(state.players[i], from);
    if (d < bestD) { best = state.players[i]; bestD = d; }
  }
  return best || { x: WORLD.width / 2, y: WORLD.height - 120 };
}

function updateBoss(delta) {
  if (!state.boss) {
    if (state.bossPending && state.bossWarning) {
      state.bossWarning.timer -= delta;
      if (state.bossWarning.timer <= 0) spawnBoss(state.bossWarning.forcedType);
    }
    return;
  }
  bossUpdate(state.boss, delta);
}

function updateLoot(delta) {
  state.loot = state.loot.filter((it) => {
    const target = bestMagnetTarget(it);
    if (target) {
      const d = distance(it, target.player);
      const pull = target.radius <= 0 ? 0 : 1 - clamp(d / target.radius, 0, 1);
      const ang = Math.atan2(target.player.y - it.y, target.player.x - it.x);
      const speed = LOOT_MAGNET_SPEED * (0.45 + pull * 1.35);
      it.x += Math.cos(ang) * speed * delta;
      it.y += Math.sin(ang) * speed * delta;
    }
    it.y += it.speed * delta;
    it.x += Math.sin(it.y / 36) * it.drift * delta;
    return it.y < WORLD.height + 24;
  });
}

function bestMagnetTarget(item) {
  let best = null;
  for (const p of state.players) {
    const radius = p.focused ? LOOT_FOCUS_MAGNET_RADIUS : LOOT_MAGNET_RADIUS;
    const d = distance(item, p);
    if (d <= radius && (!best || d < best.distance)) {
      best = { player: p, radius, distance: d };
    }
  }
  return best;
}

function updateParticles(delta) {
  state.particles = state.particles.filter((p) => {
    p.x += p.vx * delta;
    p.y += p.vy * delta;
    p.vx *= 0.98; p.vy *= 0.98;
    p.ttl -= delta;
    return p.ttl > 0;
  });
  state.flashes = state.flashes.filter((f) => {
    f.ttl -= delta;
    f.alpha = Math.max(0, f.alpha - delta * 1.8);
    return f.ttl > 0;
  });
}
function updateFloatingText(delta) {
  state.texts = state.texts.filter((t) => {
    t.y += t.vy * delta;
    t.vy *= 0.96;
    t.age += delta;
    t.ttl -= delta;
    return t.ttl > 0;
  });
}

function advanceWave() {
  state.wave += 1;
  state.difficultyTimer = 0;
  const newStage = Math.floor((state.wave - 1) / STAGE_WAVES) + 1;
  if (newStage !== state.stage) {
    triggerStageClear(state.stage);
    audio.setBgmStage(newStage);
  }
  state.stage = newStage;
  if (state.wave === 10) unlockAch("wave-10");
  if (state.wave === 25) unlockAch("wave-25");
  if (state.wave === 11 && state.bombsThrownThisRun === 0) unlockAch("no-bomb-10");

  if (state.wave % BOSS_WAVE_INTERVAL === 0 && state.lastBossWave !== state.wave) {
    state.lastBossWave = state.wave;
    startBossWarning();
  }
  syncHud();
}

function triggerStageClear(clearedStage) {
  if (state.replayPlaying) return;

  const p = state.players[0];
  const bonus = 1000 + clearedStage * 200;
  const rewards = [`+${bonus} 金幣`, "滿血復原", "火力 +1"];
  meta.credits += bonus;

  if (p) {
    p.hp = p.maxHp;
    if (p.power < POWER_CAP) p.power = clamp(p.power + 1, 1, POWER_CAP);
    const lockedSlots = WEAPON_ORDER.filter((w) => w !== "default" && !p.weaponSlots[w]);
    if (lockedSlots.length > 0) {
      const pick = lockedSlots[Math.floor(Math.random() * lockedSlots.length)];
      p.weaponSlots[pick] = true;
      rewards.push(`解鎖 ${WEAPONS[pick].name}`);
    } else {
      rewards.push("獎勵 +1 炸彈");
      p.bombs += 1;
    }
  }
  saveMeta();

  state.stageClearOverlay = {
    timer: STAGE_CLEAR_DURATION,
    stage: clearedStage,
  };
  state.enemies = [];
  state.enemyBullets = [];
  state.telegraphs = [];
  state.deferredActions = [];
  state.boss = null;
  state.bossPending = false;
  state.bossWarning = null;
  state.running = false;
  audio.victory();
  audio.stopBgm();

  els.stageClearTitle.textContent = `STAGE ${clearedStage} CLEAR`;
  els.stageClearBody.textContent = rewards.join("．");
  els.stageClearOverlay.hidden = false;
  shake(8, 0.4);
}

// =====================================================================
//  Collisions
// =====================================================================

function handleCollisions() {
  const remaining = [];
  for (const b of state.bullets) {
    let hit = null;
    for (const e of state.enemies) {
      if (distance(b, e) < b.radius + e.radius) { hit = e; break; }
    }
    if (!hit && state.boss && state.boss.arrived) {
      const bo = state.boss;
      if (distance(b, bo) < b.radius + bo.radius) {
        damageBoss(bo, b.damage, b.x, b.y);
        spawnParticle(b.x, b.y, "#fff");
        continue;
      }
    }
    if (!hit) { remaining.push(b); continue; }
    hit.hp -= b.damage;
    spawnParticle(b.x, b.y, "#fff");
    maybeApplyStatus(hit);
  }
  state.bullets = remaining;

  for (const beam of state.beams) {
    if (!beam.fromPlayer) continue;
    const c = Math.cos(beam.angle), s = Math.sin(beam.angle);
    for (const e of state.enemies) {
      const dx = e.x - beam.x, dy = e.y - beam.y;
      const along = c * dx + s * dy;
      const perp = c * dy - s * dx;
      if (along > 0 && Math.abs(perp) < e.radius + beam.width / 2) {
        e.hp -= beam.damage;
        if (Math.random() < 0.3) spawnParticle(e.x, e.y, "#fff39a");
      }
    }
    if (state.boss && state.boss.arrived) {
      const bo = state.boss;
      const dx = bo.x - beam.x, dy = bo.y - beam.y;
      const along = c * dx + s * dy;
      const perp = c * dy - s * dx;
      if (along > 0 && Math.abs(perp) < bo.radius + beam.width / 2) {
        damageBoss(bo, beam.damage, bo.x, bo.y - 20);
      }
    }
  }

  for (const beam of state.beams) {
    if (beam.fromPlayer) continue;
    for (const p of state.players) {
      const dx = p.x - beam.x, dy = p.y - beam.y;
      const localDist = Math.cos(beam.angle) * dy - Math.sin(beam.angle) * dx;
      const along = Math.cos(beam.angle) * dx + Math.sin(beam.angle) * dy;
      const hitRadius = p.focused ? p.hitRadius : p.radius;
      if (Math.abs(localDist) < beam.width / 2 + hitRadius && along > 0) {
        damagePlayer(p, 1);
      }
    }
  }

  const survivors = [];
  for (const e of state.enemies) {
    let killed = false;
    for (const p of state.players) {
      if (distance(e, p) < e.radius + p.radius + 4) {
        damagePlayer(p, e.elite ? 4 : 2);
        destroyEnemy(e);
        killed = true; break;
      }
    }
    if (killed) continue;
    if (e.hp <= 0) { destroyEnemy(e); continue; }
    survivors.push(e);
  }
  state.enemies = survivors;

  if (state.boss && state.boss.arrived) {
    for (const p of state.players) {
      if (distance(state.boss, p) < state.boss.radius + p.radius - 6) {
        damagePlayer(p, 4);
      }
    }
  }

  state.enemyBullets = state.enemyBullets.filter((b) => {
    for (const p of state.players) {
      const hitRadius = p.focused ? p.hitRadius : p.radius + 4;
      if (distance(b, p) < b.radius + hitRadius) {
        damagePlayer(p, b.damage);
        spawnParticle(b.x, b.y, "#ff8866");
        return false;
      }
    }
    return true;
  });

  state.loot = state.loot.filter((it) => {
    for (const p of state.players) {
      const reach = it.radius + p.radius + 12;
      if (distance(it, p) < reach) {
        collectLoot(p, it);
        return false;
      }
    }
    return true;
  });
}

// =====================================================================
//  Render
// =====================================================================

function render() {
  const sx = state.shake.intensity > 0 ? (Math.random() - 0.5) * state.shake.intensity : 0;
  const sy = state.shake.intensity > 0 ? (Math.random() - 0.5) * state.shake.intensity : 0;
  ctx.save();
  ctx.clearRect(0, 0, WORLD.width, WORLD.height);
  ctx.translate(sx, sy);

  drawBackground();
  drawLoot();
  drawBeams();
  drawTelegraphs();
  drawBullets();
  drawEnemies();
  drawBoss();
  drawBossWarning();
  drawPlayers();
  drawZaps();
  drawParticles();
  drawTexts();
  drawCanvasHud();
  drawSlowMoVignette();
  drawFlashes();

  ctx.restore();
}

function drawBackground() {
  const stage = state.stage;
  const skies = [
    ["#0b2240", "#08192e", "#030810"],
    ["#3a1c4d", "#21102e", "#070315"],
    ["#173b5e", "#0a1d34", "#020812"],
    ["#532013", "#2a0c08", "#100303"],
    ["#0d4338", "#062520", "#020e0a"],
  ];
  const palette = skies[(stage - 1) % skies.length];
  const grad = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  grad.addColorStop(0, palette[0]);
  grad.addColorStop(0.45, palette[1]);
  grad.addColorStop(1, palette[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  state.starLayers.forEach((layer, idx) => {
    layer.stars.forEach((s) => {
      ctx.globalAlpha = s.alpha * (0.6 + idx * 0.2);
      ctx.fillStyle = idx === 2 ? "#fff" : idx === 1 ? "#cce4ff" : "#7799bb";
      ctx.fillRect(s.x, s.y, s.size, s.size * 1.8);
    });
  });
  ctx.globalAlpha = 1;

  ctx.fillStyle = `rgba(102, 228, 255, ${0.07 + (stage * 0.01)})`;
  ctx.beginPath();
  ctx.arc(WORLD.width / 2, 110 + Math.sin(performance.now() / 4000) * 6, 170, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayers() {
  state.players.forEach((p) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.invincible > 0) {
      ctx.globalAlpha = 0.5 + Math.sin(performance.now() / 70) * 0.25;
    }
    if (p.shield > 0) {
      ctx.strokeStyle = "rgba(140,255,191,0.7)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (p.focused) {
      ctx.strokeStyle = "rgba(255,216,108,0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 4 + Math.sin(performance.now()/120)*2, 0, Math.PI*2);
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, p.hitRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,216,108,0.9)";
      ctx.beginPath();
      ctx.moveTo(-p.hitRadius - 5, 0);
      ctx.lineTo(p.hitRadius + 5, 0);
      ctx.moveTo(0, -p.hitRadius - 5);
      ctx.lineTo(0, p.hitRadius + 5);
      ctx.stroke();
      ctx.fillStyle = "#ffd86c";
      ctx.beginPath();
      ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Engine flame (drawn behind sprite, animated)
    ctx.fillStyle = "#ff9a62";
    ctx.beginPath();
    ctx.moveTo(-8, 16);
    ctx.lineTo(0, 32 + Math.sin(performance.now() / 40) * 5);
    ctx.lineTo(8, 16);
    ctx.closePath(); ctx.fill();

    const sprite = sprites["player_" + p.char] || sprites.player_alpha;
    if (sprite) {
      ctx.drawImage(sprite.canvas, -sprite.w / 2, -sprite.h / 2, sprite.w, sprite.h);
    }
    ctx.restore();

    p.wingmen.forEach((w) => {
      ctx.save();
      ctx.translate(w.x, w.y);
      const ws = sprites.wingman;
      if (ws) ctx.drawImage(ws.canvas, -ws.w / 2, -ws.h / 2, ws.w, ws.h);
      ctx.restore();
    });
  });
}

function drawEnemies() {
  const now = performance.now();
  state.enemies.forEach((e) => {
    ctx.save();
    ctx.translate(e.x, e.y);
    const sprite = e.elite ? sprites.enemy_elite
                  : (e.formation ? sprites.enemy_formation : sprites.enemy_basic);
    if (sprite) {
      // Status visual tints
      if (e.frozenUntil && now < e.frozenUntil) {
        ctx.shadowColor = "#9ad6ff";
        ctx.shadowBlur = 14;
      } else if (e.burnUntil && now < e.burnUntil) {
        ctx.shadowColor = "#ff8a3a";
        ctx.shadowBlur = 10 + Math.sin(now / 70) * 4;
      }
      const scale = (e.radius * 2.4) / sprite.w;
      ctx.drawImage(sprite.canvas,
        -sprite.w * scale / 2, -sprite.h * scale / 2,
        sprite.w * scale, sprite.h * scale);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = e.elite ? "#ffd86c" : (e.formation ? "#a8c8ff" : "#ff6d6d");
      ctx.beginPath();
      ctx.moveTo(0, e.radius); ctx.lineTo(e.radius, -e.radius);
      ctx.lineTo(0, -e.radius * 0.3); ctx.lineTo(-e.radius, -e.radius);
      ctx.closePath(); ctx.fill();
    }

    // Status icons
    if (e.frozenUntil && now < e.frozenUntil) {
      ctx.fillStyle = "#9ad6ff";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("❄", 0, -e.radius - 6);
      ctx.textAlign = "start";
    }
    if (e.burnUntil && now < e.burnUntil) {
      ctx.fillStyle = "#ff8a3a";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("✦", e.radius * 0.6, -e.radius - 4);
      ctx.textAlign = "start";
    }

    // HP bar
    const ratio = clamp(e.hp / e.maxHp, 0, 1);
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fillRect(-e.radius, e.radius + 8, e.radius * 2, 4);
    ctx.fillStyle = e.elite ? "#fff39a" : "#66e4ff";
    ctx.fillRect(-e.radius, e.radius + 8, e.radius * 2 * ratio, 4);
    ctx.restore();
  });
}

function drawBoss() {
  const b = state.boss;
  if (!b) return;
  ctx.save();
  ctx.translate(b.x, b.y);
  // Slow rotation for organic bosses, none for warship-like
  const spin = (b.type === "leviathan" || b.type === "phoenix") ? performance.now() / 4000 : 0;
  ctx.rotate(spin);
  const sprite = sprites["boss_" + b.type];
  if (sprite) {
    const scale = (b.radius * 2.2) / sprite.w;
    ctx.drawImage(sprite.canvas,
      -sprite.w * scale / 2, -sprite.h * scale / 2,
      sprite.w * scale, sprite.h * scale);
  } else {
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.moveTo(0, -b.radius); ctx.lineTo(b.radius, 0);
    ctx.lineTo(b.radius * 0.6, b.radius); ctx.lineTo(-b.radius * 0.6, b.radius);
    ctx.lineTo(-b.radius, 0);
    ctx.closePath(); ctx.fill();
  }
  // Pulsing core glow on top of sprite
  ctx.rotate(-spin);
  ctx.fillStyle = b.enraged ? "rgba(255,93,93,0.55)" : "rgba(255,216,108,0.45)";
  ctx.beginPath();
  ctx.arc(0, 0, b.radius * 0.18 + Math.sin(performance.now() / 120) * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBossWarning() {
  const warning = state.bossWarning;
  if (!warning || state.boss) return;

  const progress = clamp(warning.timer / warning.total, 0, 1);
  const pulse = 0.55 + Math.sin(performance.now() / 80) * 0.25;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = "rgba(255, 45, 45, 0.22)";
  ctx.fillRect(0, 88, WORLD.width, 54);
  ctx.fillRect(0, WORLD.height - 142, WORLD.width, 54);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#ff6d6d";
  ctx.font = 'bold 30px "Trebuchet MS", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("WARNING", WORLD.width / 2, 124);
  ctx.fillStyle = "#ffd86c";
  ctx.font = 'bold 16px "Trebuchet MS", sans-serif';
  ctx.fillText(`BOSS IN ${Math.ceil(warning.timer)}`, WORLD.width / 2, WORLD.height - 108);
  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  ctx.fillRect(70, WORLD.height - 96, WORLD.width - 140, 6);
  ctx.fillStyle = "#ff6d6d";
  ctx.fillRect(70, WORLD.height - 96, (WORLD.width - 140) * (1 - progress), 6);
  ctx.textAlign = "start";
  ctx.restore();
}

function drawBullets() {
  state.bullets.forEach((b) => {
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    if (b.homing) {
      ctx.strokeStyle = "rgba(215,166,255,0.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  state.enemyBullets.forEach((b) => {
    ctx.fillStyle = b.color || "#ff7c57";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawBeams() {
  state.beams.forEach((beam) => {
    ctx.save();
    ctx.translate(beam.x, beam.y);
    ctx.rotate(beam.angle);
    const a = Math.sin((beam.age / beam.duration) * Math.PI);
    ctx.globalAlpha = clamp(a + 0.2, 0.2, 1);
    ctx.fillStyle = beam.color;
    // Beam shoots along local +x. beam.angle is direction (right=0, up=-π/2, down=π/2).
    ctx.fillRect(0, -beam.width / 2, 1200, beam.width);
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, -beam.width / 4, 1200, beam.width / 2);
    ctx.restore();
  });
  ctx.globalAlpha = 1;
}

function drawLoot() {
  state.loot.forEach((it) => {
    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.strokeStyle = it.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, it.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = it.color;

    if (it.kind === "heal") { ctx.fillRect(-3, -8, 6, 16); ctx.fillRect(-8, -3, 16, 6); }
    if (it.kind === "power") {
      ctx.beginPath();
      ctx.moveTo(0, -10); ctx.lineTo(6, 0); ctx.lineTo(0, 10); ctx.lineTo(-6, 0);
      ctx.closePath(); ctx.fill();
    }
    if (it.kind === "bomb") {
      ctx.beginPath(); ctx.arc(0, 2, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(-2, -9, 4, 6);
    }
    if (it.kind === "shield") {
      ctx.beginPath();
      ctx.moveTo(0, -10); ctx.lineTo(8, -4); ctx.lineTo(5, 8); ctx.lineTo(0, 11);
      ctx.lineTo(-5, 8); ctx.lineTo(-8, -4);
      ctx.closePath(); ctx.fill();
    }
    if (it.kind === "spread" || it.kind === "laser" || it.kind === "homing") {
      ctx.fillStyle = "#0c1322";
      ctx.fillRect(-7, -3, 14, 6);
      ctx.fillStyle = it.color;
      const lab = it.kind === "spread" ? "S" : it.kind === "laser" ? "L" : "H";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(lab, 0, 0);
    }
    if (it.kind === "wingman") {
      ctx.beginPath();
      ctx.moveTo(0, -8); ctx.lineTo(7, 6); ctx.lineTo(-7, 6);
      ctx.closePath(); ctx.fill();
    }
    if (it.kind === "credit") {
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "#0c1322";
      ctx.fillText("$", 0, 0);
    }

    // Label below the loot circle
    const labels = {
      heal: "補血", power: "火力", bomb: "炸彈", shield: "護盾",
      spread: "散彈", laser: "雷射", homing: "追蹤", wingman: "僚機", credit: "金幣",
    };
    const label = labels[it.kind];
    if (label) {
      ctx.font = "bold 10px \"Noto Sans TC\", sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.78)";
      ctx.fillStyle = it.color;
      ctx.strokeText(label, 0, it.radius + 3);
      ctx.fillText(label, 0, it.radius + 3);
    }
    ctx.restore();
  });
}

function drawParticles() {
  state.particles.forEach((p) => {
    ctx.globalAlpha = clamp(p.ttl, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  });
  ctx.globalAlpha = 1;
}

function drawTexts() {
  state.texts.forEach((t) => {
    const alpha = clamp(t.ttl, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = t.color;
    ctx.font = `bold ${t.size}px "Trebuchet MS", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 3;
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillText(t.text, t.x, t.y);
  });
  ctx.globalAlpha = 1;
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

function drawCanvasHud() {
  const p = state.players[0];
  if (!p) return;

  // HUD background — taller to fit power-tier dots
  ctx.fillStyle = "rgba(3,10,18,0.62)";
  ctx.fillRect(12, WORLD.height - 92, WORLD.width - 24, 70);

  // Power tier dots (1..20)
  const dotW = 14, gap = 2;
  const totalW = dotW * POWER_CAP + gap * (POWER_CAP - 1);
  const startX = (WORLD.width - totalW) / 2;
  const dotsY = WORLD.height - 86;
  const TIER_COLORS = ["#66e4ff", "#8cffbf", "#ffd86c", "#ff5d5d"];
  for (let i = 0; i < POWER_CAP; i++) {
    const lit = i < p.power;
    const tier = Math.min(3, Math.floor(i / 5));
    if (lit) {
      ctx.fillStyle = TIER_COLORS[tier];
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.14)";
    }
    ctx.fillRect(startX + i * (dotW + gap), dotsY, dotW, 6);
  }
  // Power label
  ctx.fillStyle = "#fff";
  ctx.font = 'bold 11px "Trebuchet MS", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(`POWER ${p.power} / ${POWER_CAP}`, WORLD.width / 2, dotsY - 4);
  ctx.textAlign = "start";

  // HP bar
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(22, WORLD.height - 60, WORLD.width - 44, 14);
  ctx.fillStyle = p.hp / p.maxHp < LOW_HP_RATIO ? "#ff7777" : "#8cffbf";
  ctx.fillRect(22, WORLD.height - 60, (WORLD.width - 44) * clamp(p.hp / p.maxHp, 0, 1), 14);
  if (p.shield > 0) {
    ctx.fillStyle = "#d7a6ff";
    const shw = (WORLD.width - 44) * (p.shield / 16);
    ctx.fillRect(22, WORLD.height - 46, shw, 4);
  }

  // Stats row
  ctx.fillStyle = "#eef6ff";
  ctx.font = '15px "Trebuchet MS", sans-serif';
  ctx.fillText(`HP ${Math.ceil(p.hp)}/${p.maxHp}`, 24, WORLD.height - 28);
  ctx.fillText(`命 ${p.lives}`, 168, WORLD.height - 28);
  ctx.fillText(`炸 ${p.bombs}`, 226, WORLD.height - 28);
  ctx.fillText(`武 ${WEAPONS[p.weapon].name}`, 280, WORLD.height - 28);
  if (state.bossRush) {
    ctx.fillText(`B ${Math.min(state.bossRushIdx + 1, BOSS_RUSH_TYPES.length)}/${BOSS_RUSH_TYPES.length}`, 408, WORLD.height - 28);
  } else {
    ctx.fillText(`W ${state.wave}`, 408, WORLD.height - 28);
  }

  if (state.bossRush) {
    const t = state.bossRushTime;
    const mm = Math.floor(t / 60);
    const ss = (t % 60).toFixed(2).padStart(5, "0");
    ctx.fillStyle = "#ffd86c";
    ctx.font = 'bold 18px "Trebuchet MS", sans-serif';
    ctx.textAlign = "right";
    ctx.fillText(`${mm}:${ss}`, WORLD.width - 14, 38);
    ctx.font = 'bold 10px "Trebuchet MS", sans-serif';
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText("BOSS RUSH", WORLD.width - 14, 22);
    ctx.textAlign = "start";
  }
}

function drawTelegraphs() {
  state.telegraphs.forEach((t) => {
    const progress = clamp(t.age / t.ttl, 0, 1);
    const alpha = 0.3 + progress * 0.5;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = t.color || "#ff5555";
    ctx.lineWidth = 1.4 + progress * 2.6;
    ctx.setLineDash([7, 5]);
    if (t.kind === "line") {
      ctx.translate(t.x, t.y);
      ctx.rotate(t.angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(900, 0);
      ctx.stroke();
    } else if (t.kind === "ring") {
      const r = 70 + progress * 80;
      ctx.beginPath();
      ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (t.kind === "fan") {
      ctx.translate(t.x, t.y);
      const half = t.spread / 2;
      const rays = 5;
      for (let i = 0; i <= rays; i++) {
        const a = t.angle - half + (i / rays) * t.spread;
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(700, 0);
        ctx.stroke();
        ctx.restore();
      }
    } else if (t.kind === "spark") {
      const r = 14 + progress * 12;
      ctx.beginPath();
      ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  });
  ctx.globalAlpha = 1;
}

function drawZaps() {
  state.zaps.forEach((z) => {
    const a = clamp(1 - z.age / z.ttl, 0, 1);
    ctx.strokeStyle = z.color;
    ctx.globalAlpha = a;
    ctx.lineWidth = 1.5 + a * 2.5;
    const segs = 4;
    ctx.beginPath();
    ctx.moveTo(z.x1, z.y1);
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const ox = (Math.random() - 0.5) * 12;
      const oy = (Math.random() - 0.5) * 12;
      ctx.lineTo(lerp(z.x1, z.x2, t) + ox, lerp(z.y1, z.y2, t) + oy);
    }
    ctx.lineTo(z.x2, z.y2);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
}

function drawSlowMoVignette() {
  if (!state.slowMoActive) return;
  const grad = ctx.createRadialGradient(
    WORLD.width / 2, WORLD.height / 2, WORLD.height * 0.25,
    WORLD.width / 2, WORLD.height / 2, WORLD.height * 0.65
  );
  grad.addColorStop(0, "rgba(255,90,90,0)");
  grad.addColorStop(1, "rgba(255,40,40,0.32)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  // Subtle pulsing border
  const pulse = 0.55 + Math.sin(performance.now() / 160) * 0.2;
  ctx.strokeStyle = `rgba(255,90,90,${pulse})`;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, WORLD.width - 4, WORLD.height - 4);
}

function drawFlashes() {
  state.flashes.forEach((f) => {
    ctx.globalAlpha = f.alpha;
    ctx.fillStyle = f.color || "#ffffff";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  });
  ctx.globalAlpha = 1;
}

function seedStars() {
  state.starLayers = [
    { speed: 30,  stars: [] },
    { speed: 70,  stars: [] },
    { speed: 130, stars: [] },
  ];
  state.starLayers.forEach((layer, idx) => {
    const count = idx === 2 ? 60 : idx === 1 ? 40 : 30;
    for (let i = 0; i < count; i++) {
      layer.stars.push({
        x: random(0, WORLD.width),
        y: random(0, WORLD.height),
        size: random(0.6, 2.4) + idx * 0.4,
        alpha: random(0.3, 0.95),
      });
    }
  });
}

// =====================================================================
//  Game lifecycle
// =====================================================================

function startNewGame(seedOverride) {
  let seed;
  if (seedOverride !== undefined) seed = seedOverride;
  else if (state.daily) seed = dateSeed();
  else seed = (Math.random() * 0xffffffff) >>> 0;
  state.rngSeed = seed;
  setSeed(seed);

  setScene("play");
  state.running = true;
  state.gameOver = false;
  state.score = 0;
  state.wave = 1;
  state.stage = 1;
  state.difficulty = els.difficultySelect?.value || state.difficulty || "normal";
  state.spawnTimer = 0;
  state.formationTimer = 4;
  state.difficultyTimer = 0;
  state.bossPending = false;
  state.bossWarning = null;
  state.boss = null;
  state.lastBossWave = 0;
  state.bullets = []; state.enemyBullets = []; state.enemies = [];
  state.loot = []; state.particles = []; state.texts = []; state.flashes = []; state.beams = [];
  state.telegraphs = []; state.deferredActions = []; state.zaps = [];
  state.stageClearOverlay = null;
  state.continueOverlay = null;
  state.continuesUsed = 0;
  state.slowMoActive = false;
  if (els.stageClearOverlay) els.stageClearOverlay.hidden = true;
  if (els.continueOverlay) els.continueOverlay.hidden = true;
  state.shake = { intensity: 0, time: 0 };
  state.hitstop = 0;
  state.combo = { count: 0, timer: 0, multiplier: 1, max: 0 };
  state.scoreSaved = false;
  state.weaponsUsed = new Set();
  state.bombsThrownThisRun = 0;
  state.bossDamageTaken = 0;
  state.bossKillsRun = 0;
  state.enemyKills = 0;
  state.lootCollected = 0;
  state.damageTaken = 0;
  state.runStartMs = performance.now();
  state.lastRunStats = null;
  state.lastEarnedCredits = 0;
  state.bossRushIdx = 0;
  state.bossRushTime = 0;
  state.bossRushDone = false;
  if (!state.replayPlaying) state.replayFrames = [];

  state.players = [createPlayer(0)];
  if (state.coop && !state.replayPlaying) state.players.push(createPlayer(1));

  seedStars();
  hideMessage();
  els.pauseOverlay.hidden = true;
  els.nameEntry.hidden = true;
  audio.ensure();
  audio.setBgmStage(state.stage);
  audio.startBgm();

  if (state.bossRush) {
    // Kick off the first boss after a short warning
    pushDeferred(0.4, () => startBossWarning(BOSS_RUSH_TYPES[0]));
  }
  syncHud();
}

function endGame() {
  state.running = false;
  state.gameOver = true;
  state.stageClearOverlay = null;
  state.continueOverlay = null;
  if (els.stageClearOverlay) els.stageClearOverlay.hidden = true;
  if (els.continueOverlay) els.continueOverlay.hidden = true;
  setScene("menu");
  audio.stopBgm();

  if (state.score >= 50000) unlockAch("score-50k");
  if (state.coop && state.score > 0) unlockAch("co-op");
  if (state.daily && state.score > 0) unlockAch("daily");

  if (state.bossRush && state.bossRushDone) {
    const entry = {
      time: Math.round(state.bossRushTime),
      tag: "玩家",
      cleared: true,
      difficulty: state.difficulty,
      date: new Date().toLocaleDateString("zh-TW"),
    };
    bossRushLeaderboard = [...bossRushLeaderboard, entry]
      .sort((a, b) => a.time - b.time).slice(0, 8);
    saveBossRushLeaderboard();
  }

  const earned = Math.round(state.score / 200 * (1 + meta.shop.credit * 0.15));
  meta.credits += earned;
  saveMeta();
  state.lastEarnedCredits = earned;
  state.lastRunStats = buildRunStats(earned);

  if (state.recording) saveLastReplay();
  state.recording = false;
  state.replayPlaying = false;
  state.vKeys = null; state.vPointer = null;

  if (state.score > 0 && (qualifiesForLeaderboard(state.score) || state.daily)) {
    pendingHighScore = {
      score: Math.floor(state.score),
      wave: state.wave,
      daily: !!state.daily,
      dateKey: state.daily ? todayKey() : null,
      date: new Date().toLocaleDateString("zh-TW"),
    };
    setScene("name-entry");
    els.nameEntry.hidden = false;
    els.nameInput.value = "";
    setTimeout(() => els.nameInput.focus(), 50);
  } else {
    showFinalMenu(earned);
  }
}

function qualifiesForLeaderboard(score) {
  if (leaderboard.length < 8) return true;
  return score > (leaderboard[leaderboard.length - 1]?.score || 0);
}

function submitName() {
  if (!pendingHighScore) return;
  const tag = (els.nameInput.value || "無名英雄").slice(0, 10);
  const entry = { ...pendingHighScore, tag };
  leaderboard = [...leaderboard, entry]
    .sort((a, b) => b.score - a.score).slice(0, 8);
  saveLeaderboard();
  if (pendingHighScore.daily) {
    const dailyEntry = { ...entry, dateKey: pendingHighScore.dateKey || todayKey() };
    dailyLeaderboard = [...dailyLeaderboard, dailyEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 64);
    saveDailyLeaderboard();
  }
  renderLeaderboard();
  pendingHighScore = null;
  els.nameEntry.hidden = true;
  showFinalMenu(state.lastEarnedCredits || 0);
}

function buildRunStats(earnedCredits) {
  const duration = Math.max(1, Math.round((performance.now() - state.runStartMs) / 1000));
  return {
    score: Math.floor(state.score),
    wave: state.wave,
    stage: state.stage,
    difficulty: difficultyConfig().label,
    duration,
    kills: state.enemyKills,
    bosses: state.bossKillsRun,
    maxCombo: state.combo.max,
    loot: state.lootCollected,
    damage: Math.round(state.damageTaken),
    bombs: state.bombsThrownThisRun,
    credits: earnedCredits,
  };
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function showFinalMenu(earnedCredits) {
  setScene("menu");
  els.message.hidden = false;
  const stats = state.lastRunStats || buildRunStats(earnedCredits);
  showMessage(
    "MISSION END",
    `最終分數 ${Math.floor(state.score)}`,
    `Wave ${state.wave}．連擊紀錄 ${state.combo.max}．本場+${earnedCredits} 金幣。再來一次？`,
    "重新出擊"
  );
  showMessage(
    "MISSION END",
    `最終分數 ${stats.score}`,
    `難度 ${stats.difficulty}｜抵達 Wave ${stats.wave}｜時間 ${formatDuration(stats.duration)}
擊殺 ${stats.kills}｜Boss ${stats.bosses}｜最高連擊 ${stats.maxCombo}
寶物 ${stats.loot}｜受傷 ${stats.damage}｜炸彈 ${stats.bombs}｜金幣 +${stats.credits}`,
    "重新出擊"
  );
  refreshMenuPanels();
  syncHud();
}

function showMessage(tag, title, body, btn) {
  els.messageTag.textContent = tag;
  els.messageTitle.textContent = title;
  els.messageBody.textContent = body;
  els.startBtn.textContent = btn;
}

function hideMessage() { els.message.hidden = true; }

// =====================================================================
//  Pause
// =====================================================================

function setScene(s) {
  state.scene = s;
  document.body.dataset.scene = s;
}

function togglePause() {
  if (state.continueOverlay || state.stageClearOverlay) return;
  if (state.scene === "play") {
    setScene("paused");
    state.running = false;
    els.pauseOverlay.hidden = false;
    audio.stopBgm();
  } else if (state.scene === "paused") {
    setScene("play");
    state.running = true;
    els.pauseOverlay.hidden = true;
    audio.startBgm();
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.scene === "play") togglePause();
});

// =====================================================================
//  Main loop
// =====================================================================

function tick(ts) {
  let delta;
  if (state.replayPlaying) {
    const replayDelta = applyReplayFrame();
    delta = replayDelta != null ? replayDelta : Math.min((ts - lastTimestamp) / 1000 || 0, 0.033);
  } else {
    delta = Math.min((ts - lastTimestamp) / 1000 || 0, 0.033);
  }
  lastTimestamp = ts;

  if (state.scene === "play" && state.recording && !state.replayPlaying) {
    captureFrameInput(delta);
  }

  update(delta);
  render();
  requestAnimationFrame(tick);
}

// =====================================================================
//  Input listeners
// =====================================================================

function toCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * WORLD.width,
    y: ((event.clientY - rect.top) / rect.height) * WORLD.height,
  };
}

function registerInput() {
  window.addEventListener("keydown", (event) => {
    if (event.target && (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA")) return;
    const block = ["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space","KeyW","KeyA","KeyS","KeyD","KeyQ","KeyE","ShiftLeft","ShiftRight","KeyP","Escape","Tab","KeyX"];
    if (block.includes(event.code)) event.preventDefault();
    keys.add(event.code);
    if (event.code === "Space") useBomb();
    if (event.code === "KeyQ" && state.coop) useBomb();
    if (event.code === "KeyP" || event.code === "Escape") togglePause();
    if (event.code === "Tab" || event.code === "KeyX") cycleWeapon(state.players[0]);
    // Continue overlay shortcuts
    if (state.continueOverlay) {
      if (event.code === "Enter" || event.code === "KeyY") acceptContinue();
      if (event.code === "Escape" || event.code === "KeyN") declineContinue();
    }
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));

  // Mouse: hover-to-follow (no button needed). Touch: press-and-drag.
  canvas.addEventListener("pointerdown", (e) => {
    pointer.active = true;
    const p = toCanvasPoint(e);
    pointer.x = p.x; pointer.y = p.y;
    if (e.pointerType !== "mouse") {
      try { canvas.setPointerCapture(e.pointerId); } catch {}
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    const p = toCanvasPoint(e);
    pointer.x = p.x; pointer.y = p.y;
    if (e.pointerType === "mouse") pointer.active = true;
  });
  canvas.addEventListener("pointerup", (e) => {
    if (e.pointerType !== "mouse") pointer.active = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
  });
  canvas.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "mouse") pointer.active = false;
  });
  canvas.addEventListener("pointercancel", () => { pointer.active = false; });

  els.bombBtn.addEventListener("click", useBomb);
  els.focusBtn.addEventListener("pointerdown", () => {
    keys.add("ShiftLeft"); els.focusBtn.classList.add("is-active");
  });
  const releaseFocus = () => {
    keys.delete("ShiftLeft"); els.focusBtn.classList.remove("is-active");
  };
  els.focusBtn.addEventListener("pointerup", releaseFocus);
  els.focusBtn.addEventListener("pointercancel", releaseFocus);
  els.focusBtn.addEventListener("pointerleave", releaseFocus);
  els.pauseBtn.addEventListener("click", togglePause);
  els.resumeBtn.addEventListener("click", togglePause);
  els.quitBtn.addEventListener("click", () => {
    setScene("menu");
    state.running = false;
    state.replayPlaying = false;
    state.recording = false;
    state.boss = null;
    state.stageClearOverlay = null;
    state.continueOverlay = null;
    els.pauseOverlay.hidden = true;
    if (els.stageClearOverlay) els.stageClearOverlay.hidden = true;
    if (els.continueOverlay) els.continueOverlay.hidden = true;
    showFinalMenu(0);
  });
  els.startBtn.addEventListener("click", () => {
    state.coop = els.coopToggle.checked;
    state.daily = els.dailyToggle.checked;
    state.bossRush = els.bossRushToggle ? els.bossRushToggle.checked : false;
    state.recording = els.recordToggle.checked;
    state.difficulty = els.difficultySelect?.value || "normal";
    startNewGame();
  });
  els.nameSubmit.addEventListener("click", submitName);
  els.nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") submitName(); });
  if (els.continueAcceptBtn) els.continueAcceptBtn.addEventListener("click", acceptContinue);
  if (els.continueDeclineBtn) els.continueDeclineBtn.addEventListener("click", declineContinue);
  els.soundBtn.addEventListener("click", () => {
    audio.toggle();
    els.soundBtn.textContent = audio.muted ? "音效 OFF" : "音效 ON";
  });

  if (els.lbTabs) {
    els.lbTabs.addEventListener("click", (e) => {
      const btn = e.target.closest(".lb-tab");
      if (!btn) return;
      leaderboardTab = btn.dataset.lb || "all";
      els.lbTabs.querySelectorAll(".lb-tab").forEach((b) =>
        b.classList.toggle("is-active", b === btn));
      renderLeaderboard();
    });
  }

  els.tabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-button");
    if (!btn) return;
    document.querySelectorAll(".tab-button").forEach((b) => b.classList.toggle("is-active", b === btn));
    const tab = btn.dataset.tab;
    document.querySelectorAll(".tab-pane").forEach((p) => p.classList.toggle("is-active", p.dataset.pane === tab));
    if (tab === "shop") renderShop();
    if (tab === "select") renderCharacters();
    if (tab === "ach") renderAchievements();
    if (tab === "replay") renderReplaySlots();
  });

  els.replayBtn.addEventListener("click", () => {
    const pick = replays[selectedReplayIdx] || replays[0] || lastReplay;
    if (pick) startReplay(pick);
  });
  els.exportReplayBtn.addEventListener("click", () => {
    const pick = replays[selectedReplayIdx] || lastReplay;
    if (!pick) return;
    const text = JSON.stringify(pick);
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    els.replayImport.value = text;
  });
  els.importReplayBtn.addEventListener("click", () => {
    try {
      const data = JSON.parse(els.replayImport.value);
      startReplay(data);
    } catch {
      alert("錄影格式錯誤");
    }
  });
}

// =====================================================================
//  Menu panels
// =====================================================================

function refreshMenuPanels() {
  renderCharacters();
  renderShop();
  renderAchievements();
  renderReplaySlots();
  els.shopCredits.textContent = meta.credits;
}

let selectedReplayIdx = 0;

function renderReplaySlots() {
  if (!els.replaySlots) return;
  els.replaySlots.replaceChildren();
  if (replays.length === 0) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "尚無錄影。先勾選『錄影模式』再出擊。";
    els.replaySlots.append(p);
    return;
  }
  replays.forEach((rp, i) => {
    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = "replay-slot" + (i === selectedReplayIdx ? " is-active" : "");
    if (rp.thumb) {
      const img = document.createElement("img");
      img.src = rp.thumb;
      img.alt = "thumbnail";
      slot.append(img);
    } else {
      const ph = document.createElement("div");
      ph.className = "placeholder";
      ph.textContent = "▶";
      slot.append(ph);
    }
    const meta = document.createElement("div");
    meta.className = "meta";
    const date = new Date(rp.date || 0);
    const dateStr = isNaN(date) ? "" : date.toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" });
    meta.innerHTML = `<strong>${rp.score || 0}</strong>
      <span>W${rp.wave || 0}．${rp.difficulty || "normal"}</span>
      <span>${dateStr}${rp.daily ? "．每日" : ""}</span>`;
    slot.append(meta);
    slot.addEventListener("click", () => {
      if (selectedReplayIdx === i) {
        startReplay(rp);
      } else {
        selectedReplayIdx = i;
        renderReplaySlots();
      }
    });
    els.replaySlots.append(slot);
  });
}

function renderCharacters() {
  els.characterGrid.replaceChildren();
  CHARACTERS.forEach((c) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "card-tile";
    const unlocked = isCharacterUnlocked(c);
    const isActive = c.id === meta.selectedCharacter && unlocked;
    if (isActive) tile.classList.add("is-active");
    if (!unlocked) tile.classList.add("is-locked");
    const lockTag = !unlocked
      ? `<small class="lock-tag">🔒 解鎖：${ACHIEVEMENTS.find((a) => a.id === c.lockedBy)?.name || c.lockedBy}</small>`
      : "";
    tile.innerHTML = `<h3>${c.name}</h3>
      <small>${c.desc}</small>
      <small>HP ${c.hp}　速度 ${c.speed}　射速 ${c.fireRate.toFixed(2)}　傷害 ×${c.dmg}</small>
      ${lockTag}`;
    tile.addEventListener("click", () => {
      if (!unlocked) {
        spawnFloatingText(WORLD.width / 2, 80, "尚未解鎖", "#ff7777", 18);
        return;
      }
      meta.selectedCharacter = c.id;
      saveMeta();
      renderCharacters();
    });
    els.characterGrid.append(tile);
  });
}

function renderShop() {
  els.shopGrid.replaceChildren();
  els.shopCredits.textContent = meta.credits;
  SHOP.forEach((item) => {
    const lv = meta.shop[item.id] || 0;
    const isMax = lv >= item.max;
    const cost = isMax ? null : item.cost(lv);
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "card-tile";
    if (isMax) tile.classList.add("is-active");
    if (!isMax && cost > meta.credits) tile.classList.add("is-locked");
    tile.innerHTML = `<h3>${item.name}　Lv ${lv}/${item.max}</h3>
      <small>${item.desc}</small>
      ${isMax ? `<small>已滿級</small>` : `<span class="cost">${cost} 金幣</span>`}`;
    if (!isMax) {
      tile.addEventListener("click", () => {
        if (meta.credits < cost) return;
        meta.credits -= cost;
        meta.shop[item.id] = lv + 1;
        saveMeta();
        renderShop();
        els.credits.textContent = meta.credits;
      });
    }
    els.shopGrid.append(tile);
  });
}

function renderAchievements() {
  els.achList.replaceChildren();
  ACHIEVEMENTS.forEach((a) => {
    const got = !!meta.achievements[a.id];
    const row = document.createElement("div");
    row.className = "ach-row" + (got ? " is-unlocked" : "");
    row.innerHTML = `<div class="ach-icon">${got ? "✦" : "·"}</div>
      <div><strong>${a.name}</strong><small>${a.desc}</small></div>`;
    els.achList.append(row);
  });
}

// =====================================================================
//  Install + Service Worker
// =====================================================================

function registerInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    els.installBtn.hidden = false;
  });
  els.installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    els.installBtn.hidden = true;
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  }
}

// =====================================================================
//  Init
// =====================================================================

fitCanvas();
buildSprites();
seedStars();
setScene("menu");
els.soundBtn.textContent = audio.muted ? "音效 OFF" : "音效 ON";
registerInput();
registerInstallPrompt();
registerServiceWorker();
renderLeaderboard();
refreshMenuPanels();
showMessage(
  "READY",
  "10 條命，10 顆炸彈，直接升空",
  "選機體、買強化、開挑戰，擊落敵機掉武器（散彈／雷射／追蹤雷射）。",
  "開始戰鬥"
);
syncHud();
requestAnimationFrame(tick);
