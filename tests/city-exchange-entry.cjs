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
