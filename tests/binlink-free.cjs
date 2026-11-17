'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function gameFunction(name,bindings) {
  const start=html.indexOf('function '+name+'(');
  assert(start>=0);
  const end=html.indexOf('\n}',start)+2;
  return Function(...Object.keys(bindings),'return '+html.slice(start,end))(...Object.values(bindings));
}
const S={cash:0};
const tiles=[{id:'hailStop',purchaseCoins:675},{id:'busShelter',purchaseCoins:2025}];
const isStop=id=>id==='hailStop'||id==='busShelter';
const noop=()=>{};
const costOf=gameFunction('costOf',{parkSizes:{},isStop,BUILDING_QUOTES:{}});
const refund=gameFunction('demolitionRefund',{isStop,MARKET:{}});
for(const tile of tiles) {
  assert.equal(costOf(tile.id),0);
  assert.equal(refund(tile),0);
  assert.equal(refund({id:tile.id}),0);
}
const stops=tiles.map(t=>({t,x:0,y:0,dx:1,dy:0}));
const service=gameFunction('serviceBuses',{S,buses:[],streetMap:()=>({stops,buildings:[],roads:new Map()}),
  stopInterval:600,dropPassengers:noop,changed:noop,N:32});
service(599);
assert.equal(tiles[0].visits,undefined);
service(1);
service(1200);
assert.equal(S.cash,0);
assert.deepEqual(tiles.map(t=>t.visits),[3,3]);
let capped=true;
const upgrade=gameFunction('upgradeStop',{S,tileAt:()=>tiles[0],modelReady:()=>true,
  buildingLimitMessage:()=>capped?'limit':'',streetNetwork:null,changed:noop,save:noop});
assert.equal(upgrade(0,0),false);
capped=false;
assert.equal(upgrade(0,0),true);
assert.equal(tiles[0].id,'busShelter');
assert.equal(S.cash,0);
