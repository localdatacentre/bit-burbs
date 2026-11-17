'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const T=require('../daily-task-core.js'),C=require('../economy-core.js');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const config=JSON.parse(html.match(/window.BB_ECONOMY=(\{.*?\});<\/script>/)[1]);
const ctx=vm.createContext({ECON:config});
vm.runInContext(html.slice(html.indexOf('const DEFS ='),html.indexOf('const SVC_NAMES ='))+';this.defs=DEFS;',ctx);
const defs=ctx.defs,rates=vm.runInNewContext('('+html.match(/const businessRates = (\{[\s\S]*?\n\});/)[1]+')');
const at=Date.parse('2026-11-17T08:00:00Z'),M=60000;
function profile(ids,{remaining=30,stops=true,cash=100000}={}) {
  const list=ids.map((id,i)=>({t:{id,labId:id+'-'+i,lvl:1,pr:[{s:at+Math.min(remaining,config[id].stock)*M,o:0}]},employees:config[id].jobs,ok:true,pow:true,wat:true}));
  const services={0:ids.length?['home-1']:[],1:list.map(b=>b.t.labId),2:list.map(b=>b.t.labId),3:list.map(b=>b.t.labId)};
  return T.snapshot({cash},list,config,defs,rates,at,{services,stops:stops?[{id:'stop-1',connected:true,fare:10}]:[]});
}
const profiles={oneBusiness:profile(['bakery'],{stops:false}),brandNew:profile([],{stops:false,cash:8000}),growing:profile(['bakery','coffee','workshop','books','grocery']),fullyStockedLate:profile(Object.keys(config),{remaining:240}),withoutBinLink:profile(['bakery','coffee','workshop','books','grocery'],{stops:false})};
assert.equal(T.TEMPLATES.length,40);
const report={baseline:'83fee17bd4793ec5ae470445002d299caadceef2',profiles:{}};
for(const [name,s]of Object.entries(profiles)) {
  const state=T.assign(null,s,'test-player',at),pool=T.candidates(s);
  report.profiles[name]={status:state.status,count:state.tasks.length,upperBound:state.upperBound,candidates:pool.length,searchExhausted:state.searchExhausted,tasks:state.tasks.map(t=>({template:t.id,difficulty:t.difficulty,metric:t.metric,scope:t.ids,target:t.target,estimatedMinutes:t.eta}))};
  assert.deepEqual(T.assign(state,{...s,cash:0,businesses:[]},'test-player',at+M),state,'reload freezes targets and assignment');
  assert.deepEqual(T.assign(null,s,'test-player',at),state,'same canonical snapshot and seed');
  assert(state.tasks.filter(t=>t.maintenance).length<=2);
  assert(state.tasks.filter(t=>t.money).length<=1);
  assert(state.tasks.filter(t=>t.improvement).length<=1);
  for(const t of state.tasks) {assert(t.eta<=120);assert.equal(t.reward.dosh,1);assert(state.tasks.filter(x=>x.family===t.family).length<=2);for(const other of state.tasks)if(t!==other)assert(T.compatible(t,other));}
  if(state.status==='ready')assert.deepEqual(T.DIFFICULTIES.map(d=>state.tasks.filter(t=>t.difficulty===d).length),[3,4,3]);
  if(name==='fullyStockedLate')assert(!pool.some(t=>t.family==='orders'&&t.ids.some(id=>s.businesses.find(b=>b.id===id).remaining>75)));
  if(name==='withoutBinLink'||name==='oneBusiness')assert(!pool.some(t=>t.family==='binlink'));
}
assert.equal(report.profiles.oneBusiness.status,'blocked');
assert.equal(report.profiles.brandNew.status,'blocked');
assert.equal(C.cycle(at-1),'2026-11-16');assert.equal(C.cycle(at),'2026-11-17');
// Feed actual live-economy settlements into the isolated progress reducer.
function replaySession(s,emit,at=Date.parse('2026-11-17T08:00:00Z')) {
  const list=s.businesses.map(b=>({t:{id:b.model,labId:b.id,lvl:1,pr:[{s:at+b.remaining*M,o:b.pending===null?0:at+b.pending*M}]},d:defs[b.model],employees:b.employees,ok:true,pow:true,wat:true}));
  const city={cash:s.cash,restockVouchers:s.restockVouchers||0,level:1,xp:0,economyLab:{version:1,balanceVersion:2,settled:at,lastAction:at}};
  let event=0;
  const apply=e=>emit({id:'sim-'+(++event),...e});
  for(let m=0;m<120;m++) {
    const from=at+m*M,to=from+M;
    for(const b of list)if(b.t.pr[0].s<=from&&!b.t.pr[0].o) {
      const p=config[b.t.id],fee=C.fee(b.d,b.t,b.employees,p,rates);
      if(city.restockVouchers>0)city.restockVouchers--;
      else if(city.cash>=fee)city.cash-=fee;
      else continue;
      b.t.pr[0].o=from+p.delivery*M;
      apply({type:'order',subject:b.t.labId,at:from});
    }
    const facts={'home-1':{suppliedHomeMinutes:true}};
    const arrivals=[];
    for(const b of list) {
      const pr=b.t.pr[0],p=config[b.t.id],ranges=C.intervals({...pr},p.stock*M,from,to);
      const sold=C.unionMs(ranges)/M;
      facts[b.t.labId]={coins:sold*C.gross(b.d,b.t,b.employees,p,rates),selling:sold>=1,employees:b.employees,connected:true,powerMinutes:true,waterMinutes:true,connectedMinutes:true};
      if(pr.o&&pr.o<=to)arrivals.push(b.t.labId);
    }
    city.economyLab.lastAction=from;
    city.cash+=C.settle(city,list,to,config,rates).coins;
    apply({type:'interval',from,at:to,active:true,foreground:true,facts});
    for(const subject of arrivals)apply({type:'delivery',subject,at:to});
    if((m+1)%10===0)for(const stop of (s.stops||[]).filter(stop=>stop.connected))apply({type:'busVisit',subject:stop.id,fare:stop.fare,at:to,active:true,foreground:true});
  }
  return city;
}
function simulate(s,seed,time=at) {
  const events=[];
  const city=replaySession(s,event=>events.push(event),time);
  let daily=T.assign(null,s,seed,time,[],events), completion=null;
  if(daily.status!=='ready')return null;
  assert.deepEqual(T.assign(daily,s,seed,time+M,[],[]),daily);
  for(const event of events){
    daily=T.progress(daily,event);
    if(completion===null && daily.tasks.every(t=>t.progress>=t.target))completion=Math.ceil((event.at-time)/M);
  }
  assert(daily.tasks.every(t=>t.progress>=t.target),'actual settlements must finish every assigned goal: '+JSON.stringify(daily.tasks.filter(t=>t.progress<t.target)));
  let record={revision:0,wallet:{},daily};
  for(const task of daily.tasks){const result=T.claim(record,task.key,time+120*M,record.revision);assert(result.ok);record=result.record;}
  const count=daily.tasks.length;
  assert.equal(record.wallet.crateVouchers,count+(count===10?4:0));
  assert.equal(record.wallet.dosh,count+(count===10?2:0));
  assert.equal(record.wallet.wheelTickets||0,Number(count>=5)+Number(count===10));
  assert.equal(record.wallet.restockVouchers,record.wallet.wheelTickets);
  assert.equal(record.wallet.xp,daily.tasks.reduce((sum,t)=>sum+t.reward.xp,0)+(count===10?20:0));
  return {taskCount:count,completeAtMinute:completion,coinsAfterSession:Math.round(city.cash),dailyRewards:record.wallet};
}
for(const [name,s]of Object.entries(profiles))report.profiles[name].simulation=simulate(s,'test-player');

const capacityResults={};
for(const [name,s] of Object.entries(profiles)) {
  const events=[];
  replaySession(s,e=>events.push(e));
  const goals=T.sessionGoals(s,at,events);
  capacityResults[name]=goals.length;
  for(const goal of goals)for(const other of goals)if(goal!==other)assert(T.compatible(goal,other));
}
assert.equal(capacityResults.brandNew,0);
assert(capacityResults.oneBusiness>0 && capacityResults.oneBusiness<=5);
assert.equal(capacityResults.growing,10);
assert.equal(capacityResults.withoutBinLink,10);
assert(capacityResults.fullyStockedLate>5 && capacityResults.fullyStockedLate<10);
assert.deepEqual(T.sessionGoals(profiles.growing,at,[]),[]);
console.log('Verified session capacity',capacityResults);


// Each row uses one wallet and the same two-hour trace for all candidate goals.
const capacityMatrix=[];
for(const ids of [['bakery'],['bakery','bakery'],['bakery','coffee'],['bakery','coffee','books']]) {
  for(const remaining of [0,30,75,76,240])for(const cash of [0,1000])for(const stops of [false,true]) {
    const s=profile(ids,{remaining,cash,stops});
    const events=[];
    const wallet=replaySession(s,event=>events.push(event));
    assert(wallet.cash>=0);
    const goals=T.sessionGoals(s,at,events);
    const orders=events.filter(event=>event.type==='order');
    if(!cash&&!remaining)assert.equal(orders.length,0);
    if(!stops)assert(!goals.some(goal=>goal.transport));
    if(remaining>75)assert(!goals.some(goal=>goal.orderIds));
    let replay={status:'ready',day:C.cycle(at),assignedAt:at,
      tasks:goals.map(goal=>({...goal,assignedAt:at,progress:0}))};
    let finishMinute=null;
    for(const event of events) {
      replay=T.progress(replay,event);
      if(goals.length && replay.tasks.every(goal=>goal.progress>=goal.target)) {
        finishMinute=(event.at-at)/M;
        break;
      }
    }
    assert(finishMinute>=90 && finishMinute<=120, "expected a 90–120 minute set for this fixture");
    capacityMatrix.push({ids,remaining,cash,stops,count:goals.length,finishMinute});
  }
}
report.capacityMatrix=capacityMatrix;
// Empty bakery and no coins. One voucher should start exactly one initial order.
for(const vouchers of [0,1]) {
  const s=profile(['bakery'],{remaining:0,cash:0,stops:false});
  s.restockVouchers=vouchers;
  const events=[];
  const wallet=replaySession(s,event=>events.push(event));
  const initial=events.filter(event=>event.type==='order'&&event.at===at);
  assert.equal(initial.length,vouchers);
  assert.equal(wallet.restockVouchers,0);
  const goals=T.sessionGoals(s,at,events);
  assert.equal(goals.some(goal=>goal.metric==='sellingMinutes'||goal.metric==='sales'||goal.metric==='tradingCoverage'),!!vouchers);
}

// Candidate scope aliases must not give the same sales a second job.
const overlapProfile=profile(['bakery','coffee'],{remaining:30,cash:1000,stops:false});
const salesPool=T.candidates(overlapProfile).filter(t=>t.metric==='sellingMinutes');
const bakeryOnly=salesPool.find(t=>t.ids.length===1&&t.ids[0]==='bakery-0');
const coffeeOnly=salesPool.find(t=>t.ids.length===1&&t.ids[0]==='coffee-1');
const bothShops=salesPool.find(t=>t.ids.length===2);
assert(!T.compatible(bakeryOnly,bothShops));
assert(T.compatible(bakeryOnly,coffeeOnly));
// An already paid delivery can land with an empty wallet. Crossing the
// two-hour cutoff by a minute must leave the delivery out of the set.
for(const pending of [119,120,121]) {
  const s=profile(['bakery'],{remaining:0,cash:0,stops:false});
  s.businesses[0].pending=pending;
  const events=[];
  replaySession(s,event=>events.push(event));
  assert(!events.some(e=>e.type==='order'));
  const goals=T.sessionGoals(s,at,events);
  assert.equal(goals.some(t=>t.metric==='delivery'),pending<=120);
}
// A disconnected bus stop cannot supply the sixth goal.
const busCity=profile(['bakery','coffee'],{remaining:76,cash:1000,stops:true});
busCity.stops[0].connected=false;
const busEvents=[];
replaySession(busCity,event=>busEvents.push(event));
assert(!busEvents.some(e=>e.type==='busVisit'));
assert(!T.sessionGoals(busCity,at,busEvents).some(t=>t.transport));

// Exercise daily variation, previous-day preference, and actual same-rank swaps.
let replacements=0;
for(let day=0;day<14;day++) {
  const time=at+day*1440*M,s=profiles.growing;
  const assigned=T.assign(null,s,'rotation-player',time);
  assert.equal(assigned.status,'ready');
  const changed=T.replace(assigned,assigned.tasks[0].key,s,time+M,'rotation-player');
  if(changed.changed) {
    replacements++;const replacement=changed.state.tasks[0];
    assert.equal(replacement.rank,assigned.tasks[0].rank);assert.deepEqual(replacement.reward,assigned.tasks[0].reward);
    assert.equal(replacement.progress,0);assert.equal(replacement.assignedAt,time+M);
    assert(!T.replace(changed.state,changed.state.tasks[1].key,s,time+2*M,'rotation-player').changed);
    assert.deepEqual(T.assign(changed.state,s,'rotation-player',time+3*M),changed.state);
  }
}
assert(replacements>0,'exercise real replacement path');
// Seven stable-city days with actually empty stock after the overnight absence.
report.completionWeek={};
for(const [name,source]of Object.entries(profiles)) {
  let completeDays=0,earned=0;
  const days=[];
  for(let day=0;day<7;day++) {
    const s=JSON.parse(JSON.stringify(source));
    if(day>0)for(const b of s.businesses){b.remaining=0;b.pending=null;}
    const result=simulate(s,'weekly-player',at+day*1440*M);
    if(result){completeDays++;earned+=result.dailyRewards.crateVouchers;days.push(result.completeAtMinute);}
    else days.push(null);
  }
  report.completionWeek[name]={completedDays:completeDays,taskVouchers:earned,completionMinutes:days,assumption:'fixed owned portfolio, two active hours daily, overnight stock expires; seven consecutive Brisbane reset periods'};
}
// All 115 live business/level combinations, with empty/full/near-empty stock.
for(const [id,p]of Object.entries(config))for(let level=1;level<=5;level++)for(const remaining of [0,30,p.stock]) {
  const s=profile([id],{remaining,stops:false,cash:0});s.businesses[0].rate=C.gross(defs[id],{lvl:level},p.jobs,p,rates);
  const pool=T.candidates(s);
  assert(!pool.some(t=>t.family==='orders'||t.family==='deliveries'),'zero wallet cannot fund an order');
  assert(pool.every(t=>t.eta<=120));
}
// Pending deliveries count without a second payment, but never >2h away.
let s=profile(['bakery'],{cash:0,stops:false});s.businesses[0].pending=10;
assert(T.candidates(s).some(t=>t.metric==='delivery'));assert(!T.candidates(s).some(t=>t.metric==='order'));
s.businesses[0].pending=121;assert(!T.candidates(s).some(t=>t.metric==='delivery'));
// Reward protocol fixture: explicitly synthetic, not proof of a ten-task profile.
const synthetic={status:'ready',day:C.cycle(at),assignedAt:at,receipts:{},tasks:Array.from({length:10},(_,i)=>({key:'t'+i,target:1,progress:1,assignedAt:at,claimed:false,reward:{crateVouchers:1,dosh:1,xp:[10,10,10,20,20,20,20,30,30,30][i]}}))};
let record={revision:0,wallet:{},daily:synthetic};
for(const t of synthetic.tasks) {
  const old=record,result=T.claim(record,t.key,at,record.revision);assert(result.ok);record=result.record;
  assert(!T.claim(record,t.key,at,record.revision).ok);
  assert(!T.claim(record,t.key,at,old.revision).ok,'stale-device compare-and-swap conflict');
}
assert.deepEqual(record.wallet,{crateVouchers:14,dosh:12,xp:220,restockVouchers:2,wheelTickets:2});
assert.equal(record.revision,10);assert.equal(Object.keys(record.daily.receipts).length,12);
assert(!T.claim(record,'t0',at+24*60*M,record.revision).ok);
// Two devices can compute a valid response from the same revision. Only the
// canonical store's atomic CAS makes one commit lose; reducer checks alone do not.
let canonical={revision:0,wallet:{},daily:JSON.parse(JSON.stringify(synthetic))};
const deviceA=T.claim(canonical,'t0',at,0),deviceB=T.claim(canonical,'t0',at,0);
assert(deviceA.ok&&deviceB.ok);
function commit(candidate,expected) {if(canonical.revision!==expected)return false;canonical=candidate;return true;}
assert(commit(deviceA.record,0));assert(!commit(deviceB.record,0));assert.equal(canonical.wallet.crateVouchers,1);
// Useful improvement gates and real funding reserve, including deeds.
const improve=profile(['bakery'],{cash:10000,stops:false});
improve.deeds=1;improve.improvements=[{variant:1,id:'upgrade-bakery',useful:true,unlocked:true,maxed:false,dosh:0,deeds:1,cost:1000,minutes:10}];
assert(T.candidates(improve).some(t=>t.improvement));
for(const patch of [{useful:false},{unlocked:false},{maxed:true},{dosh:1},{deeds:2},{cost:9000}]) {
  const altered=JSON.parse(JSON.stringify(improve));Object.assign(altered.improvements[0],patch);
  assert(!T.candidates(altered).some(t=>t.improvement));
}
// One voucher cannot fund several selected businesses at once.
const funding=profile(['bakery','coffee'],{remaining:0,cash:0,stops:false});funding.restockVouchers=1;
const selected=T.select(T.candidates(funding),'funding',[],funding);
assert(new Set(selected.tasks.flatMap(t=>(t.requiredOrders||[]).map(o=>o.id))).size<=1);
// Active intervals, duplicate delivery receipts, preassignment/away/replay guards.
let daily={...synthetic,tasks:[{key:'x',metric:'sellingMinutes',ids:['b'],target:60,progress:0,assignedAt:at},{key:'y',metric:'delivery',ids:['b'],target:1,progress:0,assignedAt:at}]};
const ev={id:'e1',type:'interval',from:at,at:at+M,active:true,foreground:true,facts:{b:{selling:true}}};
daily=T.progress(daily,ev);assert.equal(daily.tasks[0].progress,1);
assert.deepEqual(T.progress(daily,ev),daily);
daily=T.progress(daily,{...ev,id:'e2'});assert.equal(daily.tasks[0].progress,1,'overlapping interval rejected');
daily=T.progress(daily,{...ev,id:'away',from:at+M,at:at+2*M,foreground:false});assert.equal(daily.tasks[0].progress,1);
daily=T.progress(daily,{id:'d1',type:'delivery',subject:'b',at:at+3*M});assert.equal(daily.tasks[1].progress,1);
daily=T.progress(daily,{id:'d2',type:'delivery',subject:'b',at:at+4*M});assert.equal(daily.tasks[1].progress,1);
// Weekly values are conditional on completion, never a starter-city guarantee.
report.weekly={fullCompletion:{crateVouchers:98,dosh:84,restockVouchers:14,wheelTickets:14,xp:1540},wheelVoucherEV:.9+.2,with7Free:98+21*1.1,with14Free:98+28*1.1,legacyWeeklyTicketsExtra:3*1.1,levelTickets:'1 every five levels; variable, excluded',shopSpins:'0.66 expected vouchers if the five free offers are uniform',completionGuaranteed:false};
fs.mkdirSync(require('node:path').join(__dirname,'../docs'),{recursive:true});
fs.writeFileSync(require('node:path').join(__dirname,'../docs/daily-task-scenarios.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({profiles:Object.fromEntries(Object.entries(report.profiles).map(([k,v])=>[k,{status:v.status,count:v.count,candidates:v.candidates,searchExhausted:v.searchExhausted}])),weekly:report.weekly},null,2));
console.log('PASS: generator invariants, 345 stock/level cases, reset/reload, conditional reward totals, retry protocol and event progress. Adaptive assignments completed in the economy simulation.');
