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
     ほかに、選択肢が4つ・表示が壊れていない・正解の位置が均等に散っている・5問セットの構成（通常3＋復習1＋挑戦1）も確認する
   - C〜E（24種）は、選択肢の表示（根号・分数・組・集合・不等式・複素数・角度・π・円・漸近線）をこのファイルで数値に読み取り、
     問題文や params からこのファイルの別の計算で答えを出して比べる（数値は小数第6位で丸めて比較）
   - 特殊ドリル（S1〜S3）は、式の選択肢を独立に構文解析して有理数で計算し、全て計算でき・4つの数をちょうど1回ずつ使い・
     正解だけが10になることを確かめる
   - module.exports で検査関数を公開する（tests/drill_mutation_test.js の壊しテストが使う） */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const N = Number(process.argv[2]) || 1000;
function loadEngine(file) {                           // window も document もない環境で実行する
  const html = fs.readFileSync(file || path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/<script id="drill-engine">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('drill-engine の <script> が見つかりません');
  const sandbox = {}; vm.createContext(sandbox); vm.runInContext(m[1], sandbox);
  if (!sandbox.ClockseedDrill) throw new Error('ClockseedDrill が公開されていません');
  return sandbox.ClockseedDrill;
}

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

// ======================= C〜E・特殊ドリル =======================
// 数値は小数第6位で丸めた文字列にして比べる（√・π を含む値も、表示が違う同じ値は同じ文字列になる）
const r6 = v => { const x = Math.round(v * 1e6) / 1e6; return String(x === 0 ? 0 : x); };
// 根号・π・分数・小数の表示を、このファイルで数値に読み取る（式として書き直してから計算する）
function num(t) {
  t = t.replace(/−/g, '-').replace(/通り$/, '').trim();
  if (!/^[-0-9+√π/(). ]+$/.test(t)) return NaN;
  const js = t.replace(/(\d*)√(\d+)/g, (_, c, n) => (c ? c + '*' : '') + 'Math.sqrt(' + n + ')').replace(/(\d*)π/g, (_, c) => (c ? c + '*' : '') + 'Math.PI');
  try { const v = Function('"use strict";return (' + js + ')')(); return typeof v === 'number' ? v : NaN; } catch (e) { return NaN; }
}
// x の多項式（2x² − 3x + 1、y = …、n の式も）を係数の配列 {次数: 係数} に読む
function parsePoly(str, vr = 'x') {
  const t = str.replace(/−/g, '-').replace(/\s+/g, ''), out = {}, re = new RegExp('([+-]?)(\\d*)(' + vr + '([²³⁴]?))?', 'g');
  const E = { '': 1, '²': 2, '³': 3, '⁴': 4 }; let m, any = false;
  while ((m = re.exec(t)) && m[0] !== '') {
    any = true; const sg = m[1] === '-' ? -1 : 1, hasV = !!m[3], c = m[2] === '' ? (hasV ? 1 : NaN) : Number(m[2]), e = hasV ? E[m[4]] : 0;
    out[e] = (out[e] || 0) + sg * c;
  }
  return any ? out : null;
}
const pc = (P, e) => (P && P[e]) || 0;
function val2(label, id) {
  let t = label.replace(/−/g, '-').trim(), m;
  if (id === 'E4') {                                               // 複素数 a + bi
    if (!/i$/.test(t)) return 'c:' + r6(num(t)) + ',0';
    m = t.match(/^(?:(-?\d+) ([+-]) )?(-?)(\d*)i$/); if (!m) return 'bad:' + t;
    const re = m[1] ? Number(m[1]) : 0, im = (m[2] === '-' ? -1 : 1) * (m[3] === '-' ? -1 : 1) * (m[4] === '' ? 1 : Number(m[4]));
    return 'c:' + r6(re) + ',' + r6(im);
  }
  if (id === 'S1') {                                               // (x + p)(x + q) → 展開した係数
    m = t.match(/^\(x ([+-]) (\d+)\)(?:\(x ([+-]) (\d+)\)|²)$/); if (!m) return 'bad:' + t;
    const p = (m[1] === '-' ? -1 : 1) * Number(m[2]), q = m[3] ? (m[3] === '-' ? -1 : 1) * Number(m[4]) : p;
    return 'P:' + (p + q) + ',' + p * q;
  }
  if (id === 'S2') { const v = evalExpr(t); return v ? 'q:' + v[0] + '/' + v[1] : 'bad:' + t; }
  if (id === 'S3') { const a = t.split('・').map(Number); return a.every(x => Number.isInteger(x) && x >= 1 && x <= 9) ? 'g:' + a.reduce((s, x) => s + x, 0) : 'bad:' + t; }
  if (t === '∞') return 'inf';
  if ((m = t.match(/^中心\((.+), (.+)\)、半径 (.+)$/))) return 'C:' + r6(num(m[1])) + ',' + r6(num(m[2])) + ',' + r6(num(m[3]));
  if ((m = t.match(/^y = ±(.*)x$/))) return 'A:' + r6(m[1] === '' ? 1 : num(m[1]));
  if ((m = t.match(/^x = (.+), (.+)$/))) return 's:' + [num(m[1]), num(m[2])].sort((a, b) => a - b).map(r6).join(',');
  if ((m = t.match(/^x ([<>≤≥]) (\S+)$/))) return 'I:' + m[1] + ':' + r6(num(m[2]));
  if ((m = t.match(/^(\S+) < x < (\S+)$/))) return 'B:' + r6(num(m[1])) + ',' + r6(num(m[2]));
  if ((m = t.match(/^x < (\S+), (\S+) < x$/))) return 'O:' + r6(num(m[1])) + ',' + r6(num(m[2]));
  if ((m = t.match(/^\(±(.+), 0\)$/))) return 'pm:x:' + r6(num(m[1]));
  if ((m = t.match(/^\(0, ±(.+)\)$/))) return 'pm:y:' + r6(num(m[1]));
  if ((m = t.match(/^\(([^()]+)\)$/)) && m[1].includes(', ')) return 'p:' + m[1].split(', ').map(x => r6(num(x))).join(',');
  if ((m = t.match(/^(\d+)°$/))) return 'deg:' + Number(m[1]);
  if (t.includes('π')) return 'r:' + r6(num(t) / Math.PI);
  return 'n:' + r6(num(t));
}
// 特殊ドリルの式：かっこと優先順位を自前で解釈して有理数で計算（0で割ると null）。使った数も集める
function evalExpr(str, used) {
  const tk = str.replace(/−/g, '-').match(/\d+|[-+×÷()]/g), g = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
  if (!tk || tk.join('') !== str.replace(/−/g, '-').replace(/\s+/g, '')) return null;
  const nr = (p, q) => { if (q === 0) return null; if (q < 0) { p = -p; q = -q; } const k = g(p, q) || 1; return [p / k, q / k]; };
  let i = 0;
  const prim = () => { const x = tk[i++]; if (x === '(') { const v = sum(); if (tk[i++] !== ')') throw 0; return v; } if (!/^\d+$/.test(x)) throw 0; if (used) used.push(Number(x)); return [Number(x), 1]; };
  const prod = () => { let a = prim(); while (tk[i] === '×' || tk[i] === '÷') { const op = tk[i++], b = prim(); if (!a || !b) return null; a = op === '×' ? nr(a[0] * b[0], a[1] * b[1]) : (b[0] === 0 ? null : nr(a[0] * b[1], a[1] * b[0])); if (!a) throw 1; } return a; };
  const sum = () => { let a = prod(); while (tk[i] === '+' || tk[i] === '-') { const op = tk[i++], b = prod(); a = nr(a[0] * b[1] + (op === '+' ? 1 : -1) * b[0] * a[1], a[1] * b[1]); } return a; };
  try { const v = sum(); return i === tk.length ? v : null; } catch (e) { return null; }
}
// 独立した再計算（問題文やparamsから、エンジンとは別の手順で）
const fac = n => { let r = 1; for (let k = 2; k <= n; k++) r *= k; return r; };
const DEGF = { sin: Math.sin, cos: Math.cos, tan: Math.tan };
const polyEval = (cs, x) => cs.reduce((a, c) => a * x + c, 0);          // 係数（高次から）
const pmul = (a, b) => { const o = Array(a.length + b.length - 1).fill(0); a.forEach((x, i) => b.forEach((y, j) => { o[i + j] += x * y; })); return o; };
const pder = cs => cs.slice(0, -1).map((c, i) => c * (cs.length - 1 - i));
const ppow = (cs, n) => { let o = [1]; for (let k = 0; k < n; k++) o = pmul(o, cs); return o; };
function holds(op, l, r) { return op === '>' ? l > r : op === '<' ? l < r : op === '≥' ? l >= r : l <= r; }
function solveSet(test) {                                         // 1次の不等式の解：-30〜30 を 0.5 刻みで調べ、境目と向きを読む（表示と同じ形へ）
  const xs = []; for (let x = -30; x <= 30; x += 0.5) xs.push([x, test(x)]);
  const ins = xs.filter(([, ok]) => ok).map(([x]) => x);
  if (!ins.length || ins.length === xs.length) return 'none';
  const lo = ins[0], hi = ins[ins.length - 1], contiguous = ins.length === Math.round((hi - lo) / 0.5) + 1;
  if (contiguous && lo === -30) { const b = test(hi) && !test(hi + 0.5) ? hi : hi; return 'I:' + (test(hi) && !test(hi + 1e-9) && Number.isInteger(hi) ? '≤' : '<') + ':' + r6(Number.isInteger(hi) ? hi : hi + 0.5); }
  if (contiguous && hi === 30) return 'I:' + (Number.isInteger(lo) && test(lo) && !test(lo - 1e-9) ? '≥' : '>') + ':' + r6(Number.isInteger(lo) ? lo : lo - 0.5);
  if (contiguous) return 'B:' + r6(lo - 0.5) + ',' + r6(hi + 0.5);
  const out = xs.filter(([, ok]) => !ok).map(([x]) => x); return 'O:' + r6(out[0]) + ',' + r6(out[out.length - 1]);   // 解の外側＝閉区間 [lo, hi]
}
const ANSWER2 = {
  C1: (p, pb) => {
    if (p.f === 'expand') return 'n:' + r6(p.a * p.d + p.b * p.c);
    const m = pb.prompt.replace(/−/g, '-').match(/^(.+) = \((\d*)x ([+-]) (\d+)\)\((\d*)x \+ □\)/), P = parsePoly(m[1]);
    const pp = m[2] === '' ? 1 : +m[2], q = (m[3] === '-' ? -1 : 1) * +m[4], r = m[5] === '' ? 1 : +m[5], s = pc(P, 0) / q;
    return pc(P, 2) === pp * r && pc(P, 1) === pp * s + q * r ? 'n:' + r6(s) : 'inconsistent';
  },
  C2: (p, pb) => { const P = parsePoly(pb.prompt.split(' = 0')[0]), A = pc(P, 2), B = pc(P, 1), C = pc(P, 0), D = Math.sqrt(B * B - 4 * A * C);
    return 's:' + [(-B - D) / (2 * A), (-B + D) / (2 * A)].sort((a, b) => a - b).map(r6).join(','); },
  C3: (p, pb) => { const P = parsePoly(pb.prompt.match(/^y = ([^（の]+)/)[1]), f = x => pc(P, 2) * x * x + pc(P, 1) * x + pc(P, 0), vx = -pc(P, 1) / (2 * pc(P, 2));
    if (p.f === 'ext') return 'n:' + r6(f(vx));
    const m = pb.prompt.replace(/−/g, '-').match(/（(-?\d+) ≤ x ≤ (-?\d+)）/), s = +m[1], t = +m[2];
    return 'n:' + r6(Math.max(f(s), f(t), vx >= s && vx <= t ? f(vx) : -Infinity)); },
  C4: p => 'n:' + r6(DEGF[p.fn](p.th * Math.PI / 180)),
  C5: p => { let v; if (p.f === 'perm') { v = 1; for (let k = 0; k < p.r; k++) v *= p.n - k; } else if (p.f === 'comb') v = fac(p.n) / fac(p.r) / fac(p.n - p.r); else v = fac(p.n); return 'n:' + v; },
  C6: p => {                                                       // すべての場合を数え上げる
    let ok = 0, all = 0;
    if (p.f === 'dice') for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) { all++; if (a + b === p.s) ok++; }
    if (p.f === 'die') for (let a = 1; a <= 6; a++) { all++; if (a >= p.k) ok++; }
    if (p.f === 'coin') for (let mask = 0; mask < 2 ** p.n; mask++) { all++; let h = 0; for (let k = 0; k < p.n; k++) if (mask >> k & 1) h++;
      if ((p.m === 'all' && h === p.n) || (p.m === 'least' && h >= 1) || (p.m === 'one' && h === 1)) ok++; }
    if (p.f === 'lot') for (let a = 0; a < p.n; a++) for (let b = 0; b < p.n; b++) { if (a === b) continue; all++; if (a < p.w && b < p.w) ok++; }
    return 'n:' + r6(ok / all);
  },
  C7: p => { const d = p.d.slice().sort((a, b) => a - b), n = d.length;
    return 'n:' + r6(p.f === 'mean' ? d.reduce((a, b) => a + b, 0) / n : n % 2 ? d[(n - 1) / 2] : (d[n / 2 - 1] + d[n / 2]) / 2); },
  C8: p => {
    if (p.f === 'lin') { const op = { gt: '>', lt: '<', ge: '≥', le: '≤' }[p.op]; return solveSet(x => holds(op, p.a * x + p.b, p.c * x + p.d)); }
    return solveSet(x => (p.f === 'lt' ? Math.abs(x - p.p) < p.r : Math.abs(x - p.p) > p.r));
  },
  D1: p => 'n:' + r6(p.f === 'law' ? Math.pow(p.a, p.m) * Math.pow(p.a, p.n) / Math.pow(p.a, p.k) : Math.pow(Math.pow(p.b, p.q), p.p / p.q)),
  D2: p => { const L = (b, x) => Math.log(x) / Math.log(b);
    return 'n:' + r6(p.f === 'basic' ? L(p.b, Math.pow(p.b, p.k)) : p.f === 'sum' ? L(p.b, p.M) + L(p.b, p.N) : p.f === 'diff' ? L(p.b, p.M) - L(p.b, p.N) : L(p.b ** p.u, p.b ** p.v)); },
  D3: p => { if (p.f === 'add') return 'n:' + r6(DEGF[p.fn](p.th * Math.PI / 180)); const th = Math.asin(p.y / p.h); return 'n:' + r6(DEGF[p.fn](2 * th)); },
  D4: p => { const cs = [p.a, p.b, p.c, p.d], d = pder(cs); return 'n:' + r6(p.f === 'val' ? polyEval(d, p.k) : d[d.length - 1 - p.e]); },
  D5: p => { let t = p.a, s = 0, last = 0; for (let k = 1; k <= p.n; k++) { s += t; last = t; t = p.f[0] === 'a' ? t + p.d : t * p.r; } return 'n:' + r6(p.f[1] === 'n' ? last : s); },
  D6: p => { if (p.f === 'lin') return 'p:' + r6(p.p * p.a1 + p.q * p.b1) + ',' + r6(p.p * p.a2 + p.q * p.b2); return 'n:' + r6(Math.hypot(p.a1 + p.sg * p.b1, p.a2 + p.sg * p.b2)); },
  D7: p => 'n:' + r6(Math.hypot(p.x2 - p.x1, p.y2 - p.y1)),
  D8: (p, pb) => {                                                 // 問題文の式を平方完成
    const t = pb.prompt.replace(/−/g, '-').replace(/ = 0.*$/, '').replace(/\s+/g, ''), co = { x: 0, y: 0, c: 0 };
    for (const m of t.replace(/^x²\+y²/, '').matchAll(/([+-])(\d+)([xy]?)/g)) co[m[3] || 'c'] += (m[1] === '-' ? -1 : 1) * Number(m[2]);
    const cx = -co.x / 2, cy = -co.y / 2; return 'C:' + r6(cx) + ',' + r6(cy) + ',' + r6(Math.sqrt(cx * cx + cy * cy - co.c));
  },
  E1: p => {
    if (p.f === 'seq') { const num_ = p.g === 'low' ? [p.a, p.c] : [p.a, p.b, p.c], den = p.g === 'high' ? [p.d, p.h] : [p.d, p.e, p.h];
      return num_.length > den.length ? 'inf' : num_.length < den.length ? 'n:0' : 'n:' + r6(num_[0] / den[0]); }
    if (p.f === 'fn') { const cs = [1, -(p.p + p.s), p.p * p.s], q = [cs[0], cs[1] + cs[0] * p.p];   // 組立除法で (x − p) を割る
      return Math.abs(polyEval(cs, p.p)) < 1e-12 ? 'n:' + r6(polyEval(q, p.p)) : 'bad'; }
    return 'n:' + r6(p.k / p.m);
  },
  E2: p => {
    if (p.f === 'prod') return 'n:' + r6(polyEval(pder(pmul([p.a, p.b], [p.c, 0, p.d])), p.k));
    if (p.f === 'quot') { const N_ = [p.a, p.b], D_ = [p.c, p.d], top = polyEval(pder(N_), p.k) * polyEval(D_, p.k) - polyEval(N_, p.k) * polyEval(pder(D_), p.k);
      return 'n:' + r6(top / polyEval(D_, p.k) ** 2); }
    return 'n:' + r6(polyEval(pder(ppow([p.a, p.b], p.n)), p.k));
  },
  E3: p => { const f = x => p.a * x * x + p.b * x + p.c, h = p.t - p.s; return 'n:' + r6(h / 6 * (f(p.s) + 4 * f((p.s + p.t) / 2) + f(p.t))); },   // シンプソン公式（2次以下で厳密）
  E4: p => { if (p.f === 'mul') return 'c:' + r6(p.a * p.c - p.b * p.d) + ',' + r6(p.a * p.d + p.b * p.c);
    if (p.f === 'conj') return 'c:' + r6(p.a * p.a + p.b * p.b) + ',0';
    const ur = p.p * p.c - p.q * p.d, ui = p.p * p.d + p.q * p.c, n2 = p.c * p.c + p.d * p.d;        // (ur+ui i)(c − d i)/(c²+d²)
    return 'c:' + r6((ur * p.c + ui * p.d) / n2) + ',' + r6((ui * p.c - ur * p.d) / n2); },
  E5: p => { if (p.f === 'dot') return 'n:' + r6(p.a.reduce((s, x, i) => s + x * p.b[i], 0));
    const bl = p.n * Math.sqrt(p.kind); return 'deg:' + Math.round(Math.acos(p.dot / (p.m * bl)) * 180 / Math.PI); },
  E6: p => { const d = p.B.map((x, i) => x - p.A[i]); return p.f === 'comp' ? 'p:' + d.map(r6).join(',') : 'n:' + r6(Math.hypot(...d)); },
  E7: (p, pb) => {                                                 // 問題文の z = a + bi を読み取って偏角・絶対値を計算
    const t = pb.prompt.match(/^z = (.+) の/)[1].replace(/−/g, '-'), m = t.match(/^(.*?)(?:\s([+-])\s)?([^\s]*)i$/);
    let re, im; if (!/i$/.test(t)) { re = num(t); im = 0; }
    else if (!m[2]) { re = 0; const b = m[3] === '' ? 1 : m[3] === '-' ? -1 : num(m[3]); im = m[1] ? num(m[1] + m[3]) : b; if (m[1]) { re = 0; } }
    else { re = num(m[1]); im = (m[2] === '-' ? -1 : 1) * (m[3] === '' ? 1 : num(m[3])); }
    if (p.f === 'abs') return 'n:' + r6(Math.hypot(re, im));
    let a = Math.atan2(im, re); if (a < 0) a += 2 * Math.PI; return 'r:' + r6(a / Math.PI);
  },
  E8: (p, pb) => { const t = pb.prompt.replace(/−/g, '-');
    if (p.f === 'para') { const m = t.match(/(x|y)² = (-?\d*)(x|y)/), c = m[2] === '' ? 1 : m[2] === '-' ? -1 : +m[2]; return m[1] === 'y' ? 'p:' + r6(c / 4) + ',0' : 'p:0,' + r6(c / 4); }
    const m = t.match(/x²(?:\/(\d+))? - y²(?:\/(\d+))? = 1/), A2 = m[1] ? +m[1] : 1, B2 = m[2] ? +m[2] : 1;
    return p.f === 'asym' ? 'A:' + r6(Math.sqrt(B2 / A2)) : 'pm:x:' + r6(Math.sqrt(A2 + B2)); },
  S1: (p, pb) => { const P = parsePoly(pb.prompt.split(' を')[0]); return 'P:' + pc(P, 1) + ',' + pc(P, 0); },
  S2: () => 'q:10/1',
  S3: () => 'g:10',
};
const RANGE2 = {
  C1: p => (p.f === 'expand' ? [p.a, p.c].every(v => I(v, 1, 4)) && [p.b, p.d].every(v => NZ(v, -6, 6)) && p.a * p.d + p.b * p.c !== 0
         : [p.p, p.r].every(v => I(v, 1, 3)) && [p.q, p.s].every(v => NZ(v, -5, 5))),
  C2: p => (p.f === 'int' ? [1, 2].includes(p.a) && NZ(p.r1, -9, 9) && NZ(p.r2, -9, 9) && p.r1 !== p.r2 && p.r1 !== -p.r2
         : I(p.p, 2, 3) && NZ(p.q, -5, 5) && NZ(p.r, -6, 6) && gcd(p.p, p.q) === 1),
  C3: p => [-3, -2, -1, 1, 2, 3].includes(p.a) && I(p.p, -4, 4) && I(p.q, -9, 9) && (p.f === 'ext' || (p.a > 0 && p.s < p.p && p.p < p.t && p.t - p.s <= 6)),
  C4: p => ['sin', 'cos', 'tan'].includes(p.fn) && [30, 45, 60].includes(p.th),
  C5: p => (p.f === 'perm' ? I(p.n, 4, 8) && I(p.r, 2, 3) : p.f === 'comb' ? I(p.n, 5, 10) && I(p.r, 2, 4) : I(p.n, 3, 6)),
  C6: p => (p.f === 'dice' ? I(p.s, 3, 11) : p.f === 'die' ? I(p.k, 2, 5) : p.f === 'coin' ? I(p.n, 2, 4) : I(p.n, 5, 10) && I(p.w, 2, Math.min(4, p.n - 1))),
  C7: p => I(p.d.length, 5, 8) && p.d.every(v => I(v, 1, 20)) && (p.f === 'median' || p.d.reduce((a, b) => a + b, 0) % p.d.length === 0),
  C8: p => (p.f === 'lin' ? I(p.a, -5, 5) && p.a !== 0 && I(p.c, -5, 5) && p.a !== p.c && I(p.b, -9, 9) && Number.isInteger((p.d - p.b) / (p.a - p.c)) && I((p.d - p.b) / (p.a - p.c), -9, 9)
         : I(p.p, -6, 6) && I(p.r, 1, 6)),
  D1: p => (p.f === 'law' ? [2, 3].includes(p.a) && [p.m, p.n, p.k].every(v => I(v, 1, 6)) && I(p.m + p.n - p.k, -3, 6)
         : [2, 3, 4, 5].includes(p.b) && [2, 3].includes(p.q) && [-2, -1, 1, 2, 3].includes(p.p) && p.b ** p.q <= 125),
  D2: p => (p.f === 'basic' ? [2, 3, 5, 10].includes(p.b) && I(p.k, -3, 5) : p.f === 'sum' ? Number.isInteger(Math.round(Math.log(p.M * p.N) / Math.log(p.b) * 1e9) / 1e9) && p.M > 1 && p.N > 1
         : p.f === 'diff' ? p.M % p.N === 0 && I(p.N, 2, 5) : I(p.u, 2, 3) && I(p.v, 1, 5) && p.v % p.u !== 0),
  D3: p => (p.f === 'add' ? [15, 75, 105].includes(p.th) : p.x * p.x + p.y * p.y === p.h * p.h),
  D4: p => NZ(p.a, -3, 3) && [p.b, p.c, p.d].every(v => I(v, -6, 6)) && (p.f === 'coef' || I(p.k, -3, 3)),
  D5: p => (p.f[0] === 'a' ? I(p.a, -10, 10) && NZ(p.d, -5, 5) && I(p.n, 5, 20) : [1, 2, 3, 5].includes(p.a) && [2, 3, -2].includes(p.r) && I(p.n, 3, 7)),
  D6: p => [p.a1, p.a2, p.b1, p.b2].every(v => I(v, -5, 5)) && (p.a1 || p.a2) && (p.b1 || p.b2),
  D7: p => [p.x1, p.y1, p.x2, p.y2].every(v => I(v, -6, 6)) && p.x1 !== p.x2 && p.y1 !== p.y2,
  D8: p => I(p.p, -5, 5) && I(p.q, -5, 5) && I(p.r2, 1, 30) && (p.p || p.q),
  E1: p => (p.f === 'seq' ? I(p.a, 1, 6) && I(p.d, 1, 6) : p.f === 'fn' ? NZ(p.p, -5, 5) && I(p.s, -5, 5) && p.p !== p.s : I(p.k, 2, 6) && I(p.m, 1, 4)),
  E2: p => I(p.k, -2, 2) && (p.f === 'prod' ? NZ(p.a, -3, 3) && I(p.b, -5, 5) && NZ(p.c, -3, 3) && I(p.d, -5, 5)
         : p.f === 'quot' ? NZ(p.a, -4, 4) && I(p.b, -5, 5) && NZ(p.c, -3, 3) && I(p.d, -5, 5) && p.c * p.k + p.d !== 0 && p.a * p.d !== p.b * p.c
         : p.f === 'chain' ? I(p.n, 2, 4) && NZ(p.a, -3, 3) && I(p.b, -3, 3) && p.a * p.k + p.b !== 0 : false),
  E3: p => I(p.a, -3, 3) && I(p.b, -4, 4) && I(p.c, -5, 5) && I(p.s, -2, 2) && I(p.t, p.s + 1, 3),
  E4: p => (p.f === 'div' ? I(p.p, -4, 4) && I(p.q, -4, 4) && NZ(p.c, -3, 3) && NZ(p.d, -3, 3) : [p.a, p.b].every(v => NZ(v, -6, 6))),
  E5: p => (p.f === 'dot' ? p.a.concat(p.b).every(v => I(v, -4, 4)) : [30, 45, 60, 90, 120, 135, 150].includes(p.th) && I(p.m, 1, 4) && I(p.n, 1, 4)),
  E6: p => p.A.concat(p.B).every(v => I(v, -5, 5)),
  E7: p => I(p.p, 1, 11) && [1, 2, 3, 4, 6].includes(p.q) && p.p / p.q < 2 && I(p.r, 1, 4),
  E8: p => (p.f === 'para' ? NZ(p.p, -4, 4) : I(p.a, 1, 12) && I(p.b, 1, 12)),
  S1: p => NZ(p.p, -9, 9) && NZ(p.q, -9, 9) && Math.abs(p.p * p.q) <= 48,
  S2: p => p.d.length === 4 && p.d.every(v => I(v, 1, 9)),
  S3: p => [2, 3].includes(p.g.length) && p.g.every(v => I(v, 1, 9)),
};
// 特殊ドリルの式の追加検査：全て計算でき、4つの数をちょうど1回ずつ使い、正解だけが10
function checkTenPuzzle(pb) {
  const want = pb.params.d.slice().sort().join(), res = pb.choices.map(c => { const used = [], v = evalExpr(c.label, used); return { v, used: used.sort().join() }; });
  return { computable: res.every(r => r.v), digits: res.every(r => r.used === want), onlyOne: res.filter(r => r.v && r.v[0] === 10 && r.v[1] === 1).length === 1 && res[pb.answer].v[0] === 10 && res[pb.answer].v[1] === 1 };
}

// ---- 1タイプの検査（壊しテストからも使う） ----
function checkType(D, id, n, seed) {
  const rng = mulberry32(seed);
  const fail = { one: 0, recompute: 0, dup: 0, range: 0, shape: 0, ten: 0 };
  const posCount = [0, 0, 0, 0], ab = /^[AB]/.test(id);
  let example = null;
  for (let k = 0; k < n; k++) {
    let pb;
    try { pb = D.generate(id, rng); } catch (e) { fail.shape++; if (!example) example = 'throw: ' + e.message; continue; }
    const ch = pb.choices, keys = ch.map(c => c.key), labels = ch.map(c => c.label);
    let want, vals;
    try { want = ab ? ANSWER[id](pb.params) : ANSWER2[id](pb.params, pb); vals = labels.map(l => (ab ? valueOf(l) : val2(l, id))); } catch (e) { want = 'err'; vals = labels.map(() => 'err:' + e.message); }
    const shapeOk = pb.type === id && Array.isArray(ch) && ch.length === 4 && Number.isInteger(pb.answer) && pb.answer >= 0 && pb.answer < 4 &&
      labels.every(l => typeof l === 'string' && l.length > 0 && !/NaN|undefined|Infinity|null|\[object/.test(l)) && typeof pb.prompt === 'string' && pb.prompt.length > 0 &&
      !/NaN|undefined|null/.test(pb.prompt) && vals.every(v => !/NaN|bad|err/.test(v));
    if (!shapeOk) fail.shape++;
    if (vals.filter(v => v === want).length !== 1) fail.one++;               // 正解（の値）がちょうど1つ
    if (vals[pb.answer] !== want) fail.recompute++;                          // 正解の位置の選択肢が、再計算した答えと一致
    if (new Set(vals).size !== 4 || new Set(labels).size !== 4 || new Set(keys).size !== 4) fail.dup++;   // 値・表示とも重複なし
    let rangeOk = false; try { rangeOk = !!(ab ? RANGE[id] : RANGE2[id])(pb.params); } catch (e) { rangeOk = false; }
    if (!rangeOk) fail.range++;                                              // 範囲内
    if (id === 'S2') { const t = checkTenPuzzle(pb); if (!t.computable || !t.digits || !t.onlyOne) fail.ten++; }
    posCount[pb.answer]++;
    if (!example && (fail.one || fail.recompute || fail.dup || fail.range || fail.shape || fail.ten)) example = JSON.stringify(pb);
  }
  const spread = Math.min(...posCount) >= n * 0.25 * 0.8 && Math.max(...posCount) <= n * 0.25 * 1.2;   // 各位置 25%±20%
  const ok = !fail.one && !fail.recompute && !fail.dup && !fail.range && !fail.shape && !fail.ten && spread;
  return { id, name: D.TYPES[id].name, n, ...fail, pos: posCount.join('/'), spread, ok, example };
}
// 5問セット：通常3問（その難度・タイプ重複なし）＋復習1問（間違えた回数が最も多いタイプ。記録がなければ通常）＋挑戦1問（1つ上の難度の易しいタイプ）
function checkSets(D) {
  const res = {};
  for (const L of ['A', 'B', 'C', 'D', 'E']) {
    const rng = mulberry32(42 + L.charCodeAt(0)), types = D.LEVELS[L].types, chal = D.CHALLENGE[L];
    let ok = true, reviewHit = 0, withMiss = 0, chalUp = 0;
    for (let k = 0; k < 500; k++) {
      const miss = k % 2 ? types.filter(() => rng() < 0.4).map(t => [t, 1 + Math.floor(rng() * 4)]) : [];
      const set = D.makeSet(L, rng, 5, { missed: miss }), ty = set.map(p => p.type), roles = set.map(p => p.role);
      const mx = miss.length ? Math.max(...miss.map(m => m[1])) : 0, top = miss.filter(m => m[1] === mx).map(m => m[0]);
      if (set.length !== 5 || new Set(ty).size !== 5) ok = false;
      if (ty.slice(0, 3).some(t => !types.includes(t)) || roles.slice(0, 3).some(r => r !== 'normal')) ok = false;
      if (miss.length) { withMiss++; if (roles[3] === 'review' && top.includes(ty[3])) reviewHit++; else ok = false; }
      else if (roles[3] !== 'normal' || !types.includes(ty[3])) ok = false;
      if (roles[4] === 'challenge' && chal.includes(ty[4]) && (L === 'E' ? D.TYPES[ty[4]].level === 'E' : D.TYPES[ty[4]].level === String.fromCharCode(L.charCodeAt(0) + 1))) chalUp++; else ok = false;
    }
    res[L] = { ok, reviewHit, withMiss, chalUp };
  }
  return res;
}
module.exports = { loadEngine, checkType, checkSets, val2, evalExpr, ANSWER2, RANGE2 };

// ---- 実行 ----
if (require.main === module) {
  const D = loadEngine(), typeIds = Object.keys(D.TYPES);
  let allOk = true;
  const rows = typeIds.map((id, ti) => checkType(D, id, N, 20261127 + ti * 7919));
  rows.forEach(r => { if (!r.ok) allOk = false; });
  const sets = checkSets(D);
  Object.values(sets).forEach(r => { if (!r.ok) allOk = false; });
  console.log('ドリルエンジン自動検証：' + typeIds.length + '種 × ' + N + '問（固定シード）');
  console.log('タイプ | 名前 | 正解1つ違反 | 再計算不一致 | 重複 | 範囲外 | 形式 | 式の検査 | 正解位置(0/1/2/3) | 判定');
  for (const r of rows) {
    console.log([r.id, r.name, r.one, r.recompute, r.dup, r.range, r.shape, r.id === 'S2' ? r.ten : '-', r.pos, r.ok ? '合格' : '不合格'].join(' | '));
    if (!r.ok && r.example) console.log('   例: ' + r.example);
  }
  for (const [L, r] of Object.entries(sets)) console.log('5問セット ' + L + '（500セット）：構成 ' + (r.ok ? '合格' : '不合格') + '／復習が最多ミスのタイプ ' + r.reviewHit + '/' + r.withMiss + '／挑戦が上の難度 ' + r.chalUp + '/500');
  console.log(allOk ? '=> 全て合格' : '=> 不合格あり');
  process.exit(allOk ? 0 : 1);
}
