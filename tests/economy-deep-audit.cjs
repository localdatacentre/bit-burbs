'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {C,config,defs,quotes,rates,harness,extract,html}=require('./economy-audit-harness.cjs');
const vm=require('node:vm'),M=60000,at=Date.parse('2026-11-17T08:00:00Z');
const report={baseline:'83fee17bd4793ec5ae470445002d299caadceef2',scope:'read-only tests of pinned live source; no production changes',checks:[],findings:[],businesses:[],progression:{}};
let assertions=0;
function near(a,b,label=''){assertions++;assert(Math.abs(a-b)<1e-6*Math.max(1,Math.abs(b)),`${label}: ${a} != ${b}`);}
function check(name,run){try{const evidence=run();report.checks.push({name,status:'pass',evidence:evidence??null});}catch(e){report.checks.push({name,status:'fail',error:e.message});}}
function finding(id,severity,summary,evidence){report.findings.push({id,severity,summary,evidence});}
const clean=city=>JSON.parse(JSON.stringify(city,(k,v)=>k==='_'?undefined:v));
function city(){return {cash:10000,stars:0,level:1,xp:0,deeds:0,tickets:0,economyLab:{version:1,balanceVersion:2,settled:at,lastAction:at}};}
function business(id,lvl=1,staff=config[id].jobs,stock=config[id].stock){return {t:{id,lvl,pr:[{s:at+stock*M,o:0}]},d:defs[id],employees:staff,ok:true,pow:true,wat:true};}
// Independent interval integration; it does not call Core.intervals or Core.gross.
function reference(city,b,to,{offline=false,school=1}={}){
 const p=config[b.t.id],from=city.economyLab.settled,pr=b.t.pr[0],duration=p.stock*M;
 const original=[1,1.5,2.2].reduce((n,m)=>n+Math.max(1,Math.round((rates[b.d.jobs]||0)*m*[1,1,1.25,1.6,2.05,2.6][b.t.lvl])),0);
 const rate=Math.round(original*p.factor*1.05*10)/10*Math.min(p.jobs,Math.max(0,b.employees))/p.jobs*school;
 const spans=[[pr.s-duration,pr.s]];
 if(pr.o&&pr.o<=to){const start=Math.max(pr.s,pr.o);spans.push([start,start+duration]);}
 let coins=0,active=0;
 for(const [a,z]of spans){
  const lo=Math.max(from,a),hi=Math.min(to,z);if(hi<=lo)continue;
  const boostEnd=Math.max(lo,Math.min(hi,city.boostUntil||0));
  const total=hi-lo+(boostEnd-lo);
  coins+=rate*total/M*(offline?.5:1);
  if(!offline)active+=Math.max(0,Math.min(hi,(city.economyLab.lastAction||0)+10*M)-lo)/M;
 }
 return b.employees&&b.ok&&b.pow&&b.wat?{coins,active}:{coins:0,active:0};
}
check('11,040 independent income integrations across all 115 business levels',()=>{
 let count=0;
 for(const id of Object.keys(config))for(let lvl=1;lvl<=5;lvl++)for(const fraction of [0,.25,.5,1])for(const offline of [false,true])for(const remaining of [0,10,config[id].stock,config[id].stock/2])for(const boost of [0,15,180]){
  const b=business(id,lvl,config[id].jobs*fraction,remaining),s=city();s.boostUntil=boost?at+boost*M:0;
  const want=reference(s,b,at+180*M,{offline,school:1.05}),got=C.settle(s,[b],at+180*M,config,rates,{offline,school:1.05});
  near(got.coins,want.coins,id);near(got.minutes,want.active,id);count++;
 }
 return {cases:count};
});
check('pending stock, delayed catch-up, partition invariance and serialized reload',()=>{
 let count=0;
 for(const id of Object.keys(config))for(const pending of [1,5,20,90,240])for(const offline of [false,true]){
  const b=business(id,3,config[id].jobs,0);b.t.pr[0].o=at+pending*M;const s=city();s.boostUntil=at+45*M;
  const wanted=reference(s,b,at+24*60*M,{offline}),one=C.settle(clean(s),[clean(b)],at+24*60*M,config,rates,{offline});
  near(one.coins,wanted.coins);
  let sum=0,split=clean(s),sb=clean(b);
  for(let m=1;m<=24*60;m+=7){const to=at+Math.min(m+6,24*60)*M;sum+=C.settle(split,[sb],to,config,rates,{offline}).coins;split=clean(split);sb=clean(sb);}
  near(sum,one.coins);near(C.settle(split,[sb],split.economyLab.settled,config,rates,{offline}).coins,0);count++;
 }
 return {cases:count};
});
check('income is proportional to staff; upgrades do not increase fixed business jobs',()=>{
 for(const [id,p]of Object.entries(config)){
  const h=harness();for(let n=0;n<8;n++)h.add('nuclear');for(let n=0;n<8;n++)h.add('pump');h.add('tower',{lvl:5});const t=h.add(id,{stock:p.stock});h.s.S.pop=112;
  let prior=0;
  for(let lvl=1;lvl<=5;lvl++){t.lvl=lvl;h.derive();const b=t._;assert.equal(b.jobCapacity,p.jobs);assert.equal(b.employees,p.jobs);const gross=C.gross(defs[id],t,b.employees,p,rates);assert(gross>prior);prior=gross;}
 }
 return {businesses:Object.keys(config).length};
});
check('existing workers retain jobs when a new workplace is added or an old one closes',()=>{
 const h=harness();h.add('wind');h.add('wtower');h.add('house',{lvl:2});const first=h.add('bakery',{stock:90});h.s.S.pop=3;h.derive();assert.equal(first.hired,3);
 const second=h.add('workshop',{stock:120});h.derive();assert.equal(first.hired,3);assert.equal(second.hired,0);
 h.s.blocked.add('bakery');h.derive();assert.equal(first.hired,3);assert.equal(first._.workers,0);assert.equal(second.hired,0);
 h.s.blocked.delete('bakery');h.s.S.pop=7;h.derive();assert.equal(first.hired,3);assert.equal(second.hired,4);
 return {firstHires:first.hired,secondHires:second.hired};
});
check('housing and service loss conserve displaced residents and prevent phantom income',()=>{
 const h=harness();h.add('wind');h.add('wtower');const home=h.add('house',{lvl:2});const b=h.add('bakery',{stock:90});h.s.S.pop=8;h.derive();assert.equal(h.s.S.pop,8);
 h.s.blocked.add('house');h.derive();assert.equal(h.s.S.pop,0);assert.equal(h.s.S.returningResidents,8);assert.equal(b.hired,0);near(h.advance(10),0);
 h.s.blocked.delete('house');h.derive();assert.equal(h.s.S.pop,8);assert.equal(h.s.S.returningResidents,0);assert.equal(b.hired,3);
 return {restoredPopulation:h.s.S.pop,restoredWorkers:b.hired};
});
check('school multiplier is 1–5%, needs full staffing and does not stack',()=>{
 const full=lvl=>({t:{id:'school',lvl},works:true,employees:17,jobCapacity:17});const h=harness();
 for(let lvl=1;lvl<=5;lvl++)assert.equal(h.call('schoolBonusPct',[full(lvl)]),lvl);
 assert.equal(h.call('schoolBonusPct',[full(5),full(4)]),5);
 assert.equal(h.call('schoolBonusPct',[{...full(5),employees:16}]),0);
 assert.equal(h.call('schoolBonusPct',[{...full(5),works:false}]),0);
 return {maximumPercent:5};
});
check('real depot rejects early/duplicate orders and handles exact-price, cash and voucher payments',()=>{
 const h=harness();h.add('wind');h.add('wtower');h.add('house');const t=h.add('bakery');h.s.S.pop=3;h.derive();
 const fee=h.call('depotPlan',at).fee,before=h.s.S.cash;
 assert(fee>0);assert(!h.call('manualRestock',fee+1));assert.equal(h.s.S.cash,before);
 assert(h.call('manualRestock',fee));assert.equal(h.s.S.cash,before-fee);assert.equal(t.pr[0].o,at+3*M);
 assert(!h.call('manualRestock',fee));assert.equal(h.s.S.cash,before-fee);
 h.advance(3);assert.equal(t.pr[0].o,0);assert(t.pr[0].s>h.s.clock);assert(!h.call('manualRestock',fee));
 h.advance(90);h.s.S.restockVouchers=1;const coins=h.s.S.cash;const key=t._.j*h.s.N+t._.i;
 assert(h.call('manualRestock',0,key,true));assert.equal(h.s.S.restockVouchers,0);assert.equal(h.s.S.cash,coins);
 assert(!h.call('manualRestock',0,key,true));return {fee,deliveryMinutes:3};
});
check('rush consumes dosh once and does not credit elapsed unearned stock',()=>{
 const h=harness();h.add('wind');h.add('wtower');h.add('house');const t=h.add('bakery');h.s.S.pop=3;h.derive();const key=t._.j*h.s.N+t._.i;
 h.call('manualRestock',h.call('depotPlan',at).fee);const before=h.s.S.stars;
 h.call('rushProd',key%h.s.N,Math.floor(key/h.s.N),0,1);assert.equal(h.s.S.stars,before-1);assert.equal(t.pr[0].o,0);assert.equal(t.pr[0].s,at+90*M);
 h.call('rushProd',key%h.s.N,Math.floor(key/h.s.N),0,1);assert.equal(h.s.S.stars,before-1);
 return {dosh:1};
});
check('demolition refunds actual base purchase at 10%, never free parks/roads/Dosh items',()=>{
 const h=harness();
 for(const [id,p]of Object.entries(config))for(const price of [0,1,19,1001,p.price]){near(h.call('demolitionRefund',{id,purchaseCoins:price,lvl:5}),Math.floor(price/10));}
 for(const id of ['road','hall','statue','fountain','parkSmall','parkLarge','parkXL'])assert.equal(h.call('demolitionRefund',{id}),0);
 return {rate:.1,upgradePaymentsIncluded:false};
});
check('real arrivals start employee income at the hire timestamp, not the whole absence',()=>{
 const h=harness();h.add('wind');h.add('wtower');h.add('house');const t=h.add('bakery',{stock:90});h.derive();const gross=C.gross(defs.bakery,t,3,config.bakery,rates);
 near(h.advance(1,true),gross*.75*.5);assert.equal(h.s.S.pop,3);assert.equal(t.hired,3);
 return {populationAfterSeconds:15,incomePaidForSeconds:45,awayRate:.5};
});
check('operation XP counts union of working minutes rather than business count; idle and away pay no XP',()=>{
 const s=city(),list=Object.keys(config).map(id=>business(id));let r=C.settle(s,list,at+120*M,config,rates);near(r.minutes,10);
 const e=C.ensure(s,at);near(C.operation(s,r.minutes,r.onlineCoins,at+120*M),60);
 const away=city();const ra=C.settle(away,Object.keys(config).map(id=>business(id)),at+120*M,config,rates,{offline:true});near(ra.minutes,0);
 return {interactionWindowMinutes:10,XPFromTenMinutes:60};
});
check('daily operation/development caps, rollover and repeat development receipts',()=>{
 const s=city();near(C.operation(s,120,0,at),720);near(C.operation(s,120,0,at),120);near(C.operation(s,120,0,at),0);
 near(C.development(s,'a',200,at),100);near(C.development(s,'a',200,at),0);near(C.development(s,'b',200,at),0);
 near(C.development(s,'a',200,at+1440*M),0);near(C.development(s,'c',200,at+1440*M),100);
 near(C.operation(s,120,0,at+1440*M),720);return {dailyFirstTwoHours:720,dailyFourHourMaximum:840,developmentDailyCap:100};
});
check('real ledger splits active minutes and XP at the 6pm Brisbane daily boundary',()=>{
 const start=at-30*M,h=harness({at:start});h.add('wind');h.add('wtower');h.add('house');h.add('bakery',{stock:90});h.s.S.pop=3;h.derive();h.s.S.economyLab.lastAction=start+90*M;
 h.advance(60);near(h.s.S.economyLab.minutes,30);near(h.s.S.economyLab.onlineCoins,30*20.2);assert.equal(h.s.S.economyLab.day,C.cycle(at));
 return {minutesInNewDay:h.s.S.economyLab.minutes,XPForBothDays:h.s.S.xp,level:h.s.S.level};
});
check('level awards, every-fifth-level tickets/deeds and max-level clamp',()=>{
 const s=city();const total=Array.from({length:99},(_,i)=>C.need(i+1)).reduce((a,b)=>a+b,0);const gained=C.award(s,total);
 assert.equal(s.level,100);assert.equal(gained.length,99);assert.equal(s.stars,198);assert.equal(s.deeds,20);assert.equal(s.tickets,20);
 const before=clean(s);C.award(s,1000000);assert.equal(s.level,100);assert.equal(s.stars,before.stars);assert.equal(s.tickets,before.tickets);assert(s.xp<C.need(100));
 report.progression.xpTo100=total;report.progression.levelTicketsTo100=20;return {XP:total,levelDosh:198,levelDeeds:20,levelTickets:20};
});
// Investment tables preserve actual catalogue values, staffing and stock fees.
for(const [id,p]of Object.entries(config)){
 const levels=[];
 for(let lvl=1;lvl<=5;lvl++){
  const t={lvl},gross=C.gross(defs[id],t,p.jobs,p,rates),fee=C.fee(defs[id],t,p.jobs,p,rates);
  levels.push({level:lvl,coinsPerMinute:gross,fee,netPerStockedCycle:gross*p.stock-fee,deliveryMinutes:p.delivery,stockMinutes:p.stock,jobs:p.jobs,nextUpgrade:quotes[id].upgrades[lvl]??null});
 }
 report.businesses.push({id,name:defs[id].name,firstPrice:quotes[id].first,levels});
}
check('stock continues to expire during service disconnection',()=>{
 const b=business('bakery'),s=city();b.pow=false;near(C.settle(s,[b],at+60*M,config,rates).coins,0);b.pow=true;
 near(C.settle(s,[b],at+120*M,config,rates).coins,20.2*30);return {stockUsedWhileUnpowered:60,sellingMinutesAfterReconnect:30};
});
check('BinLink visits continue every ten visible minutes without paying fares',()=>{
 const h=harness();
 function stop(id){return {t:{id},i:0,j:0,x:0,y:0,sx:0,sy:1,dx:1,dy:0,dir:0};}
 const hail=stop('hailStop'),shelter=stop('busShelter');
 h.s.busMap={stops:[hail,shelter],buildings:[hail,shelter],roads:new Map()};
 const before=h.s.S.cash;
 h.call('serviceBuses',599);assert.equal(h.s.S.cash,before);
 h.call('serviceBuses',1);assert.equal(h.s.S.cash,before);
 h.call('serviceBuses',0);assert.equal(h.s.S.cash,before);
 h.call('serviceBuses',1200);assert.equal(h.s.S.cash,before);assert.equal(hail.t.visits,3);assert.equal(shelter.t.visits,3);
 h.s.busMap.stops=[];h.call('serviceBuses',86400);assert.equal(h.s.S.cash,before);
 assert(html.includes('if (document.hidden) { requestAnimationFrame(frame); return; }'));
 assert(html.includes("document.addEventListener('visibilitychange',()=>{serviceClock=null;});"));
 return {oneHailPlusOneShelterPer120Minutes:0,fiveOfEachPer120Minutes:0,awayService:false};
});
check('stored building restoration retains level, stock, purchase price and identity',()=>{
 const h=harness();const t={id:'bakery',lvl:4,hired:3,purchaseCoins:1700,labId:'original',pr:[{s:at+90*M,o:0}]};
 const entry={building:t};h.s.S.storedBuildings=[entry];const before=h.s.S.cash;
 assert(h.call('restoreBuilding',entry,1,1));assert.equal(h.s.S.storedBuildings.length,0);assert.equal(h.s.S.tiles[h.s.N+1],t);
 assert.equal(t.lvl,4);assert.equal(t.purchaseCoins,1700);assert.equal(t.labId,'original');assert.equal(h.s.S.cash,before);
 assert(!h.call('restoreBuilding',entry,1,1));return {freeToRestore:true,duplicatesRejected:true};
});
check('balance migration preserves live fractions/pending orders across every business and level',()=>{
 let cases=0;
 for(const [id,p]of Object.entries(config))for(let lvl=1;lvl<=5;lvl++)for(const fraction of [0,.1,.5,1]){
  const t={id,lvl,pr:[{s:at+p.previous.stock*fraction*M,o:at+7*M}]},s=city();s.tiles=[t];s.economyLab.balanceVersion=1;
  const wallet=[s.cash,s.stars,s.level,s.xp];assert(C.rebalance(s,config,at));assert.equal(t.pr[0].o,at+7*M);
  near(t.pr[0].s,at+p.stock*fraction*M);assert.deepEqual([s.cash,s.stars,s.level,s.xp],wallet);
  const saved=clean(s);assert(!C.rebalance(saved,config,at));assert.deepEqual(clean(saved),clean(s));cases++;
 }
 return {cases};
});
check('legacy boost normalization rounds stored duration upward, never discards valid minutes',()=>{
 const h=harness(),s={coinBoostTokens:{10:2,30:1,15:1},boostUntil:at+5*M};h.call('standardiseCoinBoosts',s);
 assert.deepEqual(JSON.parse(JSON.stringify(s.coinBoostTokens)),{15:5});assert.equal(s.boostUntil,at+5*M);
 return {originalStoredMinutes:65,normalizedStoredMinutes:75,activeBoostUntouched:true,releaseWarning:'Existing normalizer is for 15-minute live tokens. A future 10-minute reward release must replace it or preserve legacy durations explicitly.'};
});
// Characterize edge cases as findings without changing or blessing behavior.
{
 const h=harness();h.add('wind');h.add('wtower');h.add('house');const t=h.add('bakery',{stock:90});h.s.S.pop=3;h.derive();
 h.s.clock=at+60*M;h.call('upgrade',t._.i,t._.j);h.derive();const actual=h.call('labAccrue',h.s.clock,false);
 const expected=20.2*60;
 if(Math.abs(actual-expected)>1e-6)finding('mutation-before-settlement','integration risk','Calling upgrade before settling existing time retroactively applies its new rate. Normal trusted pointerdown should settle first; alternate action paths must be checked.',{actual,expected,entryPoint:'upgrade + labAccrue',normalPointerCapturePresent:html.includes("if(event.isTrusted)labTouch()")});
}
{
 const h=harness();const start=h.call('newGame');
 report.startingCity={baseStateCash:h.call('baseState').cash,actualNewGameCash:start.cash,actualPopulation:start.pop,actualLevel:start.level,townHallPrice:quotes.hall.first,depotPrice:quotes.deliveryDepot.first};
 finding('starter-fixture-correction','test coverage','The earlier blank-city task fixture used baseState 3,000 coins. Actual newGame starts at 8,000 coins and zero residents; ten-task absence still applies, but onboarding affordability must use 8,000.',report.startingCity);
}
report.assertions=assertions;
report.summary={passed:report.checks.filter(x=>x.status==='pass').length,failed:report.checks.filter(x=>x.status==='fail').length,findings:report.findings.length};
fs.writeFileSync(path.join(__dirname,'../docs/economy-deep-audit-results.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({summary:report.summary,checks:report.checks,findings:report.findings},null,2));
if(report.summary.failed)process.exitCode=1;
module.exports=report;
