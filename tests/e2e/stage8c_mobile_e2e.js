// 段階8c「スマホ対応（狭い画面のレイアウト調整）」の通しテスト
// 390×844・360×740（スマホ縦）、844×390（スマホ横）で、タッチ操作（指）で主要な操作をすべて行い、
// そのたびに部品の位置を測る：ページが横にはみ出さない／上の帯・案内文・作物ボタン・ズームボタンが画面内に収まり押せる／
// パネルが画面に収まり、入りきらなければパネルの中だけスクロールする／ボタンの大きさ。
// 最後に、タブレット（1180×820 ほか）の上の帯・下の帯が「変更前（main）」と1ピクセルも変わらないことを、
// main の index.html と並べて描いて比べる（git show で取り出したファイルを /tmp に置いてある前提。無ければ git で取り出す）
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),cp=require('child_process');
(async()=>{
const b=await chromium.launch();
const url='file:///home/user/clockseed/index.html?debug=1';const O='/home/user/clockseed/screenshots/';
const log=(...a)=>console.log(...a);let fail=0;const ok=(c,msg,...x)=>{log((c?'合格 ':'不合格 ')+msg,...x);if(!c)fail++;};
const errs=[];
const SIZES=[[390,844,'スマホ縦 390×844','a'],[360,740,'スマホ縦 360×740','b'],[844,390,'スマホ横 844×390','c']];
async function boot(w,h,save,dsf=1,u=url){
  const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:dsf,hasTouch:true,isMobile:w<700});
await ctx.addInitScript(()=>{document.addEventListener('DOMContentLoaded',()=>{if(innerWidth>innerHeight){const s=document.createElement('style');s.textContent='#rotateNotice{display:none!important}';document.head.appendChild(s);}});});   // 段階8d：スマホ横の案内は、中の画面の検査のために隠す（案内そのものは stage8d のテストで確かめる）
  if(save)await ctx.addInitScript(s=>{if(!sessionStorage.getItem('__booted')){sessionStorage.setItem('__booted','1');localStorage.clear();localStorage.setItem('clockseed.save',s);}},JSON.stringify(save));
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await pg.goto(u);await pg.waitForTimeout(700);return pg;}
const H=(pg,f,...a)=>pg.evaluate(([f,a])=>window.__clockseed[f](...a),[f,a]);
const st=pg=>pg.evaluate(()=>JSON.parse(localStorage.getItem('clockseed.save')));
const clone=x=>JSON.parse(JSON.stringify(x));
const BK=['mill','kitchen','bakery','ranch','dairy','jam','restaurant','cake'];
let pg0=await boot(390,844,null);const FRESH=await st(pg0);const CONST=await H(pg0,'constants');await pg0.context().close();
const KITCHEN_RECIPE=Object.keys(CONST.RECIPES).find(r=>CONST.RECIPES[r].building==='kitchen');
const T0=()=>Date.now();
// 町Lv8・全施設・たっぷりの倉庫・育成中と収穫待ちの畑・納品できる注文（チュートリアルは終了）
function rich(over={}){const s=clone(FRESH),T=T0();s.tutorial.done=true;s.tutorial.step=10;s.townExp=2800;s.gold=12345;
  for(const k of Object.keys(s.storage))s.storage[k]=15;
  for(const k of BK)s.buildings[k]={startedAt:T-9e6,builtAt:T-8e6,job:null,lv:1};
  s.buildings.kitchen.job={recipe:KITCHEN_RECIPE,startedAt:T-1000,readyAt:T+90000};
  s.drill.stock=5400;s.drill.shards=4000;s.drill.tickets=2;s.drill.day='';s.drill.dayCount=0;
  s.plots=Array(24).fill(null);s.plots[0]={crop:'wheat',plantedAt:T-9e6,readyAt:T-1000};s.plots[1]={crop:'wheat',plantedAt:T-9e6,readyAt:T-2000};
  s.plots[2]={crop:'carrot',plantedAt:T-1000,readyAt:T+200000};
  s.orders[0]={crop:'wheat',qty:3};s.seenAt=T;
  return Object.assign(s,over);}
// ---- 画面内に収まっているかを、ページの中で測る ----
const MEASURE=()=>{
  const iw=innerWidth,ih=innerHeight,P=[],R=e=>e.getBoundingClientRect(),vis=e=>e&&e.offsetParent!==null||(e&&getComputedStyle(e).position==='fixed'&&getComputedStyle(e).display!=='none');
  const q=s=>document.querySelector(s),topB=R(q('#topBand')),botB=R(q('#botBand')),cv=R(q('#world'));
  if(document.documentElement.scrollWidth>iw)P.push('ページが横にはみ出す（html '+document.documentElement.scrollWidth+'>'+iw+'）');
  if(document.body.scrollWidth>iw)P.push('body が横にはみ出す '+document.body.scrollWidth);
  window.scrollTo(120,0);if(window.scrollX!==0||document.scrollingElement.scrollLeft!==0)P.push('ページが横にずれる scrollX='+window.scrollX);
  if(topB.left<0||topB.right>iw+0.5)P.push('上の帯が幅からはみ出す');
  if(botB.left<0||botB.right>iw+0.5||botB.bottom>ih+0.5)P.push('下の帯が画面からはみ出す');
  const items=[['#town',1],['#gold',1],['#bgmBtn',1],['#seBtn',1],['#warehouse',1],['#drillHud',1],['#dexHud',1],['#tradeHud',1],['#logLine',1],['#tutBar',0],['#tutSkip',0],['#zoomIn',1],['#zoomOut',1]];
  const sizes={};
  for(const [sel,must] of items){const e=q(sel);if(!e||getComputedStyle(e).display==='none'||R(e).width===0){if(must&&sel!=='#tutBar')P.push(sel+' が表示されていない');continue;}
    const r=R(e);sizes[sel]=[Math.round(r.width),Math.round(r.height)];
    if(r.left<-0.5||r.right>iw+0.5||r.top<-0.5||r.bottom>ih+0.5)P.push(sel+' が画面の外 '+JSON.stringify([r.left,r.top,r.right,r.bottom].map(Math.round)));
    if(!['#town','#gold','#tutBar'].includes(sel)){const x=r.left+r.width/2,y=r.top+r.height/2,t=document.elementFromPoint(x,y);if(!(t&&(t===e||e.contains(t))))P.push(sel+' が他の部品に隠れている（中心）→ '+(t&&(t.id||t.className)));}
    if(!['#town','#gold','#tutBar','#warehouse','#logLine'].includes(sel)&&(r.height<39.5||r.width<39.5))P.push(sel+' が小さい '+Math.round(r.width)+'×'+Math.round(r.height));}
  for(const sel of ['#bgmBtn','#seBtn','#zoomIn','#zoomOut']){const e=q(sel),r=R(e);if(r.width<43.5||r.height<39.5)P.push(sel+' のタップ領域が44px未満 '+Math.round(r.width)+'×'+Math.round(r.height));}
  for(const sel of ['#warehouse','#logLine']){const r=R(q(sel));if(r.height<39.5)P.push(sel+' の高さが40px未満');}
  for(const sel of ['#zoomIn','#zoomOut']){const r=R(q(sel));if(r.width>56.5||r.height>56.5)P.push(sel+' が大きすぎる');if(r.top<cv.top||r.bottom>cv.bottom||r.right>iw)P.push(sel+' が町の帯の外');}
  const zi=R(q('#zoomIn')),zo=R(q('#zoomOut'));if(!(Math.max(zi.right,zo.right)>=iw-20&&Math.min(zi.right,zo.right)>=iw-70))P.push('ズームボタンが右端に寄っていない');
  // 上の帯の中身が帯の外にない
  for(const e of document.querySelectorAll('#topBand *')){const r=R(e);if(r.width&&r.height&&getComputedStyle(e).position!=='fixed'&&(r.bottom>topB.bottom+0.5||r.top<-0.5)&&!e.closest('#warehouse'))P.push('上の帯の外 '+(e.id||e.className||e.tagName));}
  // 案内文：全文が切れずに見える
  const tb=q('#tutBar');if(tb&&getComputedStyle(tb).display!=='none'){const t=q('#tutText'),r=R(tb);
    if(t.scrollWidth>t.clientWidth+1||t.scrollHeight>t.clientHeight+1)P.push('案内文が切れている '+t.scrollWidth+'/'+t.clientWidth+' '+t.scrollHeight+'/'+t.clientHeight);
    if(r.left<2||r.right>iw-2)P.push('案内の帯の左右が切れている '+Math.round(r.left)+'〜'+Math.round(r.right));
    const s=R(q('#tutSkip'));if(s.left<r.left||s.right>r.right+0.5)P.push('スキップが帯の外');}
  // 作物ボタン：横にスクロールして全部に届く
  const pal=q('#palette'),btns=[...pal.querySelectorAll('.tool')],pr=R(pal);let reach='全部見えている';
  if(btns.length){const over=pal.scrollWidth>pal.clientWidth+1;
    if(over&&!['auto','scroll'].includes(getComputedStyle(pal).overflowX))P.push('作物ボタンが横にスクロールできない');
    pal.scrollLeft=0;const first=R(btns[0]);if(first.left<pr.left-0.5)P.push('先頭の作物ボタンが左に切れている');
    pal.scrollLeft=99999;const last=R(btns[btns.length-1]);if(last.right>pr.right+0.5)P.push('末尾の作物ボタンに届かない');
    pal.scrollLeft=0;reach=btns.length+'個'+(over?'（横スクロールで全部に届く：'+pal.scrollWidth+'/'+pal.clientWidth+'）':'');
    for(const bn of btns){const r=R(bn);if(r.height<39.5)P.push('作物ボタンが低い '+Math.round(r.height));}}
  return {P,sizes,reach,top:Math.round(topB.height),bottom:Math.round(botB.height),town:Math.round(cv.height)};};
// 指でスワイプ（CDP）：横にスクロールする帯が実際に動くか
async function swipe(pg,sel,dx){const r=await pg.evaluate(s=>{const e=document.querySelector(s),b=e.getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2,sl:e.scrollLeft};},sel);
  const c=await pg.context().newCDPSession(pg);                                   // 本物の指のタッチイベント（touchStart → touchMove → touchEnd）
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x-dx/2,y:r.y}]});
  for(let i=1;i<=12;i++){await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x-dx/2+dx*i/12,y:r.y}]});await pg.waitForTimeout(16);}
  await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await pg.waitForTimeout(500);await c.detach();
  return (await pg.evaluate(s=>document.querySelector(s).scrollLeft,sel))-r.sl;}
// パネル：画面に収まり、横にはみ出さず、入りきらなければ中だけスクロール
async function panelFit(pg,boxSel,name,tag){
  const m=await pg.evaluate(boxSel=>{const iw=innerWidth,ih=innerHeight,P=[],box=document.querySelector(boxSel);if(!box)return {P:['パネルが無い '+boxSel]};
    const R=e=>e.getBoundingClientRect(),r=R(box),cs=getComputedStyle(box);
    if(r.left<-0.5||r.right>iw+0.5||r.top<-0.5||r.bottom>ih+0.5)P.push('パネルが画面の外 '+JSON.stringify([r.left,r.top,r.right,r.bottom].map(Math.round))+' / '+iw+'×'+ih);
    if(box.scrollWidth>box.clientWidth+1)P.push('パネルが横にはみ出す '+box.scrollWidth+'>'+box.clientWidth);
    const tall=box.scrollHeight>box.clientHeight+1;if(tall&&!['auto','scroll'].includes(cs.overflowY))P.push('パネルが縦に入りきらないのにスクロールできない');
    const bs=[...box.querySelectorAll('button:not([disabled]),input,select')].filter(e=>e.offsetParent!==null&&getComputedStyle(e).visibility!=='hidden');
    const small=[];for(const e of bs){const x=R(e);if(x.width<1||x.height<1)continue;
      if(x.left<r.left-1||x.right>r.right+1)P.push('部品が横にはみ出す '+(e.id||e.textContent.trim().slice(0,12)));
      if(x.height<39.5||x.width<39.5)small.push((e.id||e.textContent.trim().slice(0,10)||e.className)+' '+Math.round(x.width)+'×'+Math.round(x.height));}
    // どのボタンも、パネルの中をスクロールすれば画面の中に出せる（途中で切れて届かない部品がない）
    for(const e of bs){const x0=R(e);if(x0.width<1||x0.height<1)continue;e.scrollIntoView({block:'center',inline:'nearest'});const x=R(e),bx=R(box);   // 入れ子のスクロール（図鑑の一覧など）も動かす
      if(x.top<bx.top-1||x.bottom>bx.bottom+1||x.left<bx.left-1||x.right>bx.right+1){P.push('スクロールしても届かない部品 '+(e.id||e.textContent.trim().slice(0,10)));break;}}
    box.scrollTop=0;
    return {P,small,tall,w:Math.round(r.width),h:Math.round(r.height)};},boxSel);
  const bad=m.P.concat(m.small&&m.small.length?['小さいボタン：'+m.small.slice(0,4).join(' ／ ')]:[]);
  ok(!bad.length,'['+tag+'] '+name+'：画面に収まる（'+m.w+'×'+m.h+(m.tall?'・中だけ縦スクロール':'')+'）',bad.join(' ｜ '));return m;}
const tapSel=async(pg,sel,opt)=>{await pg.locator(sel).first().tap(Object.assign({timeout:4000},opt||{}));await pg.waitForTimeout(220);};
const tapXY=async(pg,x,y)=>{await pg.touchscreen.tap(x,y);await pg.waitForTimeout(220);};
async function focusWorld(pg,wx,wy,z){await pg.evaluate(([x,y,z])=>window.__clockseed.lookAt(x,y,z),[wx,wy,z]);await pg.waitForTimeout(80);}
const vis=(pg,sel)=>pg.isVisible(sel);

for(const [w,h,name,key] of SIZES){
  const tag=name;log('\n=== '+name+' ===');
  // ---------- 1. 新しいセーブ（チュートリアル中）：上の帯・案内文・作物ボタン ----------
  let pg=await boot(w,h,null,2);
  let m=await pg.evaluate(MEASURE);ok(!m.P.length,'['+tag+'] チュートリアル中：上の帯・案内文・作物ボタン・ズームボタンが画面内に収まり、ページは横にはみ出さない（上の帯 '+m.top+'px・下の帯 '+m.bottom+'px・町 '+m.town+'px、作物 '+m.reach+'）',m.P.join(' ｜ '));
  log('   部品の大きさ',JSON.stringify(m.sizes));
  await pg.screenshot({path:O+'80_mobile_'+key+'_tutorial.png'});
  // 案内文の全文（長い手順の文）も切れない：手順ごとの文を順に表示して測る
  const texts=['小麦をえらんで、畑に植えよう','ガチャが解放！ 時計塔でチュートリアルチケットを使おう','製粉所で小麦粉を作ろう（施設をタップして、レシピをえらぶ）'];let longBad=[];
  for(const t of texts){await pg.evaluate(t=>{document.getElementById('tutText').textContent=t;document.getElementById('tutBar').style.display='flex';},t);await pg.waitForTimeout(60);
    const r=await pg.evaluate(()=>{const t=document.getElementById('tutText'),b=document.getElementById('tutBar').getBoundingClientRect();return {cut:t.scrollWidth>t.clientWidth+1||t.scrollHeight>t.clientHeight+1,l:b.left,r:b.right,iw:innerWidth};});
    if(r.cut||r.l<2||r.r>r.iw-2)longBad.push(t.slice(0,10));}
  ok(!longBad.length,'['+tag+'] 長い案内文も折り返して全文が見える・左右が切れない',longBad.join(','));
  // 初期の構図：スマホ縦は町（畑・時計塔・施設）が画面の幅に収まる
  if(w<=600){const c=await H(pg,'contentScreen');ok(c.x0>=-0.5&&c.x1<=w+0.5,'['+tag+'] はじめの構図：町の中身（時計塔から畑まで）が画面の幅に収まる（'+Math.round(c.x0)+'〜'+Math.round(c.x1)+' / '+w+'）');}
  await pg.context().close();

  // ---------- 2. 町Lv8・全部入りのセーブ：レイアウトと、指での横スクロール ----------
  pg=await boot(w,h,rich(),2);
  m=await pg.evaluate(MEASURE);ok(!m.P.length,'['+tag+'] 町Lv8（全施設・作物8種・倉庫いっぱい）：すべて画面内に収まる（上の帯 '+m.top+'px・下の帯 '+m.bottom+'px・町 '+m.town+'px、作物 '+m.reach+'）',m.P.join(' ｜ '));
  log('   部品の大きさ',JSON.stringify(m.sizes));
  if(w<=600){const c=await H(pg,'contentScreen');ok(c.x0>=-0.5&&c.x1<=w+0.5,'['+tag+'] 町Lv8のはじめの構図：町全体が画面の幅に収まる（'+Math.round(c.x0)+'〜'+Math.round(c.x1)+'）');}
  const dp=await swipe(pg,'#palette',-260);ok(dp>20,'['+tag+'] 作物ボタンの帯を指でスワイプして横スクロールできる（+'+Math.round(dp)+'px）');
  const dw=await swipe(pg,'#warehouse',-200);ok(dw>0||await pg.evaluate(()=>{const e=document.getElementById('warehouse');return e.scrollWidth<=e.clientWidth+1;}),'['+tag+'] 倉庫の表示も指で横スクロールできる（+'+Math.round(dw)+'px）');
  await pg.evaluate(()=>{document.getElementById('palette').scrollLeft=0;document.getElementById('warehouse').scrollLeft=0;});
  await pg.screenshot({path:O+'81_mobile_'+key+'_town_lv8.png'});

  // ---------- 3. 主要な操作（指でタップ） ----------
  // 3-1 植える：作物ボタン → 畑
  await tapSel(pg,'#palette [data-crop="wheat"]');
  const pr=await H(pg,'plotRectW',5);await focusWorld(pg,pr.x+pr.w/2,pr.y+pr.h/2,w<=600?1.2:1.3);const pc=await H(pg,'plotCenter',5);
  await tapXY(pg,pc.x,pc.y);let s=await st(pg);ok(s.plots[5]&&s.plots[5].crop==='wheat','[' +tag+'] 植える：作物ボタン→畑をタップ→小麦が植わる（区画6）');
  // 3-2 収穫：収穫待ちの畑をタップ
  const w0=s.storage.wheat;const p0=await H(pg,'plotRectW',0);await focusWorld(pg,p0.x+p0.w/2,p0.y+p0.h/2,w<=600?1.2:1.3);const c0=await H(pg,'plotCenter',0);
  await tapXY(pg,c0.x,c0.y);s=await st(pg);ok(s.plots[0]===null&&s.storage.wheat>w0,'['+tag+'] 収穫：収穫待ちの畑をタップ→倉庫に入る（小麦 '+w0+'→'+s.storage.wheat+'）');
  // 3-3 納品
  const bp=await H(pg,'boardPos');await focusWorld(pg,bp.x,bp.y,w<=600?1.2:1.3);       // 掲示板のそばへカメラを寄せてからタップ（見た目だけ動かす検品用）
  let bc=await H(pg,'boardCenter');await tapXY(pg,bc.x,bc.y);
  ok(await vis(pg,'#ordersPanel'),'['+tag+'] 納品：掲示板をタップ→注文パネルが開く');
  await panelFit(pg,'#ordersPanel .box','注文パネル',tag);
  const g0=(await st(pg)).gold;await tapSel(pg,'#orderList .orow >> .tool:has-text("納品")');s=await st(pg);ok(s.gold>g0,'['+tag+'] 納品：「納品」をタップ→ゴールドが増える（'+g0+'→'+s.gold+'）');
  await tapSel(pg,'#ordersClose');ok(!await vis(pg,'#ordersPanel'),'['+tag+'] 注文パネルを×で閉じられる（44px）');
  // 3-4 施設を開く
  await focusWorld(pg,(await H(pg,'facPos','mill')).x,(await H(pg,'facPos','mill')).y-10,1.3);const mc=await H(pg,'millCenter');await tapXY(pg,mc.x,mc.y);
  ok(await vis(pg,'#facPanel'),'['+tag+'] 施設を開く：製粉所をタップ→施設パネルが開く');await panelFit(pg,'#facPanel .box','施設パネル（進化・加工）',tag);
  await pg.screenshot({path:O+'83_mobile_'+key+'_facility.png'});await tapSel(pg,'#facClose');
  // 3-5 ドリル1セット
  const tp=await H(pg,'towerPos');await focusWorld(pg,tp.x,tp.y,w<=600?1.0:1.2);const tc2=await H(pg,'towerCenter');await tapXY(pg,tc2.x,tc2.y);
  await pg.waitForTimeout(500);ok(await vis(pg,'#drillPanel')&&!await vis(pg,'#skipPanel')&&!await vis(pg,'#fxfPanel')&&!await vis(pg,'#tpPanel'),'['+tag+'] ドリル：時計塔をタップ→ドリルのパネルだけが開く（指の下に現れたボタンが勝手に押されない）');await panelFit(pg,'#drillPanel .box','ドリルのメニュー（特殊ドリル・ガチャ欄を含む）',tag);
  await pg.screenshot({path:O+'84_mobile_'+key+'_drill_menu.png'});
  ok(await pg.locator('.dq-prompt').count()===0,'['+tag+'] 時計塔のタップで、指の下の A〜E のボタンが勝手に押されて5問が始まらない');
  await tapSel(pg,'.lvbtn[data-lv="A"]');                                   // 段階8d：スマホでは A〜E をタップするとそのまま5問セットが始まる
  for(let q=0;q<5;q++){await pg.waitForSelector('.choice:not([disabled])',{timeout:6000});const k=await H(pg,'drillAnswerIndex');
    if(q===1){await panelFit(pg,'#drillPanel .box','ドリルの問題（MathML）',tag);await pg.screenshot({path:O+'85_mobile_'+key+'_drill_question.png'});}
    await tapSel(pg,'.choice >> nth='+k);await pg.waitForTimeout(1050);}
  await pg.waitForSelector('.dres',{timeout:6000});ok(await vis(pg,'.dres'),'['+tag+'] ドリル：5問を指で答えて結果まで進める');await panelFit(pg,'#drillPanel .box','ドリルの結果',tag);
  await tapSel(pg,'#drillMenuBtn');
  // 3-6 ガチャ1回
  const sh0=(await st(pg)).drill.shards;await tapSel(pg,'.gbtns button:has-text("1回")');await pg.waitForTimeout(300);
  ok(await vis(pg,'#gachaFx'),'['+tag+'] ガチャ：「1回」をタップ→カプセルの演出');
  const gm=await pg.evaluate(()=>{const c=document.getElementById('gachaCv').getBoundingClientRect(),iw=innerWidth,ih=innerHeight,a=document.getElementById('gachaAll').getBoundingClientRect();return {l:c.left,r:c.right,t:c.top,b:c.bottom,iw,ih};});
  ok(gm.l>=-0.5&&gm.r<=gm.iw+0.5&&gm.t>=-0.5&&gm.b<=gm.ih+0.5,'['+tag+'] ガチャの演出が画面に収まる（'+Math.round(gm.r-gm.l)+'×'+Math.round(gm.b-gm.t)+'）');
  await tapXY(pg,w/2,h/2);await tapXY(pg,w/2,h/2);await pg.waitForTimeout(200);
  await pg.waitForTimeout(500);s=await st(pg);ok(!await vis(pg,'#gachaFx')&&sh0-s.drill.shards===20&&await vis(pg,'#drillPanel'),'['+tag+'] ガチャ：タップで早送りして結果へ（カケラ '+sh0+'→'+s.drill.shards+'＝ちょうど1回ぶん。閉じるタップで「もう10連」などが勝手に押されない）');await panelFit(pg,'#drillPanel .box','ガチャの結果',tag);
  await tapSel(pg,'.dacts button:has-text("もう10連")');await pg.waitForTimeout(200);await tapSel(pg,'#gachaAll');await panelFit(pg,'#drillPanel .box','ガチャ10連の結果（一覧）',tag);
  await pg.screenshot({path:O+'86_mobile_'+key+'_gacha_result.png'});
  await tapSel(pg,'.dacts button:has-text("図鑑")');ok(await vis(pg,'#dexPanel'),'['+tag+'] 図鑑を開く');await panelFit(pg,'#dexPanel .box','図鑑',tag);
  for(const t of ['種','飾り','お手伝い','消耗品']){const tb=pg.locator('.dextabs button',{hasText:t});if(await tb.count()){await tb.first().tap({timeout:3000});await pg.waitForTimeout(150);await panelFit(pg,'#dexPanel .box','図鑑「'+t+'」',tag);}}
  await tapSel(pg,'#dexClose');if(await vis(pg,'#drillPanel'))await tapSel(pg,'#drillClose');
  // 3-7 ズーム＋／−
  const z0=(await H(pg,'zoomInfo')).zoom;await tapSel(pg,'#zoomIn');const z1=(await H(pg,'zoomInfo')).zoom;await tapSel(pg,'#zoomOut');await tapSel(pg,'#zoomOut');const z2=(await H(pg,'zoomInfo')).zoom;
  ok(z1>z0*1.2&&z2<z1/1.2,'['+tag+'] ズーム：＋で拡大（'+z0.toFixed(2)+'→'+z1.toFixed(2)+'）、−で縮小（→'+z2.toFixed(2)+'）');
  for(let k=0;k<8&&!await pg.locator('#zoomOut').isDisabled();k++)await tapSel(pg,'#zoomOut');
  {const zi=await H(pg,'zoomInfo'),vp=await H(pg,'viewport'),bd=(await H(pg,'mapInfo')).bounds,a=await H(pg,'worldToScreen',bd.x0,bd.y0),c=await H(pg,'worldToScreen',bd.x1,bd.y1);
   ok(Math.abs(zi.zoom-zi.min)<1e-6&&a.x>=-0.5&&c.x<=w+0.5&&a.y>=vp.top-0.5&&c.y<=vp.bottom+0.5,'['+tag+'] 最小ズームで町全体が町の帯に収まる（倍率 '+zi.zoom.toFixed(3)+'）');}
  await pg.screenshot({path:O+'82_mobile_'+key+'_zoom_min.png'});
  // 3-8 ログ履歴
  await tapSel(pg,'#logLine');ok(await vis(pg,'#logPanel'),'['+tag+'] ログ：出来事の1行をタップ→履歴が開く');await panelFit(pg,'#logPanel .box','出来事の履歴',tag);
  await pg.screenshot({path:O+'87_mobile_'+key+'_log_history.png'});await tapSel(pg,'#logClose');ok(!await vis(pg,'#logPanel'),'['+tag+'] 履歴を×で閉じられる');
  // 3-9 そのほかのパネル：倉庫・交換掲示板・時短・植える選択・スキップ確認
  await tapSel(pg,'#warehouse');await panelFit(pg,'#warehousePanel .box','倉庫（売却）',tag);await tapSel(pg,'#warehouseClose');
  await tapSel(pg,'#tradeHud');await panelFit(pg,'#tradePanel .box','交換掲示板',tag);await tapSel(pg,'#tradeClose');
  await tapSel(pg,'#drillHud');await tapSel(pg,'#drillSkipBtn');await pg.waitForTimeout(200);if(await vis(pg,'#skipPanel')){await panelFit(pg,'#skipPanel .box','時短を使う',tag);await tapSel(pg,'#skipClose');}await pg.evaluate(()=>{document.getElementById('drillPanel').style.display='none';});
  await pg.evaluate(()=>{document.getElementById('palette').querySelectorAll('.tool.sel').forEach(e=>e.classList.remove('sel'));});
  await pg.context().close();

  // ---------- 4. 特別な画面：スキップ確認（チュートリアル）・植える選択（畑のタップ）・見学の帯・特殊ドリル ----------
  pg=await boot(w,h,null);await tapSel(pg,'#tutSkip');ok(await vis(pg,'#skipConfirm'),'['+tag+'] スキップ確認が開く');await panelFit(pg,'#skipConfirm .box','チュートリアルのスキップ確認',tag);
  await pg.screenshot({path:O+'88_mobile_'+key+'_skip_confirm.png'});await tapSel(pg,'#skipNo');
  await pg.context().close();
  {const sv=rich({townExp:600});sv.plots=Array(24).fill(null);pg=await boot(w,h,sv);
   await pg.evaluate(()=>{for(const b of document.querySelectorAll('#palette .tool.sel'))b.classList.remove('sel');});
   const r5=await H(pg,'plotRectW',3);await focusWorld(pg,r5.x+r5.w/2,r5.y+r5.h/2,1.3);const p3=await H(pg,'plotCenter',3);await tapXY(pg,p3.x,p3.y);
   if(await vis(pg,'#popup')){await panelFit(pg,'#popup .box','植える作物のえらび方',tag);await pg.screenshot({path:O+'89_mobile_'+key+'_plant_popup.png'});await tapSel(pg,'#popupCancel');}
   else log('   （作物をえらんだ状態なので植える選択は出ない）');
   // 見学中の帯（見学を終わる）：見学中は上の帯の中身が「見学中の帯」だけになる
   await pg.evaluate(()=>{const b=document.getElementById('visitBar');b.style.display='flex';document.getElementById('visitText').textContent='見学中：ABCD1234 の町（Lv8）　見学中は何も変わりません';document.body.classList.add('visiting');});await pg.waitForTimeout(200);
   const vb=await pg.evaluate(()=>{const R=e=>e.getBoundingClientRect(),iw=innerWidth,v=R(document.getElementById('visitBar')),e=R(document.getElementById('visitEnd')),top=R(document.getElementById('topBand')),
     hit=document.elementFromPoint(e.left+e.width/2,e.top+e.height/2);return {inside:v.left>=0&&v.right<=iw&&top.bottom>=v.bottom-0.5,btn:e.left>=v.left&&e.right<=v.right+0.5&&e.height>=39.5,hit:hit&&(hit.id==='visitEnd'),sw:document.documentElement.scrollWidth<=iw,top:Math.round(top.height),w:Math.round(e.width),h:Math.round(e.height)};});
   ok(vb.inside&&vb.btn&&vb.hit&&vb.sw,'['+tag+'] 見学中の帯：画面に収まり、「見学を終わる」（'+vb.w+'×'+vb.h+'）が押せる・上の帯 '+vb.top+'px',JSON.stringify(vb));
   await pg.context().close();}
  {const sv=rich({townExp:300});pg=await boot(w,h,sv);const tpp=await H(pg,'towerPos');await focusWorld(pg,tpp.x,tpp.y,1.0);const tt=await H(pg,'towerCenter');await tapXY(pg,tt.x,tt.y);
   if(await vis(pg,'#drillPanel')){for(const [sp,pn] of [['FXF','#fxfPanel'],['TP','#tpPanel']]){const btn=pg.locator('[data-sp="'+sp+'"]');if(await btn.isEnabled().catch(()=>false)){await btn.tap({timeout:3000});await pg.waitForTimeout(250);
       const f=await pg.evaluate(pn=>{const e=document.querySelector(pn),r=e.getBoundingClientRect(),x=e.querySelector('.fxf-x').getBoundingClientRect();return {vis:getComputedStyle(e).display!=='none',inside:r.left>=-0.5&&r.right<=innerWidth+0.5&&r.bottom<=innerHeight+0.5,x:[x.left>=0&&x.right<=innerWidth&&x.top>=0&&x.bottom<=innerHeight,Math.round(x.width),Math.round(x.height)],sw:document.documentElement.scrollWidth<=innerWidth};},pn);
       ok(f.vis&&f.inside&&f.x[0]&&f.sw,'['+tag+'] 特殊ドリル（'+sp+'）の全画面：画面に収まり、閉じるボタン（'+f.x[1]+'×'+f.x[2]+'）が押せる・ページは横にはみ出さない');
       await pg.locator(pn+' .fxf-x').tap({timeout:3000});await pg.waitForTimeout(150);if(!await vis(pg,'#drillPanel')){await tapXY(pg,tt.x,tt.y);}}}}
   await pg.context().close();}
}

// ===== 5. タブレットは変わらない：main と並べて描いて、上の帯・下の帯を1ピクセルも違わない／部品の位置も同じ =====
{const mainFile='/tmp/claude-0/s7/main_index.html';
 try{if(!fs.existsSync(mainFile)){fs.mkdirSync(path.dirname(mainFile),{recursive:true});fs.writeFileSync(mainFile,cp.execSync('git show origin/main:index.html',{cwd:'/home/user/clockseed',maxBuffer:64e6}));}}catch(e){log('main の index.html を用意できません',e.message);}
 const mainUrl='file://'+mainFile+'?debug=1';
 const sv=rich({townExp:1100});sv.tutorial={done:true,step:10,sets:0,mark:0,flags:{d1:true,pull:true},tickets:0,granted:true};
 for(const [w,h] of [[1180,820],[1024,768],[1366,1024],[768,1024]]){
   const snap=async u=>{const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:1});await ctx.addInitScript(s=>{if(!sessionStorage.getItem('__booted')){sessionStorage.setItem('__booted','1');localStorage.clear();localStorage.setItem('clockseed.save',s);}},JSON.stringify(Object.assign({},sv,{seenAt:Date.now()})));
     const pg=await ctx.newPage();await pg.goto(u);await pg.waitForTimeout(900);
     const rects=await pg.evaluate(()=>{const o={};for(const sel of ['#topBand','#botBand','#town','#gold','#warehouse','#drillHud','#dexHud','#tradeHud','#logLine','#bgmBtn','#seBtn','#palette','#zoomIn','#zoomOut','#world']){const e=document.querySelector(sel);if(!e){o[sel]=null;continue;}const r=e.getBoundingClientRect();o[sel]=[r.left,r.top,r.right,r.bottom].map(x=>Math.round(x*10)/10);}
       o.palBtns=[...document.querySelectorAll('#palette .tool')].map(e=>{const r=e.getBoundingClientRect();return [r.left,r.top,r.right,r.bottom].map(x=>Math.round(x*10)/10);});return o;});
     const topR=rects['#topBand'],botR=rects['#botBand'];
     const a=await pg.screenshot({clip:{x:0,y:0,width:w,height:topR[3]},animations:'disabled'}),c=await pg.screenshot({clip:{x:0,y:botR[1],width:w,height:h-botR[1]},animations:'disabled'});
     await ctx.close();return {rects,a,c};};
   const oldS=await snap(mainUrl),newS=await snap(url);
   ok(JSON.stringify(oldS.rects)===JSON.stringify(newS.rects),'[タブレット '+w+'×'+h+'] 部品の位置・大きさが main と同じ（上の帯・下の帯・各ボタン・作物ボタン・ズームボタン・町の帯）',JSON.stringify(oldS.rects)===JSON.stringify(newS.rects)?'':Object.keys(oldS.rects).filter(k=>JSON.stringify(oldS.rects[k])!==JSON.stringify(newS.rects[k])).join(','));
   ok(Buffer.compare(oldS.a,newS.a)===0&&Buffer.compare(oldS.c,newS.c)===0,'[タブレット '+w+'×'+h+'] 上の帯・下の帯の見た目が main と1ピクセルも違わない');
 }
 // 参考：タブレット横の全体の画面
 const pgT=await boot(1180,820,rich({townExp:1100}),2);await pgT.evaluate(()=>{});await pgT.screenshot({path:O+'90_tablet_unchanged.png'});await pgT.context().close();
}

ok(errs.length===0,'[JS エラー] 0件',errs.slice(0,3));
log(fail?'\n=> 不合格 '+fail+'件':'\n=> 全て合格');
await b.close();process.exit(fail?1:0);
})();
