'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const at = new Date(2026,10,17,18).getTime();
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
assert.equal(run('S.dailyGenerated.version'),5);
assert.equal(run('S.dailyGenerated.tasks.length'),10);
assert(run("S.dailyGenerated.tasks.every(t=>t.id.startsWith('city-')&&!t.ids.length)"));
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
assert(run("S.dailyGenerated.tasks.filter(t=>t.metric==='freeSpin').every(t=>t.progress===1)"));
const completed=run('S.dailyGenerated.tasks.filter(t=>t.progress>=t.target).length');
if(!completed)run('dailyAction(S.dailyGenerated.tasks[0].metric,S.dailyGenerated.tasks[0].target)');
const claimable=run('S.dailyGenerated.tasks.filter(t=>t.progress>=t.target).length');
run('for(const task of S.dailyGenerated.tasks)labDailyClaim(task.key)');
assert.equal(run('S.crateVouchers'),2*claimable);
const before = context.saved;
run('S=JSON.parse(saved);labDailyClaim(S.dailyGenerated.tasks.find(t=>t.claimed).key)');
assert.equal(context.saved,before);
context.time = at+86400000;
run('labSyncTasks()');
assert.equal(run('S.dailyGenerated.day'),'2026-11-18');
console.log('PASS: game assignment, settlement, claims, save/reload and reset');

const Daily=require('../daily-task-core.js');
assert(Daily.LIVE_TEMPLATES.length>=40);
assert.equal(new Set(Daily.LIVE_TEMPLATES.map(t=>t.id)).size,Daily.LIVE_TEMPLATES.length);
const fresh=Daily.liveBoard(null,at,'fixture');
assert.equal(fresh.tasks.reduce((sum,t)=>sum+(t.reward.wheelTickets||0),0),2);
assert(fresh.tasks.every(t=>t.reward.crateVouchers===2&&t.reward.dosh===3));
const active=board=>board.tasks.filter(t=>!t.archived);
assert.equal(active(fresh).length,10);
assert.equal(new Set(active(fresh).map(t=>t.family)).size,10);
assert.equal(Daily.liveBoard(fresh,at+3600000,'fixture'),fresh);
assert.deepEqual(Daily.liveBoard(null,at,'fixture'),fresh);
const reset=Daily.nextLocalReset(at);
assert.equal(new Date(reset).getHours(),18);
assert.equal(Daily.localDay(reset-1),'2026-11-17');
assert.equal(Daily.localDay(reset),'2026-11-18');
assert.notDeepEqual(active(Daily.liveBoard(fresh,reset,'fixture')).map(t=>t.id),active(fresh).map(t=>t.id));
const old={day:require('../economy-core.js').cycle(at),version:4,receipts:{previous:true},tasks:[
  {id:'old',key:'completed',target:1,progress:1,claimed:false,reward:{dosh:1}},
  {id:'old2',key:'unfinished',target:1,progress:0,claimed:false}
]};
const migrated=Daily.liveBoard(old,at,'fixture');
assert.equal(active(migrated).length,10);
assert.deepEqual(migrated.tasks.filter(t=>t.archived).map(t=>t.key),['completed']);
assert.equal(Daily.claim({daily:migrated,wallet:{},revision:0},'completed',at,0).ok,true);
const task=fresh.tasks[0];
Daily.liveProgress(fresh,task.metric,reset,1);
assert.equal(task.progress,0);
