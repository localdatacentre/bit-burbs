'use strict';
(() => {
// Isolated release candidate. Deliberately not loaded by index.html.
const Core = typeof module === 'undefined' ? globalThis.LabCore : require('./economy-core.js');
const M = 60000;
const DIFFICULTIES = ['straightforward', 'standard', 'challenging'];
const QUOTAS = [3, 4, 3];
const XP = [10, 20, 30];
const clone = x => JSON.parse(JSON.stringify(x));
const scope = ids => [...ids].sort().join(',');
function random(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h |= 0; h = h + 0x6d2b79f5 | 0; let t = Math.imul(h ^ h >>> 15, 1 | h); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const FAMILIES = ['sales','trading','stock','orders','deliveries','availability','staffing','services','binlink','improvement'];
// Exactly the forty drafted variants; their eligibility is separate from selection.
const TEMPLATES = FAMILIES.flatMap((family, f) => Array.from({length:4}, (_,v) => ({id:String(f*4+v+1).padStart(2,'0'),family,variant:v})));
function snapshot(city, list, config, defs, rates, at, extra = {}) {
  const businesses = list.filter(b => config[b.t.id]).map(b => {
    const p=config[b.t.id], pr=b.t.pr?.[0] || {}, employees=b.employees ?? b.workers ?? 0;
    return {id:b.t.labId,model:b.t.id,category:defs[b.t.id].cat,connected:!!(b.ok&&b.pow&&b.wat),employees,jobs:p.jobs,
      rate:Core.gross(defs[b.t.id],b.t,employees,p,rates),stock:p.stock,remaining:Math.max(0,(pr.s-at)/M),
      pending:pr.o ? Math.max(0,(pr.o-at)/M) : null,delivery:p.delivery,fee:Core.fee(defs[b.t.id],b.t,employees,p,rates)};
  });
  if(businesses.some(b=>!b.id)||new Set(businesses.map(b=>b.id)).size!==businesses.length)throw Error('Stable unique labId required');
  return {cash:city.cash,restockVouchers:city.restockVouchers||0,businesses,...extra};
}
function candidates(s) {
  const all=s.businesses.filter(b=>b.connected&&b.employees>0&&b.rate>0);
  const categories=[...new Set(all.map(b=>b.category))].sort();
  const groups=[all,...categories.map(c=>all.filter(b=>b.category===c)),...all.map(b=>[b])].filter(g=>g.length);
  const seen=new Set(), out=[];
  function sellingPlan(g,duration) {
    const requiredOrders=[], waits=[];
    for(const b of g) {
      if(b.remaining>=duration){waits.push(0);continue;}
      if(b.remaining>75||duration>b.remaining+b.stock)return null;
      if(b.pending===null)requiredOrders.push({id:b.id,fee:b.fee});
      waits.push(b.pending===null?b.delivery:Math.max(0,b.pending-b.remaining));
    }
    if(!affordable([{requiredOrders}],s))return null;
    // Group targets require simultaneous selling. Summed gaps are conservative
    // even when different businesses exhaust at different times.
    return {eta:duration+waits.reduce((n,v)=>n+v,0),requiredOrders};
  }
  function add(t,d,metric,ids,target,eta,options={}) {
    ids=[...ids].sort(); const signature=metric+':'+scope(ids);
    const key=[t.id,d,signature,target].join('|');
    if(seen.has(key)||!Number.isFinite(eta)||eta>120||eta<0||target<=0)return;
    if(d===1&&eta<25||d===2&&eta<60)return;
    seen.add(key);out.push({...t,difficulty:DIFFICULTIES[d],rank:d,metric,ids,target,eta,signature,
      text:metric+' '+target+' at '+ids.join(', '),
      reward:{crateVouchers:1,dosh:1,xp:XP[d]},...options});
  }
  for(const t of TEMPLATES)for(let d=0;d<3;d++) {
    const v=t.variant, minutes=[15,35,90][d];
    let chosen=v===0?[all]:v===1?[all.slice(0,Math.min(all.length,d+1))]:v===2?categories.map(c=>all.filter(b=>b.category===c)):all.map(b=>[b]);
    chosen=chosen.filter(g=>g.length);
    if(t.family==='sales') {
      if(v<3&&v!==d)continue;
      for(const g of v===3?groups.filter(g=>new Set(g.map(b=>b.category)).size===1):[all]) {
        if(!g.length)continue;const rate=g.reduce((n,b)=>n+b.rate,0),target=Math.max(100,Math.round(rate*[20,40,60][d]));
        const plan=sellingPlan(g,target/rate);
        if(plan)add(t,d,'sales',g.map(b=>b.id),target,plan.eta,{money:true,requiredOrders:plan.requiredOrders});
      }
    }
    if(t.family==='trading'&&v<2&&d===0)for(const g of chosen) {
      if(v===1&&new Set(g.map(b=>b.category)).size<2)continue;
      if(g.every(b=>b.remaining>=1))add(t,d,'tradingCoverage',g.map(b=>b.id),g.length,1);
    }
    if((t.family==='trading'&&v>=2)||t.family==='stock'||t.family==='availability')for(const g of chosen) {
      const ids=g.map(b=>b.id), duration=t.family==='stock'?Math.max(...g.map(b=>b.stock*(v===1?.2:.1))):minutes;
      const plan=sellingPlan(g,duration);if(!plan)continue;
      // Stock fractions and trading/availability minutes on the same scope
      // measure the same new selling time. Never count them as distinct goals.
      add(t,d,'sellingMinutes',ids,duration,plan.eta,{maintenance:t.family==='availability',requiredOrders:plan.requiredOrders});
    }
    if(t.family==='orders'||t.family==='deliveries')for(const g of chosen) {
      const eligible=g.filter(b=>t.family==='orders'?b.pending===null&&b.remaining<=75:b.pending!==null||b.remaining<=75);
      const n=v===1?Math.min(d+1,eligible.length):1;if(!n)continue;
      const selected=eligible.slice(0,n), toPay=selected.filter(b=>b.pending===null);
      const fees=toPay.reduce((n,b)=>n+b.fee,0), voucherUse=Math.min(toPay.length,s.restockVouchers||0);
      // Conservative: no projected earnings used to justify unaffordable orders.
      const paid=toPay.map(b=>b.fee).sort((a,b)=>b-a).slice(voucherUse).reduce((a,b)=>a+b,0);
      if(paid>s.cash)continue;
      const eta=Math.max(...selected.map(b=>b.pending??(b.remaining+b.delivery)));
      add(t,d,t.family==='orders'?'order':'delivery',selected.map(b=>b.id),n,eta,{orderIds:selected.map(b=>b.id),cost:paid,fees,requiredOrders:toPay.map(b=>({id:b.id,fee:b.fee}))});
    }
    if(t.family==='staffing')for(const g of chosen) {
      if(v===2) {
        const needed=g.reduce((n,b)=>n+b.jobs-b.employees,0);
        if(needed>0&&s.arrivals?.capacity>=needed&&s.arrivals.minutes<=120)add(t,d,'arrivals',g.map(b=>b.id),needed,s.arrivals.minutes);
      } else add(t,d,'staffedMinutes',g.map(b=>b.id),minutes,minutes,{maintenance:true,minimumStaff:g.map(b=>[b.id,b.employees])});
    }
    if(t.family==='services') {
      const ids=(s.services?.[v]||[]).map(String);
      if(ids.length)add(t,d,['suppliedHomeMinutes','powerMinutes','waterMinutes','connectedMinutes'][v],ids,minutes,minutes,{maintenance:true});
    }
    if(t.family==='binlink'&&v!==1) {
      const stops=(s.stops||[]).filter(b=>b.connected);
      if(stops.length) {
        const selected=v===2?stops.slice(0,Math.min(stops.length,d+1)):stops;
        const visits=[2,4,6][d], duration=visits*10;
        add(t,d,'visits',selected.map(b=>b.id),visits*selected.length,duration,{transport:true});
      }
    }
    if(t.family==='improvement')for(const p of s.improvements||[]) {
      if(p.variant!==v||!p.useful||!p.unlocked||p.maxed||p.dosh||p.deeds>(s.deeds||0))continue;
      const reserve=all.filter(b=>!b.pending&&b.remaining<=75).reduce((n,b)=>n+b.fee,0)+s.cash*.25;
      if(p.cost+reserve<=s.cash)add(t,d,'improve',[p.id],1,p.minutes,{improvement:true,cost:p.cost});
    }
  }
  return out;
}
function compatible(a,b) {
  if(a.signature===b.signature)return false;
  const salesMetrics=['sales','sellingMinutes','tradingCoverage'];
  if(salesMetrics.includes(a.metric)&&salesMetrics.includes(b.metric)&&a.ids.some(id=>b.ids.includes(id)))return false;
  if(a.money&&b.money||a.improvement&&b.improvement)return false;
  if(a.orderIds&&b.orderIds&&a.orderIds.some(id=>b.orderIds.includes(id)))return false;
  if(a.transport&&b.transport)return false; // fare/visit variants share actual visits
  return true;
}
function affordable(tasks,s) {
  if(!s)return true;
  const orders=new Map(tasks.flatMap(t=>(t.requiredOrders||[]).map(o=>[o.id,o.fee])));
  const costs=[...orders.values()].sort((a,b)=>b-a).slice(s.restockVouchers||0);
  const improvements=tasks.filter(t=>t.improvement).reduce((n,t)=>n+t.cost,0);
  return costs.reduce((a,b)=>a+b,0)+improvements+(improvements?s.cash*.25:0)<=s.cash;
}
function select(pool,seed,previous=[],resources) {
  const rng=random(seed), unique=new Set();
  const ranked=pool.map(x=>({...x,sort:rng()+(previous.includes(x.id)?2:0)})).sort((a,b)=>a.sort-b.sort).filter(c=>{
    const key=[c.family,c.rank,c.signature].join('|');if(unique.has(key))return false;unique.add(key);return true;
  });
  const visited=new Set();
  const familyLimit=f=>f==='sales'||f==='binlink'||f==='improvement'?1:2;
  const nonMaintenance=FAMILIES.reduce((n,f)=>n+Math.min(familyLimit(f),new Set(ranked.filter(c=>c.family===f&&!c.maintenance).map(c=>c.signature)).size),0);
  const upperBound=Math.min(10,nonMaintenance+Math.min(2,new Set(ranked.filter(c=>c.maintenance).map(c=>c.signature)).size));
  let best=[],nodes=0;
  function search(chosen,counts,families,maintenance) {
    if(chosen.length>best.length)best=chosen;
    if(chosen.length===upperBound)return chosen;
    const key=chosen.map(c=>[c.family,c.rank,c.signature].join('|')).sort().join(';');
    if(visited.has(key))return null;visited.add(key);
    if(++nodes>50000)return null;
    const choices=DIFFICULTIES.map((_,d)=>ranked.filter(c=>c.rank===d&&counts[d]<QUOTAS[d]&&(families[c.family]||0)<2&&(!c.maintenance||maintenance<2)&&chosen.every(x=>compatible(c,x))&&affordable([...chosen,c],resources)));
    const available=choices.flat();
    const remainingNonMaintenance=FAMILIES.reduce((n,f)=>n+Math.min(Math.max(0,familyLimit(f)-(families[f]||0)),new Set(available.filter(c=>c.family===f&&!c.maintenance).map(c=>c.signature)).size),0);
    const remainingMaintenance=Math.min(2-maintenance,new Set(available.filter(c=>c.maintenance).map(c=>c.signature)).size);
    if(chosen.length+remainingNonMaintenance+remainingMaintenance<upperBound)return null;
    const next=choices.map((c,d)=>({c,d})).filter(x=>counts[x.d]<QUOTAS[x.d]).sort((a,b)=>a.c.length-b.c.length)[0];
    if(!next?.c.length)return null;
    for(const c of next.c) {const n=[...counts];n[c.rank]++;const result=search([...chosen,c],n,{...families,[c.family]:(families[c.family]||0)+1},maintenance+!!c.maintenance);if(result)return result;}
    return null;
  }
  const tasks=search([],[0,0,0],{},0)||best;
  return {status:tasks.length===10?'ready':'blocked',tasks:tasks.map(({sort,...t})=>t),candidateCount:pool.length,upperBound,searchExhausted:nodes>50000,
    reason:tasks.length===10?null:'Insufficient distinct eligible goals under the approved constraints; do not award or publish a partial daily set.'};
}
function assign(saved,s,player,at,previous=[],sessionEvents) {
  const day=Core.cycle(at);
  if(saved?.day===day && saved.status!=='empty' && !(saved.status==='blocked' && sessionEvents))return clone(saved);
  let result;
  if(sessionEvents){
    const tasks=sessionGoals(s,at,sessionEvents,player,previous);
    result={tasks,status:tasks.length?'ready':'empty',witnessed:true,
      reason:tasks.length?null:'No eligible goals for this city yet.'};
  } else {
    result=select(candidates(s),player+':'+day,previous,s);
  }
  return {version:1,day,assignedAt:at,...result,tasks:result.tasks.map((t,i)=>({...t,key:day+':'+i,assignedAt:at,progress:0,claimed:false})),receipts:{},replacementUsed:false,revision:0};
}
function replace(state,key,s,at,player,sessionEvents) {
  state=clone(state);const i=state.tasks.findIndex(t=>t.key===key),old=state.tasks[i];
  if(state.status!=='ready'||state.day!==Core.cycle(at)||state.replacementUsed||!old||old.claimed)return {state,changed:false};
  const others=state.tasks.filter((_,j)=>j!==i);
  const pool=sessionEvents ? completedGoals(s,at,sessionEvents).completed : candidates(s);
  const options=pool.filter(c=>c.rank===old.rank&&c.signature!==old.signature&&others.every(t=>compatible(c,t))&&others.filter(t=>t.family===c.family).length<2&&(!c.maintenance||others.filter(t=>t.maintenance).length<2)&&affordable([...others,c],s));
  const c=options.sort((a,b)=>a.id.localeCompare(b.id))[Math.floor(random(player+state.day+':replacement')()*options.length)];
  if(!c)return {state,changed:false};
  state.tasks[i]={...c,key:key+':replacement',assignedAt:at,progress:0,claimed:false};state.replacementUsed=true;state.revision++;return {state,changed:true};
}
// Events must come from the canonical economy adapter, never UI-provided totals.
// Interval facts use stable instance IDs; minutes only accrue while foreground
// and within the existing ten-minute interaction window. Host splits at resets.
function progress(state,event,inPlace=false) {
  if(!inPlace)state=clone(state);
  if(state.status!=='ready'||!event.id||event.at<state.assignedAt||Core.cycle(event.at)!==state.day)return state;
  state.events ||= {};
  if(state.events[event.id])return state;
  if(event.type==='interval') {
    if(!Number.isFinite(event.from)||event.at<=event.from||event.from<state.assignedAt)return state;
    if(event.from<(state.intervalThrough||state.assignedAt))return state;
    state.intervalThrough=event.at;
  }
  if(event.type!=='interval')state.events[event.id]=true;
  for(const t of state.tasks) {
    if(t.claimed||event.at<t.assignedAt)continue;
    let delta=0;
    if(event.type==='interval'&&event.active&&event.foreground&&event.from>=t.assignedAt) {
      const minutes=(event.at-event.from)/M;
      const facts=t.ids.map(id=>event.facts?.[id]);
      if(t.metric==='sales')delta=facts.reduce((n,f)=>n+Math.max(0,f?.coins||0),0);
      if(t.metric==='sellingMinutes'&&facts.every(f=>f?.selling))delta=minutes;
      if(t.metric==='tradingCoverage') {t.seen ||= [];for(let i=0;i<facts.length;i++)if(facts[i]?.selling&&!t.seen.includes(t.ids[i]))t.seen.push(t.ids[i]);delta=t.seen.length-t.progress;}
      if(t.metric==='staffedMinutes'&&t.minimumStaff.every(([id,n])=>(event.facts?.[id]?.employees||0)>=n&&event.facts[id]?.connected))delta=minutes;
      if(['suppliedHomeMinutes','powerMinutes','waterMinutes','connectedMinutes'].includes(t.metric)&&facts.every(f=>f?.[t.metric]))delta=minutes;
    } else if((event.type===t.metric||event.type==='busVisit'&&t.metric==='visits')&&t.ids.includes(event.subject)) {
      t.seen ||= [];
      if(['order','delivery','improve'].includes(t.metric)) {if(!t.seen.includes(event.subject)){t.seen.push(event.subject);delta=1;}}
      else if(t.metric==='visits'&&event.active&&event.foreground)delta=1;
      else if(t.metric==='arrivals'&&event.active&&event.foreground)delta=1;
    }
    if(Number.isFinite(delta)&&delta>0)t.progress=Math.min(t.target,t.progress+delta);
  }
  state.revision=(state.revision||0)+1;return state;
}
// Host commits returned state+wallet together with a canonical compare-and-swap.
// Never merge separately credited stale wallets. No cloud implementation implied.
function claim(record,key,at,expectedRevision) {
  const next=clone(record),s=next.daily;
  if(expectedRevision!==record.revision)return {ok:false,reason:'conflict'};
  if(s.status!=='ready'||s.day!==Core.cycle(at))return {ok:false,reason:'inactive'};
  const t=s.tasks.find(x=>x.key===key);
  if(!t||t.claimed||s.receipts[key]||t.progress<t.target)return {ok:false,reason:'unclaimable'};
  const give=r=>{for(const [k,n]of Object.entries(r))next.wallet[k]=(next.wallet[k]||0)+n;};
  t.claimed=true;s.receipts[key]=true;give(t.reward);
  const n=s.tasks.filter(t=>t.claimed).length;
  for(const [threshold,reward]of [[5,{restockVouchers:1,wheelTickets:1}],[10,{crateVouchers:4,restockVouchers:1,wheelTickets:1,dosh:2,xp:20}]])if(n>=threshold&&!s.receipts['milestone:'+threshold]){s.receipts['milestone:'+threshold]=true;give(reward);}
  next.revision++;return {ok:true,record:next};
}
// Inspect an affordable simulated session before publishing a proposed daily set.
// Return only goals witnessed together within the same two-hour window.
function completedGoals(snapshot,at,events) {
  const pool=candidates(snapshot);
  let state={status:'ready',day:Core.cycle(at),assignedAt:at,
    tasks:pool.map(t=>({...t,assignedAt:at,progress:0}))};
  const finishedAt=new Map();
  for(const event of events) {
    if(event.at>at+120*M)continue;
    state=progress(state,event);
    for(let i=0;i<pool.length;i++) {
      if(!finishedAt.has(pool[i]) && state.tasks[i].progress>=pool[i].target)
        finishedAt.set(pool[i],(event.at-at)/M);
    }
  }
  const completed=pool.filter((t,i)=>state.tasks[i].progress>=t.target);
  return {completed,finishedAt};
}
function sessionGoals(snapshot,at,events,player='',previous=[]) {
  const {completed,finishedAt}=completedGoals(snapshot,at,events);
  // Try reproducible candidate orderings to find compatible goals for
  // reduced sets. The result is a witnessed lower bound on capacity.
  let best=[],bestDuration=0;
  for(let attempt=0;attempt<24;attempt++) {
    const rng=random('capacity:'+player+':'+at+':'+attempt);
    const ranked=completed.map(task=>({task,order:rng()+(previous.includes(task.id)?2:0)})).sort((a,b)=>a.order-b.order);
    const chosen=[];
    for(const {task} of ranked) {
      if(chosen.filter(t=>t.rank===task.rank).length>=QUOTAS[task.rank])continue;
      if(chosen.filter(t=>t.family===task.family).length>=2)continue;
      if(task.maintenance&&chosen.filter(t=>t.maintenance).length>=2)continue;
      if(chosen.every(t=>compatible(t,task))&&affordable([...chosen,task],snapshot))chosen.push(task);
      if(chosen.length===10)break;
    }
    const duration=Math.min(90,Math.max(0,...chosen.map(task=>finishedAt.get(task))));
    if(chosen.length>best.length || (chosen.length===best.length && duration>bestDuration)) {
      best=chosen;
      bestDuration=duration;
    }
    if(best.length===10 && bestDuration===90)break;
  }
  return best;
}
const dailyTaskAPI={sessionGoals,TEMPLATES,DIFFICULTIES,QUOTAS,snapshot,candidates,compatible,select,assign,replace,progress,claim};
if(typeof module==='undefined')globalThis.DailyTasks=dailyTaskAPI;
else module.exports=dailyTaskAPI;
})();
