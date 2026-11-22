'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const at = Date.parse('2026-11-17T08:00:00Z');
const minute = 60000;
const context = vm.createContext({at, time:at, document:{hidden:false}, saved:null});
context.window = context;
for (const name of ['economy-core.js','daily-task-core.js','daily-task-session.js']) vm.runInContext(read(name),context);
const html = read('index.html');
for (const [,script] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(script);
vm.runInContext(`
const Core=LabCore, ECON={bakery:{jobs:3,stock:150,delivery:3,fee:.04,factor:1}};
const DEFS={bakery:{type:'shop',cat:'retail',cost:100}};
const businessRates={bakery:[10,10,10,10,10]};
let S={tiles:[],cash:10000,level:1,economyLab:{version:1,balanceVersion:2,lastAction:at,settled:at,nextId:0,weekDays:[]}};
const tile={id:'bakery',lvl:1,pr:[{s:at+30*60000,o:0}]};
const D={list:[{t:tile,d:DEFS.bakery,employees:3,ok:true,pow:true,wat:true}]};
const now=()=>time, labState=()=>S.economyLab, username='fixture';
const WHEEL_CD=43200000, BUILD_TABS=[], cityDecorationIds=new Set();
const nextDailyReset=at=>Date.parse(Core.cycle(at)+'T08:00:00Z')+86400000;
const canUp=()=>false, modelReady=()=>false, costOf=()=>1, isStop=()=>false; DEFS.hall={lvl:1};

const labAward=n=>Core.award(S,n),changed=()=>{},renderSheet=()=>{};
const save=()=>{saved=JSON.stringify(S)};
`+html.slice(html.indexOf('const Daily = window.DailyTasks;'),html.indexOf('function economyMigrate')),context);
const run = code => vm.runInContext(code,context);
run('labSyncTasks()');
assert.equal(run('S.dailyGenerated.version'),3);
assert(run('S.dailyGenerated.tasks.length>=1'));
assert(run("S.dailyGenerated.tasks.every(t=>t.id.startsWith('city-')&&!t.ids.length)"));
assert.equal(run("S.dailyGenerated.tasks.some(t=>t.metric==='rentHomes'||t.metric==='upgradeAny'||t.metric==='sellingStores')"),false);
const keys = run('JSON.stringify(S.dailyGenerated.tasks.map(t=>t.key))');
run('save();S=JSON.parse(saved);labSyncTasks()');
assert.equal(run('JSON.stringify(S.dailyGenerated.tasks.map(t=>t.key))'),keys);
for (let tick=1;tick<=120;tick++) {
  context.time = at+tick*minute;
  run(`S.economyLab.lastAction=time;
  if(tile.pr[0].s<=time&&!tile.pr[0].o){
    tile.pr[0].o=time+3*60000;
    dailyEvent({type:'order',subject:tile.labId,id:'order:'+time,at:time});
  }
  dailySettlement(time-60000,time,false);
  Core.settle(S,D.list,time,ECON,businessRates);`);
}
run('labSyncTasks()');
assert.equal(run("S.dailyGenerated.tasks.some(t=>t.metric==='trade')"),false);
run("dailyAction('freeSpin')");
assert.equal(run("S.dailyGenerated.tasks.find(t=>t.metric==='freeSpin').progress"),1);
const completed=run('S.dailyGenerated.tasks.filter(t=>t.progress>=t.target).length');
assert(completed>0);
run('for(const task of S.dailyGenerated.tasks)labDailyClaim(task.key)');
assert.equal(run('S.crateVouchers'),completed);
const before = context.saved;
run('S=JSON.parse(saved);labDailyClaim(S.dailyGenerated.tasks[0].key)');
assert.equal(context.saved,before);
context.time = at+86400000;
run('labSyncTasks()');
assert.equal(run('S.dailyGenerated.day'),'2026-11-18');
console.log('PASS: game assignment, settlement, claims, save/reload and reset');

const Daily=require('../daily-task-core.js');
const empty={businesses:[],horizon:120,cash:0,restockVouchers:0};
const oldTask={id:'legacy',key:'legacy',target:1,progress:1,claimed:true,reward:{dosh:1}};
const replaced=Daily.liveBoard({day:'2026-11-17',tasks:[oldTask,{...oldTask,key:'unfinished',progress:0,claimed:false}],receipts:{legacy:true}}, {...empty,canRoad:true},at,'starter');
assert.deepEqual(replaced.tasks.map(t=>t.metric),[undefined,'buildRoad']);
assert.equal(replaced.receipts.legacy,true);
Daily.liveProgress(replaced,'buildRoad',at);
const readyTask=replaced.tasks[1];
const grown=Daily.liveBoard(replaced,{...empty,canRoad:true,canBuild:true},at+60000,'starter');
assert.equal(grown.tasks[1],readyTask);
assert.equal(readyTask.progress,1);
assert(grown.tasks.some(t=>t.metric==='buildAny'));
const fullCity={...empty,rentHomes:4,rentCoins:2500,businesses:Array.from({length:6},(_,i)=>({
  id:String(i),connected:true,employees:4,rate:100,remaining:30,pending:null,fee:10
}))};
const full=Daily.liveBoard(null,fullCity,at,'full');
assert(full.tasks.every(t=>!['roadwork','project','restore','supplies'].includes(t.family)));
assert.equal(new Set(full.tasks.map(t=>t.family)).size,full.tasks.length);
const lots={version:3,day:'2026-11-17',revision:0,tasks:[{metric:'cityOrder',target:2,progress:0,assignedAt:at}]};
Daily.liveProgress(lots,'cityOrder',at,1,'shop-a');
Daily.liveProgress(lots,'cityOrder',at,1,'shop-a');
assert.equal(lots.tasks[0].progress,1);
Daily.liveProgress(lots,'cityOrder',at+86400000,1,'shop-b');
assert.equal(lots.tasks[0].progress,1);

const prior={day:'2026-11-17',version:2,tasks:[
  {...readyTask,metric:'trade',key:'timer',progress:0},
  {...readyTask,metric:'trade',key:'finished-timer'},
  {...readyTask,metric:'buildRoad',key:'road',progress:0}
]};
const migrated=Daily.liveBoard(prior,empty,at,'starter');
assert.deepEqual(migrated.tasks.map(t=>t.key),['finished-timer','road']);
