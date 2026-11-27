// 段階8a「施設の進化・できあがりの伝わりやすさ・ズーム改善」の通しテスト
// 移行（v13→v14）・進化（費用・工事時間・工事中は加工不可・加工中は進化不可・加工時間の短縮と隣接・お手伝いとの重なり）・
// 進み具合の常時表示と完成演出・出来事のログ（書式・区画名・30件・留守中のまとめ）・ズーム（最小で町全体・＋／−）
const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch();
const url='file:///home/user/clockseed/index.html?debug=1';const O='/home/user/clockseed/screenshots/';
const log=(...a)=>console.log(...a);let fail=0;const ok=(c,msg,...x)=>{log((c?'合格 ':'不合格 ')+msg,...x);if(!c)fail++;};
const errs=[];
// 音は AudioContext の start を数える（段階7と同じ）
const AUDIO_SPY=()=>{const A=window.AudioContext;window.__audio={starts:0};if(!A)return;const P=A.prototype,co=P.createOscillator;
  P.createOscillator=function(){const o=co.call(this),s=o.start;o.start=function(...a){window.__audio.starts++;return s.apply(this,a);};return o;};};
// セーブを「アプリを閉じていたあいだに置いた」形で入れる：ページのスクリプトより先に localStorage へ（最初の1回だけ）
async function boot(save,vp={width:1180,height:820},dsf=1){
  const ctx=await b.newContext({viewport:vp,deviceScaleFactor:dsf});await ctx.addInitScript(AUDIO_SPY);
  if(save)await ctx.addInitScript(s=>{if(!sessionStorage.getItem('__booted')){sessionStorage.setItem('__booted','1');localStorage.clear();localStorage.setItem('clockseed.save',s);}},JSON.stringify(save));
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await pg.goto(url);await pg.waitForTimeout(500);return pg;}
const H=(pg,f,...a)=>pg.evaluate(([f,a])=>window.__clockseed[f](...a),[f,a]);
const st=pg=>pg.evaluate(()=>JSON.parse(localStorage.getItem('clockseed.save')));
const clone=x=>JSON.parse(JSON.stringify(x));
const LV=[0,30,120,300,600,1100,1800,2800];
const BKEYS=['mill','kitchen','bakery','ranch','dairy','jam','restaurant','cake'];
let pg=await boot(null);const FRESH=await st(pg);const C=await H(pg,'constants');await pg.context().close();
const BLD=C.BUILDINGS,REC=C.RECIPES;
const base=(o={})=>{const s=clone(FRESH);s.tutorial.done=true;s.tutorial.step=10;s.townExp=LV[7];s.gold=0;return Object.assign(s,o);};
const T0=()=>Date.now();
const built=(o={})=>Object.assign({startedAt:T0()-9e6,builtAt:T0()-8e6,job:null,lv:1},o);
const openFac=async(pg,k)=>{const c=await H(pg,'facCenter',k);await pg.mouse.click(c.x,c.y);await pg.waitForTimeout(250);};
const sounds=async pg=>(await H(pg,'sound')).log.filter(x=>x.played).map(x=>x.name);

// ===== 1. 移行：version 13 → 14（進化は Lv1、既存のデータはそのまま） =====
{const v13=base();v13.saveVersion=13;delete v13.seenAt;v13.gold=4321;v13.storage.wheat=12;
  v13.buildings.mill={startedAt:T0()-9e6,builtAt:T0()-8e6,job:{recipe:'flour',startedAt:T0()-1000,readyAt:T0()+119000,skipMs:500}};
  v13.buildings.kitchen={startedAt:T0()-1000,builtAt:T0()+299000,job:null,buildSkipMs:1000};
  v13.plots[0]={crop:'wheat',plantedAt:T0()-1000,readyAt:T0()+119000};v13.gacha.pity={r:2,sr:9,ur:31};v13.settings={bgm:false,se:true};
  pg=await boot(v13);const s=await st(pg);const bk=await pg.evaluate(()=>localStorage.getItem('clockseed.save.v13.backup'));
  const same=k=>JSON.stringify(s[k])===JSON.stringify(v13[k]);
  ok(s.saveVersion===14,'[移行] saveVersion 13 → 14',s.saveVersion);
  ok(s.buildings.mill.lv===1&&s.buildings.kitchen.lv===1&&!s.buildings.mill.up&&JSON.stringify(s.buildings.mill.job)===JSON.stringify(v13.buildings.mill.job)&&s.buildings.kitchen.buildSkipMs===1000&&s.buildings.kitchen.builtAt===v13.buildings.kitchen.builtAt,'[移行] 施設は進化Lv1。加工中のジョブ・建設中の時刻と時短はそのまま');
  ok(['gold','townExp','storage','plots','gacha','tutorial','trade','settings','orders','drill'].every(same)&&!!bk&&JSON.parse(bk).saveVersion===13,'[移行] ゴールド・経験値・倉庫・畑・ガチャ・チュートリアル・交換・音の設定・注文・ドリルはそのまま／元のセーブを .v13.backup に退避',['gold','townExp','storage','plots','gacha','tutorial','trade','settings','orders','drill'].filter(k=>!same(k)).join(','));
  await pg.context().close();}

// ===== 2. 進化：費用と工事時間 =====
{const exp=BKEYS.map(k=>[k,BLD[k].cost*2,Math.ceil(BLD[k].cost*4/10)*10]);
  pg=await boot(base({gold:20000,buildings:Object.fromEntries(BKEYS.map(k=>[k,built()]))}));
  const got=[];for(const [k] of exp){const f=await H(pg,'facInfo',k);got.push([k,f.cost2,f.cost3]);}
  ok(JSON.stringify(got)===JSON.stringify(exp),'[費用] 8施設：Lv2＝建設費×2、Lv3＝建設費×4（10G単位に切り上げ）',got.map(x=>x.join(':')).join(' '));
  await openFac(pg,'mill');const g0=(await st(pg)).gold;
  ok((await pg.innerText('#evoBox')).includes('200G')&&(await pg.innerText('#evoBox')).includes('3分'),'[パネル] 次の Lv の費用と工事時間を表示',(await pg.innerText('#evoBox')).replace(/\s+/g,' '));
  await pg.locator('#evoBtn').click();await pg.waitForTimeout(200);let s=await st(pg),f=await H(pg,'facInfo','mill');
  ok(g0-s.gold===200&&f.evolving&&f.lv===1&&s.buildings.mill.up.lv===2&&s.buildings.mill.up.readyAt-s.buildings.mill.up.startedAt===BLD.mill.buildMs,'[進化] Lv2へ：200G 払って、工事時間＝建設時間（'+BLD.mill.buildMs/60000+'分）',JSON.stringify(s.buildings.mill.up));
  const jb=pg.locator('#facJob_flour');ok(await jb.isDisabled()&&(await jb.innerText())==='進化の工事中'&&(await pg.locator('#facTitle').innerText()).includes('進化中'),'[工事中] 加工は始められない（ボタンは「進化の工事中」）');
  ok(await pg.evaluate(()=>window.__clockseed.timers().some(x=>x.id==='evo:mill')),'[工事中] 進化の工事は時短の対象（時短パネルに出る）');
  await pg.screenshot({path:O+'63_evo_panel.png'});
  await pg.context().close();
  // 工事が終わる → Lv2。Lv3 の費用・最大Lv
  const s2=clone(s);s2.buildings.mill.up.startedAt=T0()-BLD.mill.buildMs-1000;s2.buildings.mill.up.readyAt=T0()-1000;
  pg=await boot(s2);f=await H(pg,'facInfo','mill');ok(f.lv===2&&!f.evolving,'[完成] 工事が終わると Lv2',JSON.stringify(f));
  await openFac(pg,'mill');const g1=(await st(pg)).gold;await pg.locator('#evoBtn').click();await pg.waitForTimeout(200);s=await st(pg);
  ok(g1-s.gold===400&&s.buildings.mill.lv===2&&s.buildings.mill.up.lv===3,'[進化] Lv3へ：400G（建設費100G×4）',g1-s.gold);
  const s3=clone(s);s3.buildings.mill.up.readyAt=T0()-1000;s3.buildings.mill.up.startedAt=T0()-200000;await pg.context().close();
  pg=await boot(s3);f=await H(pg,'facInfo','mill');await openFac(pg,'mill');
  ok(f.lv===3&&f.block==='最大Lv'&&!await pg.$('#evoBtn')&&(await pg.innerText('#evoBox')).includes('最大Lv'),'[最大] Lv3 で止まる（進化ボタンなし）');await pg.context().close();}

// ===== 3. 加工中は進化できない・加工時間の短縮（隣接・お手伝いと掛け算） =====
{pg=await boot(base({gold:5000,storage:Object.assign(clone(FRESH.storage),{wheat:40,flour:40}),buildings:Object.assign(Object.fromEntries(BKEYS.map(k=>[k,null])),{mill:built({job:{recipe:'flour',startedAt:T0()-1000,readyAt:T0()+60000}})})}));
  await openFac(pg,'mill');const eb=pg.locator('#evoBtn');
  ok(await eb.isDisabled()&&(await eb.innerText()).includes('加工が終わるまで'),'[加工中] 加工の途中は進化を始められない',await eb.innerText());await pg.context().close();
  const durs=[];
  for(const L of [1,2,3]){pg=await boot(base({storage:Object.assign(clone(FRESH.storage),{wheat:40}),buildings:Object.assign(Object.fromEntries(BKEYS.map(k=>[k,null])),{mill:built({lv:L})})}));
    await openFac(pg,'mill');await pg.locator('#facJob_flour').click();await pg.waitForTimeout(150);const j=(await st(pg)).buildings.mill.job;durs.push(j.readyAt-j.startedAt);await pg.context().close();}
  ok(JSON.stringify(durs)===JSON.stringify([120000,102000,84000]),'[短縮] 小麦粉 120秒 → Lv2 102秒 → Lv3 84秒',durs.map(x=>x/1000+'秒').join(' → '));
  // パン屋（ジャム工房と隣接）：×進化 → ×0.9（切り上げ）。パネルの表示も
  const bread=REC.bread.ms,expB={1:Math.ceil(bread*0.9),2:Math.ceil(bread*85/100*0.9),3:Math.ceil(bread*70/100*0.9)},gotB={};
  for(const L of [1,2,3]){pg=await boot(base({storage:Object.assign(clone(FRESH.storage),{flour:40}),buildings:Object.assign(Object.fromEntries(BKEYS.map(k=>[k,null])),{bakery:built({lv:L}),jam:built()})}));
    await openFac(pg,'bakery');const txt=(await pg.locator('.mrow',{hasText:'パン'}).first().innerText()).replace(/\s+/g,' ');
    await pg.locator('#facJob_bread').click();await pg.waitForTimeout(150);const j=(await st(pg)).buildings.bakery.job;gotB[L]=j.readyAt-j.startedAt;if(L===3)log('   パネルの表示（Lv3・隣接）:',txt.slice(0,90));await pg.context().close();}
  ok(JSON.stringify(gotB)===JSON.stringify(expB),'[重なり] パン（'+bread/1000+'秒）＋隣接：Lv1 '+gotB[1]/1000+'秒・Lv2 '+gotB[2]/1000+'秒・Lv3 '+gotB[3]/1000+'秒（×0.85／×0.70 → ×0.9）',JSON.stringify(expB));
  // 見習いパン職人（時短効率+10%）も進化したパン屋でそのまま効く：ストック60秒で66秒縮む
  const g=clone(FRESH.gacha);g.items.hp03=1;g.dex.hp03=1;
  pg=await boot(base({gacha:g,drill:Object.assign(clone(FRESH.drill),{stock:60}),buildings:Object.assign(Object.fromEntries(BKEYS.map(k=>[k,null])),{bakery:built({lv:3,job:{recipe:'bread',startedAt:T0(),readyAt:T0()+252000}})})}));
  const r0=(await H(pg,'timers')).find(x=>x.id==='job:bakery');await openFac(pg,'bakery');await pg.locator('#facBody .tool',{hasText:'時短を使う'}).click();await pg.waitForTimeout(200);
  await pg.locator('#skipList .srow',{hasText:'パン屋'}).locator('button',{hasText:'最大まで'}).click();await pg.waitForTimeout(150);const r1=(await H(pg,'timers')).find(x=>x.id==='job:bakery');
  const cut=Math.round((r0.remaining-r1.remaining)/1000);ok(cut>=65&&cut<=67&&(await st(pg)).drill.stock===0,'[重なり] 進化Lv3のパン屋でも、見習いパン職人の時短効率+10%（ストック60秒で '+cut+'秒短縮）');
  await pg.context().close();}

// ===== 4. 町の画面の進み具合（常に表示）と完成の演出 =====
{const T=T0();const s=base({storage:Object.assign(clone(FRESH.storage),{wheat:20}),buildings:Object.assign(Object.fromEntries(BKEYS.map(k=>[k,null])),{
    mill:built({lv:3,job:{recipe:'flour',startedAt:T-30000,readyAt:T+90000}}),kitchen:built({lv:2,job:{recipe:REC&&Object.keys(REC).find(r=>REC[r].building==='kitchen'),startedAt:T-1000,readyAt:T+2500}}),
    bakery:built({up:{lv:2,startedAt:T-60000,readyAt:T+540000}}),ranch:{startedAt:T-100000,builtAt:T+800000,job:null,lv:1}})});
  pg=await boot(s);await pg.evaluate(()=>window.__clockseed.overview());await pg.waitForTimeout(300);
  const ch=await H(pg,'chips');const job=ch.find(c=>c.k==='mill'&&c.kind==='job'),evo=ch.find(c=>c.k==='bakery'&&c.kind==='evo'),bld=ch.find(c=>c.k==='ranch'&&c.kind==='build');
  const rem=(await H(pg,'timers')).find(x=>x.id==='job:mill').remaining/1000;
  ok(job&&job.icon==='ic_flour'&&job.frac>0.2&&job.frac<0.3&&Math.abs(job.text.split(':').reduce((m,x)=>m*60+ +x,0)-Math.ceil(rem))<=1,'[表示] 加工中：製品のアイコン（小麦粉）＋バー（'+(job&&Math.round(job.frac*100))+'%）＋残り時間 '+(job&&job.text),JSON.stringify(job));
  ok(evo&&evo.tag==='Lv2へ'&&bld&&bld.tag==='建設'&&/^\d+:\d\d$/.test(evo.text)&&/^\d+:\d\d$/.test(bld.text),'[表示] 進化の工事中「Lv2へ」・建設中「建設」もバーと残り時間',evo&&evo.text,bld&&bld.text);
  ok(ch.some(c=>c.k==='mill'&&c.kind==='lv'&&c.text==='Lv3')&&ch.some(c=>c.k==='kitchen'&&c.kind==='lv'&&c.text==='Lv2'),'[表示] 進化した施設に「Lv2」「Lv3」の札');
  const vp=await H(pg,'viewport');ok([job,evo].filter(Boolean).every(c=>c.y>=vp.top&&c.y+c.h<=vp.bottom),'[表示] 町の帯の中に見えている（タップ不要）');
  await pg.evaluate(()=>{const C=window.__clockseed,c=C.facPos('mill');C.lookAt(c.x+10,c.y-10,1.25);});await pg.waitForTimeout(300);
  await pg.screenshot({path:O+'64_progress_chips.png'});
  // 完成：キッチンの加工が終わる → 跳ねる＋光る、効果音、ログ
  await pg.mouse.click(5,(await H(pg,'viewport')).top+5);await pg.waitForFunction(()=>window.__clockseed.log().some(e=>/^キッチンで/.test(e.text)),null,{timeout:8000});const f=await H(pg,'facInfo','kitchen');
  await pg.evaluate(()=>{const C=window.__clockseed,c=C.facPos('kitchen');C.lookAt(c.x,c.y-20,1.5);});await pg.waitForTimeout(250);await pg.screenshot({path:O+'65_done_glow.png'});
  const L=await H(pg,'log'),snd=await sounds(pg);
  ok(f.pop&&snd.includes('done')&&L.some(e=>/^キッチンで.+ができた$/.test(e.text)&&!e.away),'[完成] 加工が終わった瞬間：建物が跳ねて光る演出・効果音（done）・ログ',L.map(e=>e.text).join('／'));
  await pg.context().close();
  // 建設・進化の完成も同じ演出と効果音
  const T2=T0();const s2=base({buildings:Object.assign(Object.fromEntries(BKEYS.map(k=>[k,null])),{mill:built({up:{lv:2,startedAt:T2-170000,readyAt:T2+2000}}),kitchen:{startedAt:T2-290000,builtAt:T2+2500,job:null,lv:1}})});
  pg=await boot(s2);await pg.mouse.click(5,(await H(pg,'viewport')).top+5);await pg.waitForTimeout(3300);const L2=(await H(pg,'log')).map(e=>e.text),sn2=await sounds(pg);
  ok(L2.includes('製粉所がLv2に進化した')&&L2.includes('キッチンが完成した')&&sn2.filter(x=>x==='build').length>=2&&(await H(pg,'facInfo','mill')).lv===2,'[完成] 進化・建設の完成も演出と効果音（build）とログ',L2.join('／'));
  await pg.context().close();}

// ===== 5. 区画の名前（位置と合っているか） =====
{pg=await boot(base());const names=await H(pg,'plotNames'),cen=[];for(let i=0;i<names.length;i++)cen.push(await H(pg,'plotRectW',i));
  const main=names.map((n,i)=>[n,cen[i]]).filter(([n])=>!n.startsWith('川')),riv=names.map((n,i)=>[n,cen[i]]).filter(([n])=>n.startsWith('川'));
  const colOk=main.every(([n,r])=>main.every(([m,q])=>(n[0]===m[0])===(r.x===q.x)&&(n[0]<m[0])===(r.x<q.x)));
  const rowOk=main.every(([n,r])=>main.every(([m,q])=>(n.slice(1)===m.slice(1))===(r.y===q.y)&&(+n.slice(1)<+m.slice(1))===(r.y<q.y)));
  const rivOk=riv.every(([n,r])=>riv.every(([m,q])=>(+n.slice(1)<+m.slice(1))===(r.x<q.x)))&&riv.length===8&&riv.every(([,r])=>r.y===riv[0][1].y);
  ok(colOk&&rowOk&&rivOk&&new Set(names).size===24,'[区画名] 本畑：列 A〜D（西→東）・行 1〜4（北→南）、川沿い：川1〜川8（西→東）。24区画すべて別名',names.join(' '));
  await pg.context().close();}

// ===== 6. ログ：書式・流れる1行・履歴・30件・留守中のまとめ =====
{const T=T0();const s=base({townExp:LV[5]-5,storage:Object.assign(clone(FRESH.storage),{wheat:0,flour:0}),buildings:Object.assign(Object.fromEntries(BKEYS.map(k=>[k,null])),{mill:built({job:{recipe:'flour',startedAt:T-118000,readyAt:T+2000}}),ranch:{startedAt:T-890000,builtAt:T+2500,job:null,lv:1}})});
  s.plots=Array(24).fill(null);s.plots[0]={crop:'wheat',plantedAt:T-100000,readyAt:T+1500};s.plots[4]={crop:'carrot',plantedAt:T-100000,readyAt:T+1500};s.plots[14]={crop:'potato',plantedAt:T-100000,readyAt:T+1500};
  s.orders[0]={crop:'wheat',qty:3};
  pg=await boot(s);await pg.mouse.click(5,(await H(pg,'viewport')).top+5);await pg.waitForTimeout(3200);
  let L=(await H(pg,'log')).map(e=>e.text);
  for(const t of ['A1の畑で小麦ができた','B2の畑でにんじんができた','川3の畑でじゃがいもができた','製粉所で小麦粉ができた','牧場が完成した'])ok(L.includes(t),'[ログ] 「'+t+'」');
  ok((await H(pg,'logLine'))===L[L.length-1],'[ログ] 上の帯の1行に最新の出来事',await H(pg,'logLine'));
  // 収穫 → 注文が納品できる → 納品 → 町のレベルアップ
  const p0=await H(pg,'plotCenter',0);await pg.mouse.click(p0.x,p0.y);await pg.waitForTimeout(300);L=(await H(pg,'log')).map(e=>e.text);
  ok(L.includes('注文の小麦×3が納品できる'),'[ログ] 収穫して「注文の小麦×3が納品できる」');
  const bc=await H(pg,'boardCenter');await pg.mouse.click(bc.x,bc.y);await pg.waitForTimeout(250);await pg.locator('#orderList .orow',{hasText:'小麦'}).first().locator('.tool',{hasText:'納品'}).click();await pg.waitForTimeout(300);await pg.locator('#ordersClose').click();
  L=(await H(pg,'log')).map(e=>e.text);ok(L.includes('町がLv6になった'),'[ログ] 「町がLv6になった」',L.slice(-2).join('／'));
  await pg.screenshot({path:O+'66_log_line.png',clip:{x:0,y:0,width:1180,height:200}});
  await pg.locator('#logLine').click();await pg.waitForTimeout(200);const rows=await pg.locator('#logList .logrow').count();
  ok(await pg.isVisible('#logPanel')&&rows===L.length&&(await pg.locator('#logList .logrow').first().innerText()).includes(L[L.length-1]),'[履歴] タップで履歴（新しい順・'+rows+'件）');
  await pg.screenshot({path:O+'67_log_history.png'});await pg.context().close();}
// 留守中：前回開いていた時刻より後に終わったものだけ、起動時にまとめて。30件で止まる
{const T=T0(),seen=T-3600000;const s=base({seenAt:seen,buildings:Object.fromEntries(BKEYS.map((k,i)=>[k,{startedAt:T-9e6,builtAt:T-3000000+i*1000,job:{recipe:Object.keys(REC).find(r=>REC[r].building===k),startedAt:T-2000000,readyAt:T-1000000+i*1000},lv:1,up:null}]))});
  for(const k of BKEYS)delete s.buildings[k].up;
  s.plots=Array(24).fill(null);for(let i=0;i<24;i++)s.plots[i]={crop:'wheat',plantedAt:T-9e6,readyAt:(i<20?T-600000+i*1000:seen-60000)};   // 区画20〜23は留守の前に完成（知らせない）
  pg=await boot(s);await pg.waitForTimeout(300);const L=await H(pg,'log');const toast=await pg.innerText('#toast').catch(()=>'');
  const expN=20+8+8;
  ok(L.length===30&&L.every(e=>e.away),'[留守中] 起動時にまとめて出す（'+expN+'件のうち、履歴は直近30件で止まる）',L.length);
  ok(L[0].at<=L[L.length-1].at&&L.every((e,i)=>!i||L[i-1].at<=e.at)&&!L.some(e=>/^(川\d|[A-D]\d)の畑/.test(e.text)&&e.at<seen),'[留守中] 古い順に並び、留守の前に終わっていたものは出さない');
  ok(/留守のあいだに 36件/.test(toast),'[留守中] お知らせ「留守のあいだに36件…」',toast);
  ok(L.some(e=>e.text==='製粉所で小麦粉ができた')&&L.some(e=>e.text==='ケーキ屋が完成した'),'[留守中] 加工・建設のお知らせも含む');
  await pg.locator('#logLine').click();await pg.waitForTimeout(150);ok(await pg.locator('#logList .logrow').count()===30&&await pg.locator('#logList .lw').count()===30,'[履歴] 30件・「留守中」の印');
  await pg.context().close();
  // 留守中に何も終わっていなければ、何も出さない（前回の続き）
  const s2=base({seenAt:T0()-1000});s2.plots[0]={crop:'wheat',plantedAt:T0()-9e6,readyAt:T0()-60000};pg=await boot(s2);ok((await H(pg,'log')).length===0,'[留守中] 前回開いていたときにもうできていたものは出さない');await pg.context().close();}

// ===== 7. ズーム：最小で町全体が帯に収まる・＋／−で段階的に =====
for(const [w,h,name] of [[1180,820,'タブレット横'],[768,1024,'iPad 縦'],[1280,720,'ノートPC']]){
  pg=await boot(base(),{width:w,height:h},name==='タブレット横'?2:1);const z=[];
  for(let k=0;k<12&&!await pg.locator('#zoomOut').isDisabled();k++){await pg.locator('#zoomOut').click();await pg.waitForTimeout(60);z.push((await H(pg,'zoomInfo')).zoom);}
  const zi=await H(pg,'zoomInfo'),vp=await H(pg,'viewport'),bd=(await H(pg,'mapInfo')).bounds,a=await H(pg,'worldToScreen',bd.x0,bd.y0),c=await H(pg,'worldToScreen',bd.x1,bd.y1);
  const inside=a.x>=-0.5&&a.y>=vp.top-0.5&&c.x<=w+0.5&&c.y<=vp.bottom+0.5,touch=Math.abs(a.x)<1&&Math.abs(c.x-w)<1||Math.abs(a.y-vp.top)<1&&Math.abs(c.y-vp.bottom)<1;
  ok(Math.abs(zi.zoom-zi.min)<1e-9&&inside&&touch,'[ズーム] '+name+'：−で最小まで → 町全体（町Lv8）が中央の帯に収まる（倍率 '+zi.zoom.toFixed(3)+'）',JSON.stringify({a,c,top:vp.top,bottom:vp.bottom}));
  if(name==='タブレット横')await pg.screenshot({path:O+'68_zoom_min_whole_town.png'});
  const zs=[zi.zoom];for(let k=0;k<12&&!await pg.locator('#zoomIn').isDisabled();k++){await pg.locator('#zoomIn').click();await pg.waitForTimeout(60);zs.push((await H(pg,'zoomInfo')).zoom);}
  const ratios=zs.slice(1).map((x,i)=>x/zs[i]);
  ok(ratios.slice(0,-1).every(r=>Math.abs(r-1.25)<1e-6)&&Math.abs(zs[zs.length-1]-zi.max)<1e-9&&await pg.locator('#zoomIn').isDisabled(),'[ズーム] ＋は1回で1.25倍ずつ（'+zs.length+'段階）、最大で止まる',zs.map(x=>x.toFixed(2)).join('→'));
  const bt=await pg.evaluate(()=>[...document.querySelectorAll('#zoomBtns button')].map(e=>{const r=e.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height};}));
  ok(bt.every(r=>r.w<=40&&r.h<=40&&r.x+r.w<=w-8&&r.x>w-60&&r.y>=vp.top&&r.y+r.h<=vp.bottom-8),'[ズーム] ボタンは町の帯の右下（40px以下）',JSON.stringify(bt));
  if(name==='タブレット横'){
    await pg.context().close();pg=await boot(base(),{width:w,height:h});const n=(await H(pg,'mapInfo')).plots;let hit=0;
    for(let i=0;i<n;i++){const p=await H(pg,'plotCenter',i);if(p.y>vp.top&&p.y<vp.bottom&&p.x>0&&p.x<w){const id=await pg.evaluate(([x,y])=>document.elementFromPoint(x,y).id,[p.x,p.y]);if(id!=='world')hit++;}}
    ok(hit===0,'[ズーム] はじめの表示で、見えている区画の中心にボタンが重ならない');
    const z0=(await H(pg,'zoomInfo')).zoom;await pg.mouse.move(w/2,(vp.top+vp.bottom)/2);await pg.mouse.wheel(0,300);await pg.waitForTimeout(100);ok((await H(pg,'zoomInfo')).zoom<z0,'[ズーム] ホイールは従来どおり');}
  await pg.context().close();}

// ===== 8. 進化の見た目 Lv1→Lv3（スクリーンショット） =====
for(const L of [1,2,3]){pg=await boot(base({buildings:Object.assign(Object.fromEntries(BKEYS.map(k=>[k,null])),{mill:built({lv:L}),kitchen:built({lv:L}),bakery:built({lv:L}),jam:built({lv:L})})}),{width:900,height:620},2);
  await pg.evaluate(()=>{const C=window.__clockseed,a=C.facPos('kitchen');C.lookAt(a.x+20,a.y-26,1.5);});await pg.waitForTimeout(250);await pg.screenshot({path:O+'6'+(L-1)+'_evo_lv'+L+'.png'});
  ok((await H(pg,'facInfo','mill')).lv===L,'[見た目] 進化Lv'+L+' の製粉所・キッチン（screenshots/6'+(L-1)+'_evo_lv'+L+'.png）');await pg.context().close();}

ok(errs.length===0,'[JS エラー] 0件',errs.slice(0,3));
log(fail?'=> 不合格 '+fail+'件':'=> 全て合格');
await b.close();process.exit(fail?1:0);
})();
