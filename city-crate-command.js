'use strict';

// Worker adapter for the Exchange crate, open and finish buttons. The caller
// supplies the linked canonical ID and the playtest's server-side exchangeApply.
async function runCityCrateCommand(bucket, playerId, command, exchangeApply, settleCityExchange, convertCrates) {
  if (!/^[a-f0-9]{64}$/.test(playerId) || typeof playerId !== 'string') throw Error('Invalid city');
  if (!['crate', 'open', 'finish'].includes(command.action) ||
      !/^[a-f0-9-]{36}$/i.test(command.requestId) ||
      !Number.isSafeInteger(command.revision) || command.revision < 0) throw Error('Invalid crate command');
  const path = 'live-city/roster2/' + playerId;
  const tiers = ['silver', 'gold', 'emerald', 'ruby', 'diamond'];
  for (let attempt = 0; attempt < 5; attempt++) {
    const file = await bucket.get(path);
    if (!file?.etag) throw Error('City missing');
    const record = await file.json();
    if (record.city?.v !== 2) throw Error('Invalid city save');
    const exchange = record.crateExchange ?? {revision: 0, stock: [0,0,0,0,0], opening: null, pendingCopies: []};
    if (exchange.last === command.requestId && exchange.revision === command.revision + 1) return exchange;
    if (command.revision !== exchange.revision) throw Error('Refresh crate storage');
    // The voucher credit and crate debit share the same city revision.
    const city = command.action === 'finish' ? record.city : convertCrates(record.city);
    const player = {
      wallet: {crateVouchers: city.crateVouchers ?? 0, cash: 0, dosh: 0, deeds: 0, wheelTickets: 0},
      boosts: 0, stock: [...exchange.stock], opening: exchange.opening
    };
    const state = {players: {[playerId]: player}, assets: [], events: []};
    exchangeApply(state, playerId, command, Date.now());
    let nextCity = city;
    if (command.action !== 'finish') {
      const entry = command.action === 'crate'
        ? {action: 'buy-crate', tier: tiers[command.tier]}
        : {action: 'open-crate', winners: player.opening.winners};
      nextCity = settleCityExchange(city, playerId, {...entry, playerId, sequence: (city.exchangeSequence ?? 0) + 1});
    }
    const next = {revision: exchange.revision + 1, last: command.requestId, stock: player.stock,
      opening: player.opening, pendingCopies: [...exchange.pendingCopies, ...state.assets]};
    const result = await bucket.put(path, JSON.stringify({...record, city: nextCity, crateExchange: next}),
      {onlyIf: {etagMatches: file.etag}});
    if (result) return next;
  }
  throw Error('City busy. Retry the same request.');
}
if (typeof module !== 'undefined') module.exports = {runCityCrateCommand};
