const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {ROOT,REF,revision}=require('../tools/contracts.cjs');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');};
function artifact(dir,name,value,kind){const p=path.join(dir,name);write(p,value);return {path:name,sha256:hash(fs.readFileSync(p)),kind};}
function finish(options,records,run){
 const dir=options.directory;
 const tests=(run.runs||[]).flatMap(r=>r.tests||[]);
 const scenarios=['AC-1','AC-2','AC-3'].map(id=>{
  const test=tests.find(t=>t.title.some(x=>x.includes('@'+id))),record=records[id];
  let status=!test?'not_run':test.state==='passed'?'passed':test.state==='failed'?'failed':'not_run';
  const observer=record?.observer||{state:'unavailable',events:[],detail:'No scenario observation'};
  if(test&&(!record||observer.state!=='complete'))status='error';
  const checks={scenario:id,outcome:status,checks:record?.checks||[],identity_id:record?.identity_id||null,slot_id:options.sut+':cypress',execution_id:options.execution,runner_revision:options.revision,sut_revision:options.sutRevision};
  return {id,status,duration_ms:test?.attempts?.reduce((n,a)=>n+(a.wallClockDuration||0),0)||0,observer,artifacts:[artifact(dir,id+'/network.json',observer,'network'),artifact(dir,id+'/checks.json',checks,'log')],error:status==='passed'?null:'Scenario, hook or observation did not complete successfully'};
 });
 const status=['error','failed','not_run','passed'].find(s=>scenarios.some(r=>r.status===s));
 const result={schema_version:'1.0',issue_id:'SEED-1',campaign_id:options.campaign,execution_id:options.execution,feature_ref:REF,tooling_ref:options.toolingRef||null,slot_id:options.sut+':cypress',sut_revision:options.sutRevision,runner_revision:options.revision,started_at:options.started,finished_at:new Date().toISOString(),status,scenarios};
 if(run.status==='failed'||run.totalFailed||run.totalTests!==3){if(result.status==='passed'){result.status='error';result.scenarios[0].status='error';result.scenarios[0].error='Cypress run integrity failure';}}
 write(path.join(dir,'results.json'),result);return result;
}
module.exports={write,hash,finish};
