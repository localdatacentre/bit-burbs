'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const C=require('../economy-core.js');
const config=JSON.parse(html.match(/window.BB_ECONOMY=(\{.*?\});<\/script>/)[1]);
const definitions=vm.createContext({ECON:config});
vm.runInContext(html.slice(html.indexOf('const DEFS ='),html.indexOf('const SVC_NAMES ='))+';this.defs=DEFS;this.quotes=BUILDING_QUOTES;this.values=BUILDING_VALUES;',definitions);
const defs=definitions.defs,quotes=definitions.quotes,values=definitions.values;
const rates=vm.runInNewContext('('+html.match(/const businessRates = (\{[\s\S]*?\n\});/)[1]+')');
function extract(name){
 const match=new RegExp('^function '+name+'\\(', 'm').exec(html);
 if(!match)throw Error('Missing real game function: '+name);
 const start=match.index;
 for(let end=html.indexOf('}',start);end>=0;end=html.indexOf('}',end+1)){
  const code=html.slice(start,end+1);
  try{new vm.Script('('+code+')');return code;}catch{}
 }
 throw Error('Cannot parse game function: '+name);
}
function harness({at=Date.parse('2026-11-17T08:00:00Z'),N=32}={}) {
 const sandbox={Core:C,ECON:config,DEFS:defs,BUILDING_QUOTES:quotes,businessRates:rates,N,clock:at,
   messages:[],blocked:new Set(),P:()=>({x:0,y:0}),console,MARKET:{statue:{},fountain:{},sakura:{},sunhouse:{},pelicanLight:{}},parkSizes:{parkSmall:1,parkLarge:1,parkXL:1},EVENT:{perDelivery:1},GRIND_T:40,UP_MAX:5,UP_MULS:[1,1,1.25,1.6,2.05,2.6],SPINS_PER_GOLD_CRATE:10,
   now(){return sandbox.clock;},clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),isBiz:d=>!!d&&['shop','ind','svc'].includes(d.type),
   lvlOf:t=>t?.lvl||1,upMul:t=>[1,1,1.25,1.6,2.05,2.6][t?.lvl||1]||1,
   changed(){},save(){},renderSheet(){},renderCard(){},updateHUD(){},snd(){},eventPts(){},track(){},mmss:n=>String(n),fmt:n=>String(n),makeDefaultAvatar:()=>[],
   toast:msg=>sandbox.messages.push(msg),popup(){},pendingLevel:null,document:{hidden:false},
   roadNearFP:(i,j,id)=>!sandbox.blocked.has(id),modelReady:()=>true,inB:(i,j)=>i>=0&&j>=0&&i<N&&j<N,
   isStop:id=>['hailStop','busShelter'].includes(id),stopKerb:()=>true,completesRoadSquare:()=>false,
   hasB:id=>sandbox.S.tiles.some(t=>t?.id===id),
   fpFree:()=>true,findHall:()=>null,storedHall:()=>null,boostMul:()=>sandbox.S.boostUntil>at?2:1,
   tileAt:(i,j)=>sandbox.S.tiles[j*N+i],occupy:(i,j,t)=>{sandbox.S.tiles[j*N+i]=t;},anchorOf:(i,j)=>({i,j}),vacate:(i,j)=>{sandbox.S.tiles[j*N+i]=null;},
   schoolBonusPct:null,streetNetwork:null,streetMap:()=>sandbox.busMap||{stops:[],buildings:[]},
   buses:[],stopInterval:600,dropPassengers(){},stopLimit:5
 };
 sandbox.S={cash:100000,stars:100,deeds:10,pop:0,level:1,xp:0,tiles:Array(N*N).fill(null),saved:at,boostUntil:0,tickets:0,crates:{steel:0,gold:0,diamond:0,premium:0},restockVouchers:0,items:{},shopItems:{},grind:{d:0,t:0},lo:0,economyLab:{version:1,balanceVersion:2,settled:at,lastAction:at}};
 sandbox.D={list:[],cap:0};
 const ctx=vm.createContext(sandbox);
 const names=['jobCapacity','schoolBonusPct','hcap','derive','labState','labAccrue','labAward','labDevelopment','labRestock','labServicesOK','labSyncTasks','labDailyClaim','labWeeklyClaim','newTile','ensureProds','orderTime','stockDuration','prodCpm','whyNot','depotPlan','manualRestock','productRestockCost','restockCost','rushCost','pendingRush','deliverProduct','rushProd','rushAll','demolitionRefund','costOf','countOf','upCost','canUp','upgrade','addXP','grindAdd','collectRent','collectInd','stopCount','buildingLimitMessage','placeAt','demolish','baseState','newGame','serviceBuses','standardiseCoinBoosts','restoreBuilding'];
 // Arrow helpers are exact expressions from the game; ordinary functions above
 // are parsed directly from the HTML, without rewriting their implementation.
 for(const name of names){
  if(['hcap','canUp'].includes(name))continue;
  vm.runInContext(extract(name),ctx);
 }
 vm.runInContext("function hcap(t,d){return d.residentCapacity[Math.min(lvlOf(t),UP_MAX)-1];} function canUp(d){return d&&['shop','home','ind','svc','util'].includes(d.type);}",ctx);
 let slot=0;
 function add(id,{lvl=1,hired=0,stock=0,pending=0,...rest}={}){
  const i=slot%N,j=Math.floor(slot/N);slot++;
  const t={id,lvl,hired,labId:'audit-'+slot,...rest};if(config[id])t.pr=[{s:at+stock*60000,o:pending?at+pending*60000:0}];
  sandbox.S.tiles[j*N+i]=t;return t;
 }
 return {ctx,s:sandbox,add,call(name,...args){return sandbox[name](...args);},derive(){sandbox.derive();return sandbox.D;},advance(minutes,offline=false){sandbox.clock+=minutes*60000;return sandbox.labAccrue(sandbox.clock,offline);},extract};
}
module.exports={html,C,config,defs,quotes,values,rates,extract,harness};
