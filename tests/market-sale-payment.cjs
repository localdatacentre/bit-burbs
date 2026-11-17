'use strict';
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {settleReservedSale}=require('../market-sale-payment.js');
const buyer='a'.repeat(64),seller='b'.repeat(64);
const sale={buyer,seller,id:randomUUID(),price:120,copy:randomUUID()};
const records=new Map();
let version=0,interrupt=true;
function put(id,data){records.set(id,{version:String(++version),body:JSON.stringify(data)});}
for(const id of [buyer,seller])put(id,{city:{v:2,stars:id===buyer?125:3}});
const bucket={
  async get(path){const r=records.get(path.split('/').pop());return r&&{etag:r.version,json:async()=>JSON.parse(r.body)};},
  async put(path,raw,{onlyIf}){const id=path.split('/').pop();
    if(id===seller&&interrupt){interrupt=false;throw Error('offline');}
    if(records.get(id).version!==onlyIf.etagMatches)return null;
    put(id,JSON.parse(raw));return {etag:String(version)};
  }
};
const read=async id=>(await bucket.get('live-city/roster2/'+id)).json();
(async()=>{
  await assert.rejects(settleReservedSale(bucket,sale),/offline/);
  assert.equal((await read(buyer)).city.stars,5);
  await Promise.all([settleReservedSale(bucket,sale),settleReservedSale(bucket,sale)]);
  assert.equal((await read(seller)).city.stars,117);
  for(const id of [buyer,seller]){
    const record=await read(id);assert.equal(record.marketPayments[sale.id].copy,sale.copy);
    assert.equal(record.city.exchangeSequence,1);
  }
  const declined={...sale,id:randomUUID()};
  assert.deepEqual(await settleReservedSale(bucket,declined),{paid:false});
  const record=await read(buyer);record.city.stars=500;put(buyer,record);
  assert.deepEqual(await settleReservedSale(bucket,declined),{paid:false});
  await assert.rejects(settleReservedSale(bucket,{...sale,price:130}),/conflict/);
  assert.equal((await read(buyer)).city.stars,500);
  console.log('PASS real city dosh fields, interrupted seller credit, duplicate settlement, fee, stable declines and receipt identity');
})().catch(e=>{console.error(e);process.exitCode=1});
