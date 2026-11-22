const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'exchange-account.js'), 'utf8');
const roomHtml = fs.readFileSync(path.join(__dirname, '..', 'banksia-exchange.html'), 'utf8');
const hydrate = roomHtml.match(/function crateRoomData\(snapshot\)\{[\s\S]*?^\}/m)[0];
const projectWallet = require('../tools/project-crate-wallet.cjs');
const pendingKey = 'banksia-exchange:pending-city-command:fixture-account';
const fixture = {
  name:'fixture', accountRef:'fixture-account', crateRevision:2, stock:[1,0,0,0,0],
  wallet:{crateVouchers:10}, assets:[], listings:[], opening:null
};
const button = () => ({disabled:false, setAttribute() {}});

function openRoom({knownAccount=false,pending=null,stock=fixture.stock,active=true}={}) {
  const calls = [], actions = [];
  const events = {};
  const pendingRecords = new Map(pending ? [[pendingKey,JSON.stringify(pending)]] : []);
  const accountBar = {style:{},append() {}};
  const snapshot = {cityName:fixture.name, stock, wallet:fixture.wallet};
  if(knownAccount)Object.assign(snapshot,{accountRef:fixture.accountRef,crateRevision:2});
  let respond;
  const firstRead = new Promise(resolve => { respond=resolve; });
  const context = {
    embeddedCrates:snapshot, BBStage:{liveRelease:true},
    data:{...fixture}, animation:null,page:'vault',tierIndex:0,
    BBCityRoom:{isActive:()=>active,snapshot:()=>snapshot},
    location:{search:'',hash:''},URLSearchParams,
    clearTimeout, setInterval() {}, addEventListener:(event,listener)=>{events[event]=listener;},
    crypto:{randomUUID:()=> 'aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa'},
    sessionStorage:{
      ...(pending ? {[pendingKey]:JSON.stringify(pending)} : {}),
      getItem:key=>pendingRecords.get(key), setItem:(key,v)=>pendingRecords.set(key,v),
      removeItem:key=>pendingRecords.delete(key)
    },
    document:{getElementById:()=>accountBar,addEventListener() {},createElement:()=>button()},
    readRoom:()=>{calls.push('read');return firstRead;},
    liveCityRelease:async(action,command)=>{
      calls.push(action);actions.push(command);
      return {ok:true,json:async()=>({...fixture,crateRevision:3})};
    },
    render() {}, closeModal() {},showCratePending:()=>()=>{}
  };
  context.window=context;
  vm.createContext(context);
  vm.runInContext(hydrate+'\n'+source,context);
  return {calls,actions,pendingRecords,context,snapshot,settle:b=>context.settleEmbedded({action:'crate',tier:1},b),
    open:()=>{active=true;events['bb-room-open']();},close:()=>{active=false;events['bb-room-close']();},
    respond:(view=fixture)=>respond({ok:true,json:async()=>view})};
}

async function run(){
  const legacy={v:2,crateVouchers:4,crates:{silver:2,steel:1,wood:1,gold:1,diamond:1,premium:1},
    keys:{steel:4,gold:3,diamond:1}};
  const original=structuredClone(legacy);
  assert.equal(projectWallet(legacy).crateVouchers,92);
  assert.deepEqual(legacy,original,'displaying converted vouchers never edits the city');
  assert.equal(projectWallet({...legacy,crateConversion:{version:1}}).crateVouchers,4);
  assert.ok(projectWallet({...legacy,crates:{unknown:1}}).crateInventoryError);

  const cold=openRoom();
  assert.deepEqual(cold.calls,[],'browsing known stock does not read the account');
  const tap=cold.settle(button());
  const doubleTap=cold.settle(button());
  assert.deepEqual(cold.calls,['read']);
  cold.respond();await Promise.all([tap,doubleTap]);
  assert.deepEqual(cold.calls,['read','releaseExchange']);
  assert.equal(cold.actions[0].revision,2);
  assert.equal(cold.actions[0].tier,1);
  assert.equal(cold.pendingRecords.size,0);

  const warm=openRoom({knownAccount:true});
  await warm.settle(button());
  assert.deepEqual(warm.calls,['releaseExchange'],'a known account submits directly');

  const unknown=openRoom({stock:null});
  const join=unknown.settle(button());
  assert.deepEqual(unknown.calls,['read'],'a tap joins the stock lookup');
  unknown.respond();await join;
  assert.deepEqual(unknown.calls,['read','releaseExchange']);

  const interrupted={action:'crate',tier:3,accountRef:fixture.accountRef,account:fixture.name,
    revision:1,requestId:'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'};
  const recovery=openRoom({pending:interrupted});
  const earlyTap=recovery.settle(button());
  recovery.respond();await earlyTap;
  assert.deepEqual(recovery.actions.map(action=>action.requestId),[interrupted.requestId],
    'recovery resends only the original request when tapped again');
  assert.equal(recovery.pendingRecords.size,0);

  const prewarm=openRoom({active:false,stock:null,pending:interrupted});
  assert.deepEqual(prewarm.calls,[],'dormant frames do not fetch, even during recovery');
  prewarm.open();
  assert.deepEqual(prewarm.calls,['read']);
  prewarm.respond();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(prewarm.actions[0].requestId,interrupted.requestId);

  const cancelled=openRoom();
  const closingTap=cancelled.settle(button());
  cancelled.close();
  cancelled.context.page='storage';
  Object.assign(cancelled.snapshot,{wallet:{crateVouchers:75},stock:[4,0,0,0,0]});
  cancelled.open();
  cancelled.respond();await closingTap;
  assert.deepEqual(cancelled.calls,['read'],'a purchase waiting on a previous visit is cancelled');
  assert.equal(cancelled.pendingRecords.size,0);
  assert.equal(cancelled.context.page,'vault');
  assert.equal(cancelled.context.data.wallet.crateVouchers,75);
  assert.equal(cancelled.context.data.stock[0],4);
}
run().then(()=>console.log('PASS: embedded Crates browsing, first tap, and recovery'));
