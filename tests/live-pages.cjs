const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
require('node:child_process').execFileSync(process.execPath, [path.join(root,'tools/bundle-exchange.cjs'),'--check']);
const base = new URL('https://localdatacentre.github.io/bit-burbs/');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function checkAsset(reference) {
  const asset = new URL(reference, base);
  if (asset.origin !== base.origin) return;
  assert.ok(asset.pathname.startsWith(base.pathname), reference);
  assert.ok(fs.existsSync(path.join(root, asset.pathname.slice(base.pathname.length))), reference);
}

for (const page of ['index.html', 'banksia-exchange.html']) {
  const html = read(page);
  for (const [,script] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) new vm.Script(script);
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, tag => tag.split('>')[0] + '>');
  for (const [,ref] of markup.matchAll(/(?:src|href)="([^"]+)"/g)) checkAsset(ref);
}
for (const tier of ['silver','gold','emerald','ruby','diamond']) checkAsset('exchange-art/'+tier+'.png');

async function checkAccount() {
  const local = new Map();
  const slot = 'bit-burbs:roster2:';
  const calls = [];
  const context = {window:{}, localStorage:{getItem:key=>local.get(key)}, location:{search:'?city=fixture'},
    URLSearchParams, AbortSignal, fetch:(url,init)=>calls.push(JSON.parse(init.body))};
  vm.runInNewContext(read('release-account.js'),context);
  const request = context.window.liveCityRelease;
  await assert.rejects(request('releaseExchange'), {status:401});
  local.set(slot+'last-username','other');
  local.set(slot+'other:cloud-key','fixture-code');
  await assert.rejects(request('releaseShop',{offer:'example'}), {status:403});
  assert.equal(calls.length,0);
  local.set(slot+'last-username','fixture');
  local.set(slot+'fixture:cloud-key','fixture-code');
  await request('releaseExchange');
  assert.equal(calls.length,1);
  assert.equal(calls[0].name,'fixture');
}
async function checkCache() {
  const events = {};
  const worker = {location:new URL('service-worker.js',base), addEventListener:(name,fn)=>events[name]=fn, skipWaiting(){}};
  let precached, finishWrite, writeStarted;
  const writing = new Promise(resolve=>{writeStarted=resolve;});
  const cache = {
    addAll:files=>{precached=files;},
    put:()=>new Promise(resolve=>{finishWrite=resolve;writeStarted();})
  };
  const fresh = {ok:true,clone(){return {...this};}};
  vm.runInNewContext(read('service-worker.js'), {self:worker, URL, fetch:async()=>fresh,
    Request:class {constructor(url){this.url=url;}}, caches:{open:async()=>cache}});
  let install;
  events.install({waitUntil:promise=>install=promise});
  await install;
  for(const file of precached)checkAsset(file.url);
  let navigation, backgroundWrite;
  events.fetch({request:{method:'GET',url:base.href,mode:'navigate'},
    respondWith:promise=>{navigation=promise;}, waitUntil:promise=>{backgroundWrite=promise;}});
  await writing;
  assert.equal(await Promise.race([navigation, new Promise(resolve=>setImmediate(()=>resolve('blocked')))]),fresh);
  assert.ok(backgroundWrite);
  finishWrite();await backgroundWrite;
  for(const file of ['banksia-exchange.html?page=shop','missing-page.html']){
    events.fetch({request:{method:'GET',url:new URL(file,base).href,mode:'navigate'},
      respondWith:()=>assert.fail('City cache intercepted '+file)});
  }
}
Promise.all([checkAccount(),checkCache()]).then(()=>console.log('PASS: live page assets, city selection and PWA navigation'));
