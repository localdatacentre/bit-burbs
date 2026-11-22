window.liveCityRelease = async (action,command) => {
 const prefix='bit-burbs:roster2:';
 const name=localStorage.getItem(prefix+'last-username');
 const slot=prefix+name;
 const code=localStorage.getItem(slot+':cloud-key');
 const account=localStorage.getItem(slot+':login-name');
 if(!name||!code)throw Error('Sign into your city first.');
 return fetch('https://bit-burbs-banksia-playtest.enchantingdish1.chatgpt.site/api/live-city',{
  method:'POST',credentials:'omit',referrerPolicy:'no-referrer',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({roster:'beta-roster-2',action,name,code,account,command}),
  signal:AbortSignal.timeout(18000)
 });
};
