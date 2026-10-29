import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from build_glyphs import candidate,select_candidate

class PipelineTests(unittest.TestCase):
    outline='M 100 500 L 900 500 L 900 550 L 100 550 Z'
    def test_duplicate_point_repair_is_deterministic_and_revalidated(self):
        r=candidate('<fixture>','fixture',{'strokes':[self.outline],'medians':[[[110,525],[110,525],[890,525]]]})
        self.assertTrue(r['pass']);self.assertEqual(r['repairs'][0]['kind'],'remove_consecutive_duplicate_points');self.assertEqual(r['metrics'][0]['interiorRatio'],1)
    def test_missing_median_produces_real_skeleton_but_remains_quarantined(self):
        r=candidate('<fixture>','fixture',{'strokes':[self.outline],'medians':[[]]})
        self.assertFalse(r['pass']);p=r['proposals'][0];self.assertGreater(len(p['median']),2);self.assertFalse(p['approved']);self.assertEqual(p['status'],'needs-independent-route-review')
        self.assertTrue(all(100<=x<=900 and 500<=y<=550 for x,y in p['median']))
    def test_completely_missing_median_array_also_attempts_derivation(self):
        r=candidate('<fixture>','fixture',{'strokes':[self.outline]})
        self.assertFalse(r['pass']);self.assertTrue(r['proposals']);self.assertFalse(r['proposals'][0]['approved'])
    def test_bad_original_route_is_not_silently_replaced_by_an_interior_skeleton(self):
        r=candidate('<fixture>','fixture',{'strokes':[self.outline],'medians':[[[110,400],[890,400]]]})
        self.assertFalse(r['pass']);self.assertTrue(r['proposals']);self.assertFalse(r['proposals'][0]['approved'])
    def test_hard_failures_precede_scores_and_primary_wins_only_near_ties(self):
        self.assertEqual(select_candidate({'pass':False,'score':200},{'pass':True,'score':95})['score'],95)
        self.assertEqual(select_candidate({'pass':True,'score':99.8},{'pass':True,'score':100})['score'],99.8)
        self.assertEqual(select_candidate({'pass':True,'score':97},{'pass':True,'score':100})['score'],100)
    def test_malformed_source_is_isolated_instead_of_crashing_the_batch(self):
        for data in [None,[],{'strokes':None},{'strokes':[self.outline],'medians':None},{'strokes':[self.outline],'medians':[None,None]},{'strokes':[self.outline],'medians':[None]}]:
            self.assertFalse(candidate('<fixture>','fixture',data)['pass'])
    def test_new_selection_preserves_every_existing_qualified_choice(self):
        root=Path(__file__).resolve().parents[1];r=json.loads((root/'analysis/chinese/glyph-quality.json').read_text(encoding='utf8'))
        for record in r['sourceComparison']:
            chosen=select_candidate(record['primary'],record['backup']);self.assertEqual(chosen['source'] if chosen else None,record['selected'])

if __name__=='__main__':unittest.main()
