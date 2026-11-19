'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { deliverCityExchangeEntry: deliver } = require('../city-exchange.js');

const player = 'a'.repeat(64);
const path = 'live-city/roster2/' + player;
const purchase = {playerId: player, sequence: 1, action: 'buy-crate', tier: 'silver'};
const opening = {playerId: player, sequence: 2, action: 'open-crate', winners: [{kind: 'cash', amount: 1500}]};

function fixture(vouchers = 2) {
  let revision = 1;
  let envelope = {city: {v: 2, crateVouchers: vouchers, cash: 4.5}, progress: 'progress-id', extra: {saved: true}};
  return {
    get state() { return structuredClone(envelope); },
    editCity(fields) { Object.assign(envelope.city, fields); revision++; },
    async get(key) {
      if (key !== path) return null;
      const snapshot = structuredClone(envelope);
      return {etag: String(revision), json: async () => snapshot};
    },
    async put(key, value, {onlyIf}) {
      assert.equal(key, path);
      if (onlyIf.etagMatches !== String(revision)) return null;
      envelope = JSON.parse(value);
      return {etag: String(++revision)};
    }
  };
}

test('same receipt delivered concurrently debits once and credits once', async () => {
  const bucket = fixture();
  for (const entry of [purchase, opening]) {
    const revisions = await Promise.all(Array.from({length: 3}, () => deliver(bucket, player, entry)));
    assert.equal(new Set(revisions).size, 1);
  }
  assert.deepEqual(bucket.state, {
    city: {v: 2, crateVouchers: 0, cash: 1504.5, exchangeSequence: 2},
    progress: 'progress-id', extra: {saved: true}
  });
});

test('a concurrent task claim survives an Exchange write conflict', async () => {
  const bucket = fixture();
  const put = bucket.put;
  bucket.put = async (...args) => {
    bucket.editCity({crateVouchers: 3, taskClaims: 1});
    bucket.put = put;
    return put(...args);
  };
  await deliver(bucket, player, purchase);
  assert.equal(bucket.state.city.crateVouchers, 1);
  assert.equal(bucket.state.city.taskClaims, 1);
});

test('retry after a lost acknowledgement reuses the paid revision', async () => {
  const bucket = fixture();
  await deliver(bucket, player, purchase);
  const put = bucket.put;
  bucket.put = async (...args) => {
    await put(...args);
    throw Error('Connection lost');
  };
  await assert.rejects(deliver(bucket, player, opening), /Connection lost/);
  assert.equal(await deliver(bucket, player, opening), '3');
  assert.equal(bucket.state.city.cash, 1504.5);
});

test('wrong account, missing city, gaps, unpaid purchases and sustained contention leave the entry pending', async () => {
  const bucket = fixture(1);
  const original = bucket.state;
  const other = 'b'.repeat(64);
  await assert.rejects(deliver(bucket, other, purchase), /mismatch/);
  await assert.rejects(deliver(bucket, other, {...purchase, playerId: other}), /missing/);
  await assert.rejects(deliver(bucket, player, opening), /entry missing/);
  await assert.rejects(deliver(bucket, player, purchase), /balance/);
  assert.deepEqual(bucket.state, original);
  const busy = fixture();
  let attempts = 0;
  busy.put = async () => { attempts++; return null; };
  await assert.rejects(deliver(busy, player, purchase), /busy/);
  assert.equal(attempts, 5);
  assert.equal(busy.state.city.crateVouchers, 2);
});
