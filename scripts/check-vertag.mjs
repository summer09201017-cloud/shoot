// scripts/check-vertag.mjs —— 守「版本號與改版簡歷」不漂(艦隊鐵則⑦;2026-09-15 立,抄 joshua-land 的守法)
//
// 由來:index.html 選單底的 verTag 是**靜態**的,而 sw.js 的 CACHE_NAME 每次改版都會 bump;
//   忘了一起改,站上跑 v20、簡歷停在 v19,沒有任何東西會紅。這支就是那個「人」。
//   只守機器驗得出來的事:①summary 與 verTag 第一行的 vN == sw CACHE_NAME ②前幾版從 vN-1 一路到 v7 不跳號(v7 = 首發時 SW 的起始版號)
//   ③verTag 帶日期 ④徽章三件套(容器 / 問 SW / sw 回答)。用法:node scripts/check-vertag.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, n, detail) => { if (c) pass++; else { fail++; console.error('  ✗ ' + n + (detail ? ' — ' + detail : '')); } };

const swV = (sw.match(/CACHE_NAME\s*=\s*"thunder-force-pwa-v(\d+)"/) || [])[1];
ok(!!swV, 'sw.js 抽得出 CACHE_NAME 版號', 'v' + swV);

const tag = (html.match(/id="verTag"[^>]*>([\s\S]*?)<\/p>/) || [])[1] || '';
ok(tag.length > 0, 'index.html 有 #verTag');
const tagV = (tag.match(/版本 v(\d+)/) || [])[1];
ok(tagV === swV, '★ verTag 版號 == sw.js CACHE_NAME(改版忘了更新這行 ⇒ 這條紅)', 'verTag v' + tagV + ' vs sw v' + swV);
ok(/版本 v\d+[(（]\d{4}-\d{2}-\d{2}[)）]/.test(tag), 'verTag 帶日期(家長/老師要看得出多新)');
const summary = (html.match(/<details class="ver-fold"[^>]*>\s*<summary>([^<]*)<\/summary>/) || [])[1] || '';
ok(new RegExp('版本 v' + swV + '\\b').test(summary), '摺疊列標題也寫本版版號', summary);

const after = tag.split(/前幾版[:：]/)[1] || '';
const prev = [...after.matchAll(/(?:^|[・\s])v(\d+)\s/g)].map((m) => Number(m[1]));
ok(prev.length > 0, '有列「前幾版」', prev.join(','));
const want = [];
for (let v = Number(swV) - 1; v >= 7; v--) want.push(v);
ok(JSON.stringify(prev) === JSON.stringify(want), '★ 前幾版 vN-1 → v7 不跳號不缺(跳號 = 有一版沒寫進來)', prev.join(',') + ' 預期 ' + want.join(','));

ok(/id="appVerBadge"/.test(html), '徽章容器 #appVerBadge 在');
ok(/GET_VERSION/.test(html) && /SW_VERSION/.test(html), '徽章有問 SW 拿版本(頁面不寫死版號)');
ok(/GET_VERSION/.test(sw) && /SW_VERSION/.test(sw), 'sw.js 有回答 GET_VERSION');
ok(/id="verFold"/.test(html) && /getElementById\('verFold'\)/.test(html), '徽章點了會開 #verFold 簡歷(v19 使用者「打不開」的修法)');

console.log(`check-vertag: ${pass} 綠 / ${fail} 紅`);
if (fail) process.exit(1);
