const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const Sicily=require('node:vm').runInNewContext(fs.readFileSync(path.join(__dirname,'../sicily.js'),'utf8')+'\nSicily;');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/sicily.json'),'utf8'));
const rows=data.listings.map(Sicily.normalize);
test('EUR snapshot keeps all distinct lots and excludes conflicting price by default',()=>{
 assert.equal(rows.length,14);assert.equal(new Set(rows.map(x=>x.id)).size,14);
 assert.equal(rows.filter(x=>Sicily.eligible(x,10000,false)).length,13);
 assert.equal(rows.filter(x=>Sicily.eligible(x,10000,true)).length,14);
 assert.equal(rows.filter(x=>Sicily.eligible(x,5000,false)).length,9);
 assert(rows.every(x=>x.price_currency==='EUR'));
 const lots=rows.filter(x=>x.group_id==='35811997');assert.equal(lots.length,3);
 assert.deepEqual(lots.map(x=>x.price).sort((a,b)=>a-b),[2000,3000,3600]);
 assert.equal(lots.reduce((a,x)=>a+x.land_m2,0),3668);
 const hold=rows.find(x=>x.price_conflict);assert(hold.review_hold);
 assert.match(Sicily.price(hold,(v,c)=>c+' '+v),/EUR 5000 \/ EUR 11500.*HOLD/);
 assert(!rows.some(x=>x.source_id==='662494190'));
});
test('municipality pins never replace unknown property coordinates or repair evidence',()=>{
 assert.equal(rows.filter(x=>x.coord_precision==='municipality_approximate').length,13);
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
 assert.equal(rows.filter(x=>x.image_url).length,12);
 for(const x of rows){
  assert(x.first_seen);assert(x.price_history.length);
  if(!x.image_url){assert.equal(x.photo_status,'listing_has_no_photos');continue;}
  const content=fs.readFileSync(path.join(__dirname,'..',x.image_url));
  assert(path.basename(x.image_url).startsWith(crypto.createHash('sha256').update(content).digest('hex').slice(0,20)));
  assert(x.photo_history.some(p=>p.path===x.image_url&&p.source===x.image_source_url));
 }
});
