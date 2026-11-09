/* BIT-BURBS: flat isometric pixel model pack.
   Artwork is rendered on integer canvas coordinates (no image smoothing).
   Existing building IDs, city saves, and road connectivity remain intact. */
(function(){
'use strict';
const C={
 ink:'#242142',grass:'#69BA43',grassDark:'#3C8C3F',path:'#CDBB91',
 cream:'#F4DFC0',stone:'#D8D0C6',slate:'#525C85',blue:'#4988C4',
 sky:'#8AC6DC',orange:'#EF8545',red:'#D95159',pink:'#DD66A8',
 green:'#65B867',violet:'#8656B8',dark:'#293355',yellow:'#F5CB55'
};
const catalog={
 house:['home','#E9BD82','#3974B5','#FFF1D1',2,'home'],
 house2:['home','#F4D9AF','#E65A43','#FFFFFF',2,'home'],
 town:['home','#CA9174','#3D679C','#FFF0DD',3,'row'],
 aptS:['home','#D88D67','#6278B7','#FAE4CE',4,'apartment'],
 aptP:['home','#BFC8D9','#536696','#FFFFFF',6,'apartment'],
 tower:['home','#C2B8A6','#7A97A3','#E8F3DD',7,'tower'],
 luxuryVilla:['home','#EEE5D6','#AEBECD','#66C4E9',2,'villa'],
 hall:['service','#E7D2A5','#5274A9','#E5BA62',2,'hall'],
 police:['service','#ABBBCB','#53699D','#3A81CF',2,'police'],
 fire:['service','#D78368','#A53642','#F2A44F',2,'fire'],
 clinic:['service','#F0F2E8','#5D91BC','#E95A6B',3,'hospital'],
 hospital:['service','#E6F0F3','#6F93B9','#EF5965',4,'hospital'],
 school:['service','#DDC49A','#A66E50','#F7D47C',2,'school'],
 bakery:['shop','#D49A67','#E8784F','#EBD5AE',1,'food'],
 cornerShop:['shop','#D6A074','#E68A39','#F6E1B5',1,'shop'],
 coffee:['shop','#AC7857','#E59A39','#FFE0A7',1,'coffee'],
 restaurant:['shop','#CB9D84','#D65357','#FFF0D9',1,'food'],
 grocery:['shop','#D7B18C','#2F90DC','#F2E1BA',1,'market'],
 clothingStore:['shop','#B771A1','#DA54A8','#FAD2EE',1,'fashion'],
 electronics:['shop','#7C9BC7','#307CE1','#BEE8FF',1,'tech'],
 gym:['shop','#A7B4CD','#468AD8','#D9E9FA',1,'gym'],
 hardware:['shop','#BEB395','#D98047','#FFF4CF',1,'hardware'],
 cinema:['shop','#A16BAA','#CC4FBC','#FFD26C',2,'cinema'],
 arcade:['shop','#A85FB0','#B94CC8','#FFBCE8',1,'arcade'],
 bank:['shop','#DED7C3','#B5A98A','#F2D16E',2,'bank'],
 gas:['shop','#CBB89C','#D56743','#FFDB90',1,'gas'],
 workshop:['industry','#BB9C7C','#7988A0','#EFDCC5',1,'workshop'],
 factory:['industry','#B66C58','#536B83','#FFB452',2,'factory'],
 warehouse:['industry','#97A1B5','#485E87','#F5B451',1,'warehouse'],
 skyscraper:['industry','#9AA5BF','#52769C','#E5EAF0',7,'tower'],
 plant:['utility','#B8A7A0','#7080A0','#F2C34A',1,'power'],
 nuclear:['utility','#B9A9A4','#7A8CAA','#F6CF65',2,'power'],
 pump:['utility','#C3D4DD','#4382BA','#78D9FA',1,'water'],
 waterPlant:['utility','#AFCDD9','#4479B6','#4BD4FA',2,'water'],
 wtower:['utility','#B5C8D1','#5779AA','#A3DDF6',3,'towerWater'],
 recycling:['utility','#8CBA81','#4C9360','#DAF0B4',2,'recycle'],
 wasteFacility:['utility','#C6AD83','#B17E38','#E9BB4B',1,'waste'],
 wind:['utility','#D2DDE3','#7AAFC8','#EEEDF0',3,'wind'],
 solar2:['utility','#3C78BE','#2D53A9','#91CDF6',1,'solar'],
 solar:['utility','#3C78BE','#2D53A9','#91CDF6',1,'solar'],
 park:['decor','#71B955','#367D78','#F3B862',0,'park'],
 tree:['decor','#74BD3F','#347742','#BBE35D',0,'tree'],
 smallTree:['decor','#68AC3D','#397F40','#A7D95E',0,'smallTree'],
 sakura:['decor','#EB99C8','#9C5A96','#F8C5EA',0,'sakura'],
 flowers:['decor','#7AB84C','#E8669E','#FFD66C',0,'flowers'],
 playground:['decor','#7BBC5D','#E9A94C','#4EA8D9',0,'playground'],
 garden:['decor','#73B353','#D6A567','#F196B2',0,'garden'],
 plaza:['decor','#B9AB9D','#927B9E','#F0C962',0,'plaza'],
 fountain:['decor','#BBBFC9','#4A9ED2','#BCF1FF',0,'fountain'],
 statue:['decor','#C8B48C','#A79572','#F3D579',0,'statue'],
 gazebo:['decor','#DAAABD','#C77CB4','#FBE8F0',0,'gazebo'],
 hedge:['decor','#6CAF3D','#3E8744','#B5DE5C',0,'hedge'],
 streetLight:['decor','#65708A','#3A405B','#FFC856',0,'light'],
 bench:['decor','#C48B56','#775039','#F4C784',0,'bench'],
 streetBin:['decor','#8B98B1','#44536F','#C4D3D7',0,'bin'],
 busStop:['decor','#9BB6D2','#3774B3','#D6F2F7',0,'bus'],
 civicSquare:['decor','#D8C9B9','#6386A7','#F2D17C',0,'civic']
};
function poly(g,pts,col,stroke=true){g.beginPath();g.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0],pts[i][1]);g.closePath();g.fillStyle=col;g.fill();if(stroke){g.strokeStyle=C.ink;g.lineWidth=2;g.lineJoin='miter';g.stroke();}}
function rect(g,x,y,w,h,c){g.fillStyle=c;g.fillRect(x|0,y|0,w|0,h|0)}
function diamond(g,c=C.grass){poly(g,[[7,89],[64,63],[120,89],[64,116]],C.ink,false);poly(g,[[12,89],[64,66],[115,89],[64,112]],c,false);poly(g,[[13,91],[64,113],[115,91],[115,95],[64,117],[13,95]],C.grassDark,false);}
function building(g,base,roof,accent,levels,kind){
 diamond(g,kind==='industry'?'#B5B1A0':'#79BE50');
 const h=(kind==='tower'||kind==='apartment')?Math.min(69,19+levels*8):kind==='hospital'?54:kind==='hall'?39:kind==='factory'?35:kind==='bank'?34:28;
 const top=84-h;
 poly(g,[[22,top+8],[64,top+25],[64,96],[22,78]],base);
 poly(g,[[64,top+25],[104,top+7],[104,79],[64,96]],shade(base,-21));
 const count=Math.max(1,Math.min(7,Math.floor(h/14)));
 for(let row=0;row<count;row++){
  const yy=top+28+row*12;
  if(yy>87)continue;
  for(const x of [30,45]){rect(g,x,yy,9,9,C.ink);rect(g,x+2,yy+2,5,5,C.sky);rect(g,x+3,yy+3,3,3,'#E8F4D8');}
  for(const x of [74,88]){rect(g,x,yy-8,9,9,C.ink);rect(g,x+2,yy-6,5,5,C.sky);rect(g,x+3,yy-5,3,3,'#E8F4D8');}
 }
 poly(g,[[19,top+8],[63,top-13],[107,top+7],[64,top+27]],roof);
 poly(g,[[22,top+10],[63,top-9],[104,top+8],[64,top+24]],shade(roof,15),false);
 if(kind==='shop'||kind==='food'||kind==='coffee'||kind==='market'||kind==='fashion'||kind==='tech'||kind==='arcade'||kind==='cinema'||kind==='gym'||kind==='hardware'||kind==='gas'){
   rect(g,24,69,38,10,accent);for(let i=0;i<5;i++)rect(g,25+i*8,73,4,7,'#FFF2E8');
   rect(g,33,79,12,14,C.dark);rect(g,48,79,11,12,C.sky);
   rect(g,69,77,24,9,accent);rect(g,73,82,15,4,'#FAEDC7');
 }
 if(kind==='service'||kind==='police'||kind==='fire'||kind==='hospital'||kind==='school'||kind==='hall'||kind==='bank'){
   rect(g,50,top-4,28,12,C.ink);rect(g,53,top-1,22,7,accent);
   if(kind==='hospital'){rect(g,63,top,4,6,'#FFFFFF');rect(g,60,top+2,10,2,'#FFFFFF');}
   if(kind==='police')rect(g,56,top+1,18,4,'#FFF4D2');
   if(kind==='fire'){rect(g,69,74,24,19,C.ink);rect(g,72,77,19,13,C.red);}
 }
 if(kind==='villa'){
  rect(g,29,78,28,11,'#F0D5B1');rect(g,70,83,30,10,'#45B7E4');rect(g,73,84,21,5,'#A6ECF9');
 }
 if(kind==='industry'||kind==='factory'||kind==='power'){
  rect(g,74,top-16,9,18,C.ink);rect(g,76,top-18,5,18,'#A0A9B7');
  rect(g,86,top-24,9,24,C.ink);rect(g,88,top-26,5,26,'#9C6F6D');
 }
 if(kind==='towerWater'){
  rect(g,41,62,6,35,C.dark);rect(g,82,62,6,35,C.dark);
  poly(g,[[31,45],[64,36],[98,45],[96,71],[64,82],[33,70]],roof);
  rect(g,56,57,18,7,accent);
 }
 if(kind==='wind'){
  for(const x of [39,64,89]){rect(g,x-2,45,4,55,'#F6F6ED');rect(g,x-22,43,44,4,'#F5F2E9');rect(g,x-2,24,4,40,'#F5F2E9');rect(g,x-3,42,6,7,C.dark);}
 }
 if(kind==='solar'){
  for(const x of [23,62]){poly(g,[[x,63],[x+31,53],[x+40,68],[x+8,81]],'#2D6BBA');for(let j=0;j<3;j++)rect(g,x+8+j*9,66,2,5,'#93D6F7');}
 }
 if(kind==='recycle'){rect(g,53,top-2,24,14,'#327F46');rect(g,57,top+3,17,6,'#D6F5C4');}
 if(kind==='waste')rect(g,76,76,25,16,'#78A269');
 if(kind==='cinema'||kind==='arcade')rect(g,44,top-4,36,11,accent);
}
function shade(hex,pct){let v=hex.replace('#','');if(v.length!==6)return hex;let n=parseInt(v,16);let m=pct/100;return '#'+[16,8,0].map(sh=>{const x=(n>>sh)&255;return Math.max(0,Math.min(255,Math.round(m>=0?x+(255-x)*m:x*(1+m)))).toString(16).padStart(2,'0')}).join('');}
function decorative(g,accent,secondary,kind){
 diamond(g,kind==='plaza'||kind==='civic'?'#C9BDA8':'#7BBD4C');
 if(kind==='tree'||kind==='smallTree'||kind==='sakura'){
  const small=kind==='smallTree';rect(g,60,69,7,30,'#805739');
  for(const [dx,dy,r] of [[-10,63,13],[10,61,13],[0,47,17]]){rect(g,64+dx-r/2,dy-r/2,r*1.3,r,accent);rect(g,62+dx-r/2,dy-r/2,r*.6,r*.5,secondary);}
  if(small)g.clearRect(7,10,0,0);
 } else if(kind==='park'||kind==='garden'||kind==='flowers'){
  for(const [x,y] of [[32,80],[54,71],[74,80],[89,85]]){rect(g,x,y,12,10,secondary);rect(g,x+2,y-4,6,9,accent);}
  if(kind==='park'){rect(g,57,78,19,11,C.sky);rect(g,63,65,5,14,'#B7ECF5');}
 } else if(kind==='playground'){
  rect(g,30,59,6,37,C.orange);rect(g,58,59,6,37,C.orange);
  poly(g,[[29,60],[45,49],[67,60],[58,65],[44,54],[35,65]],C.blue);
  poly(g,[[55,76],[72,68],[88,85],[79,89]],'#E7B539');
 } else if(kind==='hedge'){
  rect(g,20,79,89,18,'#3C853B');
  for(let x=22;x<109;x+=9)rect(g,x,70+(x%3)*2,13,17,C.grass);
 } else if(kind==='plaza'||kind==='civic'){
  for(const [x,y] of [[40,76],[64,71],[87,78]]){rect(g,x,y,6,20,'#EAD8B2');rect(g,x-3,y-4,12,5,secondary);}
  if(kind==='civic')rect(g,50,87,28,9,C.sky);
 } else if(kind==='statue'){
  rect(g,46,78,38,18,'#AAA5B2');rect(g,52,71,27,9,'#DBD6DE');rect(g,60,43,11,29,'#C2C6D1');rect(g,55,42,20,9,'#EAE7ED');
 } else if(kind==='gazebo'){
  for(const x of [28,53,78,100])rect(g,x,65,5,30,'#FFE2DB');
  poly(g,[[22,65],[64,35],[110,65],[64,75]],'#D77FB6');
 } else if(kind==='fountain'){
  poly(g,[[28,83],[64,68],[102,83],[64,102]],C.sky);
  rect(g,60,53,9,32,'#E5E2EB');rect(g,50,72,28,7,'#D4E8F4');
 } else if(kind==='light'){
  rect(g,62,44,6,58,C.dark);rect(g,56,40,19,9,'#F3C755');
 } else if(kind==='bench'){
  rect(g,34,73,58,8,'#B7814E');rect(g,34,84,58,8,'#CD9562');rect(g,39,92,5,11,C.dark);rect(g,83,92,5,11,C.dark);
 } else if(kind==='bin'){
  rect(g,52,65,26,34,secondary);rect(g,48,61,34,8,C.dark);rect(g,57,72,15,19,accent);
 } else if(kind==='bus'){
  rect(g,30,55,6,44,C.dark);rect(g,94,55,6,44,C.dark);rect(g,27,55,76,7,C.blue);rect(g,35,62,59,21,C.sky);rect(g,36,91,60,7,'#C1A88D');rect(g,39,77,22,4,C.dark);
 }
}
const cache=new Map();
function render(id){
 if(cache.has(id))return cache.get(id);
 const p=catalog[id];if(!p)return null;
 const [type,base,roof,accent,levels,kind]=p;
 const img=document.createElement('canvas');img.width=128;img.height=128;
 const g=img.getContext('2d');g.imageSmoothingEnabled=false;
 if(type==='decor')decorative(g,base,roof,kind);
 else building(g,base,roof,accent,levels,kind);
 const out={img,w:128,h:128,gMinX:12,gMaxX:116,gMinY:66,fx:1,fy:1,sc:2};
 cache.set(id,out);return out;
}
window.BBModelPack={render,ids:Object.keys(catalog)};
})();
