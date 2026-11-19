const assert=require('node:assert/strict');
const {previewDiamondRefund:preview}=require('../diamond-refund-preview.js');
const city={tiles:[{id:'statue'},{id:'_occ'},{id:'statue',diamondCopyId:'shared-copy'}],storedBuildings:[{building:{id:'statue'}},{id:'fountain'}],shopItems:{statue:1},items:{statue:3,sakura:1},market:{bought:{statue:1,needle:1}},cash:500,stars:15};
const copy=structuredClone(city),first=preview(copy),bull=first.find(x=>x.id==='statue');
assert.equal(bull.copies,3);assert.deepEqual(bull.plots,[0]);assert.deepEqual(bull.stored,[0]);assert.equal(bull.bag,1);
assert.equal(first.find(x=>x.id==='needle').copies,0);assert.equal(first.find(x=>x.id==='fountain').copies,1);
assert.deepEqual(first,preview(copy));assert.deepEqual(city,copy);
console.log('PASS repeated refund preview, separate placements/storage/bag, shared-copy and overlap exclusion, no payout or mutation');
