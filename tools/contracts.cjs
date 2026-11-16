const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),FEATURES=path.join(ROOT,'qa-features');
const REF=fs.readFileSync(path.join(ROOT,'feature-ref.txt'),'utf8').trim();
const load=name=>JSON.parse(fs.readFileSync(path.join(FEATURES,name),'utf8'));
const git=(cwd,...args)=>cp.execFileSync('git',['-C',cwd,...args],{encoding:'utf8'}).trim();
function verify(){
 if(git(FEATURES,'rev-parse','HEAD')!==REF||git(FEATURES,'status','--porcelain'))throw Error('Approved feature checkout moved or is dirty');
 if(git(ROOT,'ls-files','--stage','qa-features').split(/\s+/).slice(0,2).join(' ')!=='160000 '+REF)throw Error('Feature gitlink moved');
 if(git(ROOT,'config','--file','.gitmodules','submodule.qa-features.url')!=='../qa-features.git')throw Error('Relative submodule URL required');
 return REF;
}
function revision(){
 const names=['package.json','package-lock.json','feature-ref.txt','.gitmodules','cypress.config.ts'];
 for(const prefix of ['cypress','runner','tools']){
  function walk(dir){for(const e of fs.readdirSync(path.join(ROOT,dir),{withFileTypes:true})){const n=dir+'/'+e.name;if(e.isDirectory())walk(n);else if(/\.(ts|cjs|py)$/.test(n))names.push(n);}}
  walk(prefix);
 }
 const h=crypto.createHash('sha256');for(const name of names.sort())h.update(name+'\0').update(fs.readFileSync(path.join(ROOT,name))).update('\0');return h.digest('hex');
}
function feature(){
 const {generateMessages}=require('@cucumber/gherkin'),{IdGenerator,SourceMediaType}=require('@cucumber/messages');
 const file='features/auth/login.feature',source=fs.readFileSync(path.join(FEATURES,file),'utf8');
 const messages=generateMessages(source,file,SourceMediaType.TEXT_X_CUCUMBER_GHERKIN_PLAIN,{newId:IdGenerator.incrementing(),includeGherkinDocument:true,includePickles:false,includeSource:false});
 if(messages.some(e=>e.parseError))throw Error('Invalid pinned Gherkin');
 const doc=messages.find(e=>e.gherkinDocument)?.gherkinDocument; if(!doc?.feature)throw Error('Missing feature');
 const f=doc.feature,background=f.children.find(c=>c.background)?.background.steps||[];
 const scenarios=f.children.filter(c=>c.scenario).map(c=>({name:c.scenario.name,tags:[...f.tags,...c.scenario.tags].map(t=>t.name),steps:[...background,...c.scenario.steps].map(s=>s.text)}));
 if(scenarios.length!==3)throw Error('Exactly three approved scenarios required');return {name:f.name,scenarios};
}
module.exports={ROOT,FEATURES,REF,load,verify,revision,feature};
