#!/usr/bin/env node
/* ときの種：FACTOR×FACTOR ソロ・イージー（移植版）のエンジン検証（ゲーム本体とは別のテスト用コード）
   使い方：node tests/fxf_engine_test.js   （オプション：レベルごとの盤面数 既定20000）
   index.html の <script id="fxf-engine"> だけを取り出し、DOM のない環境で実行して次を確かめる。
     1) 必ず因数分解できる：正解の2因数の積がお題の式に等しく、その2枚が盤面にある
     2) 置かれたタイルの式と判定が一致：タイルとお題の「表示文字列」をこのファイルで多項式に読み取って掛け算し、
        エンジンの判定（multiply/polyEqual）と全ての組で一致する。正しい組は1組以上（何組あるかも数える）
     3) 本家の生成範囲から出ていない：正解の因数は本家 genL1〜5 の範囲、誤答タイルは
        「正解の因数の符号反転」「正解の因数の定数±1」「同じレベルの本家の範囲の因数」のどれか。盤面は6枚・重複なし
        （例外は本家どおり：Lv3 で a=b（平方の形）のときは正解の2枚が同じ式になる）
     4) 出題レベル：1〜15問目は3問ごとに Lv1→Lv5
     5) 1ゲームの流れ（純粋な状態遷移を時刻を与えて動かす）：判定の6段階・回復・超過点・コンボ倍率・ミス−20%・
        時間切れ（20秒）・体力の自然減少（1秒1%）・15問でクリア（ボーナス＝15×15−経過秒）・体力0で終了 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const N = Number(process.argv[2]) || 20000;
function loadFxf(file) {
  const html = fs.readFileSync(file || path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/<script id="fxf-engine">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('fxf-engine の <script> が見つかりません');
  const sb = {}; vm.createContext(sb); vm.runInContext(m[1], sb); return sb.ClockseedFxF;
}
function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a; };

// ---- 表示文字列 → 多項式（係数の配列、低次から）。エンジンの関数は使わない ----
function parseFactor(s) {
  s = s.replace(/−/g, '-'); let m;
  if ((m = s.match(/^(-?\d+)$/))) return [Number(m[1])];
  if ((m = s.match(/^\((-?\d*)x([+-]\d+)?\)$/))) { const a = m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(m[1]); return [m[2] ? Number(m[2]) : 0, a]; }
  return null;
}
function parsePoly(s) {
  const t = s.replace(/−/g, '-').replace(/\s+/g, ''), c = [0, 0, 0, 0, 0], E = { '': 1, '²': 2, '³': 3, '⁴': 4 };
  const re = /([+-]?)(\d*)(x([²³⁴]?))?/g; let m, ok = false;
  while ((m = re.exec(t)) && m[0] !== '') { ok = true; const sg = m[1] === '-' ? -1 : 1, hasX = !!m[3], k = m[2] === '' ? 1 : Number(m[2]), e = hasX ? E[m[4]] : 0; if (!hasX && m[2] === '') return null; c[e] += sg * k; }
  return ok ? c : null;
}
const pmul = (a, b) => { const o = Array(5).fill(0); a.forEach((x, i) => b.forEach((y, j) => { o[i + j] += x * y; })); return o; };
const same = (a, b) => a.every((x, i) => x === b[i]);
// ---- 本家の範囲（genL1〜5 のコメントと実装から） ----
const lin = (f, a, b) => f.type === 'linear' && f.a === a && f.b === b;
const RANGE = {
  1: fs_ => { const [k, l] = fs_; return k.type === 'const' && k.k >= 2 && k.k <= 9 && l.type === 'linear' && l.a >= 1 && l.a <= 9 && Math.abs(l.b) >= 1 && Math.abs(l.b) <= 9 && gcd(l.a, l.b) === 1; },
  2: fs_ => { const [x, l] = fs_; return x.type === 'linear' && x.b === 0 && x.a >= 1 && x.a <= 9 && l.type === 'linear' && l.a >= 1 && l.a <= 9 && Math.abs(l.b) >= 1 && Math.abs(l.b) <= 9 && gcd(l.a, l.b) === 1; },
  3: fs_ => fs_.every(f => f.type === 'linear' && f.a === 1 && f.b !== 0 && Math.abs(f.b) <= 9) && fs_[0].b !== -fs_[1].b,
  4: fs_ => { const [p, q] = fs_; return p.type === 'linear' && q.type === 'linear' && p.a === q.a && p.a >= 1 && p.a <= 9 && p.b >= 1 && p.b <= 9 && q.b === -p.b && gcd(p.a, p.b) === 1; },
  5: fs_ => { const [p, q] = fs_; return p.type === 'linear' && p.a === 1 && p.b !== 0 && Math.abs(p.b) <= 5 && q.type === 'linear' && q.a >= 2 && q.a <= 9 && q.b !== 0 && Math.abs(q.b) <= 5 && gcd(q.a, q.b) === 1; },
};
// 同じレベルの本家の範囲の「どちらかの因数」になりうるか
const FOREIGN = {
  1: f => (f.type === 'const' && f.k >= 2 && f.k <= 9) || (f.type === 'linear' && f.a >= 1 && f.a <= 9 && f.b !== 0 && Math.abs(f.b) <= 9 && gcd(f.a, f.b) === 1),
  2: f => f.type === 'linear' && ((f.b === 0 && f.a >= 1 && f.a <= 9) || (f.a >= 1 && f.a <= 9 && f.b !== 0 && Math.abs(f.b) <= 9 && gcd(f.a, f.b) === 1)),
  3: f => f.type === 'linear' && f.a === 1 && f.b !== 0 && Math.abs(f.b) <= 9,
  4: f => f.type === 'linear' && f.a >= 1 && f.a <= 9 && f.b !== 0 && Math.abs(f.b) <= 9 && gcd(f.a, f.b) === 1,
  5: f => f.type === 'linear' && ((f.a === 1 && f.b !== 0 && Math.abs(f.b) <= 5) || (f.a >= 2 && f.a <= 9 && f.b !== 0 && Math.abs(f.b) <= 5 && gcd(f.a, f.b) === 1)),
};
const key = f => (f.type === 'linear' ? 'L' + f.a + '_' + f.b : 'C' + f.k);
const flip = f => (f.type === 'const' ? { type: 'const', k: -f.k } : { type: 'linear', a: f.a, b: -f.b });
const shifts = f => [1, -1].map(d => (f.type === 'const' ? { type: 'const', k: f.k + d } : { type: 'linear', a: f.a, b: f.b + d }));

if (require.main === module) {
  const F = loadFxf(); let allOk = true;
  console.log('FACTOR×FACTOR ソロ・イージー（移植版）エンジン検証：参照 ' + F.SOURCE);
  console.log('Lv | 盤面数 | 因数分解できない | 判定と式の不一致 | 正解の範囲外 | 誤答の出どころ不明 | 枚数・重複 | 正しい組が2組以上 | 平方の形（同じタイル2枚） | 判定');
  for (let lv = 1; lv <= 5; lv++) {
    const rng = mulberry32(5700 + lv), seen = new Set(); let bad = { fact: 0, judge: 0, range: 0, dummy: 0, shape: 0 }, multi = 0, square = 0, example = null;
    for (let n = 0; n < N; n++) {
      if (n % 200 === 0) seen.clear();
      const B = F.buildBoard(lv, seen, F.CONFIG.tileCount, rng), tiles = B.tiles, target = parsePoly(B.target);
      const parsed = tiles.map(t => parseFactor(t.label));
      // 重複は本家どおり「正解の2因数が同じ（Lv3 の a=b、平方の形）」ときの正解2枚だけ許す
      const sq = key(B.factors[0]) === key(B.factors[1]), nKeys = new Set(tiles.map(t => key(t.factor))).size;
      if (sq) square++;
      if (tiles.length !== 6 || nKeys !== (sq ? 5 : 6) || parsed.some(p => !p) || !target) { bad.shape++; if (!example) example = B; continue; }
      // 1) 因数分解できる：正解の2因数（表示から読む）の積＝お題（表示から読む）、かつ2枚とも盤面にある
      const cIdx = sq ? tiles.map((t, i) => (key(t.factor) === key(B.factors[0]) ? i : -1)).filter(i => i >= 0) : B.factors.map(f => tiles.findIndex(t => key(t.factor) === key(f)));
      if (cIdx.length !== 2 || cIdx.some(i => i < 0) || !same(pmul(parsed[cIdx[0]], parsed[cIdx[1]]), target)) { bad.fact++; if (!example) example = B; }
      // 2) 全ての組で、表示から計算した積の一致と、エンジンの判定が同じ
      let pairs = 0;
      for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) {
        const byText = same(pmul(parsed[i], parsed[j]), target), byEngine = F.polyEqual(F.multiply(tiles[i].factor, tiles[j].factor), B.poly);
        if (byText !== byEngine) { bad.judge++; if (!example) example = B; }
        if (byText) pairs++;
      }
      if (pairs > 1) multi++;
      // 3) 範囲：正解は本家の範囲、誤答は「符号反転」「定数±1」「同じレベルの範囲の因数」のどれか
      if (!RANGE[lv](B.factors)) { bad.range++; if (!example) example = B; }
      const allowed = new Set(B.factors.flatMap(f => [key(flip(f))].concat(shifts(f).map(key))));
      for (const t of tiles) { const k = key(t.factor); if (B.factors.some(f => key(f) === k)) continue; if (!allowed.has(k) && !FOREIGN[lv](t.factor)) { bad.dummy++; if (!example) example = B; } }
    }
    const ok = !bad.fact && !bad.judge && !bad.range && !bad.dummy && !bad.shape;
    if (!ok) allOk = false;
    console.log([lv, N, bad.fact, bad.judge, bad.range, bad.dummy, bad.shape, multi, square, ok ? '合格' : '不合格'].join(' | '));
    if (!ok && example) console.log('   例: ' + JSON.stringify(example));
  }
  // 4) 出題レベル
  const lvSeq = Array.from({ length: 15 }, (_, i) => F.levelFor(i + 1)).join(','), lvOk = lvSeq === '1,1,1,2,2,2,3,3,3,4,4,4,5,5,5';
  console.log('出題レベル（1〜15問目）：' + lvSeq + ' ' + (lvOk ? '合格' : '不合格')); if (!lvOk) allOk = false;
  // 5) 1ゲームの流れ
  const res = []; const check = (name, cond) => { res.push([name, cond]); if (!cond) allOk = false; };
  const pairOf = g => { const t = g.q.tiles; for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) if (F.polyEqual(F.multiply(t[i].factor, t[j].factor), g.q.poly)) return [t[i].id, t[j].id]; };
  const wrongOf = g => { const t = g.q.tiles; for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) if (!F.polyEqual(F.multiply(t[i].factor, t[j].factor), g.q.poly)) return [t[i].id, t[j].id]; };
  { const rng = mulberry32(1), g = F.newGame(rng, 0); let T = 0;
    T += 1500; let ev = F.answer(g, ...pairOf(g), T);
    check('1問目 1.5秒で正解 → Perfect・体力 100−1.5+25 → 100（超過 23.5 → 24点）・得点 10＋24', ev.judge.label === 'Perfect' && g.hp === 100 && ev.overflow === 24 && ev.gain === 10 && g.score === 34 && g.combo === 1);
    T += 420; F.tick(g, T); F.advance(g, T, rng);
    T += 4000; ev = F.answer(g, ...pairOf(g), T);
    check('2問目 4秒で正解 → Great（+15%）・コンボ1の倍率1.1 → 11点', ev.judge.label === 'Great' && ev.gain === 11 && g.combo === 2);
    T += 420; F.tick(g, T); F.advance(g, T, rng);
    const hp0 = g.hp; T += 1000; ev = F.answer(g, ...wrongOf(g), T);
    check('3問目 ミス → 体力 −1（自然減少）−20・コンボ0・正解数そのまま', !ev.ok && Math.abs(g.hp - (hp0 - 1 - 20)) < 0.011 && g.combo === 0 && g.caught === 2);
    T += 420; F.tick(g, T); F.advance(g, T, rng);
    check('ミスの後は同じ問題番号（3問目＝Lv1）の別の問題', g.q.level === 1 && g.phase === 'playing');
    const hp1 = g.hp; T += 20000; ev = F.tick(g, T);
    check('20秒で時間切れ → 自然減少20%のみ（イージーの追加減少0）・コンボ0', ev && ev.type === 'timeout' && Math.abs(g.hp - (hp1 - 20)) < 0.011 && g.timeouts === 1);
  }
  { const rng = mulberry32(2), g = F.newGame(rng, 0); let T = 0, lvs = [];
    while (g.phase !== 'over') { lvs.push(g.q.level); T += 2500; F.answer(g, ...pairOf(g), T); if (g.phase === 'over') break; T += 420; F.tick(g, T); F.advance(g, T, rng); }
    const playSec = g.playMs / 1000;
    check('15問正解でクリア・各問のレベル 1,1,1,2,2,2,…,5,5,5', g.cleared && g.caught === 15 && lvs.join(',') === '1,1,1,2,2,2,3,3,3,4,4,4,5,5,5');
    check('クリアボーナス＝round(15×15 − 経過秒)（経過 ' + playSec + '秒 → ' + g.clearBonus + '点）', g.clearBonus === Math.round(15 * 15 - playSec));
    let exp = 0, combo = 0, hp = 100; const LP = [10, 10, 10, 12, 12, 12, 14, 14, 14, 16, 16, 16, 18, 18, 18];
    for (let k = 0; k < 15; k++) { hp = Math.round((hp - (k === 0 ? 2.5 : 2.92)) * 100) / 100; const raw = hp + 20; exp += Math.round(LP[k] * (1 + combo * 0.1)) + Math.max(0, Math.round(raw - 100)); hp = Math.min(100, raw); combo++; }
    check('得点（全問 Excellent・コンボ倍率・超過点を手計算）' + (exp + g.clearBonus) + ' と一致', g.score === exp + g.clearBonus);
  }
  { const rng = mulberry32(3), g = F.newGame(rng, 0); let T = 0, ev = null;
    for (let k = 0; k < 3000 && g.phase !== 'over'; k++) { T += 100; ev = F.tick(g, T) || ev; if (g.phase === 'resolving') { T += 420; F.tick(g, T); F.advance(g, T, rng); } }
    check('何もしないと 1秒1% で減り、100秒で体力0 → 終了（クリアではない）', g.phase === 'over' && !g.cleared && g.hp === 0 && Math.abs(T / 1000 - 100) < 0.6); }
  { const rng = mulberry32(4), g = F.newGame(rng, 0); let T = 0;
    for (let k = 0; k < 5 && g.phase !== 'over'; k++) { T += 500; F.answer(g, ...wrongOf(g), T); T += 420; F.tick(g, T); F.advance(g, T, rng); }
    check('5回ミス（−20%×5）で体力0 → その場で終了', g.phase === 'over' && !g.cleared && g.misses === 5); }
  res.forEach(([n, c]) => console.log((c ? '合格 ' : '不合格 ') + n));
  console.log(allOk ? '=> 全て合格' : '=> 不合格あり');
  process.exit(allOk ? 0 : 1);
}
module.exports = { loadFxf, parseFactor, parsePoly };
