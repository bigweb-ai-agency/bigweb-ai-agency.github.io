'use strict';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>v==null?'не подтверждены':'$'+Number(v).toLocaleString('en-US');
const safe=v=>{try{const u=new URL(v,location.href);return u.protocol==='https:'||u.origin===location.origin?u.href:'';}catch{return '';}};
const link=(url,label)=>'<a href="'+esc(safe(url))+'" target="_blank" rel="noopener noreferrer">'+esc(label)+'</a>';
let rows=[],map,layer;
const categoryMatch=(x,c)=>!c||(c==='houses'?x.kind==='house':x.category===c);
function render(){
 const current=rows.filter(x=>Availability.visible(x)&&x.price<=20000),selected=current.filter(x=>categoryMatch(x,$('category').value)).sort((a,b)=>(a.inspection_order??999)-(b.inspection_order??999));
 $('totals').textContent='Свежие активные объявления с фото: '+current.length+'. Дома, гаражи и площадки показаны как зацепки; состояние и RV-fit — отдельные условия.';
 $('count').textContent='В выбранной категории: '+selected.length;
 $('cards').innerHTML=selected.map(x=>{
  const r=x.research_record,fee=r.association?'Ежегодные взносы: '+(r.annual_dues_usd?money(r.annual_dues_usd):'$1,580–$1,710 — тип лота проверить')+'; налог и электричество отдельно.':r.annual_tax_usd?'Налог по объявлению: '+money(r.annual_tax_usd)+' за '+r.tax_year+' год; прочие расходы требуют проверки.':r.annual_tax_usd?'Налог по объявлению: '+money(r.annual_tax_usd)+' за '+r.tax_year+' год; прочие расходы требуют проверки.':'Налог и расходы содержания требуют проверки.';
  const position=r.location.note_ru;
  return '<article class="card" id="'+esc(x.id)+'"><img src="'+esc(safe(x.image_url))+'" alt="Из объявления: '+esc(x.title)+'" loading="lazy" decoding="async"><div class="card-body"><div class="price">'+money(x.price)+'<span>Цена объекта · расходы сделки и ремонт отдельно</span></div><p class="category">'+esc(Midwest.labels[x.category])+'</p><h3>'+esc(x.title)+'</h3><p class="muted">'+esc(x.city+', '+x.state)+' · MLS '+esc(x.mls)+'</p><p class="risk">'+esc(x.summary_ru)+'</p><p>'+esc(fee)+'</p><p class="muted">'+esc(x.gateways?.[0]?.code||'Аэропорт')+' · ≈'+esc(x.gateways?.[0]?.straight_km??'?')+' км по прямой. Автомаршрут не проверен.</p><p class="muted">'+esc(position)+'</p><p><b>Высокий RV / личный ремонт:</b> не подтверждены.</p><div class="links">'+link(x.url,'Объявление ↗')+'<a href="./#property='+esc(x.id)+'">Карточка на карте →</a>'+link('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(x.kind==='house'?x.title+', '+x.city+', '+x.state:x.title+', Sublette IL'),'Адрес / поиск места ↗')+'</div><small>Публичная страница прочитана '+new Date(x.last_verified).toLocaleDateString('ru-RU')+'. Фото именно из объявления; границы и въезд не проверены.</small></div></article>';
 }).join('')||'<p>Свежих активных объявлений в этой категории нет. Старые записи сохранены в JSON.</p>';
 if(map){
  layer.clearLayers();const plotted=new Set();
  selected.forEach(x=>{
   if(!MapGroups.validPoint(x.lat,x.lng))return;const key=x.lat+','+x.lng;if(plotted.has(key))return;plotted.add(key);
   const group=selected.filter(y=>y.lat===x.lat&&y.lng===x.lng),color=MapGroups.groups[MapGroups.classify(x)].color,approx=x.coord_precision!=='address_geocoded';
   L.circleMarker([x.lat,x.lng],{radius:group.length>1?10:7,color,weight:2,dashArray:approx?'3 3':null,fillColor:color,fillOpacity:approx?.3:.8}).addTo(layer).bindPopup('<b>'+esc(group.length>1?group.length+' объявлений · общий ориентир':x.title)+'</b><p>'+esc(x.research_record.location.note_ru)+'</p><ul class="map-list">'+group.map(y=>'<li><a href="#'+esc(y.id)+'">'+esc(y.title)+' · '+money(y.price)+'</a></li>').join('')+'</ul>',{maxWidth:290});
  });
  if(selected.some(x=>MapGroups.validPoint(x.lat,x.lng)))map.fitBounds(selected.filter(x=>MapGroups.validPoint(x.lat,x.lng)).map(x=>[x.lat,x.lng]),{padding:[24,24],maxZoom:11});
 }
}
$('category').addEventListener('change',render);
window.addEventListener('hashchange',()=>{const id=decodeURIComponent(location.hash.slice(1));if(rows.some(x=>x.id===id)&&!document.getElementById(id)){$('category').value='';render();document.getElementById(id)?.scrollIntoView({block:'start'});}});
document.addEventListener('error',e=>{if(e.target.tagName==='IMG'){const p=document.createElement('p');p.className='photo-error';p.textContent='Фото временно не загрузилось — открой объявление';e.target.replaceWith(p);}},true);
(async()=>{try{
 const res=await fetch('data/midwest-shortlist-2026-11-23.json',{cache:'no-cache'});if(!res.ok)throw Error('HTTP '+res.status);rows=Midwest.normalize(await res.json());
 if(typeof L!=='undefined'){map=L.map('airport-map',{scrollWheelZoom:true});L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);layer=L.layerGroup().addTo(map);}
 else $('airport-map').textContent='Карта временно не загрузилась; карточки и адреса доступны ниже.';
 render();if(location.hash){const el=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(el)el.scrollIntoView({block:'start'});}
}catch(e){$('totals').textContent='Подборка не загрузилась. Обнови страницу; JSON доступен по ссылке внизу.';console.error(e);}})();
