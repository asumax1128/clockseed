// 段階8b「ドリル問題表示の MathML 統一」の通しテスト（ブラウザで実際に描いた位置を測る）
// 全40種 × 20問を、タブレット横（1180×820）とスマホ縦（390×844）で表示して：
//   分数は縦（分子が分母の上）・根号の上線が中身にかかる・ベクトルの矢印が文字の上（AB⃗ は AB 全体）・
//   定積分の上端が下端より上・対数の底が下付き・選択肢のボタンから数式がはみ出さない／潰れない・
//   答えの表示（不正解のとき）も MathML・特殊ドリル（移植版）の表示は変わらない・JS エラー0件
// スクリーンショット：難度ごとの代表問題（A〜E の全40種）と、ベクトル・根号・分数・定積分・対数の拡大、スマホ縦
const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch();
const url='file:///home/user/clockseed/index.html?debug=1';const O='/home/user/clockseed/screenshots/';
const log=(...a)=>console.log(...a);let fail=0;const ok=(c,msg,...x)=>{log((c?'合格 ':'不合格 ')+msg,...x);if(!c)fail++;};
const errs=[];
async function page(vp,dsf=1){const ctx=await b.newContext({viewport:vp,deviceScaleFactor:dsf});const pg=await ctx.newPage();
  pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await pg.goto(url);await pg.evaluate(()=>{const s=JSON.parse(localStorage.getItem('clockseed.save'));s.tutorial.done=true;s.tutorial.step=10;localStorage.setItem('clockseed.save',JSON.stringify(s));});
  await pg.reload();await pg.waitForTimeout(400);return pg;}
const show=(pg,t,s)=>pg.evaluate(([t,s])=>window.__clockseed.drillShow(t,s),[t,s]);
// 描いた位置の検査（ページの中で測る）
const MEASURE=()=>{
  const R=e=>e.getBoundingClientRect(),out={minFs:99,frac:0,fracBad:[],sqrt:0,sqrtBad:[],vec:0,vecBad:[],int:0,intBad:[],sub:0,subBad:[],sup:0,supBad:[],btnBad:[],squash:[],maths:0};
  const box=document.querySelector('#drillPanel .box');
  for(const m of box.querySelectorAll('math')){out.maths++;
    if(!(m instanceof MathMLElement))out.fracBad.push('MathML として描かれていない');}
  for(const f of box.querySelectorAll('mfrac')){out.frac++;const [n,d]=[...f.children].map(R);if(!(n.bottom<=d.top+1&&n.width>0&&d.width>0))out.fracBad.push(f.textContent);}
  for(const q of box.querySelectorAll('msqrt')){out.sqrt++;const a=R(q),c=R(q.firstElementChild);   // 根号の記号ぶん左に広く、上線（上端）が中身より上、中身は右端まで覆われる
    if(!(a.left<c.left-2&&a.top<c.top-0.5&&a.right>=c.right-0.5))out.sqrtBad.push(q.textContent);}
  for(const v of box.querySelectorAll('mover')){const [base,acc]=[...v.children];const a=R(acc),bb=R(base);if(acc.textContent!=='→'&&acc.textContent!=='⟶')continue;out.vec++;
    const cover=(Math.min(a.right,bb.right)-Math.max(a.left,bb.left))/bb.width;
    if(!(a.bottom<=bb.top+bb.height*0.35&&cover>0.8))out.vecBad.push(base.textContent+' 矢印'+JSON.stringify([a.top,a.bottom,a.left,a.right])+' 文字'+JSON.stringify([bb.top,bb.bottom,bb.left,bb.right]));}
  for(const s of box.querySelectorAll('msubsup')){out.int++;const [op,lo,hi]=[...s.children].map(R);if(!(hi.top<lo.top&&hi.bottom<lo.bottom&&lo.left>=op.left))out.intBad.push(s.textContent);}
  for(const s of box.querySelectorAll('msub')){out.sub++;const [bs,sb]=[...s.children].map(R);if(!(sb.bottom>bs.bottom-1&&sb.left>=bs.right-1))out.subBad.push(s.textContent);}
  for(const s of box.querySelectorAll('msup')){out.sup++;const [bs,sp]=[...s.children].map(R);if(!(sp.top<bs.top+1&&sp.left>=bs.right-1.5))out.supBad.push(s.textContent);}
  const bx=R(box),pr=document.querySelector('#drillPanel .dq-prompt');out.minFs=Math.min(parseFloat(getComputedStyle(pr).fontSize),...[...box.querySelectorAll('.choice')].map(x=>parseFloat(getComputedStyle(x).fontSize)));
  if(bx.left<-1||bx.right>innerWidth+1)out.btnBad.push('パネルが画面からはみ出し');
  if(pr.scrollWidth>pr.clientWidth+1)out.btnBad.push('問題文が横にはみ出し：'+pr.textContent);
  for(const m of pr.querySelectorAll('math')){const r=R(m),p=R(pr);if(r.left<p.left-1||r.right>p.right+1)out.btnBad.push('問題文の数式が欄の外：'+m.textContent);}
  for(const btn of box.querySelectorAll('.choice')){const br=R(btn),fs=parseFloat(getComputedStyle(btn).fontSize);
    if(br.left<bx.left-1||br.right>bx.right+1||br.right>innerWidth)out.btnBad.push('ボタンがパネルの外：'+btn.textContent);
    for(const t of btn.querySelectorAll('.cl')){const r=R(t);if(r.height>fs*1.3*3.2)out.btnBad.push('文字が1字ずつ折り返す：'+btn.textContent);}
    if(btn.scrollWidth>btn.clientWidth+1)out.btnBad.push('横にはみ出し：'+btn.textContent);
    for(const m of btn.querySelectorAll('math')){const r=R(m);if(r.left<br.left-1||r.right>br.right+1||r.top<br.top-1||r.bottom>br.bottom+1)out.btnBad.push('ボタンの外：'+btn.textContent);
      if(parseFloat(getComputedStyle(m).fontSize)<fs*0.95)out.squash.push(btn.textContent+' 文字が縮む '+getComputedStyle(m).fontSize);}
    for(const f of btn.querySelectorAll('mfrac'))if(R(f).height<fs*1.25)out.squash.push('分数が潰れる：'+f.textContent);}
  return out;};
const TYPES=await (async()=>{const pg=await page({width:800,height:600});const t=await pg.evaluate(()=>Object.keys(window.ClockseedDrill.TYPES));await pg.context().close();return t;})();

// ===== 1. 全40種 × 20問 × 2つの画面 =====
for(const [vp,name] of [[{width:1180,height:820},'タブレット横'],[{width:390,height:844},'スマホ縦']]){
  const pg=await page(vp);const tot={frac:0,sqrt:0,vec:0,int:0,sub:0,sup:0,maths:0};const bad={};let shown=0,minFs=99;
  for(const t of TYPES)for(let s=1;s<=20;s++){await show(pg,t,s*97+t.charCodeAt(1));const m=await pg.evaluate(MEASURE);shown++;
    for(const k of Object.keys(tot))tot[k]+=m[k];minFs=Math.min(minFs,m.minFs);
    for(const k of ['fracBad','sqrtBad','vecBad','intBad','subBad','supBad','btnBad','squash'])if(m[k].length){bad[k]=bad[k]||[];if(bad[k].length<3)bad[k].push(t+':'+m[k][0]);}}
  log('['+name+'] '+shown+'問を表示：<math> '+tot.maths+'個（分数 '+tot.frac+'・根号 '+tot.sqrt+'・ベクトル '+tot.vec+'・定積分 '+tot.int+'・対数の底などの下付き '+tot.sub+'・上付き '+tot.sup+'）');
  ok(!bad.fracBad,'['+name+'] 分数はすべて縦（分子が分母の上）',bad.fracBad||'');
  ok(!bad.sqrtBad,'['+name+'] 根号の上線が中身の全体にかかる',bad.sqrtBad||'');
  ok(!bad.vecBad&&tot.vec>0,'['+name+'] ベクトルの矢印は文字の上（AB⃗ は AB 全体の上）',bad.vecBad||'');
  ok(!bad.intBad&&tot.int>0,'['+name+'] 定積分の上端は上、下端は下',bad.intBad||'');
  ok(!bad.subBad&&!bad.supBad,'['+name+'] 対数の底は下付き、累乗は上付き',(bad.subBad||[]).concat(bad.supBad||[]));
  ok(!bad.btnBad,'['+name+'] 問題文と選択肢の数式が欄・ボタン・パネル・画面からはみ出さない',bad.btnBad||'');
  ok(minFs>=14,'['+name+'] 入りきらない式だけ文字を小さくする（最小 '+minFs+'px、下限14px）');
  ok(!bad.squash,'['+name+'] 数式が潰れない（ボタンの中で文字が縮まない・分数の高さは文字の1.25倍以上）',bad.squash||'');
  await pg.context().close();}

// ===== 2. 表記ごとの確認（矢印・根号の範囲）と答えの表示 =====
{const pg=await page({width:1180,height:820},2);
  const find=(t,re)=>pg.evaluate(([t,re])=>{const rx=new RegExp(re);for(let s=1;s<3000;s++){let a=s>>>0;const rng=()=>{a=(a+0x6D2B79F5)>>>0;let x=a;x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);return((x^(x>>>14))>>>0)/4294967296;};
    const p=window.ClockseedDrill.generate(t,rng);if(rx.test(p.prompt+' '+p.choices.map(c=>c.label).join(' ')))return s;}return 0;},[t,re]);
  const sAB=await find('E6','\\|AB'),sI=await find('E7','√3i'),sD3=await find('D3','\\(.*√.*\\)/'),sE3=await find('E3','∫_−'),sD2=await find('D2','log.*/'),sE8=await find('E8','±');
  await show(pg,'E6',sAB);let r=await pg.evaluate(()=>{const v=[...document.querySelectorAll('#drillPanel .dq-prompt mover')].map(m=>m.firstElementChild.textContent);return v;});
  ok(r.includes('AB'),'[ベクトル] AB⃗ の矢印は A と B の両方の上（1つの mover）',JSON.stringify(r));
  await pg.locator('#drillPanel .box').screenshot({path:O+'70_mathml_vector.png'});
  await show(pg,'E7',sI);r=await pg.evaluate(()=>[...document.querySelectorAll('#drillPanel .dq-prompt msqrt')].map(q=>q.textContent));
  ok(r.length&&r.every(x=>/^\d+$/.test(x)),'[根号] √3i は √3 の上線が 3 だけ（i は外）',JSON.stringify(r));
  await pg.locator('#drillPanel .box').screenshot({path:O+'71_mathml_sqrt.png'});
  await show(pg,'D3',sD3);await pg.locator('#drillPanel .box').screenshot({path:O+'72_mathml_fraction.png'});
  await show(pg,'E3',sE3);await pg.locator('#drillPanel .box').screenshot({path:O+'73_mathml_integral.png'});
  await show(pg,'D2',sD2);await pg.locator('#drillPanel .box').screenshot({path:O+'74_mathml_log.png'});
  await show(pg,'E8',sE8);await pg.locator('#drillPanel .box').screenshot({path:O+'75_mathml_conic.png'});
  // 不正解のときの「こたえは…」も MathML
  const info=await show(pg,'D3',sD3);await pg.locator('.choice').nth((info.answer+1)%4).click();await pg.waitForTimeout(200);
  ok(await pg.locator('#dqFb math').count()>0&&(await pg.locator('#dqFb mfrac, #dqFb msqrt').count())>0,'[答えの表示] 不正解のときの「こたえは…」も MathML（分数・根号）');
  await pg.context().close();}

// ===== 3. 難度ごとの代表問題（全40種）を1枚ずつ =====
{const pg=await page({width:1180,height:820},1);const shots={};const sheet=await (await b.newContext({viewport:{width:2412,height:800}})).newPage();
  for(const t of TYPES){await show(pg,t,5);shots[t]=(await pg.locator('#drillPanel .box').screenshot()).toString('base64');}
  for(const L of ['A','B','C','D','E']){const ids=TYPES.filter(t=>t[0]===L);
    await sheet.setContent('<html><body style="margin:0;background:#3e2a1a;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:6px;width:2400px">'+ids.map(t=>'<div style="position:relative"><img style="width:100%;display:block" src="data:image/png;base64,'+shots[t]+'"><b style="position:absolute;right:8px;bottom:6px;background:#5a3a22;color:#fff;padding:2px 8px;font:bold 22px sans-serif">'+t+'</b></div>').join('')+'</body></html>');
    await sheet.screenshot({path:O+'76_mathml_types_'+L+'.png',fullPage:true});}
  await pg.context().close();await sheet.context().close();
  ok(true,'[代表問題] 全40種のスクリーンショット（screenshots/76_mathml_types_A〜E.png）');}

// ===== 4. スマホ縦のスクリーンショット・特殊ドリルは変えない =====
{const pg=await page({width:390,height:844},2);await show(pg,'D8',3);await pg.screenshot({path:O+'77_mathml_phone_circle.png'});
  await show(pg,'D3',2);await pg.screenshot({path:O+'78_mathml_phone_fraction.png'});await pg.context().close();
  const p2=await page({width:1180,height:820});await p2.evaluate(()=>{const s=JSON.parse(localStorage.getItem('clockseed.save'));s.townExp=300;localStorage.setItem('clockseed.save',JSON.stringify(s));});await p2.reload();await p2.waitForTimeout(400);
  const c=await p2.evaluate(()=>window.__clockseed.towerCenter());await p2.mouse.click(c.x,c.y);await p2.waitForTimeout(250);await p2.locator('[data-sp="FXF"]').click();await p2.waitForTimeout(200);await p2.locator('#fxfStart').click();await p2.waitForTimeout(2600);
  const fx=await p2.evaluate(()=>({math:document.querySelectorAll('#fxfPanel math').length,tiles:document.querySelectorAll('#fxfGrid .fxf-tile').length,sup:document.querySelectorAll('#fxfPanel sup').length}));
  ok(fx.math===0&&fx.tiles===6,'[特殊ドリル] FACTOR×FACTOR 移植版の表示はこれまでどおり（MathML にしない）',JSON.stringify(fx));
  await p2.context().close();}

ok(errs.length===0,'[JS エラー] 0件',errs.slice(0,3));
log(fail?'=> 不合格 '+fail+'件':'=> 全て合格');
await b.close();process.exit(fail?1:0);
})();
