// 段階9「タイトル画面と改名・節目と収穫の演出強化」の通しテスト
//  ① タイトル画面：起動で出る・タップで始まる（続き／新規の両方）・BGM はそのタップで鳴り始める・タイトル画面でも音を切り替えられる・
//     旧題『ときの種』が画面内（文字・ページの題名・説明の属性）に残っていない
//  ② 町のレベルアップ：鐘・紙吹雪・町の人が広場に集まる・「町がLv○になった！」のパネル。パネルの一覧が、そのレベルで実際に解放されたもの
//     （作物・施設・レシピ・畑の数・特殊ドリル・交換掲示板・町の広がり・家）と一致することを、データからこのテストで別に数えて全レベル分照合。
//     Lv8 が最大の形（花火・紙吹雪が最多・大きなパネル）。ログにも従来どおり残る。タップで閉じる
//  ③ 時短：時計塔の歯車が回り、針が進む（描画の差分で確認）。スキップのパネルの小さな時計も回る
//  ④ チュートリアル（タイトル画面から新規で通し）：時短の場面ではパネルが閉じて時計塔の動きが見える／町Lv2のパネル／完了の祝福と次の目標
//  ⑤ 収穫：なぞり収穫で作物が倉庫へ飛ぶ・「+3」・効果音の音程が上がる・連続数「○個！」・たくさん取れたら花丸の輪。
//     収穫量は main（段階8f）と同じなぞりで比べて一致
//  ⑥ JS エラー 0
const {chromium}=require('playwright');
const fs=require('fs'),cp=require('child_process');
(async()=>{
const b=await chromium.launch();
const FILE='file:///home/user/clockseed/index.html',URL=FILE+'?debug=1',O='/home/user/clockseed/screenshots/';
const log=(...a)=>console.log(...a);let fail=0;const ok=(c,msg,...x)=>{log((c?'合格 ':'不合格 ')+msg,...x);if(!c)fail++;};
const errs=[];
async function boot(w,h,save,{url=URL,dsf=1,touch=false,clock=false}={}){
  const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:dsf,hasTouch:touch,isMobile:touch});
  if(save!==undefined)await ctx.addInitScript(s=>{if(!sessionStorage.getItem('__booted')){sessionStorage.setItem('__booted','1');localStorage.clear();if(s)localStorage.setItem('clockseed.save',s);}},save?JSON.stringify(save):'');
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  if(clock)await pg.clock.install({time:Date.now()});
  await pg.goto(url);await pg.waitForTimeout(700);return pg;}
const H=(pg,f,...a)=>pg.evaluate(([f,a])=>window.__clockseed[f](...a),[f,a]);
const S9=pg=>H(pg,'stage9');
const st=pg=>pg.evaluate(()=>JSON.parse(localStorage.getItem('clockseed.save')));
const clone=x=>JSON.parse(JSON.stringify(x));
const BK=['mill','kitchen','bakery','ranch','dairy','jam','restaurant','cake'];
let FRESH;{const pg=await boot(1180,820,null,{url:URL+'&intro=0'});FRESH=await st(pg);await pg.context().close();}
const LV=[0,30,120,300,600,1100,1800,2800];
function save(lv,{exp,tut=true}={}){const s=clone(FRESH),T=Date.now();if(tut){s.tutorial.done=true;s.tutorial.step=10;}s.townExp=exp!==undefined?exp:LV[lv-1];s.seenAt=T;
  for(const k of BK)s.buildings[k]=lv>=3?{startedAt:T-9e6,builtAt:T-8e6,job:null,lv:1}:null;return s;}
// 画面に出ている文字・題名・説明の属性に旧題が無いか
const oldTitleHits=pg=>pg.evaluate(()=>{const hits=[];if(document.title.includes('ときの種'))hits.push('document.title');
  for(const el of document.querySelectorAll('*')){if(['SCRIPT','STYLE'].includes(el.tagName))continue;
    for(const n of el.childNodes)if(n.nodeType===3&&n.textContent.includes('ときの種'))hits.push(el.tagName+'#'+el.id+':text');
    for(const a of ['aria-label','title','alt','placeholder','value'])if((el.getAttribute(a)||'').includes('ときの種'))hits.push(el.tagName+'#'+el.id+':'+a);}
  return hits;});
const tapTitle=async pg=>{await pg.locator('#titleScreen').click({position:{x:30,y:200}});await pg.waitForTimeout(200);};

// ===== ① タイトル画面 =====
log('--- タイトル画面 ---');
for(const [w,h,name,dsf,touch] of [[1180,820,'tablet',1,false],[390,844,'phone',2,true]]){
  const pg=await boot(w,h,null,{dsf,touch});
  const t=await pg.evaluate(()=>({shown:getComputedStyle(document.getElementById('titleScreen')).display!=='none',logo:document.getElementById('titleLogo').textContent,sub:document.querySelector('#titleScreen .tsub').textContent,
    start:document.getElementById('titleStart').textContent,mode:document.getElementById('titleMode').textContent,title:document.title}));
  const s0=await S9(pg),snd0=await H(pg,'sound');
  ok(t.shown&&s0.titleUp,'['+name+'] 起動するとタイトル画面が出る');
  ok(t.logo==='みんなのときまきタウン'&&t.sub==='とまった時計塔の小さな街'&&t.start==='タップではじめる','['+name+'] ロゴ『'+t.logo+'』・サブタイトル「'+t.sub+'」・「'+t.start+'」');
  ok(t.title==='みんなのときまきタウン','['+name+'] ページの題名も「'+t.title+'」');
  ok(t.mode==='はじめから（チュートリアル）','['+name+'] セーブなし：「'+t.mode+'」');
  // 後ろに町が見える：タイトル画面の中央付近は半透明（町の Canvas が描かれている）
  const see=await pg.evaluate(()=>{const bg=getComputedStyle(document.getElementById('titleScreen')).backgroundImage;return {bg:bg.slice(0,40),canvas:document.getElementById('world').width>0};});
  ok(/gradient/.test(see.bg)&&see.canvas,'['+name+'] 後ろに町の様子が見える（半透明の重ね・町は描画中）');
  const hits=await oldTitleHits(pg);ok(hits.length===0,'['+name+'] タイトル画面で旧題『ときの種』の表示なし',hits.join(','));
  await pg.waitForTimeout(1300);   // 「タップではじめる」がふわっと出るまで
  const lay=await pg.evaluate(()=>{const im=document.getElementById('titleLogoImg'),r=im.getBoundingClientRect(),st=document.getElementById('titleStart').getBoundingClientRect();
    return {loaded:im.complete&&im.naturalWidth>0,src:im.getAttribute('src'),alt:im.alt,img:document.getElementById('titleLogo').classList.contains('img'),ratio:+(r.width/innerWidth).toFixed(3),
      inside:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,cx:Math.round(r.left+r.width/2),cy:Math.round(r.top+r.height/2),W:innerWidth,H:innerHeight,above:r.bottom<=st.top,
      textHidden:getComputedStyle(document.querySelector('#titleLogo .tl2')).display==='none'&&getComputedStyle(document.querySelector('#titleScreen .tsub')).display==='none',
      start:st.width>0&&parseFloat(getComputedStyle(document.getElementById('titleStart')).opacity)>.9,mode:getComputedStyle(document.getElementById('titleMode')).display!=='none'};});
  ok(lay.loaded&&lay.img&&lay.src==='title-logo.webp'&&lay.alt==='みんなのときまきタウン'&&lay.textHidden,'['+name+'] タイトルのロゴは木の看板の画像（title-logo.webp・代替テキスト『'+lay.alt+'』。文字のロゴは隠す）');
  ok(lay.inside&&Math.abs(lay.cx-lay.W/2)<=2&&lay.cy<lay.H/2&&lay.above,'['+name+'] ロゴは画面中央の上寄りで、はみ出さない（中心 '+lay.cx+','+lay.cy+'／画面 '+lay.W+'×'+lay.H+'）');
  if(name==='tablet')ok(lay.ratio>=0.5&&lay.ratio<=0.6,'[tablet] ロゴの幅は画面幅の'+Math.round(lay.ratio*100)+'%（55%前後）');
  ok(lay.start&&lay.mode,'['+name+'] 「タップではじめる」と、はじめから／つづきからの案内はそのまま');
  await pg.screenshot({path:O+'110_title_'+name+'.png'});
  // 音の切り替え（タイトル画面のまま）
  await pg.locator('#tSe').click();await pg.waitForTimeout(80);let snd=await H(pg,'sound');const s1=await S9(pg);
  ok(!snd.settings.se&&s1.titleUp&&(await pg.getAttribute('#tSe','aria-pressed'))==='false'&&(await pg.getAttribute('#seBtn','aria-pressed'))==='false','['+name+'] タイトル画面で効果音をオフにできる（タイトルは閉じない・上の帯のボタンとも一致）');
  await pg.locator('#tSe').click();await pg.locator('#tBgm').click();await pg.waitForTimeout(80);snd=await H(pg,'sound');
  ok(snd.settings.se&&!snd.settings.bgm&&!snd.bgm&&(await S9(pg)).titleUp,'['+name+'] タイトル画面で BGM をオフにできる');
  await pg.locator('#tBgm').click();await pg.waitForTimeout(80);snd=await H(pg,'sound');
  ok(snd.settings.bgm&&!snd.bgm&&(await S9(pg)).titleUp,'['+name+'] BGM をオンに戻しても、タイトル画面のあいだは鳴らない（鳴り始めは「はじめる」のタップ）',JSON.stringify({unlocked:snd.unlocked,bgm:snd.bgm}));
  ok(!snd0.bgm,'['+name+'] 起動直後は BGM は鳴っていない');
  if(touch){const c=await pg.locator('#titleScreen').boundingBox();await pg.touchscreen.tap(c.x+30,c.y+200);await pg.waitForTimeout(200);}else await tapTitle(pg);
  const s2=await S9(pg);snd=await H(pg,'sound');
  ok(!s2.titleUp&&!s2.titleShown&&s2.titleLog.length===1,'['+name+'] タップでゲームが始まる');
  ok(snd.unlocked&&snd.bgm,'['+name+'] BGM はこのタップで鳴り始める',JSON.stringify({unlocked:snd.unlocked,bgm:snd.bgm}));
  const tu=await H(pg,'tutorial');ok(!tu.done&&tu.step===1&&await pg.isVisible('#tutBar'),'['+name+'] セーブなし → チュートリアルから（手順1・案内の帯）');
  const hits2=await oldTitleHits(pg);ok(hits2.length===0,'['+name+'] ゲーム画面にも旧題の表示なし',hits2.join(','));
  if(name==='tablet'){const tt=await pg.locator('#titleText').innerText();ok(tt==='みんなのときまきタウン','[tablet] 上の帯のタイトル「'+tt+'」');}
  await pg.context().close();
}
{ // 画像が読み込めないとき：文字のロゴ（代替テキストも『みんなのときまきタウン』）
  const pg=await boot(1180,820,null);const e0=errs.length;
  const r=await pg.evaluate(()=>new Promise(res=>{const im=document.getElementById('titleLogoImg');im.addEventListener('error',()=>setTimeout(()=>res({img:document.getElementById('titleLogo').classList.contains('img'),
    tl2:getComputedStyle(document.querySelector('#titleLogo .tl2')).display,text:document.getElementById('titleLogo').innerText.replace(/\s+/g,''),alt:im.alt}),50),{once:true});im.src='title-logo-missing.webp';}));
  const ex=errs.splice(e0);ok(ex.every(x=>/ERR_FILE_NOT_FOUND/.test(x)),'[画像なし] 出たエラーは、わざと読み込めなくした画像の分だけ（'+ex.length+'件）',ex);
  ok(!r.img&&r.tl2!=='none'&&r.text==='みんなのときまきタウン'&&r.alt==='みんなのときまきタウン','[画像なし] 読み込めないときは文字のロゴ「'+r.text+'」に戻る（代替テキスト『'+r.alt+'』）');
  await pg.context().close();
}
{ // セーブあり：続きから
  const s=save(4);s.gold=4321;const pg=await boot(1180,820,s);
  const mode=await pg.locator('#titleMode').innerText();ok(mode==='つづきから','[セーブあり] 「'+mode+'」');
  await pg.keyboard.press('Enter');await pg.waitForTimeout(200);const s9=await S9(pg),snd=await H(pg,'sound');
  const g=await st(pg);ok(!s9.titleUp&&s9.titleLog[0].how==='key'&&s9.titleLog[0].hadSave,'[セーブあり] キー（Enter）でも始められる');
  ok(g.gold===4321&&g.townExp===LV[3]&&!(await pg.isVisible('#tutBar'))&&(await pg.locator('#lvText').innerText())==='町Lv4','[セーブあり] 続きから（ゴールド '+g.gold+'・町Lv4・チュートリアルの帯なし）');
  ok(snd.bgm,'[セーブあり] BGM が鳴り始める');
  await pg.context().close();
}
{ // BGM をオフにしたセーブ：はじめても鳴らない
  const s=save(2);s.settings.bgm=false;const pg=await boot(1180,820,s);await tapTitle(pg);const snd=await H(pg,'sound');
  ok(!snd.bgm&&snd.unlocked,'[BGM オフのセーブ] はじめても鳴らない（設定どおり）');await pg.context().close();
}

// ===== ② 町のレベルアップ =====
log('--- 町のレベルアップ ---');
let DATA;{const pg=await boot(1180,820,save(1));DATA=await H(pg,'unlockData');await pg.context().close();}
// 解放されたもの：データからこのテストで別に数える（index.html の levelUnlocks は使わない）
function expectRows(lv){const r=[];
  for(const [k,n,l] of DATA.crops)if(l===lv)r.push('作物:'+n);
  for(const [k,n,l] of DATA.buildings)if(l===lv)r.push('施設:'+n);
  for(const [k,n,l] of DATA.recipes)if(l===lv)r.push('レシピ:'+n);
  const d=DATA.plots[lv-1]-(lv>1?DATA.plots[lv-2]:DATA.plots[0]);if(d)r.push('畑:+'+d+'区画（全部で'+DATA.plots[lv-1]+'区画）');
  for(const [k,l] of Object.entries(DATA.sp))if(l===lv)r.push('特殊ドリル:'+(k==='FXF'?'FACTOR×FACTOR':'テンパズル'));
  if(DATA.trade===lv)r.push('交換掲示板:町のコード・変種のギフトを交換できる');
  if(DATA.region[lv])r.push('町:'+DATA.region[lv]+'が広がりました');
  const hs=DATA.houses.filter(x=>x===lv).length;if(hs)r.push('町:家が'+hs+'軒ふえました');
  return r;}
const big={};
for(let lv=2;lv<=8;lv++){
  const pg=await boot(1180,820,save(lv-1,{exp:LV[lv-1]-5}));await tapTitle(pg);await H(pg,'walkClear');
  await pg.evaluate(()=>window.__clockseed.sound().log.length);const n0=(await H(pg,'sound')).log.length;
  // 納品で町経験値を得る（実際の注文の納品と同じ gainExp の経路）
  const sv0=JSON.stringify(await st(pg));
  await H(pg,'gainExp',5);await pg.waitForTimeout(400);
  const a=await S9(pg);
  if(lv===8){await pg.waitForTimeout(900);ok(!(await S9(pg)).lvOpen,'[Lv8] パネルの前に、まず花火と紙吹雪を見せる');await pg.screenshot({path:O+'112_levelup_lv8_fireworks_tablet.png'});}
  await pg.waitForFunction(()=>window.__clockseed.stage9().lvOpen,null,{timeout:5000}).catch(()=>{});await pg.waitForTimeout(500);
  const s9=await S9(pg);const open=s9.lvOpen;
  const rows=await pg.$$eval('#lvList li',L=>L.map(li=>li.querySelector('.ck').textContent+':'+li.lastChild.textContent));
  const want=expectRows(lv),title=await pg.locator('#lvTitle').innerText();
  const snd=(await H(pg,'sound')).log.slice(n0).map(x=>x.name);
  const logs=(await H(pg,'log')).map(e=>e.text);
  const walk=(await H(pg,'walkLog')).filter(e=>/^folk/.test(e.id));
  ok(open&&title==='町がLv'+lv+'になった！','[Lv'+lv+'] 「'+title+'」のパネル');
  ok(JSON.stringify(rows)===JSON.stringify(want),'[Lv'+lv+'] 一覧がこのレベルで解放されたものと一致（'+rows.length+'件）',rows.join('｜'),want.length!==rows.length?'期待 '+want.join('｜'):'');
  ok(lv===8?snd.includes('fest'):(snd.includes('bell')&&snd.includes('levelup')),'[Lv'+lv+'] 鐘の音（'+snd.join(',')+'）');
  ok(a.fest&&a.fest.kind===(lv===8?'max':'level')&&a.fest.n>0,'[Lv'+lv+'] 紙吹雪・花びら（'+(a.fest&&a.fest.n)+'枚'+(a.fest&&a.fest.fw?'・花火'+a.fest.fw+'発':'')+'）');
  ok(a.gather&&a.gather.why==='level'&&new Set(walk.map(e=>e.id)).size===4,'[Lv'+lv+'] 町の人が広場に集まる（4人が歩いた記録 '+walk.length+'点）');
  ok(logs.includes('町がLv'+lv+'になった'),'[Lv'+lv+'] ログにも残る（「町がLv'+lv+'になった」）');
  const box=await pg.locator('#lvPanel .box').boundingBox();
  big[lv]={n:a.fest.n,fw:a.fest.fw,dur:a.fest.dur,cls:await pg.evaluate(()=>document.getElementById('lvPanel').classList.contains('big')),w:box.width,fs:await pg.$eval('#lvTitle',e=>parseFloat(getComputedStyle(e).fontSize))};
  if(lv===2||lv===8)await pg.screenshot({path:O+'111_levelup_panel_lv'+lv+'_tablet.png'});
  await pg.locator('#lvPanel').click({position:{x:10,y:10}});await pg.waitForTimeout(150);
  ok(!(await S9(pg)).lvOpen,'[Lv'+lv+'] パネルはタップで閉じる');
  ok(JSON.stringify(await st(pg))===sv0&&(await pg.locator('#lvText').innerText())==='町Lv'+lv,'[Lv'+lv+'] 演出とパネルではセーブは変わらない（町Lvの表示は「町Lv'+lv+'」）');
  await pg.context().close();
}
const others=[2,3,4,5,6,7].map(l=>big[l]);
ok(big[8].cls&&others.every(o=>!o.cls)&&others.every(o=>big[8].n>o.n&&big[8].dur>o.dur&&o.fw===0)&&big[8].fw>0&&others.every(o=>big[8].fs>o.fs),
  '[Lv8] 一番大きな形：花火 '+big[8].fw+'発・紙吹雪 '+big[8].n+'枚（ほかは '+others[0].n+'枚・花火なし）・長さ '+big[8].dur+'秒・大きな題字（'+big[8].fs+'px／ほか '+others[0].fs+'px）・特別の枠');
{ // 2つ上がったとき：両方のレベルの分を出す
  const pg=await boot(1180,820,save(1));await tapTitle(pg);await H(pg,'gainExp',LV[2]);await pg.waitForTimeout(1400);
  const rows=await pg.$$eval('#lvList li',L=>L.map(li=>li.querySelector('.ck').textContent+':'+li.lastChild.textContent));
  const want=[...expectRows(2).map(x=>'Lv2 '+x),...expectRows(3).map(x=>'Lv3 '+x)];
  ok(JSON.stringify(rows)===JSON.stringify(want)&&(await pg.locator('#lvTitle').innerText())==='町がLv3になった！','[Lv1→3] 一度に2つ上がったときは、Lv2・Lv3 の両方を一覧に（'+rows.length+'件）');
  await pg.context().close();
}
{ // スマホ縦のパネル
  const pg=await boot(390,844,save(7,{exp:LV[7]-5}),{dsf:2,touch:true});const c=await pg.locator('#titleScreen').boundingBox();await pg.touchscreen.tap(c.x+30,c.y+200);await pg.waitForTimeout(200);
  await H(pg,'gainExp',5);await pg.waitForTimeout(3300);
  const r=await pg.evaluate(()=>{const b=document.querySelector('#lvPanel .box').getBoundingClientRect();return {l:b.left,r:b.right,t:b.top,bt:b.bottom,W:innerWidth,H:innerHeight};});
  ok(r.l>=0&&r.r<=r.W&&r.t>=0&&r.bt<=r.H,'[スマホ縦] Lv8 のパネルが画面に収まる',JSON.stringify(r));
  await pg.screenshot({path:O+'111_levelup_panel_lv8_phone.png'});
  await pg.context().close();
}

// ===== ③ 時短：時計塔の歯車と針 =====
log('--- 時短：時計塔の歯車と針 ---');
{
  const s=save(5);s.drill.stock=3600;const T=Date.now();s.plots[0]={crop:'pumpkin',plantedAt:T,readyAt:T+30*60*1000};
  const pg=await boot(1180,820,s,{clock:true});await tapTitle(pg);
  const tc=await H(pg,'towerCenter');const clip={x:Math.round(tc.x-60),y:Math.round(tc.y-150),width:120,height:150};
  const shot=async()=>pg.screenshot({clip});
  const before=await shot();
  await pg.mouse.click(tc.x,tc.y);await pg.waitForTimeout(200);await pg.locator('#drillSkipBtn').click();await pg.waitForTimeout(150);
  const row=pg.locator('#skipList .srow',{hasText:'かぼちゃ'});await row.locator('button',{hasText:'−10分'}).click();
  const cls=await pg.$eval('#skipClock',e=>e.classList.contains('spin'));
  await pg.clock.pauseAt(await pg.evaluate(()=>Date.now()+50));await pg.locator('#skipClose').click();
  await pg.clock.runFor(700);await pg.waitForTimeout(60);
  const s9=await S9(pg),mid=await shot();
  await pg.screenshot({path:O+'113_timeskip_gears_tablet.png'});
  await pg.clock.runFor(2500);await pg.waitForTimeout(60);const after=await shot(),s9b=await S9(pg);
  const diff=(A,B)=>{let n=0;for(let i=0;i<A.length;i++)if(A[i]!==B[i])n++;return n;};
  ok(s9.spinLog.length===1&&s9.spinLog[0].ms===600000&&s9.spin&&s9.spin.p>0&&s9.spin.p<1,'[時短 −10分] 時計塔の歯車と針のアニメーションが動く（'+s9.spin.dur+'秒・長針 '+s9.spin.turns+'周）');
  ok(cls,'[時短] スキップのパネルの小さな時計（歯車と針）も回る');
  ok(diff(before,mid)>200,'[時短] 動いている最中は、時計塔の絵が変わる（歯車・光・早回しの針。差 '+diff(before,mid)+'バイト）');
  ok(!s9b.spin&&diff(before,after)<diff(before,mid),'[時短] 終わると、いまの時刻を指す元の絵に戻る');
  // 1回の時短で長針が回る周の数（−1分＝1周 … 最大4周）
  const g=await st(pg);ok(g.drill.stock===3600-600,'[時短] ストックの消費は従来どおり（'+(3600-g.drill.stock)+'秒）');
  await pg.context().close();
}

// ===== ④ チュートリアル（タイトル画面から新規で通し） =====
log('--- チュートリアル：タイトル画面から通し ---');
{
  const pg=await boot(1180,820,null,{url:URL+'&fast=4'});
  const tut=()=>H(pg,'tutorial');
  async function gfxSkip(){for(let k=0;k<30&&(await H(pg,'gachaFx')).active;k++){await pg.mouse.click(10,400);await pg.waitForTimeout(60);}}
  async function closeCeleb(){for(const id of ['lvPanel','tutDonePanel'])if(await pg.isVisible('#'+id)){await pg.locator('#'+id).click({position:{x:10,y:10}});await pg.waitForTimeout(120);}}
  async function closeOver(sel){for(const id of ['ordersPanel','facPanel','drillPanel','skipPanel'])if(await pg.isVisible('#'+id)){const inside=sel?await pg.evaluate(([id,sel])=>{const e=document.querySelector(sel);return !!(e&&e.closest('#'+id));},[id,sel]):false;if(!inside){await pg.locator('#'+id+' .panelhd button').click();await pg.waitForTimeout(120);}}}
  async function follow(){await closeCeleb();const t=await tut();await closeOver(t.dom||null);if(t.dom){await pg.locator(t.dom).first().click();}
    else if(t.world){if(/製粉所/.test(t.text)){const f=await H(pg,'facCenter','mill');await pg.mouse.click(f.x,f.y);}else if(/時計塔|ドリル5問|ガチャ/.test(t.text)){const f=await H(pg,'towerCenter');await pg.mouse.click(f.x,f.y);}else await pg.mouse.click(t.world.x,t.world.y+14);}
    await pg.waitForTimeout(250);await gfxSkip();}
  async function answer5(){for(let k=0;k<5;k++){const i=await H(pg,'drillAnswerIndex');await pg.locator('.choice').nth(i).click();await pg.waitForTimeout(1000);await pg.waitForFunction(()=>document.querySelector('.dres')||document.querySelector('.choice:not([disabled])'),null,{timeout:5000});}}
  const close=async id=>{await closeCeleb();if(await pg.isVisible('#'+id)){const c=await pg.$('#'+id+' .panelhd button');if(c)await c.click();await pg.waitForTimeout(150);}};
  async function skipAll(){const c=await H(pg,'towerCenter');await closeOver(null);await pg.mouse.click(c.x,c.y);await pg.waitForTimeout(200);await pg.locator('#drillSkipBtn').click();await pg.waitForTimeout(150);
    for(const row of await pg.locator('#skipList .srow').all()){const bm=row.locator('button',{hasText:'最大まで'});if(await bm.isEnabled().catch(()=>false)){await bm.click();await pg.waitForTimeout(120);}}
    await closeOver(null);}
  async function until(step,max=24){for(let k=0;k<max;k++){const t=await tut();if(t.done||t.step>=step)return;
    if(/5問に答えよう/.test(t.text)){await answer5();continue;}
    if(!t.dom&&!t.world){await skipAll();continue;}
    await follow();}log('   （手順'+(await tut()).step+'で止まった：'+(await tut()).text+'）');}
  await tapTitle(pg);
  await until(3);                                          // 1 小麦・2 ドリル
  await until(4);                                          // 3 時短（最大まで）
  const s3=await S9(pg);
  ok(s3.spinLog.length>=1&&s3.spin&&s3.spin.dur>=2.5,'[チュートリアル手順3] 時短で時計塔の歯車と針が回る（ゆっくり '+(s3.spin&&s3.spin.dur)+'秒・パネルの小さな時計も）');
  await pg.waitForTimeout(350);
  const vis=await pg.evaluate(()=>({skip:getComputedStyle(document.getElementById('skipPanel')).display,drill:getComputedStyle(document.getElementById('drillPanel')).display}));
  const tc=await H(pg,'towerCenter');const inView=tc.x>0&&tc.x<1180&&tc.y>90&&tc.y<700;
  ok(vis.skip==='none'&&vis.drill==='none'&&inView,'[チュートリアル手順3] 時短のパネルが自動で閉じて、時計塔の動きがはっきり見える（時計塔は画面の中）',JSON.stringify(vis));
  await pg.waitForTimeout(500);const s3b=await S9(pg);ok(s3b.spin&&s3b.spin.p>.3&&s3b.spin.p<.9,'[チュートリアル手順3] パネルが閉じた後も、歯車と針はまだ回っている（進み具合 '+(s3b.spin&&s3b.spin.p.toFixed(2))+'）');
  await pg.screenshot({path:O+'114_tutorial_timeskip_gears.png'});
  let t=await tut();ok(t.step===4,'[チュートリアル手順3] 次の手順へ（手順'+t.step+'）');
  await until(7);                                          // 4 収穫・納品 → 5 ガチャ → 6 にんじん・納品で町Lv2
  await pg.waitForTimeout(1400);let s6=await S9(pg);
  ok(s6.lvOpen&&s6.lvPanel&&s6.lvPanel.lv===2,'[チュートリアル手順6] 納品で町Lv2 → 「町がLv2になった！」のパネル');
  await closeCeleb();
  t=await tut();ok(t.step===7&&!(await S9(pg)).lvOpen,'[チュートリアル] パネルを閉じると案内の続き（手順'+t.step+'）');
  await until(9);                                          // 7 製粉所・8 ドリル
  const n0=(await H(pg,'sound')).log.length;
  await until(99,16);
  await pg.waitForTimeout(300);
  t=await tut();const s9=await S9(pg),snd=(await H(pg,'sound')).log.slice(n0).map(x=>x.name);
  ok(t.done&&s9.tutDoneOpen,'[チュートリアル完了] 完了のパネルが出る');
  ok(snd.includes('bell')&&s9.gather&&s9.gather.why==='tut'&&s9.fest&&s9.fest.kind==='tut','[チュートリアル完了] 鐘・町の人・紙吹雪の小さな祝福（'+snd.join(',')+'）');
  const lvNow=(await st(pg)).townExp>=LV[2]?3:2;
  ok(s9.tutDone.goal==='次の目標：注文を納品して、町Lv'+(lvNow+1)+'を目指そう','[チュートリアル完了] 次の目標を1行で：「'+s9.tutDone.goal+'」');
  ok(/自由に町を育てよう/.test(s9.tutDone.sub),'[チュートリアル完了] 「'+s9.tutDone.sub+'」');
  await pg.screenshot({path:O+'115_tutorial_complete.png'});
  await pg.locator('#tutDonePanel').click({position:{x:10,y:10}});await pg.waitForTimeout(120);
  ok(!(await S9(pg)).tutDoneOpen&&!(await pg.isVisible('#tutBar')),'[チュートリアル完了] タップで閉じて、通常プレイへ');
  await close('facPanel');
  await pg.context().close();
}

// ===== ⑤ 収穫：なぞり収穫の演出・量は main と同じ =====
log('--- 収穫の演出 ---');
const MAIN='/tmp/clockseed_main_stage9.html';fs.writeFileSync(MAIN,cp.execSync('git -C /home/user/clockseed show origin/main:index.html',{maxBuffer:64e6}));
function harvestSave(){const s=save(3),T=Date.now();const crops=['wheat','carrot','potato','tomato','corn','wheat','carrot','potato','tomato','corn','wheat','carrot'];
  crops.forEach((c,i)=>{s.plots[i]={crop:c,plantedAt:T-9e6,readyAt:T-1000};});s.buffs.fert=1;s.buffs.double=1;return s;}
async function swipe(pg,idx,{shotAt=-1,path=null}={}){const pts=[];for(const i of idx)pts.push(await H(pg,'plotCenter',i));
  await pg.mouse.move(pts[0].x,pts[0].y);await pg.mouse.down();let k=0;
  for(let j=1;j<pts.length;j++){const a=pts[j-1],c=pts[j];for(let s=1;s<=6;s++){await pg.mouse.move(a.x+(c.x-a.x)*s/6,a.y+(c.y-a.y)*s/6);}
    if(j===shotAt&&path){await pg.waitForTimeout(160);await pg.screenshot({path});}}
  const mid=await pg.evaluate(()=>({fly:document.querySelectorAll('#fxLayer .hv').length,num:[...document.querySelectorAll('#fxLayer .hvn')].map(e=>e.textContent),tip:(t=>t&&getComputedStyle(t).display==='block'?t.textContent:null)(document.getElementById('comboTip'))}));
  await pg.mouse.up();return mid;}
const ORDER=[0,1,2,3,4,5,6,7,8,9,10,11];
let branchStore,mainStore;
{
  const pg=await boot(1180,820,harvestSave());await tapTitle(pg);
  const before=(await st(pg)).storage,n0=(await H(pg,'sound')).log.length;
  // 並びを確かめる：区画の中心が順番に並ぶ（なぞる道すじ）
  const mid=await swipe(pg,ORDER,{shotAt:6,path:O+'116_harvest_swipe_tablet.png'});
  await pg.waitForTimeout(250);
  const s9=await S9(pg),after=(await st(pg)).storage,snd=(await H(pg,'sound')).log.slice(n0).filter(x=>x.name==='harvest');
  const hv=s9.hvLog.filter(e=>!e.ring),ring=s9.hvLog.filter(e=>e.ring);
  branchStore=Object.fromEntries(Object.keys(after).map(k=>[k,after[k]-before[k]]).filter(([,v])=>v));
  ok(hv.length===12&&hv.every((e,k)=>e.combo===k+1),'[収穫] 1回のなぞりで12区画を続けて収穫（連続数 1→12）');
  ok(hv.every(e=>e.fly>=1&&e.to.y<e.from.y),'[収穫] 作物が弾けて、倉庫の方（上の帯）へ飛ぶ（1区画あたり '+hv.map(e=>e.fly).join(',')+' 個）');
  ok(mid.fly>0&&mid.num.length>0&&mid.num.every(x=>/^\+\d+$/.test(x)),'[収穫] なぞっている最中に、飛ぶ作物 '+mid.fly+'個と「'+mid.num.slice(0,4).join('」「')+'」の表示');
  const arg=snd.map(x=>x.arg);ok(arg.length===12&&arg.every((a,k)=>a===k),'[収穫] 続けて収穫するほど、収穫の音が半音ずつ高く（'+arg.join(',')+'）');
  const items=hv.map(e=>e.items);let acc=0;const sumOk=hv.every(e=>(acc+=e.n)===e.items);
  ok(sumOk&&mid.tip===items[items.length-1]+'個！'&&hv.slice(1).every(e=>e.tip===e.items+'個！')&&hv[0].tip===null,'[収穫] なぞっている最中、連続で取れた数を表示（「'+hv[1].tip+'」→…→「'+mid.tip+'」）');
  ok(ring.length===1&&ring[0].combo===12,'[収穫] 一度にたくさん（5区画以上）取れたので、花丸の輪');
  await pg.waitForTimeout(1800);const left=await pg.evaluate(()=>document.querySelectorAll('#fxLayer *').length);
  ok(left===0,'[収穫] 演出の部品は終わると片づく（残り '+left+'）');
  // 1区画だけのタップ：輪も連続数も出さない
  await H(pg,'plotCenter',0);
  await pg.context().close();
}
{ // 少しだけ（3区画）：輪は出さない
  const pg=await boot(1180,820,harvestSave());await tapTitle(pg);await swipe(pg,[0,1,2]);await pg.waitForTimeout(150);
  const s9=await S9(pg);ok(s9.hvLog.filter(e=>e.ring).length===0&&s9.hvLog.length===3,'[収穫] 3区画だけのときは花丸の輪は出さない');await pg.context().close();
}
{ // main（段階8f）で同じなぞり → 収穫量が同じ
  const ctx=await b.newContext({viewport:{width:1180,height:820}});const s=harvestSave();
  await ctx.addInitScript(x=>{if(!sessionStorage.getItem('__booted')){sessionStorage.setItem('__booted','1');localStorage.clear();localStorage.setItem('clockseed.save',x);}},JSON.stringify(s));
  const pg=await ctx.newPage();await pg.goto('file://'+MAIN+'?debug=1');await pg.waitForTimeout(700);
  const before=(await st(pg)).storage;await swipe(pg,ORDER);await pg.waitForTimeout(200);const after=(await st(pg)).storage;
  mainStore=Object.fromEntries(Object.keys(after).map(k=>[k,after[k]-before[k]]).filter(([,v])=>v));
  const sb=await st(pg);
  ok(JSON.stringify(branchStore)===JSON.stringify(mainStore),'[収穫] 収穫量は main（段階8f）と同じなぞりで一致：'+JSON.stringify(branchStore),'main '+JSON.stringify(mainStore));
  await ctx.close();
}
{ // スマホ縦：指でなぞる
  const s=harvestSave();const pg=await boot(390,844,s,{dsf:2,touch:true});const c=await pg.locator('#titleScreen').boundingBox();await pg.touchscreen.tap(c.x+30,c.y+200);await pg.waitForTimeout(300);
  const cdp=await pg.context().newCDPSession(pg);const pts=[];for(const i of [0,1,2,3,4,5])pts.push(await H(pg,'plotCenter',i));
  const tp=(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p?[{x:p.x,y:p.y,id:1}]:[]});
  await tp('touchStart',pts[0]);for(let j=1;j<pts.length;j++){const a=pts[j-1],q=pts[j];for(let k=1;k<=5;k++)await tp('touchMove',{x:a.x+(q.x-a.x)*k/5,y:a.y+(q.y-a.y)*k/5});}
  await pg.waitForTimeout(120);await pg.screenshot({path:O+'116_harvest_swipe_phone.png'});await tp('touchEnd');await pg.waitForTimeout(200);
  const s9=await S9(pg);const hv=s9.hvLog.filter(e=>!e.ring);
  ok(hv.length>=5&&hv.every((e,k)=>e.combo===k+1)&&s9.hvLog.some(e=>e.ring),'[スマホ縦] 指でなぞって続けて収穫（'+hv.length+'区画・花丸の輪あり）');
  await pg.context().close();
}

// ===== ⑥ JS エラー =====
ok(errs.length===0,'[JS エラー] '+errs.length+'件',errs.slice(0,3));
log(fail?'=> 不合格 '+fail+'件':'=> 全て合格');
await b.close();process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
