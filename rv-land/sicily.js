'use strict';
// Sicily is a separate EUR snapshot. Never feed these records to the US collector.
const Sicily = (() => {
 const kinds={land:'Земля',land_with_ruin:'Земля и руина',land_with_warehouse:'Земля и склад',warehouse:'Склад',house_to_renovate:'Дом под ремонт',house:'Дом',apartment:'Квартира',ruin:'Руина'};
 const utility=v=>v===true?'on_site_claim':v===false?'none':'unknown';
 const num=v=>v==null?'не указана':Number(v).toLocaleString('ru-RU')+' м²';
 const hasStructure=x=>x.kind!=='land';
 function normalize(r){
  const p=r.map_coordinates;
  return {...r,research:r,city:r.town,state:r.province,county:'Сицилия',price:r.price_eur,price_currency:'EUR',
   title:r.town+' · '+r.address+(r.lot?' · лот '+r.lot:''),lat:p?.lat??null,lng:p?.lng??null,
   coord_precision:p?.precision,personal_repair:'unknown',commercial_repair:'unknown',rv_storage:'unknown',rv_occupancy:'unknown',
   electricity:utility(r.electricity),water:utility(r.mains_water),sewer:'unknown',existing_garage:r.garage_included_claim===true,
   residential_type:r.residential_type??(r.kind==='house_to_renovate'?'house':null),
   price_conflict:r.price_status==='conflict',review_hold:r.price_status==='conflict'?{reason:r.risk_ru}:null,
   score:({A:3,B:2,C:1,HOLD:0})[r.priority]??0};
 }
 function eligible(x,budget,archive){return x.price>=1000&&x.price<=budget&&(archive||!x.price_conflict);}
 function position(x){return x.coord_precision==='seller_supplied_pin'?'Точка продавца; границы не проверены':'Примерно: населённый пункт, не участок';}
 function area(x){const parts=[];if(x.land_m2!=null)parts.push('Земля: '+num(x.land_m2));if(x.building_m2!=null)parts.push('По объявлению: '+num(x.building_m2));if(x.garage_included_claim===true)parts.push('Гараж: '+num(x.garage_m2));return parts.join(' · ')||'Площадь не указана';}
 function matchesResidential(x,type,garage){return (!type||x.residential_type===type)&&(!garage||x.garage_included_claim===true);}
 function price(x,money){return x.price_conflict?(x.research.price_observations||[]).map(p=>money(p.price_eur,'EUR')).join(' / ')+' · HOLD':money(x.price,'EUR');}
 function detail(x,{esc,photo,link,date,money,labels,useNames}){
  const r=x.research;
  const facts=[['Земля — по источнику',num(r.land_m2)],['Постройка — по источнику',num(r.building_m2)],['Электричество',useNames[x.electricity]],['Водопровод',useNames[x.water]],
   ['Другой источник воды',r.other_water==='cistern_claimed'?'Цистерна — по продавцу; питьевое качество неизвестно':r.other_water==='irrigated_land_claim_only'?'Заявлена орошаемая земля; источник воды не подтверждён':r.other_water==='Seller claims 1000L water cistern'?'Цистерна 1 000 л — по продавцу; водопровод и качество воды не подтверждены':r.other_water||'Не подтверждено'],
   ['Хранение / проживание в RV','Разрешения не подтверждены'],['Личный / коммерческий ремонт','Разрешения не подтверждены'],['Наличие продажи','Объявление прочитано; у продавца не подтверждено']];
  if(x.residential_type){
   facts.unshift(['Жильё по объявлению',x.residential_type==='house'?'Дом':'Квартира'],['Продавец / агентство',r.seller||'Не указан'],['Гараж включён в цену',r.garage_included_claim===true?'Да — по объявлению':r.garage_included_claim===false?'Нет — по объявлению':'Неизвестно'],['Пригодность жилья по продавцу',r.habitable_claim===true?'Заявлена; документы и фактическое состояние не проверены':r.habitable_claim===false?'Продавец указывает непригодность':'Не подтверждена']);
   if(r.condition)facts.push(['Состояние — поле источника',r.condition]);
   if(r.floor!=null)facts.push(['Этаж — поле источника',String(r.floor)]);
   if(r.heating_claim)facts.push(['Отопление — по продавцу',r.heating_claim]);
   if(r.fiber_claim===true)facts.push(['Оптоволокно','Заявлено продавцом; работа не проверена']);
  }
  if(r.garage_included_claim===true)facts.push(['Гараж — площадь по объявлению',num(r.garage_m2)],['Ворота и въезд кемпервана','Ширина, высота, внутренняя длина и проезд не проверены'],['Кадастровая категория гаража',r.garage_cadastral_category_claim?r.garage_cadastral_category_claim+' — по продавцу; выписка не проверена':'Не подтверждена']);
  let html=photo(x,'detail-photo')+'<div class="detail-content"><span class="eyebrow">СИЦИЛИЯ / EUR · '+esc(r.province)+'</span><span class="detail-price">'+price(x,money)+'</span><h2>'+esc(x.title)+'</h2><div class="card-labels">'+labels(x)+'</div>';
  html+='<p class="location-warning"><b>'+esc(position(x))+'</b>. '+(x.coord_precision==='seller_supplied_pin'?'Это не подтверждённые границы или пригодный въезд.':'Точное место неизвестно. Маркер и ссылка на карту показывают только ориентир по городу; по ним нельзя ехать на участок.')+'</p>';
  if(x.price_conflict)html+='<p class="location-warning"><b>HOLD — бюджет не подтверждён.</b> '+esc(r.risk_ru)+'</p>';
  html+='<p>Цена объявления в евро. Налоги, нотариус, агент, проверки, подключения и восстановление не включены; полная стоимость сделки неизвестна.</p><p>'+esc(r.summary_ru)+'</p>';
  html+='<div class="facts">'+facts.map(([k,v])=>'<div><small>'+esc(k)+'</small>'+esc(v)+'</div>').join('')+'</div>';
  html+='<h3>Подъезд и ограничения</h3><p>'+esc(r.access_ru||'Автомобильный подъезд и возможность въезда высокого кемпервана не проверены.')+'</p><p>'+esc(r.risk_ru)+'</p>';
  if(r.raw_area_claims?.secondary_portal_land_m2)html+='<p>Площадь также расходится: описание '+num(r.raw_area_claims.description_land_m2)+', поле второго портала '+num(r.raw_area_claims.secondary_portal_land_m2)+'. Кадастр не проверен.</p>';
  if(r.package)html+='<p><b>Три отдельных участка Misilmeri:</b> пакет '+money(r.package.price_eur,'EUR')+' за '+num(r.package.total_land_m2)+'. Участки не смежные; пакет не является четвёртым объектом.</p>';
  if(r.photo_status==='grouped_ad_not_attributed_to_individual_lot')html+='<p><b>Общее фото объявления:</b> не установлено, какой из трёх лотов на нём изображён.</p>';
  if(!x.image_url)html+='<p><b>Фото нет:</b> '+(r.photo_status==='listing_has_no_photos'?'в исследованном объявлении фотографии отсутствуют.':'фото источника не удалось сохранить; заменитель не используется.')+'</p>';
  html+='<h3>Как добраться</h3><p>Маршрут от аэропорта, время в пути и проезд кемпервана не проверены. Американская модель дороги и тарифы к этой подборке не применяются.</p>';
  html+='<div class="detail-links">'+link(r.url,'Объявление ↗','button-link')+link('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(x.lat+','+x.lng),x.coord_precision==='seller_supplied_pin'?'Точка продавца ↗':'Ориентир города, не участок ↗')+'</div>';
  html+='<h3>Источники и история</h3><p>Публичная страница проверена в Chrome '+date(r.observed_on)+'. Обновление в источнике: '+esc(r.source_updated_raw||'не указано')+'.</p>';
  html+=(r.secondary_sources||[]).map(s=>'<p>'+link(s.url,'Дополнительный источник ↗')+' · '+esc(s.evidence)+'</p>').join('');
  if(x.image_url)html+='<p>'+esc(x.image_credit)+' · '+link(x.image_source_url,'Источник фото ↗')+'. Оригинальные байты сохранены.</p>';
  html+='<p>Координаты: '+link(r.map_coordinates.source,x.coord_precision==='seller_supplied_pin'?'объявление продавца':'OpenStreetMap / Nominatim, населённый пункт')+'.</p>';
  html+='<p>Впервые сохранено '+date(r.first_seen)+'. ID: '+esc(x.id)+'</p><ul>'+(r.price_history||[]).map(h=>'<li>'+date(h.date)+' — '+money(h.price,'EUR')+' · '+link(h.source,'источник')+'</li>').join('')+'</ul></div>';
  return html;
 }
 return {kinds,normalize,eligible,position,area,price,detail,hasStructure,matchesResidential};
})();
