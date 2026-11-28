const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1180,height:820},deviceScaleFactor:2});
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
const T=new Date('2026-11-27T10:00:00').getTime();
await pg.clock.setFixedTime(T);
const url='file:///home/user/clockseed/index.html?debug=1&intro=0';const O='/home/user/clockseed/screenshots/';
const log=(...a)=>console.log(...a);
const st=()=>pg.evaluate(()=>JSON.parse(localStorage.getItem('clockseed.save')));
const put=s=>pg.evaluate(s=>localStorage.setItem('clockseed.save',JSON.stringify(s)),s);
const load=async(s,q='')=>{await pg.goto(url+q);await put(s);await pg.reload();await pg.waitForTimeout(450);};
const ITEMS=['wheat','carrot','potato','tomato','corn','strawberry','pumpkin','grape','flour','juice','fries','tsauce','bread','jambread','milk','cheese','butter','sjam','gjam','pizza','ppie','gcake'];
const SD=Array.from({length:16},(_,i)=>'sd'+String(i+1).padStart(2,'0'));
const BKEYS=['mill','kitchen','bakery','ranch','dairy','jam','restaurant','cake'];
const storage=(o={})=>Object.assign(Object.fromEntries(ITEMS.map(k=>[k,0])),o);
const built=()=>({startedAt:T-2e6,builtAt:T-1e6,job:null});
const blds=(keys,o={})=>Object.assign(Object.fromEntries(BKEYS.map(k=>[k,keys.includes(k)?built():null])),o);
const drill=o=>Object.assign({stock:0,shards:0,shardHalf:0,tickets:0,streak:0,stats:{},day:'2026-11-27',dayCount:3},o);
const gacha=(items={})=>({pity:{r:0,sr:0,ur:0},total:10,firstUsed:true,items,dex:Object.fromEntries(Object.keys(items).map(k=>[k,1]))});
const base=(o={})=>Object.assign({saveVersion:8,plots:Array(24).fill(null),storage:storage(),gold:0,townExp:2800,orders:[{crop:'flour',qty:6},{crop:'flour',qty:6},{crop:'flour',qty:6}],buildings:blds([]),drill:drill({}),gacha:gacha({})},o);
const P=(c,start,dur,v)=>Object.assign({crop:c,plantedAt:start,readyAt:start+dur},v?{v}:{});
const norm=x=>Array.isArray(x)?x.map(norm):(x&&typeof x==='object')?Object.fromEntries(Object.keys(x).sort().map(k=>[k,norm(x[k])])):x;
const same=(a,b)=>JSON.stringify(norm(a))===JSON.stringify(norm(b));
const tapPlot=async i=>{const c=await pg.evaluate(i=>window.__clockseed.plotCenter(i),i);await pg.mouse.click(c.x,c.y);await pg.waitForTimeout(120);};
const openBoard=async()=>{const c=await pg.evaluate(()=>window.__clockseed.boardCenter());await pg.mouse.click(c.x,c.y);await pg.waitForTimeout(150);};
const tapFac=async k=>{await pg.evaluate(k=>{const p=window.__clockseed.facPos(k);window.__clockseed.lookAt(p.x,p.y-20,1.2);},k);await pg.waitForTimeout(100);const c=await pg.evaluate(k=>window.__clockseed.facCenter(k),k);await pg.mouse.click(c.x,c.y);await pg.waitForTimeout(200);};
const wh=async()=>{await pg.locator('#warehouse').click();await pg.waitForTimeout(150);const r=await pg.$$eval('.wrow',x=>x.map(e=>e.innerText.replace(/\s+/g,' ')));await pg.locator('#warehouseClose').click();return r;};
const whRow=(rows,name)=>rows.find(r=>r.startsWith(name+' ')||r.startsWith(name+'変種'));
const toastTxt=()=>pg.evaluate(()=>{const e=document.getElementById('toast');return e.style.display==='block'?e.textContent:'';});
const openSkip=async()=>{const c=await pg.evaluate(()=>window.__clockseed.towerCenter());await pg.mouse.click(c.x,c.y);await pg.waitForTimeout(150);await pg.locator('.dacts button',{hasText:'時短を使う'}).click();await pg.waitForTimeout(200);};
const dexUse=async(id)=>{await pg.locator('#dexHud').click();await pg.waitForTimeout(150);await pg.locator('.dextabs button',{hasText:'消耗品'}).click();await pg.locator('.dexcard[data-id="'+id+'"] button').click();await pg.waitForTimeout(100);const t=await toastTxt();await pg.locator('#dexClose').click();return t;};

// ===== 1. version 7 → 8 の移行 =====
const v7={saveVersion:7,plots:[P('wheat',T-200000,120000),null,Object.assign(P('carrot',T-10000,240000),{skipMs:30000}),null,null,null,P('grape',T-1000,2700000)].concat(Array(17).fill(null)),
 storage:storage({wheat:5,carrot:7,flour:3,tsauce:2,gcake:1,milk:4}),gold:4321,townExp:1900,orders:[{crop:'tsauce',qty:4},{crop:'flour',qty:2},{crop:'grape',qty:3}],
 buildings:blds(['mill','kitchen','bakery','ranch'],{mill:{startedAt:T-4e5,builtAt:T-2.2e5,job:{recipe:'flour',startedAt:T-5e4,readyAt:T+7e4,skipMs:1e4}},dairy:{startedAt:T-1000,builtAt:T+5e5,buildSkipMs:2000,job:null}}),
 drill:drill({stock:5000,shards:137,shardHalf:1,tickets:2,streak:6,stats:{A1:{ok:3,n:4}},dayCount:44}),
 gacha:{pity:{r:3,sr:7,ur:12},total:20,firstUsed:true,items:{sd01:1,dc01:2,cs02:1,cs01:4,hp02:1},dex:{sd01:1,dc01:1,cs02:1,cs01:1,hp02:1}}};
await pg.goto(url);await put(v7);await pg.reload();await pg.waitForTimeout(400);
let s=await st();
log('[migrate v7] version',s.saveVersion,'plots',same(s.plots,v7.plots),'gold',s.gold,'exp',s.townExp,'orders',same(s.orders,v7.orders),'drill',same(s.drill,v7.drill),
  'buildings',same(s.buildings,v7.buildings),'storage kept',ITEMS.every(k=>s.storage[k]===v7.storage[k]),'gacha',same(s.gacha.pity,v7.gacha.pity)&&s.gacha.total===20&&s.gacha.items.cs01===4&&s.gacha.items.hp02===1,
  'backup',await pg.evaluate(()=>!!localStorage.getItem('clockseed.save.v7.backup')));
log('[migrate v7] new: variant storage',SD.map(x=>'v_'+x).every(k=>s.storage[k]===0),'(16 keys:',SD.filter(x=>('v_'+x) in s.storage).length+')','buffs',JSON.stringify(s.buffs),'helpers',JSON.stringify(s.helpers),
  'orderIds',s.orderIds.length,'nextOrder',!!s.nextOrder);

// ===== 2. 変種の植え付け（ポップアップ／パレット）・収穫・価格 =====
const allSeeds=Object.fromEntries(SD.map(x=>[x,1]));
await load(base({gacha:gacha({sd01:1,sd10:1,sd14:1,sd05:1})}));
await tapPlot(0);
log('[popup] variant row',await pg.isVisible('#popupVarWrap'),JSON.stringify(await pg.$$eval('#popupVar .vbtn',x=>x.map(e=>e.innerText.replace(/\s+/g,' ')))));
await pg.screenshot({path:O+'07_variant_popup.png'});
await pg.locator('#popupVar .vbtn[data-v="sd01"]').click();await pg.waitForTimeout(100);
s=await st();log('[plant variant via popup] plot0',JSON.stringify({crop:s.plots[0].crop,v:s.plots[0].v,dur:s.plots[0].readyAt-s.plots[0].plantedAt}),'(wheat 120000, v sd01)');
log('[palette] after popup: variantBar visible',await pg.isVisible('#variantBar'),'selected',await pg.$$eval('#variantBar .vbtn.sel',x=>x.map(e=>e.dataset.v)));
// パレットで通常 → 区画1、変種（ほしぞらいちご）→ 区画2
await pg.locator('#variantBar .vbtn[data-v=""]').click();await tapPlot(1);
await pg.locator('#palette .tool',{hasText:'いちご'}).click();await pg.waitForTimeout(80);
log('[palette strawberry] bar',JSON.stringify(await pg.$$eval('#variantBar .vbtn',x=>x.map(e=>e.innerText.replace(/\s+/g,' ')))));
await pg.locator('#variantBar .vbtn[data-v="sd10"]').click();await tapPlot(2);
s=await st();log('[plant via palette] plot1',JSON.stringify(s.plots[1]&&{c:s.plots[1].crop,v:s.plots[1].v||null}),'plot2',JSON.stringify(s.plots[2]&&{c:s.plots[2].crop,v:s.plots[2].v,dur:s.plots[2].readyAt-s.plots[2].plantedAt}),'(strawberry 900000)');
// 未解放の変種は植えられない（関数側の検証：sd06 を持っていない）
// 収穫：育ちきった変種
await load(base({gacha:gacha({sd01:1,sd10:1,sd14:1}),plots:[P('wheat',T-200000,120000,'sd01'),P('strawberry',T-2e6,900000,'sd10'),P('pumpkin',T-3e6,1800000,'sd14'),P('wheat',T-200000,120000)].concat(Array(20).fill(null))}));
for(const i of [0,1,2,3]) await tapPlot(i);
s=await st();log('[harvest] v_sd01',s.storage.v_sd01,'(3) v_sd10',s.storage.v_sd10,'(2) v_sd14',s.storage.v_sd14,'(1) wheat',s.storage.wheat,'(3) plots empty',s.plots.slice(0,4).every(x=>!x));
let rows=await wh();
log('[prices] まる小麦',whRow(rows,'まる小麦'),'| きんかぼちゃ',whRow(rows,'きんかぼちゃ'),'| ほしぞらいちご',whRow(rows,'ほしぞらいちご'));
const g0=(await st()).gold;await pg.locator('#warehouse').click();await pg.locator('.wrow',{hasText:'まる小麦'}).locator('button',{hasText:'1個売る'}).click();
await pg.locator('.wrow',{hasText:'きんかぼちゃ'}).locator('button',{hasText:'1個売る'}).click();
await pg.locator('.wrow',{hasText:'ほしぞらいちご'}).locator('button',{hasText:'1個売る'}).click();await pg.locator('#warehouseClose').click();
log('[sell] gold +',(await st()).gold-g0,'(11+143+64=218)');
// 育った変種の畑（スクリーンショット）
await load(base({gacha:gacha(allSeeds),plots:SD.map((sd,i)=>{const c={sd01:'wheat',sd02:'carrot',sd03:'potato',sd04:'tomato',sd05:'corn',sd06:'strawberry',sd07:'pumpkin',sd08:'grape',sd09:'wheat',sd10:'strawberry',sd11:'carrot',sd12:'potato',sd13:'corn',sd14:'pumpkin',sd15:'tomato',sd16:'grape'}[sd];return P(c,T-9e6,1000,sd);}).concat([P('wheat',T-9e6,1000),P('strawberry',T-9e6,1000),P('pumpkin',T-9e6,1000),P('grape',T-9e6,1000),P('tomato',T-9e6,1000),P('corn',T-9e6,1000),P('carrot',T-9e6,1000),P('potato',T-9e6,1000)])}));
await pg.evaluate(()=>{const a=window.__clockseed.plotRectW(0),z=window.__clockseed.plotRectW(23);const xs=[...Array(24).keys()].map(i=>window.__clockseed.plotRectW(i));
  const x0=Math.min(...xs.map(r=>r.x)),x1=Math.max(...xs.map(r=>r.x+r.w)),y0=Math.min(...xs.map(r=>r.y)),y1=Math.max(...xs.map(r=>r.y+r.h));window.__clockseed.lookAt((x0+x1)/2,(y0+y1)/2-6,1.2);});
await pg.waitForTimeout(250);await pg.screenshot({path:O+'08_variant_field.png'});
// 注文に変種が出る（解放済みのみ・個数1〜4）・経験値
await load(base({townExp:2800,gacha:gacha({sd01:1,sd10:1}),buildings:blds([])}));
const oc={};const qty={};for(let k=0;k<150;k++){await pg.evaluate(()=>{});}
const dist=await pg.evaluate(()=>{const out={};for(let k=0;k<3000;k++){localStorage.removeItem('x');}return out;});
s=await st();
// 注文の分布は、注文を何度も引き直して確認（リロール券を大量に持たせる）
await load(base({townExp:2800,gacha:gacha({sd01:1,sd10:1,cs03:400}),buildings:blds([])}));
await openBoard();
for(let k=0;k<400;k++){const o=(await st()).orders[k%3];oc[o.crop]=(oc[o.crop]||0)+1;(qty[o.crop]=qty[o.crop]||new Set()).add(o.qty);await pg.locator('.orow:not(.peddler)').nth(k%3).locator('.rrbtn').click();}
log('[variant orders] kinds seen',JSON.stringify(Object.keys(oc).sort()),'v_sd01 qty',JSON.stringify([...(qty.v_sd01||[])].sort()),'v_sd10 qty',JSON.stringify([...(qty.v_sd10||[])].sort()),'other variants',Object.keys(oc).filter(k=>k.startsWith('v_')&&!['v_sd01','v_sd10'].includes(k)).length);
await pg.locator('#ordersClose').click();
for(const [crop,q,exp0,exp1] of [['v_sd01',2,10,10],['v_sd10',3,12,15]]){
  await load(base({townExp:2000,storage:storage({}),gacha:gacha({sd01:1,sd10:1}),orders:[{crop,qty:q},{crop:'wheat',qty:3},{crop:'wheat',qty:3}]}));
  await pg.evaluate(([c,q])=>{const s=JSON.parse(localStorage.getItem('clockseed.save'));s.storage[c]=q;localStorage.setItem('clockseed.save',JSON.stringify(s));},[crop,q]);await pg.reload();await pg.waitForTimeout(300);
  await openBoard();const txt=(await pg.locator('.orow').first().innerText()).replace(/\s+/g,' ');const a=await st();await pg.locator('.orow').first().locator('.tool',{hasText:'納品'}).click();const z=await st();
  log('[variant order '+crop+'] row:',txt,'| gold +',z.gold-a.gold,'exp +',z.townExp-a.townExp,'(expect exp',exp1+')');await pg.locator('#ordersClose').click();
}
// 材料の代用（通常を優先して消費。製品は通常品）
await load(base({storage:storage({wheat:1}),gacha:gacha({sd01:1,sd09:1}),buildings:blds(['mill'])}));
await pg.evaluate(()=>{const s=JSON.parse(localStorage.getItem('clockseed.save'));s.storage.v_sd01=2;s.storage.v_sd09=2;localStorage.setItem('clockseed.save',JSON.stringify(s));});await pg.reload();await pg.waitForTimeout(300);
await tapFac('mill');log('[substitute] mill row:',(await pg.locator('.mrow',{hasText:'小麦粉'}).first().innerText()).replace(/\s+/g,' '));
await pg.locator('.mrow',{hasText:'小麦粉'}).first().locator('button').click();s=await st();
log('[substitute] after 1st flour: wheat',s.storage.wheat,'(0) v_sd01',s.storage.v_sd01,'(1) v_sd09',s.storage.v_sd09,'(2) job',s.buildings.mill.job.recipe);
await pg.evaluate(()=>{const s=JSON.parse(localStorage.getItem('clockseed.save'));s.buildings.mill.job.readyAt=s.buildings.mill.job.startedAt=Date.now()-1;localStorage.setItem('clockseed.save',JSON.stringify(s));});await pg.reload();await pg.waitForTimeout(300);
await tapFac('mill');await pg.locator('#facBody .mact button',{hasText:'受け取る'}).click();await pg.locator('.mrow',{hasText:'小麦粉'}).first().locator('button').click();s=await st();
log('[substitute] 2nd flour: v_sd01',s.storage.v_sd01,'(0) v_sd09',s.storage.v_sd09,'(1) flour',s.storage.flour,'(1 normal product)');
await pg.keyboard.press('Escape');

// ===== 3. 価格修飾と上限 =====
const pr=async(items,keys)=>{await load(base({gacha:gacha(items),storage:storage(Object.fromEntries(keys.filter(k=>!k.startsWith('v_')).map(k=>[k,1])))}));
  await pg.evaluate(keys=>{const s=JSON.parse(localStorage.getItem('clockseed.save'));for(const k of keys)s.storage[k]=1;localStorage.setItem('clockseed.save',JSON.stringify(s));},keys);await pg.reload();await pg.waitForTimeout(250);
  const r=await wh();return keys.map(k=>r.find(x=>x.includes({tsauce:'トマトソース',fries:'ポテトフライ',sjam:'いちごジャム',gjam:'ぶどうジャム',bread:'パン ',jambread:'ジャムパン',v_sd10:'ほしぞらいちご',v_sd14:'きんかぼちゃ',v_sd01:'まる小麦',wheat:'小麦 '}[k]))).map(x=>x&&x.match(/単価 (\d+)G(（\+\d+%）)?/)[0]);};
log('[mod none] トマトソース',(await pr({},['tsauce']))[0],'(130G)');
log('[mod ゆきトマト] トマトソース',(await pr({sd15:1},['tsauce']))[0],'(150G)');
log('[mod あおトマト] トマトソース',(await pr({sd04:1},['tsauce']))[0],'(143G)');
log('[mod 両方] トマトソース',(await pr({sd04:1,sd15:1},['tsauce']))[0],'(150G: 25%→上限15%)');
log('[mod むらさきじゃが] ポテトフライ',(await pr({sd12:1},['fries']))[0],'(95→105G: 104.5)');
log('[mod しろいちご/あめぶどう] ',JSON.stringify(await pr({sd06:1,sd08:1},['sjam','gjam'])),'(いちごジャム/ぶどうジャム ×1.15)');
log('[mod にじ小麦] パン/ジャムパン',JSON.stringify(await pr({sd09:1},['bread','jambread'])));
log('[mod 伝説の庭師] まる小麦/ほしぞら/きんかぼちゃ/通常小麦',JSON.stringify(await pr({hp09:1,sd01:1,sd10:1,sd14:1},['v_sd01','v_sd10','v_sd14','wheat'])),'(ceil 10*1.10=11, 55*1.20=66, 130*1.15=150, 10)');
// 注文報酬にも効く
await load(base({gacha:gacha({sd15:1}),storage:storage({tsauce:4}),orders:[{crop:'tsauce',qty:4},{crop:'flour',qty:6},{crop:'flour',qty:6}],buildings:blds(['kitchen'])}));
await openBoard();let a=await st();log('[mod order] row',(await pg.locator('.orow').first().innerText()).replace(/\s+/g,' '));await pg.locator('.orow').first().locator('.tool',{hasText:'納品'}).click();
log('[mod order] gold +',(await st()).gold-a.gold,'(ceil(150*4*1.3)=780; 無しなら676)');await pg.locator('#ordersClose').click();

// ===== 4. お手伝い =====
// 配達ねこ：リロード時と表示中
await load(base({gacha:gacha({hp02:1}),buildings:blds(['mill','kitchen'],{mill:{startedAt:T-2e6,builtAt:T-1e6,job:{recipe:'flour',startedAt:T-2e5,readyAt:T-1000}}})}));
s=await st();log('[cat on reload] flour',s.storage.flour,'(1) mill job',s.buildings.mill.job,'toast:',await toastTxt());
await load(base({gacha:gacha({hp02:1}),buildings:blds(['mill'],{mill:{startedAt:T-2e6,builtAt:T-1e6,job:{recipe:'flour',startedAt:T-1000,readyAt:T+5000}}})}));
s=await st();log('[cat open] before: flour',s.storage.flour,'job running',!!s.buildings.mill.job);
await pg.clock.setFixedTime(T+7000);await pg.waitForTimeout(700);s=await st();log('[cat open] after 7s: flour',s.storage.flour,'(1) job',s.buildings.mill.job,'toast:',await toastTxt());
await pg.clock.setFixedTime(T);
await load(base({gacha:gacha({}),buildings:blds(['mill'],{mill:{startedAt:T-2e6,builtAt:T-1e6,job:{recipe:'flour',startedAt:T-2e5,readyAt:T-1000}}})}));
s=await st();log('[no cat] flour',s.storage.flour,'(0) job kept',!!s.buildings.mill.job);
// 見習いパン職人：ストック1秒＝1.1秒（追い込み区間は2倍消費と併用）
for(const own of [false,true]){
  await load(base({gacha:gacha(own?{hp03:1}:{}),drill:drill({stock:3000}),buildings:blds(['bakery','mill'],{bakery:{startedAt:T-2e6,builtAt:T-1e6,job:{recipe:'bread',startedAt:T,readyAt:T+360000}},mill:{startedAt:T-2e6,builtAt:T-1e6,job:{recipe:'flour',startedAt:T,readyAt:T+120000}}})}));
  await openSkip();
  const lab=async(id,l)=>(await pg.locator('.srow[data-id="'+id+'"] button',{hasText:l}).innerText()).replace(/\s+/g,' ');
  log('[baker '+(own?'あり':'なし')+'] bread −1分:',await lab('job:bakery','−1分'),'| −10分(R=6:00, normal 4:30):',await lab('job:bakery','−10分'),'| mill −1分:',await lab('job:mill','−1分'));
  const a0=(await st()).drill.stock;await pg.locator('.srow[data-id="job:bakery"] button',{hasText:'−1分'}).click();const a1=await st();
  log('   −1分 click: stock used',a0-a1.drill.stock,'s, bread readyAt shift',T+360000-a1.buildings.bakery.job.readyAt,'ms');
  await pg.locator('#skipClose').click();
}
// 追い込み区間：bread R=60s（Dur360,25%=90s）→ 1分短縮は 120秒/1.1=109.09→110秒
await load(base({gacha:gacha({hp03:1}),drill:drill({stock:3000}),buildings:blds(['bakery'],{bakery:{startedAt:T-300000,builtAt:T-1e6,job:{recipe:'bread',startedAt:T-300000,readyAt:T+60000}}})}));
await openSkip();log('[baker rush] −1分 at R=1:00:',(await pg.locator('.srow[data-id="job:bakery"] button',{hasText:'−1分'}).innerText()).replace(/\s+/g,' '),'(ceil(120/1.1)=110 → 1:50)');
let a0=(await st()).drill.stock;await pg.locator('.srow[data-id="job:bakery"] button',{hasText:'−1分'}).click();log('   used',a0-(await st()).drill.stock);await pg.locator('#skipClose').click();
// おばあさん：牧場（牛乳）
await load(base({gacha:gacha({hp05:1}),drill:drill({stock:3000}),buildings:blds(['ranch','bakery'],{ranch:{startedAt:T-2e6,builtAt:T-1e6,job:{recipe:'milk',startedAt:T,readyAt:T+720000}},bakery:{startedAt:T-2e6,builtAt:T-1e6,job:{recipe:'bread',startedAt:T,readyAt:T+360000}}})}));
await openSkip();log('[grandma] milk −10分:',(await pg.locator('.srow[data-id="job:ranch"] button',{hasText:'−10分'}).innerText()).replace(/\s+/g,' '),'(R=12:00 normal 9:00 → 9:00+1:00×2=11:00 /1.1 = 10:00) | bread −10分(職人なし):',(await pg.locator('.srow[data-id="job:bakery"] button',{hasText:'−10分'}).innerText()).replace(/\s+/g,' '));
await pg.locator('#skipClose').click();
// 時の番人：1日1回、日付が変わると復活
await load(base({gacha:gacha({hp11:1}),plots:[P('grape',T,2700000),Object.assign(P('pumpkin',T,1800000),{readyAt:T+3*86400000})].concat(Array(22).fill(null))}));
await openSkip();
const kb=i=>pg.locator('.srow[data-id="plot:'+i+'"] button',{hasText:'時の番人'});
log('[keeper] button',(await kb(0).innerText()).replace(/\s+/g,' '),'enabled',await kb(0).isEnabled());
await kb(0).click();await pg.waitForTimeout(100);s=await st();
log('[keeper] after use: plot0 ready',s.plots[0].readyAt<=T,'keeperDay',s.helpers.keeperDay,'stock/tickets unchanged',s.drill.stock,s.drill.tickets);
log('[keeper] plot1 button',(await kb(1).innerText()).replace(/\s+/g,' '),'disabled',await kb(1).isDisabled());
await pg.locator('#skipClose').click();
await pg.reload();await pg.waitForTimeout(300);await openSkip();log('[keeper] same day after reload disabled',await kb(1).isDisabled());await pg.locator('#skipClose').click();
await pg.clock.setFixedTime(new Date('2026-11-28T09:00:00').getTime());await pg.reload();await pg.waitForTimeout(300);await openSkip();
log('[keeper] next day enabled',await kb(1).isEnabled(),(await kb(1).innerText()).replace(/\s+/g,' '));await kb(1).click();s=await st();log('[keeper] used day2 keeperDay',s.helpers.keeperDay);
await pg.locator('#skipClose').click();await pg.clock.setFixedTime(T);
// 行商人
await load(base({townExp:2800,gacha:gacha({hp06:1}),storage:storage({pumpkin:9,wheat:9,carrot:9,potato:9,tomato:9,corn:9,strawberry:9,grape:9})}));
await pg.evaluate(()=>{let k=0;const seq=[0.1,0.75,0.6];Math.random=()=>seq[Math.min(k++,seq.length-1)];});
await openBoard();s=await st();
const Pd=s.helpers.peddler;log('[peddler] appeared',!!Pd,JSON.stringify(Pd),'peddlerDay',s.helpers.peddlerDay,'row:',(await pg.locator('#peddlerRow').innerText()).replace(/\s+/g,' '),'toast:',await toastTxt());
const PRICE={wheat:10,carrot:16,potato:30,tomato:28,corn:26,strawberry:55,pumpkin:130,grape:100},OEXP={wheat:10,carrot:10,potato:14,tomato:11,corn:11,strawberry:12,pumpkin:14,grape:13};
await pg.screenshot({path:O+'09_peddler_order.png'});
a=await st();await pg.locator('#peddlerRow button',{hasText:'納品'}).click();let z=await st();
log('[peddler deliver] gold +',z.gold-a.gold,'(expect',Math.ceil(PRICE[Pd.crop]*1.5*Pd.qty)+') exp +',z.townExp-a.townExp,'(expect',OEXP[Pd.crop]*2+') stock -',a.storage[Pd.crop]-z.storage[Pd.crop],'peddler',z.helpers.peddler);
await pg.locator('#ordersClose').click();await pg.evaluate(()=>{Math.random=()=>0.01;});await openBoard();
log('[peddler] reopen same day: rolled again?',!!(await st()).helpers.peddler,'(false)');await pg.locator('#ordersClose').click();
// 40% の判定：外れ（0.5）なら出ない
await load(base({townExp:2800,gacha:gacha({hp06:1})}));await pg.evaluate(()=>{Math.random=()=>0.5;});await openBoard();s=await st();log('[peddler miss r=0.5] peddler',s.helpers.peddler,'day',s.helpers.peddlerDay,'row',await pg.isVisible('#peddlerRow'));await pg.locator('#ordersClose').click();
// 翌日へ持ち越さない
await load(base({townExp:2800,gacha:gacha({hp06:1}),helpers:{keeperDay:'',peddlerDay:'2026-11-26',peddler:{crop:'grape',qty:4,day:'2026-11-26',id:'old'},crowSeen:[]}}));
await pg.evaluate(()=>{Math.random=()=>0.9;});await openBoard();log('[peddler] yesterday order shown',await pg.isVisible('#peddlerRow'),'(false)');await pg.locator('#ordersClose').click();
// 確率の確認（関数を直接は呼べないので、日付を変えながら100日分）
let hit=0;for(let d=0;d<300;d++){await pg.clock.setFixedTime(T+d*86400000);await load(base({townExp:2800,gacha:gacha({hp06:1})}));await openBoard();if((await st()).helpers.peddler)hit++;await pg.locator('#ordersClose').click();}
log('[peddler rate] 300 days →',hit,'(~120 = 40%)');await pg.clock.setFixedTime(T);
// 郵便カラス
await load(base({gacha:gacha({hp07:1}),storage:storage({wheat:2}),orders:[{crop:'wheat',qty:3},{crop:'flour',qty:6},{crop:'flour',qty:6}]}));
log('[crow] not deliverable yet toast:',JSON.stringify(await toastTxt()));
await pg.evaluate(()=>{const s=JSON.parse(localStorage.getItem('clockseed.save'));s.plots[0]={crop:'wheat',plantedAt:Date.now()-200000,readyAt:Date.now()-1000};localStorage.setItem('clockseed.save',JSON.stringify(s));});await pg.reload();await pg.waitForTimeout(300);
await tapPlot(0);await pg.clock.setFixedTime(T+1500);await pg.waitForTimeout(300);
s=await st();log('[crow] after harvest wheat',s.storage.wheat,'toast:',await toastTxt(),'crowSeen has order0',s.helpers.crowSeen.includes(s.orderIds[0]));
await pg.evaluate(()=>{document.getElementById('toast').style.display='none';});
await pg.clock.setFixedTime(T+3500);await pg.waitForTimeout(300);await pg.reload();await pg.waitForTimeout(400);log('[crow] again after reload (same order) toast:',JSON.stringify(await toastTxt()),'(none)');
// 天気読みじいさん
await load(base({gacha:gacha({hp10:1}),storage:storage({flour:6}),buildings:blds(['mill'])}));
await openBoard();const fc=(await pg.locator('#forecast').innerText()).trim();s=await st();
await pg.locator('.orow').first().locator('.tool',{hasText:'納品'}).click();z=await st();
log('[forecast]',fc,'| predicted',s.nextOrder.crop,'→ new order0',JSON.stringify(z.orders[0]),'match',z.orders[0].crop===s.nextOrder.crop&&z.orders[0].qty===s.nextOrder.qty,'new forecast',(await pg.locator('#forecast').innerText()).trim());
await pg.locator('#ordersClose').click();
// 収穫どき番・かかし・水やり少年（見た目）
await load(base({gacha:gacha({hp01:1,hp04:1,hp08:1}),plots:[P('wheat',T-4e6,120000),P('wheat',T-200000,120000),P('carrot',T,240000)].concat(Array(21).fill(null))}));
await pg.evaluate(()=>{const a=window.__clockseed.plotRectW(0);window.__clockseed.lookAt(a.x+40,a.y+10,1.8);});await pg.waitForTimeout(400);
await pg.screenshot({path:O+'10_helpers_visual.png'});
log('[visual helpers] screenshot 10 (かかし！:plot0 放置66分 / plot1 は2分のみ, 収穫どき番の光, 水やり少年)');

// ===== 5. 消耗品 =====
const cons=(o)=>gacha(Object.assign({cs01:3,cs04:3,cs08:2,cs07:1,cs09:1},o));
await load(base({gacha:cons({}),plots:[0,1,2,3,4].map(()=>P('wheat',T-200000,120000)).concat(Array(19).fill(null))}));
log('[fert use]',await dexUse('cs01'));s=await st();log('   buffs',JSON.stringify(s.buffs),'cs01 left',s.gacha.items.cs01);
await tapPlot(0);s=await st();log('[fert harvest] wheat',s.storage.wheat,'(4) buffs.fert',s.buffs.fert,'toast',await toastTxt());
await tapPlot(1);s=await st();log('[no buff] wheat +',s.storage.wheat-4,'(3)');
await dexUse('cs04');await tapPlot(2);s=await st();log('[fert改] wheat +',s.storage.wheat-7,'(5) fertPlus',s.buffs.fertPlus);
await dexUse('cs08');await tapPlot(3);s=await st();log('[double] wheat +',s.storage.wheat-12,'(6) double',s.buffs.double);
await dexUse('cs08');await dexUse('cs01');await tapPlot(4);s=await st();log('[double+fert] wheat +',s.storage.wheat-18,'((3+1)×2=8) buffs',JSON.stringify(s.buffs));
// なぞり収穫：予約は先頭の区画から
await load(base({gacha:cons({}),plots:[0,1,2].map(()=>P('carrot',T-300000,240000)).concat(Array(21).fill(null))}));
await dexUse('cs04');
const c0=await pg.evaluate(()=>window.__clockseed.plotCenter(0)),c1=await pg.evaluate(()=>window.__clockseed.plotCenter(1)),c2=await pg.evaluate(()=>window.__clockseed.plotCenter(2));
await pg.mouse.move(c0.x,c0.y);await pg.mouse.down();await pg.mouse.move(c1.x,c1.y,{steps:6});await pg.mouse.move(c2.x,c2.y,{steps:6});await pg.mouse.up();
s=await st();log('[drag harvest] plots harvested',s.plots.slice(0,3).every(x=>!x),'carrot',s.storage.carrot,'(3+2 +3 +3 = 11) fertPlus left',s.buffs.fertPlus);
// 注文ブースト
await load(base({gacha:cons({}),storage:storage({flour:12}),buildings:blds(['mill'])}));
await dexUse('cs07');a=await st();await openBoard();log('[boost] note',(await pg.locator('.onote.boost').innerText()).trim());
await pg.locator('.orow:not(.peddler)').first().locator('.tool',{hasText:'納品'}).click();z=await st();
log('[boost] exp +',z.townExp-a.townExp,'(flour 20×1.5=30) boost left',z.buffs.boost);
a=z;await pg.locator('.orow:not(.peddler) .tool',{hasText:'納品'}).first().click();z=await st();log('[boost] next delivery exp +',z.townExp-a.townExp,'(20)');
await pg.locator('#ordersClose').click();
// ブーストの端数（ほしぞらいちご 15 ×1.5=22.5 → 23）
await load(base({gacha:cons({sd10:1}),orders:[{crop:'v_sd10',qty:1},{crop:'flour',qty:6},{crop:'flour',qty:6}]}));
await pg.evaluate(()=>{const s=JSON.parse(localStorage.getItem('clockseed.save'));s.storage.v_sd10=1;localStorage.setItem('clockseed.save',JSON.stringify(s));});await pg.reload();await pg.waitForTimeout(300);
await dexUse('cs07');a=await st();await openBoard();await pg.locator('.orow:not(.peddler)').first().locator('.tool',{hasText:'納品'}).click();z=await st();log('[boost ceil] exp +',z.townExp-a.townExp,'(ceil(15×1.5)=23)');await pg.locator('#ordersClose').click();
// 全体時の砂：境界（元の所要時間の25%）を越えない
await load(base({gacha:cons({}),drill:drill({stock:777}),plots:[P('grape',T,2700000),P('pumpkin',T-1500000,1800000),P('wheat',T-100000,120000)].concat(Array(21).fill(null)),
  buildings:blds(['mill','bakery'],{bakery:{startedAt:T-2e6,builtAt:T-1e6,job:{recipe:'bread',startedAt:T-200000,readyAt:T+160000}},dairy:{startedAt:T,builtAt:T+3000000,job:null}})}));
const tb=await pg.evaluate(()=>window.__clockseed.timers());
log('[allsand] toast',await dexUse('cs09'));
const ta=await pg.evaluate(()=>window.__clockseed.timers());
for(const x of tb){const y=ta.find(q=>q.id===x.id);log('   ',x.id,'remaining',x.remaining,'→',y.remaining,'moved',x.remaining-y.remaining,'boundary(25%)',x.dur*0.25,'below boundary?',y.remaining<x.dur*0.25-1);}
s=await st();log('[allsand] stock unchanged',s.drill.stock,'(777) cs09 left',s.gacha.items.cs09);

log('JS errors',errs.length,errs.slice(0,5));
await b.close();})();
