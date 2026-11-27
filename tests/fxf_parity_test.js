#!/usr/bin/env node
/* ときの種：FACTOR×FACTOR 移植版と本家の突き合わせ（本家のコードそのものを動かして比べる）
   使い方：node tests/fxf_parity_test.js [本家の index.html のパス]
     既定のパスは clockseed の外の参照用 clone（../asumax1128/factorfactor/index.html）。環境変数 FXF_REF でも指定できる。
     見つからないときは「参照なし」として何もせず終了する（clockseed には本家のコードを含めない）。
   本家 index.html から、ソロ・イージーに関わる素の JavaScript 関数・定数だけを文字列で取り出して隔離環境で実行し、
     1) 定数：イージーの設定（15問・6枚）・ミス−20%・時間切れの追加0・20秒・判定6段階（時間・回復）・Lv1〜5の基本点
     2) 出題レベル：1〜15問目の pickLevelForQuestion と移植版 levelFor
     3) 出題の範囲：Lv1〜5 それぞれ 本家と移植版で20万回ずつ生成し、出てくる「正解の因数の組」の集合が完全に同じ
     4) 盤面の誤答：Lv1〜5 それぞれ 本家 buildBoard と移植版で2万盤面ずつ作り、誤答タイルの種類の集合・枚数が同じ
   を確かめる。本家のファイルは読むだけで、変更しない。 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { loadFxf } = require('./fxf_engine_test.js');
const REF = process.argv[2] || process.env.FXF_REF || path.join(__dirname, '..', '..', 'asumax1128', 'factorfactor', 'index.html');
if (!fs.existsSync(REF)) { console.log('本家の参照 clone が見つからないため省略：' + REF); process.exit(0); }
const src = fs.readFileSync(REF, 'utf8');
function grab(name) {                                     // function name(...) { ... } または const NAME = ...; を取り出す
  let i = src.indexOf('\nfunction ' + name + '(');
  if (i >= 0) { let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i + 1, k + 1); } } }
  i = src.indexOf('\nconst ' + name + ' =');
  if (i >= 0) { let d = 0, k = i + 1; for (; k < src.length; k++) { const c = src[k]; if ('{[('.includes(c)) d++; else if ('}])'.includes(c)) d--; else if (c === ';' && d === 0) break; } return src.slice(i + 1, k + 1); }
  throw new Error('本家に見つからない: ' + name);
}
const NAMES = ['gcd', 'randInt', 'randSign', 'randNonZero', 'coprime', 'factorKey', 'toCoeffs', 'multiply', 'polyEqual',
  'genL1', 'genL2', 'genL3', 'genL4', 'genL5', 'genL6', 'genL7', 'genL8', 'genL9', 'GENERATORS', 'LEVEL_POINTS', 'FIXED_PHASE_LAST_Q', 'pickLevelForQuestion',
  'DIFFICULTY_CONFIG', 'flipSign', 'shiftConst', 'foreignFactor', 'genDummies', 'buildBoard', 'QUESTION_TIMEOUT_MS', 'JUDGE_TIERS', 'DIFFICULTY_MISS_PENALTY', 'DIFFICULTY_TIMEOUT_EXTRA'];
// pickLevelForQuestion は28問目以降で使う定数・関数も参照するので一緒に取り出す（イージーでは通らない）
const EXTRA = ['RANDOM_PHASE_FIRST_Q', 'INITIAL_WEIGHTS', 'WEIGHT_DELTA', 'FINAL_STEP', 'FINAL_FIXED_WEIGHTS', 'getLevelWeights', 'LEVEL_IDS'];
const code = NAMES.concat(EXTRA).map(grab).join('\n') + '\n;globalThis.ORIG = { GENERATORS, LEVEL_POINTS, pickLevelForQuestion, DIFFICULTY_CONFIG, buildBoard, factorKey, multiply, polyEqual, QUESTION_TIMEOUT_MS, JUDGE_TIERS, DIFFICULTY_MISS_PENALTY, DIFFICULTY_TIMEOUT_EXTRA };';
function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rngO = mulberry32(2026), sb = { Math: Object.assign(Object.create(Math), { random: rngO }), Date };
vm.createContext(sb); vm.runInContext(code, sb);
const O = sb.ORIG, F = loadFxf(), refHead = (() => { try { return require('child_process').execSync('git -C "' + path.dirname(REF) + '" rev-parse HEAD').toString().trim(); } catch (e) { return '不明'; } })();
let allOk = true; const out = (name, ok, extra) => { if (!ok) allOk = false; console.log((ok ? '一致 ' : '不一致 ') + name + (extra ? '　' + extra : '')); };
console.log('本家との突き合わせ：' + REF + '（HEAD ' + refHead + '）／移植版の参照 ' + F.SOURCE);
// 1) 定数
const E = O.DIFFICULTY_CONFIG.easy;
out('イージーの問題数・タイル枚数', E.clearCount === F.CONFIG.clearCount && E.tileCount === F.CONFIG.tileCount, E.clearCount + '問・' + E.tileCount + '枚');
out('ミスの体力減少・時間切れの追加減少・1問の制限時間', O.DIFFICULTY_MISS_PENALTY.easy === F.CONFIG.missPenalty && O.DIFFICULTY_TIMEOUT_EXTRA.easy === F.CONFIG.timeoutExtra && O.QUESTION_TIMEOUT_MS === F.CONFIG.timeoutMs,
  '−' + O.DIFFICULTY_MISS_PENALTY.easy + '%・+' + O.DIFFICULTY_TIMEOUT_EXTRA.easy + '%・' + O.QUESTION_TIMEOUT_MS / 1000 + '秒');
out('判定の6段階（時間の境目・回復量・名前）', JSON.stringify(O.JUDGE_TIERS.map(t => [t.max, t.label, t.recover])) === JSON.stringify(F.JUDGE_TIERS.map(t => [t.max, t.label, t.recover])),
  O.JUDGE_TIERS.map(t => t.label + '≤' + t.max / 1000 + '秒+' + t.recover).join(' '));
out('Lv1〜5の基本点', [1, 2, 3, 4, 5].every(l => O.LEVEL_POINTS[l] === F.LEVEL_POINTS[l]), [1, 2, 3, 4, 5].map(l => O.LEVEL_POINTS[l]).join('・'));
// 2) 出題レベル
const lo = Array.from({ length: 15 }, (_, i) => O.pickLevelForQuestion(i + 1)).join(','), lp = Array.from({ length: 15 }, (_, i) => F.levelFor(i + 1)).join(',');
out('1〜15問目のレベル', lo === lp, lo);
// 3) 出題の範囲（正解の因数の組の集合）
const sig = r => r.factors.map(O.factorKey).join('|');
for (let lv = 1; lv <= 5; lv++) {
  const A = new Set(), B = new Set(), rngP = mulberry32(900 + lv);
  for (let k = 0; k < 200000; k++) { A.add(sig(O.GENERATORS[lv]())); B.add(sig(F.GEN[lv](rngP))); }
  const onlyO = [...A].filter(x => !B.has(x)), onlyP = [...B].filter(x => !A.has(x));
  out('Lv' + lv + ' の出題（正解の因数の組）', !onlyO.length && !onlyP.length, '本家 ' + A.size + '通り／移植版 ' + B.size + '通り' + (onlyO.length + onlyP.length ? '／差 ' + onlyO.slice(0, 3).concat(onlyP.slice(0, 3)).join(' ') : ''));
}
// 4) 盤面の誤答タイル（種類の集合と1盤面の枚数）
for (let lv = 1; lv <= 5; lv++) {
  const A = new Set(), B = new Set(), rngP = mulberry32(700 + lv); let nA = 0, nB = 0, mA = 0, mB = 0;
  for (let k = 0; k < 20000; k++) {
    const bo = O.buildBoard(lv, null, 6), bp = F.buildBoard(lv, null, 6, rngP);
    const co = new Set(bo.factors.map(O.factorKey)), cp = new Set(bp.factors.map(F.factorKey));
    bo.tiles.forEach(t => { if (!co.has(O.factorKey(t.factor))) A.add(O.factorKey(t.factor)); }); bp.tiles.forEach(t => { if (!cp.has(F.factorKey(t.factor))) B.add(F.factorKey(t.factor)); });
    nA += bo.tiles.length; nB += bp.tiles.length;
    const cnt = (b, mul, eq) => { let c = 0; for (let i = 0; i < b.tiles.length; i++) for (let j = i + 1; j < b.tiles.length; j++) if (eq(mul(b.tiles[i].factor, b.tiles[j].factor), b.poly)) c++; return c; };
    if (cnt(bo, O.multiply, O.polyEqual) !== 1) mA++; if (cnt(bp, F.multiply, F.polyEqual) !== 1) mB++;
  }
  const onlyO = [...A].filter(x => !B.has(x)), onlyP = [...B].filter(x => !A.has(x)), rate = Math.min(A.size, B.size) / Math.max(A.size, B.size);
  out('Lv' + lv + ' の盤面（誤答タイルの種類・枚数・正しい組がちょうど1組）', nA === nB && rate > 0.97 && onlyP.filter(x => !A.has(x)).length <= Math.ceil(B.size * 0.03) && mA === mB,
    '本家 ' + A.size + '種／移植版 ' + B.size + '種（共通 ' + [...A].filter(x => B.has(x)).length + '）・1盤面 ' + (nA / 20000) + '枚／' + (nB / 20000) + '枚・1組でない盤面 ' + mA + '／' + mB);
}
console.log(allOk ? '=> 本家と一致' : '=> 不一致あり');
process.exit(allOk ? 0 : 1);
