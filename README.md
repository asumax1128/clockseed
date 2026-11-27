# clockseed

『ときの種』— 単一ファイル `index.html` で動くブラウザゲーム（外部ライブラリなし）。

## 遊び方
`index.html` をブラウザで開く。`?fast=10` を付けると育成・建設・加工の時間が10倍速になる（検品用）。

## テスト
ドリルの問題生成（16種）を、ゲーム本体とは別のテスト用コードで検証する。

```
node tests/drill_engine_test.js          # 各タイプ1000問
node tests/drill_engine_test.js 5000     # 問題数を変える
```

`index.html` の `<script id="drill-engine">` だけを取り出し、DOM のない環境で実行して、
正解がちょうど1つ・独立に再計算した答えと一致・選択肢の重複なし・生成値が範囲内、を確認する。

```
node tests/gacha_engine_test.js          # ガチャ（天井・排出・セーブ検証）
node tests/e2e/stage55_effects_e2e.js    # 段階5.5：変種・価格修飾・お手伝い・消耗品（Playwright）
node tests/e2e/stage56_decor_e2e.js      # 段階5.6：飾りの表示・世界樹・鐘・街灯・季節・魅力（Playwright）
```
