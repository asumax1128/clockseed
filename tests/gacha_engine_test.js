#!/usr/bin/env node
/* ときの種：ガチャエンジンの自動検証（ゲーム本体とは別のテスト用コード）
   使い方：node tests/gacha_engine_test.js   （オプション：統計の試行回数 例 node tests/gacha_engine_test.js 300000）
   - index.html から <script id="gacha-engine"> だけを取り出し、DOM のない隔離環境で実行する
   検証内容
     1) 50種のデータ件数（カテゴリ別・レア度別・その組み合わせ）が設計どおり。id・名前の重複なし。効果文が正本と一致
     2) 排出率：レア度の割合が 55/30/12/3 の近傍（天井なしの抽選／天井つきの実際の排出の両方）。
        レア度の中で均等に選ばれていること
     3) 天井カウンタの単体テスト（レア以上は10回目・SR以上は25回目・激レアは50回目が確定。天井値は9/24/49）
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
// 効果文：設計書の正本（このファイルに書き下した50件）と一字一句一致
const FX = { まる小麦: '見た目が丸い。売値+5%', ほしにんじん: '星型の断面。売値+5%', こがねじゃが: '皮が金色。売値+5%', あおトマト: '青い実。トマトソースの売値+10%',
  ながーいとうもろこし: '通常の1.5倍の長さ。売値+5%', しろいちご: '白いいちご。ジャムの売値+15%', ミニかぼちゃ: '手のひらサイズ。売値+5%',
  あめぶどう: '飴色に透ける。ぶどうジャムの売値+15%', にじ小麦: '七色に光る。パン系の売値+15%', ほしぞらいちご: '星空模様。ケーキ・ジャムパン注文で町経験値+20%',
  ハートにんじん: 'ハート型。売値+5%', むらさきじゃが: '中まで紫。ポテトフライ売値+10%', ツインとうもろこし: '双子の実。売値+5%', きんかぼちゃ: '金色の皮。売値+10%',
  ゆきトマト: '真っ白。トマトソース売値+15%', ほしふさぶどう: '房が星型に並ぶ。売値+5%',
  木のベンチ: '広場に置く木のベンチ', '花壇・赤': '赤い花の花壇', 小さな噴水: '広場の小さな噴水', 風見鶏つき看板: '風見鶏のついた看板', 街灯: '昼は飾り、夜に光る',
  '花壇・季節の花': '自動で色が変わる', 町のシンボルツリー: '魅力スコアが大きく上がる特別枠', 時計塔の金の鐘: '鳴らすと町民が集まる演出のみ', 石の小道: '町並みが締まる基本枠',
  木の柵セット: '畑の囲い用', ガーデンアーチ: '入口に置く用', ガラスドーム: '中の作物が透けて見える', 四季の庭園: '季節で自動で姿が変わる', 世界樹の苗: '実時間でゆっくり育ち、30日かけて大樹になる',
  かかし: '隣接1区画だけ収穫忘れ防止マーク', 配達ねこ: '完成品を倉庫へ自動で運ぶ', 見習いパン職人: 'パン屋だけ時短効率+10%', 水やり少年: '水やり演出担当',
  乳しぼり上手なおばあさん: '牛乳の生産だけ時短効率+10%', 行商人: '週に数回、特定の作物を1.5倍で買い取る注文を持ってくる', 郵便カラス: '注文の更新を教えてくれる',
  収穫どき番: '育ちきった作物を光って知らせる', 伝説の庭師: '変種作物だけ売値+5%', 天気読みじいさん: '次の注文の傾向を1つだけ予告する', 時の番人: '1日1回だけ、即完成を無料で使える',
  肥料x3: '次の収穫が+1個になる（1回分）', '時の砂・10分': '時短ストックに10分追加', 注文リロール券: '町の注文を1回だけ入れ替え', '肥料・改x3': '次の収穫が+2個になる',
  '時の砂・30分': '時短ストックに30分追加', 即完成券: '生産1つを即完成', 注文ブースト券: '次の注文の町経験値+50%', ダブル収穫券: '次の収穫1回だけ収穫数2倍', 全体時の砂: '進行中の全タイマーを10分進める' };
ok(Object.keys(FX).length === 50, '正本の件数');
const fxBad = G.ITEMS.filter(i => FX[i.name] !== i.fx);
ok(fxBad.length === 0, '効果文が正本と違う: ' + fxBad.map(i => i.name + '「' + i.fx + '」').join(' / '));
console.log('  効果文：50件すべて正本と一致' + (fxBad.length ? 'しない（' + fxBad.length + '件）' : ''));

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
  // 天井があるため激レアは目標より少し上がる（理論値：3%で49回外すと50回目が確定 → 約3.9%）
  let q = 1, cyc = 0; for (let k = 0; k <= G.PITY.ur; k++) { cyc += q; q *= 0.97; }   // 1〜49回目は3%、50回目は確定
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
// 規則：該当レア度以上が「出ない回数」が 9／24／49 に達したら次の1回は確定 ＝ 10回目／25回目／50回目が確定
sec('3. 天井カウンタの単体テスト（10回目／25回目／50回目が確定）');
const zero = () => 0;                                   // 常に先頭（＝コモン）を引く乱数
const warmed = () => { const g = G.freshState(); g.firstUsed = true; return g; };      // 初回固定を済ませた状態
ok(G.PITY.r === 9 && G.PITY.sr === 24 && G.PITY.ur === 49, '天井の値が 9/24/49 でない → ' + JSON.stringify(G.PITY));
{
  // レア以上：9回連続コモンの次の10回目がレア以上確定
  const g = warmed(), seq = [];
  for (let i = 0; i < 11; i++) seq.push(G.pullOnce(g, zero));
  ok(seq.slice(0, 9).every(r => r.rarity === 'C' && !r.forced), 'R天井: 9回目まではコモン（天井なし）');
  ok(seq[9].forced === 'R' && seq[9].rarity !== 'C', 'R天井: 9回連続コモンの次の10回目はレア以上確定 → ' + seq[9].rarity);
  ok(seq[10].rarity === 'C' && g.pity.r === 1, 'R天井: 確定でカウンタがリセットされ、11回目（コモン）で1 → ' + g.pity.r);
  console.log('  レア以上：9回連続コモン → 10回目=' + seq[9].rarity + '（確定）、11回目=' + seq[10].rarity);
}
{
  // 8回連続コモンの時点では、次（9回目）はまだ確定ではない
  const g = warmed(); for (let i = 0; i < 8; i++) G.pullOnce(g, zero);
  ok(g.pity.r === 8 && G.pityNeed(g) === null, '8回外した時点では次は確定でない');
  const r9 = G.pullOnce(g, zero);
  ok(r9.rarity === 'C' && g.pity.r === 9 && G.pityNeed(g) === 'R', '9回目（コモン）でカウンタ9に達し、次の10回目が確定になる');
}
{
  // SR以上：24回外した次の25回目が確定。途中のレア確定（10回目・20回目）ではSRカウンタは進み続ける
  const g = warmed(); const seq = [];
  for (let i = 0; i < 26; i++) seq.push(G.pullOnce(g, zero));
  const forcedSR = seq.findIndex(r => r.forced === 'SR');
  ok(forcedSR === 24, 'SR天井: 25回目が確定（実際 ' + (forcedSR + 1) + '回目）');
  ok(seq[24].rarity === 'SR', 'SR天井: 確定の1回はSR以上 → ' + seq[24].rarity);
  ok(seq.slice(0, 24).every(r => r.rarity === 'C' || r.rarity === 'R'), 'SR天井: それまではSR以上が出ない');
  ok(seq[25].rarity === 'C' && g.pity.sr === 1 && g.pity.r === 1 && g.pity.ur === 26, 'SR天井: 確定でSR・レアのカウンタがリセット（26回目で+1）、激レアは進み続ける → ' + JSON.stringify(g.pity));
  console.log('  SR以上：24回外した次の25回目=' + seq[24].rarity + '（確定）。途中のレア確定ではSRカウンタはリセットされない');
}
{
  // 激レア：49回外した次の50回目が確定
  const g = warmed(); const seq = [];
  for (let i = 0; i < 51; i++) seq.push(G.pullOnce(g, zero));
  const forcedUR = seq.findIndex(r => r.forced === 'UR');
  ok(forcedUR === 49, 'UR天井: 50回目が確定（実際 ' + (forcedUR + 1) + '回目）');
  ok(seq[49].rarity === 'UR', 'UR天井: 確定の1回は激レア → ' + seq[49].rarity);
  ok(seq.slice(0, 49).every(r => r.rarity !== 'UR'), 'UR天井: それまでは激レアが出ない');
  ok(seq[50].rarity === 'C' && g.pity.r === 1 && g.pity.sr === 1 && g.pity.ur === 1, '激レア（50回目）で3つのカウンタが全て0になり、51回目（コモン）で各1 → ' + JSON.stringify(g.pity));
  console.log('  激レア：49回外した次の50回目=' + seq[49].rarity + '（確定）、カウンタは全てリセット');
}
{
  // 優先順位：UR天井とSR天井が同時なら激レア、SRとRなら SR以上
  const g = warmed(); g.pity = { r: 30, sr: 30, ur: 49 };
  ok(G.pityNeed(g) === 'UR', '優先順位: UR > SR > R');
  g.pity = { r: 12, sr: 24, ur: 3 }; ok(G.pityNeed(g) === 'SR', '優先順位: SR');
  g.pity = { r: 9, sr: 3, ur: 3 }; ok(G.pityNeed(g) === 'R', '優先順位: R');
  g.pity = { r: 8, sr: 23, ur: 48 }; ok(G.pityNeed(g) === null, '8/23/48 ではまだ確定でない');
  // 確定の中身：レア以上の中では元の排出率（30:12:3）に比例。常に天井以上
  const g2 = warmed(), rng = mulberry32(5), cnt = { R: 0, SR: 0, UR: 0 };
  for (let i = 0; i < 30000; i++) { g2.pity = { r: 9, sr: 0, ur: 0 }; const r = G.pullOnce(g2, rng); ok(r.rarity !== 'C', 'R確定でコモンが出た'); cnt[r.rarity]++; }
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
  const g3 = G.freshState(); g3.pity = { r: 9, sr: 24, ur: 49 }; ok(G.pullOnce(g3, zero).id === 'sd01', '初回固定が最優先');
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
