'use strict';
const assert=require('node:assert/strict');
const {rehearseCrateRelease:run}=require('../rehearse-crate-release.cjs');
const canonical='a'.repeat(64); // Synthetic fixture identity only
const stages={crates:true,wheel:true};
const models=['tidalBaths','civicClock',...Array(7).fill('needle')];
const plots=models.map((model,n)=>({index:n*4,model}));
const tiles=Array(64).fill(null);
for(const {index,model} of plots){
  tiles[index]={id:model};
  tiles[index+1]={id:'_occ',ref:[index%8,Math.floor(index/8)]};
}
tiles[40]={id:'needle',diamondCopyId:'later-edition'};
tiles[41]={id:'_occ',ref:[0,5]};
const city={v:2,cash:101.5,stars:9,tiles,storedBuildings:[{building:{id:'needle'}}],
  items:{needle:2},shopItems:{needle:2},crates:{steel:1,gold:1,diamond:1,premium:1},
  crateVouchers:3,restockVouchers:5,tickets:7,boostUntil:12345};
const snapshot={canonical,city,progress:'unchanged'};
const review={canonical,coins:1302750,dosh:200,plots};
const orig=structuredClone(snapshot);
const first=run(snapshot,review,stages);
assert.deepEqual(snapshot,orig);
assert.equal(first.city.cash,1302851.5);
assert.equal(first.city.stars,209);
assert.equal(first.city.crateVouchers,55);
for(const {index} of plots)assert.deepEqual(first.city.tiles.slice(index,index+2),[null,null]);
assert.deepEqual(first.city.tiles.slice(40),tiles.slice(40));
for(const key of ['storedBuildings','shopItems','items','restockVouchers','tickets','boostUntil'])assert.deepEqual(first.city[key],city[key]);
const repeat=run(JSON.parse(JSON.stringify(first)),review,stages);
assert.deepEqual(repeat,first);
// A delayed retry can arrive after the player has already spent the credit
// and built on one of the vacated plots. A receipt must also protect that save.
const played = structuredClone(first);
played.city.cash -= 20000;
played.city.stars -= 10;
played.city.crateVouchers -= 14;
const reused = review.plots[0].index;
played.city.tiles[reused] = {id: 'needle', diamondCopyId: 'newly-placed-copy'};
played.city.tiles[reused + 1] = {id: '_occ', ref: [reused % 8, Math.floor(reused / 8)]};
played.city.storedBuildings.push(
  {building: {id: 'sakura', diamondCopyId: 'packed-after-release'}},
  {id: 'sunhouse'}
);
const afterPlay = JSON.parse(JSON.stringify(played));
assert.deepEqual(run(played, review, stages), afterPlay);
assert.deepEqual(played, afterPlay);
console.log('PASS delayed refund retry preserves spending, rebuilt plots and newly packed buildings');
// Reject incomplete footprints before preparing a removal or credit.
for(const broken of [{id:'_occ'},{id:'_occ',ref:[0,0,0]},{id:'_occ',ref:[7,7]},{id:'_occ',ref:[1,0]}]){
  const damaged=structuredClone(snapshot);
  damaged.city.tiles[1]=broken;
  const saved=structuredClone(damaged);
  assert.throws(()=>run(damaged,review,stages),/footprint/);
  assert.deepEqual(damaged,saved);
}
assert.throws(()=>run(first,{...review,dosh:250},stages),/differs/);
assert.throws(()=>run(snapshot,{...review,canonical:'b'.repeat(64)},stages),/Account/);
assert.throws(()=>run(snapshot,{...review,plots:plots.slice(1)},stages),/plots differ/);
assert.throws(()=>run(snapshot,review,{wheel:false,crates:true}),/Both/);
console.log('PASS combined four-tier conversion, nine legacy plots, fixed compensation, separate stored items, release gates and unchanged second run on synthetic copy');
