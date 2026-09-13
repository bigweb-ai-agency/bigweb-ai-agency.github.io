"""Build reproducible state coverage and transparent screening scores."""
import json, math
from build_data import DATA, ROOT, STATES, read, write, NOW, acceptable

# Qualitative research judgements, not measured weather or legal classifications.
# Priorities describe where to keep looking, not a certification of any parcel.
STATE_ROWS='''AL|Юг|8|2|ATL|Длинный рабочий сезон; влажность, грозы и локальное затопление. Искать ровный участок вне жилых ограничений.
AK|Аляска|1|4|SEA|Низкая цена часто означает удалённость. Доставка RV, дороги, мороз и отдельный перелёт перевешивают цену земли.
AZ|Юго-запад|6|2|LAX,LAS,PHX|Много дешёвой земли. Пустынная жара, отсутствие воды и электричества; север штата холодный. Ремонт в Mohave требует отдельной проверки правил.
AR|Юг|8|1|DFW,STL|Один из полезных рынков земли в бюджете. Осторожно с курортными subdivision, POA, оврагами и обещанием RV без документов.
CA|Тихоокеанский|6|2|LAX,SFO|Недорогие предложения сосредоточены в пустыне и глубине штата. Прибрежный мягкий климат нельзя переносить на эти участки.
CO|Горный|3|3|DEN|San Luis Valley даёт много дешёвых лотов, но это высокогорье с морозом, ветром и дорогими коммуникациями.
CT|Северо-восток|4|4|NYC,BOS|Очень мало результатов в бюджете; проверять размер, подъезд и самостоятельное использование участка.
DE|Северо-восток|6|4|PHL,NYC|В просмотренных источниках подходящих фотообъявлений не найдено. Ноль в базе не доказывает отсутствие рынка.
FL|Юг|7|2|MIA,MCO|Дешёвый перелёт и мягкая зима. Многие лоты без подъезда/коммуникаций, wetland, HOA или ураганный риск; летняя работа жаркая.
GA|Юг|8|1|ATL|Хороший компромисс сезона и международного аэропорта. Искать сельские участки с реальной дорогой; covenants и ремонт проверять по округу.
HI|Гавайи|7|4|HNL|Дешёвая земля обычно на Big Island, а международный рейс часто до Honolulu. Межостровная логистика, доставка RV, лава и ливни ухудшают экономику.
ID|Горный|3|4|SEA|Недостаточная выборка до $15k. Снег и удалённость, особенно у дешёвых рекреационных участков.
IL|Средний Запад|4|1|ORD,STL|Полезный рынок небольших зданий, гаражей и городских лотов. ORD удобен из Европы; зима, налоги, обязанности по аварийным домам.
IN|Средний Запад|4|1|ORD,DTW|Gary и север штата доступны через Chicago. Дешёвый дом требует проверки крыши, сноса, размера ворот и местных правил парковки.
IA|Средний Запад|3|1|ORD,MSP|Есть старые здания и дома с гаражами. Большинство далеко от дешёвых международных аэропортов; для зимнего ремонта нужен обогрев.
KS|Равнины|4|2|DFW,DEN,STL|Городские лоты и отдельные дешёвые здания возможны; длинный наземный путь, ветер, град и холодная зима.
KY|Аппалачи|7|1|BNA,ORD,IAD|Интересны участки вне курортных поселений; уклон, подъезд и ограничения на RV могут оказаться важнее цены.
LA|Юг|7|3|IAH,DFW|Тёплая зима; низкая отметка, паводки, влажность, ураганы и состояние грунта требуют особенно внимательной проверки.
ME|Северо-восток|2|3|BOS|Земля в бюджете встречается в удалённых районах. Снег, зимняя дорога и долгий путь из Boston снижают удобство базы.
MD|Северо-восток|6|3|IAD,PHL|Хорошая авиационная доступность; дешёвые лоты часто слишком ограничены для самостоятельной мастерской.
MA|Северо-восток|4|4|BOS|Сильный аэропорт, слабая выборка дешёвой земли. Проверить wetlands, проезд и пригодность лота до дальнейшего планирования.
MI|Средний Запад|3|1|DTW,ORD|Flint и небольшие города дают дома/лоты в бюджете. Гаражи интереснее голой земли, но важны состояние, городские нарушения и снег.
MN|Средний Запад|2|2|MSP,ORD|Сохранена прежняя подборка. Близость MSP полезна, но не означает дешёвый билет; наружный зимний ремонт неудобен.
MS|Юг|8|1|ATL,IAH|Недорогая земля и длинный сезон. Проверять паводки, дорогу, электричество и муниципальные ограничения на неходовые машины.
MO|Средний Запад|6|1|STL,ORD|Перспективный баланс цены и сезона, особенно небольшие города. Курортные лоты и Ozarks могут иметь ограничения и уклон.
MT|Горный|2|4|SEA,DEN|Небольшая выборка; холод, расстояния и сезонные дороги. Дешёвая цена редко делает базу удобной из EU.
NE|Равнины|3|3|DEN,MSP|Есть городские лоты; мороз, ветер и длинная дорога от международного рейса. Искать существующий бокс.
NV|Юго-запад|5|2|LAS,SFO|Много удалённых лотов. Север штата холодный, юг жаркий; юридическая дорога и питание часто дороже самого участка.
NH|Северо-восток|3|4|BOS|Мало подходящих предложений; снег и местные ограничения на standalone RV. Проверять каждую town отдельно.
NJ|Северо-восток|5|4|NYC,PHL|Удобный перелёт, но дешёвые лоты часто непростые: размер, wetlands, отсутствие разрешённого использования.
NM|Юго-запад|6|2|DEN,DFW,PHX|Много доступной земли, однако высота и мороз неоднородны. Без дороги, электричества и ясного RV zoning база теряет смысл.
NY|Северо-восток|3|2|NYC,BOS|Upstate даёт бюджетные участки и аварийные дома, но далеко от NYC. Земельные банки могут требовать дорогую обязательную реконструкцию.
NC|Юг|8|1|CLT,IAD,ATL|Мягкий сезон и несколько шлюзов. Горные лоты проверять на уклон, прибрежные — на воду; HOA часто ограничивает RV.
ND|Равнины|1|4|MSP|Небольшая выборка, суровая зима и большое расстояние. Имеет смысл только с уже существующим пригодным помещением.
OH|Средний Запад|4|1|DTW,ORD|Искать отдельный гараж или дом с ним. Городские land-bank условия, снос и ремонт дома могут сделать дешёвую покупку дорогой.
OK|Равнины|6|2|DFW|Недорогие лоты, относительно мягкая зима. Грозы, град, жара и индивидуальные zoning/covenants требуют проверки.
OR|Тихоокеанский|4|3|PDX,SEA,SFO|Дешёвая земля часто в Klamath/Lake County, а не в мягком прибрежном климате. Холод, огонь и автономные коммуникации.
PA|Северо-восток|4|1|NYC,PHL,IAD|Хорошие EU-шлюзы и городские лоты. Проверять township zoning, гараж как самостоятельное использование и обязанности по аварийному зданию.
RI|Северо-восток|4|4|BOS|В просмотренных источниках подходящих фотообъявлений нет. Очень маленький рынок в этом бюджете; наблюдение продолжается.
SC|Юг|8|1|CLT,ATL|Тёплый сезон, земля в бюджете встречается. Искать сухую площадку с подъездом; coastal flood/HOA не игнорировать.
SD|Равнины|2|3|MSP,DEN|Есть дешёвые городские лоты, но зимняя работа и дальний трансфер неудобны. Проверять строительные обязательства.
TN|Юг|8|1|BNA,ATL|Один из первых регионов для поиска базы. Проверять склон, driveway easement и реальные границы: гараж на фото иногда исключён из продажи.
TX|Юг|7|2|DFW,IAH|Много дешёвой земли на западе, обычно далеко от DFW/IAH. Жара, вода, электричество и подъезд определяют полную стоимость.
UT|Горный|3|3|LAS,DEN|Бюджетные удалённые участки, холодная зима и большие расстояния. Само отсутствие HOA не разрешает RV или ремонт.
VT|Северо-восток|2|4|BOS,NYC|Мало результатов, снежная зима и непростой доступ. Не приоритет без готового отапливаемого бокса.
VA|Аппалачи|7|1|IAD,CLT|IAD может быть выгоден через UK. Недорогая земля чаще далеко на юго-западе; склон и длинный трансфер учитывать заранее.
WA|Тихоокеанский|4|3|SEA|Дешёвый билет до SEA возможен, но дешёвые участки в основном далеко от западных городов. Восточный климат холоднее и суше.
WV|Аппалачи|6|1|IAD,CLT|Полезный рынок небольших лотов. Главные вопросы — паводок, уклон, дорога и расстояние от IAD; коммунальный лот лучше лесного склона.
WI|Средний Запад|2|2|ORD,MSP|Есть бюджетные лоты, иногда коммунальные. Зима и ограничения рекреационных subdivisions снижают пригодность для ремонта.
WY|Горный|2|4|DEN|Недостаточно хороших результатов; ветер, мороз и удалённость. Приоритет ниже рынков с существующими гаражами.'''

def distance(a,b):
    lat1,lon1,lat2,lon2=map(math.radians,[*a,*b])
    return 6371*2*math.asin(min(1,math.sqrt(math.sin((lat2-lat1)/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2)))

def run():
    d=read(DATA/'listings.json',{})
    airports=read(DATA/'gateways.json',{}).get('airports',[])
    flights=read(DATA/'flights.json',{}).get('observations',[])
    states=[]
    for line in STATE_ROWS.splitlines():
        code,region,climate,priority,gates,note=line.split('|')
        rows=[x for x in d['listings'] if x['state']==code]
        eligible=[x for x in rows if acceptable(x) is None and not x.get('price_conflict')]
        states.append({'code':code,'name':STATES[code],'region':region,'climate_score':int(climate),'priority':int(priority),
            'gateways':gates.split(','),'analysis':note,'total':len(rows),'photo_candidates':len(eligible),
            'shortfall':max(0,10-len(eligible)), 'coverage':'10+ кандидатов' if len(eligible)>=10 else 'Недостаточно проверенных кандидатов',
            'sources':[f'https://www.landsearch.com/properties/{STATES[code].lower().replace(" ","-")}/search/under-15000',f'https://www.landcentury.com/land-for-sale/{STATES[code].lower().replace(" ","-")}', 'https://www.ncei.noaa.gov/news/noaa-addresses-climate-each-state']})
    sm={x['code']:x for x in states}
    for x in d['listings']:
        s=sm[x['state']]
        if x.get('status_basis')=='legacy_unrechecked':
            # Prior ChatGPT notes can contain questions such as "verify RV parking".
            # They are not a new seller statement or legal evidence.
            for k in ('rv_storage','rv_occupancy','personal_repair','commercial_repair','no_hoa'):
                x[k]='unknown'
        if x['state']=='AZ' and 'mohave' in x.get('county','').lower():
            x['personal_repair']='restriction_risk'
            risk='Mohave IPMC 302.8 ограничивает неходовые машины и крупную разборку; проверить zoning-исключения и точную юрисдикцию.'
            if risk not in x.setdefault('flags',[]):x['flags'].append(risk)
            x['legal_source']='https://www.mohave.gov/departments/development-services/building-division/documents/building-ordinance-2021-03/'
        x['region']=s['region']
        x['screening_issue']=acceptable(x)
        x['climate_note']=s['analysis'].split('.')[0]+'. Климатическая оценка региона, не замер на участке.'
        candidates=[]
        for a in airports:
            if a['code'] in ('JFK','EWR'):continue # NYC is the city-level fare observation.
            if x['state']=='HI' and a['code'] not in ('HNL','KOA','ITO'):continue
            if x['state']=='AK' and a['code']!='ANC':continue
            if x['state'] not in ('AK','HI') and a['code'] in ('HNL','KOA','ITO','ANC'):continue
            km=distance((x['lat'],x['lng']),(a['lat'],a['lng'])) if x.get('lat') and x.get('lng') else 99999
            quotes=[f for f in flights if f['gateway']==a['code'] and f.get('usable',True)]
            best=min(quotes,key=lambda f:f['eur'],default=None)
            candidates.append({'code':a['code'],'name':a['name'],'straight_km':round(km),
                'drive_km_estimate':round(km*1.25),'drive_hours_estimate':round(km*1.25/75,1),
                'flight_min_eur':best['eur'] if best else None,'flight_origin':best['origin'] if best else None,
                'route_basis':'Геометрическая оценка ×1.25, 75 км/ч; не проверенный автомобильный маршрут.'})
        candidates.sort(key=lambda a:a['straight_km'])
        x['gateways']=candidates[:3]
        x['msp_straight_km']=round(distance((x['lat'],x['lng']),(44.882,-93.222))) if x.get('lat') and x.get('lng') else None
        parts={'Цена /25':round(max(0,min(25,(18000-(x.get('total_known') or 18000))/600))),
            'Помещение /25':22 if x.get('existing_garage') else 9 if x.get('kind') in ('house','commercial','building','workshop') else 0,
            'Личный ремонт /20':20 if x.get('personal_repair')=='authority_confirmed' else 5 if x.get('personal_repair')=='seller_claim' else 0,
            'Коммуникации /10':sum(3 if x.get(k)=='on_site_claim' else 1 if x.get(k)=='available' else 0 for k in ('electricity','water','sewer')),
            'Сезон /10':s['climate_score'],'Дорога /10':max(0,10-round(candidates[0]['drive_hours_estimate'])) if candidates and x['state'] not in ('HI','AK') else 0}
        x['score_parts']=parts
        x['score']=min(64 if x.get('personal_repair')!='authority_confirmed' else 100,sum(parts.values()))
        if x.get('price_conflict') or x.get('status') not in ('active','pending'):x['score']=min(x['score'],20)
    write(DATA/'listings.json',d)
    write(DATA/'states.json',{'updated_at':NOW,'states':states,'method':'Обзор всех 50 штатов, затем отбор реальных объявлений. Приоритет и климат — качественные оценки автора. Недобор не заполняется выдуманными объектами. Разрешение личного ремонта не подтверждено ни у одного нового объекта.'})
    print('State analysis:',len(states),'states;',sum(x['photo_candidates']>=10 for x in states),'with 10+ photo candidates')

if __name__=='__main__':run()
