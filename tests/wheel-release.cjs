'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
const part=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const city={cash:0,stars:0,tickets:2,wheelPips:9,wheelT:0,crates:{gold:3}};
let saves=0,persisted;
const ctx={S:city,now:()=>12*3600000,Math:Object.create(Math),fmt:String,$:()=>({}),performance:{now:()=>0},matchMedia:()=>({matches:true}),save(){saves++;persisted=structuredClone(ctx.S)}};
for(const name of ['snd','buzz','toast','setText','track','addXP','changed','updateWheelUI'])ctx[name]=()=>{};
vm.createContext(ctx);
vm.runInContext(part('const WHEEL = [','const GRIND_D')+part('function resolveR','function track(')+'\nlet wheelAnim=null;const TAU=Math.PI*2,SPINS_PER_VOUCHER_BONUS=10;'+part('function spin()','\n}',)+'\n}',ctx);
const weights=vm.runInContext('WHEEL.map(x=>[x.w,x.r.k,x.r.n])',ctx);
assert.deepEqual(JSON.parse(JSON.stringify(weights)),[[15,'voucher',1],[10,'voucher',2],[5,'cash',6000],[10,'stars',10],[5,'stars',25],[10,'deed',1],[2,'deed',2],[20,'crateVoucher',1],[15,'crateVoucher',2],[8,'crateVoucher',5]]);
ctx.Math.random=()=>0.99;ctx.spin();assert.equal(city.crateVouchers,7);assert.equal(city.wheelPips,0);assert.equal(city.tickets,2);assert.equal(city.crates.gold,3);assert.equal(saves,1);
ctx.spin();assert.equal(saves,1);
vm.runInContext('wheelAnim=null',ctx);ctx.Math.random=()=>0;ctx.spin();assert.equal(city.tickets,1);assert.equal(city.restockVouchers,1);assert.equal(city.crateVouchers,7);
console.log('PASS all wheel weights, free opportunity, banked ticket, tenth-spin stack, one save and repeat tap');

// A reload mid-animation must show exactly the wedge and payout already saved.
let cut=0;
const field={cash:'cash',deed:'deeds',stars:'stars',voucher:'restockVouchers',crateVoucher:'crateVouchers'};
for(const [index,[weight,kind,quantity]] of weights.entries()){
  ctx.S={cash:0,stars:0,deeds:0,restockVouchers:0,crateVouchers:0,tickets:1,wheelPips:0,wheelT:0};
  vm.runInContext('wheelAnim=null',ctx);
  let draw=0;ctx.Math.random=()=>draw++===0?(cut+weight/2)/100:0.5;
  ctx.spin();cut+=weight;
  assert.equal(persisted[field[kind]],quantity);
  assert.equal(persisted.tickets,1);
  assert.equal(persisted.wheelPips,1);
  const normalized=(2*Math.PI-persisted.wheelAng)%(2*Math.PI);
  assert.equal(Math.floor(normalized/(2*Math.PI/weights.length)),index);
  assert.equal(typeof persisted.lastWheelMessage,'string');
}
const lastFreeAt=persisted.wheelT;
ctx.S=structuredClone(persisted);ctx.S.tickets=0;
vm.runInContext('wheelAnim=null',ctx);
ctx.now=()=>lastFreeAt+12*3600000-1;
const previousSaves=saves;
ctx.spin();assert.equal(saves,previousSaves);
ctx.now=()=>lastFreeAt+12*3600000;
ctx.spin();assert.equal(saves,previousSaves+1);
vm.runInContext('wheelAnim=null',ctx);
ctx.spin();assert.equal(saves,previousSaves+1);
console.log('PASS every wedge matches the saved payout and pointer, with one free opportunity at the exact cooldown boundary');

// A wheel XP award may cross one or more level boundaries before the city saves.
const {prepareCrateConversion}=require('../crate-conversion.js');
vm.runInContext('var Core={};'+part('Core.onLevel=', 'function labState()'),ctx);
const before={v:2,crates:{steel:2,gold:1},crateVouchers:4};
const oldCity=structuredClone(before),converted=prepareCrateConversion(before);
for(let level=2;level<=100;level++){
  ctx.Core.onLevel(oldCity,level);
  ctx.Core.onLevel(converted,level);
  assert.equal(converted.crateVouchers,prepareCrateConversion(oldCity).crateVouchers);
  assert.deepEqual(converted.crates,{});
}
console.log('PASS all 99 level-ups preserve reward value without reintroducing legacy crates into a converted city');

// New and returning named cities must reach the frame loop after the old gift is retired.
const startup=part("if (!testCity && !micksDriveDemo && !facilityRoadDemo && (S.upgraded || S.firstRun))", "if(micksDriveDemo&&!deletedModelIds.has(driveDemoShop))");
assert.ok(startup.includes('requestAnimationFrame(frame)'));
for(const [state,expected] of [[{firstRun:true},['welcome','frame']],[{},['frame']],[{foundingGrant:true},['founding','frame']]]){
  const calls=[];
  vm.runInNewContext(startup,{S:state,testCity:false,micksDriveDemo:false,facilityRoadDemo:false,
    welcome:()=>calls.push('welcome'),showFoundingPrompt:()=>calls.push('founding'),document:{},
    frame(){},requestAnimationFrame:()=>calls.push('frame')});
  assert.deepEqual(calls,expected);
}
console.log('PASS new, returning and founding-grant cities all start the game loop');
