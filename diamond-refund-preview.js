'use strict';

// Count physical legacy holdings once per location. Legacy item counters and
// shop purchase markers are supporting evidence only.
function previewDiamondRefund(city) {
  const ids=['sakura','fountain','statue','sunhouse','pelicanLight','tidalBaths','civicClock','needle'];
  const holdings=new Map(ids.map(id=>[id,{id,plots:[],stored:[],bag:0,legacyOwned:0,shopMarker:false}]));
  const count=(value)=>{
    if(value==null)return 0;
    if(!Number.isSafeInteger(value)||value<0)throw Error('Invalid inventory count');
    return value;
  };
  for(const [index,tile] of (city.tiles||[]).entries()){
    if(tile&&!tile.diamondCopyId&&holdings.has(tile.id))holdings.get(tile.id).plots.push(index);
  }
  for(const [index,entry] of (city.storedBuildings||[]).entries()){
    const tile=entry?.building||entry;
    if(tile&&!tile.diamondCopyId&&holdings.has(tile.id))holdings.get(tile.id).stored.push(index);
  }
  for(const h of holdings.values()){
    h.bag=count(city.shopItems?.[h.id]);
    h.legacyOwned=count(city.items?.[h.id]);
    h.shopMarker=!!city.market?.bought?.[h.id];
    h.copies=h.plots.length+h.stored.length+h.bag;
  }
  return [...holdings.values()].filter(h=>h.copies||h.legacyOwned||h.shopMarker);
}
if(typeof module!=='undefined')module.exports={previewDiamondRefund};
