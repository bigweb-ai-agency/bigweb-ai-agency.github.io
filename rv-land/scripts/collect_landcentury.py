"""Polite public-page discovery. Never uses private APIs or bypasses blocks.

Raw page data stays in ignored .cache; published records are built separately.
"""
import argparse
import hashlib
import json
import re
import time
from pathlib import Path
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser
import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache' / 'landcentury'
STATES = dict(x.split(':') for x in (
    'AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|'
    'CT:Connecticut|DE:Delaware|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|'
    'IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|'
    'MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|'
    'MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|'
    'NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|'
    'OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|'
    'SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|'
    'WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming').split('|'))

def slug(name):
    return name.lower().replace(' ', '-')

def property_url(p):
    group = 'land-for-sale' if p['type'] == 'land' else 'houses-and-buildings'
    return f'https://www.landcentury.com/{group}/{slug(p["stateRegion"])}/{p["slug"]}'

class Reader:
    def __init__(self, fresh=False):
        CACHE.mkdir(parents=True, exist_ok=True)
        self.session = requests.Session()
        self.session.headers['User-Agent'] = 'RVPropertyWatch/1.0 (public research; low request rate)'
        self.fresh = fresh
        self.last = 0
        self.blocked = False
        self.robot = None

    def read(self, url):
        # Only the public canonical page paths and pagination are supported.
        u = urlparse(url)
        if u.netloc != 'www.landcentury.com' or not re.match(r'^/(land-for-sale|houses-and-buildings)(/|$)', u.path):
            raise ValueError('Outside source allowlist')
        if u.query and not re.fullmatch(r'page=\d+', u.query):
            raise ValueError('Unsupported query; respect source robots rules')
        path = CACHE / (hashlib.sha256(url.encode()).hexdigest()[:24] + '.json')
        if path.exists() and not self.fresh:
            return json.loads(path.read_text(encoding='utf-8'))
        if self.blocked:
            raise RuntimeError('Source blocked; no retry in this run')
        if self.robot is None:
            rr=self.session.get('https://www.landcentury.com/robots.txt',timeout=25)
            if rr.status_code!=200:
                self.blocked=True
                raise RuntimeError('Cannot verify current source robots rules')
            self.robot=RobotFileParser()
            self.robot.parse(rr.text.splitlines())
        if not self.robot.can_fetch(self.session.headers['User-Agent'],url):
            raise RuntimeError('Source robots disallows this public page')
        time.sleep(max(0, 1.0 - (time.monotonic() - self.last)))
        r = self.session.get(url, timeout=25)
        self.last = time.monotonic()
        if r.status_code in (403, 429):
            self.blocked = True
        r.raise_for_status()
        s = BeautifulSoup(r.text, 'html.parser')
        el = s.find('script', id='__NEXT_DATA__')
        if el is None:
            raise ValueError('Public page schema changed')
        props = json.loads(el.string)['props']['pageProps']
        # No seller account objects, telemetry, or tracking fields in local research cache.
        if 'property' in props:
            props['property'].pop('get_user', None)
        item = {'url': url, 'fetched_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                'data': {k:v for k,v in props.items() if k in ('data','property')}}
        path.write_text(json.dumps(item, ensure_ascii=False), encoding='utf-8')
        return item

def scan(args):
    reader = Reader(args.fresh)
    path = CACHE.parent / 'discovery.json'
    records = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
    rows = {}
    for code, name in STATES.items():
        if args.states and code not in args.states.split(','):
            continue
        state_rows, evidence = {}, []
        for group in ('land-for-sale', 'houses-and-buildings'):
            for page in range(1, args.pages + 1):
                url = f'https://www.landcentury.com/{group}/{slug(name)}' + (f'?page={page}' if page > 1 else '')
                try:
                    item = reader.read(url)
                    data = item['data'].get('data', {})
                    properties = data.get('properties', [])
                    evidence.append({'url':url, 'fetched_at':item['fetched_at'], 'source_total':data.get('total'), 'scanned':len(properties)})
                    for p in properties:
                        if p.get('stateRegion','').lower() == name.lower():
                            p['_source_url'] = property_url(p)
                            p['_fetched_at'] = item['fetched_at']
                            p.pop('get_user', None)
                            state_rows[str(p['id'])] = p
                    if not properties or page * int(data.get('limit',25)) >= data.get('total',0):
                        break
                    candidates = [p for p in state_rows.values() if 300000 <= (p.get('cashPrice') or 0) <= 1500000 and not p.get('isAuction') and not p.get('isSold')]
                    if group == 'land-for-sale' and len(candidates) >= args.target:
                        break
                except Exception as e:
                    evidence.append({'url':url, 'error':str(e)[:160]})
                    break
        records[code] = {'name':name, 'evidence':evidence, 'properties':list(state_rows.values())}
        path.write_text(json.dumps(records,ensure_ascii=False),encoding='utf-8')
        n = sum(300000 <= (p.get('cashPrice') or 0) <= 1500000 and not p.get('isAuction') and not p.get('isSold') for p in state_rows.values())
        rows[code] = n
        print(f'{code}: {len(state_rows)} scanned; {n} cash-price candidates',flush=True)
    print(json.dumps(rows),flush=True)

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--pages',type=int,default=4)
    ap.add_argument('--target',type=int,default=16)
    ap.add_argument('--states')
    ap.add_argument('--fresh',action='store_true')
    scan(ap.parse_args())
