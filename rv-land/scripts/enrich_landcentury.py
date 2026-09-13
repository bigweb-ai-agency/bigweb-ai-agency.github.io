"""Read discovered public detail pages before accepting prices and photographs."""
import argparse
import json
from collect_landcentury import CACHE, Reader, property_url

def priority(p):
    info=p.get('info') or {}
    road=str(info.get('roadAccess') or '').lower()
    score=10 if p.get('type') != 'land' else 0
    score+= 2 if 'paved' in road else 1 if 'dirt' in road else 0
    score+=min(float(info.get('sizeAcres') or 0),5)/5
    return score

def run(args):
    discovery=json.loads((CACHE.parent/'discovery.json').read_text(encoding='utf-8'))
    out=CACHE.parent/'lc-selected.json'
    results=json.loads(out.read_text(encoding='utf-8')) if out.exists() else {}
    reader=Reader(args.fresh)
    for state, data in discovery.items():
        pool=[p for p in data['properties'] if 300000 <= (p.get('cashPrice') or 0) <= 1500000 and not p.get('isSold') and not p.get('isAuction')]
        pool.sort(key=priority,reverse=True)
        # Include enough headroom for duplicate/price/physical-access rejection.
        for p in pool[:args.limit]:
            url=p['_source_url']
            try:
                item=reader.read(url)
                prop=item['data']['property']
                prop['_source_url']=url
                prop['_fetched_at']=item['fetched_at']
                results[str(prop['id'])]=prop
            except Exception as e:
                print('DETAIL ERROR',state,p['id'],str(e)[:120],flush=True)
        out.write_text(json.dumps(results,ensure_ascii=False),encoding='utf-8')
        print(state,'details',len(pool[:args.limit]),flush=True)

if __name__=='__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('--limit',type=int,default=18)
    ap.add_argument('--fresh',action='store_true')
    run(ap.parse_args())
