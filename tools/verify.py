"""Registered Step 4 checks; schema and semantic validation of real Cypress results."""
from pathlib import Path
import argparse,os,subprocess,json,uuid,hashlib,sys,re,copy,datetime as dt
from jsonschema import Draft202012Validator,FormatChecker
ROOT=Path(__file__).resolve().parents[1]
NODE=os.environ.get('QA_NODE_BINARY','node')
def hashfile(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def validate(value,directory):
    schema=json.loads((ROOT/'qa-features/schemas/results.schema.json').read_text())
    Draft202012Validator(schema,format_checker=FormatChecker()).validate(value)
    assert value['status']==next(s for s in ('error','failed','not_run','passed')if any(r['status']==s for r in value['scenarios']))
    assert dt.datetime.fromisoformat(value['started_at'])<=dt.datetime.fromisoformat(value['finished_at'])
    assert value['feature_ref']==(ROOT/'feature-ref.txt').read_text().strip()
    assert {r['id'] for r in value['scenarios']}=={'AC-1','AC-2','AC-3'}
    required={'AC-1':{('POST','/users',201,False),('GET','/user',200,True)},'AC-2':{('POST','/users/login',200,False),('GET','/user',200,True)},'AC-3':{('POST','/users/login',422,False)}}
    for row in value['scenarios']:
        observer=row['observer']
        if observer['state']=='complete' or row['status']=='passed':
            assert observer['state']=='complete'
            assert required[row['id']]<={(e['method'],e['path'],e['status'],e['authorization_present'])for e in observer['events']}
        assert {a['kind']for a in row['artifacts']}=={'network','log'}
        for item in row['artifacts']:
            path=directory/item['path'];assert not path.is_symlink() and path.resolve().is_relative_to(directory.resolve())
            assert hashfile(path)==item['sha256'];data=path.read_bytes();content=json.loads(data)
            assert not re.search(rb'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',data)
            if item['kind']=='network':assert content==observer
            else:
                assert set(content)=={'scenario','outcome','checks','identity_id','slot_id','execution_id','runner_revision','sut_revision'}
                assert content['outcome']==row['status'] and content['scenario']==row['id']
                for key in ('slot_id','execution_id','runner_revision','sut_revision'):assert content[key]==value[key]
                if row['status']=='passed':assert len(content['checks'])>=4
    return value

def execute(sut,directory,fault=None):
    env=dict(os.environ);env.update(QA_SUT=sut,QA_RESULT_DIR=str(directory));env.pop('QA_OBSERVER_FAULT',None)
    if fault:env['QA_OBSERVER_FAULT']=fault
    args=[NODE,'tools/run.cjs'];p=subprocess.run(args,cwd=ROOT,env=env,capture_output=True,text=True,timeout=240)
    directory.parent.mkdir(parents=True,exist_ok=True);(directory.parent/(directory.name+'.log')).write_text(p.stdout+'\nSTDERR:\n'+p.stderr)
    assert (directory/'results.json').exists(),p.stdout+p.stderr
    result=json.loads((directory/'results.json').read_text());validate(result,directory)
    return p.returncode,result

def matrix():
    p=subprocess.run([NODE,'tools/typecheck.cjs'],cwd=ROOT);assert p.returncode==0,'TypeScript typecheck failed'
    batch=ROOT/'reports'/uuid.uuid4().hex;batch.mkdir(parents=True);entries=[];hashes={}
    for sut in ('sut-python','sut-node'):
        directory=batch/sut;code,result=execute(sut,directory)
        print(result['slot_id'],result['status'],flush=True);assert code==0 and result['status']=='passed',str(directory)
        assert len(result['scenarios'])==3 and all(r['status']=='passed' for r in result['scenarios'])
        relative=str(directory.relative_to(ROOT));entries.append(relative);hashes[relative]=hashfile(directory/'results.json')
    (ROOT/'reports/latest.json').write_text(json.dumps({'directories':entries,'hashes':hashes},indent=2)+'\n')
    print('RESULT_RECEIPT_SHA256',hashfile(ROOT/'reports/latest.json'));print('PASS: six real Cypress scenarios')

def verify_saved():
    receipt=json.loads((ROOT/'reports/latest.json').read_text());slots=set();identities=set()
    current_revision=subprocess.check_output([NODE,'-e',"const c=require('./tools/contracts.cjs');c.verify();console.log(c.revision())"],cwd=ROOT,text=True).strip()
    for relative in receipt['directories']:
        directory=ROOT/relative;assert directory.resolve().is_relative_to(ROOT/'reports')
        assert hashfile(directory/'results.json')==receipt['hashes'][relative]
        value=validate(json.loads((directory/'results.json').read_text()),directory);assert value['status']=='passed';slots.add(value['slot_id'])
        assert value['runner_revision']==current_revision
        identity=json.loads((directory/'AC-1/checks.json').read_text())['identity_id'];assert re.fullmatch('[a-f0-9]{32}',identity) and identity not in identities;identities.add(identity)
    assert slots=={'sut-python:cypress','sut-node:cypress'}
    print('RESULT_RECEIPT_SHA256',hashfile(ROOT/'reports/latest.json'))

def result_schema():
    verify_saved();receipt=json.loads((ROOT/'reports/latest.json').read_text());directory=ROOT/receipt['directories'][0];value=json.loads((directory/'results.json').read_text())
    # Schema and semantic acceptance must reject misleading or forged successes.
    for mutate in (lambda v:v['scenarios'][0]['observer'].update(state='partial'),lambda v:v['scenarios'][0]['observer'].update(events=[]),lambda v:v['scenarios'][0]['artifacts'][0].update(sha256='0'*64)):
        bad=copy.deepcopy(value);mutate(bad)
        try:validate(bad,directory)
        except Exception:pass
        else:raise AssertionError('Invalid result accepted')
    batch=ROOT/'reports'/('faults-'+uuid.uuid4().hex);batch.mkdir()
    for fault,expected in [('unavailable','unavailable'),('drop-response','partial'),('error','error')]:
        code,result=execute('sut-python',batch/fault,fault)
        assert code!=0 and result['status']!='passed'
        assert all(row['observer']['state']==expected and row['status']=='error' for row in result['scenarios'])
    print('PASS: schema, semantic integrity, tamper rejection and live observer failure paths')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--check',choices=['6-passes','result-schema'],required=True);a=p.parse_args()
    try:(matrix if a.check=='6-passes' else result_schema)()
    except Exception as e:print(type(e).__name__+': '+str(e),file=sys.stderr);sys.exit(1)
