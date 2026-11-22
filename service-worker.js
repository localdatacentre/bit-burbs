const CACHE='bit-burbs-orbital-gym-20261118-v1-daily1-earnings2075-cats4-yard1-concepts1-release2';
const ASSETS=['./residential-cats.js?v=yard1','./cats/lot-maps.json?v=1','./cats/megatron-day.png','./cats/megatron-night.png','./cats/sweetie-day.png','./cats/sweetie-night.png','./','./index.html','./economy-core.js?v=balance2','./daily-task-core.js?v=ten-tasks1','./dosh-shop-dock.png','./exchange-art/silver.png?v=freight-face-v2','./daily-task-session.js','./manifest.webmanifest','./bitburbs-icon.svg','./apple-touch-icon.png','./icon-192.png','./icon-512.png','./binlink-streets.png?v=88'];

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

  const gameRoot=new URL('./',self.location.href);
  const isPage=url.pathname===gameRoot.pathname||url.pathname===new URL('index.html',gameRoot).pathname;
  if(request.mode==='navigate'&&!isPage)return;
  if(isPage){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(new Request(request,{cache:'no-store'}));
        if(fresh&&fresh.ok){
          const cache=await caches.open(CACHE);
          await cache.put('./index.html',fresh.clone());
        }
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
      if(response&&response.ok){
        const cache=await caches.open(CACHE);
        await cache.put(request,response.clone());
      }
      return response;
    }catch(error){
      return cached||Response.error();
    }
  })());
});

