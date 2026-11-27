#!/usr/bin/env node
/* ときの種：交換掲示板のコード（TOKI-TOWN- ／ TOKI-SEED-）の検証
   使い方：node tests/trade_codec_test.js
   index.html の <script id="trade-codec"> だけを取り出し、DOM のない環境で次を確かめる。
     1) 往復：ランダムな町（Lv1〜8・世界樹の段階・飾り14種の個数）とギフト（変種・ギフトID・発行元ID）を
        発行→読み取りで元に戻る。小文字・空白区切り・区切りなしでも読める
     2) 壊れたコードを弾く：全ての位置の1文字の書き換え、全ての隣どうしの入れ替え、短い・長い・記号入り
     3) 種類違いを弾く：町のコードをギフト欄に、ギフトを町の欄に入れると「種類が違う」。
        接頭辞だけ付け替えたもの（中身は同じ）もチェックで弾く
     4) 範囲外（Lv0・9、世界樹の段階5、世界樹なしで段階あり）と未対応の版を弾く */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/<script id="trade-codec">([\s\S]*?)<\/script>/);
const sb = {}; vm.createContext(sb); vm.runInContext(m[1], sb); const C = sb.ClockseedCode;
function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const A = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
let allOk = true; const out = (name, ok, extra) => { if (!ok) allOk = false; console.log((ok ? '合格 ' : '不合格 ') + name + (extra ? '　' + extra : '')); };
const rng = mulberry32(58);
const randTown = () => { const decor = {}; C.DECOR.forEach(id => { decor[id] = rng() < 0.4 ? 0 : 1 + Math.floor(rng() * 40); }); const has = decor.dc14 > 0;
  return { lv: 1 + Math.floor(rng() * 8), tree: has ? Math.floor(rng() * 5) : 0, decor }; };
const randGift = () => ({ seed: C.SEEDS[Math.floor(rng() * 16)], giftId: C.randomId(8, rng), from: C.randomId(6, rng) });
// 1) 往復
let bad = 0; const towns = [], gifts = [];
for (let k = 0; k < 20000; k++) {
  const t = randTown(), c = C.encodeTown(t), r = C.decodeTown(c); towns.push(c);
  const want = Object.fromEntries(C.DECOR.map(id => [id, Math.min(35, t.decor[id])]));
  if (!r.ok || r.lv !== t.lv || r.tree !== t.tree || JSON.stringify(r.decor) !== JSON.stringify(want)) bad++;
  for (const v of [c.toLowerCase(), c.replace(/-/g, ' '), c.replace(/-/g, ''), ' ' + c + ' ']) { const r2 = C.decodeTown(v); if (!r2.ok || JSON.stringify(r2) !== JSON.stringify(r)) bad++; }
}
out('町のコードの往復 2万件（個数は35で頭打ち）・小文字・空白・区切りなしでも読める', bad === 0, '例 ' + towns[0] + '・不一致 ' + bad);
bad = 0;
for (let k = 0; k < 20000; k++) { const g = randGift(), c = C.encodeGift(g), r = C.decodeGift(c.toLowerCase()); gifts.push(c); if (!r.ok || r.seed !== g.seed || r.giftId !== g.giftId || r.from !== g.from) bad++; }
out('ギフトコードの往復 2万件', bad === 0, '例 ' + gifts[0] + '・不一致 ' + bad);
// 2) 壊れたコード（1文字の書き換え・隣どうしの入れ替えは全て）
function mutants(code, prefix) {
  const body = code.slice(prefix.length).replace(/-/g, ''), res = [];
  for (let i = 0; i < body.length; i++) for (const ch of A) if (ch !== body[i]) res.push(prefix + body.slice(0, i) + ch + body.slice(i + 1));
  for (let i = 0; i + 1 < body.length; i++) if (body[i] !== body[i + 1]) res.push(prefix + body.slice(0, i) + body[i + 1] + body[i] + body.slice(i + 2));
  return res;
}
let n = 0, passed = 0;
for (const c of towns.slice(0, 300)) for (const x of mutants(c, 'TOKI-TOWN-')) { n++; if (C.decodeTown(x).ok) passed++; }
out('町のコード300件の、全ての1文字の書き換え・隣どうしの入れ替えを弾く', passed === 0, n + '通り中 通ってしまった ' + passed);
n = 0; passed = 0;
for (const c of gifts.slice(0, 300)) for (const x of mutants(c, 'TOKI-SEED-')) { n++; if (C.decodeGift(x).ok) passed++; }
out('ギフトコード300件の、全ての1文字の書き換え・隣どうしの入れ替えを弾く', passed === 0, n + '通り中 通ってしまった ' + passed);
const t0 = towns[0];
const cases = [['短い', t0.slice(0, -1), 'length'], ['長い', t0 + '0', 'length'], ['記号入り', t0.replace(/.$/, '#'), 'chars'], ['空', '', 'empty'], ['別の文字列', 'HELLO-1234', 'prefix'],
  ['接頭辞だけ', 'TOKI-TOWN-', 'length']];
for (const [name, x, want] of cases) { const r = C.decodeTown(x); out('町のコード：' + name + 'を弾く', !r.ok && r.error === want, r.error); }
// 3) 種類違い
out('ギフトコードを町の欄に → 種類違い', gifts.slice(0, 100).every(g => { const r = C.decodeTown(g); return !r.ok && r.error === 'kind' && r.kind === 'SEED'; }));
out('町のコードをギフト欄に → 種類違い', towns.slice(0, 100).every(t => { const r = C.decodeGift(t); return !r.ok && r.error === 'kind' && r.kind === 'TOWN'; }));
// 接頭辞だけ付け替え（長さの合うものを作るため、町のチェックで作った本体を SEED として送る）
{ let pass = 0; for (let k = 0; k < 2000; k++) { const body = '1' + A[Math.floor(rng() * 16)] + C.randomId(14, rng); const town = 'TOKI-TOWN-' + body + C.check(body, 7); const asSeed = town.replace('TOKI-TOWN-', 'TOKI-SEED-'); if (C.decodeGift(asSeed).ok) pass++; }
  out('同じ中身で接頭辞だけ付け替えたコードは、種類ごとのチェックで弾く', pass === 0, '2000件中 通ってしまった ' + pass); }
// 4) 範囲外・版
const mk = (body, salt, prefix) => prefix + body + C.check(body, salt);
const z14 = '0'.repeat(14), d14 = '0'.repeat(13) + '1';
const rangeCases = [['Lv0', mk('10' + '0' + z14, 7, 'TOKI-TOWN-'), 'range'], ['Lv9', mk('19' + '0' + z14, 7, 'TOKI-TOWN-'), 'range'], ['世界樹の段階5', mk('185' + d14, 7, 'TOKI-TOWN-'), 'range'],
  ['世界樹なしで段階2', mk('182' + z14, 7, 'TOKI-TOWN-'), 'range'], ['版2', mk('280' + z14, 7, 'TOKI-TOWN-'), 'version']];
for (const [name, x, want] of rangeCases) { const r = C.decodeTown(x); out('町のコード：' + name + 'を弾く', !r.ok && r.error === want, r.error); }
{ const r = C.decodeGift(mk('1G' + 'ABCDEFGH' + 'XYZ123', 13, 'TOKI-SEED-')); out('ギフト：変種の番号16（sd17）を弾く', !r.ok && r.error === 'range', r.error); }
{ const r = C.decodeTown(mk('184' + d14, 7, 'TOKI-TOWN-')); out('町のコード：Lv8・世界樹の段階4（完成形）は受け付ける', r.ok && r.lv === 8 && r.tree === 4); }
console.log(allOk ? '=> 全て合格' : '=> 不合格あり');
process.exit(allOk ? 0 : 1);
