'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const fn=name=>html.match(new RegExp('(?:async )?function '+name+'\\([^]*?\\n}'))[0];
const events=[];
const ctx={URL,namedPlay:true,username:'test-user',S:{crateConversion:{version:1}},SAVE_KEY:'save',
  saveJSON:()=>'fresh',localStorage:{setItem:(k,v)=>events.push(v)},toast(){},
  pushCity:async()=>{events.push('synced');return true;},location:{assign:v=>events.push(new URL(v))}};
vm.createContext(ctx);
vm.runInContext('let openingCityExchange=false;'+fn('openCityExchange'),ctx);
(async()=>{
  await Promise.all([ctx.openCityExchange(),ctx.openCityExchange()]);
  assert.equal(events.length,3);
  assert.equal(events[0],'fresh');assert.equal(events[1],'synced');
  assert.equal(events[2].pathname,'/banksia-exchange.html');assert.equal(events[2].searchParams.get('city'),'test-user');
  ctx.pushCity=async()=>false;events.length=0;await ctx.openCityExchange();assert.deepEqual(events,['fresh']);
  ctx.username='';events.length=0;await ctx.openCityExchange();assert.deepEqual(events,[]);
  const tile={id:'statue',diamondCopyId:'minted-1'};
  Object.assign(ctx,{anchorOf:()=>({i:2,j:1}),tileAt:()=>tile,vacate(){},DEFS:{statue:{name:'Bull'}},
    sel:null,changed(){}});
  vm.runInContext(fn('demolish'),ctx);ctx.demolish(2,1);
  assert.equal(ctx.S.storedBuildings[0].building,tile);
  assert.equal(ctx.S.shopItems,undefined);
  console.log('PASS sign-in and sync before Exchange navigation, double tap, failed sync and storing the same Diamond copy');
})().catch(e=>{console.error(e);process.exitCode=1});

// Exercise the city's claim button handler with the real daily claim ledger.
const Daily=require('../daily-task-core.js'),core=require('../economy-core.js');
const at=Date.UTC(2026,10,18,1);
const tasks=[10,10,10,20,20,20,20,30,30,30].map((xp,i)=>({
  key:'goal-'+i,target:1,progress:1,claimed:false,reward:{crateVouchers:1,dosh:1,xp}
}));
const claimCity={v:2,stars:50,crateVouchers:0,economyLab:{weekDays:[]},
  dailyGenerated:{revision:0,day:core.cycle(at),status:'ready',receipts:{},tasks}};
const claims={S:claimCity,Daily,now:()=>at,labState:()=>claims.S.economyLab,
  labAward:n=>{claims.S.xp=(claims.S.xp||0)+n;},labSyncTasks(){},changed(){},save(){},renderSheet(){}};
vm.createContext(claims);
vm.runInContext(fn('labDailyClaim'),claims);
for(const task of tasks){
  claims.labDailyClaim(task.key);
  claims.S=JSON.parse(JSON.stringify(claims.S));
  claims.labDailyClaim(task.key);
}
assert.deepEqual([claims.S.crateVouchers,claims.S.stars,claims.S.restockVouchers,claims.S.tickets,claims.S.xp],[14,62,2,2,220]);
assert.equal(claims.S.dosh,undefined);
const spend=require('../city-exchange.js').settleCityExchange(claims.S,'fixture',{playerId:'fixture',action:'buy-crate',tier:'emerald',sequence:1});
assert.equal(spend.crateVouchers,0);
assert.equal(spend.stars,62);
console.log('PASS ten reloaded daily claims fund an Emerald crate and credit the spendable dosh wallet once');
