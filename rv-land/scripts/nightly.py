"""Bounded, append-only nightly public-source ingestion.

Initial indexed research is already in the committed database. It is not replayed.
Known records refresh in age order; failures preserve their previous factual state.
"""
import argparse, datetime as dt, os, sys
from collect_landcentury import Reader, STATES, slug, property_url, CACHE
from build_data import DATA, read, write, landcentury_records, acceptable, merge_records, NOW
from make_analysis import run as analyze
from cache_photos import preserve, require_new_photos

def run(args):
    old=read(DATA/'listings.json',{}).get('listings',[])
    if not old:raise RuntimeError('Refusing to replace an absent or empty established database')
    reader=Reader(fresh=not args.cached)
    known_urls={x['url'] for x in old}
    pool={}
    errors=[];scanned=0
    codes=args.states.split(',') if args.states else list(STATES)
    for code in codes:
        for group in ('land-for-sale','houses-and-buildings'):
            for page in range(1,args.pages+1):
                url='https://www.landcentury.com/'+group+'/'+slug(STATES[code])+ ('?page='+str(page) if page>1 else '')
                try:
                    item=reader.read(url);data=item['data']['data'];scanned+=1
                    for p in data.get('properties',[]):
                        if p.get('stateRegion')!=STATES[code]:continue
                        if not 300000<=(p.get('cashPrice') or 0)<=1500000 or p.get('isAuction'):continue
                        pool[property_url(p)]=p
                    if len(data.get('properties',[]))<int(data.get('limit',25)):break
                except Exception as e:
                    errors.append({'url':url,'error':str(e)[:160]});break
            if reader.blocked:break
        if reader.blocked:break
    new=sorted((p for u,p in pool.items() if u not in known_urls),key=lambda p:p.get('created_at',''),reverse=True)
    refresh=sorted([x for x in old if x.get('source')=='LandCentury' and x['state'] in codes],key=lambda x:x.get('last_verified') or '')
    urls=[property_url(p) for p in new[:args.new_limit]]+[x['url'] for x in refresh[:args.refresh_limit]]
    details={}
    for url in dict.fromkeys(urls):
        if reader.blocked:break
        try:
            item=reader.read(url);p=item['data']['property'];p['_source_url']=url;p['_fetched_at']=item['fetched_at'];details[str(p['id'])]=p
        except Exception as e:errors.append({'url':url,'error':str(e)[:160]})
    # This file contains only observations from this run, never stale inherited cache rows.
    write(CACHE.parent/'lc-selected.json',details)
    incoming=[];rejected=[]
    for x in landcentury_records():
        issue=acceptable(x);x.pop('_description',None)
        if not issue or x['url'] in known_urls:
            if not issue or issue not in ('location_unresolved','coordinates_outside_us'):
                incoming.append(x)
        else:rejected.append({'url':x['url'],'reason':issue,'price':x['price'],'state':x['state']})
    merged=merge_records(old,incoming)
    corrections=read(DATA/'corrections.json',{})
    for x in merged:
        # Reviewed static context persists, but a newer source observation may change
        # price/status. Do not freeze a snapshot of availability in corrections.
        for k,v in corrections.get(x['id'],{}).items():
            if k not in ('price','total_known','status','status_basis','source_crawled','last_verified','image_url','image_source_url'):x[k]=v
    merged,photo_counts=preserve(merged)
    merged,photo_rejected=require_new_photos(old,merged)
    rejected.extend(photo_rejected)
    added=len(merged)-len(old)
    old_by={x['id']:x for x in old}
    material=sum(x['id'] in old_by and (x.get('price'),x.get('status'),x.get('image_url'))!=(old_by[x['id']].get('price'),old_by[x['id']].get('status'),old_by[x['id']].get('image_url')) for x in merged)
    write(DATA/'listings.json',{'schema_version':2,'updated_at':NOW,'listings':merged})
    analyze()
    previous=read(DATA/'monitor.json',{})
    run_url=('https://github.com/'+os.environ['GITHUB_REPOSITORY']+'/actions/runs/'+os.environ['GITHUB_RUN_ID']) if os.environ.get('GITHUB_RUN_ID') else None
    status='blocked' if reader.blocked else 'partial' if errors else 'ok'
    event={'date':NOW,'status':status,'scanned_pages':scanned,'read_details':len(details),'added':added,'changed':material,'errors':len(errors)}
    result={'schedule':'Ежедневно 00:37 UTC: 03:37 летом / 02:37 зимой по Вильнюсу. GitHub Actions может запускаться с задержкой.',
        'last_run':NOW,'status':status,'run_url':run_url,'summary':str(added)+' новых; '+str(material)+' изменений цены/статуса/фото; '+str(len(details))+' страниц проверено; ошибок '+str(len(errors))+'.',
        'scope':'LandCentury: новые страницы всех 50 штатов и ротация старых записей. LandSearch и старые MLS — отдельная исследовательская проверка, не автоматический live-статус.',
        'events':(previous.get('events',[])+[event])[-90:],'source_errors':errors[:20],'rejected':rejected,'photo_preservation':photo_counts}
    write(DATA/'monitor.json',result)
    print(result['summary'],status,flush=True)
    # Publish the diagnostic result even on a source outage, then make the job visibly fail.
    return 2 if reader.blocked or (scanned==0 and errors) else 0

if __name__=='__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('--states',help='Bounded verification; omitted in daily run')
    ap.add_argument('--pages',type=int,default=2)
    ap.add_argument('--new-limit',type=int,default=60)
    ap.add_argument('--refresh-limit',type=int,default=60)
    ap.add_argument('--cached',action='store_true',help='Offline cache replay for tests; never used in scheduled workflow')
    sys.exit(run(ap.parse_args()))
