// A visitor can only book an occupied residential lot. Timers survive saving and loading.
window.ResidentialCats = (() => {
  const active = new WeakMap();
  const visibleGround = new WeakMap();
  let lastCity, lastHomes, nextCheck = 0;
  const paths = new WeakMap();
  const sheets = new Map();
  const surfaces = new Set([
    0x76ac52, 0x8cbf62, 0x82b65a, // textured lawns
    0x91a87c, 0xa5b197, 0xa2ad96, 0xbbc1ae, 0x85a278, // residential turf
    0xbdb8ae, 0xb5b0a6, 0xada99f, 0xd6cdba, 0x586367, 0x858787 // driveways
  ]);

  // The daytime model already contains fences, buildings, pools and trees.
  // Find continuous exposed ground inside the projected footprint of each view.
  function routes(sp) {
    if (!sp) return [];
    if (paths.has(sp)) return paths.get(sp);
    const result = [];
    const {w, h, sc, fx, fy} = sp;
    const top = Math.max(0, sp.gMinY);
    const height = Math.min(h - top, 16 * (fx + fy) * sc);
    if (height > 0) {
      const data = sp.img.getContext('2d').getImageData(0, top, w, height).data;
      visibleGround.set(sp,{top,height,data});
      const originX = sp.gMinX + 32 * fy * sc;
      for (let y = 1; y < height - 1; y += 2) {
        let start = -1;
        for (let x = 0; x <= w; x++) {
          const a = (x + .5 - originX) / (2 * sc), b = (top + y + .5 - sp.gMinY) / sc;
          const u = (a+b)/2, v = (b-a)/2;
          let ground = u > 1 && v > 1 && u < 16*fx-1 && v < 16*fy-1;
          for (let dy = -1; ground && dy <= 1; dy++) {
            const p = 4 * ((y+dy)*w+x);
            ground = data[p+3] === 255 && surfaces.has((data[p]<<16)|(data[p+1]<<8)|data[p+2]);
          }
          if (ground && start < 0) start = x;
          if (!ground && start >= 0) {
            if (x-start >= 6*sc) result.push({x0:start+2*sc, x1:x-2*sc, y:top+y});
            start = -1;
          }
        }
      }
    }
    paths.set(sp,result);
    return result;
  }

  function update(city, homes, now, homeId, spriteFor, random = Math.random) {
    if (city === lastCity && homes === lastHomes && now < nextCheck) return;
    if (lastHomes) for (const h of lastHomes) active.delete(h.t);
    lastCity = city; lastHomes = homes; nextCheck = now + 1000;
    if (!homes?.length && !city.catVisits) return;
    const wait = () => Math.floor(6000 + random()*12000);
    const visits = city.catVisits ||= {};
    const taken = new Set();
    const available = homes || [];
    const byId = new Map(available.filter(h=>h.t.labId).map(h=>[h.t.labId,h]));
    // Release finished visits first, so choosing a new host can't double-book it.
    for (const kind of ['megatron','sweetie']) {
      const visit = visits[kind] ||= {next:now+wait()};
      const home = byId.get(visit.host);
      if (visit.host && home && now < visit.until && !taken.has(home.t)) {
        taken.add(home.t);
        active.set(home.t,visit);
      } else if (visit.host) {
        visit.previous = visit.host;
        delete visit.host;
        visit.next = now+wait();
      }
    }
    for (const kind of ['megatron','sweetie']) {
      const visit = visits[kind];
      if (visit.host || now < visit.next) continue;
      const free = available.filter(h=>!taken.has(h.t));
      const other = free.filter(h=>!visit.previous || h.t.labId!==visit.previous);
      const choices = other.length ? other : available.length===1 ? free : [];
      let home;
      while (choices.length) {
        const [candidate]=choices.splice(Math.floor(random()*choices.length),1);
        if (routes(spriteFor(candidate.t.id)).length) { home=candidate; break; }
      }
      if (!home) continue;
      Object.assign(visit,{kind,host:homeId(home.t),seed:Math.floor(random()*0x1000000),
        start:now,until:now+25000+Math.floor(random()*30000)});
      active.set(home.t,visit);
      taken.add(home.t);
    }
  }

  function draw(ctx, box, base, turn, cat, zoom, night, ms) {
    const options = routes(base);
    if (!options.length) return;
    const key = cat.kind + (night ? '-night' : '-day');
    if (!sheets.has(key)) {
      const image = new Image();
      image.src = './cats/'+key+'.png';
      sheets.set(key,image);
    }
    const image = sheets.get(key);
    if (!image.naturalWidth) return;
    const path = options[(cat.seed >>> 0) % options.length];
    const length = Math.min(path.x1-path.x0, 18*base.sc);
    const x0 = path.x0 + ((cat.seed >>> 8) % 101)/100*(path.x1-path.x0-length);
    const walk = 2300 + length*30, rest = 2100 + cat.seed%4100;
    const clock = (ms-cat.start)%(2*(walk+rest)), left = clock >= walk+rest;
    const phase = clock%(walk+rest), progress = Math.min(1,phase/walk);
    const x = x0 + length*(left ? 1-progress : progress);
    const sp = box.sp;
    let px=x, py=path.y;
    if (turn) {
      const a = (x-base.gMinX-32*base.fy*base.sc)/(2*base.sc);
      const b = (path.y-base.gMinY)/base.sc;
      const u=(a+b)/2, v=(b-a)/2, width=16*base.fx, depth=16*base.fy;
      const [rx,ry] = turn===1 ? [depth-v,u] : turn===2 ? [width-u,depth-v] : [v,width-u];
      px=sp.gMinX+32*sp.fy*sp.sc+(rx-ry)*2*sp.sc;
      py=sp.gMinY+(rx+ry)*sp.sc;
      routes(sp);
      const mask=visibleGround.get(sp);
      const iy=Math.floor(py)-(mask?.top||0), ix=Math.floor(px);
      if (!mask || ix<0 || ix>=sp.w || iy<0 || iy>=mask.height) return;
      const off=4*(iy*sp.w+ix), d=mask.data;
      if (d[off+3]!==255 || !surfaces.has((d[off]<<16)|(d[off+1]<<8)|d[off+2])) return;
    }
    if(box.mir)px=sp.w-px;
    const frame = phase < walk ? Math.floor(phase/130)%8 :
      (phase-walk)%2750 < 125 ? 10 : (phase-walk)%1700 < 650 ? 9 : 8;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(box.x+px*box.s,box.y+py*box.s);
    ctx.scale((left !== (turn>=2)) !== box.mir ? -zoom : zoom,zoom);
    ctx.drawImage(image,104*frame,0,104,88,-4.5,-7.25,9,7.62);
    ctx.restore();
  }
  return {update,at:tile=>active.get(tile),draw,routes};
})();
