import copy,json,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import build_data as b
import cache_photos as photos

class ResearchDataTests(unittest.TestCase):
    def test_failed_new_photo_keeps_previous_file_and_rejects_unillustrated_new_record(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);assets=root/'assets'/'listings';assets.mkdir(parents=True)
            (assets/'old.jpg').write_bytes(b'previous original photo')
            old={'id':'old','url':'https://example.org/old','state':'IL','image_url':'assets/listings/old.jpg'}
            update=dict(old,image_url='https://cdn.landsearch.com/new.jpg',photo_history=[{'path':old['image_url']}])
            new={'id':'new','url':'https://example.org/new','state':'IL','image_url':'https://cdn.landsearch.com/unavailable.jpg'}
            with patch.object(photos,'ROOT',root),patch.object(photos,'ASSETS',assets),patch.object(photos.requests,'get',side_effect=photos.requests.Timeout):
                retained,status=photos.fetch_photo(update)
                self.assertEqual(retained['image_url'],old['image_url'])
                self.assertIn('previous_preserved',status)
                kept,rejected=photos.require_new_photos([old],[retained,new])
                self.assertEqual([x['id'] for x in kept],['old'])
                self.assertEqual(rejected[0]['reason'],'new_photo_not_preserved')

    def test_image_error_punctuation_is_not_part_of_href(self):
        self.assertEqual(b.clean_image_url('https://cdn.landsearch.com/real.jpg:'),'https://cdn.landsearch.com/real.jpg')
        self.assertEqual(b.clean_image_url('https://images.homes.com/real.jpg?t=p'),'https://images.homes.com/real.jpg?t=p')
    def test_public_cent_values_are_full_dollars_not_down_payment(self):
        p={'id':23386,'cashPrice':800000,'processingFee':49900,'description':'Cash price: $8,000. Owner financing $12,500 with $1,500 down.',
           'stateRegion':'Michigan','type':'house','_source_url':'https://www.landcentury.com/houses-and-buildings/michigan/example','_fetched_at':'2026-09-14',
           'isPublished':True,'info':{},'categories':[]}
        with patch.object(b,'read',return_value={'23386':p}):
            x=b.landcentury_records()[0]
        self.assertEqual((x['price'],x['known_fees'],x['total_known']),(8000,499,8499))

    def test_mortgage_calculator_does_not_turn_cash_sale_into_lease(self):
        url='https://www.landsearch.com/properties/268-e-judson-ave-youngstown-oh-44507/5534291'
        raw='Property ('+url+')\nCrawled: today;\nL1: ## 268 E Judson Ave, Youngstown, OH 44507\nL2: $12,000\nL3: 0.12 acres\nL4: Active sale\nL5: Est $142/mo\nL6: ### Location\nL7: Coordinates\nL8: 41.0629, -80.6505\nL9: County\nL10: Mahoning County\n'
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'ls-details').mkdir();(root/'ls-details'/'one.txt').write_text(raw,encoding='utf-8')
            (root/'ls-photos-test.json').write_text(json.dumps({url:'https://cdn.landsearch.com/test.jpg'}))
            with patch.object(b,'CACHE',root):x=b.landsearch_records()[0]
        self.assertEqual(x['price_basis'],'asking_cash')
        self.assertEqual(x['price'],12000)
        self.assertIsNone(b.acceptable(x))

    def test_disappearance_or_block_does_not_delete_or_mark_sold(self):
        old=[{'id':'old','url':'https://example.org/1','state':'IL','price':5000,'status':'active','image_url':'photo','first_seen':'2025-01-01'}]
        self.assertEqual(b.merge_records(copy.deepcopy(old),[]),old)

    def test_explicit_sale_and_price_changes_preserve_history_and_photo(self):
        old={'id':'old','url':'https://example.org/1','state':'IL','price':5000,'status':'active','image_url':'photo','first_seen':'2025-01-01'}
        newer=dict(old,price=7000,status='sold',image_url=None)
        result=b.merge_records([old],[newer])[0]
        self.assertEqual(result['first_seen'],'2025-01-01');self.assertEqual(result['image_url'],'photo')
        self.assertEqual([p['price'] for p in result['price_history']],[5000,7000])
        self.assertEqual(len(result['status_history']),1)
        again=b.merge_records([result],[newer])[0]
        self.assertEqual(len(again['price_history']),2);self.assertEqual(len(again['status_history']),1)

    def test_generic_county_titles_do_not_merge_distinct_lots(self):
        a={'id':'a','url':'https://example.org/1','address':'Faulk County','city':'Faulkton','county':'Faulk','state':'SD','price':15000}
        c=dict(a,id='b',url='https://example.org/2',price=10000)
        self.assertEqual(len(b.merge_records([a],[c])),2)

    def test_same_parcel_from_two_sources_merges_without_losing_id(self):
        a={'id':'a','url':'https://example.org/1','parcel':'53-117-0-102','county':'Mahoning','state':'OH','price':12000}
        c=dict(a,id='b',url='https://example.net/2')
        merged=b.merge_records([a],[c]);self.assertEqual(len(merged),1);self.assertEqual(merged[0]['id'],'a')
        self.assertEqual(len(merged[0]['alternate_urls']),2)

    def test_future_garage_and_rv_claim_do_not_certify_repair(self):
        x=b.flags_from_text('Land with room for a future garage. RV camping allowed.','land')
        self.assertFalse(x['existing_garage']);self.assertEqual(x['personal_repair'],'unknown')
        self.assertTrue(b.flags_from_text('House with detached 2-car garage.','house')['existing_garage'])

    def test_unconnected_utility_is_not_recorded_as_connected(self):
        x=b.flags_from_text('Water not connected. Sewer not connected.')
        self.assertNotEqual(x['water'],'on_site_claim');self.assertNotEqual(x['sewer'],'on_site_claim')

    def test_known_fees_over_budget_reject_new_candidate(self):
        self.assertEqual(b.acceptable({'price':15000,'total_known':15499}),'known_fees_exceed_budget')

    def test_research_hold_survives_source_refresh_without_changing_sale_status(self):
        old={'id':'held','url':'https://example.org/held','state':'NH','price':10000,
             'total_known':10000,'price_basis':'asking_cash','status':'active','acres':4.6,
             'image_url':'assets/listings/existing.jpg','lat':44.48,'lng':-71.17,
             'first_seen':'2026-09-01','review_hold':{'reason':'Mandatory back taxes unknown','date':'2026-09-16'}}
        refreshed={k:v for k,v in old.items() if k!='review_hold'}
        self.assertIsNone(b.acceptable(refreshed))
        merged=b.merge_records([old],[refreshed])
        self.assertEqual(len(merged),1)
        row=merged[0]
        self.assertEqual(b.acceptable(row),'research_hold')
        self.assertEqual(row['review_hold'],old['review_hold'])
        self.assertEqual((row['status'],row['first_seen'],row['image_url']),('active',old['first_seen'],old['image_url']))

if __name__=='__main__':unittest.main()
