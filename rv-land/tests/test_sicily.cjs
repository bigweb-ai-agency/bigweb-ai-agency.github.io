const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const Sicily=require('node:vm').runInNewContext(fs.readFileSync(path.join(__dirname,'../sicily.js'),'utf8')+'\nSicily;');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/sicily.json'),'utf8'));
const rows=data.listings.map(Sicily.normalize);
test('EUR snapshot keeps all distinct lots and excludes conflicting price by default',()=>{
 assert.equal(rows.length,32);assert.equal(new Set(rows.map(x=>x.id)).size,32);
 assert.equal(rows.filter(x=>Sicily.eligible(x,10000,false)).length,31);
 assert.equal(rows.filter(x=>Sicily.eligible(x,10000,true)).length,32);
 assert.equal(rows.filter(x=>Sicily.eligible(x,5000,false)).length,13);
 assert(rows.every(x=>x.price_currency==='EUR'));
 const lots=rows.filter(x=>x.group_id==='35811997');assert.equal(lots.length,3);
 assert.deepEqual(lots.map(x=>x.price).sort((a,b)=>a-b),[2000,3000,3600]);
 assert.equal(lots.reduce((a,x)=>a+x.land_m2,0),3668);
 assert(!Sicily.area(lots[0]).includes('не указана'));assert.match(Sicily.area(lots[0]),/Земля:/);
 const hold=rows.find(x=>x.price_conflict);assert(hold.review_hold);
 assert.match(Sicily.price(hold,(v,c)=>c+' '+v),/EUR 5000 \/ EUR 11500.*HOLD/);
 assert(!rows.some(x=>x.source_id==='662494190'));
});
test('municipality pins never replace unknown property coordinates or repair evidence',()=>{
 assert.equal(rows.filter(x=>x.coord_precision==='municipality_approximate').length,31);
 for(const x of rows){
  assert.equal(x.personal_repair,'unknown');assert.equal(x.rv_storage,'unknown');assert.equal(x.rv_occupancy,'unknown');
  assert.equal(x.research.map_coordinates.verified_boundary,false);
  if(x.coord_precision==='municipality_approximate'){assert.equal(x.research.coordinates,null);assert.match(Sicily.position(x),/не участок/);}
 }
 const b=rows.find(x=>x.city==='Biancavilla');assert.equal(b.lat,37.708077);assert.equal(b.lng,14.918396);
 assert.equal(b.electricity,'none');assert.equal(b.water,'none');assert.equal(b.research.other_water,'cistern_claimed');
 assert.match(b.research.access_ru,/невозможен/);assert.match(b.research.risk_ru,/sanatoria не завершена/);
 const g=rows.find(x=>x.city==='Bagheria');assert.equal(g.electricity,'on_site_claim');assert.equal(g.water,'on_site_claim');
 const p=rows.find(x=>x.city==='Partinico');assert.equal(p.electricity,'unknown');assert.equal(p.water,'unknown');
});
test('all supplied photographs are retained byte-for-byte with provenance; missing photos stay missing',()=>{
 assert.equal(rows.filter(x=>x.image_url).length,30);
 for(const x of rows){
  assert(x.first_seen);assert(x.price_history.length);
  if(!x.image_url){assert.equal(x.photo_status,'listing_has_no_photos');continue;}
  const content=fs.readFileSync(path.join(__dirname,'..',x.image_url));
  assert(path.basename(x.image_url).startsWith(crypto.createHash('sha256').update(content).digest('hex').slice(0,20)));
  assert(x.photo_history.some(p=>p.path===x.image_url&&p.source===x.image_source_url));
 }
});

test('residential filters use explicit inclusion, not unknown garages or future conversions',()=>{
 const added=rows.filter(x=>x.observed_on==='2026-10-09');assert.equal(added.length,18);
 assert.equal(added.filter(x=>Sicily.matchesResidential(x,'house',false)).length,12);
 assert.equal(added.filter(x=>Sicily.matchesResidential(x,'apartment',false)).length,6);
 assert.equal(rows.filter(x=>Sicily.matchesResidential(x,'house',false)).length,13); // Existing Bompietro house remains discoverable.
 const garages=rows.filter(x=>Sicily.matchesResidential(x,'',true));assert.equal(garages.length,5);
 assert.equal(rows.filter(x=>Sicily.matchesResidential(x,'apartment',true)).length,0);
 for(const x of added){
  assert.equal(x.electricity,'unknown');assert.equal(x.water,'unknown');
  assert.equal(x.coord_precision,'municipality_approximate');assert.equal(x.coordinates,null);
  assert.equal(x.garage_included_claim,x.research.garage_included_claim);
  if(!x.existing_garage)assert.equal(x.garage_included_claim,null);
 }
 for(const x of garages){assert.equal(x.research.garage_door_height_m,null);assert.equal(x.research.garage_vehicle_access,null);assert.equal(x.personal_repair,'unknown');}
 const lentini=rows.find(x=>x.id==='sicily-casa-52704444');assert.equal(lentini.building_m2,116);assert.equal(lentini.garage_m2,58);assert.match(lentini.risk_ru,/включает гараж/);
 const apartment=rows.find(x=>x.id==='sicily-casa-54077243');assert.notEqual(apartment.lat,37.708077);
 const palermo=rows.find(x=>x.id==='sicily-casa-49723281');assert.match(palermo.other_water,/1000L/);assert.equal(palermo.water,'unknown');
});
