'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {C,config,defs,quotes,rates,harness,extract,html}=require('./economy-audit-harness.cjs');
const at=Date.parse('2026-11-17T08:00:00Z'),M=60000;
const report={baseline:'83fee17bd4793ec5ae470445002d299caadceef2',assumptions:{sessionMinutes:120,dayMinutes:1440,world:'economy derive-state harness; road connections stubbed as valid, no physical layout claim',rewardSystem:'current live five-task system, optional live crate opening; future ten-task rewards not credited',growth:'deterministic illustrative strategy, not a speedrun bound or observed player'},scenarios:[],edgeChecks:[],findings:[]};
function rng(seed){let x=seed;return()=>{x=(Math.imul(1664525,x)+1013904223)|0;return(x>>>0)/4294967296;};}
function milestones(s){return {level:s.level,coins:Math.round(s.cash),dosh:s.stars,deeds:s.deeds,XP:s.xp,tickets:s.tickets,buildings:s.tiles.filter(t=>t&&!['road','_occ'].includes(t.id)).length};}
function simulate({name,growth=false,openCrates=false,idle=false,days=150,seed=7}){
 const h=harness(),r=rng(seed),safeMath=Object.create(Math);safeMath.random=r;h.s.Math=safeMath;
 h.s.S=h.call('newGame');h.s.S.economyLab={version:1,balanceVersion:2,settled:at,lastAction:at};
 vm.runInContext(html.slice(html.indexOf('Core.onLevel='),html.indexOf('function labState()')),h.ctx);
 vm.runInContext(html.slice(html.indexOf('const coins = (low, high)'),html.indexOf('const BOARD =')),h.ctx);
 for(const fn of ['rollReward','resolveR','grant'])vm.runInContext(extract(fn),h.ctx);
 h.s.rewLabel=()=>'';
 let slot=0,capital=0,restockFees=0,totalSales=0,taskDays=0,crateOpens=0,first100=null;
 const purchases=[];
 function build(id){
  const cost=h.call('costOf',id);if(defs[id].lvl>h.s.S.level||h.s.S.cash<cost+100)return null;
  const i=slot%h.s.N,j=Math.floor(slot/h.s.N);slot++;
  if(!h.call('placeAt',i,j,id,false))return null;
  capital+=cost;h.derive();purchases.push({day:Math.floor((h.s.clock-at)/(1440*M))+1,id,cost});
  return h.s.S.tiles[j*h.s.N+i];
 }
 for(const id of ['hall','wind','wtower','house','bakery','deliveryDepot'])build(id);
 // Explicit road capital/XP without asserting a valid physical city layout.
 for(let n=0;n<8;n++)build('road');h.derive();
 function tryGrowth(){
  if(!growth)return;
  const s=h.s.S,D=h.s.D;
  const reserve=100+D.list.filter(b=>config[b.t.id]).reduce((n,b)=>n+C.fee(b.d,b.t,b.employees,config[b.t.id],rates),0)*2;
  if(s.cash<reserve+1000)return;
  const next=Object.keys(config).filter(id=>defs[id].lvl<=s.level&&!s.tiles.some(t=>t?.id===id)&&h.call('costOf',id)+reserve<s.cash).sort((a,b)=>h.call('costOf',a)/C.gross(defs[a],{lvl:1},config[a].jobs,config[a],rates)-h.call('costOf',b)/C.gross(defs[b],{lvl:1},config[b].jobs,config[b],rates))[0];
  if(D.cap<D.jobs+(next?config[next].jobs:3)){
   const upgrade=D.homes.filter(b=>(b.t.lvl||1)<3).sort((a,b)=>h.call('upCost',a.d,a.t.lvl||1).coins-h.call('upCost',b.d,b.t.lvl||1).coins)[0];
   if(upgrade){const c=h.call('upCost',upgrade.d,upgrade.t.lvl||1);if(s.cash>=c.coins+reserve&&s.deeds>=c.deeds){capital+=c.coins;h.call('upgrade',upgrade.i,upgrade.j);h.derive();return;}}
   const homes=['house','house2','m3','q1','banksiaDuplex','aptS','aptP','town','tower','quay','southerly-tower'].filter(id=>defs[id].lvl<=s.level&&h.call('costOf',id)+reserve<s.cash).sort((a,b)=>h.call('costOf',a)/defs[a].cap-h.call('costOf',b)/defs[b].cap);
   if(homes.length){build(homes[0]);return;}
  }
  if(D.supP-D.useP<Math.max(6,defs[next]?.pw||0)||D.supW-D.useW<Math.max(5,defs[next]?.wa||0)){
   const type=D.supP-D.useP<Math.max(6,defs[next]?.pw||0)?'supP':'supW';
   const candidates=['wind','solar','solar2','nuclear','wtower','pump'].filter(id=>defs[id][type]&&defs[id].lvl<=s.level&&h.call('costOf',id)+reserve<s.cash).sort((a,b)=>h.call('costOf',a)/defs[a][type]-h.call('costOf',b)/defs[b][type]);
   if(candidates.length){build(candidates[0]);return;}
  }
  const options=Object.keys(config).filter(id=>defs[id].lvl<=s.level&&!h.s.S.tiles.some(t=>t?.id===id)&&h.call('costOf',id)+reserve<s.cash&&D.cap>=D.jobs+config[id].jobs&&D.supP-D.useP>=(defs[id].pw||0)&&D.supW-D.useW>=(defs[id].wa||0)).sort((a,b)=>h.call('costOf',a)/C.gross(defs[a],{lvl:1},config[a].jobs,config[a],rates)-h.call('costOf',b)/C.gross(defs[b],{lvl:1},config[b].jobs,config[b],rates));
  if(options.length)build(options[0]);
 }
 const checkpoints={};
 for(let day=0;day<days;day++){
  h.s.clock=at+day*1440*M;
  if(day>0)h.call('labAccrue',h.s.clock,true);
  for(let minute=0;minute<120;minute++){
   if(!idle)h.call('labState').lastAction=h.s.clock;
   if(growth&&minute%15===0)tryGrowth();
   h.derive();const plan=h.call('depotPlan',h.s.clock);
   if((!idle||day===0&&minute===1)&&plan.selected.length&&plan.fee<=h.s.S.cash){restockFees+=plan.fee;h.call('manualRestock',plan.fee);}
   totalSales+=h.advance(1,false);
   if(openCrates){
    let limit=0;
    for(const tier of ['steel','gold','diamond','premium'])while((h.s.S.crates[tier]||0)>0&&limit++<100){
     const rewards=vm.runInContext(`drawCrateRewards(CRATES.${tier})`,h.ctx);h.s.S.crates[tier]--;for(const reward of rewards)h.call('grant',reward);h.call('addXP',10);crateOpens++;
    }
   }
  }
  h.call('labSyncTasks');
  if(!idle){
   // These are the three real menu reviews required by the CURRENT live task.
   h.call('labState').reviews=['build','tasks','settings'];h.call('labSyncTasks');
   for(let i=0;i<5;i++)h.call('labDailyClaim',i);
   if(h.s.S.daily.every(t=>t.done))taskDays++;
   h.call('labWeeklyClaim');
  }
  if(h.s.S.level>=100&&first100===null)first100=day+1;
  if([0,6,29,59,89,119,149].includes(day))checkpoints['day'+(day+1)]={...milestones(h.s.S),population:h.s.S.pop,jobs:h.s.D.jobs,taskDays};
  // Closed time earns 50% and never auto-orders. Also include it in total sales.
  totalSales+=h.advance(1320,true);
 }
 assert(h.s.S.cash>=0);assert(h.s.S.level<=100);assert(h.s.S.pop<=h.s.D.cap);
 const out={name,daysTo100:first100,capitalSpent:capital,restockFees,totalBusinessIncome:Math.round(totalSales),taskDays,crateOpens,checkpoints,final:milestones(h.s.S),purchaseLog:purchases};
 report.scenarios.push(out);
 C.onLevel=null;
 return out;
}
for(const scenario of [{name:'starter-active-live',growth:false},{name:'growing-active-live',growth:true},{name:'growing-active-live-with-crates',growth:true,openCrates:true},{name:'starter-visible-idle',idle:true}])simulate(scenario);
// Pure budget bounds separate from simulated economies and spent capital.
const XP=Array.from({length:99},(_,i)=>C.need(i+1)).reduce((a,b)=>a+b,0);
report.budgetBounds=[
 {label:'prior budget: 720 operations + 220 tasks + 100 development + 200 weekly average',XPPerDay:1240,days:XP/1240},
 {label:'no recurring development: 720 + 220 + 200',XPPerDay:1140,days:XP/1140},
 {label:'100 selling minutes: 600 + 220 + 200',XPPerDay:1020,days:XP/1020},
 {label:'114 selling minutes: 684 + 220 + 200 + 14 restock XP',XPPerDay:1118,days:XP/1118}
];
// Road XP is outside the daily development cap, unlike unique buildings.
{
 const h=harness();h.s.S.cash=100000;const before=h.s.S.level;
 for(let i=0;i<250;i++){h.call('placeAt',i%h.s.N,Math.floor(i/h.s.N),'road',false);h.call('demolish',i%h.s.N,Math.floor(i/h.s.N));}
 const spent=100000-h.s.S.cash;
 report.findings.push({id:'road-xp-outside-development-cap',severity:'balance gap',summary:'Repeated road construction awards one XP each time outside the 100 daily development XP limit; road demolition gives no refund.',evidence:{placements:250,XPGranted:250,coinsSpent:spent,levelBefore:before,levelAfter:h.s.S.level,coinsPerXP:spent/250},limit:'Ordinary road building is intended to grant XP; this test identifies an uncapped paid repeat action, not a normal-play level-100 time.'});
}
// The ten-minute interaction window is a grace period, not interaction-only time.
report.findings.push({id:'activity-window-assumption',severity:'model limitation',summary:'Live operation XP considers the game active for ten minutes after a trusted interaction. A simulation touching every minute assumes attended play; a visible untouched city stops earning operation XP after the grace window, while coins remain full rate.'});
fs.writeFileSync(path.join(__dirname,'../docs/economy-progression-audit-results.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({scenarios:report.scenarios.map(({purchaseLog,...s})=>s),budgetBounds:report.budgetBounds,findings:report.findings},null,2));
