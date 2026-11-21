// Yard navigation uses lot coordinates. Camera turns only affect projection and visibility.
window.ResidentialCats = (() => {
  const active=new WeakMap(), journeys=new WeakMap(), sheets=new Map(), decoded=new Map();
  let atlas, loading=false, retryAt=0, lastCity, lastHomes, nextCheck=0;

  function loadMaps(now){
    if(atlas || loading || now<retryAt)return;
    loading=true;
    fetch('./cats/lot-maps.json?v=1').then(r=>{
      if(!r.ok)throw Error(r.status);
      return r.json();
    }).then(data=>{atlas=data;}).catch(()=>{retryAt=Date.now()+5000;})
      .finally(()=>{loading=false;});
  }
  function unpack(value,size){
    const pairs=atob(value), out=new Uint8Array(size);
    let offset=0;
    for(let i=0;i<pairs.length;i+=2){
      const end=offset+pairs.charCodeAt(i);
      out.fill(pairs.charCodeAt(i+1),offset,end); offset=end;
    }
    return out;
  }
  function mapFor(key){
    if(!decoded.has(key)&&atlas?.[key]){
      const m=atlas[key];
      decoded.set(key,{...m,walk:unpack(m.walk,m.width*m.height),depth:unpack(m.depth,m.w*m.rows)});
    }
    return decoded.get(key);
  }
  function rotate(x,y,w,h,turn){
    switch(turn){
      case 1:return [h-y,x];
      case 2:return [w-x,h-y];
      case 3:return [y,w-x];
      default:return [x,y];
    }
  }
  function hidden(m,col,row,depth){
    return col>=0&&row>=0&&col<m.w&&row<m.rows&&m.depth[col*m.rows+row]>depth*2+1.5;
  }
  function foregroundAt(key,col,row,footDepth,fallback){
    const m=mapFor(key);
    if(!m)return fallback;
    const y=Math.floor(row)+m.above,x=Math.floor(col);
    if(x<0||x>=m.w||y<0||y>=m.rows)return fallback;
    const object=m.depth[x*m.rows+y];
    return object ? object>footDepth*2+1.5 : row/m.sc>footDepth;
  }
  const directions=[[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[-1,-1],[1,-1]];
  function neighbours(m,i){
    const x=i%m.width,y=Math.floor(i/m.width),result=[];
    for(const [dx,dy] of directions){
      const u=x+dx,v=y+dy,j=v*m.width+u;
      if(u<0||v<0||u>=m.width||v>=m.height||!m.walk[j])continue;
      if(dx&&dy&&(!m.walk[y*m.width+u]||!m.walk[v*m.width+x]))continue;
      result.push(j);
    }
    return result;
  }
  function chooseStart(key,turn,random){
    const base=mapFor(key), view=mapFor(key+(turn?'-turn'+turn:''));
    if(!view||!base)return -1;
    // Prefer visible open yards. Include the perimeter path when it is the usable space.
    const visible=[],interior=[];
    for(let i=0;i<base.walk.length;i++){
      if(!base.walk[i])continue;
      const x=i%base.width+.5,y=Math.floor(i/base.width)+.5;
      const [u,v]=rotate(x,y,base.width,base.height,turn),z=u+v;
      const col=Math.floor(view.ox+(u-v)*2*view.sc),row=view.above+Math.floor(z*view.sc);
      if([[-2,-4],[0,-8],[2,-4],[0,0]].some(([a,b])=>hidden(view,col+a,row+b,z)))continue;
      if(neighbours(base,i).length<2)continue;
      visible.push(i);
      if(Math.min(x,y,base.width-x,base.height-y)>1)interior.push(i);
    }
    const candidates=interior.length&&random()<.75?interior:visible;
    return candidates.length?candidates[Math.floor(random()*candidates.length)]:-1;
  }
  function update(city, homes, now, homeId, viewFor, random = Math.random) {
    loadMaps(now);
    if(!atlas)return;
    if (city === lastCity && homes === lastHomes && now < nextCheck) return;
    if (lastHomes) for (const h of lastHomes) active.delete(h.t);
    lastCity = city; lastHomes = homes; nextCheck = now + 1000;
    if (!homes?.length && !city.catVisits) return;
    const wait = () => Math.floor(2000 + random()*4000);
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
      let home,cell;
      while (choices.length) {
        const [candidate]=choices.splice(Math.floor(random()*choices.length),1);
        const [key,turn]=viewFor(candidate.t);
        cell=chooseStart(key,turn,random);
        if(cell>=0){home=candidate;break;}
      }
      if (!home) continue;
      Object.assign(visit,{kind,cell,host:homeId(home.t),seed:Math.floor(random()*0x1000000),
        start:now,until:now+18000+Math.floor(random()*20000)});
      active.set(home.t,visit);
      taken.add(home.t);
    }
  }

  function makeJourney(m,cell,seed,duration){
    let state=seed>>>0;
    function random(){state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;}
    const legs=[];
    let t=0,lastDx=1,lastDy=0;
    function leg(a,b,ms){
      if(a!==b){lastDx=b%m.width-a%m.width;lastDy=Math.floor(b/m.width)-Math.floor(a/m.width);}
      legs.push({a,b,start:t,end:t+ms,dx:lastDx,dy:lastDy});t+=ms;
    }
    while(t<duration){
      // Search the connected yard; pick a destination a few strides away and follow its path.
      const parent=new Int32Array(m.walk.length).fill(-1),queue=[cell],targets=[];
      parent[cell]=cell;
      const stride=4+random()*9, shift=Math.floor(random()*8);
      for(let j=0;j<queue.length;j++){
        const a=queue[j],d=Math.hypot(a%m.width-cell%m.width,Math.floor(a/m.width)-Math.floor(cell/m.width));
        if(d>=stride){targets.push(a);continue;}
        const near=neighbours(m,a);
        for(let n=0;n<near.length;n++){
          const b=near[(n+shift)%near.length];
          if(parent[b]!==-1)continue;
          parent[b]=a;queue.push(b);
        }
      }
      const pool=targets.length?targets:queue.slice(Math.max(1,Math.floor(queue.length/2)));
      if(!pool.length){leg(cell,cell,duration-t);break;}
      const dest=pool[Math.floor(random()*pool.length)],path=[];
      for(let b=dest;b!==cell;b=parent[b])path.push(b);
      for(const b of path.reverse()){
        const diagonal=cell%m.width!==b%m.width&&Math.floor(cell/m.width)!==Math.floor(b/m.width);
        leg(cell,b,diagonal?490:350);cell=b;
      }
      leg(cell,cell,1100+random()*2300);
    }
    return legs;
  }
  function pose(box,turn,cat,now){
    const model=box.sp.key.replace(/-turn[1-3]$/,''),m=mapFor(model),view=mapFor(box.sp.key);
    if(!m||!view)return;
    let route=journeys.get(cat);
    if(!route||route.start!==cat.start||route.model!==model||route.seed!==cat.seed){
      let cell=cat.cell;
      if(!Number.isInteger(cell)||!m.walk[cell]){
        cell=chooseStart(model,turn,()=>((cat.seed>>>0)%65521)/65521);
        if(cell<0)return;
        cat.cell=cell;
      }
      route={start:cat.start,seed:cat.seed,model,legs:makeJourney(m,cell,cat.seed,Math.max(1000,Math.min(60000,cat.until-cat.start)))};
      journeys.set(cat,route);
    }
    const elapsed=Math.max(0,now-cat.start),legs=route.legs;
    const l=legs.find(l=>l.end>elapsed)||legs[legs.length-1];
    const f=Math.min(1,(elapsed-l.start)/(l.end-l.start));
    const x=l.a%m.width+.5+l.dx*(l.a===l.b?0:f),y=Math.floor(l.a/m.width)+.5+l.dy*(l.a===l.b?0:f);
    const [u,v]=rotate(x,y,m.width,m.height,turn);
    const [dx,dy]=rotate(l.dx,l.dy,0,0,turn);
    const sp=box.sp,px=sp.gMinX+32*sp.fy*sp.sc+(u-v)*2*sp.sc,py=sp.gMinY+(u+v)*sp.sc;
    const idle=elapsed-l.start;
    const frame=l.a!==l.b?Math.floor(elapsed/130)%8:idle%2750<125?10:idle%1700<650?9:8;
    return {view,z:u+v,px,py,left:dx-dy<0,frame,kind:cat.kind};
  }
  // Compose a tiny isolated image in model pixels. Mask only foreground texels.
  let stamp;
  function draw(ctx,box,p,night,zoom,eraseForeground){
    const key=p.kind+(night?'-night':'-day');
    if(!sheets.has(key)){const im=new Image();im.src='./cats/'+key+'.png';sheets.set(key,im);}
    const img=sheets.get(key);
    if(!img.naturalWidth)return;
    const unit=zoom/box.s,w=Math.max(1,Math.round(8*unit)),h=Math.max(1,Math.round(6.77*unit));
    stamp ||= document.createElement('canvas');
    if(stamp.width!==w||stamp.height!==h){stamp.width=w;stamp.height=h;}
    const c=stamp.getContext('2d'),x0=Math.round(p.px-w/2),y0=Math.round(p.py-6.44*unit);
    c.clearRect(0,0,w,h);c.imageSmoothingEnabled=false;c.save();
    if(p.left){c.translate(w,0);c.scale(-1,1);}
    c.drawImage(img,104*p.frame,0,104,88,0,0,w,h);c.restore();
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)
      if(hidden(p.view,x0+x,y0+y-box.sp.gMinY+p.view.above,p.z))c.clearRect(x,y,1,1);
    const sx=box.x+x0*box.s,sy=box.y+y0*box.s;
    if(eraseForeground){
      c.save();c.scale(1/box.s,1/box.s);c.translate(-sx,-sy);
      c.globalCompositeOperation='destination-out';eraseForeground(c,sx,sy,w*box.s,h*box.s);c.restore();
    }
    ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(stamp,sx,sy,w*box.s,h*box.s);ctx.restore();
  }
  return {update,at:tile=>active.get(tile),pose,draw,foregroundAt};
})();
