import io
import json
import sys
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from build_glyphs import candidate

suite=unittest.defaultTestLoader.discover(str(ROOT/'tests'),pattern='test_glyph_pipeline.py')
stream=io.StringIO();result=unittest.TextTestRunner(stream=stream,verbosity=2).run(suite)
outline='M 100 500 L 900 500 L 900 550 L 100 550 Z'
proposal=candidate('<synthetic-rectangle-fixture>','test-fixture',{'strokes':[outline],'medians':[[]]})
report={'date':'2026-10-30','scope':'offline pipeline unit/fault fixtures; fixtures never enter the 3500-character registry','testsRun':result.testsRun,'pass':result.wasSuccessful(),'failures':len(result.failures),'errors':len(result.errors),'output':stream.getvalue(),'missingMedianFixture':proposal}
(ROOT/'analysis/chinese/pipeline-tests.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(stream.getvalue());sys.exit(0 if result.wasSuccessful() else 1)
