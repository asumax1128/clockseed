#!/usr/bin/env node
/* ときの種：テンパズル（移植版）のエンジン検証（ゲーム本体とは別のテスト用コード）
   使い方：node tests/tp_engine_test.js   （オプション：ティアごとの出題数 既定20000）
   index.html の <script id="tp-engine"> だけを取り出し、DOM のない環境で実行して次を確かめる。
     1) 出題：このファイルの独立な総当たりソルバー（全てのカード合体の手順を有理数で計算し、本家と同じ
        「＋と×の交換・結合だけを同一視」する数え方で解法を数える）で、プールの全269組と多数の出題について
        「解が存在する」「解法の数が選んだティアの帯（入門40〜95・初級20〜39・中級10〜19）に入る」「数字は1〜9の4つ」
        「答えの一例が本当に10になり、4つの数を1回ずつ使う」を確かめる
     2) 判定：4つの数を1回ずつ使う式だけを受け付ける。10にならない式・数が多すぎる/少なすぎる/別の数の式・
        2けたの数をつなげた式・0で割る式・割り算の余り（切り捨てなら10になってしまう式）を正しく扱う。
        ランダムな式2万個で、エンジンの判定とこのファイルの計算が一致する
     3) 盤面の操作：合体（1枚目が左・結果は1枚目の位置）・0で割る合体の拒否・1手戻す・リセット・
        操作方法A（数字→記号→数字、⇄、0で割るときは入力を残す）・操作方法B（2枚えらぶ） */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const N = Number(process.argv[2]) || 20000;
function loadTP(file) {
  const html = fs.readFileSync(file || path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/<script id="tp-engine">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('tp-engine の <script> が見つかりません');
  const sb = {}; vm.createContext(sb); vm.runInContext(m[1], sb); return sb.ClockseedTP;
}
function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// ---- このファイルの有理数と独立ソルバー ----
const g = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a; };
const R = (n, d) => { if (d < 0) { n = -n; d = -d; } const k = g(n, d) || 1; return [n / k, d / k]; };
const OP = { '+': (a, b) => R(a[0] * b[1] + b[0] * a[1], a[1] * b[1]), '-': (a, b) => R(a[0] * b[1] - b[0] * a[1], a[1] * b[1]),
             '*': (a, b) => R(a[0] * b[0], a[1] * b[1]), '/': (a, b) => (b[0] === 0 ? null : R(a[0] * b[1], a[1] * b[0])) };
function canon(e) {                                         // ＋・× は交換と結合を同一視（−・÷ はそのまま）
  if (typeof e === 'number') return String(e);
  const [op] = e;
  if (op === '+' || op === '*') { const parts = []; const walk = x => { if (Array.isArray(x) && x[0] === op) { walk(x[1]); walk(x[2]); } else parts.push(canon(x)); }; walk(e); return op + '(' + parts.sort().join(',') + ')'; }
  return op + '(' + canon(e[1]) + ',' + canon(e[2]) + ')';
}
function solutions(ds, strs) {                              // 全ての「2枚えらんで合体」の手順を試す（strs：解法ごとの式の文字列）
  const out = new Set();
  const show = e => (typeof e === 'number' ? String(e) : '(' + show(e[1]) + ' ' + { '+': '+', '-': '−', '*': '×', '/': '÷' }[e[0]] + ' ' + show(e[2]) + ')');
  (function rec(cs) {
    if (cs.length === 1) { if (cs[0].v[0] === 10 && cs[0].v[1] === 1) { const c = canon(cs[0].e); if (strs && !out.has(c)) strs.push(show(cs[0].e)); out.add(c); } return; }
    for (let i = 0; i < cs.length; i++) for (let j = 0; j < cs.length; j++) {
      if (i === j) continue; const rest = cs.filter((_, k) => k !== i && k !== j);
      for (const op of '+-*/') { const v = OP[op](cs[i].v, cs[j].v); if (v) rec(rest.concat([{ v, e: [op, cs[i].e, cs[j].e] }])); }
    }
  })(ds.map(d => ({ v: [d, 1], e: d })));
  return out;
}
// このファイルの式の読み取りと計算（数・＋−×÷・かっこ。使った数も返す）
function evalStr(str) {
  const toks = str.replace(/−/g, '-').replace(/\s+/g, '').match(/\d+|[-+×÷()]/g); let p = 0; const used = [];
  if (!toks || toks.join('') !== str.replace(/−/g, '-').replace(/\s+/g, '')) return { bad: true };
  const prim = () => { const t = toks[p++]; if (t === '(') { const v = sum(); if (toks[p++] !== ')') throw 0; return v; } if (!/^\d+$/.test(t || '')) throw 0; used.push(Number(t)); return [Number(t), 1]; };
  const prod = () => { let a = prim(); while (toks[p] === '×' || toks[p] === '÷') { const o = toks[p++], b = prim(); if (a === null || b === null) { a = null; continue; } a = o === '×' ? OP['*'](a, b) : OP['/'](a, b); } return a; };
  const sum = () => { let a = prod(); while (toks[p] === '+' || toks[p] === '-') { const o = toks[p++], b = prod(); a = a === null || b === null ? null : OP[o](a, b); } return a; };
  try { const v = sum(); return p === toks.length ? { v, used } : { bad: true }; } catch (e) { return { bad: true }; }
}
const BAND = { '入門': [40, 95], '初級': [20, 39], '中級': [10, 19] };

if (require.main === module) {
  const T = loadTP(); let allOk = true; const out = (name, ok, extra) => { if (!ok) allOk = false; console.log((ok ? '合格 ' : '不合格 ') + name + (extra ? '　' + extra : '')); };
  console.log('テンパズル（移植版）エンジン検証：参照 ' + T.SOURCE);
  // 1) プール全体と出題
  const cache = new Map(), nSol = key => { if (!cache.has(key)) cache.set(key, solutions(key.split('').map(Number)).size); return cache.get(key); };
  const poolBad = T.POOL.filter(p => { const n = nSol(p.key), [lo, hi] = BAND[p.tier] || [1, 0];
    const ex = evalStr(p.example);
    return !(p.digits.length === 4 && p.digits.every(d => d >= 1 && d <= 9) && n >= 1 && n === p.nSolutions && n >= lo && n <= hi &&
      ex.v && ex.v[0] === 10 && ex.v[1] === 1 && ex.used.slice().sort().join() === p.digits.slice().sort().join()); });
  const counts = T.TIERS.map(t => t + ' ' + T.POOL.filter(p => p.tier === t).length + '組');
  out('プール全' + T.POOL.length + '組：解あり・解法の数がティアの帯・答えの一例が10', !poolBad.length && T.POOL.length === 269, counts.join('・') + (poolBad.length ? '／違反 ' + poolBad.slice(0, 3).map(p => p.key).join(',') : ''));
  out('プールの組は重複なし・数字は小さい順の4つ', new Set(T.POOL.map(p => p.key)).size === T.POOL.length && T.POOL.every(p => p.key === p.digits.slice().sort().join('')));
  for (const tier of T.TIERS) {
    const rng = mulberry32(57 + tier.charCodeAt(0)); let bad = 0, outTier = 0, minN = 1e9, maxN = 0; const seen = new Set();
    let recent = [];
    for (let k = 0; k < N; k++) {
      const e = T.pick(tier, rng, recent); recent = recent.concat(e.key).slice(-8); seen.add(e.key);
      if (e.tier !== tier) outTier++;
      const n = nSol(e.key); minN = Math.min(minN, n); maxN = Math.max(maxN, n);
      if (n < 1 || n < BAND[tier][0] || n > BAND[tier][1]) bad++;
    }
    out(tier + ' の出題 ' + N + '問：解あり・ティアの定義の中', !bad && !outTier, '独立ソルバーの解法の数 ' + minN + '〜' + maxN + '・出た組 ' + seen.size + '/' + T.POOL.filter(p => p.tier === tier).length + '組');
  }
  { const rng = mulberry32(9); let rep = 0, recent = [];
    for (let k = 0; k < 5000; k++) { const e = T.pick('入門', rng, recent); if (recent.includes(e.key)) rep++; recent = recent.concat(e.key).slice(-8); }
    out('直前8問と同じ組は出ない', rep === 0); }
  // 2) 判定
  const J = (s, d) => T.judge(T.parse(s), d);
  const cases = [
    ['1 + 1 + 1 + 8 は 11', '1+1+1+8', [1, 1, 1, 8], 'notTen'], ['1 + 1 × 1 + 8 は 10', '1+1×1+8', [1, 1, 1, 8], true],
    ['分数を経由（8 ÷ (1 − 1 ÷ 5)）', '8÷(1−1÷5)', [1, 1, 5, 8], true], ['分数を経由（(1 + 1 ÷ 9) × 9）', '(1+1÷9)×9', [1, 1, 9, 9], true],
    ['割り算の余り：7 ÷ 2 × 3 + 1 ＝ 11.5（切り捨てなら10だが不可）', '7÷2×3+1', [1, 2, 3, 7], 'notTen'],
    ['割り算の余り：9 ÷ 2 + 5 + 1 ＝ 10.5', '9÷2+5+1', [1, 2, 5, 9], 'notTen'],
    ['0で割る：8 ÷ (1 − 1) + 1', '8÷(1−1)+1', [1, 1, 1, 8], 'divzero'], ['0で割る（途中）：(3 − 3) ÷ (2 − 2)', '(3−3)÷(2−2)', [2, 2, 3, 3], 'divzero'],
    ['数が足りない：8 + 1 + 1', '8+1+1', [1, 1, 1, 8], 'digits'], ['数が多すぎる：8 + 1 + 1 + 1 − 1', '8+1+1+1−1', [1, 1, 1, 8], 'digits'],
    ['別の数：9 + 1 × 1 × 1', '9+1×1×1', [1, 1, 1, 8], 'digits'], ['2けたにつなげる：11 − 1 ÷ 1', '11−1÷1', [1, 1, 1, 8], 'digits'],
    ['同じ数を2回：5 + 5（2・3・4・5）', '5+5', [2, 3, 4, 5], 'digits'], ['並べ替えても可：(5 − 3) × (4 + 1)', '(5−3)×(4+1)', [1, 3, 4, 5], true],
  ];
  for (const [name, s, d, want] of cases) { const r = J(s, d); out('判定 ' + name, want === true ? r.ok : (!r.ok && r.reason === want), r.ok ? 'OK' : r.reason); }
  { const rng = mulberry32(77); let mismatch = 0, okN = 0; const ops = ['+', '−', '×', '÷'];
    for (let k = 0; k < 20000; k++) {
      const d = Array.from({ length: 4 }, () => 1 + Math.floor(rng() * 9)), leafs = d.slice();
      if (rng() < 0.15) leafs.pop(); else if (rng() < 0.15) leafs.push(1 + Math.floor(rng() * 9)); else if (rng() < 0.1) leafs[0] = (leafs[0] % 9) + 1;
      for (let i = leafs.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [leafs[i], leafs[j]] = [leafs[j], leafs[i]]; }
      const build = arr => { if (arr.length === 1) return String(arr[0]); const c = 1 + Math.floor(rng() * (arr.length - 1)); return '(' + build(arr.slice(0, c)) + ' ' + ops[Math.floor(rng() * 4)] + ' ' + build(arr.slice(c)) + ')'; };
      const s = build(leafs), mine = evalStr(s), want = !!(mine.v && mine.v[0] === 10 && mine.v[1] === 1 && mine.used.slice().sort().join() === d.slice().sort().join());
      const r = T.judge(T.parse(s), d); if (r.ok !== want) mismatch++; if (want) okN++;
    }
    out('ランダムな式2万個でエンジンの判定とこのファイルの計算が一致', mismatch === 0, '10になる式 ' + okN + '個・不一致 ' + mismatch); }
  { let n = 0, bad = 0;                                       // 独立ソルバーが見つけた全ての解法の式を、エンジンも10と判定するか
    for (const p of T.POOL) { const strs = []; solutions(p.digits, strs); for (const x of strs) { n++; if (!T.judge(T.parse(x), p.digits).ok) bad++; } }
    out('プール全組の全解法（独立ソルバーの式）をエンジンも正解と判定', bad === 0 && n > 0, n + '式・不一致 ' + bad); }
  // 3) 盤面の操作
  { const b = T.newBoard([2, 3, 4, 5]); let r = T.merge(b, 3, 1, '-');           // 5 − 3 を1枚目（5）の位置へ
    out('合体：1枚目が左・結果は1枚目の位置', r.ok && b.cards.map(c => T.fracStr(c.v)).join(',') === '2,4,2' && r.index === 2);
    const b2 = T.newBoard([1, 1, 2, 8]); T.merge(b2, 0, 1, '-'); r = T.merge(b2, 2, 0, '/');
    out('0で割る合体は拒否して盤面はそのまま', !r.ok && r.error === 'divzero' && b2.cards.length === 3);
    T.merge(b2, 1, 2, '*'); out('1手戻す', T.undo(b2) && b2.cards.length === 3 && T.undo(b2) && b2.cards.length === 4 && !T.undo(b2));
    T.merge(b2, 0, 1, '+'); T.reset(b2, [1, 1, 2, 8]); out('リセット', b2.cards.length === 4 && !b2.history.length);
    const b3 = T.newBoard([1, 1, 5, 8]), st = T.newInputA();                     // 8 ÷ (1 − 1 ÷ 5) を操作方法Aで
    const seq = [T.aTapCard(st, b3, 1).type, T.aTapOp(st, '/'), T.aTapCard(st, b3, 2).type];   // 1 ÷ 5 → [1, 1/5, 8]
    seq.push(T.aTapCard(st, b3, 0).type, T.aTapOp(st, '-'), T.aTapCard(st, b3, 1).type);         // 1 − 1/5 → [4/5, 8]
    seq.push(T.aTapCard(st, b3, 0).type, T.aTapOp(st, '/'), T.aFlip(st), T.aTapCard(st, b3, 1).type);   // ⇄ で 8 ÷ 4/5
    out('操作方法A：数字→記号→数字・⇄ で 8 ÷ (1 − 1 ÷ 5) ＝ 10', T.isWin(b3) && T.infix(b3.cards[0].e) === '8 ÷ (1 − 1 ÷ 5)', seq.join(' '));
    const b4 = T.newBoard([1, 1, 2, 8]), s4 = T.newInputA(); T.merge(b4, 0, 1, '-');
    T.aTapCard(s4, b4, 1); T.aTapOp(s4, '/'); const bl = T.aTapCard(s4, b4, 0);
    out('操作方法A：0で割るときは拒否して1枚目と記号を残す', bl.type === 'blocked' && s4.first === 1 && s4.op === '/');
    const st2 = T.newInputA(); const b5 = T.newBoard([1, 2, 3, 4]);
    out('操作方法A：同じ数字をもう一度で取り消し・記号の前に別の数字で選び直し', T.aTapCard(st2, b5, 0).type === 'select' && T.aTapCard(st2, b5, 2).type === 'reselect' && T.aTapCard(st2, b5, 2).type === 'deselect');
    const sel = []; T.bTapCard(sel, 2); T.bTapCard(sel, 0); T.bTapCard(sel, 0); T.bTapCard(sel, 3); const after = sel.join(); T.bTapCard(sel, 1);
    out('操作方法B：2枚えらぶ・もう一度で外す・3枚目で選び直し', after === '2,3' && sel.join() === '1');
    const b6 = T.newBoard([1, 1, 1, 8]); T.merge(b6, 0, 1, '+'); T.merge(b6, 0, 1, '+'); T.merge(b6, 0, 1, '+');
    out('最後の1枚が10でなければ正解にしない（11）', T.isFinished(b6) && !T.isWin(b6) && !T.judge(b6.cards[0].e, [1, 1, 1, 8]).ok);
  }
  console.log(allOk ? '=> 全て合格' : '=> 不合格あり');
  process.exit(allOk ? 0 : 1);
}
module.exports = { loadTP, solutions, evalStr, mulberry32 };
