const {defineConfig}=require('cypress');
const fs=require('node:fs'),path=require('node:path');
const {ROOT,load,feature}=require('./tools/contracts.cjs');
const esbuild=require('esbuild');
module.exports=defineConfig({
 video:false,screenshotOnRunFailure:false,retries:0,defaultCommandTimeout:8000,
 e2e:{supportFile:false,specPattern:'cypress/e2e/auth.cy.ts',testIsolation:true,
  setupNodeEvents(on:Cypress.PluginEvents,config:Cypress.PluginConfigOptions){
   const records:Record<string,unknown>={};
   on('task',{
    'qa:record'(record:{id:string}){if(!['AC-1','AC-2','AC-3'].includes(record.id))throw Error('Unknown AC');records[record.id]=record;return null;},
    'qa:records'(){return records;}
   });
   on('file:preprocessor',async(file:Cypress.FileObject)=>{
    await esbuild.build({entryPoints:[file.filePath],bundle:true,outfile:file.outputPath,platform:'browser',nodePaths:process.env.QA_CYPRESS_MODULE_DIR?[process.env.QA_CYPRESS_MODULE_DIR]:[],sourcemap:false});return file.outputPath;
   });
   config.expose={...config.expose,feature:feature(),selectors:load('selectors.json').selectors,baseline:load('data/baseline.json'),observerFault:process.env.QA_OBSERVER_FAULT||null};
   on('after:run',()=>{fs.writeFileSync(path.join(process.env.QA_RESULT_DIR!,'observations.json'),JSON.stringify(records,null,2)+'\n');});
   return config;
  }
 }
});
