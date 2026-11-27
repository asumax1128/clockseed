const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1180,height:820},deviceScaleFactor:2});
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
const T=new Date('2026-11-27T12:00:00').getTime();await pg.clock.setFixedTime(T);
const url='file:///home/user/clockseed/index.html?debug=1';const O='/home/user/clockseed/screenshots/';
const log=(...a)=>console.log(...a);
const st=()=>pg.evaluate(()=>JSON.parse(localStorage.getItem('clockseed.save')));
const put=s=>pg.evaluate(s=>localStorage.setItem('clockseed.save',JSON.stringify(s)),s);
const load=async s=>{await pg.goto(url);await put(s);await pg.reload();await pg.waitForTimeout(400);};
const ITEMS=['wheat','carrot','potato','tomato','corn','strawberry','pumpkin','grape','flour','juice','fries','tsauce','bread','jambread','milk','cheese','butter','sjam','gjam','pizza','ppie','gcake'];
const BKEYS=['mill','kitchen','bakery','ranch','dairy','jam','restaurant','cake'];
const DC=Array.from({length:14},(_,i)=>'dc'+String(i+1).padStart(2,'0'));
const storage=(o={})=>Object.assign(Object.fromEntries(ITEMS.map(k=>[k,0])),o);
const blds=keys=>Object.fromEntries(BKEYS.map(k=>[k,keys.includes(k)?{startedAt:T-2e6,builtAt:T-1e6,job:null}:null]));
const gacha=(items={})=>({pity:{r:0,sr:0,ur:0},total:10,firstUsed:true,items,dex:Object.fromEntries(Object.keys(items).map(k=>[k,1]))});
const base=(o={})=>Object.assign({saveVersion:9,plots:Array(24).fill(null),storage:storage(),gold:0,townExp:0,orders:[{crop:'wheat',qty:9},{crop:'wheat',qty:9},{crop:'wheat',qty:9}],buildings:blds([]),
  drill:{stock:0,shards:0,shardHalf:0,tickets:0,streak:0,stats:{},day:'2026-11-27',dayCount:3},gacha:gacha({})},o);
const norm=x=>Array.isArray(x)?x.map(norm):(x&&typeof x==='object')?Object.fromEntries(Object.keys(x).sort().map(k=>[k,norm(x[k])])):x;
const same=(a,b)=>JSON.stringify(norm(a))===JSON.stringify(norm(b));
const info=()=>pg.evaluate(()=>window.__clockseed.decorInfo());
const openBoard=async()=>{const c=await pg.evaluate(()=>window.__clockseed.boardCenter());await pg.mouse.click(c.x,c.y);await pg.waitForTimeout(150);};

// ===== 1. version 8 → 9 =====
const v8=base({saveVersion:8,townExp:1900,gold:4321,storage:Object.assign(storage({wheat:5,flour:3}),{v_sd01:4,v_sd10:2}),plots:[{crop:'wheat',plantedAt:T-1000,readyAt:T+119000,v:'sd01'}].concat(Array(23).fill(null)),
  orders:[{crop:'flour',qty:2},{crop:'wheat',qty:4},{crop:'v_sd01',qty:2}],orderIds:['a1','b2','c3'],nextOrder:{crop:'carrot',qty:5},buildings:blds(['mill','kitchen']),
  gacha:gacha({sd01:1,sd10:1,dc01:2,dc05:1,hp06:1,cs01:2}),buffs:{fert:1,fertPlus:0,double:2,boost:1},helpers:{keeperDay:'2026-11-27',peddlerDay:'2026-11-27',peddler:{crop:'grape',qty:4,day:'2026-11-27',id:'pp'},crowSeen:['a1']}});
await load(v8);let s=await st();
const keys=['plots','gold','townExp','orders','orderIds','nextOrder','buildings','drill','buffs','helpers'];
log('[migrate v8] version',s.saveVersion,JSON.stringify(Object.fromEntries(keys.map(k=>[k,same(s[k],v8[k])]))),'storage kept',Object.entries(v8.storage).every(([k,v])=>s.storage[k]===v),'gacha items',same(s.gacha.items.dc01,2)&&s.gacha.items.sd10===1&&s.gacha.items.cs01===2,
  'decor',JSON.stringify(s.decor),'backup',await pg.evaluate(()=>!!localStorage.getItem('clockseed.save.v8.backup')));
const v8t=Object.assign(JSON.parse(JSON.stringify(v8)),{gacha:gacha({dc14:1})});await load(v8t);s=await st();
log('[migrate v8 with 世界樹] treeAt = migration time',s.decor.treeAt===T,'stage',(await info()).treeStage);

// ===== 2. 所持に応じた表示（最大3か所） =====
for(const n of [0,1,2,3,5]){await load(base({gacha:gacha(Object.fromEntries(DC.map(k=>[k,n])))}));const i=await info();log('[shown] 所持',n,'→',JSON.stringify(i.shown));}
// 画面上で増える：ベンチ1→3でそれぞれの位置のピクセルが変わる
const crop=async(x,y)=>{const p=await pg.evaluate(([x,y])=>window.__clockseed.worldToScreen(x,y),[x,y]);return (await pg.screenshot({clip:{x:p.x-14,y:p.y-22,width:28,height:24}})).toString('base64');};
const spots=(await info()).spots.dc01;
await load(base({gacha:gacha({dc01:1})}));await pg.evaluate(()=>window.__clockseed.lookAt(80,100,1.2));await pg.waitForTimeout(200);const a1=[];for(const [x,y] of spots)a1.push(await crop(x,y));
await load(base({gacha:gacha({dc01:3})}));await pg.evaluate(()=>window.__clockseed.lookAt(80,100,1.2));await pg.waitForTimeout(200);const a3=[];for(const [x,y] of spots)a3.push(await crop(x,y));
log('[bench pixels 1→3] spot1 same',a1[0]===a3[0],'spot2 changed',a1[1]!==a3[1],'spot3 changed',a1[2]!==a3[2]);
// 町（飾りが一通り）のスクリーンショット
await load(base({townExp:2800,gacha:gacha(Object.fromEntries(DC.map(k=>[k,3]))),decor:{treeAt:T-40*864e5}}));
await pg.evaluate(()=>window.__clockseed.lookAt(160,96,0.78));await pg.waitForTimeout(400);await pg.screenshot({path:O+'11_decor_town.png'});
log('[trees hidden at decor spots]',(await info()).treesHidden);

// ===== 3. 世界樹の成長段階 =====
const stages=[];
for(const d of [0,6,7,14,15,22,23,29,30,45]){await load(base({gacha:gacha({dc14:1}),decor:{treeAt:T-d*864e5-3600e3}}));const i=await info();stages.push(d+'日→'+['苗','若木','中木','大木','完成形'][i.treeStage]);}
log('[world tree]',stages.join(' / '));
// 日付の境目：前日23:59 に入手 → 翌日0:01 で1日目
await pg.clock.setFixedTime(new Date('2026-11-27T00:01:00').getTime());await load(base({gacha:gacha({dc14:1}),decor:{treeAt:new Date('2026-11-20T23:59:00').getTime()}}));
log('[world tree date boundary] 11/20 23:59 → 11/27 00:01 days',(await info()).treeDays,'stage',(await info()).treeStage,'(7日 = 若木)');
await pg.clock.setFixedTime(T);
// 成長段階のスクリーンショット（5段階を横に並べる）
const shots=[];
for(const d of [0,7,15,23,30]){await load(base({townExp:300,gacha:gacha({dc14:1}),decor:{treeAt:T-d*864e5}}));await pg.evaluate(()=>window.__clockseed.lookAt(28,34,0.6));await pg.waitForTimeout(250);
  const p=await pg.evaluate(()=>window.__clockseed.worldToScreen(26,54));shots.push((await pg.screenshot({clip:{x:p.x-110,y:p.y-262,width:220,height:280}})).toString('base64'));}
await (async()=>{const q=await ctx.newPage();await q.setContent('<body style="margin:0;background:#2f4a2c;display:flex;gap:6px;padding:6px;font:bold 15px sans-serif;color:#fff">'+shots.map((b,k)=>'<div style="text-align:center"><img src="data:image/png;base64,'+b+'" style="width:220px;height:280px;display:block">'+['0〜6日 苗','7〜14日 若木','15〜22日 中木','23〜29日 大木','30日〜 完成形'][k]+'</div>').join('')+'</body>');
await q.setViewportSize({width:1160,height:320});await q.screenshot({path:O+'12_world_tree_stages.png'});await q.close();})();

// ===== 4. 魅力と注文経験値 =====
const charmOf=async items=>{await load(base({gacha:gacha(items)}));const i=await info();return i.charm+'点 +'+i.bonus+'%';};
log('[charm] ベンチ＋花壇赤＋噴水＋街灯＋石の小道',await charmOf({dc01:1,dc02:1,dc03:1,dc05:1,dc09:1}),'(5点 +5%)');
log('[charm] 同じ飾りを3つ（種類ごとに1回）',await charmOf({dc01:3,dc02:3,dc03:1,dc05:3,dc09:3}),'(5点)');
log('[charm] コモン4つ',await charmOf({dc01:1,dc02:1,dc03:1,dc05:1}),'(4点 +0%)');
log('[charm] シンボルツリー＋看板＋季節の花壇',await charmOf({dc07:1,dc04:1,dc06:1}),'(8+2+2=12点 +10%)');
log('[charm] 四季の庭園＋激レア2つ＋レア2つ',await charmOf({dc13:1,dc08:1,dc14:1,dc11:1,dc12:1}),'(4+6+6+2+2=20点 +15%)');
log('[charm] 全14種',await charmOf(Object.fromEntries(DC.map(k=>[k,1]))),'(6+8+4+8+12=38点 +25%：段階5.7で+25%の下限を36点に変更)');
log('[charm] 0',await charmOf({cs01:3,sd01:1,hp02:1}),'(飾り以外は数えない 0点 +0%)');
// 注文経験値：小麦粉（20）＋魅力+10% → 22、ブースト併用 → 33
for(const [boost,want] of [[0,22],[1,33]]){
  await load(base({storage:storage({flour:6}),buildings:blds(['mill']),orders:[{crop:'flour',qty:2},{crop:'wheat',qty:9},{crop:'wheat',qty:9}],gacha:gacha({dc07:1,dc04:1,dc06:1}),buffs:{fert:0,fertPlus:0,double:0,boost}}));
  await openBoard();const note=(await pg.locator('#orderCharm').innerText()).replace(/\s+/g,' '),row=(await pg.locator('.orow').first().innerText()).replace(/\s+/g,' ');
  const a=await st();await pg.locator('.orow').first().locator('.tool',{hasText:'納品'}).click();const z=await st();
  log('[charm order'+(boost?'+boost':'')+'] note:',note,'| row:',row,'| exp +',z.townExp-a.townExp,'(expect',want+')');await pg.locator('#ordersClose').click();
}
// 端数の切り上げ：小麦（10）×+5% = 10.5 → 11
await load(base({storage:storage({wheat:9}),gacha:gacha({dc01:1,dc02:1,dc03:1,dc05:1,dc09:1})}));await openBoard();let a=await st();await pg.locator('.orow').first().locator('.tool',{hasText:'納品'}).click();
log('[charm ceil] wheat 10 ×1.05 → exp +',(await st()).townExp-a.townExp,'(11)');await pg.locator('#ordersClose').click();
// 図鑑の飾りタブ
await load(base({gacha:gacha(Object.assign(Object.fromEntries(DC.map(k=>[k,1])),{dc01:3,dc05:2})),decor:{treeAt:T-20*864e5}}));
await pg.locator('#dexHud').click();await pg.locator('.dextabs button',{hasText:'飾り'}).click();await pg.waitForTimeout(250);
log('[dex] charm line',(await pg.locator('#dexCharm').innerText()).replace(/\s+/g,' '),'| decor icons individual',await pg.$$eval('.dexcard img',x=>new Set(x.map(i=>i.src)).size),'distinct of',await pg.$$eval('.dexcard img',x=>x.length));
await pg.screenshot({path:O+'13_dex_decor_tab.png'});
await pg.locator('.dextabs button',{hasText:'お手伝い'}).click();log('[dex] other tabs have no charm line',!(await pg.isVisible('#dexCharm')));await pg.locator('#dexClose').click();

// ===== 5. 金の鐘・街灯・季節 =====
await load(base({gacha:gacha({dc08:1})}));await pg.evaluate(()=>window.__clockseed.lookAt(60,100,1.4));await pg.waitForTimeout(200);
let bp=(await info()).bellPos;await pg.mouse.click(bp.x,bp.y);await pg.waitForTimeout(1500);
log('[bell] ringing',(await info()).bell,'drill panel opened?',await pg.isVisible('#drillPanel'),'(false)');await pg.screenshot({path:O+'14_bell_gathering.png'});
await pg.waitForTimeout(5000);log('[bell] after 6.5s ringing',(await info()).bell,'(false)');
const tc=await pg.evaluate(()=>window.__clockseed.towerCenter());await pg.mouse.click(tc.x,tc.y);await pg.waitForTimeout(200);log('[bell] tower body tap still opens drill',await pg.isVisible('#drillPanel'));
await load(base({gacha:gacha({})}));bp=(await info()).bellPos;await pg.evaluate(()=>window.__clockseed.lookAt(60,100,1.4));await pg.waitForTimeout(200);
const bp2=(await info()).bellPos;await pg.mouse.click(bp2.x,bp2.y);await pg.waitForTimeout(200);log('[bell] without 鐘: ringing',(await info()).bell,'(false)');
// 街灯：時刻を固定
const lampPix=async()=>{const p=await pg.evaluate(()=>window.__clockseed.worldToScreen(100,92));const buf=await pg.screenshot({clip:{x:p.x-12,y:p.y-12,width:24,height:24}});return buf.toString('base64');};
const lamps=[];let off=null;
for(const hh of ['12:00','17:59','18:00','23:30','05:59','06:00']){await pg.clock.setFixedTime(new Date('2026-11-27T'+hh+':00').getTime());await load(base({gacha:gacha({dc05:1})}));
  await pg.evaluate(()=>window.__clockseed.lookAt(100,100,1.6));await pg.waitForTimeout(250);const i=await info(),px=await lampPix();if(hh==='12:00')off=px;lamps.push(hh+' '+(i.lampOn?'点灯':'消灯')+(px===off?'(画素=昼)':'(画素変化)'));
  if(hh==='23:30')await pg.screenshot({path:O+'15_lamps_night.png'});}
log('[lamp]',lamps.join(' / '));
// 季節
const seas=[];const gsig={};
for(const m of ['01','03','05','06','08','09','11','12']){await pg.clock.setFixedTime(new Date('2026-'+m+'-15T12:00:00').getTime());await load(base({gacha:gacha({dc06:1,dc13:1})}));
  await pg.evaluate(()=>window.__clockseed.lookAt(166,50,2));await pg.waitForTimeout(250);const i=await info();
  const p=await pg.evaluate(()=>window.__clockseed.worldToScreen(166,48));const sig=(await pg.screenshot({clip:{x:p.x-30,y:p.y-30,width:60,height:40}})).toString('base64');
  (gsig[i.season]=gsig[i.season]||new Set()).add(sig.length>0?sig:'');seas.push(m+'月→'+i.season);}
log('[season]',seas.join(' / '));
const shotSeason=[];for(const m of ['04','07','10','01']){await pg.clock.setFixedTime(new Date('2026-'+m+'-15T12:00:00').getTime());await load(base({gacha:gacha({dc06:3,dc13:1})}));
  await pg.evaluate(()=>window.__clockseed.lookAt(150,62,0.6));await pg.waitForTimeout(250);const p=await pg.evaluate(()=>window.__clockseed.worldToScreen(158,52));shotSeason.push((await pg.screenshot({clip:{x:p.x-130,y:p.y-120,width:260,height:170}})).toString('base64'));}
log('[season] 4 images distinct',new Set(shotSeason).size,'(4)');
await (async()=>{const q=await ctx.newPage();await q.setContent('<body style="margin:0;background:#2f4a2c;display:flex;gap:6px;padding:6px;font:bold 15px sans-serif;color:#fff">'+shotSeason.map((b,k)=>'<div style="text-align:center"><img src="data:image/png;base64,'+b+'" style="width:260px;height:170px;display:block">'+['春（3〜5月）','夏（6〜8月）','秋（9〜11月）','冬（12〜2月）'][k]+'</div>').join('')+'</body>');
await q.setViewportSize({width:1080,height:210});await q.screenshot({path:O+'16_seasons.png'});await q.close();})();
log('JS errors',errs.length,errs.slice(0,5));
await b.close();})();
