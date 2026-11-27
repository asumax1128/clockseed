#!/usr/bin/env node
/* ときの種：ガチャエンジンの自動検証（ゲーム本体とは別のテスト用コード）
   使い方：node tests/gacha_engine_test.js   （オプション：統計の試行回数 例 node tests/gacha_engine_test.js 300000）
   - index.html から <script id="gacha-engine"> だけを取り出し、DOM のない隔離環境で実行する
   検証内容
     1) 50種のデータ件数（カテゴリ別・レア度別・その組み合わせ）が設計どおり。id・名前の重複なし
     2) 排出率：レア度の割合が 55/30/12/3 の近傍（天井なしの抽選／天井つきの実際の排出の両方）。
        レア度の中で均等に選ばれていること
     3) 天井カウンタの単体テスト（レア以上10回・SR以上25回・激レア50回。「達したら次の1回」で確定）
     4) 初回固定（まる小麦）。2回目以降は通常抽選
     5) 被り変換（種→肥料1個／お手伝い→カケラ5個／飾り・消耗品は所持数が増える）
     6) セーブの整形（sanitize） */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const TRIALS = Number(process.argv[2]) || 100000;
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/<script id="gacha-engine">([\s\S]*?)<\/script>/);
if (!m) { console.error('gacha-engine の <script> が見つかりません'); process.exit(1); }
const sandbox = {}; vm.createContext(sandbox); vm.runInContext(m[1], sandbox);
const G = sandbox.ClockseedGacha;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('  NG: ' + msg); } return cond; };
const sec = t => console.log('\n■ ' + t);
const pct = (n, d) => (100 * n / d).toFixed(2) + '%';

// ---------- 1. 50種のデータ件数 ----------
sec('1. 50種のデータ件数');
// 設計どおりの内訳（仕様書の一覧を、エンジンのデータとは別に数えて書き下した値）
const SPEC = {
  total: 50,
  cat: { seed: 16, decor: 14, helper: 11, cons: 9 },
  rar: { C: 22, R: 14, SR: 9, UR: 5 },
  matrix: { seed: { C: 8, R: 3, SR: 3, UR: 2 }, decor: { C: 6, R: 4, SR: 2, UR: 2 }, helper: { C: 4, R: 4, SR: 2, UR: 1 }, cons: { C: 4, R: 3, SR: 2, UR: 0 } },
};
const count = (f) => G.ITEMS.filter(f).length;
ok(G.ITEMS.length === SPEC.total, '合計 ' + G.ITEMS.length + ' != 50');
console.log('合計: ' + G.ITEMS.length + '種');
for (const c of G.CAT_ORDER) {
  const n = count(i => i.cat === c); ok(n === SPEC.cat[c], c + ' の件数 ' + n);
  const row = G.RARITIES.map(r => { const k = count(i => i.cat === c && i.r === r); ok(k === SPEC.matrix[c][r], c + '/' + r + ' = ' + k); return G.RARITY_LABEL[r] + k; });
  console.log('  ' + G.CATS[c] + ' ' + n + '種（' + row.join(' / ') + '）');
}
console.log('  レア度別: ' + G.RARITIES.map(r => { const k = count(i => i.r === r); ok(k === SPEC.rar[r], r + ' の件数 ' + k); return G.RARITY_LABEL[r] + k; }).join(' / '));
ok(new Set(G.ITEMS.map(i => i.id)).size === 50, 'id に重複');
ok(new Set(G.ITEMS.map(i => i.name)).size === 50, '名前に重複');
ok(G.ITEMS.every(i => i.fx && i.fx.length > 0 && i.name && G.RARITIES.includes(i.r) && G.CATS[i.cat]), '効果文・名前・レア度・カテゴリが空');
ok(G.byId.sd01.fx === '見た目が丸い。売値+5%', 'まる小麦の効果文が設計書の文面と違う');
ok(G.ITEMS.filter(i => i.cat === 'cons' && i.units === 3).map(i => i.name).join() === '肥料x3,肥料・改x3', '肥料x3／肥料・改x3 は1回で3個');
// 設計書の一覧の名前が全てあること（レア度つき）
const NAMES = { C: 'まる小麦 ほしにんじん こがねじゃが ながーいとうもろこし ミニかぼちゃ ハートにんじん ツインとうもろこし ほしふさぶどう 木のベンチ 花壇・赤 小さな噴水 街灯 石の小道 木の柵セット かかし 配達ねこ 水やり少年 郵便カラス 肥料x3 時の砂・10分 注文リロール券 注文ブースト券',
  R: 'あおトマト むらさきじゃが きんかぼちゃ 風見鶏つき看板 花壇・季節の花 ガーデンアーチ ガラスドーム 見習いパン職人 乳しぼり上手なおばあさん 収穫どき番 天気読みじいさん 肥料・改x3 時の砂・30分 ダブル収穫券',
  SR: 'しろいちご あめぶどう ゆきトマト 町のシンボルツリー 四季の庭園 行商人 伝説の庭師 即完成券 全体時の砂',
  UR: 'にじ小麦 ほしぞらいちご 時計塔の金の鐘 世界樹の苗 時の番人' };
for (const r of G.RARITIES) {
  const want = NAMES[r].split(' ').sort().join(','), have = G.ITEMS.filter(i => i.r === r).map(i => i.name).sort().join(',');
  ok(want === have, r + ' の名前の一覧が設計書と違う\n   設計: ' + want + '\n   実装: ' + have);
}

// ---------- 2. 排出率 ----------
sec('2. 排出率（固定シード、' + TRIALS + '回）');
{
  const rng = mulberry32(20261127), c = { C: 0, R: 0, SR: 0, UR: 0 };
  for (let i = 0; i < TRIALS; i++) c[G.drawRarity(rng)]++;
  console.log('天井なしの抽選 : ' + G.RARITIES.map(r => G.RARITY_LABEL[r] + ' ' + pct(c[r], TRIALS)).join(' / ') + '   （目標 55/30/12/3）');
  for (const r of G.RARITIES) ok(Math.abs(100 * c[r] / TRIALS - G.RATES[r]) <= 0.6, '天井なしの ' + r + ' の割合が目標から0.6pt以上ずれた');
}
{
  const rng = mulberry32(777), g = G.freshState(), c = { C: 0, R: 0, SR: 0, UR: 0 }, per = {};
  for (let i = 0; i < TRIALS; i++) { const r = G.pullOnce(g, rng); c[r.rarity]++; per[r.id] = (per[r.id] || 0) + 1; }
  const rate = r => 100 * c[r] / TRIALS;
  console.log('天井つき（実際） : ' + G.RARITIES.map(r => G.RARITY_LABEL[r] + ' ' + pct(c[r], TRIALS)).join(' / '));
  // 天井があるため激レアは目標より少し上がる（理論値：1回おきの確率3%で50回外すと51回目が確定 → 約3.8%）
  let q = 1, cyc = 0; for (let k = 0; k <= G.PITY.ur; k++) { cyc += q; q *= 0.97; }
  console.log('   激レアの理論値（天井込み）: ' + (100 / cyc).toFixed(2) + '%');
  ok(Math.abs(rate('UR') - 100 / cyc) <= 0.25, '激レアの実測が天井込みの理論値から外れた');
  ok(rate('C') >= 53 && rate('C') <= 57 && rate('R') >= 28.5 && rate('R') <= 31.5 && rate('SR') >= 11 && rate('SR') <= 13.5 && rate('UR') >= 2.8 && rate('UR') <= 4.2, '天井つきの割合が 55/30/12/3 の近傍（±2pt、激レアは天井分を許容）から外れた');
  // レア度の中で均等
  for (const r of G.RARITIES) {
    const pool = G.byRarity[r], exp = c[r] / pool.length;
    const worst = Math.max(...pool.map(i => Math.abs((per[i.id] || 0) - exp) / exp));
    ok(worst <= 0.2, r + ' の中で偏りが大きい（最大 ' + (100 * worst).toFixed(1) + '%）');
    console.log('   ' + G.RARITY_LABEL[r] + ' ' + pool.length + '種の中の偏り 最大 ±' + (100 * worst).toFixed(1) + '%');
  }
}

// ---------- 3. 天井 ----------
sec('3. 天井カウンタの単体テスト');
const zero = () => 0;                                   // 常に先頭（＝コモン）を引く乱数
const warmed = () => { const g = G.freshState(); g.firstUsed = true; return g; };      // 初回固定を済ませた状態
{
  // レア以上：10回外したら次（11回目）が確定
  const g = warmed(), seq = [];
  for (let i = 0; i < 12; i++) seq.push(G.pullOnce(g, zero));
  ok(seq.slice(0, 10).every(r => r.rarity === 'C' && !r.forced), 'R天井: 10回目まではコモン（天井なし）');
  ok(seq[10].forced === 'R' && seq[10].rarity !== 'C', 'R天井: 10回外した次の1回はレア以上確定 → ' + seq[10].rarity);
  ok(g.pity.r === 1, 'R天井: 確定後にカウンタがリセットされる（その後コモンで+1） → ' + g.pity.r);
  console.log('  レア以上：コモン10連続の次（11回目）=' + seq[10].rarity + '（確定）、その次=' + seq[11].rarity);
}
{
  // 9回連続コモン → 10回目はまだ確定ではない（「10回に達したら次」）
  const g = warmed(); for (let i = 0; i < 9; i++) G.pullOnce(g, zero);
  ok(g.pity.r === 9 && G.pityNeed(g) === null, '9回外した時点では確定ではない');
  const r10 = G.pullOnce(g, zero);
  ok(r10.rarity === 'C' && g.pity.r === 10 && G.pityNeed(g) === 'R', '10回目（まだコモン）で10に達し、次が確定になる');
  console.log('  9回連続コモン → 10回目=' + r10.rarity + '（カウンタ10に到達）→ 次の1回がレア以上確定');
}
{
  // SR以上：25回外したら次が確定。ここではレア（rng=0 → 確定ならRが先頭）が間に入ってもSRカウンタは進む
  const g = warmed(); const seq = [];
  for (let i = 0; i < 27; i++) seq.push(G.pullOnce(g, zero));
  const forcedSR = seq.findIndex(r => r.forced === 'SR');
  ok(forcedSR === 25, 'SR天井: 26回目が確定（実際 ' + (forcedSR + 1) + '回目）');
  ok(seq[25].rarity === 'SR', 'SR天井: 確定の1回はSR以上 → ' + seq[25].rarity);
  ok(seq.slice(0, 25).every(r => r.rarity === 'C' || r.rarity === 'R'), 'SR天井: それまではSR以上が出ない');
  // 26回目（SR確定）で SR・レアのカウンタが0になり、27回目（コモン）で 1 になる。激レアのカウンタは27まで進む
  ok(seq[25].rarity === 'SR' && seq[26].rarity === 'C' && g.pity.sr === 1 && g.pity.r === 1 && g.pity.ur === 27, 'SR天井: 確定でSR・レアのカウンタがリセット（27回目で+1）、激レアは進み続ける → ' + JSON.stringify(g.pity));
  console.log('  SR以上：25回外した次（26回目）=' + seq[25].rarity + '（確定）。途中のレア（10回ごとの確定）ではSRカウンタはリセットされない');
}
{
  // 激レア：50回外したら次が確定
  const g = warmed(); const seq = [];
  for (let i = 0; i < 52; i++) seq.push(G.pullOnce(g, zero));
  const forcedUR = seq.findIndex(r => r.forced === 'UR');
  ok(forcedUR === 50, 'UR天井: 51回目が確定（実際 ' + (forcedUR + 1) + '回目）');
  ok(seq[50].rarity === 'UR', 'UR天井: 確定の1回は激レア → ' + seq[50].rarity);
  ok(seq.slice(0, 50).every(r => r.rarity !== 'UR'), 'UR天井: それまでは激レアが出ない');
  ok(seq[50].rarity === 'UR' && seq[51].rarity === 'C' && g.pity.r === 1 && g.pity.sr === 1 && g.pity.ur === 1, '激レア（51回目）で3つのカウンタが全て0になり、52回目（コモン）で各1 → ' + JSON.stringify(g.pity));
  console.log('  激レア：50回外した次（51回目）=' + seq[50].rarity + '（確定）、カウンタは全てリセット');
}
{
  // 優先順位：UR天井とSR天井が同時なら激レア、SRとRなら SR以上
  const g = warmed(); g.pity = { r: 30, sr: 30, ur: 50 };
  ok(G.pityNeed(g) === 'UR', '優先順位: UR > SR > R');
  g.pity = { r: 12, sr: 25, ur: 3 }; ok(G.pityNeed(g) === 'SR', '優先順位: SR');
  g.pity = { r: 10, sr: 3, ur: 3 }; ok(G.pityNeed(g) === 'R', '優先順位: R');
  g.pity = { r: 9, sr: 24, ur: 49 }; ok(G.pityNeed(g) === null, '9/24/49 ではまだ確定でない');
  // 確定の中身：レア以上の中では元の排出率（30:12:3）に比例。常に天井以上
  const g2 = warmed(), rng = mulberry32(5), cnt = { R: 0, SR: 0, UR: 0 };
  for (let i = 0; i < 30000; i++) { g2.pity = { r: 10, sr: 0, ur: 0 }; const r = G.pullOnce(g2, rng); ok(r.rarity !== 'C', 'R確定でコモンが出た'); cnt[r.rarity]++; }
  console.log('  レア以上確定の中身(3万回): R ' + pct(cnt.R, 30000) + ' / SR ' + pct(cnt.SR, 30000) + ' / UR ' + pct(cnt.UR, 30000) + '  （理論 66.7/26.7/6.7）');
  ok(Math.abs(100 * cnt.R / 30000 - 66.67) < 1.2 && Math.abs(100 * cnt.UR / 30000 - 6.67) < 0.8, 'レア以上確定の内訳が 30:12:3 に比例しない');
}
{
  // 上位が出たら下位のカウンタもリセット（レアのカウンタは SR・UR でもリセット）
  const g = warmed(); g.pity = { r: 5, sr: 5, ur: 5 };
  const rr = () => 0.999;                                // 先頭でなく末尾＝UR を引く
  const r = G.pullOnce(g, rr);
  ok(r.rarity === 'UR' && g.pity.r === 0 && g.pity.sr === 0 && g.pity.ur === 0, 'UR を引いたら全カウンタが0 → ' + JSON.stringify(g.pity));
  g.pity = { r: 5, sr: 5, ur: 5 };
  const sr = G.pullOnce(g, () => 0.9);                   // 0.9*100=90 → C55,R30(85),SR(97) → SR
  ok(sr.rarity === 'SR' && g.pity.r === 0 && g.pity.sr === 0 && g.pity.ur === 6, 'SR を引いたら R・SR が0、UR は+1 → ' + JSON.stringify(g.pity));
}

// ---------- 4. 初回固定 ----------
sec('4. 初回固定');
{
  let allFirst = true;
  for (let seed = 1; seed <= 200; seed++) {
    const g = G.freshState(), r = G.pullOnce(g, mulberry32(seed));
    if (r.id !== 'sd01' || !r.fixed || !r.isNew || g.items.sd01 !== 1 || !g.firstUsed) allFirst = false;
  }
  ok(allFirst, '最初の1回は常にまる小麦（200通りの乱数）');
  const g = G.freshState(), a = G.pullOnce(g, zero);
  ok(a.id === 'sd01' && a.rarity === 'C' && g.pity.r === 1 && g.pity.sr === 1 && g.pity.ur === 1 && g.total === 1, '初回固定でも天井カウンタは通常どおり進む → ' + JSON.stringify(g.pity));
  // 2回目以降は通常抽選：乱数を変えれば結果が変わる
  const seen = new Set();
  for (let seed = 1; seed <= 300; seed++) { const g2 = G.freshState(); G.pullOnce(g2, mulberry32(seed)); const r = G.pullOnce(g2, mulberry32(seed + 1000)); ok(!r.fixed, '2回目は固定でない'); seen.add(r.id); }
  ok(seen.size > 20, '2回目以降は通常抽選（300通りで ' + seen.size + ' 種が出た）');
  console.log('  最初の1回=まる小麦（NEW）、2回目以降は通常抽選（300通りで ' + seen.size + '種）');
  // 初回がまる小麦で、天井が既に溜まっていても初回固定が優先
  const g3 = G.freshState(); g3.pity = { r: 10, sr: 25, ur: 50 }; ok(G.pullOnce(g3, zero).id === 'sd01', '初回固定が最優先');
}

// ---------- 5. 被り変換 ----------
sec('5. 被り変換');
{
  const g = warmed();
  const seed = G.byId.sd04, helper = G.byId.hp03, decor = G.byId.dc06, cons = G.byId.cs02, fert3 = G.byId.cs01;
  const pullId = id => { const it = G.byId[id], r = G.RARITIES, pool = G.byRarity[it.r], idx = pool.indexOf(it);
    // 狙った品目を出す乱数：まずレア度（累積確率の中央）、次に品目
    const lo = { C: 0, R: 55, SR: 85, UR: 97 }[it.r], w = G.RATES[it.r];
    const seq = [(lo + w / 2) / 100, (idx + 0.5) / pool.length]; let k = 0; g.pity = { r: 0, sr: 0, ur: 0 };
    return G.pullOnce(g, () => seq[k++]); };
  let r = pullId('sd04'); ok(r.id === 'sd04' && r.isNew && !r.dup && g.items.sd04 === 1 && g.items.cs01 === 0, '種 1回目：解放（NEW）');
  r = pullId('sd04'); ok(!r.isNew && r.dup === 'fert' && r.fert === 1 && g.items.sd04 === 1 && g.items.cs01 === 1, '種 2回目：肥料+1、解放は永続のまま');
  r = pullId('sd04'); ok(r.dup === 'fert' && g.items.cs01 === 2 && g.items.sd04 === 1, '種 3回目：肥料+1（合計2）');
  r = pullId('hp03'); ok(r.isNew && !r.dup && g.items.hp03 === 1 && r.shards === 0, 'お手伝い 1回目：入手（NEW）');
  r = pullId('hp03'); ok(!r.isNew && r.dup === 'shards' && r.shards === 5 && g.items.hp03 === 1, 'お手伝い 2回目：カケラ+5、入手フラグは1のまま');
  r = pullId('dc06'); ok(r.isNew && g.items.dc06 === 1 && !r.dup, '飾り 1回目：所持数1（NEW）');
  r = pullId('dc06'); ok(!r.isNew && g.items.dc06 === 2 && !r.dup && r.shards === 0 && r.fert === 0, '飾り 2回目：所持数2（変換なし）');
  r = pullId('dc06'); ok(g.items.dc06 === 3, '飾り 3回目：所持数3');
  r = pullId('cs02'); ok(r.isNew && g.items.cs02 === 1 && r.units === 1, '消耗品 1回目：所持数1');
  r = pullId('cs02'); ok(!r.isNew && g.items.cs02 === 2 && !r.dup, '消耗品 2回目：所持数2（被りの概念なし）');
  const before = g.items.cs01; r = pullId('cs01'); ok(r.id === 'cs01' && r.units === 3 && g.items.cs01 === before + 3, '肥料x3：1回で3個増える');
  console.log('  種：1回目=解放／2回目以降=肥料+1（解放は永続）  お手伝い：1回目=入手／2回目以降=カケラ+5');
  console.log('  飾り：所持数が増える（1→2→3）  消耗品：所持数が増える（被りなし）、肥料x3は1回で+3');
  // 図鑑の登録（NEW）：消耗品を使い切っても登録は残る
  g.items.cs02 = 0; ok(g.dex.cs02 === 1, '消耗品を使い切っても図鑑の登録は残る');
}

// ---------- 6. セーブの整形 ----------
sec('6. セーブの整形（sanitize）');
{
  const d = G.sanitize({ pity: { r: -3, sr: 'x', ur: 7 }, total: 12, items: { sd01: 5, dc01: 3, cs02: -2, zz99: 9, hp01: 1 }, dex: { cs02: 1, bogus: 1 } });
  ok(d.pity.r === 0 && d.pity.sr === 0 && d.pity.ur === 7, '壊れたカウンタは0');
  ok(d.items.sd01 === 1 && d.items.dc01 === 3 && d.items.cs02 === 0 && d.items.hp01 === 1 && !('zz99' in d.items), '種は0/1・飾りは所持数・不正値と未知の品目は落とす');
  ok(d.dex.cs02 === 1 && d.dex.sd01 === 1 && d.dex.dc01 === 1 && !d.dex.bogus, '図鑑の登録は保たれる（所持済みの種・飾りは登録扱い）');
  ok(d.firstUsed === true, '総回数が1以上なら初回固定は使用済み');
  const f = G.sanitize(undefined); ok(f.total === 0 && f.firstUsed === false && Object.keys(f.items).length === 50, '無い場合は初期状態（50品目すべて0）');
  console.log('  壊れた値・未知の品目を落とし、50品目すべてのキーを持つ');
}

console.log('\n' + (fails ? '=> 不合格あり（' + fails + '件 / ' + checks + '項目）' : '=> 全て合格（' + checks + '項目）'));
process.exit(fails ? 1 : 0);
