"""Normalize researched facts, retain history, and build the static application data.

No inference here converts a seller's RV claim into a legal repair permission.
Raw cached descriptions are never published.
"""
import argparse
import collections
import datetime as dt
import json
import math
import re
from pathlib import Path
from bs4 import BeautifulSoup
from collect_landcentury import ROOT, STATES, slug

NOW=dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')
TODAY=NOW[:10]
DATA=ROOT/'data'
CACHE=ROOT/'.cache'
STATE_CODES={v:k for k,v in STATES.items()}

def read(path,default=None):
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else default

def write(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    content=json.dumps(value,ensure_ascii=False,indent=2)+'\n'
    if not path.exists() or path.read_text(encoding='utf-8')!=content:
        path.write_text(content,encoding='utf-8',newline='\n')

def compact(text):
    return re.sub(r'\s+',' ',str(text or '')).strip()

def plain(text):
    text=re.sub(r'cite\d+†([^]+)',lambda m:m[1].split('†')[0],text)
    return re.sub(r'L\d+:\s?', '\n', text)

def number(value):
    try:return float(str(value).replace(',','').strip())
    except (ValueError,TypeError):return None

def matchvalue(text,pattern,default=None):
    m=re.search(pattern,text,re.I)
    return compact(m[1]) if m else default

def flags_from_text(description,kind='land',road=None,utilities=None):
    t=compact(description).lower()
    result={
        'rv_storage':'unknown','rv_occupancy':'unknown','personal_repair':'unknown',
        'commercial_repair':'unknown','existing_garage':False,'garage_size':None,
        'electricity':'unknown','water':'unknown','sewer':'unknown','no_hoa':'unknown',
        'road_access':'unknown','flags':[],'evidence_quote':None,
    }
    if re.search(r'no\s+(?:rvs?\b|campers?\b)|rvs?.{0,15}not (?:permitted|allowed)',t):
        result['rv_occupancy']='seller_no'
        result['flags'].append('Продавец указывает ограничение на RV; хранение и ремонт проверить отдельно.')
    elif re.search(r'\b(rv|camper|recreational vehicle).{0,65}(allowed|permitted|welcome|approved)|(?:live|living|stay|camp).{0,30}(?:rv|camper)',t):
        result['rv_occupancy']='seller_claim'
        if re.search(r'while (?:you )?build|temporary|\d+ days|permit|seasonal',t):
            result['rv_occupancy']='seller_conditional'
    if re.search(r'(?:park|store|storage).{0,35}(?:rv|camper)|(?:rv|camper).{0,35}(?:parking|storage)',t):
        result['rv_storage']='seller_claim'
    if re.search(r'no (?:hoa|homeowners? association)|without (?:an? )?hoa|hoa\s*[:\-]?\s*(?:none|no|\$0)',t):
        result['no_hoa']='seller_claim'
    # Explicit existing garage phrasing only. A future workshop or generic site category is insufficient.
    garage=re.search(r'(?:detached|attached|existing|\d[ -]car|\d+\s*[x×]\s*\d+)\s+(?:\w+\s+){0,2}garage|garage\s*[:\-]\s*(?:detached|attached|\d)',t)
    if garage and kind!='land' and not re.search(r'no (?:existing )?garage|garage (?:was |has been )?(?:removed|demolished)',t):
        result['existing_garage']=True
        result['garage_size']=matchvalue(t,r'(\d+\s*[x×]\s*\d+\s*(?:ft|foot|feet)?\s*garage)')
    if re.search(r'personal (?:vehicle |auto )?repair|private (?:vehicle |auto )?repair',t):
        result['personal_repair']='seller_claim'
    if re.search(r'auto(?:mobile)? repair (?:shop|business)|mechanic(?:s|\x27s)? shop',t) and kind in ('commercial','workshop','industrial'):
        result['commercial_repair']='seller_claim'
    rt=compact(road).lower()
    if re.search(r'landlocked|no (?:legal |road |vehicle |vehicular )?access|boat access only|fly.in only|water access only',t+' '+rt):
        result['road_access']='problem'
        result['flags'].append('Доступ для автомобиля не подтверждён или ограничен; физический проезд обязателен.')
    elif re.search(r'paved|dirt road|gravel road|road frontage|public road|county road|maintained road',t+' '+rt):
        result['road_access']='seller_claim'
    for tag,pat in [('electricity',r'(?:electric(?:ity)?|power)'),('water',r'(?:water)'),('sewer',r'(?:sewer|septic)')]:
        u=compact(utilities or '').lower()
        if re.search(r'no utilities|off.grid',u):
            result[tag]='none'
        if re.search(pat+r'.{0,35}(?:at (?:the )?(?:road|street|lot)|nearby|available|adjacent)|(?:at (?:the )?(?:road|street)|available).{0,30}'+pat,t+' '+u):
            result[tag]='available'
        if re.search(pat+r'.{0,25}(?:not available|none|not connected)|(?:no |without )'+pat,t+' '+u):
            result[tag]='none'
        if tag=='electricity' and re.search(r'(?:electric|power).{0,45}(?:meter|connected)|meter.{0,20}in place',t+' '+u):
            result[tag]='on_site_claim'
        if tag=='water' and re.search(r'(?:existing|operational|working) (?:water )?well|water[ /:]+connected',t+' '+u) and not re.search(r'water.{0,15}not connected',t+' '+u):
            result[tag]='on_site_claim'
        if tag=='sewer' and re.search(r'(?:existing|working|installed) septic|(?:sewer|septic)[ /:]+connected',t+' '+u) and not re.search(r'(?:sewer|septic).{0,15}not connected',t+' '+u):
            result[tag]='on_site_claim'
    risk_patterns=[
        (r'tax deed|quit.?claim','Налоговый/quitclaim deed: проверить право собственности, обременения и страхование титула.'),
        (r'flood (?:zone|plain|risk)|floodplain|floodway','В источнике есть указание на затопление: проверить FEMA и отметку площадки.'),
        (r'wetlands?|marsh|swamp','Упоминаются заболоченные земли; пригодность площадки требует проверки.'),
        (r'landlocked|boat access only|water access only','Нужен доказанный юридический и физический подъезд для 7-метрового RV.'),
        (r'hoa|covenants|subdivision|restrictions','Проверить действующие covenants/HOA, даже если зонирование выглядит подходящим.'),
        (r'steep|hillside|mountainous','Оценить уклон, разворот и стоимость ровной площадки.'),
        (r'fire damage|fire damaged|burned|condemned|demolition','Проверить аварийность, требования сноса и стоимость восстановления.'),
        (r'lava (?:zone|risk)','Проверить лавовую зону, доступ и возможность страхования.'),
    ]
    result['flags'] += [note for pat,note in risk_patterns if re.search(pat,t)]
    # One short quotation per source, bounded well below the quotation limit.
    m=re.search(r'[^.!?\n]*(?:RV|camper|garage|workshop|electric meter)[^.!?\n]*[.!?]?',description,re.I)
    if m: result['evidence_quote']=' '.join(compact(m[0]).split()[:22])
    return result

def base_record():
    return {'price_currency':'USD','price_basis':'asking_cash','first_seen':NOW,
        'last_seen':NOW,'last_verified':NOW,'photo_kind':'Изображение из объявления; может включать схему или вид окрестностей.',
        'personal_repair':'unknown','commercial_repair':'unknown','notes':[],
        'closing_costs':'Не включены: title/escrow/recording, обследования и подготовка площадки.'}

def clean_image_url(value):
    # Tool error text appends ": TimeoutError" to the actual href. It is punctuation,
    # not part of the source image URL.
    return re.sub(r'(\.(?:jpg|jpeg|png|webp)):$',r'\1',value or '',flags=re.I) or None

def landcentury_records():
    records=[]
    for p in read(CACHE/'lc-selected.json',{}).values():
        description=BeautifulSoup(p.get('description') or '', 'html.parser').get_text(' ',strip=True)
        price=(number(p.get('cashPrice')) or 0)/100 # Source stores monetary values in cents.
        fee=(number(p.get('processingFee')) or 0)/100
        declared=matchvalue(description,r'cash\s+price\s*[:\-]?\s*\$([\d,]+(?:\.\d{2})?)')
        if declared is not None:
            price=number(declared)
        docfee=matchvalue(description,r'\$([\d,]+(?:\.\d{2})?)\s*(?:non-refundable\s+)?(?:doc(?:ument)?(?:ation)?|processing)\s*fee')
        if docfee:fee=max(fee,number(docfee))
        info=p.get('info') or {}
        state=STATE_CODES.get(p.get('stateRegion'))
        image=(p.get('get_main_image') or {}).get('get_image') or (p.get('get_main_image') or {}).get('image') or {}
        if not isinstance(image,dict):image={}
        image_url=image.get('medium') or image.get('small') or image.get('large')
        kind='land' if p.get('type')=='land' else 'house'
        category=' '.join(x.get('slug','') for x in p.get('categories',[]))
        if 'commercial-and-industrial' in category:
            kind='commercial_lot' if kind=='land' else 'commercial'
        x=base_record()
        x.update({'id':'lc-'+str(p['id']), 'source_id':str(p['id']),'source':'LandCentury','url':p['_source_url'],
            'title':compact(p.get('street')) or compact(p.get('name')),'address':compact(p.get('street')),
            'city':p.get('city'),'state':state,'county':compact(p.get('county')).replace(' County',''),
            'zip':p.get('zip'),'kind':kind,'price':price,'known_fees':fee,'total_known':price+fee,
            'price_evidence':'cashPrice из публичной страницы; явная cash price в описании имеет приоритет.',
            'acres':number(info.get('sizeAcres')),'lat':number(p.get('lat')),'lng':number(p.get('lng')),
            'coord_precision':'listing','status':'sold' if p.get('isSold') else 'pending' if p.get('isReserved') else 'active' if p.get('isPublished') else 'off_market',
            'status_basis':'live_public_page','source_updated':p.get('updated_at'),'source_published':p.get('created_at'),
            'last_verified':p['_fetched_at'],'last_seen':p['_fetched_at'],
            'image_url':image_url,'image_source_url':p['_source_url'],'image_credit':'Seller / LandCentury',
            'parcel':p.get('parcelNumber'),'zoning':info.get('zoning') or 'Не указано',
            'road_note':info.get('roadAccess') or 'Не подтверждён', 'utility_note':info.get('utilities') or 'Не подтверждены',
            'taxes_note':info.get('taxes'),'source_categories':category.split(),
            'garage_note':'Размеры и состояние не подтверждены',
        })
        x.update(flags_from_text(description,kind,info.get('roadAccess'),info.get('utilities')))
        if p.get('isAuction'):x['price_basis']='auction_start'
        x['_description']=description
        records.append(x)
    return records

def landsearch_records():
    photos={}
    for f in sorted(CACHE.glob('ls-photos-*.json')): photos.update(read(f,{}))
    records=[]
    for f in sorted((CACHE/'ls-details').glob('*.txt')):
        for raw in re.split(r'-{30,}',f.read_text(encoding='utf-8')):
            url=matchvalue(raw,r'\((https://www\.landsearch\.com/properties/[^)]+)\)')
            if not url:continue
            content=plain(raw)
            address=matchvalue(content,r'\n##\s+([^\n]+)')
            if not address:continue
            location=re.search(r'^(.*),\s*(.*),\s*([A-Z]{2})\s+(\d{5})$',address)
            if not location:continue
            price=number(matchvalue(content,r'\n\$([\d,]+(?:\.\d{2})?)\s*\n'))
            acres=number(matchvalue(content,r'\n([\d,.]+) acres?\s*\n'))
            coordinates=re.search(r'Coordinates\s+(-?\d+\.\d+),\s*(-?\d+\.\d+)',content)
            desc=content.split('### Location')[0].split(address)[-1]
            details=content.split('#### Payment calculator')[0]
            primary_title=raw.strip().split('\n')[0]
            kind='commercial_lot' if 'Commercial Land' in primary_title else 'land'
            if re.search(r'\d+\s*(?:Sq Ft|Square Foot)|Land with Home|Land with House',primary_title,re.I):kind='house'
            if re.search(r'\n\d+\s*\n(?:Bedrooms|Beds)|\n\d[\d,]+\s*\nSq feet',desc,re.I):kind='house'
            if kind=='house' and 'Commercial' in primary_title:kind='commercial'
            x=base_record()
            x.update({'id':'ls-'+url.rstrip('/').split('/')[-1],'source_id':url.rstrip('/').split('/')[-1],
                'source':'LandSearch','url':url,'title':location[1], 'address':location[1],
                'city':location[2],'state':location[3],'zip':location[4],
                'county':matchvalue(content,r'\nCounty\s+([^\n]+?)(?: County)?\s*\n','Не указано'),
                'kind':kind,'price':price,'known_fees':0,'total_known':price,
                'price_evidence':'Показанная запрашиваемая цена; дополнительные сборы не подтверждены.',
                'acres':acres,'lat':float(coordinates[1]) if coordinates else None,
                'lng':float(coordinates[2]) if coordinates else None,'coord_precision':'listing' if coordinates else 'unknown',
                'status':'active' if 'Active sale' in desc else 'pending' if re.search(r'Under contract|Pending',desc,re.I) else 'sold' if re.search(r'\nSold',desc) else 'unknown',
                'status_basis':'indexed_public_page','source_crawled':matchvalue(raw,r'Crawled: ([^;]+)'),
                'image_url':clean_image_url(photos.get(url)),'image_source_url':url,'image_credit':'Listing broker / LandSearch',
                'parcel':matchvalue(details,r'### Parcels\s+\*\s*([^\n]+)'),
                'mls':matchvalue(details,r'MLS #\s+([^\n]+)'),
                'zoning':matchvalue(details,r'\nZoning\s+([^\n]+)','Не указано'),
                'taxes_note':matchvalue(details,r'### Property taxes\s+(\d{4}\s+\$[\d,.]+)'),
                'road_note':'Юридический подъезд не проверен','utility_note':'Состояние подключений требует проверки',
                'garage_note':'Размеры и состояние не подтверждены',
            })
            x.update(flags_from_text(desc,kind))
            # The page also shows an "Est $.../mo" mortgage calculator for cash sales.
            # Only the primary offer type/price can establish lease or auction pricing.
            if re.search(r'Active (?:auction|lease)|\nAuction\b|\n\$[\d,]+/mo',desc,re.I):x['price_basis']='auction_or_lease'
            x['_description']=desc
            records.append(x)
    return records

def legacy_records():
    base=read(ROOT/'listings.json',{}).get('listings',[])
    extra=read(ROOT/'listings-flight.json',{})
    photos_text=(ROOT/'photos.js').read_text(encoding='utf-8')
    photos=json.loads(photos_text.split('=',1)[1].strip().rstrip(';'))
    rows=[]
    for old in base+extra.get('listings',[]):
        old=dict(old,**extra.get('overrides',{}).get(old['id'],{}))
        x=base_record()
        kind={'house+garage':'house','commercial/industrial':'commercial_lot','commercial land':'commercial_lot','industrial land':'industrial_lot','tax-forfeited land':'land','large building':'building','storage/fixer':'building'}.get(old.get('kind'),old.get('kind','land'))
        x.update({k:v for k,v in old.items() if k not in ('score','region')})
        x.update({'kind':kind,'source':'Imported research','status_basis':'legacy_unrechecked',
            'first_seen':'2026-09-14T00:25:00+03:00','last_verified':old.get('verified'),
            'known_fees':0,'total_known':old.get('price'),'legacy':True,
            'source_crawled':'Исходный список ChatGPT; свежесть отдельных сведений проверять',
            'image_url':old.get('image_url') or photos.get(old['id']),
            'image_source_url':old['url'],'image_credit':'Original listing / preserved prior research',
            'coord_precision':old.get('coord_precision','legacy_unverified'),
            'zoning':old.get('restrictions','Не указано'),'garage_note':old.get('garage_workshop','Не указан'),
            'road_note':old.get('terrain','Не подтверждён'),'utility_note':' / '.join(str(old.get(k,'?')) for k in ('electricity','water','septic')),
            'notes':[old.get('rv',''),old.get('price_note','')],
        })
        descriptions=' '.join(str(old.get(k,'')) for k in ('title','rv','restrictions','garage_workshop','electricity','water','septic','terrain'))
        x.update(flags_from_text(descriptions,kind,utilities=x['utility_note']))
        x['legacy_original']=old
        rows.append(x)
    return rows

def normalize_key(x):
    if x.get('parcel') and len(x['parcel'])>5:
        return ('parcel',x.get('state'),re.sub(r'\W','',x.get('county','').lower()),re.sub(r'\W','',x['parcel'].lower()))
    a=re.sub(r'\W','',x.get('address','').lower())
    # A county, road name or generic 'TBD' is not a unique property address.
    if a and re.match(r'^\d+[a-z]?\s+\D',x.get('address',''),re.I) and not re.search(r'county$',x.get('address',''),re.I):
        return ('address',x.get('state'),str(x.get('city','')).lower(),a)
    return ('url',x['url'].lower().rstrip('/'))

def acceptable(x):
    if x.get('price') is None or not 3000<=x['price']<=15000:return 'outside_cash_budget'
    if x.get('total_known',x['price'])>15000:return 'known_fees_exceed_budget'
    if x.get('price_basis')!='asking_cash':return 'not_fixed_cash_price'
    if not x.get('image_url'):return 'no_reliable_listing_image'
    if x.get('lat') is None or x.get('lng') is None:return 'location_unresolved'
    if not (18<=x['lat']<=72 and -180<=x['lng']<=-65):return 'coordinates_outside_us'
    if x.get('road_access')=='problem':return 'vehicle_access_problem'
    if x.get('acres') is not None and x['acres']<.09 and not x.get('existing_garage'):return 'lot_too_small_for_screening'
    if x.get('status') not in ('active','pending'):return 'availability_not_confirmed_by_source'
    return None

def merge_records(previous,incoming):
    """Preserve IDs, first_seen and all historical records, even if refresh disappears."""
    by_id={x['id']:x for x in previous}
    keys={normalize_key(x):x['id'] for x in previous}
    urls={x['url'].rstrip('/'):x['id'] for x in previous}
    for row in incoming:
        x=dict(row)
        prior_id=x['id'] if x['id'] in by_id else urls.get(x['url'].rstrip('/')) or keys.get(normalize_key(x))
        if prior_id:
            old=by_id[prior_id]
            merged=dict(old,**x)
            merged['id']=old['id']
            merged['first_seen']=old.get('first_seen',NOW)
            merged['legacy']=old.get('legacy',False)
            hist=list(old.get('price_history',[]))
            if not hist:hist=[{'date':old.get('first_seen',NOW),'price':old.get('price'),'source':old.get('url')}]
            if old.get('price')!=x.get('price'):
                merged['previous_price']=old.get('price')
                hist.append({'date':NOW,'price':x.get('price'),'source':x['url']})
            merged['price_history']=hist
            changes=list(old.get('status_history',[]))
            if old.get('status')!=x.get('status'):
                changes.append({'date':NOW,'from':old.get('status'),'to':x.get('status'),'source':x['url']})
            merged['status_history']=changes
            merged['alternate_urls']=sorted(set(old.get('alternate_urls',[])+[old['url'],x['url']]))
            if not x.get('image_url'):merged['image_url']=old.get('image_url')
            by_id[prior_id]=merged
            keys[normalize_key(x)]=prior_id
            urls[x['url'].rstrip('/')]=prior_id
        else:
            x.setdefault('price_history',[{'date':NOW,'price':x.get('price'),'source':x['url']}])
            x.setdefault('status_history',[])
            by_id[x['id']]=x
            keys[normalize_key(x)]=x['id']
            urls[x['url'].rstrip('/')]=x['id']
    return list(by_id.values())

def run(bootstrap=False):
    DATA.mkdir(exist_ok=True)
    previous=read(DATA/'listings.json',{}).get('listings',[])
    if not previous:previous=legacy_records()
    rejected=[]
    incoming=[]
    # Indexed research is imported deliberately once. Nightly refreshes only use fresh
    # public pages; they never overwrite a newer status with an old indexed snapshot.
    research=landsearch_records() if bootstrap else []
    for x in landcentury_records()+research+read(DATA/'curated.json',[]):
        reason=acceptable(x)
        x.pop('_description',None)
        if reason:
            rejected.append({'id':x['id'],'state':x.get('state'),'url':x['url'],'reason':reason,'price':x.get('price')})
            # A known record still gets its explicit new price/status, never disappears.
            if x['id'] in {y['id'] for y in previous} and reason not in ('location_unresolved','no_reliable_listing_image'):
                incoming.append(x)
        else:incoming.append(x)
    merged=merge_records(previous,incoming)
    for x in merged:
        x.pop('_description',None)
        x.setdefault('price_history',[{'date':x.get('first_seen',NOW),'price':x.get('price'),'source':x['url']}])
        x.setdefault('status_history',[])
        patch=read(DATA/'corrections.json',{}).get(x['id'],{})
        x.update(patch)
    write(DATA/'listings.json',{'schema_version':2,'updated_at':NOW,'listings':merged})
    write(DATA/'screening-log.json',{'updated_at':NOW,'rejected_new_candidates':rejected})
    counts=collections.Counter(x['state'] for x in merged)
    print(json.dumps({'total':len(merged),'photos':sum(bool(x.get('image_url')) for x in merged),
        'states':len(counts),'by_state':dict(sorted(counts.items())),
        'rejected':dict(collections.Counter(x['reason'] for x in rejected)),
        'kinds':dict(collections.Counter(x['kind'] for x in merged))},ensure_ascii=False,indent=2))

if __name__=='__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('--bootstrap',action='store_true',help='Import local indexed research snapshots deliberately')
    run(ap.parse_args().bootstrap)
