const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const {ROOT}=require('./contracts.cjs');
const modules=process.env.QA_CYPRESS_MODULE_DIR||path.join(ROOT,'node_modules');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qa-tscheck-'));
try{
 const conf={compilerOptions:{target:'ES2022',module:'Node16',moduleResolution:'Node16',strict:true,noEmit:true,skipLibCheck:true,esModuleInterop:true,types:['cypress','node'],typeRoots:[modules,path.join(modules,'@types')]},files:[path.join(ROOT,'cypress.config.ts'),path.join(ROOT,'cypress/e2e/auth.cy.ts')]};
 fs.writeFileSync(path.join(dir,'tsconfig.json'),JSON.stringify(conf));
 const p=cp.spawnSync(process.execPath,[path.join(modules,'typescript/bin/tsc'),'--project',path.join(dir,'tsconfig.json')],{cwd:ROOT,stdio:'inherit'});process.exitCode=p.status||0;
}finally{fs.rmSync(dir,{recursive:true,force:true});}
