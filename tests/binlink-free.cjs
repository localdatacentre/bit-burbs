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
  stopInterval:600,dailyEvent:noop,now:()=>0,document:{hidden:false},labState:()=>({lastAction:0}),dropPassengers:noop,changed:noop,N:32});
service(599);
assert.equal(tiles[0].visits,undefined);
service(1);
service(1200);
assert.equal(S.cash,0);
assert.deepEqual(tiles.map(t=>t.visits),[3,3]);
assert.deepEqual(tiles.map(t=>t.id),['hailStop','busShelter']);
assert(!html.includes('shelterUpgrade') && !html.includes('function upgradeStop('));
const config=JSON.parse(html.match(/window.BB_ECONOMY=(\{.*?\});<\/script>/)[1]);
const DEFS=Function('ECON',html.slice(html.indexOf('const DEFS ='),html.indexOf('const SVC_NAMES ='))+';return DEFS;')(config);
const canUp=Function('return '+html.match(/^const canUp = (.*);$/m)[1])();
const upRow=gameFunction('upRow',{canUp});
for(const id of ['hailStop','busShelter','parkSmall','parkLarge','parkXL']) {
  const tile={id,lvl:1};
  assert.equal(canUp(DEFS[id]),false);
  assert.equal(upRow(tile,DEFS[id]),'');
  gameFunction('upgrade',{tileAt:()=>tile,DEFS,canUp})(0,0);
  assert.deepEqual(tile,{id,lvl:1});
}

S.tiles=[];
S.storedBuildings=[];
S.level=1;
const stopCount=gameFunction('stopCount',{S});
const buildingLimitMessage=gameFunction('buildingLimitMessage',{stopCount,isStop,parkSizes:{}});
const ids=['hailStop','busShelter'];
const renderShop=gameFunction('buildHTML',{S,BUILD_TABS:[['transport','Transport',ids]],
  buildTab:'transport',buildTarget:null,modelReady:()=>true,costOf,DEFS,buildingLimitMessage,isStop,isBiz:()=>false});
for(const id of ids) {
  const other=ids.find(key=>key!==id);
  const card=()=>renderShop().match(new RegExp('data-id="'+id+'"[^>]*>[\\s\\S]*?</button>'))[0];
  assert(card().includes('Free · One per city') && card().includes('aria-disabled="false"'));
  S.storedBuildings=[{building:{id}}];
  assert(card().includes('Free · One per city') && card().includes('aria-disabled="true"'));
  assert.equal(buildingLimitMessage(other),'');
  assert.equal(buildingLimitMessage(id,true),'');
  S.tiles=[{id}];
  S.storedBuildings=[];
  assert(buildingLimitMessage(id,true));
  S.tiles=[];
}

for(const length of [1,5]) {
  const roads=new Map();
  for(let x=-length;x<=length;x++)roads.set(x,{arms:[0,2]});
  const legacyStops=Array.from({length:10},(_,i)=>({
    t:{id:i<5?'hailStop':'busShelter',visits:1},x:0,y:0,dx:1,dy:0,sx:0,sy:1,dir:0
  }));
  const buses=[];
  const map={roads,stops:legacyStops,buildings:legacyStops};
  gameFunction('serviceBuses',{buses,streetMap:()=>map,stopInterval:600,N:32})(0);
  assert.equal(buses.length,legacyStops.length);
  assert(buses.every(bus=>bus.base===64 && bus.half===.72));
}
