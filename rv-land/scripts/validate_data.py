"""Targeted publish gate: real URLs/images, valid money/coordinates, retention."""
import json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_data import ROOT,DATA,read

def validate():
    d=read(DATA/'listings.json',{});rows=d.get('listings',[])
    assert d.get('schema_version')==2 and rows,'Missing established database'
    ids=[x['id'] for x in rows];assert len(set(ids))==len(ids),'Duplicate IDs'
    originals=read(ROOT/'listings.json',{}).get('listings',[])+read(ROOT/'listings-flight.json',{}).get('listings',[])
    assert {x['id'] for x in originals}<=set(ids),'An original record was lost'
    for x in rows:
        assert x['url'].startswith('https://'),x['id']+' unsafe URL'
        assert isinstance(x.get('price'),(int,float)) and x['price']>0,x['id']+' bad cash price'
        if not x.get('legacy'):
            assert x.get('image_url','').startswith(('https://','data:image/','assets/listings/')),x['id']+' missing image'
            assert 18<=x['lat']<=72 and -180<=x['lng']<=-65,x['id']+' bad coordinates'
        if (x.get('image_url') or '').startswith('assets/'):
            photo=(ROOT/x['image_url']).resolve()
            assert photo.is_relative_to(ROOT.resolve()/'assets'/'listings') and photo.is_file(),x['id']+' missing preserved image'
        assert isinstance(x.get('price_history'),list),x['id']+' missing price history'
        assert x.get('personal_repair') in ('unknown','seller_claim','authority_confirmed','restriction_risk'),x['id']+' invalid repair flag'
    states=read(DATA/'states.json',{}).get('states',[])
    assert len(states)==50 and len({s['code'] for s in states})==50,'Incomplete state audit'
    assert len(read(DATA/'flights.json',{}).get('origins',[]))>=4,'Missing origin comparison'
    print('Validated',len(rows),'retained listings,',sum(bool(x.get('image_url')) for x in rows),'photos, 50 states, all',len(originals),'original IDs.')

if __name__=='__main__':validate()
