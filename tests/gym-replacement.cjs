'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(process.env.SOURCE||path.join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('function replaceLegacyGyms(city) {');
const source=html.slice(start,html.indexOf('\nfunction standardiseCoinBoosts',start));
const N=8,ctx={N,BUILDING_QUOTES:{gym:{first:58120}},fpOf:(id,turned)=>turned%2?[1,2]:[2,1],inB:(x,y)=>x>=0&&y>=0&&x<N&&y<N};
vm.createContext(ctx);vm.runInContext(source+';this.replace=replaceLegacyGyms;',ctx);
for(const turned of [0,1])for(const blocked of [false,true]) {
 const old={id:'gym',lvl:4,turned,hired:9,labId:'legacy-1',pr:[{s:123,o:456}]};
 const city={lo:0,cash:1234,stars:56,tiles:Array(N*N).fill(null),storedBuildings:[]};
 city.tiles[18]=old;
 const next=turned?26:19;
 if(blocked)city.tiles[next]={id:'house',lvl:3};
 ctx.replace(city);
 assert.equal(old.id,'orbital-gym');assert.equal(old.lvl,4);assert.equal(old.hired,9);
 assert.equal(old.purchaseCoins,58120);assert.equal(old.labId,'legacy-1');
 assert.deepEqual(old.pr,[{s:123,o:456}]);assert.equal(city.cash,1234);assert.equal(city.stars,56);
 if(blocked) {
  assert.equal(city.tiles[next].id,'house');assert.equal(city.tiles[18],null);
  assert.equal(city.storedBuildings.length,1);assert.equal(city.storedBuildings[0].building,old);
 } else {
  assert.equal(city.tiles[18],old);assert.equal(city.tiles[next].id,'_occ');
 }
 const once=JSON.stringify(city);ctx.replace(city);assert.equal(JSON.stringify(city),once);
}
const city={lo:0,tiles:Array(N*N).fill(null),storedBuildings:[{building:{id:'gym',lvl:5,purchaseCoins:40000}},{building:{id:'orbital-gym',lvl:2}}]};
city.tiles[7]={id:'gym',lvl:2};
ctx.replace(city);
assert.equal(city.tiles[7],null);assert.equal(city.storedBuildings.length,3);
assert.equal(city.storedBuildings[0].building.id,'orbital-gym');
assert.equal(city.storedBuildings[0].building.purchaseCoins,40000);
assert.equal(city.storedBuildings[1].building.lvl,2);
const tab=html.match(/\['businesses', 'Businesses', (\[.*?\])\]/)[1];
assert(!tab.includes("'gym'"));assert(tab.includes("'orbital-gym'"));
console.log('PASS: Forge purchase entry retired; placed, blocked, rotated, edge and stored gyms convert once with levels, timers, hiring, purchase basis and balances preserved');
