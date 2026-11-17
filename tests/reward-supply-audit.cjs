'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const crates={Silver:{cost:2,coins:.45*2250,dosh:.25*15,deeds:.25+.01*2,spins:.04},Gold:{cost:6,coins:.35*10000,dosh:.25*25,deeds:.3,spins:.1},Emerald:{cost:14,coins:.25*24000,dosh:.25*50,deeds:.38*2,spins:.12*2},Ruby:{cost:30,coins:.2*57500,dosh:.2*110,deeds:.35*4,spins:.15*3},Diamond:{cost:80,coins:.15*185000,dosh:.2*300,deeds:.3*12,spins:.15*8,buildings:.1}};
const wheel={vouchers:.2+.15*2+.08*5,restockVouchers:.15+.1*2,coins:.05*6000,dosh:.1*10+.05*25,deeds:.1+.02*2,milestoneVouchers:2/10};
assert.equal(wheel.vouchers,.9);assert.equal(wheel.vouchers+wheel.milestoneVouchers,1.1);
const weekly=[];
for(const freeSpins of [7,14])for(const legacyWeekly of [false,true])for(const tier of Object.keys(crates)){
 const c=crates[tier],external=98+(14+freeSpins+(legacyWeekly?3:0)) * 1.1+.66;
 const feedback=c.spins/c.cost*1.1;
 weekly.push({freeSpins,legacyWeekly,tier,externalVouchers:external,crateSpinFeedbackFraction:feedback,totalVoucherThroughput:external/(1-feedback),assumption:'long-run; all incoming vouchers spent on this tier; no level tickets, purchases or ads; uniform free shop offers'});
}
const report={approvedDesign:true,implementedLive:false,crates,wheel,weekly,collection:{anyBuildingExpectedVouchers:80/.1,specificModelExpectedVouchers:80/.0125,expectedVouchersForAllEightWithoutTrading:80*10*8*Array.from({length:8},(_,i)=>1/(i+1)).reduce((a,b)=>a+b,0),caution:'Expectations only; independent random openings never guarantee a building or a complete set.'}};
assert(weekly.every(x=>x.crateSpinFeedbackFraction<.03));
fs.writeFileSync(path.join(__dirname,'../docs/reward-supply-audit-results.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({wheel,weeklyRangeWithoutLegacy:[Math.min(...weekly.filter(x=>!x.legacyWeekly).map(x=>x.totalVoucherThroughput)),Math.max(...weekly.filter(x=>!x.legacyWeekly).map(x=>x.totalVoucherThroughput))],collection:report.collection},null,2));
