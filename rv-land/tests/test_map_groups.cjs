const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const G=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../map-groups.js'),'utf8')+'\nMapGroups;');
const airport=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/airport-shortlist-2026-11-23.json'),'utf8'));
test('geographic groups have explicit precedence and do not infer repair permission',()=>{
 const x={...G.origin,id:'lc-15893',airport_shortlist:true,existing_garage:true,personal_repair:'unknown',gateways:[{straight_km:1}]};
 assert.equal(G.classify(x),'point');assert.equal(x.personal_repair,'unknown');
 assert.equal(G.classify({...x,lat:39,lng:-80}),'airport');
 assert.equal(G.classify({id:'lc-15893',lat:39,lng:-100}),'priority');
 assert.equal(G.classify({lat:39,lng:-100}),'other');
 assert.equal(G.classify({...x,country:'IT'}),null);
});
test('150km groups reject invalid coordinates, unknown distances and farther airports',()=>{
 assert.equal(G.distance(G.origin,G.origin),0);
 assert.equal(G.distance(G.origin,{lat:null,lng:0}),null);
 assert.equal(G.distance(G.origin,{lat:120,lng:0}),null);
 assert.equal(G.classify({gateways:[{straight_km:null}]}),'other');
 assert.equal(G.classify({gateways:[{straight_km:150.01}]}),'other');
 assert.equal(G.classify({gateways:[{straight_km:-1}]}),'other');
 assert.equal(G.classify({gateways:[{straight_km:150}]}),'airport');
});
test('manual airport overlay preserves evidence, null parcel coordinates and original source histories',()=>{
 const before=JSON.stringify(airport),rows=G.normalizeShortlist(airport);
 assert.equal(rows.length,2);
 const national=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/listings.json'),'utf8')).listings;
 assert.equal(new Set([...national,...rows].map(x=>x.id)).size,national.length+rows.length);
 for(const x of rows){
  const source=airport.candidates.find(y=>y.id===x.id);
  assert.equal(x.price,source.price);assert.equal(x.first_seen,source.first_seen);
  assert.equal(x.last_verified,source.checked_at);assert.equal(x.image_url,source.image_url);
  assert.equal(x.personal_repair,'unknown');assert.equal(x.rv_storage,'unknown');assert.equal(x.score,null);
  assert.equal(x.airport_record,source);assert.equal(G.classify(x),'airport');
 }
 const d=rows.find(x=>x.anchor==='dunbar');assert.equal(d.airport_record.location.lat,null);
 assert.equal(d.lat,d.airport_record.location.reference.lat);
 assert.equal(d.coord_precision,'portal_map_reference_unverified');
 assert.equal(d.airport_record.road.endpoint_verified,false);
 assert.equal(JSON.stringify(airport),before);
 assert.equal(G.normalizeShortlist(null).length,0);
});
