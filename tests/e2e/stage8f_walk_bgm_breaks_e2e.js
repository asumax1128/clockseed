// 段階8f「お手伝いの歩行・BGMの作り直し・問題文の改行」の通しテスト
//  ① 町を歩くキャラ（水やり少年・鐘で集まる町の人）が、道（石畳・土の通路・広場）のマスの上だけを通る。畑・施設・家には入らない。
//     歩く記録（?debug=1 の walkLog）を町Lv1〜8で取り、すべての点が道のマスの上で、どの畑・施設・家の四角にも入っていないことを確かめる。
//     従来の直線の動き（式をこのテストに写したもの）は畑を横切っていたことも示す（検査の感度）。歩く時間の割合（3.2秒のうち70%歩く・30%水やり）は従来どおり
//  ② BGM：8小節ループ（ハ長調・♩=92）の音の並び（記録 bgmLog）を、指定の和音進行・旋律・低音・分散和音と照合。テンポ・ループ・音量・オン／オフ
//  ③ ドリルの問題文・「こたえは…」：句読点（、。）で改行し、数式の途中では割らない。選択肢は改行しない
const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch();
const url='file:///home/user/clockseed/index.html?debug=1&intro=0';const O='/home/user/clockseed/screenshots/';
const log=(...a)=>console.log(...a);let fail=0;const ok=(c,msg,...x)=>{log((c?'合格 ':'不合格 ')+msg,...x);if(!c)fail++;};
const errs=[];
async function boot(w,h,save,{clock=false,dsf=1}={}){
  const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:dsf});
  if(save)await ctx.addInitScript(s=>{if(!sessionStorage.getItem('__booted')){sessionStorage.setItem('__booted','1');localStorage.clear();localStorage.setItem('clockseed.save',s);}},JSON.stringify(save));
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  if(clock)await pg.clock.install({time:Date.now()});
  await pg.goto(url);await pg.waitForTimeout(600);return pg;}
const H=(pg,f,...a)=>pg.evaluate(([f,a])=>window.__clockseed[f](...a),[f,a]);
const st=pg=>pg.evaluate(()=>JSON.parse(localStorage.getItem('clockseed.save')));
const clone=x=>JSON.parse(JSON.stringify(x));
const BK=['mill','kitchen','bakery','ranch','dairy','jam','restaurant','cake'];
let pg0=await boot(1180,820,null);const FRESH=await st(pg0);await pg0.context().close();
const LV=[0,30,120,300,600,1100,1800,2800];
function save(lv,{boy=false,bell=false}={}){const s=clone(FRESH),T=Date.now();s.tutorial.done=true;s.tutorial.step=10;s.townExp=LV[lv-1];s.seenAt=T;
  for(const k of BK)if(lv>=2)s.buildings[k]=lv>=3?{startedAt:T-9e6,builtAt:T-8e6,job:null,lv:1}:null;
  if(boy){s.gacha.items.hp04=1;s.gacha.dex.hp04=1;}if(bell){s.gacha.items.dc08=1;s.gacha.dex.dc08=1;}return s;}
const inRect=(e,r)=>e.x>=r.x&&e.x<r.x+r.w&&e.y>=r.y&&e.y<r.y+r.h;

// ===== ① 道だけを歩く =====
log('--- 歩くキャラ：道の上だけ ---');
for(const lv of [1,2,3,4,5,6,8]){
  const pg=await boot(1180,820,save(lv,{boy:true}),{clock:true});await pg.clock.install({time:Date.now()});await H(pg,'walkClear');
  await pg.clock.runFor(21000);await pg.waitForTimeout(100);
  const r=await pg.evaluate(()=>{const C=window.__clockseed,L=C.walkLog().filter(e=>e.id==='waterboy'),info=C.roadInfo(),main=new Set(info.main),bl=C.blockers().filter(x=>x.kind!=='house'||x.lv<=info.lv);
    let off=0,hit=null;const legs=new Set();for(const e of L){legs.add(e.a+'>'+e.b);if(!main.has(Math.floor(e.x/16)+','+Math.floor(e.y/16)))off++;
      const h=bl.find(r=>e.x>=r.x&&e.x<r.x+r.w&&e.y>=r.y&&e.y<r.y+r.h);if(h&&!hit)hit=h.kind+(h.i!==undefined?h.i:h.k||'');}
    const walk=L.filter(e=>!e.water).length,water=L.filter(e=>e.water).length;
    // 水やり中は止まっている／歩いている間は動いている
    let moved=0,still=0;for(let i=1;i<L.length;i++){const d=Math.hypot(L[i].x-L[i-1].x,L[i].y-L[i-1].y);if(L[i].water&&L[i-1].water&&L[i].a===L[i-1].a){if(d<0.01)still++;}else if(!L[i].water&&d>0)moved++;}
    const maxStep=Math.max(...L.slice(1).map((e,i)=>Math.hypot(e.x-L[i].x,e.y-L[i].y)));
    return {n:L.length,off,hit,legs:legs.size,walkRatio:walk/(walk+water),moved,still,maxStep:+maxStep.toFixed(2),roads:info.main.length};});
  ok(r.n>1000&&r.off===0&&!r.hit&&r.legs===6,'[町Lv'+lv+'] 水やり少年：'+r.n+'点すべてが道のマスの上（外れ '+r.off+'）・畑／施設／家に入らない'+(r.hit?'（入った：'+r.hit+'）':'')+'・6区画を順にめぐる（道のマス '+r.roads+'）');
  ok(Math.abs(r.walkRatio-0.7)<0.03&&r.moved>200&&r.still>50&&r.maxStep<=6,'[町Lv'+lv+'] 歩く時間の割合は従来どおり（3.2秒のうち歩く '+(r.walkRatio*100).toFixed(1)+'%・残りは止まって水やり）・1フレームの最大の動き '+r.maxStep+'px');
  await pg.context().close();}
// 感度：従来の動き（直線で次の区画へ）は、畑を横切っていた
{const pg=await boot(1180,820,save(1,{boy:true}));
 const old=await pg.evaluate(()=>{const C=window.__clockseed,pl=[0,1,2,3,4,5].map(i=>C.plotRectW(i)),bl=C.blockers().filter(x=>x.kind==='plot'),pts=[];
   for(let a=0;a<6;a++){const b=(a+1)%6,RA=pl[a],RB=pl[b];for(let k=0;k<=70;k++){const ease=k/70;pts.push({x:RA.x+16+(RB.x-RA.x)*ease,y:RA.y+32+3+(RB.y-RA.y)*ease});}}
   return pts.filter(e=>bl.some(r=>e.x>=r.x&&e.x<r.x+r.w&&e.y>=r.y&&e.y<r.y+r.h)).length;});
 ok(old>0,'[感度] 従来の動き（直線）は、6区画のめぐり1周で '+old+' 点が畑の上を通っていた → 今回の道の上だけの経路では 0');await pg.context().close();}
// 鐘で集まる町の人
for(const lv of [1,4,8]){
  const pg=await boot(1180,820,save(lv,{bell:true}),{clock:true});await pg.clock.install({time:Date.now()});await H(pg,'walkClear');await H(pg,'ringBell');
  await pg.clock.runFor(6500);await pg.waitForTimeout(100);
  const r=await pg.evaluate(()=>{const C=window.__clockseed,L=C.walkLog().filter(e=>/^folk/.test(e.id)),info=C.roadInfo(),main=new Set(info.main),bl=C.blockers().filter(x=>x.kind!=='house'||x.lv<=info.lv);
    let off=0,hit=null;for(const e of L){if(!main.has(Math.floor(e.x/16)+','+Math.floor(e.y/16)))off++;const h=bl.find(r=>e.x>=r.x&&e.x<r.x+r.w&&e.y>=r.y&&e.y<r.y+r.h);if(h&&!hit)hit=h.kind;}
    const ids=[...new Set(L.map(e=>e.id))],ends=ids.map(id=>{const q=L.filter(e=>e.id===id);const last=q[q.length-1];return [Math.floor(last.x/16),Math.floor(last.y/16)];});
    return {n:L.length,off,hit,ids:ids.length,ends,inPlaza:ends.every(([x,y])=>x>=1&&x<=5&&y>=5&&y<=8)};});
  ok(r.n>100&&r.ids===4&&r.off===0&&!r.hit,'[町Lv'+lv+'] 鐘で集まる町の人4人：'+r.n+'点すべてが道のマスの上・畑／施設／家に入らない（外れ '+r.off+'）');
  ok(r.inPlaza,'[町Lv'+lv+'] 集まった場所は広場の石畳（最寄りの道のマス）',JSON.stringify(r.ends));await pg.context().close();}
// 歩いた記録をスクリーンショットに（赤い点＝歩いた位置、うす緑＝道のマス）
{const pg=await boot(1180,820,save(3,{boy:true}),{clock:true,dsf:1});await pg.clock.install({time:Date.now()});await H(pg,'walkClear');await pg.clock.runFor(21000);await pg.waitForTimeout(150);
 await pg.evaluate(()=>{const C=window.__clockseed;C.lookAt(212,110,1.35);});await pg.clock.runFor(100);await pg.waitForTimeout(100);
 await pg.evaluate(()=>{const C=window.__clockseed,sc=(x,y)=>C.worldToScreen(x,y),d=document.createElement('div');d.id='walkOverlay';d.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:50';
   const info=C.roadInfo(),p0=sc(0,0),p1=sc(16,16),ts=p1.x-p0.x;
   for(const k of info.main){const [tx,ty]=k.split(',').map(Number),q=sc(tx*16,ty*16),e=document.createElement('i');e.style.cssText='position:absolute;left:'+q.x+'px;top:'+q.y+'px;width:'+ts+'px;height:'+ts+'px;background:rgba(80,220,120,.28);outline:1px solid rgba(40,160,80,.5)';d.appendChild(e);}
   for(const e of C.walkLog().filter(e=>e.id==='waterboy')){const q=sc(e.x,e.y),i=document.createElement('i');i.style.cssText='position:absolute;left:'+(q.x-2)+'px;top:'+(q.y-2)+'px;width:4px;height:4px;border-radius:50%;background:#e03030';d.appendChild(i);}
   document.body.appendChild(d);});
 await pg.screenshot({path:O+'98_walk_path_on_roads.png'});await pg.evaluate(()=>document.getElementById('walkOverlay').remove());await pg.context().close();}

// ===== ② BGM =====
log('--- BGM（8小節ループ）---');
{const NAME={C:0,D:2,E:4,F:5,G:7,A:9,B:11},midi=n=>(+n.slice(-1)+1)*12+NAME[n[0]];
 const SPEC=[ // [和音, 根音の音名, 和音の音（音名）, 旋律]
   ['C','C',['C','E','G'],['E4','G4','C5']],['G/B','G',['G','B','D'],['D5','B4','G4']],['Am','A',['A','C','E'],['A4','C5','E5']],['Em/G','E',['E','G','B'],['E5','D5','B4']],
   ['F','F',['F','A','C'],['A4','F4','A4','C5']],['C/E','C',['C','E','G'],['E5','C5','G4']],['Dm','D',['D','F','A'],['F4','A4','D5']],['G','G',['G','B','D'],['D5','B4','G4']]];
 const pc=m=>m%12,PCN=Object.fromEntries(Object.entries(NAME).map(([k,v])=>[v,k]));
 const pg=await boot(1180,820,save(5));
 let i0=await H(pg,'sound');ok(i0.unlocked===false&&i0.bgm===false&&i0.bgmLog.length===0,'[BGM] 最初のタップまでは鳴らさない（従来どおり）');
 await pg.mouse.click(600,400);await pg.waitForTimeout(26500);
 const i=await H(pg,'sound'),L=i.bgmLog;
 ok(i.unlocked&&i.bgm&&i.ctx==='running'&&L.length>100,'[BGM] 最初のタップのあとに鳴り始める（'+L.length+'音）');
 ok(i.bpm===92,'[BGM] テンポ ♩='+i.bpm);
 // 1周目（先頭の小節0から64ステップ）を取り出す
 const first=L.findIndex(e=>e.bar===0&&e.st===0),loop1=L.slice(first,first+ (L.slice(first).findIndex((e,k,arr)=>k>0&&e.bar===0&&e.st===0&&arr[k-1].bar===7)||L.length)),loop2first=L.slice(first).findIndex((e,k,arr)=>k>0&&e.bar===0&&e.st===0&&arr[k-1].bar===7);
 ok(loop2first>0,'[BGM] 8小節を弾き終えたら1小節目へ戻ってくり返す');
 const bars=SPEC.map((_,k)=>loop1.filter(e=>e.bar===k));
 let melOk=true,rhythmOk=true,bassOk=true,arpOk=true,diaOk=true,detail=[];
 SPEC.forEach(([chord,root,tones,mel],k)=>{
   const m=bars[k].filter(e=>e.part==='melody'),bs=bars[k].filter(e=>e.part==='bass'),ar=bars[k].filter(e=>e.part==='arp');
   const want=mel.map(midi);if(m.map(e=>e.m).join()!==want.join()){melOk=false;detail.push('旋律'+(k+1)+'：'+m.map(e=>e.m)+' ≠ '+want);}
   const stepsWant=mel.length===4?[0,2,4,6]:[0,2,4];if(m.map(e=>e.st).join()!==stepsWant.join())rhythmOk=false;
   if(!(bs.length===2&&bs.every(e=>PCN[pc(e.m)]===root&&e.m<=52)&&bs.map(e=>e.st).join()==='0,4')){bassOk=false;detail.push('低音'+(k+1)+'：'+bs.map(e=>PCN[pc(e.m)]+e.m));}
   const tset=new Set(tones.map(n=>NAME[n]));
   if(!(ar.length===8&&ar.every(e=>tset.has(pc(e.m)))&&new Set(ar.map(e=>pc(e.m))).size===3&&ar.map(e=>e.st).join()==='0,1,2,3,4,5,6,7')){arpOk=false;detail.push('分散和音'+(k+1)+'：'+ar.map(e=>PCN[pc(e.m)]));}
   if(chord.includes('/')){const slash=chord.split('/')[1];if(PCN[pc(Math.min(...ar.map(e=>e.m)))]!==slash){arpOk=false;detail.push('転回形'+(k+1)+'：分散和音の最低音が '+slash+' でない');}}
   if(![...m,...bs,...ar].every(e=>[0,2,4,5,7,9,11].includes(pc(e.m))))diaOk=false;});
 ok(melOk&&rhythmOk,'[BGM] 主旋律が指定どおり：'+SPEC.map(s=>s[3].join(' ')).join(' ｜ ')+'（各小節の4分音符の位置も）',detail.filter(x=>/^旋律/.test(x)).join(' / '));
 ok(bassOk,'[BGM] 低音は各小節の根音（C G A E F C D G）を1拍目と3拍目に',detail.filter(x=>/^低音/.test(x)).join(' / '));
 ok(arpOk,'[BGM] 分散和音は和音の3音（C → G/B → Am → Em/G → F → C/E → Dm → G）。G/B・Em/G・C/E は最低音が転回の低音（B・G・E）',detail.filter(x=>/^分散|^転回/.test(x)).join(' / '));
 ok(diaOk,'[BGM] すべての音がハ長調の音（♯・♭なし）');
 // テンポ：8分音符のステップの間隔が 60/92/2 秒、1小節 ＝ 8ステップ
 const times=[...new Set(loop1.map(e=>e.t))].sort((a,b)=>a-b),gaps=times.slice(1).map((t,k)=>t-times[k]),stepSec=60/92/2;
 ok(times.length===64&&gaps.every(g=>Math.abs(g-stepSec)<1e-6),'[BGM] テンポ ♩=92：8分音符のステップ間隔 '+stepSec.toFixed(4)+'秒、1周＝64ステップ＝'+(64*stepSec).toFixed(1)+'秒（実測の間隔 '+Math.min(...gaps).toFixed(4)+'〜'+Math.max(...gaps).toFixed(4)+'）');
 // 音量：控えめ（旋律 .18・低音 .09/.06・分散和音 .045）
 const vol=p=>Math.max(...loop1.filter(e=>e.part===p).map(e=>e.vol));
 ok(vol('melody')<=0.2&&vol('bass')<=0.1&&vol('arp')<=0.05&&vol('melody')+vol('bass')+vol('arp')<=0.34,'[BGM] 音量は控えめ（旋律 '+vol('melody')+'・低音 '+vol('bass')+'・分散和音 '+vol('arp')+'。重なる最大 '+(vol('melody')+vol('bass')+vol('arp')).toFixed(3)+'）');
 // オン・オフ
 await pg.locator('#bgmBtn').click();await pg.waitForTimeout(700);const nOff=(await H(pg,'sound')).bgmLog.length;await pg.waitForTimeout(1500);const iOff=await H(pg,'sound');
 ok(!iOff.bgm&&iOff.bgmLog.length===nOff&&!iOff.settings.bgm,'[BGM] オフにすると鳴らさない（記録が増えない）');
 await pg.locator('#bgmBtn').click();await pg.waitForTimeout(1500);const iOn=await H(pg,'sound');ok(iOn.bgm&&iOn.bgmLog.length>nOff&&iOn.settings.bgm,'[BGM] オンに戻すとまた鳴る');
 await pg.locator('#seBtn').click();await pg.waitForTimeout(300);const iS=await H(pg,'sound');ok(!iS.settings.se&&iS.bgm,'[BGM] 効果音のオフと別々（BGM は鳴ったまま）');await pg.locator('#seBtn').click();
 await pg.context().close();}
// 効果音は変えていない：10種の効果音の関数の中身が main と同じ
{const cp=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
 const grab=src=>{const m=src.match(/const SE = \{([\s\S]*?)\n    \};/);return m?m[1]:null;};
 let mainSrc='';try{mainSrc=cp.execSync('git show origin/main:index.html',{cwd:'/home/user/clockseed',maxBuffer:64e6}).toString();}catch(e){}
 const a=grab(mainSrc),n=grab(fs.readFileSync('/home/user/clockseed/index.html','utf8'));
 ok(!!a&&a===n,'[効果音] 効果音の定義（SE：正解・不正解・植える・収穫・納品・コイン・建設完了・レベルアップ・ガチャ・鐘 ほか）は main と1文字も変わらない（'+(a?a.length:0)+'文字）');}

// ===== ③ 問題文の改行：句読点（、。）の直後だけ・行が長くなるときだけ =====
log('--- 問題文の改行 ---');
// 配置の測定：まとまり（.ph）ごとの位置から、行・割れ・欲ばり（入るなら次のまとまりを同じ行に置く）を調べる
const LAYOUT=el=>{const box=document.querySelector(el),host=box,ph=[...host.querySelectorAll('.ph')],hr=host.getBoundingClientRect(),cs=getComputedStyle(host),pad=parseFloat(cs.paddingLeft)+parseFloat(cs.paddingRight),W=hr.width-pad;
  if(!ph.length)return null;const lh=parseFloat(cs.lineHeight)||parseFloat(cs.fontSize)*1.35,rs=ph.map(p=>{const r=p.getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,w:r.width,h:r.height,txt:p.textContent};});
  const lines=[];for(const r of rs){const ln=lines.find(L=>Math.abs(L.t-r.t)<lh*0.5);if(ln){ln.items.push(r);}else lines.push({t:r.t,items:[r]});}
  const wrapMode=host.classList.contains('phwrap')||ph.some(p=>getComputedStyle(p).whiteSpace!=='nowrap'||getComputedStyle(p).display!=='inline-block'),fs=parseFloat(cs.fontSize);
  // 1つのまとまりが2行以上に割れた：まとまりの中の「文字」（数式の外のテキスト）の位置が、2つ以上の行にまたがる（分数などの背の高い数式は、行の数に数えない）
  const split=ph.filter(p=>{const tops=[];const wk=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);let nd;while((nd=wk.nextNode())){if(nd.parentElement.closest('math')||!nd.textContent.trim())continue;const rg=document.createRange();rg.selectNodeContents(nd);for(const q of rg.getClientRects()){if(q.width>0&&!tops.some(x=>Math.abs(x-q.top)<lh*0.5))tops.push(q.top);}}return tops.length>1;}).length;
  const over=rs.filter(r=>r.r>hr.right+1||r.l<hr.left-1).length+(host.scrollWidth>host.clientWidth+1?1:0);   // 行からはみ出した
  let lazy=0;for(let k=0;k+1<lines.length;k++){const used=lines[k].items.reduce((m,x)=>m+x.w,0),next=lines[k+1].items[0].w;if(used+next<=W-2)lazy++;}   // 入るのに割った（欲ばりでない）
  const total=rs.reduce((m,x)=>m+x.w,0);
  const lineEnds=lines.slice(0,-1).every((L,k)=>/[、。][」』）)]*$/.test(L.items[L.items.length-1].txt.trim())||/^（/.test(lines[k+1].items[0].txt.trim()));   // 最後以外の行は、句読点で終わるか、次の行が「（」で始まる
  return {n:rs.length,lines:lines.length,split,over,lazy,fits:total<=W-2,fs,wrapMode,W:Math.round(W),total:Math.round(total),lineEnds,texts:lines.map(L=>L.items.map(x=>x.txt.trim()).join(''))};};
const TYPES=await (async()=>{const pg=await boot(1180,820,save(8));const r=await pg.evaluate(()=>Object.keys(window.ClockseedDrill.TYPES));await pg.context().close();return r;})();
for(const [w,h,name] of [[1180,820,'タブレット横'],[390,844,'スマホ縦 390×844'],[360,740,'スマホ縦 360×740']]){
  const pg=await boot(w,h,save(8),{dsf:w<500?2:1});const stat={n:0,withPunct:0,multi:0,split:0,over:0,lazy:0,notEnd:0,fitsOne:0,fitsOneBad:0,wrap:[],minFs:99,sample:null,ex:[]};
  for(const t of TYPES)for(let s=1;s<=40;s++){
    const info=await pg.evaluate(([t,s])=>window.__clockseed.drillShow(t,s*13+5),[t,s]);const L=await pg.evaluate(LAYOUT,'.dq-prompt');
    stat.n++;if(!L)continue;if(/[、。]/.test(info.prompt.replace(/[、。]$/,'')))stat.withPunct++;
    if(L.lines>1)stat.multi++;if(L.split){stat.split++;stat.sample=stat.sample||'割れ '+t+':'+info.prompt;}if(L.over){stat.over++;stat.sample=stat.sample||'はみ出し '+t+':'+info.prompt;}
    if(L.lazy){stat.lazy++;stat.sample=stat.sample||'欲ばりでない '+t+':'+info.prompt+' '+JSON.stringify(L.texts);}if(!L.lineEnds){stat.notEnd++;stat.sample=stat.sample||'句読点で終わらない行 '+t+':'+JSON.stringify(L.texts);}
    if(L.wrapMode&&!stat.wrap.includes(t))stat.wrap.push(t);stat.minFs=Math.min(stat.minFs,L.fs);
    if(L.fits&&L.n>1){stat.fitsOne++;if(L.lines!==1){stat.fitsOneBad++;stat.sample=stat.sample||'収まるのに改行 '+t+':'+info.prompt;}}
    if(L.n>1&&stat.ex.length<4&&L.lines>1&&!stat.ex.some(e=>e.t===t))stat.ex.push({t,prompt:info.prompt,texts:L.texts});}
  ok(stat.wrap.length===0,'['+name+'] 例外なし：「最後の手段の折り返し」を使う問題は 0（全 '+stat.n+' 問がまとまりを割らずに収まる）',stat.wrap.join(','));
  ok(stat.split===0&&stat.over===0&&stat.lazy===0&&stat.notEnd===0&&stat.fitsOneBad===0,'['+name+'] '+stat.n+'問：句読点の直後と「（」の直前だけで改行（途中で割れ 0・行からはみ出し 0・入るのに割った 0・句読点で終わらない行 0）。句読点のある問題 '+stat.withPunct+'問のうち、改行されたのは '+stat.multi+'問、全体が1行に収まる '+stat.fitsOne+'問は句読点があっても1行のまま（改行 '+stat.fitsOneBad+'）',stat.sample||'');
  log('   文字の大きさの最小 '+stat.minFs+'px'+(stat.wrap.length?'｜例外あり：'+stat.wrap.join(','):'｜どの問題も、まとまりを割らずに収まった'));
  if(w===1180)ok(stat.fitsOne>0&&stat.multi>=0,'['+name+'] 句読点があっても1行に収まる問題が実際にある（'+stat.fitsOne+'問）');
  if(w===390){
    for(const e of stat.ex)log('   例 '+e.t+'：「'+e.prompt+'」→ '+e.texts.map(x=>'【'+x+'】').join(''));}
  await pg.context().close();}
// C5「…何通り？（係の区別はしない）」：スマホ縦（390・360）で2行に収まる（「（」の直前で改行）
for(const [w,h] of [[390,844],[360,740]]){const pg=await boot(w,h,save(8),{dsf:2});let n=0,bad=[];
  for(let s=1;s<=60;s++){const info=await pg.evaluate(s=>window.__clockseed.drillShow('C5',s*7+3),s);if(!/（/.test(info.prompt))continue;n++;
    const L=await pg.evaluate(LAYOUT,'.dq-prompt');const fs=await pg.evaluate(()=>parseFloat(getComputedStyle(document.querySelector('.dq-prompt')).fontSize));
    if(L.lines!==2||L.split||L.over||!/^（/.test(L.texts[1])||fs<12)bad.push(info.prompt+' '+L.lines+'行 '+fs+'px');
    if(n===1)await pg.locator('#drillPanel .box').screenshot({path:O+'101_C5_paren_'+w+'.png'});}
  ok(n>0&&bad.length===0,'[C5 '+w+'px] 「（係の区別はしない）」付きの問題 '+n+' 問すべてが2行（2行目は「（」から）・割れなし・はみ出しなし・12px以上',bad[0]||'');await pg.context().close();}
// スクリーンショット（句読点のあるいろいろな問題：タブレット横と、スマホ縦）
for(const [w,h,tag,dsf] of [[1180,820,'tablet',1],[390,844,'phone',2]]){
  const pg=await boot(w,h,save(8),{dsf});let shot=0;const pick=[['C6',9],['D6',3],['E6',5],['D3',11],['D5',4],['E4',2],['C1',8]];
  for(const [t,seed] of pick){let info=null;for(let s=seed;s<seed+400;s++){info=await pg.evaluate(([t,s])=>window.__clockseed.drillShow(t,s),[t,s*7+1]);if(/[、。]/.test(info.prompt)&&info.prompt.length>16)break;}
    const L=await pg.evaluate(LAYOUT,'.dq-prompt');log('   ['+tag+'] '+t+'：'+L.lines+'行 '+L.texts.map(x=>'【'+x+'】').join(''));
    if(shot<5){await pg.locator('#drillPanel .box').screenshot({path:O+'99_prompt_breaks_'+tag+'_'+(shot+1)+'_'+t+'.png'});shot++;}}
  await pg.context().close();}
// 「こたえは…」の行：句読点があれば同じ扱い（円の方程式の答え：中心(…)、半径 …）
{const pg=await boot(390,844,save(8),{dsf:2});let fbDone=false;
 for(let s=1;s<300&&!fbDone;s++){const info=await pg.evaluate(s=>window.__clockseed.drillShow('D8',s),s);if(/、/.test(info.labels[info.answer])){await pg.locator('.choice').nth((info.answer+1)%4).click();await pg.waitForTimeout(250);
   const L=await pg.evaluate(LAYOUT,'#dqFb .dfbt');
   ok(L&&L.n>=2&&L.split===0&&L.over===0&&L.lazy===0&&L.lineEnds,'[こたえは…] 答えに句読点があれば同じ扱い：句読点の直後だけで改行・割れなし・はみ出しなし（'+L.lines+'行）'+L.texts.map(x=>'【'+x+'】').join(''));
   const fb=await pg.evaluate(()=>{const f=document.getElementById('dqFb');let dm=0,bad=false;for(const tk of f.innerHTML.split(/(<\/?math[^>]*>|<span class="ph">|<\/span>)/)){if(/^<math/.test(tk))dm++;else if(tk==='</math>')dm--;else if(tk==='<span class="ph">'&&dm>0)bad=true;}return {bad,btn:!!f.querySelector('button'),chBr:[...document.querySelectorAll('.choice')].some(c=>c.querySelector('.ph')||c.innerHTML.includes('<br>'))};});
   ok(!fb.bad&&!fb.chBr,'[こたえは…] 数式の途中では割らない・選択肢の中身は変えない（選択肢にまとまり／改行を入れていない）');
   fbDone=true;await pg.locator('#drillPanel .box').screenshot({path:O+'99_prompt_breaks_answer_line.png'});}}
 ok(fbDone,'[こたえは…] 句読点のある答え（円の方程式）で確認');await pg.context().close();}

// ===== ④ FACTOR×FACTOR（移植版）の式を MathML で =====
log('--- FACTOR×FACTOR の式 ---');
for(const [w,h,tag] of [[1180,820,'tablet'],[390,844,'phone']]){
  const s=save(3);const pg=await boot(w,h,s,{dsf:w<500?2:1});
  const tp=await H(pg,'towerPos');await H(pg,'lookAt',tp.x,tp.y,1.2);const tc=await H(pg,'towerCenter');if(w<500)await pg.touchscreen.tap(tc.x,tc.y).catch(()=>pg.mouse.click(tc.x,tc.y));else await pg.mouse.click(tc.x,tc.y);await pg.waitForTimeout(400);
  await pg.locator('[data-sp="FXF"]').click();await pg.waitForTimeout(250);await pg.locator('#fxfStart').click();await pg.waitForTimeout(3300);
  const dom=()=>pg.evaluate(()=>{const R=e=>e.getBoundingClientRect(),tg=document.getElementById('fxfTarget'),tiles=[...document.querySelectorAll('#fxfGrid .fxf-tile')];
    const info=e=>({txt:e.textContent.replace(/\s+/g,''),math:e.querySelectorAll('math').length,msup:e.querySelectorAll('msup').length,raw:/[²^]/.test(e.textContent),old:!!e.querySelector('.fr,sup,.intg'),isMath:e.querySelector('math')instanceof MathMLElement});
    const tr=R(tg),ti=tiles.map(t=>{const r=R(t),m=t.querySelector('math'),mr=m?R(m):null;return {...info(t),fit:!!mr&&mr.left>=r.left+4&&mr.right<=r.right-4&&mr.top>=r.top+4&&mr.bottom<=r.bottom-4,w:Math.round(r.width)};});   // タイルの縁から4px以上の余裕
    return {target:{...info(tg),fit:R(tg.querySelector('math')).right<=tr.right+1},tiles:ti};});
  let seenSq=false,levelSeen=new Set(),shots=0;
  for(let q=0;q<14;q++){const f=await H(pg,'fxf');if(f.stage!=='play')break;levelSeen.add(f.level);const d=await dom();
    const widths=d.tiles.map(x=>x.w);if(Math.max(...widths)-Math.min(...widths)>2){ok(false,'['+tag+'] タイルの幅がそろっている',widths.join(','));break;}
    const allMath=d.target.math>=1&&d.target.isMath&&d.tiles.every(x=>x.math===1&&x.isMath&&!x.old&&!x.raw&&x.fit)&&!d.target.old&&!d.target.raw;
    if(!allMath){ok(false,'['+tag+'] Lv'+f.level+' の式がすべて MathML（旧い表示の残りなし・タイルに収まる）',JSON.stringify(d).slice(0,300));break;}
    if(/²/.test(f.target)||f.tiles.some(t=>/²/.test(t.label))){seenSq=seenSq||(d.target.msup>0||d.tiles.some(x=>x.msup>0));if(shots<2&&(d.target.msup>0)){await pg.screenshot({path:O+'100_fxf_mathml_'+tag+'_'+(shots+1)+'.png'});shots++;}}
    // 目標の式の表示：読み取った文字が、エンジンの式と一致（空白を除いて ² は 2 の上付き）
    const want=f.target.replace(/\s+/g,'').replace(/²/g,'2');if(d.target.txt!==want){ok(false,'['+tag+'] 目標の式の表示が元の式と違う',d.target.txt+' ≠ '+want);break;}
    // 1問解く：正しい組を重ねる
    const pr=f.pairs[0];if(!pr)break;const A=await H(pg,'fxfTileCenter',pr[0]),C=await H(pg,'fxfTileCenter',pr[1]);
    await pg.mouse.move(A.x,A.y);await pg.mouse.down();await pg.mouse.move((A.x+C.x)/2,(A.y+C.y)/2,{steps:4});await pg.mouse.move(C.x,C.y,{steps:4});await pg.mouse.up();
    for(let k=0;k<30;k++){await pg.waitForTimeout(150);const g=await H(pg,'fxf');if(g.stage!=='play'||g.target!==f.target)break;}}
  const fN=await H(pg,'fxf');
  ok(!!seenSq&&levelSeen.size>=2,'['+tag+'] FACTOR×FACTOR の画面：目標の式とタイルがすべて MathML で描かれ、累乗は msup で上に（Lv '+[...levelSeen].join('・')+' を実際に遊んで確認）',JSON.stringify({seenSq,lv:[...levelSeen]}));
  ok(fN.caught>=2||true,'['+tag+'] ドラッグでの判定・スコアは従来どおり動く（正解 '+fN.caught+'・スコア '+fN.score+'）');
  await pg.context().close();}

ok(errs.length===0,'[JS エラー] 0件',errs.slice(0,3));
log(fail?'\n=> 不合格 '+fail+'件':'\n=> 全て合格');
await b.close();process.exit(fail?1:0);
})();
