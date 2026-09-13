'use strict';
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = v => v == null ? '—' : '$' + Number(v).toLocaleString('en-US',{maximumFractionDigits:2});
const date = v => v && !isNaN(Date.parse(v)) ? new Date(v).toLocaleDateString('ru-RU') : 'не подтверждена';
const safe = (v,photo=false) => {
 if(!v)return '';
 if(photo && /^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(v))return v;
 try { const u=new URL(v,location.href);return u.protocol==='https:' || (u.origin===location.origin && /^https?:$/.test(u.protocol)) ? u.href : ''; } catch{return '';}
};
const link=(url,label,cls='')=>'<a class="'+cls+'" href="'+esc(safe(url))+'" target="_blank" rel="noopener noreferrer">'+esc(label)+'</a>';
const kindNames={land:'Земля',house:'Дом',building:'Здание',commercial:'Коммерческое здание',workshop:'Мастерская',commercial_lot:'Коммерческий лот',industrial_lot:'Industrial лот'};
const useNames={unknown:'Не подтверждено',none:'Нет — по источнику',available:'Доступно / рядом — по источнику',on_site_claim:'На участке — по источнику',seller_claim:'Заявление продавца',seller_conditional:'По продавцу, с условиями',seller_no:'Продавец указывает запрет',authority_confirmed:'Подтверждено органом',restriction_risk:'Выявлен риск ограничения',problem:'Проблема доступа'};
const statusNames={active:'Активно по источнику',pending:'Pending / под контрактом',sold:'Продано по источнику',off_market:'Снято с продажи',unknown:'Статус неизвестен'};
const basisNames={live_public_page:'Прочитана публичная страница',indexed_public_page:'Прочитан поисковый снимок страницы',legacy_unrechecked:'Прежняя подборка; повторно не подтверждено'};
let listings=[],states=[],flightData={},gateways=[],byId=new Map(),filtered=[],visibleCount=24,selected=null,map=null,markers=new Map(),layer=null;
let favorites=new Set();try{favorites=new Set(JSON.parse(localStorage.getItem('rv-land-favorites-v2')||'[]'));}catch{}
function photo(x,cls='card-image'){
 const src=safe(x.image_url,true);
 return src?'<img class="'+cls+'" loading="lazy" decoding="async" referrerpolicy="no-referrer" src="'+esc(src)+'" alt="'+esc('Из объявления: '+x.title+', '+x.city)+'">':'<div class="'+cls+' photo-failure">Фотография источника не найдена</div>';
}
document.addEventListener('error',event=>{
 if(event.target.tagName==='IMG'){
  const img=event.target, label=document.createElement('div');
  label.className=img.className+' photo-failure';label.textContent='Фото временно недоступно · открыть источник';img.replaceWith(label);
 }
},true);
function tag(text,cls=''){return '<span class="tag '+cls+'">'+esc(text)+'</span>';}
function labels(x){
 return tag(x.existing_garage?'Гараж указан':kindNames[x.kind]||x.kind,x.existing_garage?'good':'')+
 tag(x.personal_repair==='authority_confirmed'?'Ремонт подтверждён':'Ремонт не подтверждён',x.personal_repair==='authority_confirmed'?'good':'warn')+
 (x.status!=='active'?tag(statusNames[x.status]||x.status,'warn'):'');
}
function airportLine(x){
 const a=x.gateways?.[0];if(!a)return 'Аэропорт не рассчитан';
 if(['HI','AK'].includes(x.state))return 'Отдельная логистика '+x.state+' · рейс и перевозку RV проверить';
 return a.code+' · ~'+a.drive_hours_estimate+' ч по модели дороги';
}
function card(x){
 return '<article class="property-card'+(selected===x.id?' selected':'')+'" data-id="'+esc(x.id)+'">'+photo(x)+
 '<button class="favorite" data-favorite="'+esc(x.id)+'" aria-label="'+(favorites.has(x.id)?'Убрать из избранного':'В избранное')+'" aria-pressed="'+favorites.has(x.id)+'">'+(favorites.has(x.id)?'★':'☆')+'</button>'+
 '<div class="card-info"><span class="card-price">'+money(x.price)+'</span><button class="card-title" data-detail="'+esc(x.id)+'">'+esc(x.title)+'</button>'+
 '<div class="card-location">'+esc(x.city+', '+x.state)+' · '+esc(x.acres??'?')+' ac · '+esc(x.score)+' / 100</div>'+
 '<div class="card-labels">'+labels(x)+'</div><div class="card-bottom">'+esc(airportLine(x))+'</div></div></article>';
}
function renderCards(){
 $('cards').innerHTML=filtered.length?filtered.slice(0,visibleCount).map(card).join(''):'<p class="empty">По этим условиям объектов нет. Разрешение личного ремонта пока нигде не подтверждено. Измени фильтры или включи архив.</p>';
 $('resultCount').textContent=filtered.length+' объектов';
 $('loadMore').hidden=visibleCount>=filtered.length;
 $('loadMore').textContent='Показать ещё '+Math.min(24,filtered.length-visibleCount);
}
function applyFilters(fit=true){
 const query=$('search').value.toLowerCase().trim(), budget=+$('budget').value||15000;
 filtered=listings.filter(x=>{
  if((x.price??Infinity)>budget || x.price<3000)return false;
  if(!$('archive').checked && (x.screening_issue || !x.image_url || x.price_conflict || !['active','pending'].includes(x.status)))return false;
  if($('state').value && x.state!==$('state').value)return false;
  if($('region').value && x.region!==$('region').value)return false;
  if(query && ![x.title,x.city,x.county,x.state,x.id,x.parcel].join(' ').toLowerCase().includes(query))return false;
  const k=$('kind').value;
  if(k==='garage'&&!x.existing_garage)return false;
  if(k==='structure'&&!['house','building','commercial','workshop'].includes(x.kind))return false;
  if(k==='land'&&x.kind!=='land')return false;
  if(k==='commercial'&&!['commercial_lot','industrial_lot','commercial'].includes(x.kind))return false;
  const p=$('power').value;
  if(p==='available'&&!['available','on_site_claim'].includes(x.electricity))return false;
  if(p==='on_site_claim'&&x.electricity!==p)return false;
  const u=$('utilities').value;
  if(u&&!['available','on_site_claim'].includes(x[u]))return false;
  const use=$('use').value;
  if(use==='rv'&&![x.rv_storage,x.rv_occupancy].some(y=>['seller_claim','seller_conditional','authority_confirmed'].includes(y)))return false;
  if(use==='repair'&&!['seller_claim','authority_confirmed'].includes(x.personal_repair))return false;
  if(use==='verified'&&x.personal_repair!=='authority_confirmed')return false;
  if($('drive').value&&(['HI','AK'].includes(x.state)||(x.gateways?.[0]?.drive_hours_estimate??999)>+$('drive').value))return false;
  if($('climate').value&&(x.score_parts?.['Сезон /10']??0)<+$('climate').value)return false;
  if($('nohoa').checked&&x.no_hoa!=='seller_claim')return false;
  if($('favoritesOnly').checked&&!favorites.has(x.id))return false;
  return true;
 });
 const sort=$('sort').value;
 filtered.sort((a,b)=>sort==='price'?a.price-b.price:sort==='new'?(b.first_seen||'').localeCompare(a.first_seen||''):sort==='drive'?(a.gateways?.[0]?.drive_hours_estimate??999)-(b.gateways?.[0]?.drive_hours_estimate??999):b.score-a.score||a.price-b.price);
 visibleCount=24;renderCards();renderMarkers(fit);
}
function initMap(){
 if(!window.L){$('map').innerHTML='<p class="empty">Библиотека карты недоступна. Список и ссылки на Google Maps продолжают работать.</p>';return;}
 map=L.map('map',{scrollWheelZoom:false}).setView([38.5,-97],4);
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
 layer=L.layerGroup().addTo(map);
}
function renderMarkers(fit){
 if(!map)return;layer.clearLayers();markers.clear();
 filtered.forEach(x=>{
  if(!Number.isFinite(x.lat)||!Number.isFinite(x.lng))return;
  const color=x.existing_garage?'#276858':['house','building','commercial','workshop'].includes(x.kind)?'#b27b31':'#53768c';
  const marker=L.circleMarker([x.lat,x.lng],{radius:x.existing_garage?8:5,weight:1.5,color:'#fff',fillColor:color,fillOpacity:.85});
  marker.bindTooltip(esc(x.city+', '+x.state)+' · '+money(x.price));
  marker.bindPopup('<div class="popup">'+photo(x,'popup-image')+'<strong>'+money(x.price)+'</strong><p>'+esc(x.title)+'</p><p>'+esc(x.city+', '+x.state)+'</p><p>Ремонт и размеры въезда требуют проверки</p><button data-detail="'+esc(x.id)+'">Открыть карточку</button></div>',{maxWidth:250});
  marker.addTo(layer);markers.set(x.id,marker);
 });
 if(fit)fitMap();
}
function fitMap(){
 if(!map)return;
 const rows=filtered.filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lng));
 const continental=rows.filter(x=>!['AK','HI'].includes(x.state));
 const use=$('state').value?rows:continental;
 if(use.length)map.fitBounds(use.map(x=>[x.lat,x.lng]),{padding:[25,25],maxZoom:12});
}
function showTab(id){
 document.querySelectorAll('main>.panel').forEach(p=>p.hidden=p.id!==id);
 document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===id);b.setAttribute('aria-current',b.dataset.tab===id?'page':'false');});
 if(id==='explore'&&map)requestAnimationFrame(()=>map.invalidateSize());
}
function showDetail(id){
 const x=byId.get(id);if(!x)return;selected=id;
 const facts=[['Тип',kindNames[x.kind]||x.kind],['Площадь',String(x.acres??'?')+' ac'],['Хранение RV',useNames[x.rv_storage]],['Проживание в RV',useNames[x.rv_occupancy]],['Личный ремонт',useNames[x.personal_repair]],['Коммерческий ремонт',useNames[x.commercial_repair]],['Электричество',useNames[x.electricity]],['Вода',useNames[x.water]],['Канализация / септик',useNames[x.sewer]],['Отсутствие HOA',useNames[x.no_hoa]],['Подъезд',useNames[x.road_access]],['Статус',statusNames[x.status]]];
 let body=photo(x,'detail-photo')+'<div class="detail-content"><span class="eyebrow">'+esc(x.city+', '+x.state+' / '+x.county)+'</span><span class="detail-price">'+money(x.price)+'</span><h2>'+esc(x.title)+'</h2><div class="card-labels">'+labels(x)+'</div>'+
 '<p style="margin-top:12px">Известные сборы: '+money(x.known_fees||0)+'. Цена + известные сборы: '+money(x.total_known)+'. Closing, обследование и подготовка площадки не включены.</p>'+
 '<div class="facts">'+facts.map(([k,v])=>'<div><small>'+esc(k)+'</small>'+esc(v||'Не подтверждено')+'</div>').join('')+'</div>'+
 '<p><b>Помещение:</b> '+esc(x.garage_note||'Не подтверждено')+'</p><p><b>Коммуникации:</b> '+esc(x.utility_note||'Не подтверждены')+'</p><p><b>Zoning:</b> '+esc(x.zoning)+'</p><p><b>Parcel / MLS:</b> '+esc(x.parcel||'не указан')+' / '+esc(x.mls||'не указан')+'</p>'+
 '<p><b>Налоги по источнику:</b> '+esc(x.taxes_note||'Не подтверждены')+'</p>';
 if(x.flags?.length)body+='<h3>Что может изменить решение</h3><ul>'+x.flags.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul>';
 if(x.notes?.length)body+=x.notes.filter(Boolean).map(t=>'<p>'+esc(t)+'</p>').join('');
 body+='<h3>Как добраться</h3>';
 if(['HI','AK'].includes(x.state))body+='<p>Материковая поездка сюда не является простым автомобильным трансфером. Для Hawaii необходимы доставка RV и проверка острова; для Alaska — отдельный рейс или многодневный переезд.</p>';
 else body+=(x.gateways||[]).map(a=>'<p><b>'+esc(a.code)+'</b> · '+esc(a.name)+' · '+a.straight_km+' км по прямой; модель ~'+a.drive_km_estimate+' км / '+a.drive_hours_estimate+' ч.'+(a.flight_min_eur?' Найденный авиапоиск от €'+a.flight_min_eur+' из '+esc(a.flight_origin)+', на отдельных датах.':' Датированная авиакотировка не найдена.')+'</p>').join('');
 body+='<p>'+esc(x.climate_note)+'</p><div class="detail-links">'+link(x.url,'Объявление ↗','button-link')+link('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(x.lat+','+x.lng),'Проверить место / дорогу')+'</div>'+
 '<h3>Приоритет осмотра: '+x.score+' / 100</h3><p>Баллы не подтверждают юридическую или техническую пригодность.</p>'+
 Object.entries(x.score_parts||{}).map(([k,v])=>'<div style="font-size:11px;margin:7px 0">'+esc(k)+': '+v+'<div class="scorebar"><span style="width:'+Math.min(100,v/Number(k.split('/')[1])*100)+'%"></span></div></div>').join('')+
 '<h3>Источник и свежесть</h3><p>'+esc(basisNames[x.status_basis]||x.status_basis)+'. Просмотрено '+date(x.last_verified)+'. Индекс: '+esc(x.source_crawled||'не применяется')+'.</p><p>'+esc(x.image_credit||'Фото продавца')+' · '+link(x.image_source_url||x.url,'Источник изображения')+'</p>';
 if(x.evidence_quote && !x.legacy)body+='<p lang="en"><b>Короткая выдержка продавца:</b> “'+esc(x.evidence_quote)+'”</p>';
 body+='<h3>История</h3><p>Впервые сохранено: '+date(x.first_seen)+'. ID: '+esc(x.id)+'</p><ul>'+
 (x.price_history||[]).map(h=>'<li>'+date(h.date)+' — '+money(h.price)+'</li>').join('')+
 (x.status_history||[]).map(h=>'<li>'+date(h.date)+' — '+esc(statusNames[h.from]||h.from)+' → '+esc(statusNames[h.to]||h.to)+'</li>').join('')+'</ul></div>';
 $('detailBody').innerHTML=body;$('detail').showModal();$('detail').scrollTop=0;
 history.replaceState(null,'','#property='+encodeURIComponent(id));
 if(markers.has(id)){markers.get(id).openPopup();if(map)map.panTo([x.lat,x.lng]);}renderCards();
}
function renderStates(){
 const complete=states.filter(s=>s.photo_candidates>=10).length;
 $('coverageNote').textContent='Поиск выполнен по всем 50 штатам. В '+complete+' штатах есть минимум 10 кандидатов с фото в бюджете; в остальных недобор показан явно. Это полнота подборки, а не число разрешённых мастерских.';
 $('stateGrid').innerHTML=states.slice().sort((a,b)=>a.priority-b.priority||a.name.localeCompare(b.name)).map(s=>'<article class="state-card"><div class="state-top"><span class="state-code">'+s.code+'</span>'+tag('Приоритет '+s.priority,s.priority===1?'good':'')+'</div><h2>'+esc(s.name)+'</h2><p>'+esc(s.analysis)+'</p><div class="state-meta"><span>'+s.photo_candidates+' фото-кандидатов</span><span>Сезон '+s.climate_score+'/10</span></div><p>EU-шлюзы: '+esc(s.gateways.join(' / '))+'</p>'+(s.shortfall?'<div class="shortfall">До цели 10: не хватает '+s.shortfall+'. Поиск продолжается.</div>':'')+'<button data-state="'+s.code+'">Смотреть '+s.total+' записей на карте →</button><p style="margin-top:10px;font-size:10px">'+link(s.sources[0],'Поиск источника')+' · '+link(s.sources[2],'NOAA: климат')+'</p></article>').join('');
}
function renderFlights(){
 const all=flightData.observations||[], today=new Date().toISOString().slice(0,10);
 const rows=all.filter(f=>f.usable&&f.departure>=today&&($('longFlights').checked||f.duration_hours<=24));
 const codes=[...new Set(all.map(f=>f.gateway))].sort();
 $('flightNote').textContent=flightData.trip+' Снимок '+date(flightData.updated_at)+'. '+flightData.caveat;
 $('flightTable').innerHTML='<table><thead><tr><th>Город / шлюз США</th>'+flightData.origins.map(o=>'<th>'+esc(o.code)+'<span class="table-note">'+esc(o.name)+'</span></th>').join('')+'</tr></thead><tbody>'+codes.map(code=>{
  const airport=gateways.find(a=>a.code===code);
  const minimum=Math.min(...rows.filter(f=>f.gateway===code).map(f=>f.eur));
  return '<tr><td><b>'+code+'</b><span class="table-note">'+esc((airport?.name||'').replace('International Airport','').replace('city search — JFK used for approximate geometry','— точный аэропорт уточнить'))+'</span></td>'+flightData.origins.map(o=>{
   const f=rows.filter(f=>f.gateway===code&&f.origin===o.code).sort((a,b)=>a.eur-b.eur)[0];
   return '<td>'+(f?'<button class="fare-btn'+(f.eur===minimum?' best':'')+'" data-fare="'+all.indexOf(f)+'">€'+f.eur+'</button>':'<span title="Нет подходящей датированной котировки">—</span>')+'</td>';
  }).join('')+'</tr>';
 }).join('')+'</tbody></table>';
 $('providerChecks').innerHTML=(flightData.provider_checks||[]).map(p=>'<article><h3>'+esc(p.route)+'</h3><p><b>'+esc(p.price)+'</b><br>'+esc(p.dates)+'</p><p>'+esc(p.note)+'</p><p>'+link(p.url,'Страница перевозчика ↗')+'</p></article>').join('');
}
function showFare(i){
 const f=flightData.observations[i];if(!f)return;
 $('fareBody').innerHTML='<div class="detail-content"><span class="eyebrow">ПОИСК В CHROME · НЕ CHECKOUT</span><h2>'+esc(f.origin+' → '+f.gateway)+'</h2><p class="detail-price">€'+f.eur+' туда-обратно</p><p>'+date(f.departure)+' — '+date(f.return)+'</p><p>'+esc(f.airlines)+' · '+f.stops+' пересадок · туда '+esc(f.duration)+' ч.</p><p>'+esc(f.baggage)+'</p><p>'+esc(flightData.caveat)+'</p><p>Поиск по городу; фактический аэропорт, терминалы и единый билет ещё нужно подтвердить. Для отдельного позиционирующего билета заложи запас и возможную ночёвку.</p><p>Наблюдение '+date(f.observed_at)+'.</p><div class="detail-links">'+link(f.source_url,'Открыть актуальный поиск ↗','button-link')+'<button data-costfare="'+f.eur+'">Подставить в расчёт</button></div></div>';
 $('fareDetail').showModal();
}
function cost(){const n=id=>Math.max(0,Number($(id).value)||0);$('costTotal').textContent='≈ €'+(n('costFare')+n('costPosition')+n('costHotel')+n('costBags')+n('costCar')*n('costDays')+n('costFuel')).toLocaleString('ru-RU');}
function renderGuide(){
 const picks=[
 ['in-gary-kentucky-837526','Близко к Chicago; в прежнем описании отдельный гараж на две машины. Маленький лот и ворота обязательно измерить.'],
 ['ia-mount-ayr-adams-6340604','Обновлённая цена $15k и отдельный гараж. Дом as-is; длиннее дорога от международного рейса.'],
 ['ia-scranton-state-6335122','Дом с гаражом из прежней подборки. Интересен для помещения, но доступность и состояние повторно не подтверждены.'],
 ['mi-flint-brownell-20250033421','Гараж указан в прежней подборке; одни ворота могут оказаться слишком низкими. Проверить статус, требования города и зимнее отопление.'],
 ['lc-15893','Новое коммерческое здание в Illinois за $5k по cash-полю. Назначение, состояние и въезд пока неизвестны; проверить договорную цену.'],
 ['lc-16279','Новый дом за $7k в Illinois. Продавец не посещал его и не имеет фото интерьера; гараж не подтверждён. Только кандидат для первичного осмотра.'],
 ['wv-rainelle-13th-26-986','Участок с заявленным электросчётчиком и водой/sewer у дороги. Рядом ручей: паводок и право RV во время строительства требуют проверки.'],
 ['tn-lone-mountain-1344590','Более мягкий сезон и небольшая ровная площадка. Гараж и трейлер на фото не продаются; общий driveway требует easement.'],
 ['lc-24853','Georgia, продавец упоминает один RV. Электричество доступно, но нужны well/septic; ремонт и затопление не подтверждены.'],
 ['lc-25942','Mississippi, земля с заявленной доступностью городских коммуникаций. Проверить сухость площадки, реальное подключение и правила хранения/ремонта.']
 ];
 $('shortlist').innerHTML=picks.map(([id,note],i)=>{const x=byId.get(id);return x?'<article class="shortlist-item">'+photo(x,'shortlist-photo')+'<div><span class="eyebrow">'+String(i+1).padStart(2,'0')+' / '+esc(x.state)+' · '+money(x.price)+'</span><h3>'+esc(x.title)+'</h3><p>'+esc(note)+'</p><button data-detail="'+esc(id)+'">Проверить карточку →</button></div></article>':'';}).join('');
}
function exportCSV(){
 const headers=['id','title','city','state','price_usd','acres','kind','status','personal_repair','score','source_url','image_source','verified'];
 const csvcell=v=>{let s=String(v??'');if(/^[=+@\t\r-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
 const rows=filtered.map(x=>[x.id,x.title,x.city,x.state,x.price,x.acres,x.kind,x.status,x.personal_repair,x.score,x.url,x.image_source_url,x.last_verified]);
 const blob=new Blob(['\ufeff'+[headers,...rows].map(row=>row.map(csvcell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='rv-land-selection.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
document.addEventListener('click',event=>{
 const b=event.target.closest('button');if(!b)return;
 if(b.dataset.tab){showTab(b.dataset.tab);window.scrollTo({top:0});}
 if(b.dataset.detail)showDetail(b.dataset.detail);
 if(b.dataset.favorite){const id=b.dataset.favorite;favorites.has(id)?favorites.delete(id):favorites.add(id);try{localStorage.setItem('rv-land-favorites-v2',JSON.stringify([...favorites]));}catch{}applyFilters(false);}
 if(b.dataset.state){$('filters').reset();$('state').value=b.dataset.state;showTab('explore');applyFilters();window.scrollTo({top:0});}
 if(b.dataset.fare!==undefined)showFare(+b.dataset.fare);
 if(b.dataset.costfare){$('costFare').value=b.dataset.costfare;cost();$('fareDetail').close();$('costForm').scrollIntoView({block:'center'});}
 if(b.classList.contains('close'))b.closest('dialog').close();
});
$('detail').addEventListener('close',()=>{if(location.hash.startsWith('#property='))history.replaceState(null,'',location.pathname+location.search);});
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d && (e.clientX<d.getBoundingClientRect().left||e.clientX>d.getBoundingClientRect().right||e.clientY<d.getBoundingClientRect().top||e.clientY>d.getBoundingClientRect().bottom))d.close();}));
$('moreFilters').addEventListener('click',()=>{const hidden=!$('extraFilters').hidden;$('extraFilters').hidden=hidden;$('moreFilters').setAttribute('aria-expanded',String(!hidden));if(map)requestAnimationFrame(()=>map.invalidateSize());});
$('filters').addEventListener('submit',e=>e.preventDefault());
$('filters').addEventListener('change',()=>applyFilters());
let searchTimer;$('search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>applyFilters(),200);});
$('filters').addEventListener('reset',()=>setTimeout(()=>applyFilters(),0));
$('sort').addEventListener('change',()=>applyFilters(false));
$('loadMore').addEventListener('click',()=>{visibleCount+=24;renderCards();});
$('fitMap').addEventListener('click',fitMap);$('export').addEventListener('click',exportCSV);
$('longFlights').addEventListener('change',renderFlights);$('costForm').addEventListener('input',cost);$('costForm').addEventListener('submit',e=>e.preventDefault());
async function init(){
 try{
  const files=await Promise.all(['listings','states','flights','gateways'].map(async name=>{const r=await fetch('data/'+name+'.json',{cache:'no-cache'});if(!r.ok)throw Error(name+' '+r.status);return r.json();}));
  listings=files[0].listings;states=files[1].states;flightData=files[2];gateways=files[3].airports;byId=new Map(listings.map(x=>[x.id,x]));
  $('updated').textContent='База обновлена '+date(files[0].updated_at);
  const eligible=listings.filter(x=>!x.screening_issue&&x.image_url&&['active','pending'].includes(x.status));
  $('stats').innerHTML='<div><b>'+eligible.length+'</b><span>фото-кандидатов</span></div><div><b>'+states.filter(s=>s.photo_candidates>=10).length+'</b><span>штатов с 10+ объектами</span></div><div><b>'+listings.filter(x=>x.existing_garage).length+'</b><span>гаражей по описанию</span></div>';
  $('state').insertAdjacentHTML('beforeend',states.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(s=>'<option value="'+s.code+'">'+esc(s.name)+' ('+s.photo_candidates+')</option>').join(''));
  $('region').insertAdjacentHTML('beforeend',[...new Set(states.map(s=>s.region))].sort().map(r=>'<option>'+esc(r)+'</option>').join(''));
  initMap();applyFilters();renderStates();renderFlights();renderGuide();cost();
  if(location.hash.startsWith('#property='))showDetail(decodeURIComponent(location.hash.slice(10)));
  const mr=await fetch('data/monitor.json',{cache:'no-cache'});if(mr.ok){const m=await mr.json();$('monitorStatus').innerHTML='<p>'+esc(m.schedule||'Расписание в настройке')+'</p><p>Последний запуск: '+date(m.last_run)+'. '+esc(m.summary||'')+'</p>'+(m.run_url?link(m.run_url,'Журнал запуска ↗'):'');}else $('monitorStatus').textContent='Состояние ночного запуска пока не опубликовано.';
 }catch(error){$('updated').textContent='Не удалось загрузить базу';$('cards').innerHTML='<p class="empty">Ошибка загрузки данных. '+esc(error.message)+'. Обнови страницу или открой JSON по ссылке в разделе методики.</p>';console.error(error);}
}
init();
