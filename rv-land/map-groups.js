'use strict';
const MapGroups=(()=>{
 const origin={lat:44.8935476,lng:-93.517459,name:'Точка поиска Minnetonka'},radiusKm=150;
 const groups={point:{label:'Рядом с точкой',color:'#2268b1'},airport:{label:'Рядом с аэропортом',color:'#7849a7'},priority:{label:'Приоритет проверки',color:'#a66a12'},other:{label:'Остальные',color:'#748078'}};
 const priorityIds=new Set(['in-gary-kentucky-837526','ia-mount-ayr-adams-6340604','ia-scranton-state-6335122','mi-flint-brownell-20250033421','lc-15893','lc-16279','wv-rainelle-13th-26-986','tn-lone-mountain-1344590','lc-24853','lc-25942']);
 const validPoint=(lat,lng)=>Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180;
 function distance(a,b){
  if(!validPoint(a.lat,a.lng)||!validPoint(b.lat,b.lng))return null;
  const rad=v=>v*Math.PI/180,dlat=rad(b.lat-a.lat),dlng=rad(b.lng-a.lng);
  const h=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlng/2)**2;
  return 6371*2*Math.asin(Math.sqrt(Math.min(1,h)));
 }
 function classify(x){
  if(x.country==='IT')return null;
  const km=distance(origin,x);
  if(km!==null&&km<=radiusKm)return 'point';
  if(x.airport_shortlist||(x.gateways||[]).some(a=>Number.isFinite(a.straight_km)&&a.straight_km>=0&&a.straight_km<=radiusKm))return 'airport';
  if(x.existing_garage||priorityIds.has(x.id))return 'priority';
  return 'other';
 }
 function normalizeShortlist(data){
  if(!data||!Array.isArray(data.candidates))return [];
  return data.candidates.map(x=>{
   const p=x.location?.reference,airport=data.airport;
   const lat=validPoint(x.location?.lat,x.location?.lon)?x.location.lat:p?.lat;
   const lng=validPoint(x.location?.lat,x.location?.lon)?x.location.lon:p?.lon;
   const straight=airport?distance({lat:airport.lat,lng:airport.lon},{lat,lng}):null;
   return {...x,country:'US',city:x.anchor==='dunbar'?'Dunbar / Juniata':'New Castle',lng,lat,
    kind:x.anchor==='dunbar'?'workshop':'house',score:null,airport_shortlist:true,airport_record:x,
    coord_precision:p?.kind||'unknown',price_currency:'USD',price_basis:'cash',last_verified:x.checked_at,
    status_basis:'live_public_page',rv_storage:'unknown',rv_occupancy:'unknown',personal_repair:'unknown',commercial_repair:'unknown',
    image_source_url:x.photo_history?.[0]?.source||x.url,
    gateways:airport&&straight!==null?[{code:airport.code,name:airport.name,straight_km:Math.round(straight),drive_hours_estimate:null}]:[]};
  });
 }
 return {origin,radiusKm,groups,priorityIds,validPoint,distance,classify,normalizeShortlist};
})();
