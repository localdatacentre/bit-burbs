const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const C=require('../economy-core.js'),html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const config=JSON.parse(html.match(/window.BB_ECONOMY=(\{.*?\});<\/script>/)[1]);
const ctx=vm.createContext({ECON:config});
vm.runInContext(html.slice(html.indexOf('const DEFS ='),html.indexOf('const SVC_NAMES ='))+';this.defs=DEFS;this.quotes=BUILDING_QUOTES;',ctx);
const rates=vm.runInNewContext('('+html.match(/const businessRates = (\{[\s\S]*?\n\});/)[1]+')');
const at=Date.parse('2026-11-17T08:00:00Z'),minute=60000;
const near=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function setup({version=2,until=config.bakery.stock,boost=0,action=at,hired=3}={}){const t={id:'bakery',lvl:1,hired,pr:[{s:at+until*minute,o:0}]};const city={v:2,cash:250,stars:30,pop:3,level:10,xp:10,tiles:[t],saved:at,boostUntil:boost,economyLab:{version:1,balanceVersion:version,settled:at,lastAction:action}};return {city,t,list:[{t,d:ctx.defs.bakery,employees:hired,ok:true,pow:true,wat:true}]};}
// Every business at every level remains proportional to its fixed job capacity.
for(const[id,p]of Object.entries(config))for(let lvl=1;lvl<=5;lvl++){
 const full=C.gross(ctx.defs[id],{lvl},p.jobs,p,rates),old=C.gross(ctx.defs[id],{lvl},p.jobs,{...p,...p.previous},rates);
 assert(full>old);near(C.gross(ctx.defs[id],{lvl},p.jobs/2,p,rates),full/2);
 assert(p.stock>p.previous.stock);assert(p.delivery<p.previous.delivery);assert(p.fee<p.previous.fee);
 assert(C.fee(ctx.defs[id],{lvl},p.jobs,p,rates)<=C.fee(ctx.defs[id],{lvl},p.jobs,{...p,...p.previous},rates)+1,'Longer batches must not raise the upfront fee');
}
let s=setup(),g=C.gross(ctx.defs.bakery,s.t,3,config.bakery,rates);
near(g,20.2*1.15*1.05);near(C.settle(s.city,s.list,at+120*minute,config,rates).coins,g*90);
// Idle visible income stays full, without awarding idle operation XP/minutes.
s=setup({action:0});let r=C.settle(s.city,s.list,at+60*minute,config,rates);near(r.coins,g*60);near(r.minutes,0);near(r.onlineCoins,0);
s=setup();r=C.settle(s.city,s.list,at+120*minute,config,rates);near(r.minutes,10);
s=setup();near(C.settle(s.city,s.list,at+24*60*minute,config,rates,{offline:true}).coins,g*config.bakery.stock*.5);assert.equal(C.settle(s.city,s.list,at+24*60*minute,config,rates).coins,0);
// Boost expiry, pending delivery and late catch-up remain exact.
s=setup({boost:at+15*minute});near(C.settle(s.city,s.list,at+30*minute,config,rates,{offline:true}).coins,g*45*.5);
s=setup({until:0});s.t.pr[0].o=at+5*minute;near(C.settle(s.city,s.list,at+15*minute,config,rates,{offline:true}).coins,g*10*.5);assert.equal(s.t.pr[0].o,0);
for(const key of ['ok','pow','wat','employees']){s=setup();s.list[0][key]=0;near(C.settle(s.city,s.list,at+minute,config,rates).coins,0);}
// Older, unprocessed time uses the old rate and batch length, then scales only
// remaining stock. No XP reset, inventory change or duplicate payment occurs.
s=setup({version:1,until:30});const old=C.gross(ctx.defs.bakery,s.t,3,{...config.bakery,...config.bakery.previous},rates);
near(C.settle(s.city,s.list,at+10*minute,config,rates,{offline:true}).coins,old*10/3);
const before=[s.city.cash,s.city.stars,s.city.pop,s.city.level,s.city.xp],cutoff=s.city.economyLab.settled;
s.t.pr[0].o=at+40*minute;assert(C.rebalance(s.city,config,cutoff));near(s.t.pr[0].s,cutoff+60*minute);assert.equal(s.t.pr[0].o,at+40*minute);assert.deepEqual([s.city.cash,s.city.stars,s.city.pop,s.city.level,s.city.xp],before);assert(!C.rebalance(s.city,config,cutoff));
// A full old batch is not incorrectly treated as a fresh new batch overnight.
s=setup({version:1,until:30});near(C.settle(s.city,s.list,at+12*60*minute,config,rates,{offline:true}).coins,old*30/3);C.rebalance(s.city,config,s.city.economyLab.settled);near(C.settle(s.city,s.list,at+13*60*minute,config,rates,{offline:true}).coins,0);
// Splitting settlements and saving/reopening does not change total earnings.
const a=setup(),b=setup();let total=0;for(let n=1;n<=120;n++)total+=C.settle(a.city,a.list,at+n*minute,config,rates).coins;near(total,C.settle(b.city,b.list,at+120*minute,config,rates).coins);
assert.equal(C.need(99),Math.round(60+5.7*99**1.34));assert.equal(C.cycle(Date.parse('2026-11-17T07:59:59Z')),'2026-11-16');assert.equal(C.cycle(at),'2026-11-17');
for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
assert(html.includes('Core.rebalance(S,ECON,S.economyLab.settled)'));assert(html.includes('return Math.floor(paid / 10)'));assert(html.includes('betaSync.sync(raw)'));
assert(html.includes('./economy-core.js?v=balance2'));assert(fs.readFileSync(require('node:path').join(__dirname,'../service-worker.js'),'utf8').includes('./economy-core.js?v=balance2'));
console.log('PASS: 115 business levels, proportional staffing, full visible idle pay, active-only XP, 50% offline capped by stock, boost/delivery timing, blockers, legacy settlement, fraction-preserving idempotent migration, no balance/XP reset, replay resistance, Brisbane reset, PWA version pairing, script syntax and 10% refunds');
module.exports={C,config,defs:ctx.defs,quotes:ctx.quotes,rates};
