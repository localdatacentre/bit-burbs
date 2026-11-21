// Run from the game root with Node and @napi-rs/canvas after editing residential art.
const fs = require('node:fs');
const vm = require('node:vm');
const {createCanvas, Path2D} = require('@napi-rs/canvas');
const html = fs.readFileSync('index.html', 'utf8');
const kit = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1]).find(code => code.includes('const SPRK='));
const env = {document:{createElement:()=>createCanvas(1,1)},Path2D};
env.window = env;
vm.createContext(env);
vm.runInContext(kit, env);
const render = vm.runInContext('SPRK.render',env);
const names = ['m1','m2','m3','q1','banksiaDuplex','duneKeeper','townCourt','apartments','pinkflats','skytower','quay','southerlyTower'];
const atlas = {};
// Only the ground pass is sampled. Walls or roofs that share a paving colour cannot enter the map.
const water = new Set(['3eb4e8','36a6dc','eceae4']);
function pack(bytes) {
  const pairs = [];
  for (let i=0; i<bytes.length;) {
    const value=bytes[i]; let count=1;
    while (count<255 && bytes[i+count]===value) count++;
    pairs.push(count,value); i+=count;
  }
  return Buffer.from(pairs).toString('base64');
}
for (const name of names) for (let turn=0; turn<4; turn++) {
  const key=name+(turn?'-turn'+turn:'');
  let map;
  render(key,false,false,(k,model)=>{
    const ctx=k.ctx, w=ctx.canvas.width, width=model.fx*16, height=model.fy*16;
    const origin=k.sc(0,0,0), sc=k.sc(1,0,0).y-origin.y;
    const above=20, top=origin.y-above, rows=(width+height)*sc+above+2;
    const walk=new Uint8Array(width*height), depth=new Uint8Array(w*rows);
    map={width,height,w,above,rows,ox:origin.x,sc,walk,depth};
    const ground=k.ground;
    k.ground=paint=>{
      ground(paint);
      const pixels=ctx.getImageData(0,top,w,rows).data;
      for(let v=0;v<height;v++)for(let u=0;u<width;u++){
        const p=k.sc(u+.5,v+.5,0),i=4*((p.y-top)*w+p.x);
        const rgb=((pixels[i]<<16)|(pixels[i+1]<<8)|pixels[i+2]).toString(16);
        walk[v*width+u]=pixels[i+3]===255&&!water.has(rgb)?1:0;
      }
    };
    const add=k.add;
    k.add=(x0,y0,x1,y1,draw)=>{
      // A half-cell margin prevents steps through thin rails between cell centres.
      for(let v=Math.max(0,Math.ceil(y0-1));v<height&&v<=y1;v++)
        for(let u=Math.max(0,Math.ceil(x0-1));u<width&&u<=x1;u++)walk[v*width+u]=0;
      add(x0,y0,x1,y1,()=>{
        // Isolate this painter's alpha. Empty pixels between leaves stay transparent.
        const under=ctx.getImageData(0,top,w,rows);
        ctx.clearRect(0,top,w,rows);
        draw();
        const layer=ctx.getImageData(0,top,w,rows);
        for(let x=0;x<w;x++){
          const d=Math.max(x0-y1,Math.min(x1-y0,(x+.5-origin.x)/(2*sc)));
          const front=Math.min(2*x1-d,2*y1+d);
          const value=1+Math.round(front*2);
          for(let y=0,i=x;y<rows;y++,i+=w)if(layer.data[4*i+3]>65)depth[x*rows+y]=value;
        }
        // Subsequent painters can depend on earlier pixels.
        const overlay=createCanvas(w,rows);
        overlay.getContext('2d').putImageData(layer,0,0);
        ctx.putImageData(under,0,top);
        ctx.drawImage(overlay,0,top);
      });
    };
  });
  atlas[key]={...map,walk:pack(map.walk),depth:pack(map.depth)};
}
fs.writeFileSync('cats/lot-maps.json',JSON.stringify(atlas)+'\n');
