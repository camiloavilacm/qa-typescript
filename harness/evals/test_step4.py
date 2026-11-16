from pathlib import Path
import sys,unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from common import ROOT,read,digest
from verify_step import command
class Step4(unittest.TestCase):
 def test_registered_repo_local_checks(self):
  for name in ('6-passes','result-schema'):self.assertEqual(command(ROOT,name),[sys.executable,str(ROOT/'tools/verify.py'),'--check',name])
 def test_provenance(self):
  for name,row in read(ROOT/'governance/adapter-revision.json')['files'].items():
   self.assertEqual(digest((ROOT/name).read_bytes()),row['adapter_sha256'])
   self.assertEqual(digest((ROOT/'qa-features/governance/source'/name).read_bytes()),row['upstream_sha256'])
if __name__=='__main__':unittest.main()
