// Pass the Banksia Exchange checkout's hosting/exchange.js as the first argument.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {runCityCrateCommand}=require('../city-crate-command.js');
const {settleCityExchange}=require('../city-exchange.js');
const apply=vm.runInNewContext(fs.readFileSync(process.argv[2],'utf8')+';exchangeApply',{crypto:{randomUUID:crypto.randomUUID,getRandomValues:x=>x.fill(4294967295)}});
(async()=>{
let record={city:{v:2,crateVouchers:240},progress:'keep'},etag=1;
const bucket={get:async()=>{let v=structuredClone(record);return {etag:String(etag),json:async()=>v}},put:async(k,v,{onlyIf})=>{if(onlyIf.etagMatches!==String(etag))return null;record=JSON.parse(v);return {etag:String(++etag)}}};
const run=c=>runCityCrateCommand(bucket,'a'.repeat(64),c,apply,settleCityExchange);
const cmd=(action,revision)=>({action,revision,tier:4,count:3,requestId:crypto.randomUUID()});
for(let i=0;i<3;i++){const c=cmd('crate',i);await Promise.all([run(c),run(c)]);}
assert.equal(record.city.crateVouchers,0);
await assert.rejects(run(cmd('crate',3)));
const c=cmd('open',3);const result=JSON.parse(JSON.stringify(await run(c)));
assert.deepEqual(result,await run(c));assert.equal(result.stock[4],0);
assert.deepEqual(result.pendingCopies.map(x=>x.id),result.opening.winners.map(x=>x.copy));
assert.equal(new Set(result.pendingCopies.map(x=>x.id)).size,3);
await run({...cmd('finish',4),receipt:result.opening.receipt});
assert.equal(record.crateExchange.pendingCopies.length,3);assert.equal(record.progress,'keep');assert.equal(record.city.exchangeSequence,4);
console.log('PASS earned-only spend, racing purchases, triple Diamond opening, replay and retained mint receipts');
})().catch(e=>{console.error(e);process.exitCode=1});
