# clockseed

『ときの種』— 単一ファイル `index.html` で動くブラウザゲーム（外部ライブラリなし）。

## 遊び方
`index.html` をブラウザで開く。`?fast=10` を付けると育成・建設・加工の時間が10倍速になる（検品用）。

## テスト
ドリルの問題生成（A〜E 40種）を、ゲーム本体とは別のテスト用コードで検証する。

```
node tests/drill_engine_test.js          # 各タイプ1000問＋5問セットの構成（通常3・復習1・挑戦1）
node tests/drill_engine_test.js 5000     # 問題数を変える
node tests/drill_mutation_test.js        # 壊しテスト：わざと壊した出題を検査が必ず見つけるか
node tests/fxf_engine_test.js            # FACTOR×FACTOR 移植版：出題・盤面・判定・1ゲームの流れ
node tests/fxf_parity_test.js            # 本家 factorfactor のコードを動かして移植版と突き合わせ（参照 clone があるときだけ）
node tests/tp_engine_test.js             # テンパズル移植版：独立な総当たりソルバーで出題・ティア、判定、盤面の操作
node tests/tp_parity_test.js             # 本家 tenpuzzle のコードを動かして移植版と突き合わせ（参照 clone があるときだけ）
```

`index.html` の `<script id="drill-engine">` だけを取り出し、DOM のない環境で実行して、
正解がちょうど1つ・独立に再計算した答えと一致・選択肢の重複なし・生成値が範囲内・正解位置が均等、を確認する。
C〜E は選択肢の表示（根号・分数・組・不等式・複素数・π など）をテスト側で数値に読み取って比べる。
特殊ドリルは FACTOR×FACTOR とテンパズルの移植版の2本（選択式の S1〜S3 は削除）。

```
node tests/gacha_engine_test.js          # ガチャ（天井・排出・セーブ検証）
node tests/e2e/stage55_effects_e2e.js    # 段階5.5：変種・価格修飾・お手伝い・消耗品（Playwright）
node tests/e2e/stage56_decor_e2e.js      # 段階5.6：飾りの表示・世界樹・鐘・街灯・季節・魅力（Playwright）
node tests/e2e/stage57_drill_e2e.js      # 段階5.7：ドリルC〜E・特殊ドリルの報酬・セット構成・移行（Playwright）
node tests/e2e/stage57b_fxf_e2e.js       # 段階5.7b：FACTOR×FACTOR 移植版をマウスとタッチのドラッグで通しで遊ぶ（Playwright）
node tests/e2e/stage57c_tp_e2e.js        # 段階5.7c：テンパズル移植版をタッチで通しで遊ぶ（Playwright）
```

## FACTOR×FACTOR ソロ・イージー（移植版）
時計塔のドリル →「特殊ドリル」から開く全画面のモジュール。本家 [asumax1128/factorfactor](https://github.com/asumax1128/factorfactor)
（commit `2af9777f6188f70817e25a69ea9a25df1212c848`）のソロ・イージーだけを移植した（`<script id="fxf-engine">`）。
`tests/fxf_parity_test.js` は、clockseed の外に置いた参照用 clone（既定 `../asumax1128/factorfactor`、`FXF_REF` で変更可）の
コードを読み取り専用で動かして比べる。clone は clockseed にコミットしない。

## テンパズル（移植版）
時計塔のドリル →「特殊ドリル」から開く全画面のモジュール。本家 [asumax1128/tenpuzzle](https://github.com/asumax1128/tenpuzzle)
（commit `36808e0b7601c835e0fc195551ce3ab1734d1875`、index.html＝v1.2）のソロプレイの核（入門・初級・中級の269組・カードの合体・
操作方法A/B・判定）を移植した（`<script id="tp-engine">`）。`tests/tp_parity_test.js` は clockseed の外の参照用 clone
（既定 `../asumax1128/tenpuzzle`、`TP_REF` で変更可）のコードを読み取り専用で動かして比べる。
