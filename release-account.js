window.liveCityRelease = async (action,command) => {
 const prefix='bit-burbs:roster2:';
 const name=localStorage.getItem(prefix+'last-username');
 const slot=prefix+name;
 const code=localStorage.getItem(slot+':cloud-key');
 const account=localStorage.getItem(slot+':login-name');
 if(!name||!code)throw Object.assign(new Error('Sign in to your city to continue.'),{status:401});
 const requested=new URLSearchParams(location.search).get('city');
 if(requested&&requested!==name)throw Object.assign(new Error('Your active city changed. Return to the city and reopen this page.'),{status:403});
 return fetch('https://bit-burbs-banksia-playtest.enchantingdish1.chatgpt.site/api/live-city',{
  method:'POST',credentials:'omit',referrerPolicy:'no-referrer',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({roster:'beta-roster-2',action,name,code,account,command}),
  signal:AbortSignal.timeout(18000)
 });
};
