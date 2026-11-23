'use strict';
fetch('data/airport-shortlist-2026-11-23.json').then(r=>{if(!r.ok)throw new Error('data');return r.json();}).then(data=>{
 for(const x of data.candidates){const card=document.getElementById(x.anchor);if(card)card.hidden=Availability.isClosed(x);}
 const candidates=data.candidates.filter(x=>!Availability.isClosed(x));
 if(typeof L==='undefined')throw new Error('map');
 const map=L.map('airport-map',{scrollWheelZoom:true}).setView([40.49,-80.0],8),bounds=[];
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
 const airport=[data.airport.lat,data.airport.lon];bounds.push(airport);
 L.circleMarker(airport,{radius:9,color:'#173f39',fillColor:'#173f39',fillOpacity:1}).addTo(map).bindPopup('Pittsburgh International · PIT');
 for(const x of candidates){
  const p=x.location.reference,point=[p.lat,p.lon];bounds.push(point);
  const popup=document.createElement('div'),title=document.createElement('b'),note=document.createElement('p'),link=document.createElement('a');
  title.textContent=x.title+' · $'+x.price.toLocaleString('en-US');
  note.textContent=x.location.note_ru;link.textContent='Фото и условия →';link.href='#'+x.anchor;
  popup.append(title,note,link);
  L.circleMarker(point,{radius:10,color:'#7849a7',weight:3,dashArray:'4 4',fillColor:'#f5effb',fillOpacity:.85}).addTo(map).bindPopup(popup);
  L.polyline([airport,point],{color:'#6d8275',weight:1,dashArray:'4 7'}).addTo(map);
 }
 map.fitBounds(bounds,{padding:[35,35]});
 document.getElementById('map-status').textContent='PIT и '+candidates.length+' ориентиров. Проданные и снятые скрыты. Пунктир ≈ точка объявления; пригодность RV и границы не подтверждены.';
}).catch(()=>{document.getElementById('map-status').textContent='Карта не загрузилась. Фотографии, адреса и источники доступны ниже.';});
