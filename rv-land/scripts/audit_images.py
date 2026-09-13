"""Check image availability with HEAD; do not replace or download images."""
import concurrent.futures as cf,json,time
from urllib.parse import urlparse
import requests
from build_data import DATA,CACHE,read,write,NOW

def check(row):
    url=row.get('image_url') or ''
    if url.startswith('data:image/'):return row['id'],{'status':'embedded','checked_at':NOW}
    if not url:return row['id'],{'status':'missing','checked_at':NOW}
    try:
        r=requests.head(url,timeout=12,allow_redirects=True)
        time.sleep(.2)
        return row['id'],{'status':'ok' if r.status_code==200 and r.headers.get('content-type','').startswith('image/') else 'gone' if r.status_code in (404,410) else 'unverified','http':r.status_code,'checked_at':NOW}
    except requests.RequestException:return row['id'],{'status':'unverified','checked_at':NOW}

def run():
    d=read(DATA/'listings.json',{})
    with cf.ThreadPoolExecutor(max_workers=4) as ex:
        results=dict(ex.map(check,d['listings']))
    write(DATA/'image-health.json',{'updated_at':NOW,'images':results})
    print(json.dumps({k:sum(x['status']==k for x in results.values()) for k in ('ok','embedded','gone','unverified','missing')}))
if __name__=='__main__':run()
