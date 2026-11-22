// Shares the Exchange page's renderers. Account commands always settle on the server.
let shared=false, marketBusy=false;
const requestedCity=new URLSearchParams(location.search).get('city');
function showExchangeControls(visible){
 for(const id of ['wallet','pageNav','screen','modalRoot'])document.getElementById(id).style.display=visible?'':'none';
}
if(requestedCity||globalThis.BBStage)showExchangeControls(false);
const incomingLink=new URLSearchParams(location.hash.slice(1)).get('link');
if(incomingLink)sessionStorage.setItem('exchange-invite',incomingLink);
const accountBar=document.getElementById('exchangeAccount');
async function exchangeFetch(body){
 const res=globalThis.BBStage?.liveRelease?await window.liveCityRelease('releaseExchange',body):await fetch(globalThis.BBStage?'/staging/api/exchange':'/api/exchange',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});
 const result=await res.json();if(!res.ok)throw Object.assign(new Error(result.error||'Exchange unavailable.'),{status:res.status});
 return result;
}
function addRefreshButton(){
 const button=document.createElement('button');
 button.textContent='Retry';
 button.onclick=loadExchange;
 accountBar.append(button);
}
function pendingKey(accountRef){return 'banksia-exchange:pending-city-command:'+accountRef;}
async function sendSavedCommand(command){
 const key=pendingKey(command.accountRef);
 try{
  const view=await exchangeFetch(command);
  sessionStorage.removeItem(key);
  return view;
 }catch(error){
  if([400,409,413].includes(error.status))sessionStorage.removeItem(key);
  throw error;
 }
}
function useShared(view){
 if(requestedCity&&view.name!==requestedCity){
  showExchangeControls(false);
  throw Error('Open the Exchange with the account linked to '+requestedCity+'.');
 }
 rotationStart=view.rotationStart;
 showExchangeControls(true);
 shared=true;data={...view,ordinary:[],settings:{motion:false},claims:[]};
 accountBar.replaceChildren(document.createTextNode('Linked city · '+view.name+' · City balance '));
 if(view.crateInventoryError)accountBar.append(document.createTextNode(view.crateInventoryError+' '));
 if(globalThis.BBStage){
  const city=document.createElement('a');city.href=globalThis.BBStage.liveRelease?'./':'/staging/';city.textContent='Back to city';accountBar.append(city);
 }else addRefreshButton();
}
function leaveSharedView(){
 if(shared){
  shared=false;clearTimeout(animation?.timer);animation=null;
  if(!globalThis.BBStage)try{data=JSON.parse(localStorage.getItem(key))||fresh();}catch{data=fresh();}
 }
 showExchangeControls(!requestedCity&&!globalThis.BBStage);
 closeModal();
 if(!requestedCity&&!globalThis.BBStage)render();
}
async function loadExchange(){
 if(marketBusy||animation)return;
 marketBusy=true;
 try{
  const token=!globalThis.BBStage&&sessionStorage.getItem('exchange-invite');
  const view=await exchangeFetch(token?{action:'link',token}:null);
  if(token){sessionStorage.removeItem('exchange-invite');history.replaceState(null,'',location.pathname+location.search);}
  if(view.linked===false){leaveSharedView();accountBar.textContent=requestedCity?'Open the owner dashboard invite for '+requestedCity+' to link your city.':'Practice mode · Open your city invite from the owner dashboard to link this account.';return;}
  clearTimeout(animation?.timer);animation=null;useShared(view);
  const saved=sessionStorage.getItem(pendingKey(view.accountRef));
  if(saved){
   const command=JSON.parse(saved);
   if(command.accountRef!==view.accountRef)throw Error('Pending command belongs to a different city.');
   command.account=view.name; // A renamed city still owns its original request.
   try{useShared(await sendSavedCommand(command));}
   catch(error){
    if(error.status!==409)throw error;
    useShared(await exchangeFetch());closeModal();render();
    if(!data.opening)toast(error.message);
    return;
   }
  }
  closeModal();render();
 }catch(err){
  if(err.status===401||err.status===403)leaveSharedView();
  if(err.status===409)sessionStorage.removeItem('exchange-invite');
  if(shared||requestedCity||globalThis.BBStage)showExchangeControls(false);
  if(err.status===401||err.status===403){
   accountBar.textContent=err.message+' ';
   const city=document.createElement('a');city.href='./';city.textContent='Back to city';accountBar.append(city);
  }else{
   accountBar.textContent='Could not load your crates. '+err.message+' ';
   addRefreshButton();
  }
 }finally{marketBusy=false;}
}
async function settle(command){
 let dismissPending;
 if(marketBusy||!shared)return;
 marketBusy=true;
 try{
  const key=pendingKey(data.accountRef);
  const saved=sessionStorage.getItem(key);
  const request=saved?JSON.parse(saved):{
   ...command,account:data.name,accountRef:data.accountRef,revision:['crate','open','finish'].includes(command.action)?data.crateRevision:data.revision,
   requestId:crypto.randomUUID()
  };
  if(request.accountRef!==data.accountRef)throw Error('Pending command belongs to a different city.');
  if(!saved)sessionStorage.setItem(key,JSON.stringify(request));
  if(request.action==='crate')dismissPending=showCratePending(request.tier);
  useShared(await sendSavedCommand(request));
  if(!dismissPending)closeModal();
  if(request.action==='open'&&!saved){render(false);showOpening(false);}
  else render();
 }catch(err){
  if(err.status===409){
   try{useShared(await exchangeFetch());closeModal();render();if(!data.opening)toast(err.message);return;}catch{}
  }
  showExchangeControls(false);
  accountBar.textContent='Refresh to check your last action. ';
  addRefreshButton();
 }finally{dismissPending?.();marketBusy=false;}
}
function sharedRoutes(b){
 const d=b.dataset,a=d.action||'';
 if(a.startsWith('place-')||a.startsWith('pack-')){const split=a.indexOf('-');return {action:a.slice(0,split),asset:a.slice(split+1)};}
 if(d.cancelListing)return {action:'unlist',listing:d.cancelListing};
 if(a==='buy-crate')return {action:'crate',tier:tierIndex};
 if(a==='open-crate'||a==='open-three')return {action:'open',tier:tierIndex,count:a==='open-three'?3:1};
 if(a==='finish-opening')return {action:'finish',receipt:data.opening?.receipt};
 if(a.startsWith('confirm-buy-')){const [listing,price]=a.slice(12).split('@');return {action:'buy',listing,price:Number(price)};}
 if(a.startsWith('confirm-sell-'))return {action:'list',asset:a.slice(13),price:Number($('#sellPrice').value)};
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b||!shared)return;
 if(b.dataset.claim||b.dataset.replace||['shop-3','boost-demo'].includes(b.dataset.action)){
  e.stopImmediatePropagation();toast('Open your city to use this action.');return;
 }
 const cmd=sharedRoutes(b);
 if(cmd){
  e.stopImmediatePropagation();
  if(cmd.action==='crate' && $('#modalRoot').children.length)return;
  if(!b.disabled&&!marketBusy)settle(cmd);
 }
},true);
window.addEventListener('focus',()=>{if(shared&&!data.opening&&!$('#modalRoot').children.length)loadExchange();});

if(globalThis.BBStage){
 setInterval(()=>{
  if(shared && !document.hidden && !marketBusy && !animation && !$('#modalRoot').children.length &&
     data.featured && Date.now()>=data.bullEndsAt)loadExchange();
 },5000);
}

loadExchange();
