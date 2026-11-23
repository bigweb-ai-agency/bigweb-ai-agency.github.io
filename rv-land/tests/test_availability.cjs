const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const A=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../availability.js'),'utf8')+'\nAvailability;');
const now=Date.parse('2026-11-23T10:00:00Z');
const active={status:'active',status_basis:'live_public_page',last_verified:'2026-11-22T12:00:00Z'};
test('sold and withdrawn records never return, including with archive enabled',()=>{
 for(const status of ['sold','SOLD','off_market','Off Market','withdrawn','closed','expired']){
  assert.equal(A.visible({...active,status},false,now),false,status);
  assert.equal(A.visible({...active,status},true,now),false,status+' archive');
 }
 assert.equal(A.visible({...active,country:'IT',status:'sold'},true,now),false);
});
test('default US search requires fresh live active status; pending and stale evidence require archive',()=>{
 assert.equal(A.visible(active,false,now),true);
 for(const change of [{status:'pending'},{status:'unknown'},{status_basis:'indexed_public_page'},{status_basis:'legacy_unrechecked'},{last_verified:'2026-10-01'},{last_verified:null}]){
  const x={...active,...change};assert.equal(A.visible(x,false,now),false);assert.equal(A.visible(x,true,now),true);
 }
});
test('old sale history and ordinary sold-together wording do not falsely remove a current relisting',()=>{
 const x={...active,status_history:[{to:'sold',date:'2025-02-01'},{to:'active',date:'2026-11-22'}],evidence_quote:'two lots sold together'};
 assert.equal(A.visible(x,false,now),true);
 assert.equal(A.visible({country:'IT',status:'unknown'},false,now),true);
});
