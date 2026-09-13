"""Reviewed initial corrections. Do not run as a scheduled overwrite."""
from build_data import DATA, CACHE, read, write
DATE='2026-09-14T02:00:00+03:00'
def run():
    out={}
    for x in read(CACHE/'legacy-checks.json',[]):
        if x.get('image_url'):
            out[x['id']]={'image_url':x['image_url'],'image_source_url':x['url'],'photo_checked_at':x['observed_at']}
    additions={
    'ia-mount-ayr-adams-6340604':{'image_url':'https://ap.rdcpix.com/a947429f65208a57425aeb4504d0e4e0l-m986491555rd-w960_h720.webp','image_source_url':'https://www.realtor.com/realestateandhomes-detail/403-E-Adams-St_Mount-Ayr_IA_50854_M72700-75430','status_basis':'indexed_public_page','source_crawled':'last week; price updated Aug 28, 2026','last_verified':DATE,'price':15000,'total_known':15000,'existing_garage':True,'garage_note':'В объявлении указан отдельный гараж на 2 машины; высота ворот и внутренняя длина неизвестны.','notes':['Текущая открытая карточка Realtor: $15,000. Старый индекс за август показывал $25,000.','Дом продаётся as-is; пригодность гаража для 7-метрового высокого RV требует замера.']},
    'il-easton-3rd-fsbo':{'image_url':'https://photos.zillowstatic.com/fp/c460a8bd09f74383929d519cff548b9e-cc_ft_960.jpg','status_basis':'indexed_public_page','source_crawled':'today','last_verified':DATE,'existing_garage':True,'flags':['Сам продавец оценивает ремонт дома в $50–80k. Покупная цена не отражает стоимость пригодной базы.','Проверить обязательства по дому, ворота и размеры гаража до покупки.']},
    'ia-correctionville-6th-6336683':{'image_url':'https://ssl.cdn-redfin.com/photo/436/bigphoto/683/6336683_0.jpg','kind':'building','status_basis':'indexed_public_page','source_crawled':'yesterday','last_verified':DATE,'flags':['Бывшая церковь, переоборудованная в дом; гаражный въезд и несущая способность пола не подтверждены.','Большой аварийный/ремонтируемый объём может оказаться дорогим обязательством.']},
    'ia-ralston-main-6339486':{'image_url':'https://images.homes.com/listings/210/6844209994-052025622/109-main-st-ralston-ia-primaryphoto.jpg?t=p','image_source_url':'https://www.homes.com/property/109-main-st-ralston-ia/jghpem0t8697t/','kind':'building','status_basis':'indexed_public_page','source_crawled':'2 weeks ago','last_verified':DATE,'electricity':'unknown','flags':['Всего 320 sq ft помещения, требуется ремонт крыши; размещение RV внутри не подтверждено.','Продавец отдельно предупреждает о стоимости восстановления электроснабжения.']},
    'mn-wells-industrial-5248539':{'kind':'industrial_lot','existing_garage':False},
    'mn-kiester-front-7062537':{'kind':'commercial_lot','existing_garage':False},
    'mn-mankato-tax-r010908128011':{'kind':'land','status':'unknown','price_basis':'tax_sale_unverified','flags':['Сохранён исторический налоговый лот. Текущая продажа за указанную сумму и отдельная фотография участка не подтверждены.'],'evidence_quote':None},
    'ky-palisades-25507773':{'status':'off_market','status_basis':'indexed_public_page','last_verified':DATE,'flags':['LandSearch перенаправляет на inactive; Homes.com показывает адрес среди проданных. Сохранён в архиве, повторную продажу проверить отдельно.']},
    'mn-minnesota-lake-marples-4592119':{'image_url':'https://images.homes.com/listings/102/3179530451-51525929/17-marples-ave-minnesota-lake-mn-primaryphoto.jpg','image_source_url':'https://www.homes.com/property/17-marples-ave-minnesota-lake-mn/w6fe6m7y0l5df/','status':'unknown','flags':['Источники расходятся: LandSearch показывает активную продажу $10k, новая Homes.com — не продаётся. Свежий MLS-статус нужно подтвердить.']},
    'mn-welcome-hulseman-7141779':{'flags':['В прежней подборке отмечен pending. Публичная страница сейчас блокирует повторную проверку.','24×24 ft — примерно 7.3×7.3 м снаружи: запас для 7-метрового RV минимален; длина внутри и высота ворот неизвестны.']},
    'tn-lone-mountain-1344590':{'garage_note':'Гараж/мастерская и трейлер на фото прямо исключены из продажи.','existing_garage':False,'flags':['Продаётся только земля. Гараж/мастерская и трейлер НЕ входят в цену.','Общий driveway: нужен документированный easement и достаточный проезд.']},
    'lc-15893':{'flags':['Страница показывает cash price $5,000, описание также предлагает $3,000 down + 6×$360. Уточнить полный cash договор, размер здания и состояние.','Нет подтверждения гаражного въезда или разрешения авторемонта.'],'garage_note':'Commercial building по продавцу; размеры ворот и фактическое назначение неизвестны.'},
    'lc-16279':{'flags':['Продавец сообщает, что не посещал дом и не имеет фото интерьера. Продажа as-is.','Гараж не указан; сначала осмотр конструкций, подъезда и муниципальных нарушений.']},
    'lc-23386':{'flags':['Дом требует реконструкции, гараж не подтверждён.','Явная cash price $8,000; $1,500 — первоначальный взнос по более дорогому финансированию.']}
    }
    for k,v in additions.items():out.setdefault(k,{}).update(v)
    write(DATA/'corrections.json',out)
    print('Reviewed corrections',len(out))
if __name__=='__main__':run()
