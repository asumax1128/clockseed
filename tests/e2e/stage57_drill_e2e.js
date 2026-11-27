const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1180,height:820},deviceScaleFactor:2});
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
const T=new Date('2026-11-27T12:00:00').getTime();await pg.clock.setFixedTime(T);
const url='file:///home/user/clockseed/index.html';const O='/home/user/clockseed/screenshots/';
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
const drill=o=>Object.assign({stock:0,shards:0,shardHalf:0,tickets:0,streak:0,stats:{},day:'2026-11-27',dayCount:3},o);
const base=(o={})=>Object.assign({saveVersion:10,plots:Array(24).fill(null),storage:storage(),gold:0,townExp:0,orders:[{crop:'wheat',qty:9},{crop:'wheat',qty:9},{crop:'wheat',qty:9}],buildings:blds([]),drill:drill({}),gacha:gacha({})},o);
const norm=x=>Array.isArray(x)?x.map(norm):(x&&typeof x==='object')?Object.fromEntries(Object.keys(x).sort().map(k=>[k,norm(x[k])])):x;
const same=(a,b)=>JSON.stringify(norm(a))===JSON.stringify(norm(b));
const openDrill=async()=>{const c=await pg.evaluate(()=>window.__clockseed.towerCenter());await pg.mouse.click(c.x,c.y);await pg.waitForTimeout(200);};
const info=()=>pg.evaluate(()=>window.__clockseed.drillSetInfo());
const answer=async(correct)=>{const k=await pg.evaluate(()=>window.__clockseed.drillAnswerIndex());const a=await st();await pg.locator('.choice').nth(correct?k:(k+1)%4).click();await pg.waitForTimeout(150);const z=await st();
  if(correct)await pg.waitForTimeout(1000);else await pg.locator('#dqFb button',{hasText:'つぎへ'}).click();return {sec:z.drill.stock-a.drill.stock,sh:z.drill.shards-a.drill.shards+(z.drill.shardHalf-a.drill.shardHalf)/2};};

// ===== 1. 前提修正：魅力+25% は36点 =====
const charm=async items=>{await load(base({gacha:gacha(items)}));return pg.evaluate(()=>{const d=window.__clockseed.decorInfo();return d.charm+'点 +'+d.bonus+'%';});};
const all=Object.fromEntries(DC.map(k=>[k,1]));
log('[charm] 全14種',await charm(all),'(38点 +25%)');
log('[charm] 看板を除く13種',await charm(Object.fromEntries(DC.filter(k=>k!=='dc04').map(k=>[k,1]))),'(36点 +25%)');
log('[charm] 看板・ベンチを除く12種',await charm(Object.fromEntries(DC.filter(k=>k!=='dc04'&&k!=='dc01').map(k=>[k,1]))),'(35点 +20%)');
await load(base({gacha:gacha(Object.fromEntries(DC.filter(k=>k!=='dc04').map(k=>[k,1]))),storage:storage({flour:6}),buildings:blds(['mill']),orders:[{crop:'flour',qty:2},{crop:'wheat',qty:9},{crop:'wheat',qty:9}]}));
{const c=await pg.evaluate(()=>window.__clockseed.boardCenter());await pg.mouse.click(c.x,c.y);await pg.waitForTimeout(200);}
let a=await st();const note=(await pg.locator('#orderCharm').innerText()).replace(/\s+/g,' ');await pg.locator('.orow').first().locator('.tool',{hasText:'納品'}).click();
log('[charm 36点] note:',note,'| 小麦粉(20) exp +',(await st()).townExp-a.townExp,'(25)');await pg.locator('#ordersClose').click();
await load(base({gacha:gacha(all)}));await pg.locator('#dexHud').click();await pg.locator('.dextabs button',{hasText:'飾り'}).click();log('[dex charm 38点]',(await pg.locator('#dexCharm').innerText()).replace(/\s+/g,' '));await pg.locator('#dexClose').click();
await load(base({gacha:gacha(Object.fromEntries(DC.filter(k=>k!=='dc04'&&k!=='dc01').map(k=>[k,1])))}));await pg.locator('#dexHud').click();await pg.locator('.dextabs button',{hasText:'飾り'}).click();log('[dex charm 35点]',(await pg.locator('#dexCharm').innerText()).replace(/\s+/g,' '));await pg.locator('#dexClose').click();

// ===== 2. version 9 → 10 =====
const v9=base({saveVersion:9,townExp:2000,gold:999,storage:Object.assign(storage({wheat:4,flour:2}),{v_sd01:3}),buildings:blds(['mill','kitchen']),orders:[{crop:'flour',qty:2},{crop:'wheat',qty:4},{crop:'v_sd01',qty:2}],orderIds:['a','b','c'],nextOrder:{crop:'carrot',qty:5},
  drill:drill({stock:1234,shards:56,shardHalf:1,tickets:2,streak:7,stats:{A1:{ok:3,n:4},B5:{ok:1,n:2}},dayCount:12}),gacha:gacha({sd01:1,dc01:2,dc14:1,hp06:1,cs01:3}),buffs:{fert:1,fertPlus:2,double:0,boost:1},
  helpers:{keeperDay:'2026-11-26',peddlerDay:'2026-11-27',peddler:null,crowSeen:['a']},decor:{treeAt:T-10*864e5},plots:[{crop:'wheat',plantedAt:T-1000,readyAt:T+119000,v:'sd01'}].concat(Array(23).fill(null))});
await load(v9);let s=await st();
const keys=['plots','gold','townExp','orders','orderIds','nextOrder','buildings','buffs','helpers','decor'];
log('[migrate v9] version',s.saveVersion,JSON.stringify(Object.fromEntries(keys.map(k=>[k,same(s[k],v9[k])]))),'storage',Object.entries(v9.storage).every(([k,v])=>s.storage[k]===v),
  'gacha',same(s.gacha.items.dc01,2)&&s.gacha.items.cs01===3&&s.gacha.pity.r===0,'drill old fields',['stock','shards','shardHalf','tickets','streak','stats','day','dayCount'].every(k=>same(s.drill[k],v9.drill[k])),
  'new spDay/spCount',JSON.stringify([s.drill.spDay,s.drill.spCount]),'backup',await pg.evaluate(()=>!!localStorage.getItem('clockseed.save.v9.backup')));

// ===== 3. C・D・E の報酬 =====
for(const L of ['C','D','E']){
  await load(base({drill:drill({stock:0,shards:0})}));await openDrill();await pg.locator('.lvbtn',{hasText:L}).first().click();
  const lab=(await pg.locator('.lvbtn',{hasText:L}).first().innerText()).replace(/\s+/g,' ');
  await pg.locator('.dacts button',{hasText:'5問セット'}).click();await pg.waitForTimeout(150);
  await pg.screenshot({path:O+'17_drill_'+L+'.png'});
  const r1=await answer(true),r2=await answer(false),r3=await answer(true);
  log('[reward '+L+'] button',lab,'| correct +'+r1.sec+'秒 カケラ+'+r1.sh,'| wrong +'+r2.sec+'/'+r2.sh,'| correct +'+r3.sec+'/'+r3.sh);
  await pg.locator('#drillClose').click();
}
// ===== 4. 特殊ドリル：5問目までと6問目以降 =====
await load(base({drill:drill({stock:0,shards:0,streak:0})}));await openDrill();
log('[special menu]',(await pg.locator('#specialBox .sphead').innerText()).replace(/\s+/g,' '));
await pg.locator('[data-sp="S2"]').click();await pg.waitForTimeout(200);await pg.screenshot({path:O+'18_special_tenpuzzle.png'});
const sp=[];for(const c of [true,true,false,true,true]){const r=await answer(c);sp.push((c?'○':'×')+'+'+r.sec+'/'+r.sh);}
await pg.locator('.dacts button',{hasText:'もう一度'}).click();await pg.waitForTimeout(150);
const kind=(await info());for(const c of [true,true]){const r=await answer(c);sp.push((c?'○':'×')+'+'+r.sec+'/'+r.sh);}
s=await st();log('[special S2] 1〜5問目',sp.slice(0,5).join(' '),'| 6・7問目',sp.slice(5).join(' '),'| again kind',kind.kind,kind.set[0].type,'| spCount',s.drill.spCount,'streak',s.drill.streak);
await pg.locator('#drillClose').click();await openDrill();log('[special menu after]',(await pg.locator('#specialBox .sphead small').innerText()));
// 段階5.7b：選択式の因数分解ドリル（S1）は FACTOR×FACTOR 移植版に置き換えたので、19_special_factor.png は撮り直さない
await pg.locator('[data-sp="S3"]').click();await pg.waitForTimeout(150);await pg.screenshot({path:O+'20_special_ten_search.png'});await pg.locator('#drillClose').click();
await pg.clock.setFixedTime(T+86400000);await pg.reload();await pg.waitForTimeout(300);await openDrill();await pg.locator('[data-sp="S3"]').click();await pg.waitForTimeout(150);
{const r=await answer(true);log('[special next day] first correct +'+r.sec+'/'+r.sh,'(180/5)');}
await pg.locator('#drillClose').click();await pg.clock.setFixedTime(T);
// 連続正解10でチケット（特殊ドリルでも同じ）
await load(base({drill:drill({streak:9,tickets:0})}));await openDrill();await pg.locator('[data-sp="S2"]').click();await pg.waitForTimeout(150);await answer(true);s=await st();
log('[special streak] streak 9→',s.drill.streak,'tickets',s.drill.tickets,'(1)');await pg.locator('#drillClose').click();

// ===== 5. セット構成 =====
await load(base({drill:drill({stats:{C3:{ok:1,n:5},C6:{ok:2,n:3},C1:{ok:4,n:4}}})}));await openDrill();await pg.locator('.lvbtn',{hasText:'C'}).first().click();
const tally={review:{},chal:{},normalsOk:0};
for(let k=0;k<20;k++){await pg.locator('.dacts button',{hasText:'5問セット'}).click();await pg.waitForTimeout(60);const i=await info();
  const t=i.set.map(x=>x.type),r=i.set.map(x=>x.role);if(r.slice(0,3).every(x=>x==='normal')&&t.slice(0,3).every(x=>x[0]==='C')&&new Set(t).size===5)tally.normalsOk++;
  tally.review[r[3]+':'+t[3]]=(tally.review[r[3]+':'+t[3]]||0)+1;tally.chal[r[4]+':'+t[4]]=(tally.chal[r[4]+':'+t[4]]||0)+1;
  if(k===0){await pg.screenshot({path:'/tmp/claude-0/s/set_c.png'});}
  await pg.locator('#drillClose').click();await openDrill();}
log('[set C with misses C3(4) C6(1)] normals ok',tally.normalsOk+'/20','| 4th',JSON.stringify(tally.review),'| 5th',JSON.stringify(tally.chal));
// 間違えると記録され、次の復習に出る
await load(base());await openDrill();await pg.locator('.lvbtn',{hasText:'D'}).first().click();await pg.locator('.dacts button',{hasText:'5問セット'}).click();await pg.waitForTimeout(100);
let i0=await info();log('[set D no record] roles',i0.set.map(x=>x.role).join(','),'types',i0.set.map(x=>x.type).join(','));
const missT=i0.set[1].type;await answer(true);await answer(false);for(let k=0;k<3;k++)await answer(true);
s=await st();log('[stats D] recorded',JSON.stringify(s.drill.stats),'missed',missT);
await pg.locator('.dacts button',{hasText:'もう一度'}).click();await pg.waitForTimeout(100);i0=await info();log('[set D after a miss] review',i0.set[3].role,i0.set[3].type,'(=',missT+')','challenge',i0.set[4].type);
await pg.locator('#drillClose').click();
await load(base());await openDrill();await pg.locator('.lvbtn',{hasText:'E'}).first().click();const ech={};
for(let k=0;k<6;k++){await pg.locator('.dacts button',{hasText:'5問セット'}).click();await pg.waitForTimeout(60);const i=await info();ech[i.set[4].role+':'+i.set[4].type]=(ech[i.set[4].role+':'+i.set[4].type]||0)+1;await pg.locator('#drillClose').click();await openDrill();}
await load(base({drill:drill({stats:{E6:{ok:0,n:3}}})}));await openDrill();await pg.locator('.lvbtn',{hasText:'E'}).first().click();await pg.locator('.dacts button',{hasText:'5問セット'}).click();await pg.waitForTimeout(60);
const ie=await info();log('[set E] challenge',JSON.stringify(ech),'| E6 missed → review',ie.set[3].type,'challenge',ie.set[4].type,'(E4)');
await pg.locator('#drillClose').click();
// 成績表示（メニュー）
await load(base({drill:drill({stats:{C1:{ok:3,n:4},D8:{ok:1,n:2},E7:{ok:5,n:5}}})}));await openDrill();
for(const L of ['C','D','E']){await pg.locator('.lvbtn',{hasText:L}).first().click();log('[menu stats '+L+']',(await pg.locator('.tstats').innerText()).replace(/\s+/g,' ').slice(0,90));}
await pg.screenshot({path:O+'21_drill_menu.png'});
log('JS errors',errs.length,errs.slice(0,5));
await b.close();})();
