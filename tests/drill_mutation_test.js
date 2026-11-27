#!/usr/bin/env node
/* ときの種：ドリル検査の「壊しテスト」
   使い方：node tests/drill_mutation_test.js   （オプション：1種あたりの問題数 既定1000。本体の検査と同じ）
   わざと壊した出題（ミュータント）を作り、tests/drill_engine_test.js の検査が必ず不合格にすることを確かめる。
   C〜E の24種のすべてで、どの壊し方も「その壊し方を見つけるための検査」で検出できれば合格
   （たまたま別の検査で落ちたものは検出と数えない）。
     M1 正解の位置ずれ      ：answer を隣の選択肢にずらす（再計算不一致で検出）
     M2 偶然の正解          ：誤答の1つを「正解と同じ値の別表示」に置き換える（正解1つ違反で検出）
     M3 選択肢の重複        ：誤答の1つを別の誤答と同じにする（重複で検出）
     M4 範囲外の生成値      ：params の数値を範囲の外（−1000）へずらす（範囲外で検出）
     M5 正解位置の偏り      ：正解をいつも先頭に置く（正解位置の均等で検出）
     M6 別の形の偶然の正解  ：C4 は √3/3 を 1/√3、分数の答えは 2倍の分子・分母（約分していない形）で誤答に混ぜる
   （選択式の特殊ドリル S1〜S3 は段階5.7b・5.7c で削除したので、式の壊し方 M7 も外した） */
'use strict';
const { loadEngine, checkType } = require('./drill_engine_test.js');
const N = Number(process.argv[2]) || 1000, VERBOSE = process.env.MUT_VERBOSE === "1";

const clone = pb => JSON.parse(JSON.stringify(pb));
const wrongIdx = pb => [0, 1, 2, 3].filter(i => i !== pb.answer);
function bump(params) {                                            // 最初の数値（配列なら先頭要素）を大きくずらす
  for (const k of Object.keys(params)) {
    if (typeof params[k] === 'number') { params[k] -= 1000; return true; }
    if (Array.isArray(params[k]) && typeof params[k][0] === 'number') { params[k][0] -= 1000; return true; }
  }
  return false;
}
function altForm(label) {                                         // 正解と同じ値の別表示
  if (label === '√3/3') return '1/√3';
  let m = label.match(/^(−?\d+)\/(\d+)$/); if (m) return m[1].replace('−', '−') + '0/' + m[2] + '0';   // 約分していない形
  m = label.match(/^(−?\d+)$/); if (m) return '(' + label + ')';
  return label + ' ';                                              // 表示だけ違う（前後の空白）同じ値
}
// 壊し方ごとに、検出を担うはずの検査
const EXPECT = { M1: r => r.recompute > 0, M2: r => r.one > 0, M3: r => r.dup > 0, M4: r => r.range > 0, M5: r => !r.spread, M6: r => r.one > 0 };
const MUTANTS = {
  M1: pb => { pb.answer = (pb.answer + 1) % 4; return pb; },
  M2: pb => { const i = wrongIdx(pb)[0]; pb.choices[i] = { label: pb.choices[pb.answer].label + ' ', key: 'mut' }; return pb; },
  M3: pb => { const [i, j] = wrongIdx(pb); pb.choices[j] = Object.assign({}, pb.choices[i]); return pb; },
  M4: pb => { bump(pb.params); return pb; },
  M5: pb => { const c = pb.choices.splice(pb.answer, 1)[0]; pb.choices.unshift(c); pb.answer = 0; return pb; },
  M6: pb => { const i = wrongIdx(pb)[1]; pb.choices[i] = { label: altForm(pb.choices[pb.answer].label), key: 'mut6' }; return pb; },
};
const D0 = loadEngine(), ids = Object.keys(D0.TYPES).filter(id => /^[CDE]/.test(id));
const table = [];
let allDetected = true;
for (const [mid, mut] of Object.entries(MUTANTS)) {
  const row = { mid, detected: 0, total: 0, missed: [] };
  for (const [ti, id] of ids.entries()) {
    const D = loadEngine(), gen = D.generate;
    D.generate = (type, rng) => mut(clone(gen(type, rng)));
    if (VERBOSE) process.stderr.write(mid + " " + id + "\n");
    const r = checkType(D, id, N, 777 + ti * 131);
    row.total++;
    if (EXPECT[mid](r)) row.detected++; else { row.missed.push(id); allDetected = false; }
  }
  table.push(row);
}
// 壊していない状態では全て合格すること（検査が厳しすぎないこと）
const clean = ids.map((id, ti) => checkType(loadEngine(), id, N, 777 + ti * 131));
const cleanOk = clean.every(r => r.ok);
console.log('ドリル検査の壊しテスト：C〜E 24種、1種あたり' + N + '問');
console.log('壊し方 | 検出したタイプ数 / 対象 | 見逃し');
for (const r of table) console.log(r.mid + ' | ' + r.detected + ' / ' + r.total + ' | ' + (r.missed.join(',') || 'なし'));
console.log('壊していない出題：' + clean.filter(r => r.ok).length + ' / ' + clean.length + ' 合格');
const ok = allDetected && cleanOk;
console.log(ok ? '=> 全ての壊し方を検出（合格）' : '=> 見逃しあり（不合格）');
process.exit(ok ? 0 : 1);
