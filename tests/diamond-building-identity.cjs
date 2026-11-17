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
