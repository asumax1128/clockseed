#!/usr/bin/env node
/* ときの種：経済シミュレーション（数値の調整はしない。結果を読むためだけの道具）
   使い方：node tools/economy_sim.js [回数=300]
   - ゲーム本体の数値（作物・レシピ・施設・町Lvの経験値・区画数・ドリルの報酬・時短ストックの上限・追い込みの率・ガチャの値段）は、
     index.html を ?debug=1 で開いて window.__clockseed.constants() から読む（ここに数値を書き写さない）。
   - モデル（1日15分ドリルをするプレイヤー）：
     ・1日3回（7:00・16:00・20:00）ゲームを開く。1回につきドリル5分＝20問（1問15秒）→ 1日60問。正答率80%
       そのうち1日5問は特殊ドリル（高効率：1問 +180秒・カケラ5。正答率80%）
     ・ドリルの難度は町Lvに合わせる：Lv1〜2＝A、Lv3〜4＝B、Lv5〜6＝C、Lv7〜8＝D
     ・ゲームを開いたときに、すぐできることを全部やる：受け取り → 収穫 → 納品 → 施設の建設（解放順、お金が足りれば）
       → 加工（注文に必要な製品を優先）→ 植え付け（注文と加工に必要な作物を優先、なければ小麦）→ 時短
     ・時短は、注文を止めているタイマー（材料の作物・加工・建設）に、残りが短い順に使う（ふつう区間は1秒＝1秒、
       追い込み区間は2秒＝1秒）。開いていない間はタイマーが実時間で進むだけ
     ・注文は3件。納品すると、そのとき出せる品目（作物は町Lvで解放済み、製品は施設が完成・レシピ解放・材料が出せる）から
       一様に新しい注文が出る（ゲームと同じ考え方）。報酬は 単価×個数×1.3 のゴールドと品目の町経験値
     ・入れていないもの：ガチャの効果（変種・お手伝い・消耗品・飾りの魅力）、連続正解のチケット、行商人、隣接・川沿いの短縮、
       注文の引き直し、売却。ガチャはカケラ20個たまるたびに引く（回数だけ数える）
   - 出すもの：町Lv8までの日数、そこまでのガチャ回数、時短ストックの流れ（1日の獲得・使用・上限で捨てた量・
     使いたいのに0だった回数）を、回数分の中央値と幅で */
'use strict';
const path = require('path');
const RUNS = Number(process.argv[2]) || 300;
function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

async function loadConstants() {
  const { chromium } = require('playwright');
  const b = await chromium.launch(), pg = await b.newPage();
  await pg.goto('file://' + path.join(__dirname, '..', 'index.html') + '?debug=1');
  const K = await pg.evaluate(() => window.__clockseed.constants());
  await b.close(); return K;
}

function simulate(K, seed, opt) {
  const rng = mulberry32(seed), MIN = 60000, DAY = 1440 * MIN;
  const SESS = [7 * 60, 16 * 60, 20 * 60], Q_PER_SESS = 20, ACC = 0.8, SP_PER_DAY = 5;
  const lvOf = exp => { let lv = 1; K.TOWN_LV_EXP.forEach((need, i) => { if (exp >= need) lv = i + 1; }); return lv; };
  const drillLv = lv => (lv <= 2 ? 'A' : lv <= 4 ? 'B' : lv <= 6 ? 'C' : 'D');
  const ITEMS = K.ITEMS, CROPS = K.CROPS, RECIPES = K.RECIPES, BUILD = K.BUILDINGS, BKEYS = Object.keys(BUILD);
  const recipeOf = item => ITEMS[item].recipe ? RECIPES[ITEMS[item].recipe] : null;
  const S = { t: 0, exp: 0, gold: 0, stock: 0, shards: 0, pulls: 0, store: {}, plots: [], builds: {}, jobs: {}, orders: [] };
  Object.keys(ITEMS).forEach(k => { S.store[k] = 0; });
  const lv = () => lvOf(S.exp), nPlots = () => K.PLOTS_BY_LV[Math.min(lv(), K.PLOTS_BY_LV.length) - 1];
  const built = k => S.builds[k] && S.builds[k].done <= S.t;
  function avail(k) {                                         // 注文に出せるか（ゲームの itemAvailable と同じ考え方）
    const it = ITEMS[k]; if (!it.recipe) return it.unlockLv <= lv();
    const r = RECIPES[it.recipe]; return built(r.building) && (r.unlockLv || 1) <= lv() && Object.keys(r.inputs).every(avail);
  }
  function newOrder() { const open = Object.keys(ITEMS).filter(avail), k = open[Math.floor(rng() * open.length)], [a, b] = ITEMS[k].orderQty; return { k, qty: a + Math.floor(rng() * (b - a + 1)) }; }
  // 初期：チュートリアルの終わりに近い形（ここでは素の新規：町Lv1・お金0）から始める
  for (let i = 0; i < 3; i++) S.orders.push(newOrder());
  const log = { stockGain: 0, stockUsed: 0, stockWaste: 0, starve: 0, dayStock: [], lvDay: {} };
  // 必要量（注文の残り＋その材料）。作物と製品
  function demand() {
    const need = {};
    const add = (k, n) => { need[k] = (need[k] || 0) + n; const r = recipeOf(k); if (r) { const times = Math.ceil(n / r.product.qty); for (const [i, m] of Object.entries(r.inputs)) add(i, m * times); } };
    for (const o of S.orders) add(o.k, o.qty);
    for (const k of Object.keys(need)) need[k] = Math.max(0, need[k] - S.store[k]);
    return need;
  }
  function act() {
    let changed = true, loops = 0;
    while (changed && loops++ < 50) {
      changed = false;
      for (const k of BKEYS) { const j = S.jobs[k]; if (j && j.done <= S.t) { S.store[j.item] += j.qty; S.jobs[k] = null; changed = true; } }   // 受け取り
      S.plots.forEach((p, i) => { if (p && p.done <= S.t) { S.store[p.crop] += CROPS[p.crop].yield; S.plots[i] = null; changed = true; } });   // 収穫
      S.orders.forEach((o, i) => { if (S.store[o.k] >= o.qty) {                     // 納品
        S.store[o.k] -= o.qty; S.gold += Math.floor(ITEMS[o.k].price * o.qty * 1.3); const before = lv(); S.exp += ITEMS[o.k].orderExp;
        if (lv() > before) for (let L = before + 1; L <= lv(); L++) log.lvDay[L] = S.t / DAY;
        S.orders[i] = newOrder(); changed = true; } });
      for (const k of BKEYS) if (!S.builds[k] && BUILD[k].unlockLv <= lv() && S.gold >= BUILD[k].cost) { S.gold -= BUILD[k].cost; S.builds[k] = { start: S.t, done: S.t + BUILD[k].buildMs, dur: BUILD[k].buildMs }; changed = true; }
      const need = demand();
      for (const k of BKEYS) {                                                  // 加工（足りない製品を優先）
        if (!built(k) || S.jobs[k]) continue;
        const cands = Object.keys(RECIPES).filter(rk => RECIPES[rk].building === k && (RECIPES[rk].unlockLv || 1) <= lv() && need[RECIPES[rk].product.key] > 0 &&
          Object.entries(RECIPES[rk].inputs).every(([i, m]) => S.store[i] >= m));
        if (!cands.length) continue;
        const rk = cands[0], r = RECIPES[rk];
        for (const [i, m] of Object.entries(r.inputs)) S.store[i] -= m;
        S.jobs[k] = { item: r.product.key, qty: r.product.qty, start: S.t, done: S.t + r.ms, dur: r.ms }; changed = true;
      }
      const n = nPlots();                                                       // 植え付け
      while (S.plots.length < n) S.plots.push(null);
      const growing = c => S.plots.filter(p => p && p.crop === c).length * CROPS[c].yield;
      for (let i = 0; i < n; i++) if (!S.plots[i]) {
        const crops = Object.keys(CROPS).filter(c => CROPS[c].unlockLv <= lv());
        const want = crops.map(c => [c, (need[c] || 0) - growing(c)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
        const c = want.length ? want[0][0] : 'wheat';
        S.plots[i] = { crop: c, start: S.t, done: S.t + CROPS[c].growMs, dur: CROPS[c].growMs }; changed = true;
      }
      // 時短：注文につながるタイマーを、残りが短い順に
      const need2 = demand();
      const timers = [].concat(S.plots.filter(p => p && p.done > S.t && need2[p.crop] > 0), BKEYS.map(k => S.jobs[k]).filter(j => j && j.done > S.t && need2[j.item] > 0),
        BKEYS.map(k => S.builds[k]).filter(b => b && b.done > S.t)).sort((a, b) => a.done - b.done);
      if (timers.length && S.stock <= 0) S.starved = true;
      for (const tm of timers) {
        if (S.stock <= 0) break;
        const R = (tm.done - S.t) / 1000, normal = Math.max(0, R - tm.dur / 1000 * K.SKIP_RUSH);
        const costAll = normal + 2 * (R - normal);
        if (S.stock >= costAll) { S.stock -= costAll; log.stockUsed += costAll; tm.done = S.t; changed = true; }
        else { const use = S.stock, cut = use <= normal ? use : normal + (use - normal) / 2; S.stock = 0; log.stockUsed += use; tm.done -= cut * 1000; }
      }
    }
  }
  function drill(nq) {                                            // ドリル（正答率80%）。報酬は町Lvに合わせた難度、特殊ドリルは1日5問まで高効率
    const R = K.DRILL_REWARD[drillLv(lv())];
    for (let q = 0; q < nq; q++) {
      const sp = S.spLeft > 0; if (sp) S.spLeft--;
      if (rng() >= ACC) continue;
      const rw = sp ? K.SPECIAL_REWARD.hi : R;
      const room = K.DRILL_STOCK_MAX - S.stock, gain = Math.min(room, rw.sec);
      S.stock += gain; log.stockGain += rw.sec; log.stockWaste += rw.sec - gain; S.shards += rw.shards;
      while (S.shards >= K.GACHA_COST) { S.shards -= K.GACHA_COST; S.pulls++; }
    }
  }
  let day = 0;
  while (lv() < 8 && day < 400) {
    S.spLeft = SP_PER_DAY;
    for (const m of SESS) {
      S.t = day * DAY + m * MIN;
      act(); drill(Q_PER_SESS); S.starved = false; act();        // 開いたらまず片付け → ドリル5分 → もう一度片付けと時短
      if (S.starved) log.starve++;                              // ドリルのあとでも、注文を止めているタイマーに使うストックが足りなかった回
    }
    log.dayStock.push(S.stock);
    day++;
  }
  return { days: log.lvDay[8] !== undefined ? log.lvDay[8] : null, lvDay: log.lvDay, pulls: S.pulls, gainPerDay: log.stockGain / day, usedPerDay: log.stockUsed / day,
    wastePerDay: log.stockWaste / day, starvePerDay: log.starve / day, endStock: S.stock, dayStock: log.dayStock };
}

(async () => {
  const K = await loadConstants();
  const res = []; for (let k = 0; k < RUNS; k++) res.push(simulate(K, 1000 + k));
  const q = (arr, p) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p * (a.length - 1) + 0.5))]; };
  const fmt = (arr, d = 1) => q(arr, 0.5).toFixed(d) + '（10%〜90%：' + q(arr, 0.1).toFixed(d) + '〜' + q(arr, 0.9).toFixed(d) + '）';
  const ok = res.filter(r => r.days !== null);
  console.log('経済シミュレーション：' + RUNS + '回（1日15分ドリル・1日3回プレイ・正答率80%）');
  console.log('町Lv8 に届いた回数 ' + ok.length + '/' + RUNS);
  for (let L = 2; L <= 8; L++) { const d = ok.map(r => r.lvDay[L]).filter(x => x !== undefined); if (d.length) console.log('  町Lv' + L + ' まで：' + fmt(d) + ' 日'); }
  console.log('町Lv8 までのガチャ回数：' + fmt(ok.map(r => r.pulls), 0) + ' 回');
  console.log('時短ストック（1日あたり・秒）：獲得 ' + fmt(ok.map(r => r.gainPerDay), 0) + '／使用 ' + fmt(ok.map(r => r.usedPerDay), 0) + '／上限で捨てた量 ' + fmt(ok.map(r => r.wastePerDay), 0));
  console.log('ドリルのあとでもストックが足りず、注文を止めているタイマーが残ったプレイ回（1日3回のうち）：' + fmt(ok.map(r => r.starvePerDay), 2));
  const idx = [0, 6, 13, 20, 27, 34].filter(i => ok.every(r => r.dayStock.length > i));
  console.log('1日の終わりの時短ストック（秒、中央値）：' + idx.map(i => (i + 1) + '日目 ' + q(ok.map(r => r.dayStock[i]), 0.5).toFixed(0)).join('・'));
})();
