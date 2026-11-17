'use strict';

// The caller resolves buyer from the signed-in account. isReleased reads the
// server's edition schedule. Replaying the same request resumes a reserved sale.
async function purchaseMarketListing(bucket, buyer, command, isReleased, settleReservedSale) {
  const key = 'exchange/v2/ledger';
  const id = command.requestId;
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id) ||
      typeof buyer !== 'string' || !/^[a-f0-9]{64}$/.test(buyer)) throw Error('Invalid purchase');
  for (let attempt = 0; attempt < 10; attempt++) {
    const file = await bucket.get(key);
    if (!file) throw Error('Listing unavailable');
    const ledger = await file.json();
    const reservations = ledger.reservations ??= {};
    const listing = ledger.listings.find(l => l.id === command.listing);
    let sale = reservations[id];
    if (!sale) {
      const asset = ledger.assets.find(a => a.id === listing?.asset);
      if (!listing || listing.price !== command.price || asset?.state !== 'listed' ||
          !isReleased(asset) || asset.owner === buyer) throw Error('Listing unavailable');
      sale = reservations[id] = {id,buyer,seller:asset.owner,copy:asset.id,listing:listing.id,price:listing.price,state:'pending'};
      asset.state = 'reserved';
    } else {
      if (sale.buyer !== buyer || sale.listing !== command.listing || sale.price !== command.price)
        throw Error('Purchase request mismatch');
      if (sale.state !== 'pending') return sale;
      const asset = ledger.assets.find(a => a.id === sale.copy);
      if (!listing || asset?.state !== 'reserved' || asset.owner !== sale.seller) throw Error('Reservation mismatch');
      const payment = await settleReservedSale(bucket,sale);
      sale.state = payment.paid ? 'sold' : 'declined';
      asset.state = payment.paid ? 'inventory' : 'listed';
      if (payment.paid) {
        asset.owner = buyer;
        ledger.listings = ledger.listings.filter(l => l.id !== sale.listing);
        const time = Date.now();
        ledger.sales.push({model:asset.model,price:sale.price,time,rotationSale:true,receipt:id});
        ledger.events.push({kind:'Sale',at:time,actor:buyer,other:sale.seller,copy:asset.id,price:sale.price,fee:payment.fee,receipt:id});
      }
    }
    if (await bucket.put(key,JSON.stringify(ledger),{onlyIf:{etagMatches:file.etag}}) && sale.state !== 'pending') return sale;
  }
  throw Error('Market busy. Retry the same purchase.');
}
if (typeof module !== 'undefined') module.exports={purchaseMarketListing};
