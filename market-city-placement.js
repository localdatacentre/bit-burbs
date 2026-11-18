'use strict';

// "Place" delivers the exact copy to the game's building placement picker.
// Packing also works before the player has chosen a plot.
async function moveMarketCopy(bucket, owner, command) {
  const {requestId, action, asset:id} = command;
  if (!['place','pack'].includes(action) || typeof requestId!=='string' ||
      !/^[0-9a-f-]{36}$/i.test(requestId) || typeof owner!=='string' ||
      !/^[a-f0-9]{64}$/.test(owner)) throw Error('Invalid building move');
  const ledgerKey='exchange/v2/ledger', cityKey='live-city/roster2/'+owner;
  for(let attempt=0;attempt<10;attempt++){
    const ledgerFile=await bucket.get(ledgerKey);
    if(!ledgerFile)throw Error('Collection missing');
    const ledger=await ledgerFile.json(), moves=ledger.moves??={};
    const copy=ledger.assets.find(a=>a.id===id);
    const move=moves[requestId];
    if(move&&(move.owner!==owner||move.id!==id||move.action!==action))throw Error('Move receipt mismatch');
    if(move?.done)return;
    if(copy?.owner!==owner)throw Error('Copy unavailable');
    if(!move){
      if(copy.state!==(action==='place'?'inventory':'placed'))throw Error('Copy unavailable');
      copy.state='moving';
      moves[requestId]={owner,id,action,done:false};
    }else{
      if(copy.state!=='moving')throw Error('Move reservation missing');
      const cityFile=await bucket.get(cityKey);
      if(!cityFile)throw Error('Linked city missing');
      const record=await cityFile.json(), city=record.city;
      if(!record.diamondMoves?.[requestId]){
        if(city?.v!==2||!Array.isArray(city.tiles))throw Error('Invalid city');
        const stored=city.storedBuildings??=[], tiles=city.tiles;
        const matches=stored.filter(e=>e.building?.diamondCopyId===id);
        const plots=tiles.filter(t=>t?.diamondCopyId===id);
        if(matches.length+plots.length!==(action==='place'?0:1))throw Error('City copy mismatch');
        if(action==='place'){
          city.storedBuildings=[...stored,{building:{id:copy.model,diamondCopyId:id}}];
        }else if(matches.length){
          city.storedBuildings=stored.filter(e=>e!==matches[0]);
        }else{
          const width=Math.sqrt(tiles.length), index=tiles.indexOf(plots[0]);
          if(!Number.isInteger(width))throw Error('Unknown city footprint');
          const x=index%width,y=Math.floor(index/width);
          city.tiles=tiles.map((t,i)=>i===index||(t?.id==='_occ'&&t.ref?.[0]===x&&t.ref?.[1]===y)?null:t);
        }
        const seq=(city.exchangeSequence??0)+1;
        if(!Number.isSafeInteger(seq)||seq<1)throw Error('Invalid city revision');
        city.exchangeSequence=seq;
        (record.diamondMoves??={})[requestId]=true;
        if(!await bucket.put(cityKey,JSON.stringify(record),{onlyIf:{etagMatches:cityFile.etag}}))continue;
      }
      copy.state=action==='place'?'placed':'inventory';
      move.done=true;
    }
    if(await bucket.put(ledgerKey,JSON.stringify(ledger),{onlyIf:{etagMatches:ledgerFile.etag}})&&move?.done)return;
  }
  throw Error('City busy. Retry the building move.');
}
if(typeof module!=='undefined')module.exports={moveMarketCopy};
