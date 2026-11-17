"""Import bundled Git objects offline, without changing Git transport policy."""
from pathlib import Path
import subprocess
ROOT=Path(__file__).resolve().parents[1]
REF=(ROOT/'feature-ref.txt').read_text().strip()
def run(args):return subprocess.run(args,check=True,capture_output=True,text=True).stdout.strip()
def bootstrap():
    target=ROOT/'qa-features'
    assert not target.is_symlink(), 'Submodule path must not be a symlink'
    if target.exists() and any(target.iterdir()):
        assert (target/'.git').exists(), 'Nonempty submodule directory is not initialized Git'
        assert run(['git','-C',str(target),'rev-parse','HEAD'])==REF
        assert not run(['git','-C',str(target),'status','--porcelain'])
        print('Pinned submodule already present');return
    target.mkdir(exist_ok=True)
    run(['git','init','--quiet',str(target)])
    run(['git','-C',str(target),'bundle','unbundle',str(ROOT/'bootstrap/qa-features.bundle')])
    run(['git','-C',str(target),'checkout','--quiet','--detach',REF])
    run(['git','-C',str(ROOT),'update-index','--add','--cacheinfo','160000,'+REF+',qa-features'])
    run(['git','-C',str(ROOT),'submodule','absorbgitdirs','qa-features'])
    assert run(['git','-C',str(target),'rev-parse','HEAD'])==REF
    print('Imported approved submodule objects; no file-transport override')
if __name__=='__main__':bootstrap()
