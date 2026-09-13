"""Preserve actual listing photographs byte-for-byte, with provenance.

No synthetic substitutes, enlargement, or image editing. Content-addressed files
remain in Git even when the source photo or listing changes.
"""
import argparse,base64,concurrent.futures as cf,hashlib,json,re,time
from pathlib import Path
from urllib.parse import urlparse
import requests
from build_data import ROOT,DATA,read,write,NOW,clean_image_url

ASSETS=ROOT/'assets'/'listings'
HOSTS={'cdn.landsearch.com','storage.portalstation.com','www.compass.com','ssl.cdn-redfin.com','images.homes.com','imagescdn.homes.com','photos.zillowstatic.com','www.woodsandwater.com','ap.rdcpix.com','data.nexthome.com'}
MIME={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif'}

def local_photo(row):
    path=row.get('image_url') or ''
    return path.startswith('assets/listings/') and (ROOT/path).is_file() and (ROOT/path).resolve().is_relative_to(ASSETS.resolve())

def failed_photo(row,status):
    row['photo_error']=status
    for photo in reversed(row.get('photo_history',[])):
        if local_photo({'image_url':photo.get('path')}):
            row['image_url']=photo['path']
            return row,status+'_previous_preserved'
    return row,status

def require_new_photos(old,rows):
    known={x['id'] for x in old}
    kept=[];rejected=[]
    for row in rows:
        if row['id'] in known or local_photo(row):kept.append(row)
        else:rejected.append({'url':row['url'],'state':row['state'],'reason':'new_photo_not_preserved'})
    return kept,rejected

def fetch_photo(row):
    x=dict(row)
    current=x.get('image_url') or ''
    if local_photo(x):return x,'cached'
    url=clean_image_url(current)
    if not url:return failed_photo(x,'missing')
    try:
        if url.startswith('data:image/'):
            header,payload=url.split(',',1);mime=header[5:].split(';')[0];content=base64.b64decode(payload)
        else:
            if urlparse(url).scheme!='https' or urlparse(url).hostname not in HOSTS:return failed_photo(x,'unsupported')
            with requests.get(url,timeout=20,stream=True) as response:
                response.raise_for_status()
                if urlparse(response.url).hostname not in HOSTS:return failed_photo(x,'unsupported_redirect')
                mime=response.headers.get('Content-Type','').split(';')[0]
                if mime not in MIME:return failed_photo(x,'not_image')
                parts=[];size=0
                for part in response.iter_content(65536):
                    size+=len(part)
                    if size>5_000_000:return failed_photo(x,'too_large')
                    parts.append(part)
                content=b''.join(parts)
            time.sleep(.2)
        if mime not in MIME or len(content)<100:return failed_photo(x,'not_image')
        # Check actual magic bytes as well as HTTP MIME, without transforming the image.
        signatures=(content.startswith(b'\xff\xd8\xff'),content.startswith(b'\x89PNG'),content[:4]==b'RIFF' and content[8:12]==b'WEBP',content.startswith(b'GIF8'))
        if not any(signatures):return failed_photo(x,'invalid_image')
        digest=hashlib.sha256(content).hexdigest()[:20]
        target=ASSETS/(digest+MIME[mime])
        if not target.exists():target.write_bytes(content)
        rel=target.relative_to(ROOT).as_posix()
        x['image_remote_url']=url if not url.startswith('data:') else 'embedded prior research photograph'
        x['image_url']=rel;x['photo_preserved_at']=NOW;x.pop('photo_error',None)
        history=x.get('photo_history',[])
        if not any(p.get('path')==rel for p in history):history.append({'path':rel,'source':x.get('image_source_url') or x['url'],'remote_url':x['image_remote_url'],'date':NOW})
        x['photo_history']=history
        return x,'saved'
    except (requests.RequestException,ValueError):
        return failed_photo(x,'unavailable')

def preserve(rows,workers=3):
    ASSETS.mkdir(parents=True,exist_ok=True)
    with cf.ThreadPoolExecutor(max_workers=workers) as ex:results=list(ex.map(fetch_photo,rows))
    return [x[0] for x in results],{s:sum(t==s for _,t in results) for s in set(t for _,t in results)}

def run():
    d=read(DATA/'listings.json',{});d['listings'],counts=preserve(d['listings'])
    write(DATA/'listings.json',d)
    write(DATA/'photo-preservation.json',{'updated_at':NOW,'result':counts,'method':'Original image bytes copied from public listing image URLs. No image alteration. Files retained in Git.'})
    print(json.dumps(counts),flush=True)
if __name__=='__main__':run()
