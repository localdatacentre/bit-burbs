'use strict';

const {prepareCrateConversion} = require('./crate-conversion.js');
const {previewDiamondRefund} = require('./diamond-refund-preview.js');
const {isDeepStrictEqual} = require('node:util');

// Operates on an exported copy only. No storage client or live write path.
function rehearseCrateRelease(snapshot, review, stages) {
  if (!stages?.crates || !stages?.wheel || stages.crates !== true || stages.wheel !== true)
    throw Error('Both release stages are required');
  if (!/^[0-9a-f]{64}$/.test(review?.canonical ?? '') || snapshot.canonical !== review.canonical)
    throw Error('Account does not match reviewed canonical ID');
  const city = snapshot.city;
  if (city?.v !== 2 || !Array.isArray(city.tiles)) throw Error('Invalid city snapshot');
  const before = previewDiamondRefund(city);
  const converted = prepareCrateConversion(city);
  if (!Array.isArray(review.plots) || !Number.isSafeInteger(review.coins) || review.coins < 0 ||
      !Number.isSafeInteger(review.dosh) || review.dosh < 0) throw Error('Invalid reviewed refund');
  const receipt = {version:1,canonical:review.canonical,coins:review.coins,dosh:review.dosh,
    plots:review.plots.map(({index,model})=>({index,model})).sort((a,b)=>a.index-b.index)};
  if (city.legacyDiamondRefund != null) {
    if (!isDeepStrictEqual(receipt,city.legacyDiamondRefund)) throw Error('Existing refund differs from review');
    return {...snapshot,city:converted};
  }
  const observed = before.flatMap(h=>h.plots.map(index=>({index,model:h.id}))).sort((a,b)=>a.index-b.index);
  if (!isDeepStrictEqual(observed,receipt.plots)) throw Error('Legacy plots differ from review');
  const width=Math.sqrt(city.tiles.length);
  if (!Number.isSafeInteger(width) || width<1) throw Error('Unknown city dimensions');
  const anchors=new Set(observed.map(p=>p.index));
  const tiles=city.tiles.map((tile,i)=>{
    if (anchors.has(i)) return null;
    if (tile?.id!=='_occ' || !Array.isArray(tile.ref)) return tile;
    const [x,y]=tile.ref;
    if (!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=width||y<0||y>=width) throw Error('Invalid footprint reference');
    return anchors.has(y*width+x)?null:tile;
  });
  const cash=city.cash+review.coins, stars=city.stars+review.dosh;
  if (!Number.isFinite(city.cash)||city.cash<0||cash>Number.MAX_SAFE_INTEGER||
      !Number.isSafeInteger(city.stars)||city.stars<0||!Number.isSafeInteger(stars)) throw Error('Invalid refund balance');
  return {...snapshot,city:{...converted,cash,stars,tiles,legacyDiamondRefund:receipt}};
}

module.exports={rehearseCrateRelease};

if(require.main===module){
  const fs=require('node:fs');
  const [snapshotFile,reviewFile]=process.argv.slice(2);
  if(!snapshotFile||!reviewFile)throw Error('Supply a copied city envelope and its independently reviewed refund JSON');
  const snapshot=JSON.parse(fs.readFileSync(snapshotFile,'utf8')), review=JSON.parse(fs.readFileSync(reviewFile,'utf8'));
  const stages={crates:true,wheel:true}; // simulated release conditions
  const first=rehearseCrateRelease(snapshot,review,stages);
  const repeat=rehearseCrateRelease(JSON.parse(JSON.stringify(first)),review,stages);
  if(!isDeepStrictEqual(first,repeat))throw Error('Second run changed the save');
  console.log(JSON.stringify({coinsAdded:first.city.cash-snapshot.city.cash,doshAdded:first.city.stars-snapshot.city.stars,
    vouchersAdded:first.city.crateVouchers-(snapshot.city.crateVouchers??0),reviewedPlots:review.plots.length,
    remainingHoldings:previewDiamondRefund(first.city),repeatIdentical:true},null,2));
}
