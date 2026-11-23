const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const source=JSON.parse(fs.readFileSync(path.join(root,'data/midwest-shortlist-2026-11-23.json'),'utf8'));
const context=vm.createContext({});
for(const name of ['map-groups','availability','midwest-data'])vm.runInContext(fs.readFileSync(path.join(root,name+'.js'),'utf8'),context);
const M=vm.runInContext('Midwest',context),A=vm.runInContext('Availability',context),G=vm.runInContext('MapGroups',context);
const now=Date.parse('2026-11-23T03:00:00Z');

test('broader research keeps real houses without confirmed garages or repair permission',()=>{
 const before=JSON.stringify(source),rows=M.normalize(source);
 assert.equal(rows.length,22);assert.equal(rows.filter(x=>x.kind==='house').length,8);
 assert.equal(rows.filter(x=>x.kind==='house'&&x.existing_garage).length,4);
 for(const row of rows){
  assert.ok(row.price>=3000&&row.price<=20000);assert.equal(row.personal_repair,'unknown');
  assert.equal(row.verified_full_match,false);assert.equal(row.score,null);
  assert.equal(row.first_seen,row.research_record.first_seen);assert.equal(A.isCurrent(row,now),true);
  assert.equal(G.classify(row),'airport');
 }
 assert.equal(JSON.stringify(source),before);
 assert.equal(M.normalize(null).length,0);
});

test('freshness and closed status still apply to manual research and are never fabricated by normalization',()=>{
 const row=source.candidates[0];
 const closed=M.normalize({candidates:[{...row,status:'closed'}]})[0];
 assert.equal(A.visible(closed,true,now),false);
 const old=M.normalize({candidates:[{...row,last_verified:'2026-08-01',status_basis:'indexed_public_page'}]})[0];
 assert.equal(A.visible(old,false,now),false);assert.equal(A.visible(old,true,now),true);
 assert.equal(source.exclusions.find(x=>x.title.includes('Gateway')).status,'closed');
});

test('all new photos preserve their original bytes and source provenance; IDs do not collide',()=>{
 const national=JSON.parse(fs.readFileSync(path.join(root,'data/listings.json'),'utf8')).listings;
 const pa=JSON.parse(fs.readFileSync(path.join(root,'data/airport-shortlist-2026-11-23.json'),'utf8')).candidates;
 const all=[...national,...pa,...source.candidates];
 assert.equal(new Set(all.map(x=>x.id)).size,all.length);
 for(const x of source.candidates){
  assert.match(x.url,/^https:\/\//);assert.match(x.image_url,/^assets\/listings\/[0-9a-f]{20}\.(jpg|webp|png)$/);
  const bytes=fs.readFileSync(path.join(root,x.image_url)),photo=x.photo_history[0];
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),photo.sha256);
  assert.equal(photo.path,x.image_url);assert.equal(photo.remote_url,x.image_remote_url);
  assert.match(photo.source,/^https:\/\//);
 }
});

test('approximate locators retain null parcel coordinates and explicit warnings',()=>{
 const rows=M.normalize(source),lot=rows.find(x=>x.mls==='12143914');
 assert.equal(lot.research_record.location.lat,null);
 assert.equal(lot.coord_precision,'community_approximate');assert.match(lot.research_record.location.note_ru,/не подтверждены/);
 assert.equal(rows.find(x=>x.mls==='12806426').coord_precision,'address_geocoded');
 const noPoint=M.normalize({candidates:[{...source.candidates[0],location:{lat:null,lon:null,reference:null}}]})[0];
 assert.equal(G.validPoint(noPoint.lat,noPoint.lng),false);assert.equal(noPoint.gateways.length,0);
});
