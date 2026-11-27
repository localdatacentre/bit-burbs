const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('function bagEntryVisible(');
const end = html.indexOf('function layoutUI()', start);
const context = vm.createContext({DEFS:{house:{},retired:{}},modelReady:id=>id==='house',setText:(el,text)=>{el.textContent=text;}});
vm.runInContext(html.slice(start,end), context);
const city = {tickets:0,wheelT:100,restockVouchers:0,coinBoostTokens:{},storedBuildings:[],dailyGenerated:{tasks:[]}};
const options = {at:100,wheelCooldown:1000,loginAvailable:false,crateVouchers:0,crateStock:[],boostMinutes:10,storedBuildings:false,storedItems:false};
const notices = (changes={},settings={})=>context.menuNotifications({...city,...changes},{...options,...settings});
assert.ok(Object.values(notices()).every(value=>!value));
assert.equal(notices({}, {crateVouchers:1}).crates, false);
assert.equal(notices({}, {crateVouchers:2}).crates, true);
assert.equal(notices({}, {crateStock:[0,0,1,0,0]}).crates, true);
assert.equal(notices({tickets:1}).wheel, true);
assert.equal(notices({}, {at:1099}).wheel, false);
assert.equal(notices({}, {at:1100}).wheel, true);
assert.equal(notices({}, {loginAvailable:true}).tasks, true);
assert.equal(notices({dailyGenerated:{tasks:[{progress:2,target:2,claimed:false}]}}).tasks, true);
assert.equal(notices({dailyGenerated:{tasks:[{progress:2,target:2,claimed:true}]}}).tasks, false);
for (const changes of [{restockVouchers:1},{coinBoostTokens:{10:1}}]) {
  assert.equal(notices(changes).bag, true);
}
assert.equal(notices({}, {storedItems:true}).bag, true);
assert.equal(context.bagEntryVisible('house'),true);
assert.equal(context.bagEntryVisible('retired'),false);
assert.equal(context.bagEntryVisible('unknown'),false);
const stored = [{building:{id:'retired'}}];
assert.equal(notices({storedBuildings:stored}, {storedBuildings:stored.some(e=>context.bagEntryVisible(e.building.id))}).bag,false);
stored.push({building:{id:'house'}});
assert.equal(notices({storedBuildings:stored}, {storedBuildings:stored.some(e=>context.bagEntryVisible(e.building.id))}).bag,true);
// Reading the bag does not consume an item; its notification remains until used.
assert.equal(notices({restockVouchers:1,bagUnread:false}).bag, true);
const badge = {};
context.dot(badge,100); assert.equal(badge.textContent,'!'); assert.equal(badge.hidden,false);
context.dot(badge,0); assert.equal(badge.hidden,true);
console.log('PASS: actionable menu notifications, affordability, cooldown and exclamation badges');
