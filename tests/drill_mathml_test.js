#!/usr/bin/env node
/* ときの種：ドリルの数式表示（MathML）の自動検証（段階8b）
   使い方：node tests/drill_mathml_test.js   （オプション：1種あたりの問題数 既定1000）
   index.html から <script id="drill-engine"> と <script id="math-render"> を取り出し、DOM のない隔離環境で実行する。
   通常ドリル A〜E の全40種 × N問の「問題文」と「4つの選択肢」すべてについて：
     1) 表示（HTML の文章＋<math>）を、このファイルの MathML 読み取り（独立に書いた XML 解析）で構造つきの文字列に戻し、
        元の文字列（エンジンが作った表記）を、このファイルの別の規則で同じ構造つきの形にしたものと完全に一致させる。
        構造つきの形：根号 √{…}（上線がかかる範囲）、分数 {分子}/{分母}（縦の分数の範囲）、ベクトル vec{…}（矢印がかかる範囲）、
        累乗 ^{…}、添字 _{…}、定積分 ∫_{下端}^{上端}、共役 bar{…}
        → 根号の範囲・分数の範囲・矢印の範囲・上付き・添字がひとつでも違えば不一致になる
     2) 数式の部分に、元の表記（√ ² ³ ^ _ ⃗ ̄ ₀-₉ /）が文字のまま残っていない（文章の部分にも残っていない）
     3) 使っている MathML の要素が決めた範囲だけ（math mrow mn mi mo mfrac msqrt msup msub msubsup mover mspace）で、入れ子が正しい
     4) 表示どうしの重複なし：4つの選択肢の表示（構造つきの形）がすべて異なる
   さらに「壊しテスト」：math-render のソースをわざと壊した版（根号が後ろの文字まで覆う・矢印が消える・AB⃗ の矢印が B だけ・
   分数の分子が1項だけ・分数の分子と分母のかっこ・分数が横書きのまま・累乗や底が上下につかない・積分の上下端が逆・共役の線が消える）を作り、
   上の検査が必ず見つけることを確かめる（その表記を含むタイプで1つ以上の不一致が出れば検出）。
   問題の中身（答え・誤答・範囲・正解がちょうど1つ）は tests/drill_engine_test.js と tests/drill_mutation_test.js が引き続き検証する */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const N = Number(process.argv[2]) || 1000;
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const pick = id => { const m = HTML.match(new RegExp('<script id="' + id + '">([\\s\\S]*?)</script>')); if (!m) throw new Error(id + ' が見つかりません'); return m[1]; };
const run = src => { const sb = {}; vm.createContext(sb); vm.runInContext(src, sb); return sb; };
const D = run(pick('drill-engine')).ClockseedDrill, MR_SRC = pick('math-render');
function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---- MathML の読み取り（このファイルで独立に書いた小さな XML 解析） ----
const ALLOWED = new Set(['math', 'mrow', 'mn', 'mi', 'mo', 'mfrac', 'msqrt', 'msup', 'msub', 'msubsup', 'mover', 'mspace']);
const ARITY = { mfrac: 2, msup: 2, msub: 2, msubsup: 3, mover: 2 };
const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function parseHtml(html) {                      // → [{text}|{math:node}]
  const parts = [], re = /<(\/?)([a-z]+)((?:\s+[a-z-]+="[^"]*")*)\s*>|([^<]+)/g;
  let m, stack = null, root = null;
  while ((m = re.exec(html))) {
    if (m[4] !== undefined) { if (stack) stack[stack.length - 1].kids.push({ t: '#text', v: unesc(m[4]) }); else parts.push({ text: unesc(m[4]) }); continue; }
    const close = m[1] === '/', tag = m[2], attrs = {};
    (m[3] || '').replace(/([a-z-]+)="([^"]*)"/g, (_, k, v) => { attrs[k] = v; });
    if (!close) {
      if (!ALLOWED.has(tag)) throw new Error('使っていない要素 <' + tag + '>');
      const n = { t: tag, attrs, kids: [] };
      if (tag === 'math') { if (stack) throw new Error('math の入れ子'); stack = [n]; root = n; continue; }
      if (!stack) throw new Error('math の外の <' + tag + '>');
      stack[stack.length - 1].kids.push(n); stack.push(n);
    } else {
      if (!stack || stack[stack.length - 1].t !== tag) throw new Error('閉じタグの不一致 </' + tag + '>');
      stack.pop();
      if (!stack.length) { parts.push({ math: root }); stack = null; root = null; }
    }
  }
  if (stack) throw new Error('閉じていない math');
  return parts;
}
const elems = n => n.kids.filter(k => k.t !== '#text');
const textOf = n => n.kids.filter(k => k.t === '#text').map(k => k.v).join('');
// 構造つきの文字列へ（MathML → 元の表記の構造）
function ser(n) {
  const E = elems(n), S = k => ser(k), A = (n.t in ARITY) ? E : null;
  if (A && A.length !== ARITY[n.t]) throw new Error('<' + n.t + '> の子の数が ' + A.length);
  switch (n.t) {
    case 'math': case 'mrow': return E.map((k, i) => {
      if (k.t === 'mo' && textOf(k) === '−') {                  // 符号のマイナス：先頭・演算子のあと（°′は除く）は form="prefix"、それ以外は form なし
        const pv = E[i - 1], unary = !pv || (pv.t === 'mo' && !['°', '′'].includes(textOf(pv)));
        if (unary !== (k.attrs.form === 'prefix')) throw new Error('マイナスの形（符号／引き算）が合わない');
      }
      return S(k); }).join('');
    case 'mn': case 'mi': return textOf(n);
    case 'mo': { const v = textOf(n); return v === '⁡' ? '' : v; }
    case 'mspace': return '';
    case 'msqrt': return '√{' + E.map(S).join('') + '}';
    case 'mfrac': return '{' + S(E[0]) + '}/{' + S(E[1]) + '}';
    case 'msup': return S(E[0]) + '^{' + S(E[1]) + '}';
    case 'msub': return S(E[0]) + '_{' + S(E[1]) + '}';
    case 'msubsup': return S(E[0]) + '_{' + S(E[1]) + '}^{' + S(E[2]) + '}';
    case 'mover': {
      const acc = textOf(E[1]);
      if (E[1].t !== 'mo') throw new Error('mover の上が mo でない');
      if (acc === '→' || acc === '⟶') return 'vec{' + S(E[0]) + '}';
      if (acc === '¯' || acc === '‾') return 'bar{' + S(E[0]) + '}';
      throw new Error('mover の上の記号 ' + acc);
    }
  }
  throw new Error('未対応 ' + n.t);
}
// ---- 元の表記 → 構造つきの文字列（このファイルの別の規則） ----
const STOP = new Set([' ', '+', '−', '-', '×', '÷', '=', '<', '>', '≤', '≥', ',', '(', '|', '±', '·', '→', '/', '{']);
const RSTOP = new Set([' ', '+', '−', '-', '×', '÷', '=', '<', '>', '≤', '≥', ',', ')', '|', '±', '·', '→', '/', '}']);
function canon(src) {
  let s = String(src);
  s = s.replace(/∫_(−?\d+)\^(−?\d+)/g, '∫_{$1}^{$2}');
  s = s.replace(/\^\(([^()]*)\)/g, '^{$1}').replace(/\^(−?\d+)/g, '^{$1}');
  s = s.replace(/[²³]/g, c => '^{' + (c === '²' ? 2 : 3) + '}');
  s = s.replace(/[₀₁₂₃₄₅₆₇₈₉]+/g, m => '_{' + [...m].map(d => '₀₁₂₃₄₅₆₇₈₉'.indexOf(d)).join('') + '}');
  s = s.replace(/√(\d+)/g, '√{$1}');
  s = s.replace(/([A-Z]+)⃗/g, 'vec{$1}').replace(/([a-z])⃗/g, 'vec{$1}').replace(/([a-z])̄/g, 'bar{$1}');
  // 分数：左は直前のかっこの組（中身）か、空白・演算子までの続き（{…} はひとかたまり）。右は直後のかっこの組か、次の区切りまで
  for (let k = s.indexOf('/'); k >= 0; k = s.indexOf('/', k + 1)) {
    let a, b, L, Rr;
    if (s[k - 1] === ')') { let d = 0, j = k - 1; for (; j >= 0; j--) { if (s[j] === ')') d++; else if (s[j] === '(' && --d === 0) break; } a = j; L = s.slice(j + 1, k - 1); }
    else { let j = k - 1; while (j >= 0) { if (s[j] === '}') { let d = 0; for (; j >= 0; j--) { if (s[j] === '}') d++; else if (s[j] === '{' && --d === 0) break; } j--; continue; } if (STOP.has(s[j])) break; j--; } a = j + 1; L = s.slice(a, k); }
    if (s[k + 1] === '(') { let d = 0, j = k + 1; for (; j < s.length; j++) { if (s[j] === '(') d++; else if (s[j] === ')' && --d === 0) break; } b = j + 1; Rr = s.slice(k + 2, j); }
    else { let j = k + 1; while (j < s.length && !RSTOP.has(s[j])) j++; b = j; Rr = s.slice(k + 1, j); }
    const rep = '{' + L + '}⁄{' + Rr + '}';
    s = s.slice(0, a) + rep + s.slice(b); k = a + rep.indexOf('⁄');
  }
  return s.replace(/⁄/g, '/').replace(/ /g, '');
}
const NOTATION = /[√²³^_∫⃗̄₀-₉]/;           // 元の表記が文字のまま残っていないか（∫ は msubsup の中の mo だけ許す）
function display(MR, src) {                           // → { str：構造つきの文字列, errs：問題点 }
  const errs = []; let out = '';
  let parts;
  try { parts = parseHtml(MR.toHtml(src)); } catch (e) { return { str: '', errs: ['解析：' + e.message] }; }
  for (const p of parts) {
    if (p.text !== undefined) { if (NOTATION.test(p.text) || p.text.includes('/')) errs.push('文章に数式の表記が残る：' + p.text); out += p.text; continue; }
    try {
      const walk = (n, inSubsup) => { for (const k of n.kids) { if (k.t === '#text') { if (/[√²³^_⃗̄₀-₉/]/.test(k.v) || (k.v.includes('∫') && !inSubsup)) errs.push('数式に元の表記が残る：' + k.v); } else walk(k, k.t === 'msubsup' || (inSubsup && k.t === 'mo')); } };
      walk(p.math, false); out += ser(p.math);
    } catch (e) { errs.push('MathML：' + e.message); }
  }
  return { str: out.replace(/ /g, ''), errs };
}
// ---- 全40種 × N問 ----
function checkAll(MR, n, seed0, quiet) {
  const ids = Object.keys(D.TYPES), res = {};
  for (const [ti, id] of ids.entries()) {
    const rng = mulberry32(seed0 + ti * 7919);
    const r = { n: 0, strings: 0, mismatch: 0, errs: 0, dup: 0, sample: null, has: new Set() };
    for (let q = 0; q < n; q++) {
      const pb = D.generate(id, rng); r.n++;
      const shown = [];
      for (const [role, src] of [['問題文', pb.prompt]].concat(pb.choices.map((c, k) => ['選択肢' + (k + 1), c.label]))) {
        r.strings++;
        for (const [re, tag] of [[/√/, '根号'], [/\//, '分数'], [/⃗/, 'ベクトル'], [/[²³^]/, '累乗'], [/[₀-₉]/, '対数の底'], [/∫/, '定積分'], [/̄/, '共役']]) if (re.test(src)) r.has.add(tag);
        const d = display(MR, src), want = canon(src);
        if (d.errs.length) { r.errs++; if (!r.sample) r.sample = role + '「' + src + '」' + d.errs[0]; }
        if (d.str !== want) { r.mismatch++; if (!r.sample) r.sample = role + '「' + src + '」 表示 ' + d.str + ' ／ 期待 ' + want; }
        if (role !== '問題文') shown.push(d.str);
      }
      if (new Set(shown).size !== shown.length) r.dup++;
    }
    res[id] = r;
  }
  return res;
}
const MR = run(MR_SRC).ClockseedMath;
const t0 = Date.now(), base = checkAll(MR, N, 4242);
let ok = true, total = 0;
console.log('ドリルの数式表示（MathML）：全' + Object.keys(base).length + '種 × ' + N + '問（問題文＋選択肢4つ）');
console.log('タイプ | 文字列 | 構造の不一致 | 表記の残り・MathML の誤り | 選択肢の表示の重複 | 含む数式');
for (const [id, r] of Object.entries(base)) {
  total += r.strings;
  const good = !r.mismatch && !r.errs && !r.dup; if (!good) ok = false;
  console.log(id + ' | ' + r.strings + ' | ' + r.mismatch + ' | ' + r.errs + ' | ' + r.dup + ' | ' + ([...r.has].join('・') || '—') + (good ? '' : '  ← ' + r.sample));
}
console.log('文字列 ' + total + '件をすべて読み取り（' + ((Date.now() - t0) / 1000).toFixed(1) + '秒）：' + (ok ? '合格' : '不合格'));

// ---- 壊しテスト：math-render のソースをわざと壊す ----
const MUT = [
  ['根号が後ろの文字まで覆う（√3i の i まで）', "rest.match(/^√(\\d+)/)", "rest.match(/^√(\\d+[a-z]?)/)", '根号'],
  ['ベクトルの矢印が消える', "case 'vec': return '<mover accent=\"true\"><mrow>' + R(n.kids) + '</mrow>' + mo(n.kids.length > 1 ? '⟶' : '→', ' stretchy=\"true\"') + '</mover>';", "case 'vec': return R(n.kids);", 'ベクトル'],
  ['AB⃗ の矢印が B だけにかかる', "if (t.t === 'vec' && last.k === 'id' && /[A-Z]/.test(last.v))", "if (false)", 'ベクトル'],
  ['分数の分子が1項だけになる（3π/2 が 3・π/2 に）', "while (a > 0 && !out[a].sp && OPERAND(out[a - 1]) && OPERAND(out[a])) a--;", "while (false) a--;", '分数'],
  ['分数の分子のかっこが外れない', "const unwrap = xs => (xs.length === 1 && xs[0].k === 'group' ? xs[0].kids : xs);", "const unwrap = xs => xs;", '分数'],
  ['分数が横書きのまま', "case 'frac': return '<mfrac><mrow>' + R(n.num) + '</mrow><mrow>' + R(n.den) + '</mrow></mfrac>';", "case 'frac': return R(n.num) + mo('/') + R(n.den);", '分数'],
  ['分数の分子・分母が逆', "case 'frac': return '<mfrac><mrow>' + R(n.num) + '</mrow><mrow>' + R(n.den) + '</mrow></mfrac>';", "case 'frac': return '<mfrac><mrow>' + R(n.den) + '</mrow><mrow>' + R(n.num) + '</mrow></mfrac>';", '分数'],
  ['累乗が上付きにならない', "case 'sup': return '<msup><mrow>' + node(n.base, null, null) + '</mrow><mrow>' + R(n.exp) + '</mrow></msup>';", "case 'sup': return node(n.base, null, null) + R(n.exp);", '累乗'],
  ['対数の底が下付きにならない', "if (n.base.k === 'fn') return '<msub><mi>' + n.base.v + '</mi><mn>' + n.s + '</mn></msub>'", "if (n.base.k === 'fn') return '<mi>' + n.base.v + '</mi><mn>' + n.s + '</mn>'", '対数の底'],
  ['定積分の上端と下端が逆', "'<mrow>' + neg(n.lo) + '</mrow><mrow>' + neg(n.hi) + '</mrow></msubsup>'", "'<mrow>' + neg(n.hi) + '</mrow><mrow>' + neg(n.lo) + '</mrow></msubsup>'", '定積分'],
  ['共役の線が消える', "case 'bar': return '<mover accent=\"true\"><mrow>' + R(n.kids) + '</mrow>' + mo('¯', ' stretchy=\"true\"') + '</mover>';", "case 'bar': return R(n.kids);", '共役'],
  ['根号の中身が空（上線が数字にかからない）', "case 'sqrt': return '<msqrt><mn>' + n.v + '</mn></msqrt>';", "case 'sqrt': return '<msqrt></msqrt><mn>' + n.v + '</mn>';", '根号'],
];
const NM = Math.max(100, Math.round(N / 5));
console.log('\n壊しテスト：math-render をわざと壊した ' + MUT.length + '通り（1種あたり ' + NM + '問）');
let allCaught = true;
for (const [name, from, to, tag] of MUT) {
  if (!MR_SRC.includes(from)) { console.log('× ' + name + '：壊す場所が見つからない（テストの更新が必要）'); allCaught = false; continue; }
  const M = run(MR_SRC.replace(from, to)).ClockseedMath, r = checkAll(M, NM, 4242);
  const target = Object.keys(r).filter(id => base[id].has.has(tag)), caught = target.filter(id => r[id].mismatch || r[id].errs);
  const okm = target.length > 0 && caught.length > 0;
  if (!okm) allCaught = false;
  console.log((okm ? '検出 ' : '見逃し ') + name + '｜' + tag + 'を含む ' + target.length + '種のうち ' + caught.length + '種で不一致（' + caught.join(',') + '）');
}

// ---- 句読点の直後だけを改行の候補にする（段階8f）：問題文と「こたえは…」を、句読点（、。）で終わるまとまり <span class="ph"> に分ける ----
// （まとまりは途中で割らない／行に入らないときだけ次の行へ、はブラウザで確かめる：tests/e2e/stage8f_walk_bgm_breaks_e2e.js）
// 検査：①まとまりの <span> を取り除くと、改行の候補なしの表示と完全に同じ（文字も数式も変わらない） ②<span> は数式（<math>）の外だけで、入れ子にならない
//       ③まとまりの数 ＝ 文の途中にある句読点の数 ＋ 1 ④最後以外のまとまりは句読点（と閉じかっこ）で終わり、途中に句読点がない ⑤まとまりは空白で始まらない・空でない
const PUNCT = /[、。]/, CLOSE = /[」』）)]/;
function wantPhrases(src) {                                   // 独立に書いた分け方：句読点（＋続く閉じかっこ）のあと、と、かっこ書き「（」の直前で区切る。かっこの中・「）」の直後では区切らない。残りが空白だけなら区切らない
  const out = []; let cur = '', dep = 0;
  for (let k = 0; k < src.length; k++) {
    if (src[k] === '（') { if (dep === 0 && /\S/.test(cur)) { out.push(cur); cur = ''; } dep++; }
    else if (src[k] === '）') dep = Math.max(0, dep - 1);
    cur += src[k];
    if (PUNCT.test(src[k]) && dep === 0) { while (k + 1 < src.length && CLOSE.test(src[k + 1])) { cur += src[++k]; if (src[k] === '）') dep = Math.max(0, dep - 1); } if (/\S/.test(src.slice(k + 1))) { out.push(cur); cur = ''; } } }
  out.push(cur); return out.map(x => x.replace(/^ +/, '')).filter(x => x !== '');
}
function breakChecks(MR, n, seed0) {
  const res = { n: 0, strip: 0, inMath: 0, count: 0, ends: 0, hasBr: 0, sample: null };
  const one = src => {
    res.n++;
    const a = MR.toHtml(src), b = MR.toHtml(src, { phrases: true });
    if (b.replace(/<span class="ph">|<\/span>/g, '') !== a) { res.strip++; res.sample = res.sample || '①' + src; }
    let dm = 0, ds = 0, bad = false; const texts = [];
    for (const tk of b.split(/(<\/?math>|<span class="ph">|<\/span>)/)) {
      if (tk === '<math>') dm++; else if (tk === '</math>') dm--;
      else if (tk === '<span class="ph">') { if (dm > 0 || ds > 0) bad = true; ds++; texts.push(''); } else if (tk === '</span>') ds--;
      else if (ds === 1 && dm === 0 && !/^<\/?(math|mrow|mn|mi|mo|mfrac|msqrt|msup|msub|msubsup|mover|mspace)/.test(tk)) texts[texts.length - 1] += tk;
    }
    if (bad || ds !== 0) { res.inMath++; res.sample = res.sample || '②' + src; }
    const want = wantPhrases(src);
    if (texts.length !== want.length) { res.count++; res.sample = res.sample || '③' + src + ' 期待' + want.length + ' 実際' + texts.length; }
    // 各まとまりの「文字」（数式は空に見える）を、元の文の対応する部分から数式を除いたものと比べる代わりに、句読点の位置で確かめる
    const phr = b.match(/<span class="ph">[\s\S]*?<\/span>(?=<span class="ph">|$)/g) || [];
    phr.forEach((ph, k) => { const plain = ph.replace(/<math>[\s\S]*?<\/math>/g, '').replace(/<[^>]+>/g, '');
      const mid = plain.replace(/[」』）)]+$/, '');
      let outside = mid, pv; do { pv = outside; outside = outside.replace(/（[^（）]*）/g, ''); } while (outside !== pv);                        // かっこの中の句読点は数えない
      const nextParen = k + 1 < phr.length && /^（/.test(phr[k + 1].replace(/<math>[\s\S]*?<\/math>/g, '').replace(/<[^>]+>/g, ''));
      const endsOk = k === phr.length - 1 ? true : ((/[、。]$/.test(mid) || nextParen) && !/[、。]/.test(nextParen && !/[、。]$/.test(mid) ? outside : outside.slice(0, -1)));
      const raw = ph.replace(/<\/?span[^>]*>/g, '');
      if (!endsOk || /^\s/.test(raw) || raw === '') { res.ends++; res.sample = res.sample || '④⑤「' + plain + '」in ' + src; } });
    if (want.length > 1) res.hasBr++;
  };
  for (const [ti, id] of Object.keys(D.TYPES).entries()) {
    const rng = mulberry32(seed0 + ti * 104729);
    for (let q = 0; q < n; q++) { const pb = D.generate(id, rng); one(pb.prompt); one('ざんねん… こたえは「' + pb.choices[pb.answer].label + '」'); }
  }
  for (const src of ['のとき、', '正解は 3 です。', 'こたえは「1、2」', 'A、B。C', '、', '。。', '3 + 4、5 − 2', '「中心(0, 1)、半径 √3」', '2点 A、B について、', '「終わり。」', '彼は言った。「行く、よ」と。', '5 人の中から 3 人の係を選ぶ選び方は何通り？（係の区別はしない）', 'y = x² + 4（−2 ≤ x ≤ 3）の最大値は？', '（a、b）', '（a、b）。次', 'A。（B）C', '（先頭）です、次', 'A（B（C）、D）E、F', '「A（B）」。C', 'A（B）']) one(src);   // 文の終わり・連続・かっこ書きなどの決まったケース
  return res;
}
const BR = breakChecks(MR, Math.max(200, Math.round(N / 5)), 515151);
const brOk = !BR.strip && !BR.inMath && !BR.count && !BR.ends && BR.hasBr > 0;
console.log('\n句読点で終わるまとまり：' + BR.n + '件（そのうち2つ以上に分かれたもの ' + BR.hasBr + '件）｜<span>を除くと同じ ' + (BR.n - BR.strip) + '／数式の外・入れ子なし ' + (BR.n - BR.inMath) + '／まとまりの数が句読点と一致 ' + (BR.n - BR.count) + '／句読点で終わる ' + (BR.n - BR.ends) + ' → ' + (brOk ? '合格' : '不合格 ' + BR.sample));
const BMUT = [
  ['助詞「の」のあとでも分ける（文節の途中で割る）', "if (phrases && depth === 0 && (ch === '、' || ch === '。')) {", "if (phrases && depth === 0 && (ch === '、' || ch === '。' || ch === 'の')) {", s => s],
  ['句読点を消してしまう', "out += esc(ch);\n        if (phrases && depth === 0", "out += phrases && (ch === '、' || ch === '。') ? '' : esc(ch);\n        if (phrases && depth === 0", s => s],
  ['句読点の前で分ける', "out += esc(ch);\n        if (phrases && depth === 0 && (ch === '、' || ch === '。')) {", "if (phrases && (ch === '、' || ch === '。')) out += PH_MARK; out += esc(ch);\n        if (false) {", s => s],
  ['閉じかっこを次のまとまりに回す', "while (i < s.length && /[」』）)]/.test(s[i])) { if (s[i] === '）') depth = Math.max(0, depth - 1); out += esc(s[i++]); }", "", s => s],
  ['最後の句読点のあとにも（空の）まとまりを作る', "if (/\\S/.test(s.slice(i))) out += PH_MARK;", "out += PH_MARK;", s => s.replace(".filter(x => x !== '')", '')],
  ['「（」の直前で分けない', "if (ch === '（') { if (phrases && depth === 0", "if (ch === '（') { if (false && depth === 0", s => s],
  ['「）」の直後でも分ける', "else if (ch === '）') depth = Math.max(0, depth - 1);\n        out += esc(ch);", "else if (ch === '）') { depth = Math.max(0, depth - 1); out += esc(ch) + PH_MARK; continue; }\n        out += esc(ch);", s => s],
  ['かっこの中の句読点でも分ける', "if (phrases && depth === 0 && (ch === '、'", "if (phrases && (ch === '、'", s => s],
  ['「（」のあとでも分ける（かっこの途中）', "depth++; }", "depth++; out += esc(ch) + PH_MARK; continue; }", s => s],
  ['数式の中でも分ける（「,」で）', "      if (core && (TRIGGER", "      if (phrases && core.includes(',')) { out += esc(lead) + mathOf(core).replace(/<mo separator=\"true\">,<\\/mo>/g, '<mo separator=\"true\">,</mo>' + PH_MARK) + esc(trail); i = j; continue; }\n      if (core && (TRIGGER", s => s],
];
let brCaught = true;
console.log('まとまりの壊しテスト：' + BMUT.length + '通り');
for (const [name, from, to, post] of BMUT) {
  if (!MR_SRC.includes(from)) { console.log('× ' + name + '：壊す場所が見つからない'); brCaught = false; continue; }
  const M = run(post(MR_SRC.replace(from, to))).ClockseedMath, r = breakChecks(M, 100, 515151), caught = r.strip || r.inMath || r.count || r.ends;
  if (!caught) brCaught = false;
  console.log((caught ? '検出 ' : '見逃し ') + name + '（不一致 ' + (r.strip + r.inMath + r.count + r.ends) + '件）');
}
// ---- FACTOR×FACTOR（移植版）の式（段階8f）：目標の多項式と、タイルの因数・数を、通常ドリルと同じ MathML で描く。描いた式を読み戻して、元の式と構造まで一致 ----
const FXF = run(pick('fxf-engine')).ClockseedFxF;
function fxfChecks(MR, n, seed0) {
  const res = { n: 0, mismatch: 0, errs: 0, msup: 0, sample: null }, rng = mulberry32(seed0);
  for (let L = 1; L <= 5; L++) for (let q = 0; q < n; q++) {
    const b = FXF.buildBoard(L, new Set(), 6, rng);
    for (const src of [b.target].concat(b.tiles.map(x => x.label))) {
      res.n++; const d = display(MR, src), want = canon(src);
      if (d.errs.length) { res.errs++; res.sample = res.sample || '「' + src + '」' + d.errs[0]; }
      if (d.str !== want) { res.mismatch++; res.sample = res.sample || '「' + src + '」 表示 ' + d.str + ' ／ 期待 ' + want; }
      if (/²/.test(src) && /\^\{2\}/.test(d.str) && MR.toHtml(src).includes('<msup>')) res.msup++;
    }
  }
  return res;
}
const FX = fxfChecks(MR, Math.max(200, Math.round(N / 5)), 909090), fxOk = !FX.mismatch && !FX.errs && FX.msup > 0;
console.log('\nFACTOR×FACTOR の式：Lv1〜5 の目標・タイル ' + FX.n + '件を MathML で描いて読み戻し：構造が一致 ' + (FX.n - FX.mismatch) + '／誤り ' + FX.errs + '（累乗 msup ' + FX.msup + '件）→ ' + (fxOk ? '合格' : '不合格 ' + FX.sample));
const FMUT = [
  ['累乗が上付きにならない', "case 'sup': return '<msup><mrow>' + node(n.base, null, null) + '</mrow><mrow>' + R(n.exp) + '</mrow></msup>';", "case 'sup': return node(n.base, null, null) + R(n.exp);"],
  ['かっこが消える', "case 'group': { const st", "case 'group': return R(n.kids); { const st"],
  ['符号のマイナスが引き算の形のまま（prefix にならない）', "return mo(n.v, ' form=\"prefix\"');", "return mo(n.v);"],
];
let fxCaught = true;
console.log('FACTOR×FACTOR の式の壊しテスト：' + FMUT.length + '通り');
for (const [name, from, to] of FMUT) {
  if (!MR_SRC.includes(from)) { console.log('× ' + name + '：壊す場所が見つからない'); fxCaught = false; continue; }
  const M = run(MR_SRC.replace(from, to)).ClockseedMath, r = fxfChecks(M, 100, 909090), caught = r.mismatch || r.errs;
  if (!caught) fxCaught = false;
  console.log((caught ? '検出 ' : '見逃し ') + name + '（不一致 ' + (r.mismatch + r.errs) + '件）');
}
const pass = ok && allCaught && brOk && brCaught && fxOk && fxCaught;
console.log(pass ? '=> 全て合格' : '=> 不合格');
process.exit(pass ? 0 : 1);
