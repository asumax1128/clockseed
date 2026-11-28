const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1180,height:820},deviceScaleFactor:2,hasTouch:true,isMobile:false});
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
const url='file:///home/user/clockseed/index.html?debug=1&intro=0';const O='/home/user/clockseed/screenshots/';
const log=(...a)=>console.log(...a);
const st=()=>pg.evaluate(()=>JSON.parse(localStorage.getItem('clockseed.save')));
const tp=()=>pg.evaluate(()=>window.__clockseed.tp());
const ptr=[];await pg.exposeFunction('__ptr',t=>ptr.push(t));
// 答えの一例から、カードの合体の手順を作る（本家と同じ：1枚目の位置に結果、2枚目は消える）
function plan(digits,example){
  const toks=example.replace(/−/g,'-').match(/\d+|[-+×÷()]/g);let p=0;
  const expr=()=>{let a=term();while(toks[p]==='+'||toks[p]==='-'){const o=toks[p++];a=[o,a,term()];}return a;};
  const term=()=>{let a=fac();while(toks[p]==='×'||toks[p]==='÷'){const o=toks[p++]==='×'?'*':'/';a=[o,a,fac()];}return a;};
  const fac=()=>{const t=toks[p++];if(t==='('){const a=expr();p++;return a;}return ['n',+t];};
  const tree=expr();const cards=digits.map(d=>({d,used:false}));const acts=[];
  const red=nd=>{if(nd[0]==='n'){const c=cards.find(c=>c.d===nd[1]&&!c.used);c.used=true;return c;}const a=red(nd[1]),bb=red(nd[2]);const i=cards.indexOf(a),j=cards.indexOf(bb);acts.push([i,nd[0],j]);const nc={d:null,used:true};cards[i]=nc;cards.splice(j,1);return nc;};
  red(tree);return acts;}
const tapCard=i=>pg.locator('#tpCards .tp-card').nth(i).tap();
const tapOp=op=>pg.locator('.tp-op[data-op="'+op+'"]').tap();
async function solve(mode){const s=await tp();for(const [i,op,j] of plan(s.digits,s.example)){if(mode==='A'){await tapCard(i);await tapOp(op);await tapCard(j);}else{await tapCard(i);await tapCard(j);await tapOp(op);}}return s;}
const openTp=async()=>{const c=await pg.evaluate(()=>window.__clockseed.towerCenter());await pg.mouse.click(c.x,c.y);await pg.waitForTimeout(200);await pg.locator('[data-sp="TP"]').tap();await pg.waitForTimeout(150);};
await pg.goto(url);await pg.waitForTimeout(400);
// 段階7：特殊ドリルは町Lv4 で解放。町Lv4（チュートリアル済み）のセーブから始める
await pg.evaluate(()=>{const s=JSON.parse(localStorage.getItem('clockseed.save'));s.townExp=300;s.tutorial.done=true;s.tutorial.step=10;localStorage.setItem('clockseed.save',JSON.stringify(s));});await pg.reload();await pg.waitForTimeout(400);
await pg.evaluate(()=>document.addEventListener('pointerdown',e=>window.__ptr(e.pointerType),true));
// ===== 1. 特殊ドリルは2本 =====
{const c=await pg.evaluate(()=>window.__clockseed.towerCenter());await pg.mouse.click(c.x,c.y);await pg.waitForTimeout(200);
 log('[menu] special buttons',JSON.stringify(await pg.$$eval('#specialBox .spbtns button',x=>x.map(e=>e.innerText.replace(/\s+/g,' ')))));await pg.locator('#drillClose').click();}
// ===== 2. 難易度選択 =====
await openTp();await pg.screenshot({path:O+'25_tp_difficulty_select.png'});
log('[select]',JSON.stringify(await pg.$$eval('.tp-tier',x=>x.map(e=>e.innerText.replace(/\s+/g,' ')))));
await pg.locator('.tp-tier[data-tier="入門"]').tap();await pg.locator('[data-mode="A"]').tap();await pg.locator('#tpGo').tap();await pg.waitForTimeout(100);
// ===== 3. タッチで解く（操作方法A）：1問ごとに報酬 =====
const s0=await st();const rows=[];
for(let k=0;k<3;k++){const b0=await st();const s=await solve('A');const t=await tp();const a=await st();rows.push('A '+s.tier+' '+s.digits.join('')+' 例 '+s.example+' → '+t.done+' +'+(a.drill.stock-b0.drill.stock)+'秒 カケラ+'+(a.drill.shards-b0.drill.shards));
 if(k===2)await pg.screenshot({path:O+'27_tp_solved.png'});await pg.locator('#tpNext').tap();}
// 式を組み立てている途中のスクリーンショット（数字→記号まで）
{const s=await tp();const [i,op]=plan(s.digits,s.example)[0];await tapCard(i);await tapOp(op);await pg.screenshot({path:O+'26_tp_play_building.png'});log('[building] expr',(await pg.locator('#tpExpr').innerText()).trim(),'guide',(await pg.locator('.tp-guide').innerText()).trim());
 await tapCard(i);}   // 同じ数字をもう一度で取り消し
// 10にならない式 → 報酬なし・1手戻す／リセットで解き直し → 報酬
{const s=await tp();const b0=await st();await tapCard(0);await tapOp('+');await tapCard(1);await tapCard(0);await tapOp('+');await tapCard(1);await tapCard(0);await tapOp('+');await tapCard(1);
 let t=await tp();const a1=await st();const sum=s.digits.reduce((x,y)=>x+y,0);rows.push('A 全部たす '+s.digits.join('')+' → '+t.cards.join(',')+' 「'+t.msg+'」 done '+t.done+' 報酬 +'+(a1.drill.stock-b0.drill.stock)+' spCount +'+(a1.drill.spCount-b0.drill.spCount));
 await pg.locator('#tpUndo').tap();t=await tp();rows.push('  1手戻す → '+t.cards.join(','));await pg.locator('#tpReset').tap();t=await tp();rows.push('  リセット → '+t.cards.join(','));
 await solve('A');t=await tp();const a2=await st();rows.push('  解き直し → '+t.done+' +'+(a2.drill.stock-a1.drill.stock)+'秒');await pg.locator('#tpNext').tap();}
// 操作方法B（数字2枚 → 記号）
await pg.locator('#tpTier').tap();await pg.locator('.tp-tier[data-tier="初級"]').tap();await pg.locator('[data-mode="B"]').tap();await pg.locator('#tpGo').tap();
for(let k=0;k<2;k++){const b0=await st();const s=await solve('B');const t=await tp();const a=await st();rows.push('B '+s.tier+' '+s.digits.join('')+' → '+t.done+' +'+(a.drill.stock-b0.drill.stock)+'秒 カケラ+'+(a.drill.shards-b0.drill.shards));await pg.locator('#tpNext').tap();}
await pg.locator('#tpTier').tap();await pg.locator('.tp-tier[data-tier="中級"]').tap();await pg.locator('[data-mode="A"]').tap();await pg.locator('#tpGo').tap();
{const b0=await st();const s=await solve('A');const t=await tp();const a=await st();rows.push('A '+s.tier+' '+s.digits.join('')+' → '+t.done+' +'+(a.drill.stock-b0.drill.stock)+'秒 カケラ+'+(a.drill.shards-b0.drill.shards));await pg.locator('#tpNext').tap();}
rows.forEach(r=>log('  ',r));
let s1=await st();log('[after 7 solves] stock +',s1.drill.stock-s0.drill.stock,'shards +',s1.drill.shards-s0.drill.shards,'spCount',s1.drill.spCount,'streak',s1.drill.streak,'stats S5',JSON.stringify(s1.drill.stats.S5),'earned',JSON.stringify((await tp()).earned));
// ===== 4. 別の問題へ（解かずに）→ 何も起きない =====
{const b0=await st();const k0=(await tp()).key;await pg.locator('#tpSkip').tap();const a=await st();log('[skip] new problem',(await tp()).key!==k0,'| stock +',a.drill.stock-b0.drill.stock,'spCount +',a.drill.spCount-b0.drill.spCount,'streak',b0.drill.streak,'→',a.drill.streak);}
// ===== 5. ギブアップ：報酬なし・連続正解0・答えを表示 =====
{const b0=await st();const s=await tp();await pg.locator('#tpGive').tap();const a=await st();const t=await tp();
 log('[give up] done',t.done,'| shown',(await pg.locator('#tpDone').innerText()).replace(/\s+/g,' '),'| stock +',a.drill.stock-b0.drill.stock,'shards +',a.drill.shards-b0.drill.shards,'streak',b0.drill.streak,'→',a.drill.streak,'spCount +',a.drill.spCount-b0.drill.spCount,'cards disabled',await pg.locator('#tpCards .tp-card').first().isDisabled());
 await pg.screenshot({path:O+'28_tp_give_up.png'});await pg.locator('#tpNext').tap();}
// 1問解いて、途中まで組み立てたまま閉じる
{const b0=await st();await solve('A');await pg.locator('#tpNext').tap();const s=await tp();const [i,op,j]=plan(s.digits,s.example)[0];await tapCard(i);await tapOp(op);await tapCard(j);const mid=await st();
 log('[solve then partial] stock +',mid.drill.stock-b0.drill.stock,'cards now',(await tp()).cards.join(','));}
const s2=await st();await pg.locator('#tpClose').tap();await pg.waitForTimeout(150);
log('[close mid-problem] panel hidden',!(await pg.isVisible('#tpPanel')),'drill menu',await pg.isVisible('#drillPanel'),'| stock kept',(await st()).drill.stock===s2.drill.stock,'shards kept',(await st()).drill.shards===s2.drill.shards);
await pg.reload();await pg.waitForTimeout(400);const s3=await st();log('[after reload] stock +',s3.drill.stock-s0.drill.stock,'shards +',s3.drill.shards-s0.drill.shards,'spCount',s3.drill.spCount,'stats S5',JSON.stringify(s3.drill.stats.S5));
log('[pointer types]',JSON.stringify([...new Set(ptr)]));
log('JS errors',errs.length,errs.slice(0,5));
await b.close();})();
