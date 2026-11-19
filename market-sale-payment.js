'use strict';

// The Worker supplies an immutable sale reserved in the ownership ledger.
// A declined reservation stays declined even if the buyer earns more dosh later.
async function settleReservedSale(bucket, sale) {
  const {id, buyer, seller, price, copy} = sale;
  if (![buyer,seller].every(x => typeof x === 'string' && /^[0-9a-f]{64}$/.test(x)) ||
      buyer === seller || typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id) ||
      typeof copy !== 'string' || !copy || !Number.isSafeInteger(price) || price < 2 || price > 100000)
    throw Error('Invalid sale reservation');
  const fee = Math.max(1, Math.ceil(price * 0.05));
  async function post(player, amount) {
    const path = 'live-city/roster2/' + player;
    for (let attempt = 0; attempt < 8; attempt++) {
      const file = await bucket.get(path);
      if (!file) throw Error('Linked city missing');
      const record = await file.json();
      const receipt = record.marketPayments?.[id];
      if (receipt) {
        if (receipt.amount !== amount || receipt.buyer !== buyer || receipt.seller !== seller ||
            receipt.copy !== copy || receipt.price !== price) throw Error('Sale receipt conflict');
        return receipt.paid;
      }
      const city = record.city, balance = city?.stars ?? 0, sequence = city?.exchangeSequence ?? 0;
      if (city?.v !== 2 || !Number.isSafeInteger(balance) || balance < 0 ||
          !Number.isSafeInteger(balance + amount) || !Number.isSafeInteger(sequence) || sequence < 0 ||
          !Number.isSafeInteger(sequence + 1)) throw Error('Invalid city balance or sequence');
      const paid = balance + amount >= 0;
      const next = {...record, city: paid ? {...city,stars:balance + amount,exchangeSequence:sequence + 1} : city,
        marketPayments:{...record.marketPayments,[id]:{paid,buyer,seller,amount,copy,price}}};
      if (await bucket.put(path,JSON.stringify(next),{onlyIf:{etagMatches:file.etag}})) return paid;
    }
    throw Error('City busy. Retry the reserved sale.');
  }
  if (!await post(buyer,-price)) return {paid:false};
  await post(seller,price-fee);
  return {paid:true,fee};
}
if (typeof module !== 'undefined') module.exports = {settleReservedSale};
