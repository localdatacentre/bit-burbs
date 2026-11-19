'use strict';

// Only server-minted copies from the protected city envelope enter the live ledger.
async function deliverMarketCopies(bucket, canonical) {
  if (typeof canonical !== 'string' || !/^[a-f0-9]{64}$/.test(canonical)) throw Error('Invalid city');
  const cityKey = 'live-city/roster2/' + canonical;
  const marketKey = 'exchange/v2/ledger';
  for (let attempt = 0; attempt < 8; attempt++) {
    const cityFile = await bucket.get(cityKey);
    if (!cityFile) throw Error('Linked city missing');
    const city = await cityFile.json();
    const copies = city.crateExchange?.pendingCopies ?? [];
    if (!copies.length) return;
    const file = await bucket.get(marketKey);
    const ledger = file ? await file.json() : {players:{},links:{},invites:{},assets:[],listings:[],trades:[],sales:[],events:[]};
    const known = new Map(ledger.assets.map(copy => [copy.id, copy]));
    let changed = false;
    for (const copy of copies) {
      if (!copy.id || !copy.receipt || !copy.model || copy.owner !== canonical ||
          copy.origin !== canonical || copy.state !== 'inventory') throw Error('Invalid pending copy');
      const existing = known.get(copy.id);
      if (existing) {
        if (existing.origin !== canonical || existing.receipt !== copy.receipt ||
            existing.model !== copy.model || existing.minted !== copy.minted) throw Error('Copy identity conflict');
        continue;
      }
      ledger.assets.push(copy);
      known.set(copy.id, copy);
      changed = true;
    }
    if (changed) {
      const onlyIf = file ? {etagMatches:file.etag} : {etagDoesNotMatch:'*'};
      if (!await bucket.put(marketKey, JSON.stringify(ledger), {onlyIf})) continue;
    }
    const updated = {...city, crateExchange:{...city.crateExchange,pendingCopies:[]}};
    if (await bucket.put(cityKey, JSON.stringify(updated), {onlyIf:{etagMatches:cityFile.etag}})) return;
  }
  throw Error('Pending copies will need another delivery attempt');
}
if (typeof module !== 'undefined') module.exports = {deliverMarketCopies};
