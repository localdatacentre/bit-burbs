'use strict';
// Run with the path to the patched Banksia Exchange hosting/catalogue-worker.js.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = {crypto:require('node:crypto').webcrypto, TextEncoder, TextDecoder, Response,
  recordProgression:async()=>{}, console};
const liveCityAccount = vm.runInNewContext(fs.readFileSync(process.argv[2],'utf8').split('export default')[0]+';liveCityAccount',context);
const receipt = {stock:[0,1,0,0,0],pendingCopies:[{id:'original-copy'}]};
let revision = 2;
let record = {city:{v:2,tiles:[{}],cash:100,exchangeSequence:1},crateExchange:receipt};
const bucket = {
  async get(key) {
    if (!key.startsWith('live-city/roster2/')) return null;
    const snapshot = structuredClone(record);
    return {etag:String(revision),json:async()=>snapshot};
  },
  async put(key,raw,{onlyIf}) {
    if (onlyIf.etagMatches !== String(revision)) return null;
    record = JSON.parse(raw);
    return {etag:String(++revision)};
  }
};
function save(rev,sequence,extra={}) {
  const body = {action:'save',roster:'beta-roster-2',name:'fixture',code:'a'.repeat(32),
    revision:rev,progress:'b'.repeat(32),city:{v:2,cash:102,tiles:[{}],exchangeSequence:sequence,...extra},
    crateExchange:{pendingCopies:[]}};
  return liveCityAccount(new Request('https://fixture.invalid/api/live-city',{method:'POST',
    headers:{Origin:'https://localdatacentre.github.io','Content-Type':'application/json'},body:JSON.stringify(body)}),{BUCKET:bucket});
}
(async()=>{
  assert.equal((await save('1',1)).status,409);
  assert.equal((await save('2',0)).status,409);
  assert.equal((await save(null,0)).status,409);
  const responses = await Promise.all([save('2',1),save('2',1)]);
  assert.deepEqual(responses.map(x=>x.status).sort(),[200,409]);
  assert.deepEqual(record.crateExchange,receipt);
  assert.equal(record.city.cash,102);
  const conversion={version:1,previous:2,added:6,converted:{silver:0,gold:1,diamond:0,premium:0}};
  record.city.crateConversion=conversion;
  assert.equal((await save('3',1)).status,409);
  assert.equal((await save('3',1,{crateConversion:conversion,crates:{gold:1}})).status,409);
  assert.equal((await save('3',1,{crateConversion:conversion,crates:{}})).status,200);
  console.log('PASS stale revisions, stale Exchange sequence, duplicate saves and retained server crate inventory');
})().catch(e=>{console.error(e);process.exitCode=1});
