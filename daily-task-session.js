// Forecast a shared session using current stock, staff and available supplies.
(() => {
  const minute = 60000;
  function forecast(snapshot, at) {
    const businesses = snapshot.businesses.filter(b => b.connected && b.employees > 0)
      .map(b => ({...b, ordered: false}));
    let coins = snapshot.cash;
    let vouchers = snapshot.restockVouchers;
    const events = [];
    const emit = event => events.push({...event, id: 'forecast-' + events.length});
    const horizon = Math.min(120, (Date.parse(LabCore.cycle(at)+'T08:00:00Z') + 86400000 - at - 1)/minute);
    for (let elapsed=0; elapsed+1<=horizon; elapsed++) {
      const from = at + elapsed*minute;
      const to = from+minute;
      const facts = {};
      for (const [index, metric] of ['suppliedHomeMinutes','powerMinutes','waterMinutes','connectedMinutes'].entries()) {
        for (const id of snapshot.services[index] || []) (facts[id] ||= {})[metric] = true;
      }
      for (const b of businesses) {
        if (b.remaining <= 0 && b.pending === null && !b.ordered && (vouchers > 0 || coins >= b.fee)) {
          if (vouchers > 0) vouchers--;
          else coins -= b.fee;
          b.ordered = true;
          b.pending = b.delivery;
          emit({type:'order',subject:b.id,at:from});
        }
        const sold = Math.min(1,b.remaining);
        b.remaining -= sold;
        Object.assign(facts[b.id] ||= {}, {coins:sold*b.rate,selling:sold===1,employees:b.employees,connected:true});
        if (b.pending !== null && --b.pending <= 0) {
          b.pending = null;
          b.remaining = b.stock;
          emit({type:'delivery',subject:b.id,at:to});
        }
      }
      if((elapsed+1)%10===0)for(const stop of snapshot.stops||[]) {
        if(stop.connected)emit({type:'busVisit',subject:stop.id,at:to,active:true,foreground:true});
      }
      emit({type:'interval',from,at:to,active:true,foreground:true,facts});
    }
    return events;
  }
  globalThis.DailyTaskSession = {forecast};
})();
