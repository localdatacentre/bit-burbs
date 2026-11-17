(function(root){
'use strict';
const LEVELS=[1,1,1.25,1.6,2.05,2.6], VERSION=1;
const need=l=>Math.round(60+5.7*Math.pow(l,1.34));
const legacyNeed=l=>Math.round(60*Math.pow(l,1.55)*(1+Math.min(.25,Math.max(0,l-5)*.01)));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function cycle(ms){return new Date(ms+10*3600000-18*3600000).toISOString().slice(0,10);}
function week(ms){const d=new Date(ms+10*3600000-18*3600000);d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);}
function ensure(city,ms){
 const e=city.economyLab||(city.economyLab={version:VERSION,settled:city.saved||ms,lastAction:0,nextId:0,claims:{},weekKey:week(ms),weekMinutes:0,weekServiceMinutes:0,weekDays:[],weeklyClaimed:false});
 if(!e.claims)e.claims={};if(!e.weekDays)e.weekDays=[];
 const key=cycle(ms);if(e.day!==key){e.day=key;e.minutes=0;e.serviceMinutes=0;e.development=0;e.restockAwards=0;e.restocks=0;e.onlineCoins=0;e.reviews=[];e.dailyClaimed=[];e.voucherClaimed=false;}
 if(e.weekKey!==week(ms)){e.weekKey=week(ms);e.weekMinutes=0;e.weekServiceMinutes=0;e.weekDays=[];e.weeklyClaimed=false;}
 return e;
}
function migrate(city,defs,config,ms){
 if(city.economyLab?.version===VERSION){ensure(city,ms);return {city,changed:false};}
 const before={coins:city.cash,dosh:city.stars,pop:city.pop,level:city.level,buildings:0,released:0};
 const l=Math.max(1,Number(city.level)||1),oldXP=Math.max(0,Number(city.xp)||0);
 city.xp=l>=100?Math.min(oldXP,need(l)-1):Math.floor(clamp(oldXP/legacyNeed(l),0,.999999)*need(l));
 city.economyLab={version:VERSION,settled:Math.min(city.saved||ms,ms),lastAction:0,nextId:0,claims:{},weekKey:week(ms),weekMinutes:0,weekServiceMinutes:0,weekDays:[],weeklyClaimed:false,migration:before};
 const e=ensure(city,ms),at=city.saved||ms;
 const visit=t=>{if(!t||t.id==='_occ')return;before.buildings++;if(!t.labId)t.labId='existing-'+(++e.nextId);e.claims['build:'+t.id]=true;for(let n=2;n<=(t.lvl||1);n++)e.claims['upgrade:'+t.labId+':'+n]=true;
  const p=config[t.id];if(!p)return;const old=Number.isSafeInteger(t.hired)?Math.max(0,t.hired):0;before.released+=Math.max(0,old-p.jobs);t.hired=Math.min(old,p.jobs);
  if(t.pr?.length){const end=Math.max(...t.pr.map(x=>x.s||0)),pending=t.pr.map(x=>x.o||0).filter(Boolean);const price=defs[t.id]?.cost||0;const base=price<2000?5:price<5000?15:price<15000?30:60;const duration=Math.max(30,(base+((t.lvl||1)-1)*5)*3)*60000;const fraction=clamp((end-at)/duration,0,1);t.pr=[{s:fraction?at+fraction*p.stock*60000:Math.min(end,at),o:pending.length?Math.min(...pending):0}];}
 };
 for(const t of city.tiles||[])visit(t);for(const b of city.storedBuildings||[])visit(b.building||b);
 return {city,changed:true,summary:before};
}
function originalGross(d,t,rates){return [1,1.5,2.2].reduce((s,m)=>s+Math.max(1,Math.round((rates[d.jobs]||0)*m*(LEVELS[t?.lvl||1]||1))),0);}
function gross(d,t,employees,p,rates){const full=Math.round(originalGross(d,t,rates)*p.factor*10)/10;return full*clamp(employees,0,p.jobs)/p.jobs;}
function fee(d,t,employees,p,rates){return Math.round(gross(d,t,employees,p,rates)*p.stock*p.fee);}
function intervals(p,duration,from,to){const ranges=[];const add=(start,end)=>{const lo=Math.max(start,from),hi=Math.min(end,to);if(hi>lo)ranges.push([lo,hi]);};add(p.s-duration,p.s);if(p.o&&p.o<=to){const start=Math.max(p.s,p.o);p.s=start+duration;p.o=0;add(start,p.s);}return ranges;}
function unionMs(ranges){ranges.sort((a,b)=>a[0]-b[0]);let end=-Infinity,sum=0;for(const [lo,hi]of ranges){sum+=Math.max(0,hi-Math.max(lo,end));end=Math.max(hi,end);}return sum;}
function settle(city,list,to,config,rates,{offline=false,school=1}={}){
 const e=city.economyLab;if(!e)throw Error('Economy state missing');const from=e.settled;if(!Number.isFinite(to)||to<=from)return {coins:0,minutes:0,clockRollback:to<from};
 const deadline=offline?from:Math.min(to,(e.lastAction||0)+600000);let coins=0,onlineCoins=0;const active=[];
 for(const b of list){const p=config[b.t.id];if(!p)continue;if(!b.t.pr?.length)b.t.pr=[{s:0,o:0}];const pr=b.t.pr[0],ranges=intervals(pr,p.stock*60000,from,to);
  const employees=b.employees??b.workers??0;if(!employees||!b.ok||!b.pow||!b.wat)continue;
  const rate=gross(b.d,b.t,employees,p,rates)*school;
  for(const [lo,hi]of ranges){const fullEnd=Math.max(lo,Math.min(hi,deadline)),full=fullEnd-lo,away=hi-fullEnd;const boost=city.boostUntil||0;const bonusFull=Math.max(0,Math.min(fullEnd,boost)-lo),bonusAway=Math.max(0,Math.min(hi,boost)-fullEnd);const paid=rate*(full+bonusFull+(away+bonusAway)/3)/60000;coins+=paid;onlineCoins+=rate*(full+bonusFull)/60000;if(full>0)active.push([lo,fullEnd]);if(paid>0)b.t.labSold=(b.t.labSold||0)+paid;}
 }
 e.settled=to;const minutes=unionMs(active)/60000;return {coins,minutes,onlineCoins,from,to};
}
function award(city,n){n=Math.max(0,Number(n)||0);if(!n)return [];if(city.level>=100){city.xp=Math.min(city.xp||0,need(100)-1);return [];}city.xp=(city.xp||0)+n;const gained=[];while(city.level<100&&city.xp>=need(city.level)){city.xp-=need(city.level);city.level++;if(API.onLevel)API.onLevel(city,city.level);city.stars=(city.stars||0)+2;if(city.level%5===0){city.deeds=(city.deeds||0)+1;city.tickets=(city.tickets||0)+1;}gained.push(city.level);}city.xp=Math.round(city.xp*1000)/1000;return gained;}
function development(city,key,n,ms){const e=ensure(city,ms);if(e.claims[key])return 0;e.claims[key]=true;const paid=Math.max(0,Math.min(n,100-e.development));e.development+=paid;award(city,paid);return paid;}
function operation(city,minutes,onlineCoins,ms,services=true){const e=ensure(city,ms),before=e.minutes,after=before+minutes;const first=Math.max(0,Math.min(120,after)-Math.min(120,before));const extra=Math.max(0,Math.min(240,after)-Math.max(120,before));e.minutes=after;e.weekMinutes+=minutes;if(services){e.serviceMinutes=(e.serviceMinutes||0)+minutes;e.weekServiceMinutes=(e.weekServiceMinutes||0)+minutes;}e.onlineCoins+=onlineCoins;const xp=first*6+extra;award(city,xp);return xp;}
const API={VERSION,need,legacyNeed,cycle,week,ensure,migrate,originalGross,gross,fee,intervals,unionMs,settle,award,development,operation};root.LabCore=API;if(typeof module!=='undefined')module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:this);
