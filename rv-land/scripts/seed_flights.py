"""Transcribe the dated Google Flights Explore observations made in Chrome.
Run only when rebuilding this initial snapshot; not in nightly refreshes.
"""
from build_data import DATA, write
ORIGINS={
 'VNO':('Вильнюс','https://www.google.com/travel/explore?tfs=CBwQAxodagwIAhIIL20vMDdfa3FyDQgEEgkvbS8wOWM3dzAaHWoNCAQSCS9tLzA5Yzd3MHIMCAISCC9tLzA3X2txQAFIAXACggENCP___________wEQA5gBAbIBBBgBIAE&tfu=GgA&hl=en&curr=EUR'),
 'LON':('Лондон, все аэропорты','https://www.google.com/travel/explore?tfs=CBwQAxodagwIAxIIL20vMDRqcGxyDQgEEgkvbS8wOWM3dzAaHWoNCAQSCS9tLzA5Yzd3MHIMCAMSCC9tLzA0anBsQAFIAXACggENCP___________wEQA5gBAbIBBBgBIAE&tfu=GgA&hl=en&curr=EUR'),
 'WAW':('Варшава Chopin','https://www.google.com/travel/explore?tfs=CBwQAxoYagcIARIDV0FXcg0IBBIJL20vMDljN3cwGhhqDQgEEgkvbS8wOWM3dzByBwgBEgNXQVdAAUgBcAKCAQ0I____________ARADmAEBsgEEGAEgAQ&tfu=GgA&hl=en&curr=EUR'),
 'CPH':('Копенгаген','https://www.google.com/travel/explore?tfs=CBwQAxoYagcIARIDQ1BIcg0IBBIJL20vMDljN3cwGhhqDQgEEgkvbS8wOWM3dzByBwgBEgNDUEhAAUgBcAKCAQ0I____________ARADmAEBsgEEGAEgAQ&tfu=GgA&hl=en&curr=EUR')}
# origin | US gateway (city where Explore does not specify exact airport) | EUR return | dates | outbound duration | stops | carriers
ROWS='''VNO|NYC|445|2026-11-16|2026-11-29|13:40|2|SAS
VNO|SFO|671|2027-02-28|2027-03-14|19:45|1|Lufthansa / SWISS / United
VNO|LAX|559|2026-11-19|2026-12-04|20:40|1|SAS
VNO|ORD|512|2027-01-09|2027-01-23|17:06|2|American / Finnair
VNO|BOS|585|2026-11-13|2026-11-27|13:28|1|Air France / airBaltic / Delta
VNO|MIA|504|2026-11-20|2026-12-04|18:45|1|SAS
VNO|SEA|789|2026-10-01|2026-10-14|18:45|1|airBaltic / Delta
VNO|DFW|743|2026-10-24|2026-11-07|16:52|2|Lufthansa / United
VNO|DEN|788|2026-11-21|2026-12-04|30:25|2|Turkish / United
VNO|ATL|879|2026-09-24|2026-10-08|17:50|1|SAS
VNO|DTW|868|2026-12-21|2027-01-05|29:00|1|Turkish
VNO|MCO|1056|2026-09-19|2026-10-02|18:30|1|Discover / Lufthansa
LON|LAX|434|2026-11-02|2026-11-15|16:00|1|SWISS
LON|NYC|434|2026-11-01|2026-11-14|16:50|1|SWISS / United
LON|SFO|434|2026-10-22|2026-11-04|14:50|1|SWISS
LON|LAS|514|2026-10-10|2026-10-24|18:25|1|SWISS / Edelweiss
LON|BOS|431|2026-11-13|2026-11-26|10:55|1|Icelandair
LON|SEA|407|2026-11-20|2026-12-03|13:05|1|Icelandair
LON|IAD|407|2026-11-06|2026-11-21|11:35|1|Icelandair
LON|ORD|558|2026-10-30|2026-11-13|15:30|1|TAP
LON|SAN|679|2026-10-08|2026-10-23|16:00|1|Lufthansa / United
LON|MIA|431|2027-02-28|2027-03-15|13:55|1|Icelandair
LON|ATL|513|2026-11-26|2026-12-10|13:30|1|Delta / KLM
LON|MCO|383|2026-11-22|2026-12-05|37:40|1|Icelandair
LON|PHL|692|2026-10-01|2026-10-16|11:35|1|Discover / Lufthansa / United
LON|DEN|617|2026-11-13|2026-11-26|13:05|1|Icelandair
LON|PDX|699|2026-11-01|2026-11-14|13:05|1|Icelandair
LON|DFW|891|2026-10-12|2026-10-26|18:30|1|Turkish
LON|PHX|815|2026-11-05|2026-11-21|22:17|3|Air Canada / SWISS
LON|MSP|803|2026-10-01|2026-10-14|13:10|1|Aer Lingus
LON|DTW|883|2026-10-02|2026-10-15|15:21|1|JetBlue
LON|CLT|873|2027-02-08|2027-02-21|13:10|1|American / British Airways / Lufthansa
WAW|NYC|470|2026-11-02|2026-11-16|15:10|1|TAP
WAW|SFO|790|2026-10-23|2026-11-08|15:50|2|JetBlue / Condor / LOT
WAW|LAX|546|2026-10-19|2026-11-03|17:15|1|American / Finnair / British Airways
WAW|ORD|477|2026-10-15|2026-10-28|15:55|1|American / Finnair / British Airways
WAW|IAD|723|2026-11-12|2026-11-26|15:50|1|Turkish
WAW|LAS|748|2026-10-29|2026-11-11|16:35|2|American / British Airways / Condor / LOT
WAW|BOS|680|2026-09-18|2026-10-01|13:05|1|Condor / LOT
WAW|MIA|580|2026-11-26|2026-12-10|32:05|2|American / Finnair / British Airways
WAW|SAN|928|2026-11-28|2026-12-13|15:05|1|British Airways / KLM
WAW|SEA|670|2027-01-24|2027-02-07|14:25|1|Condor / LOT
WAW|MCO|591|2026-11-20|2026-12-03|31:15|1|TAP
WAW|PHL|842|2026-10-08|2026-10-21|14:00|1|American / British Airways
WAW|ATL|706|2027-01-25|2027-02-08|18:04|2|JetBlue / Condor / LOT
WAW|DEN|755|2026-10-08|2026-10-22|16:20|1|Turkish
WAW|PDX|790|2027-02-12|2027-02-28|21:35|2|Alaska / Condor / LOT
WAW|DFW|783|2026-10-05|2026-10-19|16:30|1|Turkish
WAW|PHX|790|2027-01-29|2027-02-14|22:07|2|Alaska / JetBlue / Condor / LOT
WAW|DTW|706|2026-11-06|2026-11-19|22:16|2|JetBlue / Condor / LOT
WAW|MSP|811|2026-10-12|2026-10-26|12:30|1|Air France / Delta / KLM
WAW|CLT|834|2026-11-27|2026-12-13|25:29|2|American / Finnair / British Airways
CPH|NYC|458|2026-11-01|2026-11-14|12:05|1|American / Finnair / British Airways
CPH|SFO|606|2026-12-25|2027-01-08|19:05|1|TAP
CPH|LAX|606|2026-10-29|2026-11-12|18:15|1|TAP
CPH|ORD|468|2026-10-30|2026-11-13|16:30|1|TAP
CPH|IAD|468|2026-11-02|2026-11-15|15:15|1|TAP
CPH|LAS|680|2026-10-30|2026-11-13|20:05|2|American / Finnair / British Airways
CPH|BOS|468|2026-11-05|2026-11-18|14:30|1|TAP
CPH|MIA|454|2026-12-03|2026-12-16|13:55|1|Icelandair
CPH|SAN|680|2026-10-15|2026-10-28|19:12|2|American / Finnair / British Airways
CPH|SEA|547|2026-10-02|2026-10-18|12:45|1|Icelandair
CPH|MCO|530|2027-01-16|2027-02-01|42:20|1|Icelandair
CPH|PHL|565|2026-10-22|2026-11-05|14:55|1|American / British Airways
CPH|ATL|643|2026-11-07|2026-11-21|13:55|1|British Airways
CPH|DEN|602|2027-01-10|2027-01-25|12:55|1|Icelandair
CPH|PDX|631|2026-11-13|2026-11-27|24:06|2|American / Finnair / British Airways
CPH|BNA|562|2026-10-29|2026-11-12|17:26|2|American / Finnair / British Airways
CPH|IAH|703|2026-10-12|2026-10-27|22:40|1|British Airways
CPH|DFW|704|2026-10-19|2026-11-02|13:55|2|Lufthansa / SWISS / United
CPH|PHX|739|2026-10-12|2026-10-26|18:17|2|American / Finnair / British Airways
CPH|HNL|873|2026-11-02|2026-11-16|25:40|2|Alaska / Icelandair
CPH|STL|596|2026-10-16|2026-10-30|13:55|1|Lufthansa'''

def run():
    observations=[]
    for line in ROWS.splitlines():
        origin,gateway,eur,start,end,duration,stops,airlines=line.split('|')
        h,m=duration.split(':')
        observations.append({'origin':origin,'gateway':gateway,'eur':int(eur),'departure':start,'return':end,
            'duration':duration,'duration_hours':int(h)+int(m)/60,'stops':int(stops),'airlines':airlines,
            'observed_at':'2026-09-14T01:30:00+03:00','verification':'Google Flights Explore, Chrome; не checkout',
            'source_url':ORIGINS[origin][1],'baggage':'Только цена выдачи; checked bag и условия тарифа не проверены.',
            'usable':True,'gateway_precision':'city_search; точный аэропорт подтвердить при выборе рейса'})
    write(DATA/'flights.json',{'updated_at':'2026-09-14T01:30:00+03:00','trip':'Туда-обратно, 1 взрослый, economy; гибкий поиск около двух недель в ближайшие 6 месяцев.',
        'caveat':'Разные даты: это ориентиры поиска, не сравнение одинаковой поездки. Цена и наличие меняются. Подъезд из Вильнюса до UK/WAW/CPH, багаж, ночёвки, трансферы и аренда автомобиля не включены. Не гарантированы единый билет и защищённая стыковка.',
        'origins':[{'code':k,'name':v[0],'url':v[1]} for k,v in ORIGINS.items()], 'observations':observations,
        'provider_checks':[
            {'route':'London → Seattle','price':'£349 return Economy Light','dates':'13–27 января 2027','url':'https://www.icelandair.com/en-gb/flights/flights-from-london-to-seattle','note':'Официальная страница тарифа; через KEF, багаж и checkout проверить. Валюту GBP не смешивать с EUR.'},
            {'route':'Вильнюс → Los Angeles','price':'€687 return','dates':'30 сентября – 14 октября 2026','url':'https://www.klm.lt/en-lt/flights-from-vilnius-to-los-angeles','note':'Опубликованный ориентир KLM, не оформленное бронирование.'},
            {'route':'Вильнюс → San Francisco','price':'от €751 return','dates':'Осенний календарь; конкретные даты не подтверждены','url':'https://www.klm.lt/en-lt/flights-from-vilnius-to-san-francisco','note':'Только контроль уровня цен официального перевозчика; не равнозначен датированному варианту.'}]})
    print(len(observations),'flight observations')

if __name__=='__main__':run()
