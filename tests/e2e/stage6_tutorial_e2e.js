const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1180,height:820},deviceScaleFactor:2});
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
const base='file:///home/user/clockseed/index.html';const O='/home/user/clockseed/screenshots/';
const log=(...a)=>console.log(...a);
const st=()=>pg.evaluate(()=>JSON.parse(localStorage.getItem('clockseed.save')));
const tut=()=>pg.evaluate(()=>window.__clockseed.tutorial());
const fresh=async q=>{await pg.goto(base+q);await pg.evaluate(()=>localStorage.clear());await pg.reload();await pg.waitForTimeout(500);};
// 目印をたどって押す：DOM の目印（光る枠）ならそれを、町の目印（矢印）ならその場所をクリック
async function follow(note){const t=await tut();if(t.dom){const hl=await pg.$eval(t.dom,e=>e.classList.contains('tut-hl')).catch(()=>false);await pg.locator(t.dom).first().click();log('   ['+t.step+'] '+t.text+' → '+t.dom+(hl?'（光る枠あり）':''));}
  else if(t.world){if(/製粉所/.test(t.text)){const f=await pg.evaluate(()=>window.__clockseed.facCenter('mill'));await pg.mouse.click(f.x,f.y);}else if(/時計塔|ドリル5問|ガチャ/.test(t.text)){const f=await pg.evaluate(()=>window.__clockseed.towerCenter());await pg.mouse.click(f.x,f.y);}else await pg.mouse.click(t.world.x,t.world.y+14);log('   ['+t.step+'] '+t.text+' → 町の目印 ('+Math.round(t.world.x)+','+Math.round(t.world.y)+')');}
  else log('   ['+t.step+'] '+t.text+'（目印なし）'+(note||''));await pg.waitForTimeout(250);}
async function answer5(){for(let k=0;k<5;k++){const i=await pg.evaluate(()=>window.__clockseed.drillAnswerIndex());await pg.locator('.choice').nth(i).click();await pg.waitForTimeout(1100);}}
const close=async id=>{if(await pg.isVisible('#'+id)){const c=await pg.$('#'+id+' .panelhd button, #'+id+' button[id$="Close"]');if(c)await c.click();else await pg.keyboard.press('Escape');await pg.waitForTimeout(150);}};
// ===== 1. 新規セーブで通しで進める（?debug=1&fast=4：育成・建設・加工が4倍速） =====
await fresh('?debug=1&fast=4');
let t=await tut();log('[start] tutorial',JSON.stringify({done:t.done,step:t.step,level:t.level,plots:t.plots,shards:t.shards,tickets:t.tickets}),'| orders',JSON.stringify((await st()).orders.slice(0,2)),'| bar',(await pg.locator('#tutBar').innerText()).replace(/\s+/g,' '));
await pg.screenshot({path:O+'32_tutorial_guide.png'});
log('[gacha before step5]',await pg.evaluate(()=>{window.__clockseed;return 1;}) && 'menu check below');
// 1 小麦を植える
await follow();await follow();t=await tut();log('[after 1] step',t.step);
// 2 ドリル5問（難度A）
await follow();log('   gacha box',(await pg.locator('.gbox').innerText()).replace(/\s+/g,' ').slice(0,40));await follow();await answer5();t=await tut();log('[after 2] step',t.step,'sets',t.sets);
// 3 時短で追い込みまで → 即収穫できる
await follow();await follow();t=await tut();const s3=await st();log('[after 3] step',t.step,'| stock left',s3.drill.stock,'| wheat ready',s3.plots.some(p=>p&&p.crop==='wheat'&&p.readyAt<=Date.now()));
await close('skipPanel');await close('drillPanel');
// 4 収穫 → 納品（小麦）→ にんじんを植える
await follow();await follow();await follow();await close('ordersPanel');await follow();await follow();t=await tut();let s=await st();
log('[after 4] step',t.step,'| gold',s.gold,'exp',s.townExp,'| carrot planted',s.plots.some(p=>p&&p.crop==='carrot'),'| tickets',t.tickets);
// 5 チケットでガチャ（まる小麦に固定・天井カウントは進まない）
const p0=(await st()).gacha.pity;await follow();await follow();s=await st();t=await tut();
log('[after 5] step',t.step,'| result',JSON.stringify(await pg.evaluate(()=>window.__clockseed.lastGacha().map(r=>({id:r.id,fixed:r.fixed,tutorial:r.tutorial})))),'| sd01',s.gacha.items.sd01,'| pity',JSON.stringify(p0),'→',JSON.stringify(s.gacha.pity),'| tickets',t.tickets,'| shards',s.drill.shards);
await pg.screenshot({path:'/tmp/claude-0/s/t6_gacha.png'});
await close('drillPanel');
// 6 にんじん：時短で育てて収穫 → 納品で町Lv2
{const c=await pg.evaluate(()=>window.__clockseed.towerCenter());await pg.mouse.click(c.x,c.y);await pg.waitForTimeout(200);await pg.locator('#drillSkipBtn').click();await pg.waitForTimeout(150);
 const row=pg.locator('#skipList .srow',{hasText:'にんじん'});await row.locator('button',{hasText:'最大まで'}).click();await pg.waitForTimeout(150);await close('skipPanel');}
t=await tut();log('   ['+t.step+'] '+t.text);
await follow();await follow();await follow();t=await tut();s=await st();log('[after 6] step',t.step,'| level',t.level,'exp',s.townExp,'| plots',t.plots,'| gold',s.gold);
await close('ordersPanel');
// 7 製粉所を建てる
await follow();await follow();t=await tut();s=await st();log('[after 7] step',t.step,'| mill',!!s.buildings.mill,'| gold',s.gold);await close('facPanel');
// 8 ドリル5問（2セット目）
await follow();await follow();await answer5();t=await tut();log('[after 8] step',t.step,'sets',t.sets,'shards',t.shards);
await close('drillPanel');
// 9 小麦粉：製粉所の完成（時短）・小麦を植えて収穫（時短）・小麦粉を作る
t=await tut();log('   ['+t.step+'] '+t.text);
await follow();await follow();t=await tut();log('   ['+t.step+'] '+t.text);
{const c=await pg.evaluate(()=>window.__clockseed.towerCenter());await pg.mouse.click(c.x,c.y);await pg.waitForTimeout(200);await pg.locator('#drillSkipBtn').click();await pg.waitForTimeout(150);
 for(const name of ['製粉所','小麦']){const row=pg.locator('#skipList .srow',{hasText:name});if(await row.count())await row.first().locator('button',{hasText:'最大まで'}).click();await pg.waitForTimeout(150);}
 await close('skipPanel');}
s=await st();log('   stock left',s.drill.stock,'| mill built',s.buildings.mill.builtAt<=Date.now());
for(let k=0;k<4&&!(await tut()).done;k++){await follow();}
t=await tut();s=await st();
log('[end] done',t.done,'| level',t.level,'| plots',t.plots,'| tickets',t.tickets,'| shards',t.shards,'| pity',JSON.stringify(t.pity),'| gacha total',t.total,'| flour job',s.buildings.mill.job&&s.buildings.mill.job.recipe,'| gold',s.gold,'| bar',await pg.isVisible('#tutBar'));
await close('facPanel');await pg.waitForTimeout(400);await pg.screenshot({path:O+'33_tutorial_finished_town.png'});
// 通常プレイへ：ガチャはカケラで引ける・チケットはそのまま使える
{const c=await pg.evaluate(()=>window.__clockseed.towerCenter());await pg.mouse.click(c.x,c.y);await pg.waitForTimeout(200);
 log('[after tutorial] gacha box',(await pg.locator('.gbox').innerText()).replace(/\s+/g,' ').slice(0,120));
 const p1=(await st()).gacha.pity;await pg.locator('#gachaTicketBtn').click();await pg.waitForTimeout(150);const s2=await st();
 log('[ticket normal pull] tickets',(await tut()).tickets,'| shards unchanged',s2.drill.shards===t.shards,'| pity',JSON.stringify(p1),'→',JSON.stringify(s2.gacha.pity),'| total',s2.gacha.total);await close('drillPanel');}
await pg.reload();await pg.waitForTimeout(400);log('[reload] tutorial done',(await tut()).done,'| bar',await pg.isVisible('#tutBar'));
// ===== 2. スキップ：途中で終えても壊れず通常プレイへ =====
for(const at of [1,4,6]){
  await fresh('?debug=1&fast=4');
  if(at>=4){await pg.evaluate(at=>{const s=JSON.parse(localStorage.getItem('clockseed.save'));s.storage.wheat=3;s.tutorial.step=at;s.tutorial.sets=1;s.drill.shards=10;s.drill.stock=40;if(at===6){s.tutorial.tickets=2;s.tutorial.granted=true;s.tutorial.flags={d1:true,pull:true};s.gacha.items.sd01=1;s.gacha.dex.sd01=1;s.gacha.firstUsed=true;s.townExp=10;s.gold=39;s.storage.wheat=0;}localStorage.setItem('clockseed.save',JSON.stringify(s));},at);await pg.reload();await pg.waitForTimeout(400);}
  else {await follow();await follow();}
  const before=await st();await pg.locator('#tutSkip').click();await pg.waitForTimeout(200);const after=await st();t=await tut();
  const c=await pg.evaluate(()=>window.__clockseed.towerCenter());await pg.mouse.click(c.x,c.y);await pg.waitForTimeout(200);
  const gb=(await pg.locator('.gbox').innerText()).replace(/\s+/g,' ').slice(0,70);
  await pg.locator('#drillStartBtn').click();await answer5();const s5=await st();await close('drillPanel');
  const pt=await pg.evaluate(()=>window.__clockseed.plotCenter(5));await pg.locator('#palette [data-crop="carrot"]').click();await pg.mouse.click(pt.x,pt.y);await pg.waitForTimeout(150);
  log('[skip at step '+at+'] done',t.done,'| bar',await pg.isVisible('#tutBar'),'| kept: plots',JSON.stringify(before.plots.filter(Boolean).map(p=>p.crop))===JSON.stringify(after.plots.filter(Boolean).map(p=>p.crop)),'storage',JSON.stringify(before.storage)===JSON.stringify(after.storage),'gold',after.gold===before.gold,'tickets',after.tutorial.tickets,
    '| gacha',gb,'| drill after skip +',s5.drill.stock-after.drill.stock,'s | planted carrot',(await st()).plots[5]&&(await st()).plots[5].crop);
}
// ===== 3. version 11 からの移行：チュートリアルは出ない =====
await pg.goto(base+'?debug=1');
const v11={saveVersion:11,plots:[{crop:'wheat',plantedAt:Date.now()-1000,readyAt:Date.now()+119000}].concat(Array(23).fill(null)),storage:{wheat:4,carrot:2},gold:250,townExp:150,orders:[{crop:'carrot',qty:5},{crop:'wheat',qty:4},{crop:'potato',qty:3}],
  buildings:{mill:{startedAt:Date.now()-4e5,builtAt:Date.now()-2e5,job:null}},drill:{stock:300,shards:33,shardHalf:0,tickets:1,streak:2,stats:{A1:{ok:3,n:4}},day:'',dayCount:0,spDay:'',spCount:0},
  gacha:{pity:{r:4,sr:4,ur:4},total:4,firstUsed:true,items:{sd01:1,dc01:1},dex:{sd01:1,dc01:1}},trade:{uid:'ABC123',stock:{sd02:1},received:['AAAAAAAA']},decor:{treeAt:0}};
await pg.evaluate(s=>localStorage.setItem('clockseed.save',JSON.stringify(s)),v11);await pg.reload();await pg.waitForTimeout(400);
s=await st();t=await tut();
log('[migrate v11] version',s.saveVersion,'| tutorial',JSON.stringify({done:s.tutorial.done,tickets:s.tutorial.tickets}),'| bar',await pg.isVisible('#tutBar'),'| kept',JSON.stringify({gold:s.gold===250,exp:s.townExp===150,orders:JSON.stringify(s.orders)===JSON.stringify(v11.orders),mill:s.buildings.mill.builtAt===v11.buildings.mill.builtAt,drill:s.drill.stock===300&&s.drill.shards===33,pity:JSON.stringify(s.gacha.pity)===JSON.stringify(v11.gacha.pity),trade:s.trade.uid==='ABC123'&&s.trade.stock.sd02===1,wheat:s.storage.wheat===4}),
  '| backup',await pg.evaluate(()=>!!localStorage.getItem('clockseed.save.v11.backup')));
{const c=await pg.evaluate(()=>window.__clockseed.towerCenter());await pg.mouse.click(c.x,c.y);await pg.waitForTimeout(200);log('[migrated] gacha box',(await pg.locator('.gbox').innerText()).replace(/\s+/g,' ').slice(0,40));}
// ===== 4. ?debug=1 なしでは デバッグAPI と ?fast が効かない =====
for(const q of ['','?fast=10','?debug=0&fast=10','?debug=1&fast=10']){
  await fresh(q);const api=await pg.evaluate(()=>typeof window.__clockseed);
  await pg.locator('#palette [data-crop="wheat"]').click();
  const box=await pg.evaluate(()=>{const c=document.getElementById('world').getBoundingClientRect();return {w:c.width,h:c.height};});
  // 区画の場所は API なしでも分かるように、画面中央付近を探す（最初の区画）
  let planted=null;for(let y=200;y<700&&!planted;y+=30)for(let x=300;x<900&&!planted;x+=30){await pg.mouse.click(x,y);const s=await pg.evaluate(()=>JSON.parse(localStorage.getItem('clockseed.save')));const p=s.plots.find(Boolean);if(p)planted=p;}
  log('[gate '+(q||'(なし)')+'] window.__clockseed',api,'| badge',JSON.stringify(await pg.locator('#fastBadge').innerText()),'| wheat grow ms',planted?planted.readyAt-planted.plantedAt:'-');
}
log('JS errors',errs.length,errs.slice(0,5));
await b.close();})();
