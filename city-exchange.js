'use strict';

// Apply an authenticated ledger entry to its linked cloud city. The caller must
// persist this snapshot with the expected city revision, then acknowledge delivery.
// Only server-generated entries may enter this function.
function settleCityExchange(city, playerId, entry) {
  if (city?.v !== 2 || !playerId || entry.playerId !== playerId) throw Error('City mismatch');
  const sequence = entry.sequence, previous = city.exchangeSequence ?? 0;
  if (!Number.isSafeInteger(sequence) || sequence < 1 || !Number.isSafeInteger(previous) || previous < 0) throw Error('Invalid exchange sequence');
  if (sequence <= previous) return city;
  if (sequence !== previous + 1) throw Error('Previous exchange entry missing');

  const next = {...city, exchangeSequence:sequence};
  function adjust(key, amount) {
    const value = next[key] ?? 0;
    if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(amount) ||
        value + amount < 0 || value + amount > Number.MAX_SAFE_INTEGER) throw Error('Invalid balance: ' + key);
    next[key] = value + amount;
  }
  if (entry.action === 'buy-crate') {
    const prices = {silver:2, gold:6, emerald:14, ruby:30, diamond:80};
    if (!Object.hasOwn(prices,entry.tier)) throw Error('Unknown tier');
    adjust('crateVouchers', -prices[entry.tier]);
  } else if (entry.action === 'open-crate') {
    if (![1,3].includes(entry.winners?.length)) throw Error('Invalid opening');
    const balances = {cash:'cash', dosh:'stars', deeds:'deeds', wheelTickets:'tickets'};
    for (const reward of entry.winners) {
      if (!Number.isSafeInteger(reward.amount) || reward.amount < 1) throw Error('Invalid reward');
      if (Object.hasOwn(balances,reward.kind)) adjust(balances[reward.kind], reward.amount);
      else if (reward.kind === 'boost' && reward.amount === 1) {
        const count = next.coinBoostTokens?.[10] ?? 0;
        if (!Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(count + 1)) throw Error('Invalid boost count');
        next.coinBoostTokens = {...next.coinBoostTokens,10:count + 1};
      } else if (reward.kind !== 'diamond' || reward.amount !== 1 || !reward.copy) {
        throw Error('Unknown reward');
      }
      // Diamond copies stay in the shared ownership ledger; never create a second bag item.
    }
  } else throw Error('Unknown exchange entry');
  return next;
}
// Called by the server after it reads a committed entry from its ledger.
// A returned revision means the city already includes this sequence.
async function deliverCityExchangeEntry(bucket, playerId, entry) {
  if (typeof playerId !== 'string' || !/^[a-f0-9]{64}$/.test(playerId) ||
      entry?.playerId !== playerId) throw Error('City mismatch');
  const key = 'live-city/roster2/' + playerId;
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await bucket.get(key);
    if (!current?.etag) throw Error('Linked cloud city missing');
    const envelope = await current.json();
    const city = settleCityExchange(envelope.city, playerId, entry);
    if (city === envelope.city) return current.etag;
    const saved = await bucket.put(key, JSON.stringify({...envelope, city}), {
      onlyIf: {etagMatches: current.etag}
    });
    if (saved) return saved.etag;
  }
  throw Error('Cloud city busy. Retry the pending exchange entry.');
}
if (typeof module !== 'undefined') module.exports={settleCityExchange, deliverCityExchangeEntry};
