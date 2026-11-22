// Each row contains a stable offer ID, its Dosh price and the rewards.
const doshOffers = [
  ['coins-small',10,{cash:3000}], ['coins-medium',20,{cash:8000}], ['coins-large',45,{cash:20000}],
  ['restock-small',15,{restockVouchers:3}], ['restock-medium',25,{restockVouchers:6}], ['restock-large',40,{restockVouchers:10}],
  ['crate-small',20,{crateVouchers:2}], ['crate-medium',35,{crateVouchers:4}], ['crate-large',65,{crateVouchers:8}],
  ['spin-small',20,{tickets:1}], ['spin-medium',35,{tickets:2}], ['spin-large',50,{tickets:3}],
  ['deeds-small',25,{deeds:2}], ['deeds-large',55,{deeds:5}],
  ['coins-restock-small',18,{cash:3000,restockVouchers:2}], ['coins-restock-medium',30,{cash:8000,restockVouchers:3}],
  ['coins-restock-large',50,{cash:15000,restockVouchers:5}], ['coins-crate-small',18,{cash:3000,crateVouchers:1}],
  ['coins-crate-medium',32,{cash:8000,crateVouchers:2}], ['restock-crate',28,{restockVouchers:2,crateVouchers:2}],
  ['restock-spin',30,{restockVouchers:3,tickets:1}], ['crate-spin',35,{crateVouchers:2,tickets:1}], ['coins-spin',28,{cash:5000,tickets:1}],
  ['free-coins-small',0,{cash:2000}], ['free-coins-large',0,{cash:5000}],
  ['free-dosh-small',0,{stars:5}], ['free-dosh-large',0,{stars:10}], ['free-spin',0,{tickets:1}]
];
const doshShopDayMs = 86400000;
const doshShopResetUtcMs = 8 * 3600000; // All cities share the 08:00 UTC refresh.
function shopRank(seed,id) {
  let value = seed | 0;
  for (const char of id) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return (value ^ (value >>> 16)) >>> 0;
}
function doshShopSchedule(now) {
  const day = Math.floor((now - doshShopResetUtcMs) / doshShopDayMs);
  const weekday = ((day + 3) % 7 + 7) % 7; // Monday = 0.
  const monday = day - weekday;
  const freeDays = [0,1,2,3,4,5,6].sort((a,b)=>shopRank(monday,String(a))-shopRank(monday,String(b))).slice(0,3);
  const free = freeDays.includes(weekday);
  // Alternate disjoint pools to prevent repeats even across week boundaries.
  const byDailyRank = (a,b)=>shopRank(day,a[0])-shopRank(day,b[0]);
  const pool = doshOffers.filter((_,i)=>i%2===day%2).sort(byDailyRank);
  const mixed = pool.filter(([,price,rewards])=>price&&Object.keys(rewards).length>1);
  const singles = pool.filter(([,price,rewards])=>price&&Object.keys(rewards).length===1);
  const offers = [...mixed.slice(0,2),...singles.slice(0,free?1:2)];
  if(free)offers.push(pool.find(([,price])=>price===0));
  return {day,resetAt:(day+1)*doshShopDayMs+doshShopResetUtcMs,
    offers:offers.map(([id,price,rewards])=>({id,price,rewards}))};
}
