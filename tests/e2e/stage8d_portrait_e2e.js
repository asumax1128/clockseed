// 段階8d「スマホは縦画面前提＋ドリルメニューの最小化」の通しテスト
//  ① スマホ（段階8c と同じ条件：幅600px以下 または 高さ520px以下）を横向きにすると案内が出て、下のゲームは操作できない。縦に戻すと消えて遊べる。
//     タブレット・PC（横向きでも）では案内は出ない。向きを変えても町の構図が直る／カメラを動かしていれば直さない
//  ② スマホ（縦）のドリルメニューは説明文なし。A〜E の大きなボタンをタップするとそのまま5問セット。特殊ドリルは名前だけの小さなボタン。閉じるボタンは残す。
//     問題・結果の画面は今のまま。タブレットのドリルメニューは main と同じ（文字も見た目も）
const {chromium}=require('playwright');
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
(async()=>{
const b=await chromium.launch();
const url='file:///home/user/clockseed/index.html?debug=1&intro=0';const O='/home/user/clockseed/screenshots/';
const log=(...a)=>console.log(...a);let fail=0;const ok=(c,msg,...x)=>{log((c?'合格 ':'不合格 ')+msg,...x);if(!c)fail++;};
const errs=[];
async function boot(w,h,save,{mobile=w<700,dsf=1,u=url}={}){
  const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:dsf,hasTouch:true,isMobile:mobile});
  if(save)await ctx.addInitScript(s=>{if(!sessionStorage.getItem('__booted')){sessionStorage.setItem('__booted','1');localStorage.clear();localStorage.setItem('clockseed.save',s);}},JSON.stringify(save));
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await pg.goto(u);await pg.waitForTimeout(700);return pg;}
const H=(pg,f,...a)=>pg.evaluate(([f,a])=>window.__clockseed[f](...a),[f,a]);
const st=pg=>pg.evaluate(()=>JSON.parse(localStorage.getItem('clockseed.save')));
const clone=x=>JSON.parse(JSON.stringify(x));
const BK=['mill','kitchen','bakery','ranch','dairy','jam','restaurant','cake'];
let pg0=await boot(390,844,null);const FRESH=await st(pg0);await pg0.context().close();
const T0=()=>Date.now();
function save(lv){const s=clone(FRESH),T=T0();s.tutorial.done=true;s.tutorial.step=10;s.townExp=[0,30,120,300,600,1100,1800,2800][lv-1];s.gold=5000;s.seenAt=T;
  for(const k of BK)if(lv>=2)s.buildings[k]=null;
  s.drill.shards=500;s.drill.stock=3600;s.drill.tickets=1;s.drill.day='2026-01-01';s.drill.dayCount=3;s.drill.stats={A1:{ok:3,n:4},A2:{ok:1,n:2}};s.orders[0]={crop:'wheat',qty:3};return s;}
const notice=pg=>pg.evaluate(()=>{const n=document.getElementById('rotateNotice'),cs=getComputedStyle(n),r=n.getBoundingClientRect(),iw=innerWidth,ih=innerHeight;
  const pts=[[3,3],[iw-3,3],[3,ih-3],[iw-3,ih-3],[iw/2,ih/2],[iw/2,ih*0.12],[iw/2,ih*0.88],[iw*0.1,ih*0.5],[iw*0.9,ih*0.5]];
  const hit=pts.map(([x,y])=>{const e=document.elementFromPoint(x,y);return !!(e&&e.closest('#rotateNotice'));});
  const tx=[...n.querySelectorAll('.rn-text b,.rn-text span')].map(e=>{const q=e.getBoundingClientRect();return q.left>=0&&q.right<=iw&&q.top>=0&&q.bottom<=ih&&q.width>0;});
  const ph=n.querySelector('.rn-phone').getBoundingClientRect();
  return {shown:cs.display!=='none',full:r.left<=0&&r.top<=0&&r.right>=iw&&r.bottom>=ih,hit:hit.every(Boolean),textIn:tx.every(Boolean),text:n.querySelector('.rn-text b').textContent,phone:[Math.round(ph.width),Math.round(ph.height)],phoneIn:ph.left>=0&&ph.right<=iw&&ph.top>=0&&ph.bottom<=ih};});

// ===== ① 横向き案内 =====
{log('--- スマホ横の案内 ---');
 for(const [w,h,name] of [[844,390,'スマホ横 844×390'],[667,375,'小さめのスマホ横 667×375'],[740,360,'スマホ横 740×360']]){
   const pg=await boot(w,h,save(5));const n=await notice(pg);
   ok(n.shown&&n.full&&n.hit&&n.textIn&&n.phoneIn&&n.text.includes('縦画面')&&n.text.includes('スマホ'),'['+name+'] 「'+n.text+'」の案内がゲームの上いっぱいに出る（文・絵が画面に収まり、画面のどこをタップしても案内に当たる）',JSON.stringify(n));
   // 下のゲームを操作できない：町・作物ボタン・上の帯・ログをタップしても何も起きない
   const before=await st(pg),tp=await H(pg,'towerPos');await H(pg,'lookAt',tp.x,tp.y,1.2);const tc=await H(pg,'towerCenter');
   await pg.touchscreen.tap(tc.x,tc.y);await pg.waitForTimeout(250);
   await pg.touchscreen.tap(w*0.2,h-30);await pg.waitForTimeout(150);await pg.touchscreen.tap(w*0.5,20);await pg.waitForTimeout(150);await pg.touchscreen.tap(w*0.5,h*0.5);await pg.waitForTimeout(150);
   await pg.mouse.click(tc.x,tc.y);await pg.waitForTimeout(150);
   const open=await pg.evaluate(()=>['drillPanel','ordersPanel','facPanel','logPanel','warehousePanel','dexPanel','popup','tradePanel'].filter(i=>getComputedStyle(document.getElementById(i)).display!=='none'));
   const after=await st(pg);
   ok(open.length===0&&JSON.stringify(after.plots)===JSON.stringify(before.plots)&&after.settings.bgm===before.settings.bgm&&after.settings.se===before.settings.se,'['+name+'] 案内が出ているあいだは、時計塔・畑・作物ボタン・上の帯・音のボタンをタップしても何も起きない',open.join(','));
   if(w===844)await pg.screenshot({path:O+'91_rotate_notice_phone_landscape.png'});
   await pg.context().close();}
 // 向きの切り替え（同じページのまま画面サイズを変える）：横 → 縦 → 横 → 縦
 const pg=await boot(844,390,save(5));let n=await notice(pg);ok(n.shown,'[向き] 横向きで開く → 案内が出る');
 const camL=await H(pg,'camera');
 await pg.setViewportSize({width:390,height:844});await pg.waitForTimeout(500);n=await notice(pg);const vp1=await H(pg,'viewport');const c1=await H(pg,'contentScreen');
 ok(!n.shown&&c1.x0>=-0.5&&c1.x1<=390.5,'[向き] 縦にすると案内が消え、町（時計塔から畑まで）が画面の幅に収まる構図に直る（'+Math.round(c1.x0)+'〜'+Math.round(c1.x1)+'）');
 {const tp=await H(pg,'towerPos');await H(pg,'lookAt',tp.x,tp.y,1.0);const tc=await H(pg,'towerCenter');await pg.touchscreen.tap(tc.x,tc.y);await pg.waitForTimeout(300);
  ok(await pg.isVisible('#drillPanel'),'[向き] 縦では普通に遊べる（時計塔をタップ→ドリルが開く）');await pg.locator('#drillClose').tap();await pg.waitForTimeout(150);}
 await pg.setViewportSize({width:844,height:390});await pg.waitForTimeout(500);n=await notice(pg);ok(n.shown&&n.full&&n.hit,'[向き] もう一度横にすると、また案内が出て操作できない');
 await pg.setViewportSize({width:390,height:844});await pg.waitForTimeout(500);n=await notice(pg);ok(!n.shown,'[向き] 縦に戻すと案内が消える');
 // カメラを動かしてから向きを変えると、構図は直さない（ズームボタンを押した状態が残る）
 await H(pg,'lookAt',200,120,1.0);await pg.locator('#zoomIn').tap();await pg.waitForTimeout(200);const z1=(await H(pg,'zoomInfo')).zoom;
 await pg.setViewportSize({width:844,height:390});await pg.waitForTimeout(400);await pg.setViewportSize({width:390,height:844});await pg.waitForTimeout(500);const z2=(await H(pg,'zoomInfo')).zoom,zi=await H(pg,'zoomInfo');
 ok(Math.abs(z2-Math.max(z1,zi.min))<1e-6||z2>=zi.min-1e-9,'[向き] 自分でズームしたあとに向きを変えても、構図を勝手に直さない（'+z1.toFixed(2)+'→'+z2.toFixed(2)+'）');
 await pg.context().close();
 // タブレット・PC：横向きでも案内は出ない
 for(const [w,h,name,mob] of [[1180,820,'タブレット横 1180×820',false],[1024,768,'iPad 横 1024×768',false],[1366,1024,'iPad Pro 横 1366×1024',false],[1280,720,'ノートPC 1280×720',false],[1920,1080,'PC 1920×1080',false],[768,1024,'iPad 縦 768×1024',false],[1024,600,'小さめのタブレット横 1024×600',false]]){
   const pg=await boot(w,h,save(5),{mobile:mob});const n=await notice(pg);const tp=await H(pg,'towerPos');await H(pg,'lookAt',tp.x,tp.y,1.2);const tc=await H(pg,'towerCenter');await pg.mouse.click(tc.x,tc.y);await pg.waitForTimeout(250);
   ok(!n.shown&&await pg.isVisible('#drillPanel'),'['+name+'] 案内は出ない・従来どおり遊べる（時計塔→ドリルが開く）');await pg.context().close();}}

// ===== ② スマホ縦のドリルメニュー =====
{log('--- スマホ縦のドリルメニュー ---');
 const EXPL=['.dstat','.tstats','.setnote','.gpity','.sphead small'];
 for(const [w,h,name] of [[390,844,'390×844'],[360,740,'360×740']]){
   const pg=await boot(w,h,save(5));const tp=await H(pg,'towerPos');await H(pg,'lookAt',tp.x,tp.y,1.0);const tc=await H(pg,'towerCenter');await pg.touchscreen.tap(tc.x,tc.y);await pg.waitForTimeout(350);
   ok(await pg.isVisible('#drillPanel'),'['+name+'] ドリルのパネルが開く');
   const m=await pg.evaluate(EXPL=>{const R=e=>e.getBoundingClientRect(),vis=e=>e.offsetParent!==null&&getComputedStyle(e).display!=='none'&&R(e).height>0;
     const menu=document.querySelector('#drillBody .dmenu'),txt=menu.innerText.replace(/\s+/g,' ');
     const exp=EXPL.filter(s=>[...menu.querySelectorAll(s)].some(vis));
     const lv=[...menu.querySelectorAll('.lvbtn')].map(e=>({t:e.innerText.trim(),h:Math.round(R(e).height),w:Math.round(R(e).width),fs:parseFloat(getComputedStyle(e.querySelector('b')).fontSize),vis:vis(e),lvl:e.dataset.lv}));
     const sp=[...menu.querySelectorAll('.spbtns .tool')].map(e=>({t:e.innerText.replace(/\s+/g,' ').trim(),h:Math.round(R(e).height),w:Math.round(R(e).width)}));
     const start=document.getElementById('drillStartBtn'),close=document.getElementById('drillClose'),cr=R(close);
     const box=R(document.querySelector('#drillPanel .box'));
     return {txt,exp,lv,sp,startVisible:start&&vis(start),close:[Math.round(cr.width),Math.round(cr.height)],closeIn:cr.left>=0&&cr.right<=innerWidth&&cr.top>=0,boxIn:box.left>=0&&box.right<=innerWidth&&box.top>=0&&box.bottom<=innerHeight,
       hasSkip:!!document.getElementById('drillSkipBtn')&&vis(document.getElementById('drillSkipBtn')),gacha:[...menu.querySelectorAll('.gbtns .tool')].map(e=>e.innerText.trim())};},EXPL);
   log('   メニューの文字：',m.txt);
   ok(m.exp.length===0,'['+name+'] 説明文（時短ストック等の行・種類ごとの成績・5問の説明・ガチャの確定回数・特殊ドリルの報酬の説明）が出ていない',m.exp.join(','));
   ok(m.lv.length===5&&m.lv.every(x=>x.vis&&x.t===x.lvl&&x.fs>=40&&x.h>=80&&x.w>=80)&&m.lv.map(x=>x.t).join('')==='ABCDE','['+name+'] 残るのは A・B・C・D・E の5つの大きなボタン（文字だけ・文字 '+m.lv[0].fs+'px・'+m.lv[0].w+'×'+m.lv[0].h+'px）',JSON.stringify(m.lv.map(x=>x.t+x.h)));
   ok(!m.startVisible,'['+name+'] 「5問セットを始める」ボタンは無い（A〜E をタップすると始まる）');
   ok(m.sp.length===2&&m.sp[0].t==='FACTOR×FACTOR'&&m.sp[1].t==='テンパズル'&&m.sp.every(x=>x.h>=44),'['+name+'] 特殊ドリルは名前だけの小さなボタン',JSON.stringify(m.sp));
   ok(m.close[0]>=44&&m.close[1]>=44&&m.closeIn&&m.boxIn,'['+name+'] 閉じるボタンが残っている（'+m.close.join('×')+'）・パネルは画面に収まる');
   log('   参考：機能のボタン（時短・図鑑・ガチャ）は文章なしで残してある：時短 '+m.hasSkip+'・ガチャ '+m.gacha.join('/'));
   await pg.screenshot({path:O+'92_drill_menu_phone_'+(w===390?'a':'b')+'.png'});
   // B をタップ → そのまま B の5問セット（問題の画面は今のまま）
   await pg.locator('.lvbtn[data-lv="B"]').tap();await pg.waitForTimeout(300);
   const set=await H(pg,'drillSetInfo');ok(set&&set.level==='B'&&set.set.length===5&&set.i===0,'['+name+'] B をタップ→そのまま B の5問セットが始まる（通常3＋復習1＋挑戦1＝5問）',JSON.stringify(set&&{level:set.level,n:set.set.length}));
   const q=await pg.evaluate(()=>({prompt:document.querySelector('.dq-prompt').innerText.trim().length>0,choices:document.querySelectorAll('.choice').length,head:document.querySelector('.dq-head').innerText.replace(/\s+/g,' ')}));
   ok(q.prompt&&q.choices===4&&/B/.test(q.head)&&/1\s*\/\s*5/.test(q.head),'['+name+'] 問題の画面は今のまま（問題文・4つの選択肢・難度・1/5問）',q.head);
   // 答えて「こたえは…」と結果の画面も今のまま
   let k=await H(pg,'drillAnswerIndex');await pg.locator('.choice').nth((k+1)%4).tap();await pg.waitForTimeout(250);
   const fb=await pg.evaluate(()=>document.getElementById('dqFb').innerText.replace(/\s+/g,' '));ok(/こたえは/.test(fb),'['+name+'] 不正解のときの「こたえは…」は残っている',fb);
   await pg.locator('#dqFb button').tap();await pg.waitForTimeout(250);
   for(let i=1;i<5;i++){await pg.waitForSelector('.choice:not([disabled])',{timeout:6000});k=await H(pg,'drillAnswerIndex');await pg.locator('.choice').nth(k).tap();await pg.waitForTimeout(1050);}
   await pg.waitForSelector('.dres',{timeout:6000});const res=await pg.evaluate(()=>document.querySelector('.dres').innerText.replace(/\s+/g,' '));
   const resFull=await pg.evaluate(()=>document.getElementById('drillBody').innerText.replace(/\s+/g,' '));
   ok(/5問中/.test(res)&&/時短ストック/.test(res)&&/カケラ/.test(res)&&/連続正解/.test(resFull)&&await pg.locator('#drillBody .dstat').count()>0,'['+name+'] 結果の画面は今のまま（正解数・時短ストック・カケラ・連続正解・状態の行）',res.slice(0,70));
   await pg.locator('#drillMenuBtn').tap();await pg.waitForTimeout(200);const back=await pg.evaluate(()=>!!document.querySelector('#drillBody .dmenu .lvgrid')&&document.querySelectorAll('#drillBody .dmenu .dstat').length===1&&getComputedStyle(document.querySelector('#drillBody .dmenu .dstat')).display==='none');
   ok(back,'['+name+'] 結果から「メニューへ」戻ると、また説明文なしの最小メニュー');
   await pg.context().close();}
 // 特殊ドリルのボタンが押せる（町Lv3：FACTOR×FACTOR、町Lv4：テンパズル）／未解放は「町Lv○で解放」
 {const pg=await boot(390,844,save(3));const tp=await H(pg,'towerPos');await H(pg,'lookAt',tp.x,tp.y,1.0);const tc=await H(pg,'towerCenter');await pg.touchscreen.tap(tc.x,tc.y);await pg.waitForTimeout(350);
  const sp=await pg.evaluate(()=>[...document.querySelectorAll('.dmenu .spbtns .tool')].map(e=>({t:e.innerText.replace(/\s+/g,' ').trim(),dis:e.disabled})));
  ok(sp[0].t==='FACTOR×FACTOR'&&!sp[0].dis&&/テンパズル/.test(sp[1].t)&&/Lv4で解放/.test(sp[1].t)&&sp[1].dis,'[町Lv3] FACTOR×FACTOR は押せる・テンパズルは「町Lv4で解放」と出て押せない',JSON.stringify(sp));
  await pg.locator('[data-sp="FXF"]').tap();await pg.waitForTimeout(300);ok(await pg.isVisible('#fxfPanel')&&await pg.isVisible('#fxfStart'),'[町Lv3] FACTOR×FACTOR のボタンをタップ→移植版が開く');
  await pg.locator('#fxfClose').tap();await pg.context().close();}
 {const pg=await boot(390,844,save(4));const tp=await H(pg,'towerPos');await H(pg,'lookAt',tp.x,tp.y,1.0);const tc=await H(pg,'towerCenter');await pg.touchscreen.tap(tc.x,tc.y);await pg.waitForTimeout(350);
  await pg.locator('[data-sp="TP"]').tap();await pg.waitForTimeout(300);ok(await pg.isVisible('#tpPanel'),'[町Lv4] テンパズルのボタンをタップ→移植版が開く');await pg.locator('#tpClose').tap();await pg.context().close();}
 // 閉じる・時短・ガチャが使える
 {const pg=await boot(390,844,save(5));const tp=await H(pg,'towerPos');await H(pg,'lookAt',tp.x,tp.y,1.0);const tc=await H(pg,'towerCenter');await pg.touchscreen.tap(tc.x,tc.y);await pg.waitForTimeout(350);
  const sh0=(await st(pg)).drill.shards;await pg.locator('.dmenu .gbtns button',{hasText:'1回引く'}).tap();await pg.waitForTimeout(300);for(let i=0;i<4&&await pg.isVisible('#gachaFx');i++){await pg.touchscreen.tap(195,420);await pg.waitForTimeout(150);}
  ok((await st(pg)).drill.shards===sh0-20,'[スマホ縦] メニューからガチャ1回が引ける（カケラ '+sh0+'→'+(sh0-20)+'）');
  await pg.locator('#drillMenuBtn').tap().catch(()=>{});await pg.waitForTimeout(150);
  await pg.locator('#drillClose').tap();await pg.waitForTimeout(150);ok(!await pg.isVisible('#drillPanel'),'[スマホ縦] 閉じるボタン（×）でメニューを閉じられる');await pg.context().close();}
 // チュートリアル：スマホでは A のボタンを光らせる（「5問セットを始める」が無いため）
 {const s=save(2);s.tutorial={done:false,step:2,sets:0,mark:0,flags:{d1:false,pull:false},tickets:0,granted:true};s.townExp=0;
  const pg=await boot(390,844,s);const tp=await H(pg,'towerPos');await H(pg,'lookAt',tp.x,tp.y,1.0);const tc=await H(pg,'towerCenter');await pg.touchscreen.tap(tc.x,tc.y);await pg.waitForTimeout(400);
  const t=await H(pg,'tutorial');const hl=await pg.evaluate(()=>{const e=document.querySelector('.tut-hl');return e?{lv:e.dataset.lv,t:e.innerText.trim()}:null;});
  ok(t.dom&&/lvbtn/.test(t.dom)&&hl&&hl.lv==='A','[チュートリアル] スマホでは、ドリルの案内が A のボタンを光らせる',JSON.stringify({dom:t.dom,hl}));
  await pg.locator('.lvbtn[data-lv="A"]').tap();await pg.waitForTimeout(300);ok((await H(pg,'drillSetInfo')||{}).level==='A','[チュートリアル] A をタップ→5問セットが始まり、案内は「5問に答えよう」へ進む',(await H(pg,'tutorial')).text);await pg.context().close();}
}

// ===== ③ タブレットのドリルメニューは main と同じ =====
{log('--- タブレットのドリルメニュー（main と比較）---');
 const mainFile=path.join(os.tmpdir(),'clockseed_main_8d_index.html');
 try{fs.writeFileSync(mainFile,cp.execSync('git show origin/main:index.html',{cwd:'/home/user/clockseed',maxBuffer:64e6}));}catch(e){log('main の index.html を用意できません',e.message);}
 const mainUrl='file://'+mainFile+'?debug=1&intro=0';
 for(const [w,h] of [[1180,820],[1024,768],[768,1024]]){
   const snap=async u=>{const pg=await boot(w,h,save(5),{mobile:false,u});const tp=await H(pg,'towerPos');await H(pg,'lookAt',tp.x,tp.y,1.2);const tc=await H(pg,'towerCenter');await pg.mouse.click(tc.x,tc.y);await pg.waitForTimeout(400);
     const text=await pg.evaluate(()=>document.getElementById('drillBody').innerText.replace(/\s+/g,' ').trim());
     const vis=await pg.evaluate(()=>['.dstat','.tstats','.setnote','#drillStartBtn','.lvbtn span','.lvbtn small','.sphead small','.gpity','.spbtns small'].map(s=>[s,[...document.querySelectorAll('#drillBody '+s)].some(e=>e.offsetParent!==null&&getComputedStyle(e).display!=='none')]));
     const png=await pg.locator('#drillPanel .box').screenshot({animations:'disabled'});
     await pg.locator('.lvbtn').nth(2).click();await pg.waitForTimeout(200);const sel=await pg.evaluate(()=>({sel:document.querySelector('.lvbtn.sel b')?.textContent,started:!!document.querySelector('.dq-prompt')}));
     await pg.context().close();return {text,vis,png,sel};};
   const a=await snap(mainUrl),n=await snap(url);
   ok(a.text===n.text&&JSON.stringify(a.vis)===JSON.stringify(n.vis)&&a.vis.every(([,v])=>v),'['+w+'×'+h+'] ドリルメニューの文字・説明文の表示が main と同じ（説明文あり）',a.text===n.text?'':'\n main: '+a.text.slice(0,120)+'\n new : '+n.text.slice(0,120));
   ok(Buffer.compare(a.png,n.png)===0,'['+w+'×'+h+'] ドリルメニューの見た目が main と1ピクセルも違わない');
   ok(n.sel.sel==='C'&&!n.sel.started,'['+w+'×'+h+'] タブレットは従来どおり、難度ボタンは「えらぶ」だけ（タップしてもすぐには始まらない）',JSON.stringify(n.sel));
   if(w===1180){const pg=await boot(w,h,save(5),{mobile:false,dsf:2});const tp=await H(pg,'towerPos');await H(pg,'lookAt',tp.x,tp.y,1.2);const tc=await H(pg,'towerCenter');await pg.mouse.click(tc.x,tc.y);await pg.waitForTimeout(400);await pg.screenshot({path:O+'93_drill_menu_tablet_unchanged.png'});await pg.context().close();}
 }}

ok(errs.length===0,'[JS エラー] 0件',errs.slice(0,3));
log(fail?'\n=> 不合格 '+fail+'件':'\n=> 全て合格');
await b.close();process.exit(fail?1:0);
})();
