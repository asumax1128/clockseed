const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1180,height:820},deviceScaleFactor:2});
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
const T=new Date('2026-11-27T12:00:00').getTime();await pg.clock.install({time:T});
const url='file:///home/user/clockseed/index.html?debug=1';const O='/home/user/clockseed/screenshots/';
const log=(...a)=>console.log(...a);
const raw=()=>pg.evaluate(()=>localStorage.getItem('clockseed.save'));
const st=async()=>JSON.parse(await raw());
const put=s=>pg.evaluate(s=>localStorage.setItem('clockseed.save',JSON.stringify(s)),s);
const load=async s=>{await pg.goto(url);await put(s);await pg.reload();await pg.waitForTimeout(400);};
const tr=()=>pg.evaluate(()=>window.__clockseed.trade());
const ITEMS=['wheat','carrot','potato','tomato','corn','strawberry','pumpkin','grape','flour','juice','fries','tsauce','bread','jambread','milk','cheese','butter','sjam','gjam','pizza','ppie','gcake'];
const BK=['mill','kitchen','bakery','ranch','dairy','jam','restaurant','cake'];
const storage=(o={})=>Object.assign(Object.fromEntries(ITEMS.map(k=>[k,0])),o);
const allBuilt=()=>Object.fromEntries(BK.map(k=>[k,{startedAt:T-2e6,builtAt:T-1e6,job:null}]));
const gacha=(items={})=>({pity:{r:0,sr:0,ur:0},total:10,firstUsed:true,items,dex:Object.fromEntries(Object.keys(items).map(k=>[k,1]))});
const base=(o={})=>Object.assign({saveVersion:11,plots:Array(24).fill(null),storage:storage(),gold:500,townExp:2800,orders:[{crop:'wheat',qty:9},{crop:'wheat',qty:9},{crop:'wheat',qty:9}],buildings:allBuilt(),
  drill:{stock:100,shards:40,shardHalf:0,tickets:1,streak:2,stats:{},day:'2026-11-27',dayCount:3,spDay:'',spCount:0},gacha:gacha({})},o);
const norm=x=>Array.isArray(x)?x.map(norm):(x&&typeof x==='object')?Object.fromEntries(Object.keys(x).sort().map(k=>[k,norm(x[k])])):x;
const same=(a,b)=>JSON.stringify(norm(a))===JSON.stringify(norm(b));
const openTrade=async()=>{await pg.locator('#tradeHud').click();await pg.waitForTimeout(150);};
// ===== 1. version 10 → 11 =====
const v10=base({saveVersion:10,townExp:1900,gold:4321,storage:Object.assign(storage({wheat:5}),{v_sd01:3}),plots:[{crop:'wheat',plantedAt:T-1000,readyAt:T+119000,v:'sd01'}].concat(Array(23).fill(null)),
  gacha:gacha({sd01:1,dc01:2,dc14:1,hp06:1,cs01:2}),buffs:{fert:1,fertPlus:0,double:2,boost:1},helpers:{keeperDay:'2026-11-26',peddlerDay:'',peddler:null,crowSeen:[]},decor:{treeAt:T-10*864e5},
  orderIds:['a','b','c'],nextOrder:{crop:'carrot',qty:5},drill:{stock:777,shards:55,shardHalf:1,tickets:3,streak:4,stats:{C1:{ok:2,n:3},S5:{ok:1,n:1}},day:'2026-11-27',dayCount:9,spDay:'2026-11-27',spCount:2}});
await load(v10);let s=await st();
const keys=['plots','gold','townExp','orders','orderIds','nextOrder','buildings','drill','buffs','helpers','decor'];
log('[migrate v10] version',s.saveVersion,JSON.stringify(Object.fromEntries(keys.map(k=>[k,same(s[k],v10[k])]))),'storage',Object.entries(v10.storage).every(([k,v])=>s.storage[k]===v),'gacha',same(s.gacha.items,Object.assign({},s.gacha.items,v10.gacha.items)),
  'trade',JSON.stringify({uid:/^[0-9A-Z]{6}$/.test(s.trade.uid),stock:s.trade.stock,received:s.trade.received}),'backup',await pg.evaluate(()=>!!localStorage.getItem('clockseed.save.v10.backup')));
// ===== 2. 町Lv8で解放 =====
await load(base({townExp:1800}));log('[Lv7] button',(await pg.locator('#tradeHud').innerText()).trim(),'disabled',await pg.locator('#tradeHud').isDisabled());
await load(base({townExp:2800}));log('[Lv8] button',(await pg.locator('#tradeHud').innerText()).trim(),'disabled',await pg.locator('#tradeHud').isDisabled());
// ===== 3. 町のコードの往復 =====
const decA={dc01:3,dc02:2,dc03:1,dc05:3,dc06:1,dc07:1,dc08:1,dc09:2,dc10:1,dc11:1,dc12:1,dc13:1,dc14:1};
await load(base({gacha:gacha(Object.assign({sd10:1,sd01:1},decA)),decor:{treeAt:T-25*864e5}}));
const A=await tr();const decInfoA=await pg.evaluate(()=>window.__clockseed.decorInfo().shown);
await openTrade();await pg.locator('#townIssue').click();const code=await pg.locator('#townCode').inputValue();
await pg.screenshot({path:O+'29_trade_board.png'});
log('[town code] issued',code,'| A level',A.level,'tree',A.treeStage,'charm',A.charm);
await pg.locator('#tradeClose').click();
// 別のセーブ（B）で入力
await load(base({gacha:gacha({dc04:2,sd03:1}),plots:[{crop:'carrot',plantedAt:T-1000,readyAt:T+200000}].concat(Array(23).fill(null)),storage:storage({wheat:7})}));
const Bown=await tr();const before=await raw();
await openTrade();
// 壊れたコード・種類違いのコード
const bad=[['空',''],['1文字ちがい',code.slice(0,-3)+(code.slice(-3,-2)==='0'?'1':'0')+code.slice(-2)],['隣どうし入れ替え',code.replace(/TOKI-TOWN-(.)(.)/,'TOKI-TOWN-$2$1')],['短い',code.slice(0,-2)],['ギフトコード','TOKI-SEED-1A00-0000-0000-0000-00'],['別の文字列','HELLO-WORLD'],['記号入り',code.replace(/.$/,'!')]];
for(const [n,c] of bad){await pg.locator('#visitInput').fill(c);await pg.locator('#visitGo').click();await pg.waitForTimeout(60);const t=await tr();log('[reject '+n+'] visiting',t.visiting,'| msg',(await pg.locator('#visitMsg').innerText()).trim());}
await pg.locator('#visitInput').fill(code.toLowerCase().replace(/-/g,' '));await pg.locator('#visitGo').click();await pg.waitForTimeout(400);
let V=await tr();const decInfoV=await pg.evaluate(()=>window.__clockseed.decorInfo().shown);
log('[visit] visiting',V.visiting,'| level',V.level,'=A',A.level,'| decor same',same(V.decor,A.decor),'| shown same',same(decInfoV,decInfoA),'| tree',V.treeStage,'=A',A.treeStage,'| charm',V.charm,'=A',A.charm,
  '| facilities',V.buildings.length,'=A',A.buildings.length,'| plots',V.plots,'=A',A.plots,'| houses',V.houses,'=A',A.houses);
log('[visit bar]',(await pg.locator('#visitBar').innerText()).replace(/\s+/g,' '),'| palette visible',await pg.isVisible('#palette'),'subHud visible',await pg.isVisible('#subHud'));
await pg.evaluate(()=>window.__clockseed.overview());await pg.waitForTimeout(300);await pg.screenshot({path:O+'30_visit_town.png'});
// 見学中の操作：区画・掲示板・時計塔・施設・鐘
const clickAt=async p=>{await pg.mouse.click(p.x,p.y);await pg.waitForTimeout(150);};
await clickAt(await pg.evaluate(()=>window.__clockseed.plotCenter(0)));
await clickAt(await pg.evaluate(()=>window.__clockseed.boardCenter()));
await clickAt(await pg.evaluate(()=>window.__clockseed.towerCenter()));
await clickAt(await pg.evaluate(()=>window.__clockseed.facCenter('mill')));
const bp=await pg.evaluate(()=>window.__clockseed.decorInfo().bellPos);await clickAt(bp);
const panels=await pg.evaluate(()=>['popup','ordersPanel','facPanel','drillPanel','tradePanel','dexPanel'].filter(id=>document.getElementById(id).style.display==='flex'));
V=await tr();log('[visit inputs] open panels',JSON.stringify(panels),'| plot0 planted?',await pg.evaluate(()=>JSON.stringify(window.__clockseed.trade()&&null)),'| bell ringing',await pg.evaluate(()=>window.__clockseed.decorInfo().bell),'| save untouched',(await raw())===before);
await pg.clock.runFor(5000);await pg.waitForTimeout(200);log('[visit 5s later] save untouched',(await raw())===before);
await pg.locator('#visitEnd').click();await pg.waitForTimeout(300);
const Bback=await tr();log('[end visit] visiting',Bback.visiting,'| own town back',same({l:Bback.level,d:Bback.decor,t:Bback.treeStage,b:Bback.buildings},{l:Bown.level,d:Bown.decor,t:Bown.treeStage,b:Bown.buildings}),'| save untouched',(await raw())===before,
  '| own plot kept',(await st()).plots[0].crop,'| palette visible',await pg.isVisible('#palette'),'| board reopened',await pg.isVisible('#tradePanel'));
await pg.locator('#tradeClose').click();
// ===== 4. ギフトコードの往復 =====
await load(base({gacha:gacha({sd10:1,sd14:1})}));const Auid=(await tr()).uid;await openTrade();
await pg.locator('.tseed[data-seed="sd10"]').click();await pg.locator('#giftIssue').click();const g1=await pg.locator('#giftCode').inputValue();
await pg.locator('#giftIssue').click();const g2=await pg.locator('#giftCode').inputValue();await pg.locator('#giftIssue').click();const g3=await pg.locator('#giftCode').inputValue();
log('[gift issue] codes',g1,'|',g2,'| distinct',new Set([g1,g2,g3]).size===3,'| A still owns sd10',(await st()).gacha.items.sd10===1);
await pg.locator('#giftInput').fill(g1);await pg.locator('#giftRecv').click();log('[own gift]',(await pg.locator('#giftMsg').innerText()).trim());
await pg.locator('#tradeClose').click();
// B：未解放 → ストック
await load(base({gacha:gacha({}),drill:{stock:0,shards:40,shardHalf:0,tickets:0,streak:0,stats:{},day:'',dayCount:0,spDay:'',spCount:0}}));await openTrade();
log('[B no variants] seeds section',(await pg.locator('.tsec').nth(2).innerText()).replace(/\s+/g,' ').slice(0,60));
await pg.locator('#giftInput').fill(g1);await pg.locator('#giftRecv').click();await pg.waitForTimeout(80);
s=await st();log('[receive] msg',(await pg.locator('#giftMsg').innerText()).trim(),'| stock',JSON.stringify(s.trade.stock),'| unlocked?',!!s.gacha.items.sd10,'| received',JSON.stringify(s.trade.received),'| shards',s.drill.shards);
await pg.screenshot({path:O+'31_gift_received.png'});
await pg.locator('#giftInput').fill(g1);await pg.locator('#giftRecv').click();log('[same gift again]',(await pg.locator('#giftMsg').innerText()).trim(),'| stock',JSON.stringify((await st()).trade.stock));
await pg.locator('#giftInput').fill('TOKI-TOWN-1800-0000-0000-0000-000');await pg.locator('#giftRecv').click();log('[town code in gift field]',(await pg.locator('#giftMsg').innerText()).trim());
await pg.locator('#giftInput').fill(g2.slice(0,-1)+(g2.slice(-1)==='A'?'B':'A'));await pg.locator('#giftRecv').click();log('[broken gift]',(await pg.locator('#giftMsg').innerText()).trim());
await pg.locator('#tradeClose').click();
// ストックで植える → 収穫
await pg.locator('#palette .tool',{hasText:'いちご'}).click();await pg.waitForTimeout(80);
log('[palette] variant bar',JSON.stringify(await pg.$$eval('#variantBar .vbtn',x=>x.map(e=>e.innerText.replace(/\s+/g,' ')))));
await pg.locator('#variantBar .vbtn[data-v="sd10"]').click();
await clickAt(await pg.evaluate(()=>window.__clockseed.plotCenter(0)));
s=await st();log('[plant from stock] plot0',JSON.stringify(s.plots[0]&&{c:s.plots[0].crop,v:s.plots[0].v}),'| stock',JSON.stringify(s.trade.stock),'| variant bar now',JSON.stringify(await pg.$$eval('#variantBar .vbtn',x=>x.map(e=>e.dataset.v))));
await clickAt(await pg.evaluate(()=>window.__clockseed.plotCenter(1)));s=await st();log('[after stock empty] plot1',JSON.stringify(s.plots[1]&&{c:s.plots[1].crop,v:s.plots[1].v||null}));
await pg.locator('#palette .tool',{hasText:'いちご'}).click();await clickAt(await pg.evaluate(()=>window.__clockseed.plotCenter(2)));
const popupV=await pg.$$eval('#popupVar .vbtn',x=>x.map(e=>e.dataset.v));log('[popup after stock empty] variants',JSON.stringify(popupV),'| popup open',await pg.isVisible('#popup'));
await pg.locator('#popupCancel').click();
await pg.evaluate(()=>{const s=JSON.parse(localStorage.getItem('clockseed.save'));s.plots[0].readyAt=Date.now()-1;localStorage.setItem('clockseed.save',JSON.stringify(s));});await pg.reload();await pg.waitForTimeout(300);   // 育ちきった状態にする

await clickAt(await pg.evaluate(()=>window.__clockseed.plotCenter(0)));s=await st();log('[harvest] v_sd10',s.storage.v_sd10,'(2) plot0',s.plots[0]);
// 2つ目のギフト → またストック。ドラッグ植えはストックが尽きたら止まる
await openTrade();await pg.locator('#giftInput').fill(g2);await pg.locator('#giftRecv').click();await pg.locator('#giftInput').fill(g3);await pg.locator('#giftRecv').click();s=await st();log('[2 more gifts] stock',JSON.stringify(s.trade.stock),'received',s.trade.received.length);await pg.locator('#tradeClose').click();
await pg.locator('#palette .tool',{hasText:'いちご'}).click();await pg.locator('#variantBar .vbtn[data-v="sd10"]').click();
{const ps=[3,4,5].map(i=>null);const c3=await pg.evaluate(()=>window.__clockseed.plotCenter(3)),c4=await pg.evaluate(()=>window.__clockseed.plotCenter(4)),c5=await pg.evaluate(()=>window.__clockseed.plotCenter(5));
 await pg.mouse.move(c3.x,c3.y);await pg.mouse.down();await pg.mouse.move(c4.x,c4.y,{steps:5});await pg.mouse.move(c5.x,c5.y,{steps:5});await pg.mouse.up();}
s=await st();log('[drag plant 3 plots with stock 2]',JSON.stringify([3,4,5].map(i=>s.plots[i]?(s.plots[i].v||s.plots[i].crop):null)),'| stock',JSON.stringify(s.trade.stock));
// C：解放済み → カケラ+10
await load(base({gacha:gacha({sd10:1}),drill:{stock:0,shards:40,shardHalf:0,tickets:0,streak:0,stats:{},day:'',dayCount:0,spDay:'',spCount:0}}));await openTrade();
await pg.locator('#giftInput').fill(g1);await pg.locator('#giftRecv').click();s=await st();log('[unlocked receiver] msg',(await pg.locator('#giftMsg').innerText()).trim(),'| shards',s.drill.shards,'(50) stock',JSON.stringify(s.trade.stock));
// 受け取り済みIDは直近50件
const many=await pg.evaluate(()=>Array.from({length:55},()=>window.ClockseedCode.encodeGift({seed:'sd02',giftId:window.ClockseedCode.randomId(8),from:'ZZZZZZ'})));
for(const c of many){await pg.locator('#giftInput').fill(c);await pg.locator('#giftRecv').click();}
s=await st();log('[55 more gifts] received kept',s.trade.received.length,'(50) stock sd02',s.trade.stock.sd02,'(55)');
await pg.reload();await pg.waitForTimeout(300);s=await st();log('[reload] received',s.trade.received.length,'stock sd02',s.trade.stock.sd02,'uid kept',s.trade.uid===(await tr()).uid);
log('JS errors',errs.length,errs.slice(0,5));
await b.close();})();
