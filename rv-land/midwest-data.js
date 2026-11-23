'use strict';
const Midwest=(()=>{
 const labels={house_garage:'Дом + гараж по MLS',house_only:'Дом · гараж неизвестен',outdoor_candidate:'Площадка / сарай по продавцу',occupied_rv:'На участке уже стоит трейлер',utilities_only:'Готовность площадки неизвестна'};
 function normalize(data){
  if(!Array.isArray(data?.candidates))return [];
  return data.candidates.map(r=>{
   const p=r.location?.reference,exact=MapGroups.validPoint(r.location?.lat,r.location?.lon);
   const lat=exact?r.location.lat:p?.lat,lng=exact?r.location.lon:p?.lon;
   const a=r.airport_reference,km=a?MapGroups.distance({lat:a.lat,lng:a.lon},{lat,lng}):null;
   return {...r,country:'US',manual_research:true,research_record:r,lat,lng,score:null,
    coord_precision:exact?'address_geocoded':p?.kind||'unknown',price_currency:'USD',price_basis:'cash',
    personal_repair:'unknown',commercial_repair:'unknown',rv_occupancy:'unknown',rv_storage:r.rv_storage||'unknown',
    gateways:km===null?[]:[{code:r.airport_code,name:r.airport_code==='ORD'?"Chicago O’Hare":r.airport_code,straight_km:Math.round(km),drive_hours_estimate:null}]};
  });
 }
 function details(x,{esc,photo,link,date,money,labels:tags}){
  const r=x.research_record;
  return photo(x,'detail-photo')+'<div class="detail-content"><span class="eyebrow">'+esc(x.city+', '+x.state)+'</span><p class="detail-price">'+money(x.price)+'</p><h2>'+esc(x.title)+'</h2><div class="card-labels">'+tags(x)+'</div><p>'+esc(r.summary_ru)+'</p>'+
   '<p><b>Стоимость:</b> цена продажи из объявления, не аренда и не взнос. Closing, долги, обследование и ремонт отдельно, суммы неизвестны.</p>'+
   (r.association?'<p><b>Ежегодные взносы:</b> '+(r.annual_dues_usd?money(r.annual_dues_usd):'$1,580–$1,710; подключение лота уточнить')+'. Налог и электричество дополнительно. Участок в собственность по правилам сообщества; основным жильём быть не может, максимум 200 ночёвок в год.</p>':'<p><b>Налог и обязательные сборы:</b> '+(r.annual_tax_usd?money(r.annual_tax_usd)+' в год по объявлению.':'Полная текущая сумма не подтверждена.')+'</p>')+
   '<p><b>RV внутри / снаружи:</b> габариты, подъезд, разворот и пригодность поверхности для высокого 7-метрового кемпервана не подтверждены. Сарай не считается гаражом для RV.</p><p><b>Разрешения:</b> хранение, проживание, личный и коммерческий ремонт проверяются отдельно. По этому объекту разрешение личного ремонта неизвестно.</p>'+
   (r.association?'<p>Правила Woodhaven предусматривают некоторые ремонты RV; для изменения крыши и экстерьера нужен permit. Это не подтверждение моторного ремонта, сварки или покраски. Существующий трейлер может мешать размещению своего RV; для второго действуют ограничения.</p><p>'+link(r.official_rules_url,'Правила Woodhaven, редакция 28.04.2026')+' · '+link(r.official_fees_url,'Взносы и условия владения')+'</p>':'')+
   '<p class="location-warning">'+esc(r.location.note_ru)+'</p><p>'+(x.gateways[0]?esc(x.gateways[0].code)+' · около '+x.gateways[0].straight_km+' км по прямой до '+(r.location.lat===null?'ориентира':'адреса')+'. Время и километры по дороге не проверены.':'Маршрут не проверен.')+'</p>'+
   '<p>Активно по открытой странице, проверка '+date(r.checked_at)+'. MLS '+esc(r.mls)+'. '+(r.physical_evidence_basis==='indexed_public_page'?'Описание освобождения участка взято из поискового снимка, а не из живой страницы.':'Сведения о состоянии — из объявления и его фотографий, без осмотра.')+'</p><p>ID: '+esc(r.id)+' · впервые сохранено '+date(r.first_seen)+'. Исходное фото сохранено без обработки.</p><div class="detail-links">'+link(r.url,'Открыть объявление ↗','button-link')+'<a class="button-link" href="midwest.html#'+esc(r.id)+'">Региональная подборка и источники →</a>'+link('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(r.kind==='house'?r.title+', '+r.city+', '+r.state:r.title+', Sublette, IL'),'Найти адрес на карте')+'</div></div>';
 }
 return {labels,normalize,details};
})();
