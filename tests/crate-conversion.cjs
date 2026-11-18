'use strict';
const assert=require('node:assert/strict');
const {prepareCrateConversion:convert}=require('../crate-conversion.js');
const city={v:2,crates:{steel:1,gold:2,diamond:3,premium:4},crateVouchers:11,
  restockVouchers:4,tickets:8,boostUntil:1700012345678,tiles:[{id:'statue'}],shopItems:{statue:1},stars:30};
const before=structuredClone(city),result=convert(city);
assert.deepEqual(city,before);
assert.equal(result.crateVouchers,187);
assert.equal(result.crateConversion.added,176);
assert.deepEqual(result.crates,{});
for(const k of ['restockVouchers','tickets','boostUntil','tiles','shopItems','stars']) assert.deepEqual(result[k],city[k]);
const retry=JSON.parse(JSON.stringify(result));retry.crates={diamond:1};assert.strictEqual(convert(retry),retry);
assert.equal(convert({v:2}).crateVouchers,0);
assert.equal(convert({v:2,crates:{silver:1,wood:2},keys:{steel:4,gold:3,diamond:2}}).crateVouchers,50);
for(const bad of [{crates:{diamond:-1}},{crates:{emerald:1}},{crateConversion:{version:2}},
  {crateVouchers:Number.MAX_SAFE_INTEGER,crates:{gold:1}},{keys:{unknown:1}}])assert.throws(()=>convert({v:2,...bad}));
console.log('PASS legacy tiers, keys, existing balances, retry, unsupported records and no mutation');
