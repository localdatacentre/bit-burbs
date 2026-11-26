const CACHE='bit-burbs-orbital-gym-20261118-v1-daily1-earnings2075-cats4-yard1-concepts1-release3-jobs1-shell1-instantrooms1-home-nav1-bag2-shop-size2-mobile-polish1-passwords1-build-categories1-home-cpm1-shop-compact1-city-services1-placed-label1-task-payout2-navy-system2';
const ASSETS=['./exchange-room.js?v=navy-system2','./page-shell.css?v=navy-system2','./fonts/vt323-400.woff2','./fonts/silkscreen-400.woff2','./fonts/silkscreen-700.woff2','./residential-cats.js?v=yard1','./cats/lot-maps.json?v=1','./cats/megatron-day.png','./cats/megatron-night.png','./cats/sweetie-day.png','./cats/sweetie-night.png','./index.html','./economy-core.js?v=jobs1','./daily-task-core.js?v=task-payout2','./dosh-shop-dock.png','./exchange-art/silver.png?v=freight-face-v2','./manifest.webmanifest','./bitburbs-icon.svg','./apple-touch-icon.png','./icon-192.png','./icon-512.png','./binlink-streets.png?v=88'];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(ASSETS.map(path=>new Request(path,{cache:'reload'})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith('bit-burbs-')&&key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  if(url.pathname.endsWith('/banksia-exchange.html'))return;

  // Hand the response stream to the browser while its copy is written to disk.
  function cacheInBackground(key,response){
    const copy=response.clone();
    event.waitUntil(caches.open(CACHE).then(cache=>cache.put(key,copy)).catch(()=>{}));
  }
  const gameRoot=new URL('./',self.location.href);
  const isPage=url.pathname===gameRoot.pathname||url.pathname===new URL('index.html',gameRoot).pathname;
  if(request.mode==='navigate'&&!isPage)return;
  if(isPage){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(new Request(request,{cache:'no-cache'}));
        if(fresh&&fresh.ok)cacheInBackground('./index.html',fresh);
        return fresh;
      }catch(error){
        return (await caches.match('./index.html'))||Response.error();
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    const cached=await caches.match(request);
    if(cached)return cached;
    try{
      const response=await fetch(request);
      if(response&&response.ok)cacheInBackground(request,response);
      return response;
    }catch(error){
      return cached||Response.error();
    }
  })());
});

