const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
const sandbox={module:{exports:{}}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../rvs.js'),'utf8'),sandbox);
const rv=sandbox.module.exports;
const base=path.join(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(base,'data/rvs.json'),'utf8'));
const now=Date.parse(data.updated_at);
test('Only fresh active motorhomes are current, regardless of price and attractive photos',()=>{
 const sample={...data.listings.find(r=>r.status==='active'),last_checked:data.updated_at};
 assert.equal(rv.current(sample,now),true);
 for(const status of ['sold','removed','pending','closed'])assert.equal(rv.current({...sample,status},now),false);
 assert.equal(rv.current({...sample,last_checked:new Date(now-15*86400000).toISOString()},now),false);
 assert.equal(rv.current({...sample,verification:'indexed_public_page'},now),false);
 assert.equal(rv.current({...sample,self_propelled:false},now),false);
 assert.equal(rv.current({...sample,price:30001},now),false);
 assert.equal(rv.current({...sample,map_eligible:false},now),false);
 assert.equal(rv.current({...sample,photo_review:{kind:'dealer_advertisement'}},now),false);
});
test('Unknown year, mileage, engine and condition do not silently exclude a real bus conversion',()=>{
 const unknown=data.listings.find(x=>x.id==='rv-cl-8004787788');
 assert.equal(rv.matches(unknown,{maxPrice:'30000'}),true);
 assert.equal(rv.matches(unknown,{minYear:'2000'}),false);
 assert.equal(rv.matches(unknown,{class:'conversion'}),true);
 assert.equal(rv.matches(unknown,{seller:'dealer'}),false);
});
test('Local and distant offers stay separate; city filter cannot reclassify Madison as local',()=>{
 const ids=['rv-cl-7994079612','rv-cl-7988581980','rv-cl-8002328817'];
 const fixtures=ids.map(id=>({...data.listings.find(r=>r.id===id),status:'active',last_checked:data.updated_at}));
 const result=rv.partition(fixtures,{distance:'150',distant:true},now);
 assert.equal(result.local.length,2);assert.equal(result.far.length,1);
 assert.equal(result.far[0].id,'rv-cl-7988581980');assert.ok(result.far[0].distances_km.ORD>150);
 assert.equal(rv.partition(fixtures,{airport:'MSP',distance:'150',distant:true},now).local.length,1);
 assert.equal(rv.partition(fixtures,{class:'B',maxPrice:'10000',distance:'150'},now).local.length,1);
 assert.equal(rv.partition(fixtures,{distance:'150',distant:false},now).far.length,0);
});
test('November recheck preserves closed listings and merges the Landau repost with its original identity',()=>{
 const closed=['rv-cl-7988623641','rv-cl-7994079612','rv-cl-8003886861','rv-cl-7988581980'];
 for(const id of closed){const row=data.listings.find(r=>r.id===id);assert.equal(rv.current(row,now),false);assert.equal(row.status,'removed');assert.ok(row.photos.length&&row.price_history.length);}
 const landau=data.listings.find(r=>r.id==='rv-cl-8003442336');
 assert.equal(landau.source_id,'8005259997');assert.equal(landau.price,9000);
 assert.equal(landau.first_seen.slice(0,10),'2026-11-23');
 assert.ok(landau.price_history.some(p=>p.price===12500));
 assert.equal(data.listings.filter(r=>r.source_id==='8005259997').length,1);
 assert.ok(landau.listing_history.some(x=>x.source_id==='8003442336'&&x.status==='removed'));
 const stockLead=data.leads.find(x=>x.id==='rv-lead-cruise-851820');
 assert.equal(stockLead.map_eligible,false);assert.equal(data.listings.some(r=>r.vin===stockLead.vin),false);
 assert.equal(rv.dateLabel(data.updated_at),'26.11.2026');
});
test('Stable identities, public VIN deduplication and photo provenance/bytes are valid',()=>{
 const ids=new Set(),vins=new Set();
 for(const r of data.listings){
  assert.ok(!ids.has(r.id));ids.add(r.id);assert.ok(r.price>0&&r.price<=30000);assert.equal(r.currency,'USD');
  assert.ok(r.first_seen&&r.last_checked&&r.price_history.length&&r.status_history.length&&r.photo_history.length);
  if(r.vin){assert.ok(!vins.has(r.vin));vins.add(r.vin);assert.match(r.vin,/^[A-HJ-NPR-Z0-9]{17}$/);}
  for(const value of r.location.coordinates)assert.ok(Number.isFinite(value));
  if(r.map_eligible!==false)assert.ok(r.photos.length>0);
  for(const photo of r.photos){
   assert.ok(photo.source_url.startsWith('https://'));assert.equal(photo.listing_url,r.url);assert.equal(photo.unaltered,true);
   const bytes=fs.readFileSync(path.join(base,photo.path));assert.equal(bytes.length,photo.bytes);
   assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),photo.sha256);
  }
 }
});
test('Dealer advertising images cannot masquerade as RV photographs on the map',()=>{
 for(const id of ['rv-autotrader-300691349','rv-autotrader-300691350']){
  const row=data.listings.find(r=>r.id===id);
  assert.equal(row.status,'review_hold');assert.equal(row.sale_status,'active');assert.equal(rv.current(row,now),false);
  assert.equal(row.map_eligible,false);assert.equal(row.photo_review.kind,'dealer_advertisement');
  assert.equal(row.photos.length,0);assert.ok(row.photo_history.length);
  assert.ok(data.leads.some(x=>x.vehicle_id===id));
 }
});
