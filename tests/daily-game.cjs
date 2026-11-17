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
let S={cash:10000,level:1,economyLab:{version:1,balanceVersion:2,lastAction:at,settled:at,nextId:0,weekDays:[]}};
const tile={id:'bakery',lvl:1,pr:[{s:at+30*60000,o:0}]};
const D={list:[{t:tile,d:DEFS.bakery,employees:3,ok:true,pow:true,wat:true}]};
const now=()=>time, labState=()=>S.economyLab, streetMap=()=>({stops:[]});
const labAward=n=>Core.award(S,n),changed=()=>{},renderSheet=()=>{};
const save=()=>{saved=JSON.stringify(S)};
`+html.slice(html.indexOf('const Daily = window.DailyTasks;'),html.indexOf('function labWeeklyClaim')),context);
const run = code => vm.runInContext(code,context);
run('labSyncTasks()');
assert(run('S.dailyGenerated.tasks.length')>=3);
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
assert(run('S.dailyGenerated.tasks.every(t=>t.progress>=t.target)'));
run('for(const task of S.dailyGenerated.tasks)labDailyClaim(task.key)');
assert.equal(run('S.crateVouchers'),run('S.dailyGenerated.tasks.length'));
const before = context.saved;
run('S=JSON.parse(saved);labDailyClaim(S.dailyGenerated.tasks[0].key)');
assert.equal(context.saved,before);
context.time = at+86400000;
run('labSyncTasks()');
assert.equal(run('S.dailyGenerated.day'),'2026-11-18');
console.log('PASS: game assignment, settlement, claims, save/reload and reset');
