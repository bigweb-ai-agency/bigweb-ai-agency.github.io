(function(root){
  'use strict';
  const UNKNOWN='неизвестно';
  const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
  const escape=s=>String(s??UNKNOWN).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const title=r=>[r.year,r.make,r.model].filter(Boolean).join(' ');
  const conditionNames={seller_good:'Хорошее по продавцу',repair_disclosed:'Есть заявленные проблемы',needs_clarification:'Нужны уточнения',unknown:'Состояние неизвестно'};
  const className=c=>({A:'Class A',B:'Class B · по объявлению',C:'Class C',conversion:'Автобус / conversion',unknown:'Класс неизвестен / конфликт'}[c]||UNKNOWN);
  const fuelName=f=>({gas:'бензин',diesel:'дизель'}[f]||f||UNKNOWN);
  function distance(r,airport){return airport?r.distances_km[airport]:Math.min(...Object.values(r.distances_km));}
  function current(r,now=Date.now()){
    const age=now-Date.parse(r.last_checked);
    return r.status==='active'&&r.verification==='live_public_page'&&Number.isFinite(age)&&age>=-86400000&&age<=14*86400000&&r.self_propelled===true&&Number.isFinite(r.price)&&r.price<=30000;
  }
  function matches(r,f={}){
    if(f.class&&r.class!==f.class||f.seller&&r.seller_type!==f.seller||f.condition&&r.condition!==f.condition)return false;
    if(f.minPrice!==''&&f.minPrice!=null&&r.price<Number(f.minPrice)||f.maxPrice!==''&&f.maxPrice!=null&&r.price>Number(f.maxPrice))return false;
    if(f.minYear&&(!r.year||r.year<Number(f.minYear))||f.maxYear&&(!r.year||r.year>Number(f.maxYear)))return false;
    if(f.airport&&r.nearest_airport!==f.airport)return false;
    return true;
  }
  function partition(records,f={},now=Date.now()){
    let eligible=records.filter(r=>current(r,now)&&matches(r,f));
    const max=f.distance&&f.distance!=='all'?Number(f.distance):Infinity;
    const sorter=(a,b)=>f.sort==='distance'?distance(a,f.airport)-distance(b,f.airport):f.sort==='year'?(b.year??-Infinity)-(a.year??-Infinity):f.sort==='mileage'?(a.mileage?.value??Infinity)-(b.mileage?.value??Infinity):a.price-b.price;
    eligible.sort((a,b)=>sorter(a,b)||a.id.localeCompare(b.id));
    return {local:eligible.filter(r=>distance(r,f.airport)<=Math.min(max,150)),far:f.distant===false?[]:eligible.filter(r=>distance(r,f.airport)>150&&(f.distance==='all'||f.distant!==false))};
  }
  const api={current,matches,partition,distance,title};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(!root.document)return;
  const $=id=>document.getElementById(id);let data,map,markers;
  const facts=r=>`<dl><div><dt>Пробег</dt><dd>${r.mileage?escape(r.mileage.value.toLocaleString('en-US'))+' '+escape(r.mileage.unit):UNKNOWN}</dd></div><div><dt>Длина / высота</dt><dd>${escape(r.length)} / ${escape(r.height)}</dd></div><div><dt>Двигатель / топливо</dt><dd>${escape(r.engine)} / ${escape(fuelName(r.fuel))}</dd></div><div><dt>Slide-outs</dt><dd>${r.slides==null?UNKNOWN:escape(r.slides)}</dd></div></dl>`;
  const photoHTML=(r,p,i)=>`<img src="${escape(p.path)}" alt="${escape(title(r))}: фотография ${i+1} из объявления"><p class="photo-note"><a href="${escape(p.source_url)}" target="_blank" rel="noopener">Источник фотографии ${i+1} ↗</a> · Исходные байты сохранены без обработки.</p>`;
  function card(r,airport){
    const dist=distance(r,airport),gate=airport||r.nearest_airport;
    return `<article class="card" id="${escape(r.id)}"><button class="rv-photo" data-detail="${escape(r.id)}" aria-label="Открыть фото: ${escape(title(r))}"><img loading="lazy" src="${escape(r.photos[0].path)}" alt="${escape(title(r))} — фото из объявления"></button><div class="card-body"><span class="tag">${escape(className(r.class))}</span><span class="tag">${r.seller_type==='dealer'?'Дилер':'Частник'}</span><h3>${escape(title(r))}</h3><div class="price">${money(r.price)}<span>${r.fee_included?'Включая $350 doc fee; налог/title/регистрация отдельно':'Цена автомобиля; дополнительные сборы и налоги неизвестны'}</span></div><p>${escape(r.location.name)} · <b>≈${dist.toFixed(0)} км от ${gate}</b><br><small>Приблизительный ориентир, не адрес стоянки</small></p>${facts(r)}<p class="risk"><b>${escape(conditionNames[r.condition])}.</b> ${escape(r.notes_ru)}</p><div class="links"><button class="details" data-detail="${escape(r.id)}">Фото и подробности</button><a href="${escape(r.url)}" target="_blank" rel="noopener">Оригинал ↗</a></div><small>${escape(r.source)} · проверено ${escape(r.last_checked.slice(0,10))}<br>Title: ${r.title_status?escape(r.title_status)+' · по продавцу':UNKNOWN} · Протечки: ${r.leaks===null?'история неизвестна':escape(r.leaks)}</small></div></article>`;
  }
  function showDetail(id){
    const r=data.listings.find(x=>x.id===id);if(!r)return;
    if(!current(r)){ $('detail-body').innerHTML='<h2 id="detail-title">Объявление не в текущей выдаче</h2><p>Статус или срок проверки больше не позволяет показывать RV как актуальное предложение.</p>'; }
    else $('detail-body').innerHTML=`<h2 id="detail-title">${escape(title(r))}</h2><p class="price">${money(r.price)}</p><p>${escape(className(r.class))} · ${escape(r.location.name)}</p>${photoHTML(r,r.photos[0],0)}<p class="notice">${escape(r.notes_ru)}</p>${facts(r)}<dl><dt>Продавец</dt><dd>${escape(r.seller_name||'Частник по объявлению')}</dd><dt>VIN</dt><dd>${escape(r.vin)}</dd><dt>Title</dt><dd>${escape(r.title_status)}${r.title_status?' · только заявление продавца, документы не проверены':''}</dd><dt>Место и точность</dt><dd>${escape(r.location.address||r.location.name)}; ${escape(r.location.coordinates.join(', '))}. ${r.location.accuracy==='city_reference'?'Точка города, не координаты дилерской площадки.':'Приблизительная точка из объявления, не проверенный адрес стоянки.'}</dd><dt>Первое наблюдение / проверка</dt><dd>${escape(r.first_seen)} / ${escape(r.last_checked)}</dd><dt>ID / источник</dt><dd class="source-id">${escape(r.id)} · ${escape(r.source_id)}</dd></dl>${r.photos.slice(1).map((p,i)=>photoHTML(r,p,i+1)).join('')}<p><a href="${escape(r.url)}" target="_blank" rel="noopener">Открыть исходное объявление ↗</a></p><p class="muted">Фото принадлежит продавцу/площадке. На дилерском сайте могут использоваться stock photos. Наличие, состояние и документы требуют подтверждения перед поездкой.</p>`;
    if(!$('rv-detail').open)$('rv-detail').showModal();
  }
  function drawMap(records){
    if(!map)return;markers.clearLayers();let groups=new Map();
    records.forEach(r=>{const key=r.location.coordinates.join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);});
    const colors={A:'#7849a7',B:'#125e50',C:'#a46632',conversion:'#596b70',unknown:'#596b70'};
    groups.forEach(items=>{let r=items[0];L.circleMarker(r.location.coordinates,{radius:items.length>1?12:8,color:colors[r.class],fillColor:colors[r.class],fillOpacity:.75,weight:2,dashArray:'3 3'}).bindTooltip(items.length>1?`${items.length} RV · ${r.location.name}`:`${title(r)} · ${money(r.price)}`).bindPopup(`<b>≈ ${escape(r.location.name)}</b><ul class="map-list">${items.map(x=>`<li>${escape(className(x.class))} · ${money(x.price)}<br><button data-detail="${escape(x.id)}">${escape(title(x))}</button></li>`).join('')}</ul><small>Приблизительная точка; точное место RV неизвестно.</small>`).addTo(markers);});
    if(records.length)map.fitBounds(L.latLngBounds(records.map(r=>r.location.coordinates)).pad(.2),{maxZoom:10});
    $('rv-map').dataset.markerGroups=String(groups.size);
  }
  function render(){
    const f=Object.fromEntries(new FormData($('filters')));f.distant=$('filters').elements.distant.checked;
    const selected=partition(data.listings,f);
    $('cards').innerHTML=selected.local.map(r=>card(r,f.airport)).join('');$('far-cards').innerHTML=selected.far.map(r=>card(r,f.airport)).join('');$('far-section').hidden=!selected.far.length;$('empty').hidden=selected.local.length>0;
    $('result-count').textContent=`В выбранном радиусе: ${selected.local.length} · Дальше 150 км отдельно: ${selected.far.length}`;
    drawMap([...selected.local,...selected.far]);
  }
  async function init(){
    try{
      const res=await fetch('data/rvs.json');if(!res.ok)throw Error('HTTP '+res.status);data=await res.json();
      const active=data.listings.filter(r=>current(r)),local=active.filter(r=>r.local);
      $('summary').textContent=`${local.length} местных RV до $30 000: Chicago / ORD — ${local.filter(r=>r.nearest_airport==='ORD').length}, Minneapolis / MSP — ${local.filter(r=>r.nearest_airport==='MSP').length}. Ещё ${active.length-local.length} дальше 150 км. Проверка 23.11.2026.`;
      if(root.L){
        map=L.map('rv-map',{scrollWheelZoom:true}).setView([43.3,-90.5],6);markers=L.layerGroup().addTo(map);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
        Object.entries(data.airports).forEach(([name,coords])=>{L.circle(coords,{radius:150000,color:name==='ORD'?'#7849a7':'#125e50',fillOpacity:.025,weight:1}).bindTooltip(name+' · 150 км').addTo(map);L.marker(coords).bindTooltip(name+' · аэропорт').addTo(map);});
        map.on('zoomend',()=>{$('rv-map').dataset.zoom=String(map.getZoom());});
      }else $('rv-map').innerHTML='<p class="map-error">Картографическая библиотека не загрузилась. Все фото, карточки и фильтры доступны ниже.</p>';
      $('filters').addEventListener('input',render);$('filters').addEventListener('change',render);$('filters').addEventListener('submit',e=>e.preventDefault());$('filters').addEventListener('reset',()=>setTimeout(render,0));
      document.addEventListener('click',e=>{const button=e.target.closest('[data-detail]');if(button)showDetail(button.dataset.detail);});
      $('rv-detail').querySelector('.close').addEventListener('click',()=>$('rv-detail').close());
      render();if(location.hash.startsWith('#rv-'))showDetail(decodeURIComponent(location.hash.slice(1)));
    }catch(error){$('summary').textContent='Не удалось загрузить базу объявлений. Попробуй обновить страницу или открой JSON по ссылке ниже.';console.error('RV data load failed',error);}
  }
  init();
})(typeof window!=='undefined'?window:globalThis);
