// 段階7「手ざわりの改善」の通しテスト：移行（v12→v13）・音（効果音とBGM。AudioContext の呼び出しで確認）・
// チュートリアルのスキップ確認・特殊ドリルの解放・〇／✕／花丸・3つの帯の画面割り・ガチャの演出（結果と天井は変えない）
const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch();
const url='file:///home/user/clockseed/index.html?debug=1';const O='/home/user/clockseed/screenshots/';
const log=(...a)=>console.log(...a);let fail=0;const ok=(c,msg,...x)=>{log((c?'合格 ':'不合格 ')+msg,...x);if(!c)fail++;};
const errs=[];
// AudioContext の呼び出しを数える（音は実際には聞かないので、オシレーター・音源の start を数えて確認する）
const AUDIO_SPY=()=>{const A=window.AudioContext||window.webkitAudioContext;window.__audio={ctx:0,osc:0,src:0,starts:0};if(!A)return;
  const P=A.prototype,co=P.createOscillator,cb=P.createBufferSource;
  window.AudioContext=class extends A{constructor(...a){super(...a);window.__audio.ctx++;}};
  P.createOscillator=function(){window.__audio.osc++;const o=co.call(this),s=o.start;o.start=function(...a){window.__audio.starts++;return s.apply(this,a);};return o;};
  P.createBufferSource=function(){window.__audio.src++;const o=cb.call(this),s=o.start;o.start=function(...a){window.__audio.starts++;return s.apply(this,a);};return o;};};
async function page(vp={width:1180,height:820},dsf=1){const ctx=await b.newContext({viewport:vp,deviceScaleFactor:dsf});await ctx.addInitScript(AUDIO_SPY);const pg=await ctx.newPage();
  pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});return pg;}
let pg=await page(undefined,2);
const st=()=>pg.evaluate(()=>JSON.parse(localStorage.getItem('clockseed.save')));
const put=s=>pg.evaluate(s=>localStorage.setItem('clockseed.save',JSON.stringify(s)),s);
const H=(f,...a)=>pg.evaluate(([f,a])=>window.__clockseed[f](...a),[f,a]);
let FRESH=null;
const fresh=async()=>{await pg.goto(url);await pg.evaluate(()=>localStorage.clear());await pg.reload();await pg.waitForTimeout(400);FRESH=await st();return FRESH;};
const load=async s=>{await pg.goto(url);await pg.evaluate(()=>localStorage.clear());await put(s);await pg.reload();await pg.waitForTimeout(450);};
const clone=x=>JSON.parse(JSON.stringify(x));
const done=s=>{s.tutorial=Object.assign(s.tutorial||{},{done:true,step:10});return s;};
const LV=[0,30,120,300,600,1100,1800,2800];

// ===== 1. 移行：version 12 のセーブ（settings なし）→ 13。既存のデータはそのまま、音はどちらもオン =====
await fresh();
{const v12=clone(FRESH);v12.saveVersion=12;delete v12.settings;v12.gold=1234;v12.townExp=650;v12.storage.wheat=17;v12.drill.shards=77;v12.drill.stock=3600;
  v12.gacha.items.sd01=1;v12.gacha.dex.sd01=1;v12.gacha.firstUsed=true;v12.gacha.pity={r:3,sr:12,ur:40};v12.gacha.total=55;v12.tutorial={done:true,step:10,sets:3,mark:2,flags:{d1:true,pull:true},tickets:1,granted:true};
  v12.trade.stock={sd02:2};v12.buildings.mill={startedAt:Date.now()-5e6,builtAt:Date.now()-4e6,job:null};
  await load(v12);const s=await st();const bk=await pg.evaluate(()=>localStorage.getItem('clockseed.save.v12.backup'));
  const keep=k=>JSON.stringify(s[k])===JSON.stringify(v12[k]);
  ok(s.saveVersion===13,'[移行] saveVersion 12 → 13',s.saveVersion);
  ok(s.settings&&s.settings.bgm===true&&s.settings.se===true,'[移行] 音の設定は BGM・効果音ともオン',JSON.stringify(s.settings));
  ok(['gold','townExp','storage','gacha','tutorial','trade','buildings','plots'].every(keep)&&s.drill.shards===77&&s.drill.stock===3600,'[移行] ゴールド・経験値・倉庫・ガチャ（天井）・チュートリアル・交換・施設・畑・ドリルはそのまま',['gold','townExp','storage','gacha','tutorial','trade','buildings','plots'].filter(k=>!keep(k)).map(k=>k+' '+JSON.stringify(v12[k]).slice(0,300)+' => '+JSON.stringify(s[k]).slice(0,300)).join(' | '));
  ok(!!bk&&JSON.parse(bk).saveVersion===12,'[移行] 元のセーブを clockseed.save.v12.backup に退避');
  const v13=clone(s);v13.settings={bgm:false,se:true};await load(v13);ok(JSON.stringify((await st()).settings)===JSON.stringify({bgm:false,se:true}),'[読み込み] version 13 の設定をそのまま読む');}

// ===== 2. 音：各場面で効果音（AudioContext の音源が start される）／BGM はオルゴール風のループ =====
const snd=()=>H('sound');const au=()=>pg.evaluate(()=>Object.assign({},window.__audio));
async function scene(name,act,wait=350){const a0=await au(),l0=(await snd()).log.length;await act();await pg.waitForTimeout(wait);const a1=await au(),L=(await snd()).log;
  const hit=L.slice(Math.max(0,l0-(L.length>=50?L.length-l0:0))).filter(x=>x.name===name);   // ログは直近50件
  const got=L.filter(x=>x.name===name&&x.played).length>0;return {played:got&&hit.some(x=>x.played),starts:a1.starts-a0.starts};}
{const s=done(clone(FRESH));s.townExp=LV[2]-1;s.gold=0;s.storage.wheat=20;s.storage.carrot=5;s.drill.shards=40;
  s.plots[1]={crop:'wheat',plantedAt:Date.now()-1e7,readyAt:Date.now()-1000};s.orders[0]={crop:'wheat',qty:3};s.gacha.items.dc08=1;s.gacha.dex.dc08=1;
  await load(s);
  let i=await snd();ok(i.unlocked===false&&i.bgm===false&&(await au()).ctx===0,'[BGM] 最初のタップまでは AudioContext を作らない（ブラウザの自動再生の決まり）');
  const c0=await H('plotCenter',0);await pg.mouse.click(c0.x,c0.y);await pg.waitForTimeout(300);   // 最初のタップ（空き区画 → 植えるメニュー）
  i=await snd();const a=await au();ok(i.unlocked&&i.ctx==='running'&&i.bgm&&a.ctx===1,'[BGM] 最初のタップのあとに鳴り始める',JSON.stringify({ctx:i.ctx,bgm:i.bgm,ac:a.ctx}));
  {const a0=await au();await pg.waitForTimeout(2500);const a1=await au();ok(a1.starts-a0.starts>=6,'[BGM] ループが続けて音を出す（2.5秒で音源の start',a1.starts-a0.starts,'回）');}
  const R={};
  R.plant=await scene('plant',()=>pg.locator('#popupRow button').first().click());
  R.harvest=await scene('harvest',async()=>{const c=await H('plotCenter',1);await pg.mouse.click(c.x,c.y);});
  {const c=await H('boardCenter');await pg.mouse.click(c.x,c.y);await pg.waitForTimeout(250);}
  R.deliver=await scene('deliver',()=>pg.locator('#orderList .orow').first().locator('.tool',{hasText:'納品'}).click());
  R.levelup=(await snd()).log.some(x=>x.name==='levelup'&&x.played)?{played:true,starts:'(納品と同時)'}:{played:false};
  await pg.locator('#ordersClose').click();await pg.waitForTimeout(200);
  await pg.locator('#warehouse').click();await pg.waitForTimeout(200);
  R.coin=await scene('coin',()=>pg.locator('#warehouseList button').first().click());
  await pg.locator('#warehouseClose').click();
  R.bell=await scene('bell',async()=>{const p=(await H('decorInfo')).bellPos;await pg.mouse.click(p.x,p.y);});
  {const c=await H('towerCenter');await pg.mouse.click(c.x,c.y);await pg.waitForTimeout(250);}
  await pg.locator('#drillStartBtn').click();await pg.waitForTimeout(200);
  R.correct=await scene('correct',async()=>{const k=await H('drillAnswerIndex');await pg.locator('.choice').nth(k).click();},150);
  await pg.waitForTimeout(1000);
  R.wrong=await scene('wrong',async()=>{const k=await H('drillAnswerIndex');await pg.locator('.choice').nth((k+1)%4).click();},150);
  await pg.locator('#drillClose').click();
  {const c=await H('towerCenter');await pg.mouse.click(c.x,c.y);await pg.waitForTimeout(250);}
  R.gacha=await scene('gacha',()=>pg.locator('.gbtns button',{hasText:'1回'}).click(),300);
  await pg.mouse.click(590,410);await pg.waitForTimeout(100);await pg.mouse.click(590,410);await pg.waitForTimeout(150);await pg.locator('#drillClose').click().catch(()=>{});
  // 建設完了：開いている間に建設が終わる
  {const s2=await st();s2.buildings.mill={startedAt:Date.now()-5000,builtAt:Date.now()+1500,job:null};await load(s2);await pg.mouse.click(5,(await H('viewport')).top+5);await pg.waitForTimeout(200);}
  R.build=await scene('build',async()=>{},2300);
  for(const k of ['correct','wrong','plant','harvest','deliver','coin','build','levelup','gacha','bell'])ok(R[k].played&&(R[k].starts==='(納品と同時)'||R[k].starts>0),'[効果音] '+k,JSON.stringify(R[k]));}

// ===== 3. BGM と効果音のオン・オフは別々で、読み込み直しても残る =====
{await pg.locator('#seBtn').click();await pg.waitForTimeout(100);let s=await st(),i=await snd();
  ok(s.settings.se===false&&s.settings.bgm===true&&i.bgm===true,'[切替] 効果音だけオフ（BGM は鳴ったまま）',JSON.stringify(s.settings));
  const r=await scene('bell',async()=>{const p=(await H('decorInfo')).bellPos;await pg.mouse.click(p.x,p.y);},200);
  const L=(await snd()).log.filter(x=>x.name==='bell');ok(L[L.length-1].played===false,'[切替] 効果音オフでは鳴らさない');
  await pg.locator('#bgmBtn').click();await pg.waitForTimeout(400);s=await st();i=await snd();
  {const a0=await au();await pg.waitForTimeout(1200);const a1=await au();ok(s.settings.bgm===false&&i.bgm===false&&a1.starts-a0.starts===0,'[切替] BGM もオフ → 音源の start が止まる',a1.starts-a0.starts);}
  await pg.reload();await pg.waitForTimeout(400);s=await st();
  ok(s.settings.bgm===false&&s.settings.se===false&&await pg.getAttribute('#bgmBtn','aria-pressed')==='false'&&await pg.getAttribute('#seBtn','aria-pressed')==='false','[保存] 読み込み直しても両方オフのまま（ボタンの表示も）');
  await pg.mouse.click(5,(await H('viewport')).top+5);await pg.waitForTimeout(200);i=await snd();ok(i.bgm===false,'[保存] BGM オフならタップしても鳴らさない');
  await pg.locator('#bgmBtn').click();await pg.waitForTimeout(300);s=await st();i=await snd();ok(s.settings.bgm===true&&s.settings.se===false&&i.bgm===true,'[切替] BGM だけオンに戻す（効果音はオフのまま）',JSON.stringify(s.settings));
  await pg.locator('#seBtn').click();await pg.reload();await pg.waitForTimeout(300);s=await st();ok(s.settings.bgm===true&&s.settings.se===true,'[保存] 両方オンに戻して読み込み直し',JSON.stringify(s.settings));}

// ===== 4. チュートリアルのスキップ確認 =====
{await fresh();await pg.locator('#tutSkip').click();await pg.waitForTimeout(150);
  ok(await pg.isVisible('#skipConfirm')&&(await pg.locator('#skipConfirm').innerText()).includes('チュートリアルをスキップしますか？'),'[スキップ] 確認が出る：「チュートリアルをスキップしますか？」');
  ok(await pg.isVisible('#skipYes')&&(await pg.innerText('#skipYes'))==='スキップする'&&(await pg.innerText('#skipNo'))==='やめる','[スキップ] ボタンは「スキップする」「やめる」');
  await pg.screenshot({path:O+'52_skip_confirm.png'});
  await pg.locator('#skipNo').click();await pg.waitForTimeout(150);let t=await H('tutorial');
  ok(!t.done&&t.step===1&&!await pg.isVisible('#skipConfirm')&&await pg.isVisible('#tutBar'),'[スキップ] 「やめる」→ チュートリアルの続き（手順1・案内の帯が出たまま）',JSON.stringify({done:t.done,step:t.step}));
  await follow1();t=await H('tutorial');ok(t.step===1||t.step===2,'[スキップ] やめたあとも案内どおりに進められる',t.step);
  await pg.locator('#tutSkip').click();await pg.waitForTimeout(150);await pg.locator('#skipYes').click();await pg.waitForTimeout(200);t=await H('tutorial');
  ok(t.done&&!await pg.isVisible('#tutBar')&&!await pg.isVisible('#skipConfirm')&&(await st()).tutorial.done,'[スキップ] 「スキップする」→ チュートリアル終了（保存も done）');}
async function follow1(){const c=await H('plotCenter',0);await pg.mouse.click(c.x,c.y);await pg.waitForTimeout(200);if(await pg.isVisible('#popup'))await pg.locator('#popupRow button').first().click();await pg.waitForTimeout(150);}

// ===== 5. 特殊ドリルの解放：Lv2 はどちらも不可、Lv3 は FACTOR×FACTOR だけ、Lv4 は両方 =====
for(const lv of [2,3,4]){const s=done(clone(FRESH));s.townExp=LV[lv-1];await load(s);const c=await H('towerCenter');await pg.mouse.click(c.x,c.y);await pg.waitForTimeout(250);
  const f=await pg.locator('[data-sp="FXF"]'),p=await pg.locator('[data-sp="TP"]');
  const fd=await f.isDisabled(),pd=await p.isDisabled(),ft=(await f.innerText()).replace(/\s+/g,' '),pt=(await p.innerText()).replace(/\s+/g,' ');
  await f.click({force:true});await pg.waitForTimeout(150);const fo=await pg.isVisible('#fxfPanel');if(fo)await pg.locator('#fxfClose').click();
  if(!fo){if(!await pg.isVisible('#drillPanel')){await pg.mouse.click(c.x,c.y);await pg.waitForTimeout(200);}await pg.locator('[data-sp="TP"]').click({force:true});await pg.waitForTimeout(150);}
  const po=!fo&&await pg.isVisible('#tpPanel');
  const exp={2:[true,true],3:[false,true],4:[false,false]}[lv];
  ok(fd===exp[0]&&pd===exp[1]&&(fd?/町Lv3で解放/.test(ft):!/解放/.test(ft))&&(pd?/町Lv4で解放/.test(pt):!/解放/.test(pt))&&fo===!exp[0]&&!po,'[解放] 町Lv'+lv+'：FACTOR×FACTOR '+(fd?'選べない':'選べる')+'・テンパズル '+(pd?'選べない':'選べる'),'| '+ft+' | '+pt+' | 押して開いた:'+(fo?'FXF':po?'TP':'なし'));
  if(lv===2)await pg.screenshot({path:O+'53_special_locked.png'});
}
{const s=done(clone(FRESH));s.townExp=LV[3];await load(s);const c=await H('towerCenter');await pg.mouse.click(c.x,c.y);await pg.waitForTimeout(200);await pg.locator('[data-sp="TP"]').click();await pg.waitForTimeout(200);ok(await pg.isVisible('#tpPanel'),'[解放] 町Lv4：テンパズルが開く');}

// ===== 6. 〇・✕・花丸 =====
{const s=done(clone(FRESH));s.townExp=LV[2];await load(s);const c=await H('towerCenter');await pg.mouse.click(c.x,c.y);await pg.waitForTimeout(250);await pg.locator('#drillStartBtn').click();await pg.waitForTimeout(250);
  let k=await H('drillAnswerIndex');await pg.locator('.choice').nth(k).click();await pg.waitForTimeout(130);
  const m=await pg.evaluate(()=>{const e=document.querySelector('.fx-maru');if(!e)return null;const r=e.getBoundingClientRect();return {cx:r.left+r.width/2,cy:r.top+r.height/2,w:r.width};});
  ok(m&&Math.abs(m.cx-590)<4&&Math.abs(m.cy-410)<4&&m.w>150,'[〇] 正解：大きな〇が画面の中央に',JSON.stringify(m));
  await pg.screenshot({path:O+'54_drill_maru.png'});await pg.waitForTimeout(600);ok(!await pg.$('.fx-maru'),'[〇] 約0.6秒で消える');
  await pg.waitForTimeout(400);k=await H('drillAnswerIndex');await pg.locator('.choice').nth((k+1)%4).click();await pg.waitForTimeout(80);
  ok(!!await pg.$('.fx-batsu')&&await pg.$eval('#drillPanel .box',e=>e.classList.contains('shake')),'[✕] 不正解：小さな✕と、パネルが軽く揺れる');
  const bx=await pg.evaluate(()=>{const r=document.querySelector('.fx-batsu').getBoundingClientRect();return r.width;});ok(bx<120,'[✕] ✕は小さめ（幅'+Math.round(bx)+'px）');
  await pg.screenshot({path:O+'55_drill_batsu.png'});
  await pg.locator('#dqFb button',{hasText:'つぎへ'}).click();await pg.waitForTimeout(200);
  for(let q=2;q<5;q++){k=await H('drillAnswerIndex');await pg.locator('.choice').nth(k).click();await pg.waitForTimeout(1100);}
  await pg.waitForTimeout(250);const hn=await pg.evaluate(()=>{const e=document.querySelector('.fx-hana');return e?e.innerText:null;});
  ok(hn&&/5問クリア/.test(hn),'[花丸] 5問を終えたら花丸',hn);await pg.waitForTimeout(500);await pg.screenshot({path:O+'56_drill_hanamaru.png'});
  ok((await snd()).log.some(x=>x.name==='hanamaru'&&x.played),'[花丸] 効果音も鳴る');
  // 10問連続正解
  const s2=await st();s2.drill.streak=9;await load(s2);await pg.mouse.click(c.x,c.y);await pg.waitForTimeout(250);await pg.locator('#drillStartBtn').click();await pg.waitForTimeout(250);
  k=await H('drillAnswerIndex');await pg.locator('.choice').nth(k).click();await pg.waitForTimeout(200);
  const h2=await pg.evaluate(()=>{const e=document.querySelector('.fx-hana');return e?e.innerText:null;});ok(h2&&/10問連続正解/.test(h2)&&(await st()).drill.streak===10,'[花丸] 10問連続正解でも花丸',h2);}

// ===== 7. 画面割り：上の帯・町（中央）・下の帯。町の Canvas は帯の下にもぐらない =====
const SIZES=[[1180,820,'タブレット横'],[1024,768,'iPad 横'],[768,1024,'iPad 縦'],[1366,1024,'iPad Pro 横'],[1280,720,'ノートPC'],[390,844,'スマホ縦'],[844,390,'スマホ横']];
for(const lv of [2,5]){const s=done(clone(FRESH));s.townExp=LV[lv-1];for(const [w,h,name] of SIZES){const p2=await page({width:w,height:h});await p2.goto(url);await p2.evaluate(s=>{localStorage.clear();localStorage.setItem('clockseed.save',JSON.stringify(s));},s);await p2.reload();await p2.waitForTimeout(450);
  const r=await p2.evaluate(()=>{const g=id=>document.getElementById(id).getBoundingClientRect(),C=window.__clockseed,v=C.viewport(),tb=g('topBand'),bb=g('botBand'),cv=g('world');
    const inside=(p)=>p.x>=0&&p.x<=innerWidth&&p.y>=cv.top-0.5&&p.y<=cv.bottom+0.5;
    const pl=[...Array(C.mapInfo().plots).keys()].map(i=>C.plotCenter(i)),tw=C.towerCenter();
    const covered=[...pl,tw].filter(inside).map(p=>document.elementFromPoint(p.x,p.y)).filter(e=>e&&e.id!=='world').length;
    return {tb:{top:tb.top,bottom:tb.bottom},bb:{top:bb.top,bottom:bb.bottom},cv:{top:cv.top,bottom:cv.bottom,h:cv.height},v,inside:[...pl,tw].filter(inside).length,total:pl.length+1,covered,ih:innerHeight};});
  // 端までのパン：ドラッグで左上・右下の端へ動かして、地図の端が町の帯の端と一致する（帯の下に隠れたままの場所がない）
  const v=r.v,x0=w*.2,x1=w*.8,y0=r.cv.top+r.cv.h*.2,y1=r.cv.bottom-r.cv.h*.2;
  const drag=async(sx,sy,ex,ey)=>{await p2.mouse.move(sx,sy);await p2.mouse.down();for(let k=1;k<=6;k++)await p2.mouse.move(sx+(ex-sx)*k/6,sy+(ey-sy)*k/6);await p2.mouse.up();await p2.waitForTimeout(60);};
  await p2.evaluate(()=>{const C=window.__clockseed;C.lookAt(C.camera().x,C.camera().y,C.viewport().zoomMin);});
  for(let k=0;k<24;k++)await drag(x0,y0,x1,y1);const tl=await p2.evaluate(()=>{const C=window.__clockseed,b=C.mapInfo().bounds;return C.worldToScreen(b.x0,b.y0);});
  for(let k=0;k<24;k++)await drag(x1,y1,x0,y0);const br=await p2.evaluate(()=>{const C=window.__clockseed,b=C.mapInfo().bounds;return C.worldToScreen(b.x1,b.y1);});
  const fit=Math.abs(r.cv.top-r.tb.bottom)<1.5&&Math.abs(r.cv.bottom-r.bb.top)<1.5&&Math.abs(r.bb.bottom-h)<1&&r.tb.top===0&&Math.abs(v.h-r.cv.h)<1.5;
  const edges=Math.abs(tl.y-r.cv.top)<1.5&&Math.abs(br.y-r.cv.bottom)<1.5&&Math.abs(tl.x)<1.5&&Math.abs(br.x-w)<1.5;
  ok(fit&&edges&&r.covered===0,'[画面割り] 町Lv'+lv+' '+name+' '+w+'×'+h+'：上の帯 0〜'+Math.round(r.tb.bottom)+'／町 '+Math.round(r.cv.top)+'〜'+Math.round(r.cv.bottom)+'／下の帯 '+Math.round(r.bb.top)+'〜'+h+'・カメラの端＝町の帯の端・最小ズーム '+v.zoomMin.toFixed(3)+'・初期表示で見える区画と時計塔 '+r.inside+'/'+r.total+'（帯にかぶるもの '+r.covered+'）',JSON.stringify({tl,br}));
  if(lv===2&&w>=1024&&h>=720)ok(r.inside===r.total,'[画面割り] 町Lv2 '+name+'：はじめの表示で畑と時計塔が全部見える',r.inside+'/'+r.total);
  if(name==='タブレット横'&&lv===5){await p2.close();const p3=await page({width:w,height:h},2);await p3.goto(url);await p3.evaluate(s=>{localStorage.clear();localStorage.setItem('clockseed.save',JSON.stringify(s));},s);await p3.reload();await p3.waitForTimeout(700);await p3.screenshot({path:O+'50_layout_bands.png'});await p3.close();}
  else await p2.close();}}

// ===== 8. ガチャの演出（結果・天井は変えない） =====
{const s=done(clone(FRESH));s.townExp=LV[3];s.drill.shards=20*200;await load(s);
  // (a) 同じ乱数で、演出つきのガチャとエンジン単体の結果・天井が一致する
  const exp=await pg.evaluate(()=>{const m=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
    const g=JSON.parse(localStorage.getItem('clockseed.save')).gacha,GA=window.ClockseedGacha,rng=m(20261127),out=[];for(let i=0;i<10;i++)out.push(GA.pullOnce(g,rng));
    window.__rng=m(20261127);Math.random=()=>window.__rng();return {ids:out.map(r=>r.id+':'+r.rarity+':'+(r.dup||'')),pity:g.pity,total:g.total,items:g.items};});
  const c=await H('towerCenter');await pg.mouse.click(c.x,c.y);await pg.waitForTimeout(250);
  const f0=await H('gachaFx');await pg.locator('.gbtns button',{hasText:'10連'}).click();await pg.waitForTimeout(60);
  const s1=await st(),lg=await H('lastGacha');
  ok(JSON.stringify(lg.map(r=>r.id+':'+r.rarity+':'+(r.dup||'')))===JSON.stringify(exp.ids)&&JSON.stringify(s1.gacha.pity)===JSON.stringify(exp.pity)&&s1.gacha.total===exp.total&&JSON.stringify(s1.gacha.items)===JSON.stringify(exp.items),
    '[ガチャ] 演出つきでも結果・天井・所持はエンジン単体と同じ（同じ乱数、10連）',exp.ids.join(' '),JSON.stringify(exp.pity));
  // (b) 10連：1個ずつ開ける。開く前のタップで早送り、カードのタップでつぎへ、最後に一覧
  let fx=await H('gachaFx');ok(fx.active&&fx.i===0&&fx.n===10&&!fx.opened,'[10連] 演出が始まる（1/10・まだ開いていない）',JSON.stringify(fx));
  await pg.waitForTimeout(150);await pg.mouse.click(590,410);await pg.waitForTimeout(60);fx=await H('gachaFx');
  ok(fx.opened&&fx.carded&&fx.t>=2.05&&fx.i===0,'[早送り] 開く前のタップ → すぐに開いてカード',JSON.stringify(fx));
  const card=(await pg.locator('#gachaCard').innerText()).replace(/\s+/g,' ');ok(/コモン|レア|SR|激レア/.test(card)&&card.length>6,'[カード] 名前・レア度・効果',card);
  const seq=[0];const rar={};const seen={};
  for(let k=0;k<12;k++){fx=await H('gachaFx');if(!fx.active)break;rar[fx.rarity]=(rar[fx.rarity]||0)+1;
    if(!fx.carded){await pg.mouse.click(590,410);await pg.waitForTimeout(60);}
    const L=(await snd()).log.slice(-2).map(x=>x.name).join(',');const fl=await pg.$eval('#gachaFlash',e=>e.classList.contains('on'));seen[fx.rarity]=seen[fx.rarity]||{se:L,flash:fl,cls:await pg.getAttribute('#gachaCard','class')};
    await pg.mouse.click(590,410);await pg.waitForTimeout(60);fx=await H('gachaFx');if(fx.active)seq.push(fx.i);}
  ok(JSON.stringify(seq)===JSON.stringify([0,1,2,3,4,5,6,7,8,9])&&!(await H('gachaFx')).active&&!await pg.isVisible('#gachaFx'),'[10連] 1→10 の順に開いて演出を閉じる',seq.join(','));
  ok(await pg.locator('#drillBody .ggrid .gcard').count()===10&&/新しい品目|図鑑に登録/.test(await pg.innerText('#drillBody')),'[10連] 最後に結果の一覧（カード10枚とまとめ）');
  // (c) レア度ごとの演出：効果音の種類・激レアは画面のフラッシュ（出るまで引く）
  const want={C:'pop',R:'rare',SR:'sr',UR:'ur'};let rounds=0,urShot=false,srShot=false;
  while(Object.keys(want).some(r=>!seen[r])&&rounds<40){rounds++;await pg.locator('#drillBody .dacts button',{hasText:'もう10連'}).click();await pg.waitForTimeout(40);
    for(let k=0;k<10;k++){fx=await H('gachaFx');if(!fx.active)break;
      if(!seen[fx.rarity]||(fx.rarity==='SR'&&!srShot)||(fx.rarity==='UR'&&!urShot)){await pg.waitForTimeout(Math.max(0,(2.2-fx.t)*1000));const L=(await snd()).log.slice(-3).map(x=>x.name).join(',');
        const fl=await pg.$eval('#gachaFlash',e=>e.classList.contains('on'));seen[fx.rarity]=seen[fx.rarity]||{se:L,flash:fl,cls:await pg.getAttribute('#gachaCard','class')};
        if(fx.rarity==='SR'&&!srShot){await pg.waitForTimeout(300);await pg.screenshot({path:O+'57_gacha_sr.png'});srShot=true;}
        if(fx.rarity==='UR'&&!urShot){await pg.waitForTimeout(300);await pg.screenshot({path:O+'58_gacha_ur.png'});urShot=true;}}
      else{await pg.mouse.click(590,410);await pg.waitForTimeout(40);}
      await pg.mouse.click(590,410);await pg.waitForTimeout(40);}}
  for(const [r,se] of Object.entries(want))ok(seen[r]&&seen[r].se.includes(se)&&seen[r].cls.includes('r-'+r)&&(r==='UR'?seen[r].flash:true),'[演出] '+{C:'コモン',R:'レア',SR:'SR',UR:'激レア'}[r]+'：効果音 '+se+(r==='UR'?'・画面のフラッシュ':'')+'・カード r-'+r,JSON.stringify(seen[r]));
  ok(!seen.C.flash&&!seen.R.flash&&!seen.SR.flash,'[演出] フラッシュは激レアだけ');
  // (d) 1回・「まとめて見る」
  await pg.locator('#drillBody .dacts button',{hasText:'もう1回'}).click();await pg.waitForTimeout(80);fx=await H('gachaFx');ok(fx.active&&fx.n===1&&!await pg.isVisible('#gachaAll'),'[1回] カプセル1個（「まとめて見る」は出さない）');
  await pg.mouse.click(590,410);await pg.waitForTimeout(60);await pg.mouse.click(590,410);await pg.waitForTimeout(100);ok(!(await H('gachaFx')).active&&await pg.locator('#drillBody .gcard.big').count()===1,'[1回] タップ2回で閉じて、結果のカード');
  await pg.locator('#drillBody .dacts button',{hasText:'もう10連'}).click();await pg.waitForTimeout(80);await pg.locator('#gachaAll').click();await pg.waitForTimeout(100);
  ok(!(await H('gachaFx')).active&&await pg.locator('#drillBody .ggrid .gcard').count()===10,'[10連] 「まとめて見る」で一覧へ');}

// ===== 9. 新しい画面割りの町（スクリーンショット）と JS エラー =====
ok(errs.length===0,'[JS エラー] 0件',errs.slice(0,3));
log(fail?'=> 不合格 '+fail+'件':'=> 全て合格');
await b.close();process.exit(fail?1:0);
})();
