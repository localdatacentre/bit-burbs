'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const copyId='diamond-fixture';
const ctx={S:{tiles:Array(64).fill(null),storedBuildings:[{building:{id:'statue',diamondCopyId:copyId,lvl:2}}]},
  fpOf:()=>[2,2],isStop:()=>false,modelReady:()=>true,buildingLimitMessage:()=>'',fpFree:()=>true,
  changed(){},save(){},snd(){},derive(){}};
ctx.setTile=(x,y,t)=>{ctx.S.tiles[y*8+x]=t;};
ctx.tileAt=(x,y)=>ctx.S.tiles[y*8+x];
ctx.anchorOf=(x,y)=>{const ref=ctx.tileAt(x,y)?.ref;return ref?{i:ref[0],j:ref[1]}:{i:x,j:y};};
vm.createContext(ctx);
for(const name of ['occupy','vacate','commitMove','restoreBuilding']){
  const fn=html.match(new RegExp('function '+name+'\\([^]*?\\n}'))[0];
  vm.runInContext(fn,ctx);
}
assert(ctx.restoreBuilding(ctx.S.storedBuildings[0],1,1));
assert(ctx.commitMove({source:{i:1,j:1},object:ctx.tileAt(1,1),turned:1},3,3));
ctx.S=JSON.parse(JSON.stringify(ctx.S));
assert.equal(ctx.tileAt(3,3).diamondCopyId,copyId);
assert.equal(ctx.S.tiles.filter(t=>t?.diamondCopyId===copyId).length,1);
assert.equal(ctx.S.storedBuildings.length,0);
console.log('PASS stored Diamond restoration, plot move, rotation, reload and single copy identity');

// Removing an ordinary retired model must preserve both kinds of owned
// Diamond buildings and their footprints, including unreleased models.
const cleanup=html.match(/function removeDeletedModels\([^]*?\n}/)[0];
const diamondIds=html.match(/const diamondBuildingIds = [^;]+;/)[0];
vm.runInContext(diamondIds+'\n'+cleanup,ctx);
const legacy={id:'needle',lvl:3}, minted={id:'statue',diamondCopyId:copyId};
const copied={tiles:[legacy,{id:'_occ',ref:[0,0]},minted,{id:'retired'}],
  shopItems:{sunhouse:2,needle:1,unreleasedPrototype:1,retired:1},
  storedBuildings:[{building:{id:'sunhouse'}},{building:{id:'retired'}}]};
const removed=new Set(['needle','statue','sunhouse','retired']);
assert.equal(ctx.removeDeletedModels(copied,removed),true);
assert.deepEqual(copied.tiles,[legacy,{id:'_occ',ref:[0,0]},minted,null]);
assert.deepEqual(copied.shopItems,{sunhouse:2,needle:1,unreleasedPrototype:1});
assert.deepEqual(copied.storedBuildings,[{building:{id:'sunhouse'}}]);
assert.equal(ctx.removeDeletedModels(copied,removed),false);
const demolish=html.match(/function demolish\([^]*?\n}/)[0];
Object.assign(ctx,{MARKET:{},DEFS:{needle:{name:'Observation Tower'}},sel:null,toast(){},anchorOf:()=>({i:0,j:0})});
ctx.S={tiles:[legacy],cash:50,items:{},shopItems:{}};
vm.runInContext(demolish,ctx);ctx.demolish(0,0);
assert.equal(ctx.S.storedBuildings[0].building,legacy);
assert.equal(ctx.S.storedBuildings[0].building.lvl,3);
assert.equal(ctx.S.cash,50);
console.log('PASS legacy and minted Diamond holdings survive catalogue changes, and packing retains the legacy item');

const place=html.match(/function placeAt\([^]*?\n}/)[0];
Object.assign(ctx,{inB:()=>true,newTile:id=>({id}),labState:()=>({nextId:0}),track(){},labDevelopment(){},popup(){}});
ctx.DEFS.needle.type='decor';
ctx.S={tiles:Array(64).fill(null),cash:50,items:{needle:1},shopItems:{needle:1}};
vm.runInContext(place,ctx);
assert.equal(ctx.placeAt(0,0,'needle',false),false);
assert.equal(ctx.placeAt(0,0,'needle',true),true);
assert.equal(ctx.tileAt(0,0).id,'needle');
assert.equal(ctx.S.shopItems.needle,0);
assert.equal(ctx.S.cash,50);
console.log('PASS previously owned Diamond buildings can be placed from the bag');
