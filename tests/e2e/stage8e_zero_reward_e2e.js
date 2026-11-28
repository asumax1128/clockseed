// 段階8e「不正解ゼロ報酬の固定」と「特殊ドリルボタンの改行修正」の通しテスト
//  ① 通常ドリル A〜E の全ティア：全問不正解のセットを（本物の画面操作で）解き、時短ストック・カケラ（半個の端数も）・即完了チケットの増分がちょうど0、
//     連続正解は0に戻り、結果画面は「時短ストック +0:00」「カケラ +0」でチケットの行は出ない。
//     条件を変えても0：連続正解9（次の正解で出るチケット）／今日120問超（カケラ半分の区間）／時短ストック上限
//     感度の確認：全問正解のセットでは、各難度の報酬（DRILL_REWARD）×5だけ増える（正解時の量は変わっていない）／正解と不正解が混ざれば正解ぶんだけ
//  ② 特殊ドリル：FACTOR×FACTOR のミス・時間切れ・体力切れ、テンパズルのギブアップでは増分0・連続正解0（問題数は数える）。結果・ゲーム中の「ごほうび」表示も +0
//  ③ スマホ縦（390×844・360×740）の特殊ドリルボタン：未解放は1行目にゲーム名・2行目に「町Lv○で解放」（1字ずつ割れない・名前は1行）、解放済みは名前だけ。タブレットは main と同じ
const {chromium}=require('playwright');
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
(async()=>{
const b=await chromium.launch();
const url='file:///home/user/clockseed/index.html?debug=1';const O='/home/user/clockseed/screenshots/';
const log=(...a)=>console.log(...a);let fail=0;const ok=(c,msg,...x)=>{log((c?'合格 ':'不合格 ')+msg,...x);if(!c)fail++;};
const errs=[];
async function boot(w,h,save,{mobile=w<700,dsf=1,u=url,clock=false}={}){
  const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:dsf,hasTouch:true,isMobile:mobile});
  if(save)await ctx.addInitScript(s=>{if(!sessionStorage.getItem('__booted')){sessionStorage.setItem('__booted','1');localStorage.clear();localStorage.setItem('clockseed.save',s);}},JSON.stringify(save));
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  if(clock)await pg.clock.install({time:Date.now()});
  await pg.goto(u);await pg.waitForTimeout(700);return pg;}
const H=(pg,f,...a)=>pg.evaluate(([f,a])=>window.__clockseed[f](...a),[f,a]);
const st=pg=>pg.evaluate(()=>JSON.parse(localStorage.getItem('clockseed.save')));
const clone=x=>JSON.parse(JSON.stringify(x));
let pg0=await boot(1180,820,null);const FRESH=await st(pg0);const CONST=await H(pg0,'constants');await pg0.context().close();
const REWARD=CONST.DRILL_REWARD,SP=CONST.SPECIAL_REWARD;
const today=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());};
function save(over={}){const s=clone(FRESH);s.tutorial.done=true;s.tutorial.step=10;s.townExp=2800;s.gold=5000;
  Object.assign(s.drill,{stock:1000,shards:100,shardHalf:1,tickets:2,streak:9,day:today(),dayCount:3,spDay:'',spCount:0,stats:{}},over.drill||{});return s;}
const snap=s=>({stock:s.drill.stock,shards:s.drill.shards,half:s.drill.shardHalf,tickets:s.drill.tickets,streak:s.drill.streak});
const openMenu=async pg=>{const tp=await H(pg,'towerPos');await H(pg,'lookAt',tp.x,tp.y,1.2);const tc=await H(pg,'towerCenter');await pg.mouse.click(tc.x,tc.y);await pg.waitForTimeout(350);};
// 1セット（5問）を、answers（'ok'｜'ng' の配列）の通りに解く。結果画面の文字を返す
async function playSet(pg,level,answers){
  await pg.locator('.lvbtn').nth('ABCDE'.indexOf(level)).click();await pg.waitForTimeout(150);await pg.locator('#drillStartBtn').click();await pg.waitForTimeout(200);
  const types=[];
  for(let i=0;i<5;i++){await pg.waitForSelector('.choice:not([disabled])',{timeout:6000});const info=await H(pg,'drillSetInfo');types.push(info.set[i].type);
    const k=await H(pg,'drillAnswerIndex');await pg.locator('.choice').nth(answers[i]==='ok'?k:(k+1)%4).click();await pg.waitForTimeout(200);
    if(answers[i]==='ng')await pg.locator('#dqFb button').click();else await pg.waitForTimeout(1000);await pg.waitForTimeout(120);}
  await pg.waitForSelector('.dres',{timeout:6000});
  const text=(await pg.locator('.dres').innerText()).replace(/\s+/g,' ');
  return {text,types,html:await pg.locator('.dres').innerHTML()};}

// ===== ① 通常ドリル A〜E =====
log('--- 通常ドリル：不正解だけを続けた場合 ---');
for(const L of ['A','B','C','D','E']){
  const pg=await boot(1180,820,save());await openMenu(pg);
  const s0=await st(pg);const r=await playSet(pg,L,['ng','ng','ng','ng','ng']);const s1=await st(pg);
  const a=snap(s0),z=snap(s1),nOk=r.types.reduce((m,t)=>m+((s1.drill.stats[t]||{ok:0}).ok-((s0.drill.stats[t]||{ok:0}).ok)),0),nAsked=r.types.length;
  const asked=Object.values(s1.drill.stats).reduce((m,x)=>m+x.n,0)-Object.values(s0.drill.stats).reduce((m,x)=>m+x.n,0);
  ok(z.stock===a.stock&&z.shards===a.shards&&z.half===a.half&&z.tickets===a.tickets&&z.streak===0&&a.streak===9,'[難度'+L+'] 全問不正解：時短ストック '+a.stock+'→'+z.stock+'・カケラ '+a.shards+'（端数 '+a.half+'）→'+z.shards+'（'+z.half+'）・チケット '+a.tickets+'→'+z.tickets+'・連続正解 '+a.streak+'→'+z.streak+'（増分はちょうど0）');
  ok(asked===5&&nOk===0,'[難度'+L+'] 不正解も「出題数」には数える（+'+asked+'問・正解 +'+nOk+'）');
  ok(/5問中 0問 正解/.test(r.text)&&/時短ストック \+0:00/.test(r.text)&&/カケラ \+0(?![.\d])/.test(r.text)&&!/チケット/.test(r.text)&&/連続正解 0問/.test(r.text),'[難度'+L+'] 結果画面：「時短ストック +0:00」「カケラ +0」、チケットの行なし、連続正解 0問',r.text);
  if(L==='A'||L==='E'){await pg.waitForTimeout(1900);await pg.locator('#drillPanel .box').screenshot({path:O+'94_zero_result_'+L+'.png'});}   // 花丸の演出が消えてから撮る
  await pg.context().close();}

// 条件を変えても0：連続正解9（チケット直前）／今日120問超（カケラが半分になる区間）／時短ストック上限／半個の端数が残っている
for(const [name,over] of [['連続正解9（正解ならチケットが出る位置）',{streak:9}],['今日120問超（正解ならカケラが半分の区間）',{dayCount:130}],['時短ストック上限（180分）',{stock:10800}],['カケラの端数が半個＋連続正解9＋120問超',{shardHalf:1,streak:9,dayCount:125}]]){
  for(const L of ['A','C','E']){
    const pg=await boot(1180,820,save({drill:over}));await openMenu(pg);const s0=await st(pg);const r=await playSet(pg,L,['ng','ng','ng','ng','ng']);const s1=await st(pg);
    const a=snap(s0),z=snap(s1);
    ok(z.stock===a.stock&&z.shards===a.shards&&z.half===a.half&&z.tickets===a.tickets&&z.streak===0&&/時短ストック \+0:00/.test(r.text)&&/カケラ \+0(?![.\d])/.test(r.text)&&!/チケット|頭打ち|半分/.test(r.text),'[難度'+L+'・'+name+'] 全問不正解でも増分0・結果画面も +0（上限・半分の注記も出ない）');
    await pg.context().close();}}

// 感度の確認：正解の量は変わっていない／混ざったら正解ぶんだけ
log('--- 感度の確認（正解時の量は変えていない）---');
for(const L of ['A','B','C','D','E']){
  const R=REWARD[L];const pg=await boot(1180,820,save({drill:{streak:0,shardHalf:0,shards:100,stock:1000,tickets:0,dayCount:0}}));await openMenu(pg);const s0=await st(pg);
  const r=await playSet(pg,L,['ok','ok','ok','ok','ok']);const s1=await st(pg);
  ok(s1.drill.stock-s0.drill.stock===5*R.sec&&s1.drill.shards-s0.drill.shards===5*R.shards&&s1.drill.streak===5,'[難度'+L+'] 全問正解：時短ストック +'+(s1.drill.stock-s0.drill.stock)+'（=1問'+R.sec+'秒×5）・カケラ +'+(s1.drill.shards-s0.drill.shards)+'（=1問'+R.shards+'個×5）・連続正解 5',r.text.slice(0,60));
  await pg.context().close();}
{const L='C',R=REWARD[L];const pg=await boot(1180,820,save({drill:{streak:0,shardHalf:0,shards:100,stock:1000,tickets:0,dayCount:0}}));await openMenu(pg);const s0=await st(pg);
 const r=await playSet(pg,L,['ng','ok','ng','ok','ok']);const s1=await st(pg);
 ok(s1.drill.stock-s0.drill.stock===3*R.sec&&s1.drill.shards-s0.drill.shards===3*R.shards&&s1.drill.streak===2,'[難度C] 不正解2＋正解3：増えるのは正解3問ぶんだけ（+'+(s1.drill.stock-s0.drill.stock)+'秒・カケラ +'+(s1.drill.shards-s0.drill.shards)+'・連続正解 '+s1.drill.streak+'）');await pg.context().close();}

// ===== ② 特殊ドリル =====
log('--- 特殊ドリル ---');
{const pg=await boot(1180,820,save(),{clock:true});await openMenu(pg);
 const s0=await st(pg);await pg.locator('[data-sp="FXF"]').click();await pg.waitForTimeout(200);await pg.locator('#fxfStart').click();await pg.clock.runFor(2600);await pg.waitForTimeout(150);
 const center=id=>H(pg,'fxfTileCenter',id);
 // ミス：組にならない2枚を重ねる（組でない2枚が見つかるまで）
 let misses=0;
 for(let k=0;k<3;k++){const f=await H(pg,'fxf');if(f.stage!=='play'||f.phase!=='playing')break;const pairs=f.pairs.map(p=>p.join('|')),ids=f.tiles.map(t=>t.id);let a=null,c=null;
   for(const x of ids){for(const y of ids){if(x!==y&&!pairs.includes(x+'|'+y)&&!pairs.includes(y+'|'+x)){a=x;c=y;break;}}if(a)break;}
   if(!a)break;const A=await center(a),C=await center(c);await pg.mouse.move(A.x,A.y);await pg.mouse.down();await pg.mouse.move((A.x+C.x)/2,(A.y+C.y)/2,{steps:4});await pg.mouse.move(C.x,C.y,{steps:4});await pg.mouse.up();await pg.clock.runFor(900);await pg.waitForTimeout(80);misses++;}
 let f=await H(pg,'fxf'),s1=await st(pg);
 ok(misses>=1&&f.misses>=1&&snap(s1).stock===snap(s0).stock&&snap(s1).shards===snap(s0).shards&&snap(s1).half===snap(s0).half&&snap(s1).tickets===snap(s0).tickets&&snap(s1).streak===0&&f.earned.sec===0&&f.earned.shards===0&&f.earned.ok===0,'[FACTOR×FACTOR] ミス '+f.misses+'回：時短ストック・カケラ・チケットの増分0、連続正解 9→'+s1.drill.streak+'、ゲーム中の「ごほうび」も +0（出題数 +'+(s1.drill.stats.S4||{n:0}).n+'）');
 const earnLine=(await pg.locator('#fxfEarn').innerText()).replace(/\s+/g,' ');ok(/\+0:00/.test(earnLine)&&/\+0$/.test(earnLine.trim()),'[FACTOR×FACTOR] ゲーム中の表示も「+0:00」「+0」',earnLine);
 // 時間切れ（20秒何もしない）→ 体力切れまで
 const t0=await st(pg);await pg.clock.runFor(20600);await pg.waitForTimeout(100);f=await H(pg,'fxf');const t1=await st(pg);
 ok(f.timeouts>=1&&snap(t1).stock===snap(t0).stock&&snap(t1).shards===snap(t0).shards&&snap(t1).tickets===snap(t0).tickets&&snap(t1).streak===0,'[FACTOR×FACTOR] 時間切れ '+f.timeouts+'回：増分0');
 for(let k=0;k<14&&(await H(pg,'fxf')).stage==='play';k++){await pg.clock.runFor(10000);await pg.waitForTimeout(40);}
 f=await H(pg,'fxf');const s2=await st(pg);const res=(await pg.locator('#fxfBody').innerText()).replace(/\s+/g,' ');
 ok(f.stage==='result'&&!f.cleared&&snap(s2).stock===snap(s0).stock&&snap(s2).shards===snap(s0).shards&&snap(s2).half===snap(s0).half&&snap(s2).tickets===snap(s0).tickets&&snap(s2).streak===0&&/時短 \+0:00/.test(res)&&/カケラ \+0(?![.\d])/.test(res),'[FACTOR×FACTOR] 体力切れまで何も正解しない：増分ちょうど0・結果画面「時短 +0:00」「カケラ +0」',res.slice(res.indexOf('ごほうび'),res.indexOf('ごほうび')+40));
 await pg.screenshot({path:O+'95_zero_result_fxf.png'});await pg.context().close();}
{const pg=await boot(1180,820,save());await openMenu(pg);const s0=await st(pg);
 await pg.locator('[data-sp="TP"]').click();await pg.waitForTimeout(200);await pg.locator('.tp-tier[data-tier="入門"]').click();await pg.locator('[data-mode="A"]').click();await pg.locator('#tpGo').click();await pg.waitForTimeout(250);
 await pg.locator('#tpGive').click();await pg.waitForTimeout(250);const s1=await st(pg),t=await H(pg,'tp');
 ok(t.done==='gaveup'&&snap(s1).stock===snap(s0).stock&&snap(s1).shards===snap(s0).shards&&snap(s1).half===snap(s0).half&&snap(s1).tickets===snap(s0).tickets&&snap(s1).streak===0&&t.earned.sec===0&&t.earned.shards===0&&t.earned.ok===0&&(s1.drill.stats.S5||{n:0}).n===1&&(s1.drill.stats.S5||{ok:0}).ok===0,'[テンパズル] ギブアップ：時短ストック・カケラ・チケットの増分0、連続正解 9→'+s1.drill.streak+'（問題数は +1、正解は +0）');
 const earn=(await pg.locator('#tpEarn').innerText()).replace(/\s+/g,' ');ok(/\+0:00/.test(earn)&&/\+0 /.test(earn+' '),'[テンパズル] 結果の「ごほうび」表示も「+0:00」「+0」',earn);
 await pg.screenshot({path:O+'96_zero_result_tp.png'});await pg.context().close();}

// ===== ③ スマホ縦の特殊ドリルボタン =====
log('--- スマホ縦の特殊ドリルボタン ---');
for(const [w,h,name,key] of [[390,844,'390×844','a'],[360,740,'360×740','b']]){
  for(const [lv,tag,lab] of [[2,'locked','未解放2つ（町Lv2）'],[3,'one','FACTOR×FACTOR だけ解放（町Lv3）'],[4,'open','解放済み2つ（町Lv4）']]){
    const s=save();s.townExp=[0,30,120,300][lv-1];const pg=await boot(w,h,s);const tp=await H(pg,'towerPos');await H(pg,'lookAt',tp.x,tp.y,1.0);const tc=await H(pg,'towerCenter');await pg.touchscreen.tap(tc.x,tc.y);await pg.waitForTimeout(400);
    const m=await pg.evaluate(()=>[...document.querySelectorAll('#specialBox .spbtns .tool')].map(e=>{const bt=e.getBoundingClientRect(),b=e.querySelector('b'),sm=e.querySelector('small'),br=b.getBoundingClientRect(),vis=sm&&getComputedStyle(sm).display!=='none',sr=vis?sm.getBoundingClientRect():null;
      const lines=el=>{const cs=getComputedStyle(el),lh=parseFloat(cs.lineHeight)||parseFloat(cs.fontSize)*1.25;return Math.round(el.getBoundingClientRect().height/lh);};
      return {name:b.innerText.replace(/\s+/g,''),sub:vis?sm.innerText.trim():'',w:Math.round(bt.width),h:Math.round(bt.height),nameLines:lines(b),subLines:vis?lines(sm):0,nameFits:b.scrollWidth<=e.clientWidth&&br.right<=bt.right+0.5&&br.left>=bt.left-0.5,subFits:!vis||(sr.right<=bt.right+0.5&&sr.left>=bt.left-0.5),subBelow:!vis||sr.top>=br.bottom-1,subW:vis?Math.round(sr.width):0,dis:e.disabled};}));
    const want=[lv>=3,lv>=4];
    const good=m.length===2&&m.every((x,i)=>x.nameLines===1&&x.nameFits&&x.subFits&&x.subBelow&&x.h>=44&&(want[i]?x.sub===''&&!x.dis:(x.sub===['町Lv3で解放','町Lv4で解放'][i]&&x.subLines===1&&x.subW>=50&&x.dis)))&&m[0].name==='FACTOR×FACTOR'&&m[1].name==='テンパズル';
    ok(good,'['+name+'・'+lab+'] 1行目にゲーム名（1行）・'+(lv<4?'未解放は2行目に「町Lv○で解放」（1字ずつ割れない）':'名前だけ')+'で崩れない',JSON.stringify(m.map(x=>[x.name,x.sub,x.w+'×'+x.h,'名'+x.nameLines+'行','副'+x.subLines+'行'])));
    await pg.locator('#specialBox').screenshot({path:O+'97_special_buttons_phone_'+key+'_'+tag+'.png'});await pg.context().close();}}
// タブレットは main と同じ
{const mainFile=path.join(os.tmpdir(),'clockseed_main_8e_index.html');
 try{fs.writeFileSync(mainFile,cp.execSync('git show origin/main:index.html',{cwd:'/home/user/clockseed',maxBuffer:64e6}));}catch(e){log('main の index.html を用意できません',e.message);}
 const mainUrl='file://'+mainFile+'?debug=1';
 for(const lv of [2,3,4]){for(const [w,h] of [[1180,820],[768,1024]]){
   const snapT=async u=>{const s=save();s.townExp=[0,30,120,300][lv-1];const pg=await boot(w,h,s,{mobile:false,u});await openMenu(pg);const png=await pg.locator('#specialBox').screenshot({animations:'disabled'});const txt=(await pg.locator('#specialBox').innerText()).replace(/\s+/g,' ');await pg.context().close();return {png,txt};};
   const a=await snapT(mainUrl),n=await snapT(url);
   ok(a.txt===n.txt&&Buffer.compare(a.png,n.png)===0,'[タブレット '+w+'×'+h+'・町Lv'+lv+'] 特殊ドリルの欄が main と1ピクセルも違わない（文字も同じ）');}}}

ok(errs.length===0,'[JS エラー] 0件',errs.slice(0,3));
log(fail?'\n=> 不合格 '+fail+'件':'\n=> 全て合格');
await b.close();process.exit(fail?1:0);
})();
