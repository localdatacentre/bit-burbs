// Keep prepareCrateConversion in sync with the account server's hosting/crate-conversion.js.
// The browser projects the wallet for display; only the server persists a conversion.
function projectCrateWallet(city) {
  function prepareCrateConversion(city) {
    if (!city || city.v !== 2) throw new Error('Unsupported city save');
    if (city.crateConversion?.version === 1) return city;
    if (city.crateConversion != null) throw new Error('Unknown crate conversion version');

    function count(value) {
      const n = value == null ? 0 : Number(value);
      if (!['number','string'].includes(typeof (value ?? 0)) ||
          !Number.isSafeInteger(n) || n < 0) throw new Error('Invalid saved balance');
      return n;
    }
    const crates = city.crates ?? {}, keys = city.keys ?? {};
    for (const bag of [crates, keys]) {
      if (typeof bag !== 'object' || Array.isArray(bag)) throw new Error('Invalid crate inventory');
    }
    for (const tier of Object.keys(crates)) {
      if (!['wood','steel','silver','gold','diamond','premium'].includes(tier) && count(crates[tier])) {
        throw new Error('Unrecognised crate tier: ' + tier);
      }
    }
    for (const tier of Object.keys(keys)) {
      if (!['steel','gold','diamond'].includes(tier) && count(keys[tier])) throw new Error('Unrecognised key tier: ' + tier);
    }
    // Older saves may precede the existing wood and partial-key conversions.
    const converted = {
      silver: count(crates.silver) + count(crates.steel) + count(crates.wood) + Math.ceil(count(keys.steel) / 3),
      gold: count(crates.gold) + Math.ceil(count(keys.gold) / 2),
      diamond: count(crates.diamond) + count(keys.diamond),
      premium: count(crates.premium)
    };
    const added = converted.silver * 2 + converted.gold * 6 + converted.diamond * 14 + converted.premium * 30;
    const previous = count(city.crateVouchers);
    const next = {...city, crates:{}, crateVouchers:count(previous + added),
      crateConversion:{version:1, converted, previous, added}};
    delete next.keys;
    return next;
  }

  try {
    return {crateVouchers:prepareCrateConversion(city).crateVouchers??0, crateInventoryError:null};
  } catch {
    const previous=city?.crateVouchers;
    return {
      crateVouchers:Number.isSafeInteger(previous)&&previous>=0 ? previous : null,
      crateInventoryError:'Your old crate inventory needs review before buying or opening crates.'
    };
  }
}
module.exports=projectCrateWallet;
