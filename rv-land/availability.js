'use strict';
const Availability=(()=>{
 const maxAgeDays=14;
 const status=x=>String(x.status||'unknown').trim().toLowerCase().replace(/[\s-]+/g,'_');
 const closedStatuses=new Set(['sold','closed','off_market','withdrawn','expired','cancelled','canceled']);
 const isClosed=x=>closedStatuses.has(status(x));
 function isCurrent(x,now=Date.now()){
  if(isClosed(x))return false;
  if(x.country==='IT')return true; // Sicily has its own dated, explicitly unconfirmed research layer.
  const checked=Date.parse(x.last_verified);
  return status(x)==='active'&&x.status_basis==='live_public_page'&&Number.isFinite(checked)&&checked<=now+86400000&&now-checked<=maxAgeDays*86400000;
 }
 const visible=(x,archive=false,now=Date.now())=>!isClosed(x)&&(archive||isCurrent(x,now));
 return {maxAgeDays,status,isClosed,isCurrent,visible};
})();
