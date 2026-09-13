"""Read original public listing pages; keep source photos and record blocks honestly."""
import concurrent.futures
import json
from pathlib import Path
import requests
from bs4 import BeautifulSoup
from build_data import ROOT, CACHE, NOW, read, write

def inspect(x):
    try:
        r=requests.get(x['url'],timeout=18)
        if r.status_code!=200:return {'id':x['id'],'http':r.status_code}
        s=BeautifulSoup(r.text,'html.parser')
        title=s.title.get_text() if s.title else ''
        if 'captcha' in title.lower() or 'verification' in title.lower():return {'id':x['id'],'http':'challenge'}
        og=s.find('meta',property='og:image')
        text=s.get_text(' ',strip=True)
        cache=CACHE/'legacy-pages'
        cache.mkdir(exist_ok=True)
        (cache/(x['id']+'.html')).write_text(r.text,encoding='utf-8')
        return {'id':x['id'],'http':r.status_code,'title':title,'image_url':og.get('content') if og else None,'url':x['url'],'observed_at':NOW,'text_preview':text[:300]}
    except Exception as e:return {'id':x['id'],'error':type(e).__name__}

if __name__=='__main__':
    rows=[x for x in read(ROOT/'data/listings.json')['listings'] if x.get('legacy')]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
        results=list(ex.map(inspect,rows))
    write(CACHE/'legacy-checks.json',results)
    print(json.dumps(results,ensure_ascii=True,indent=2))
