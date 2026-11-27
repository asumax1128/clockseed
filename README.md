# clockseed

『ときの種』— 単一ファイル `index.html` で動くブラウザゲーム（外部ライブラリなし）。

## 遊び方
`index.html` をブラウザで開く。`?fast=10` を付けると育成・建設・加工の時間が10倍速になる（検品用）。

## テスト
ドリルの問題生成（A〜E 40種＋特殊ドリル3種）を、ゲーム本体とは別のテスト用コードで検証する。

```
node tests/drill_engine_test.js          # 各タイプ1000問＋5問セットの構成（通常3・復習1・挑戦1）
node tests/drill_engine_test.js 5000     # 問題数を変える
node tests/drill_mutation_test.js        # 壊しテスト：わざと壊した出題を検査が必ず見つけるか
```

`index.html` の `<script id="drill-engine">` だけを取り出し、DOM のない環境で実行して、
正解がちょうど1つ・独立に再計算した答えと一致・選択肢の重複なし・生成値が範囲内・正解位置が均等、を確認する。
C〜E は選択肢の表示（根号・分数・組・不等式・複素数・π など）をテスト側で数値に読み取って比べ、
テンパズルは式を独立に構文解析して「全て計算でき、4つの数を1回ずつ使い、正解だけが10」を確かめる。

```
node tests/gacha_engine_test.js          # ガチャ（天井・排出・セーブ検証）
node tests/e2e/stage55_effects_e2e.js    # 段階5.5：変種・価格修飾・お手伝い・消耗品（Playwright）
node tests/e2e/stage56_decor_e2e.js      # 段階5.6：飾りの表示・世界樹・鐘・街灯・季節・魅力（Playwright）
node tests/e2e/stage57_drill_e2e.js      # 段階5.7：ドリルC〜E・特殊ドリルの報酬・セット構成・移行（Playwright）
```
