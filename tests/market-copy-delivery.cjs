'use strict';
const assert = require('node:assert/strict');
const {deliverMarketCopies} = require('../market-copy-delivery.js');
const seller = 'a'.repeat(64), buyer = 'b'.repeat(64);
const cityKey = 'live-city/roster2/' + seller, ledgerKey = 'exchange/v2/ledger';
const copy = {id:'first-copy',origin:seller,owner:seller,model:'statue',minted:1,receipt:'receipt-1',state:'inventory'};
const records = new Map();
let rev = 0;
function save(key, record) {records.set(key,{etag:String(++rev),raw:JSON.stringify(record)});}
const read = key => JSON.parse(records.get(key).raw);
save(cityKey,{city:{stars:8},crateExchange:{pendingCopies:[copy]}});
save('exchange/v1/ledger',{assets:[{id:'demo'}]});
let interrupt = true;
const bucket = {
  async get(key) {const r=records.get(key);return r && {etag:r.etag,json:async()=>JSON.parse(r.raw)};},
  async put(key,raw,{onlyIf}) {
    if (key===cityKey && interrupt) {interrupt=false;throw Error('connection lost');}
    const old=records.get(key);
    if (old ? old.etag!==onlyIf.etagMatches : onlyIf.etagDoesNotMatch!=='*') return null;
    save(key,JSON.parse(raw));return records.get(key);
  }
};
(async()=>{
  await assert.rejects(deliverMarketCopies(bucket,seller),/connection lost/);
  const market=read(ledgerKey);
  assert.deepEqual(market.assets,[copy]);
  market.assets[0].owner=buyer;
  save(ledgerKey,market);
  await Promise.all([deliverMarketCopies(bucket,seller),deliverMarketCopies(bucket,seller)]);
  assert.deepEqual(read(ledgerKey).assets,[{...copy,owner:buyer}]);
  assert.deepEqual(read(cityKey),{city:{stars:8},crateExchange:{pendingCopies:[]}});
  save(cityKey,{crateExchange:{pendingCopies:[{...copy,receipt:'another'}]}});
  await assert.rejects(deliverMarketCopies(bucket,seller),/identity conflict/);
  assert.equal(read(cityKey).crateExchange.pendingCopies.length,1);
  console.log('PASS no demo imports, preserved copy identity after transfer and interrupted delivery, concurrent replay, conflicting mint');
})().catch(e=>{console.error(e);process.exitCode=1;});
