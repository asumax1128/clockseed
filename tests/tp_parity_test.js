#!/usr/bin/env node
/* ときの種：テンパズル移植版と本家の突き合わせ（本家のコードそのものを動かして比べる）
   使い方：node tests/tp_parity_test.js [本家の index.html のパス]
     既定のパスは clockseed の外の参照用 clone（../asumax1128/tenpuzzle/index.html）。環境変数 TP_REF でも指定できる。
     見つからないときは「参照なし」として何もせず終了する（clockseed には本家のコードを含めない）。
   本家 index.html の CORE（// ===== CORE_START ===== 〜 CORE_END）と pool-data を読み取り専用で取り出し、
     1) プール：本家の入門・初級・中級の組（数字・ティア・解法の数・答えの一例）と移植版のプールが完全に同じ
     2) ティアの並び・記号：本家 TIERS の先頭3つ・SYM と同じ
     3) 盤面の操作：ランダムな操作列2万回（merge／undo／reset）で、本家と移植版の盤面（値と式の木）が毎手一致
     4) 操作方法A：ランダムなタップ列2万回（aTapCard／aTapOp／aFlip）で、戻り値・入力状態・盤面が毎手一致
     5) 判定に使う計算：ランダムな式で本家 parse・evalTree・leaves と移植版が一致（0で割ると本家は例外・移植版は null。どちらも不可として比べる）
   を確かめる。本家のファイルは読むだけで、変更しない。 */
'use strict';
const fs = require('fs'), path = require('path');
const { loadTP, mulberry32 } = require('./tp_engine_test.js');
const REF = process.argv[2] || process.env.TP_REF || path.join(__dirname, '..', '..', 'asumax1128', 'tenpuzzle', 'index.html');
if (!fs.existsSync(REF)) { console.log('本家の参照 clone が見つからないため省略：' + REF); process.exit(0); }
const html = fs.readFileSync(REF, 'utf8');
const core = html.match(/\/\/ ===== CORE_START =====([\s\S]*?)\/\/ ===== CORE_END =====/)[1];
const mod = { exports: {} }; new Function('module', core)(mod); const O = mod.exports;
const POOL = JSON.parse(html.match(/id="pool-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
const T = loadTP(), head = (() => { try { return require('child_process').execSync('git -C "' + path.dirname(REF) + '" rev-parse HEAD').toString().trim(); } catch (e) { return '不明'; } })();
let allOk = true; const out = (name, ok, extra) => { if (!ok) allOk = false; console.log((ok ? '一致 ' : '不一致 ') + name + (extra ? '　' + extra : '')); };
console.log('本家との突き合わせ：' + REF + '（HEAD ' + head + '）／移植版の参照 ' + T.SOURCE);
// 1) プール
const want = POOL.filter(p => ['入門', '初級', '中級'].includes(p.tier)).map(p => [p.digits.join(''), p.tier, p.nSolutions, p.example].join('|')).sort();
const mine = T.POOL.map(p => [p.key, p.tier, p.nSolutions, p.example].join('|')).sort();
out('入門・初級・中級の組（数字・ティア・解法の数・答えの一例）', JSON.stringify(want) === JSON.stringify(mine), '本家 ' + want.length + '組／移植版 ' + mine.length + '組（本家プール全体 ' + POOL.length + '組）');
out('ティアの並び・記号', JSON.stringify(O.TIERS.slice(0, 3)) === JSON.stringify(T.TIERS) && ['+', '*', '/'].every(k => O.SYM[k] === T.SYM[k]) && O.SYM['-'] === '-' && T.SYM['-'] === '−', O.TIERS.slice(0, 3).join('・'));
// 盤面の比較（値は分数、式の木はそのまま）
const sameBoard = (a, b) => JSON.stringify(a.cards.map(c => [c.v.n, c.v.d, c.e])) === JSON.stringify(b.cards.map(c => [c.v.n, c.v.d, c.e])) && a.history.length === b.history.length;
const ops = ['+', '-', '*', '/'];
// 3) merge / undo / reset
{ const rng = mulberry32(31); let bad = 0, steps = 0;
  for (let g = 0; g < 2000; g++) {
    const d = POOL[Math.floor(rng() * POOL.length)].digits, a = O.newBoard(d), b = T.newBoard(d);
    for (let k = 0; k < 10; k++) {
      const r = rng(), n = a.cards.length; steps++;
      if (r < 0.7 && n > 1) { const i = Math.floor(rng() * n), j = Math.floor(rng() * n), op = ops[Math.floor(rng() * 4)]; const ra = O.merge(a, i, j, op), rb = T.merge(b, i, j, op); if (ra.ok !== rb.ok || (ra.ok && ra.index !== rb.index) || (!ra.ok && ra.error !== rb.error)) bad++; }
      else if (r < 0.9) { if (O.undo(a) !== T.undo(b)) bad++; }
      else { O.reset(a, d); T.reset(b, d); }
      if (!sameBoard(a, b) || O.isWin(a) !== T.isWin(b) || O.isFinished(a) !== T.isFinished(b)) bad++;
    }
  }
  out('合体・1手戻す・リセット（ランダムな操作 ' + steps + '手）', bad === 0, '不一致 ' + bad); }
// 4) 操作方法A
{ const rng = mulberry32(41); let bad = 0, steps = 0;
  for (let g = 0; g < 2000; g++) {
    const d = POOL[Math.floor(rng() * POOL.length)].digits, a = O.newBoard(d), b = T.newBoard(d), sa = O.newInputA(), sb = T.newInputA();
    for (let k = 0; k < 10; k++) {
      const r = rng(); steps++;
      if (r < 0.55) { const i = Math.floor(rng() * (a.cards.length + 1)) - (rng() < 0.05 ? 1 : 0); const x = O.aTapCard(sa, a, i), y = T.aTapCard(sb, b, i); if (x.type !== y.type || x.error !== y.error) bad++; }
      else if (r < 0.85) { const op = ops[Math.floor(rng() * 4)]; if (O.aTapOp(sa, op) !== T.aTapOp(sb, op)) bad++; }
      else if (O.aFlip(sa) !== T.aFlip(sb)) bad++;
      if (JSON.stringify(sa) !== JSON.stringify(sb) || !sameBoard(a, b) || O.aGuide(sa) !== T.aGuide(sb) || O.aExpr(sa, a).replace(/−/g, '-') !== T.aExpr(sb, b).replace(/−/g, '-')) bad++;
    }
  }
  out('操作方法A（ランダムなタップ ' + steps + '回）', bad === 0, '不一致 ' + bad); }
// 5) 判定に使う計算（parse・evalTree・leaves）
{ const rng = mulberry32(51); let bad = 0; const sy = ['+', '-', '×', '÷'];
  for (let k = 0; k < 20000; k++) {
    const ls = Array.from({ length: 4 }, () => 1 + Math.floor(rng() * 9));
    const build = arr => (arr.length === 1 ? String(arr[0]) : (c => '(' + build(arr.slice(0, c)) + sy[Math.floor(rng() * 4)] + build(arr.slice(c)) + ')')(1 + Math.floor(rng() * (arr.length - 1))));
    const s = build(ls), ea = O.parse(s), eb = T.parse(s), vb = T.evalTree(eb);
    let va; try { va = O.evalTree(ea); } catch (e) { va = null; }   // 本家は0で割ると例外、移植版は null（どちらも「計算できない」）
    if (JSON.stringify(ea) !== JSON.stringify(eb) || JSON.stringify(O.leaves(ea)) !== JSON.stringify(T.leaves(eb)) || (va === null) !== (vb === null) || (va && (va.n !== vb.n || va.d !== vb.d))) bad++;
  }
  out('式の読み取り・計算・使った数（ランダムな式2万個）', bad === 0, '不一致 ' + bad); }
console.log(allOk ? '=> 本家と一致' : '=> 不一致あり');
process.exit(allOk ? 0 : 1);
