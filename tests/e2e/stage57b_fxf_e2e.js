const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1180,height:820},deviceScaleFactor:2,hasTouch:true});
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
const url='file:///home/user/clockseed/index.html?debug=1&intro=0';const O='/home/user/clockseed/screenshots/';
const log=(...a)=>console.log(...a);
const st=()=>pg.evaluate(()=>JSON.parse(localStorage.getItem('clockseed.save')));
const put=s=>pg.evaluate(s=>localStorage.setItem('clockseed.save',JSON.stringify(s)),s);
const fx=()=>pg.evaluate(()=>window.__clockseed.fxf());
const center=id=>pg.evaluate(id=>window.__clockseed.fxfTileCenter(id),id);
const cdp=await ctx.newCDPSession(pg);
// マウスでドラッグ
async function dragMouse(a,c,mid){const A=await center(a),C=await center(c);await pg.mouse.move(A.x,A.y);await pg.mouse.down();await pg.mouse.move((A.x+C.x)/2,(A.y+C.y)/2+(mid||0),{steps:6});await pg.mouse.move(C.x,C.y,{steps:6});await pg.mouse.up();}
// タッチ（指）でドラッグ：CDP でタッチイベントを送る（Chromium が pointer イベント pointerType=touch に変換）
async function dragTouch(a,c){const A=await center(a),C=await center(c);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:A.x,y:A.y,id:1}]});
  for(let k=1;k<=8;k++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:A.x+(C.x-A.x)*k/8,y:A.y+(C.y-A.y)*k/8,id:1}]});await pg.waitForTimeout(16);}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
const ptrTypes=[];await pg.exposeFunction('__ptr',t=>ptrTypes.push(t));
const openGame=async()=>{const c=await pg.evaluate(()=>window.__clockseed.towerCenter());await pg.mouse.click(c.x,c.y);await pg.waitForTimeout(200);
  await pg.locator('[data-sp="FXF"]').click();await pg.waitForTimeout(150);await pg.locator('#fxfStart').click();await pg.waitForTimeout(2500);};
const day=new Date().toISOString().slice(0,10);
await pg.goto(url);await pg.waitForTimeout(400);
// 段階7：特殊ドリルは町Lv3 で解放。町Lv3（チュートリアル済み）のセーブから始める
await pg.evaluate(()=>{const s=JSON.parse(localStorage.getItem('clockseed.save'));s.townExp=120;s.tutorial.done=true;s.tutorial.step=10;localStorage.setItem('clockseed.save',JSON.stringify(s));});await pg.reload();await pg.waitForTimeout(400);
// ===== 1. メニュー：選択式の因数分解ドリルが移植版に置き換わり、テンパズル・10さがしは残る =====
{const c=await pg.evaluate(()=>window.__clockseed.towerCenter());await pg.mouse.click(c.x,c.y);await pg.waitForTimeout(200);
 log('[menu] special buttons',JSON.stringify(await pg.$$eval('#specialBox .spbtns button',x=>x.map(e=>e.innerText.replace(/\s+/g,' ')))));await pg.locator('#drillClose').click();}
await pg.evaluate(()=>{document.addEventListener('pointerdown',e=>window.__ptr(e.pointerType),true);});
// ===== 2. マウスで5問 → タッチで5問（通しで遊ぶ）、報酬が1問ごとに増える =====
await openGame();
let s0=await st(), f=await fx();log('[start] stage',f.stage,'phase',f.phase,'hp',f.hp,'Lv',f.level,'target',f.target,'tiles',f.tiles.map(t=>t.label).join(' '));
const rows=[];
for(let k=0;k<10;k++){
  f=await fx();const [a,c]=f.pairs[0];const before=await st();
  if(k<5)await dragMouse(a,c);else await dragTouch(a,c);
  await pg.waitForTimeout(80);const mid=await fx();const after=await st();
  rows.push((k<5?'マウス':'タッチ')+' Lv'+f.level+' '+f.target+' → 正解'+mid.caught+' +'+(after.drill.stock-before.drill.stock)+'秒 カケラ+'+(after.drill.shards-before.drill.shards));
  if(k===9){await pg.waitForTimeout(20);await pg.screenshot({path:O+'22_fxf_play_placed.png'});}
  await pg.waitForTimeout(520);
}
rows.forEach(r=>log('  ',r));
f=await fx();let s1=await st();
log('[after 10] caught',f.caught,'score',f.score,'combo',f.combo,'earned',JSON.stringify(f.earned),'| save stock +',s1.drill.stock-s0.drill.stock,'shards +',s1.drill.shards-s0.drill.shards,'spCount',s1.drill.spCount,'streak',s1.drill.streak,'stats',JSON.stringify(s1.drill.stats));
log('[pointer types seen]',JSON.stringify([...new Set(ptrTypes)]));
// 置いた状態のスクリーンショット（ドラッグして相手のタイルに重ねた状態）
{f=await fx();const [a,c]=f.pairs[0];const A=await center(a),C=await center(c);await pg.mouse.move(A.x,A.y);await pg.mouse.down();await pg.mouse.move(C.x+10,C.y+8,{steps:8});await pg.waitForTimeout(60);
 await pg.screenshot({path:O+'23_fxf_drag_onto_target.png'});log('[drag over] highlighted target',await pg.$eval('#fxfGrid .fxf-tile.over',e=>e.dataset.tileId).catch(()=>null)===c);await pg.mouse.up();await pg.waitForTimeout(520);}
// ===== 3. ミス：体力−20、連続正解0、報酬なし（問題数には数える）=====
{f=await fx();const ids=f.tiles.map(t=>t.id),pair=new Set(f.pairs[0]);let w=null;for(const x of ids)for(const y of ids)if(x<y&&!(pair.has(x)&&pair.has(y))&&!w)w=[x,y];
 const before=await st(),hp0=f.hp;await dragMouse(w[0],w[1]);await pg.waitForTimeout(60);const mid=await fx(),after=await st();
 log('[miss] hp',hp0,'→',mid.hp,'combo',mid.combo,'misses',mid.misses,'| stock +',after.drill.stock-before.drill.stock,'shards +',after.drill.shards-before.drill.shards,'streak',before.drill.streak,'→',after.drill.streak,'spCount',after.drill.spCount);await pg.waitForTimeout(520);}
// すき間で離す → すき間に近いタイルで成立 ／ 盤面の外で離す → 取り消し（本家の boardDropTarget）
{f=await fx();const n=f.misses+f.caught;const A=await center(f.pairs[0][0]);await pg.mouse.move(A.x,A.y);await pg.mouse.down();await pg.mouse.move(A.x,30,{steps:6});await pg.mouse.up();await pg.waitForTimeout(100);
 const g=await fx();log('[drop outside grid] canceled',g.misses+g.caught===n,'same question',g.target===f.target);}
// ===== 4. 途中で閉じても報酬は残る =====
const s2=await st();await pg.locator('#fxfClose').click();await pg.waitForTimeout(200);
log('[close mid-game] panel hidden',!(await pg.isVisible('#fxfPanel')),'drill menu shown',await pg.isVisible('#drillPanel'),'| stock kept',(await st()).drill.stock===s2.drill.stock,'shards kept',(await st()).drill.shards===s2.drill.shards);
await pg.reload();await pg.waitForTimeout(400);let s3=await st();log('[after reload] stock',s3.drill.stock,'shards',s3.drill.shards,'spCount',s3.drill.spCount,'stats S4',JSON.stringify(s3.drill.stats.S4));
{const c=await pg.evaluate(()=>window.__clockseed.towerCenter());await pg.mouse.click(c.x,c.y);await pg.waitForTimeout(200);log('[menu after]',(await pg.locator('#specialBox').innerText()).replace(/\s+/g,' ').slice(0,140));await pg.locator('#drillClose').click();}
// ===== 5. 最後まで（クリア）：15問、結果画面 =====
await openGame();
for(let k=0;k<15;k++){f=await fx();if(f.stage!=='play')break;const [a,c]=f.pairs[0];await dragMouse(a,c);await pg.waitForTimeout(560);}
f=await fx();log('[clear] stage',f.stage,'cleared',f.cleared,'caught',f.caught,'score',f.score,'clearBonus',f.clearBonus,'earned',JSON.stringify(f.earned));
log('[result screen]',(await pg.locator('#fxfBody').innerText()).replace(/\s+/g,' ').slice(0,220));
await pg.screenshot({path:O+'24_fxf_result.png'});
// ===== 6. 体力切れ（時間を進める）：時間切れは報酬なし・連続正解0 =====
await pg.clock.install({time:Date.now()});
await pg.locator('#fxfAgain').click();await pg.clock.runFor(2600);await pg.waitForTimeout(100);
let a0=await st();await pg.clock.runFor(20600);await pg.waitForTimeout(100);f=await fx();let a1=await st();
log('[timeout 20s] timeouts',f.timeouts,'hp',f.hp,'combo',f.combo,'| streak',a0.drill.streak,'→',a1.drill.streak,'stock +',a1.drill.stock-a0.drill.stock,'spCount +',a1.drill.spCount-a0.drill.spCount);
for(let k=0;k<12&&(await fx()).stage==='play';k++){await pg.clock.runFor(10000);await pg.waitForTimeout(30);}
f=await fx();log('[ko] stage',f.stage,'cleared',f.cleared,'hp',f.hp,'| result',(await pg.locator('#fxfBody h2').innerText()));
log('JS errors',errs.length,errs.slice(0,5));
await b.close();})();
