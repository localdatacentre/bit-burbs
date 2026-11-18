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

// Check the production roller and the city wallet adapter together at both ends
// of every percentage point. This exercises rare outcomes without sampling luck.
function verifyRewardTables(){
 const tables=[
  [[45,'cash',1500,3000],[25,'dosh',10,20],[25,'deeds',1],[4,'wheelTickets',1],[1,'deeds',2]],
  [[35,'cash',8000,12000],[25,'dosh',20,30],[30,'deeds',1],[10,'wheelTickets',1]],
  [[25,'cash',18000,30000],[25,'dosh',40,60],[38,'deeds',2],[12,'wheelTickets',2]],
  [[20,'cash',45000,70000],[20,'dosh',90,130],[35,'deeds',4],[15,'wheelTickets',3],[10,'boost',1]],
  [[15,'cash',150000,220000],[20,'dosh',250,350],[30,'deeds',12],[15,'wheelTickets',8],[10,'boost',1],[10,'diamond',1]]
 ];
 const costs=[2,6,14,30,80],tiers=['silver','gold','emerald','ruby','diamond'];
 const draws=[];
 const applyReward=vm.runInNewContext(fs.readFileSync(process.argv[2],'utf8')+';exchangeApply',{
  crypto:{randomUUID:crypto.randomUUID,getRandomValues(bytes){
   assert.ok(draws.length,'unexpected random draw');return bytes.fill(draws.shift());
  }}
 });
 for(const [tier,table] of tables.entries()){
  let percent=0;
  for(const [weight,kind,minimum,maximum=minimum] of table){
   for(let step=0;step<weight;step++,percent++){
    for(const upper of [false,true]){
     const city={v:2,crateVouchers:costs[tier],stars:5,cash:7,deeds:1,tickets:2,boostUntil:9000};
     const wallet={cash:0,dosh:0,deeds:0,wheelTickets:0,crateVouchers:costs[tier]};
     const player={wallet,boosts:0,stock:[0,0,0,0,0],opening:null};
     const market={players:{fixture:player},assets:[],events:[]};
     applyReward(market,'fixture',{action:'crate',tier},1,0);
     assert.equal(wallet.crateVouchers,0);
     const debited=settleCityExchange(city,'fixture',{playerId:'fixture',action:'buy-crate',tier:tiers[tier],sequence:1});
     const boundary=(percent+Number(upper))*2**32/100;
     draws.push(Math.ceil(boundary)-Number(upper));
     if(maximum!==minimum)draws.push(upper?0xffffffff:0);
     applyReward(market,'fixture',{action:'open',count:1,tier},1,0);
     assert.equal(draws.length,0);
     const [reward]=player.opening.winners,amount=upper?maximum:minimum;
     assert.equal(player.opening.winners.length,1);
     assert.equal(reward.kind,kind);assert.equal(reward.amount,amount);
     assert.deepEqual(player.stock,[0,0,0,0,0]);
     const entry={playerId:'fixture',action:'open-crate',winners:[reward],sequence:2};
     const paid=settleCityExchange(debited,'fixture',entry);
     const expected={...city,crateVouchers:0,exchangeSequence:2};
     if(kind==='boost')expected.coinBoostTokens={10:1};
     else if(kind!=='diamond')expected[{cash:'cash',dosh:'stars',deeds:'deeds',wheelTickets:'tickets'}[kind]]+=amount;
     assert.deepEqual(paid,expected);assert.equal(settleCityExchange(paid,'fixture',entry),paid);
     assert.equal(market.assets.length,Number(kind==='diamond'));
     if(kind==='diamond'){assert.equal(reward.model,'statue');assert.equal(reward.copy,market.assets[0].id);}
    }
   }
  }
  assert.equal(percent,100);
 }
 console.log('PASS 1,000 boundary openings across five crate prices, exact prize odds, min/max payouts, boosts and minted copies');
}
verifyRewardTables();
