const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
if(process.env.QA_CYPRESS_MODULE_DIR){process.env.NODE_PATH=process.env.QA_CYPRESS_MODULE_DIR;require('node:module').Module._initPaths();}
const {ROOT,verify,revision}=require('./contracts.cjs'),{finish}=require('../runner/report.cjs');
async function main(){
 verify();const sut=process.env.QA_SUT;if(!['sut-python','sut-node'].includes(sut))throw Error('QA_SUT required');
 const key=sut.toUpperCase().replaceAll('-','_'),sutRevision=process.env['QA_'+key+'_REVISION'];
 if(!/^[a-f0-9]{40}([a-f0-9]{24})?$/.test(sutRevision||''))throw Error('Immutable SUT revision required');
 const toolingRef=process.env.QA_TOOLING_REF||null;
 if(toolingRef&&!/^[a-f0-9]{40}([a-f0-9]{24})?$/.test(toolingRef))throw Error('Immutable tooling revision required');
 const directory=path.resolve(process.env.QA_RESULT_DIR||'');
 if(!directory.startsWith(path.join(ROOT,'reports')+path.sep)||fs.existsSync(directory))throw Error('A fresh directory under reports/ is required');
 fs.mkdirSync(directory,{recursive:true});process.env.QA_RESULT_DIR=directory;
 const options={sut,sutRevision,directory,toolingRef,execution:crypto.randomUUID(),campaign:process.env.QA_CAMPAIGN_ID||'step4-acceptance',revision:revision(),started:new Date().toISOString()};
 const cypress=require('cypress');
 let run;
 try{run=await cypress.run({project:ROOT,configFile:path.join(ROOT,'cypress.config.ts'),browser:'electron',headless:true,record:false,config:{baseUrl:process.env['QA_'+key+'_URL']||'http://localhost:'+(sut==='sut-python'?'8001':'8002'),video:false,screenshotOnRunFailure:false,screenshotsFolder:path.join(directory,'screenshots'),downloadsFolder:path.join(directory,'downloads')}});}
 catch(error){run={status:'failed',totalTests:0};console.error('Cypress startup or execution failed:',error.name);}
 let records={};const observations=path.join(directory,'observations.json');if(fs.existsSync(observations))records=JSON.parse(fs.readFileSync(observations,'utf8'));
 const result=finish(options,records,run);
 console.log('RESULT',result.slot_id,result.status);process.exitCode=result.status==='passed'&&run.totalPassed===3&&run.totalFailed===0?0:1;
}
main().catch(error=>{console.error(error.name+': '+error.message);process.exitCode=1;});
