#!/usr/bin/env node
/* ときの種：ドリルエンジンの自動検証（ゲーム本体とは別のテスト用コード）
   使い方：node tests/drill_engine_test.js   （オプション：問題数 例 node tests/drill_engine_test.js 5000）
   - index.html から <script id="drill-engine"> だけを取り出し、DOM のない隔離環境で実行する
   - 各タイプ N 問（既定1000問）を固定シードで生成し、次を機械検証する
       1) 正解が選択肢にちょうど1つだけ含まれる（選択肢の表示をこのファイルで独立に読み取って値で比較。
          2/4 と 1/2 のような表示違いの同じ値＝「偶然の正解」も検出する）
       2) 正解は、このファイルで独立に再計算した答えと一致する
       3) 選択肢に重複がない（値も表示も）
       4) 生成値（params）が仕様の範囲内である
     ほかに、選択肢が4つ・表示が壊れていない・正解の位置が均等に散っている・5問セットのタイプが重ならない、も確認する */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const N = Number(process.argv[2]) || 1000;
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/<script id="drill-engine">([\s\S]*?)<\/script>/);
if (!m) { console.error('drill-engine の <script> が見つかりません'); process.exit(1); }
const sandbox = {};                                   // window も document もない環境で実行する
vm.createContext(sandbox);
vm.runInContext(m[1], sandbox);
const D = sandbox.ClockseedDrill;
if (!D) { console.error('ClockseedDrill が公開されていません'); process.exit(1); }

// ---- 固定シードの乱数 ----
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---- 独立した再計算（エンジンとは別の書き方で、答えを「値」として作る） ----
// 値の表現：数は既約分数 'q:p/q'、時刻 't:時:分'、一次式 'e:係数,定数'、ことば 's:…'
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a; };
const R = (p, q = 1) => { if (q < 0) { p = -p; q = -q; } const k = gcd(p, q) || 1; return 'q:' + (p / k) + '/' + (q / k); };
const SHAPE_NAME = { 3: '三角形', 4: '四角形', 5: '五角形', 6: '六角形', 8: '八角形' };
const ANSWER = {
  A1: p => R(p.a + p.b),
  A2: p => R(p.a - p.b),
  A3: p => R(p.a * p.b),
  A4: p => R(p.n, p.d),
  A5: p => R(p.paid - p.price),
  A6: p => 't:' + p.h + ':' + p.m,
  A7: p => ({ 1: R(p.x * 100), 2: R(p.x * 100 + p.y), 3: R(p.x, 100), 4: R(p.x * 1000), 5: R(p.x * 1000 + p.y), 6: R(p.x, 1000) })[p.f],
  A8: p => (p.mode === 'count' ? R(p.n) : 's:' + SHAPE_NAME[p.n]),
  B1: p => R(p.a * p.d2 + p.b * p.d1, p.d1 * p.d2),
  B2: p => R(p.op === '+' ? p.x * 10 + p.y : p.op === '−' ? (p.x - p.y) * 10 : p.x * p.k * 10, 100),
  B3: p => R(p.mode === 'of' ? p.b * p.p : p.p * 100, 100),
  B4: p => (p.shape === 'rect' ? R(p.w * p.h) : R(p.b * p.h, 2)),
  B5: p => (p.mode === 'gcd' ? R(gcd(p.a, p.b)) : R(p.a * p.b, gcd(p.a, p.b))),
  B6: p => ({ '+': R(p.a + p.b), '−': R(p.a - p.b), '×': R(p.a * p.b), '÷': R(p.a, p.b) })[p.op],
  B7: p => { const [c, d] = p.f === 1 ? [p.a + p.c, p.b + p.d] : p.f === 2 ? [p.k * p.a, p.k * p.b] : [p.k * p.a + p.c, p.k * p.b]; return 'e:' + c + ',' + d; },
  B8: p => (p.f === 1 ? R(p.c - p.b, p.a) : R(p.d - p.b, p.a - p.c)),
};
// 選択肢の「表示」を独立に読み取って値にする（エンジンの key は使わない）。
// 2/4 と 1/2、0.50 と 0.5 のような表示違いの同じ値も、同じ値として扱える
const decimal = t => { const neg = t.startsWith('-'); if (neg) t = t.slice(1); const [i, f = ''] = t.split('.'); const q = 10 ** f.length; return R((neg ? -1 : 1) * (Number(i) * q + Number(f || 0)), q); };
function valueOf(label) {
  let t = label.replace(/−/g, '-').trim(), m;
  if (t.startsWith('x = ')) t = t.slice(4);
  if ((m = t.match(/^(\d+)時(?:(\d+)分)?$/))) return 't:' + Number(m[1]) + ':' + Number(m[2] || 0);
  if ((m = t.match(/^(-?\d*)x(?: ([+-]) (\d+))?$/))) {
    const c = m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(m[1]), d = m[2] ? (m[2] === '+' ? 1 : -1) * Number(m[3]) : 0;
    return 'e:' + c + ',' + d;
  }
  if ((m = t.match(/^(-?\d+)\/(\d+)$/))) return R(Number(m[1]), Number(m[2]));
  if ((m = t.match(/^(-?\d+(?:\.\d+)?)(cm²|cm|m|kg|g|円|本|%)?$/))) return decimal(m[1]);
  return 's:' + t;
}

// ---- 仕様の範囲（答えが「きれいな数」になる制限を含む） ----
const I = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const NZ = (v, lo, hi) => I(v, lo, hi) && v !== 0;
const RANGE = {
  A1: p => I(p.a, 10, 99) && I(p.b, 10, 99),
  A2: p => I(p.a, 20, 99) && I(p.b, 10, p.a - 1),                                     // 答えは1以上
  A3: p => (p.kuku ? I(p.a, 2, 9) : I(p.a, 11, 99)) && I(p.b, 2, 9),
  A4: p => I(p.d, 2, 9) && p.n % p.d === 0 && I(p.n / p.d, 2, 12),                     // あまりなし
  A5: p => [100, 500, 1000].includes(p.paid) && p.price % 10 === 0 && I(p.price, 10, p.paid - 10),
  A6: p => I(p.h, 1, 12) && p.m % 5 === 0 && I(p.m, 0, 55),
  A7: p => I(p.f, 1, 6) && ({
    1: () => I(p.x, 1, 9), 2: () => I(p.x, 1, 9) && p.y % 5 === 0 && I(p.y, 5, 95),
    3: () => p.x % 100 === 0 && I(p.x, 100, 900), 4: () => I(p.x, 1, 9),
    5: () => I(p.x, 1, 5) && p.y % 100 === 0 && I(p.y, 100, 900), 6: () => p.x % 1000 === 0 && I(p.x, 1000, 9000) })[p.f](),
  A8: p => [3, 4, 5, 6, 8].includes(p.n) && ['count', 'name'].includes(p.mode),
  B1: p => I(p.d1, 2, 12) && I(p.d2, 2, 12) && I(p.a, 1, p.d1 - 1) && I(p.b, 1, p.d2 - 1) &&
           p.a * p.d2 + p.b * p.d1 < p.d1 * p.d2 && (p.d1 * p.d2) / gcd(p.d1, p.d2) <= 24,     // 和は真分数・通分は簡単
  B2: p => (p.op === '+' ? I(p.x, 11, 99) && I(p.y, 101, 999)
          : p.op === '−' ? I(p.x, 21, 99) && I(p.y, 11, p.x - 1)
          : p.op === '×' ? I(p.x, 2, 49) && p.x % 10 !== 0 && I(p.k, 2, 9) : false),
  B3: p => [20, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500, 600, 800].includes(p.b) &&
           [10, 20, 25, 30, 40, 50, 60, 75, 80].includes(p.p) && (p.b * p.p) % 100 === 0,
  B4: p => (p.shape === 'rect' ? I(p.w, 2, 15) && I(p.h, 2, 15) : I(p.b, 2, 20) && I(p.h, 2, 16) && (p.b * p.h) % 2 === 0),
  B5: p => I(p.a, 2, 60) && I(p.b, 2, 60) && p.a !== p.b && I(gcd(p.a, p.b), 2, 9),
  B6: p => (p.a < 0 || p.b < 0) && Number(ANSWER.B6(p).slice(2)) !== 0 && (
    p.op === '+' || p.op === '−' ? NZ(p.a, -20, 20) && NZ(p.b, -20, 20)
    : p.op === '×' ? NZ(p.a, -12, 12) && NZ(p.b, -9, 9) && Math.abs(p.a) > 1 && Math.abs(p.b) > 1
    : p.op === '÷' ? NZ(p.b, -9, 9) && Math.abs(p.b) > 1 && p.a % p.b === 0 && NZ(p.a / p.b, -12, 12) : false),
  B7: p => (p.f === 1 ? [p.a, p.b, p.c, p.d].every(v => NZ(v, -9, 9)) && p.a + p.c !== 0
          : p.f === 2 ? NZ(p.k, -5, 5) && p.k !== 1 && NZ(p.a, -6, 6) && NZ(p.b, -9, 9)
          : p.f === 3 ? I(p.k, 2, 5) && NZ(p.a, -6, 6) && NZ(p.b, -9, 9) && NZ(p.c, -9, 9) && p.k * p.a + p.c !== 0 : false),
  B8: p => (p.f === 1 ? I(p.a, 2, 9) && NZ(p.b, -20, 20) && (p.c - p.b) % p.a === 0 && NZ((p.c - p.b) / p.a, -9, 9)
          : p.f === 2 ? I(p.a, 2, 9) && I(p.c, 1, 9) && p.a !== p.c && I(p.b, -15, 15) && (p.d - p.b) % (p.a - p.c) === 0 && NZ((p.d - p.b) / (p.a - p.c), -9, 9) : false),
};

// ---- 実行 ----
const typeIds = Object.keys(D.TYPES);
let allOk = true;
const rows = [];
typeIds.forEach((id, ti) => {
  const rng = mulberry32(20261127 + ti * 7919);
  const fail = { one: 0, recompute: 0, dup: 0, range: 0, shape: 0 };
  const posCount = [0, 0, 0, 0];
  let example = null;
  for (let n = 0; n < N; n++) {
    let pb;
    try { pb = D.generate(id, rng); } catch (e) { fail.shape++; if (!example) example = 'throw: ' + e.message; continue; }
    const ch = pb.choices, keys = ch.map(c => c.key), labels = ch.map(c => c.label);
    const want = ANSWER[id](pb.params), vals = labels.map(valueOf);
    const shapeOk = pb.type === id && Array.isArray(ch) && ch.length === 4 && Number.isInteger(pb.answer) && pb.answer >= 0 && pb.answer < 4 &&
      labels.every(l => typeof l === 'string' && l.length > 0 && !/NaN|undefined|Infinity|null/.test(l)) && typeof pb.prompt === 'string' && pb.prompt.length > 0;
    if (!shapeOk) fail.shape++;
    if (vals.filter(v => v === want).length !== 1) fail.one++;               // 正解（の値）がちょうど1つ
    if (vals[pb.answer] !== want) fail.recompute++;                          // 正解の位置の選択肢が、再計算した答えと一致
    if (new Set(vals).size !== 4 || new Set(labels).size !== 4 || new Set(keys).size !== 4) fail.dup++;   // 値・表示とも重複なし
    if (!RANGE[id](pb.params)) fail.range++;                                 // 範囲内
    posCount[pb.answer]++;
    if (!example && (fail.one || fail.recompute || fail.dup || fail.range || fail.shape)) example = JSON.stringify(pb);
  }
  const spread = Math.min(...posCount) >= N * 0.25 * 0.8 && Math.max(...posCount) <= N * 0.25 * 1.2;   // 各位置 25%±20%
  const ok = !fail.one && !fail.recompute && !fail.dup && !fail.range && !fail.shape && spread;
  if (!ok) allOk = false;
  rows.push({ id, name: D.TYPES[id].name, n: N, ...fail, pos: posCount.join('/'), spread, ok, example });
});

// 5問セット：同じタイプが重ならない
let setOk = true;
for (const L of ['A', 'B']) {
  const rng = mulberry32(42 + L.charCodeAt(0));
  for (let k = 0; k < 500; k++) {
    const set = D.makeSet(L, rng, 5), types = set.map(p => p.type);
    if (set.length !== 5 || new Set(types).size !== 5 || types.some(t => D.TYPES[t].level !== L)) setOk = false;
  }
}
if (!setOk) allOk = false;

console.log('ドリルエンジン自動検証：' + typeIds.length + '種 × ' + N + '問（固定シード）');
console.log('タイプ | 名前 | 正解1つ違反 | 再計算不一致 | 重複 | 範囲外 | 形式 | 正解位置(0/1/2/3) | 判定');
for (const r of rows) {
  console.log([r.id, r.name, r.one, r.recompute, r.dup, r.range, r.shape, r.pos, r.ok ? '合格' : '不合格'].join(' | '));
  if (!r.ok && r.example) console.log('   例: ' + r.example);
}
console.log('5問セット（A・B 各500セット）：タイプの重複なし ' + (setOk ? '合格' : '不合格'));
console.log(allOk ? '=> 全て合格' : '=> 不合格あり');
process.exit(allOk ? 0 : 1);
