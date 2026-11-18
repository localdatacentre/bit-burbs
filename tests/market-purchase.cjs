'use strict';
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {purchaseMarketListing}=require('../market-purchase.js');
const {settleReservedSale}=require('../market-sale-payment.js');
const seller='a'.repeat(64),buyer='b'.repeat(64),other='c'.repeat(64);
const key='exchange/v2/ledger',copy=randomUUID(),listing=randomUUID();
let serial=0,fail=true;
const records=new Map();
function store(k,v){records.set(k,{etag:String(++serial),raw:JSON.stringify(v)});}
const city=id=>'live-city/roster2/'+id;
store(key,{assets:[{id:copy,model:'statue',owner:seller,state:'listed'}],listings:[{id:listing,asset:copy,price:120}],events:[],sales:[]});
for(const player of [seller,buyer,other])store(city(player),{city:{v:2,stars:200}});
function connect(){return {
  async get(k){const r=records.get(k);return r&&{etag:r.etag,json:async()=>JSON.parse(r.raw)};},
  async put(k,raw,{onlyIf}){if(records.get(k)?.etag!==onlyIf.etagMatches)return null;
    const value=JSON.parse(raw);
    if(k===key&&value.sales.length&&fail){fail=false;throw Error('lost connection');}
    store(k,value);return {etag:String(serial)};}
};}
const read=async k=>(await connect().get(k)).json();
const cmd={requestId:randomUUID(),listing,price:120};
const buy=(player,c,unlocked=true)=>purchaseMarketListing(connect(),player,c,()=>unlocked,settleReservedSale);
(async()=>{
  await assert.rejects(buy(buyer,cmd,false),/unavailable/);
  await assert.rejects(buy(buyer,cmd),/lost connection/);
  await assert.rejects(buy(other,{...cmd,requestId:randomUUID()}),/unavailable/);
  await Promise.all([buy(buyer,cmd),buy(buyer,cmd)]);
  const book=await read(key);
  assert.deepEqual([book.assets[0].id,book.assets[0].owner],[copy,buyer]);
  assert.equal(book.sales.length,1);assert.equal(book.events.length,1);assert.equal(book.listings.length,0);
  assert.equal((await read(city(buyer))).city.stars,80);
  assert.equal((await read(city(seller))).city.stars,314);
  assert.equal((await read(city(other))).city.stars,200);
  console.log('PASS reserved listing purchase, real city debit & credit, lock, competing buyer, reconnection and one completed sale');
})().catch(e=>{console.error(e);process.exitCode=1});
