/// <reference types="cypress" />
type Event={method:string,path:string,status:number,authorization_present:boolean};
type Observer={state:'complete'|'partial'|'unavailable'|'error',events:Event[],detail:string|null};
type Scenario={name:string,tags:string[],steps:string[]};
const feature=Cypress.expose('feature') as {name:string,scenarios:Scenario[]};
const selectors=Cypress.expose('selectors') as Record<string,{by:string,value:string,name?:string}>;
const baseline=Cypress.expose('baseline');
const required:Record<string,[string,string,number,boolean][]>={
 'AC-1':[['POST','/users',201,false],['GET','/user',200,true]],
 'AC-2':[['POST','/users/login',200,false],['GET','/user',200,true]],
 'AC-3':[['POST','/users/login',422,false]]
};
function locator(key:string):Cypress.Chainable<JQuery<HTMLElement>>{
 const s=selectors[key];if(!s)throw Error('Unknown contract selector');
 const exact=(t:string)=>new RegExp('^'+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$');
 if(s.by==='label')return cy.contains('label',exact(s.value)).find<HTMLElement>('input');
 if(s.by==='data-testid')return cy.get('[data-testid="'+s.value+'"]');
 if(s.by==='role'){
  if(s.value==='alert')return cy.get('[role="alert"]');
  if(s.value==='button')return cy.contains('button,[role="button"]',exact(s.name!));
  if(s.value==='heading')return cy.contains('h1,h2,h3,h4,h5,h6,[role="heading"]',exact(s.name!));
 }
 throw Error('Unsupported semantic selector');
}
for(const scenario of feature.scenarios){
 const id=scenario.tags.find(t=>/^@AC-[123]$/.test(t))!.slice(1);
 describe(scenario.tags.join(' ')+' '+scenario.name,()=>{
  let identity:any,identityId:string|null,checks:string[],events:Event[],pending:Set<string>,serial:number;
  const fault=Cypress.expose('observerFault');
  const mark=(name:string)=>cy.then(()=>{checks.push(name);});
  function noState(){cy.window({log:false}).should(w=>{expect(Object.keys(w.localStorage)).deep.eq([]);expect(Object.keys(w.sessionStorage)).deep.eq([]);});cy.getCookies({log:false}).should('have.length',0);}
  function user(body:any){
   expect(Object.keys(body)).deep.eq(['user']);const u=body.user;
   expect(Object.keys(u).sort()).deep.eq(['bio','email','image','token','username']);
   expect(u.email).eq(identity.email);expect(u.username).eq(identity.username);expect(u.bio).eq(null);expect(u.image).eq(null);
   expect(typeof u.token==='string'&&/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(u.token),'token shape').eq(true);
  }
  function session(){
   cy.location('pathname').should('eq','/settings');
   cy.window({log:false}).should(w=>{expect(Object.keys(w.localStorage)).deep.eq(['jwt']);expect(Object.keys(w.sessionStorage)).deep.eq([]);});
   cy.getCookies({log:false}).should('have.length',0);
   cy.window({log:false}).then(async w=>{
    const response=await w.fetch('/api/user',{headers:{Authorization:'Token '+w.localStorage.getItem('jwt')}});
    const body=await response.json();return {status:response.status,email:body.user?.email,username:body.user?.username};
   }).should(value=>{expect(value).deep.eq({status:200,email:identity.email,username:identity.username});});
   mark('authenticated-current-user-and-storage');
  }
  beforeEach(()=>{
   identity=baseline.users[0];identityId=null;checks=[];events=[];pending=new Set();serial=0;
   cy.intercept({url:'**/api/**',middleware:true},req=>{
    const url=new URL(req.url),base=new URL(Cypress.config('baseUrl')!);const route=url.pathname.replace(/^\/api/,'');
    if(url.origin!==base.origin||!['/users','/users/login','/user'].includes(route)||!['GET','POST'].includes(req.method)){req.continue();return;}
    req.alias=route==='/users'?'registration':route==='/users/login'?'login':'currentUser';
    const key=String(serial++),auth=Object.keys(req.headers).some(k=>k.toLowerCase()==='authorization');
    if(fault!=='unavailable')pending.add(key);
    req.on('response',res=>{
     if(fault==='unavailable'||fault==='drop-response')return;
     pending.delete(key);events.push({method:req.method,path:route,status:res.statusCode,authorization_present:auth});
    });req.continue();
   });
  });
  afterEach(()=>{
   const complete=required[id].every(([method,path,status,auth])=>events.some(e=>e.method===method&&e.path===path&&e.status===status&&e.authorization_present===auth))&&pending.size===0;
   const state:Observer['state']=fault==='unavailable'?'unavailable':fault==='error'?'error':complete?'complete':'partial';
   const observer:Observer={state,events,detail:state==='complete'?null:'Scenario observation did not complete'};
   cy.task('qa:record',{id,observer,checks,identity_id:identityId},{log:false});
   cy.then(()=>{expect(observer.state,'complete observation required').eq('complete');});
  });
  it('executes the approved Gherkin steps',()=>{
   const steps:Record<string,()=>void>={
    'the immutable synthetic baseline user exists':()=>{expect(baseline.immutable).eq(true);mark('baseline-fixture-loaded');},
    'a fresh browser context has no authentication state':()=>{cy.visit('/login');noState();mark('fresh-cookie-and-storage-context');},
    'a new registration identity unique to this execution and matrix slot':()=>{identityId=crypto.randomUUID().replace(/-/g,'');identity={username:'qa_'+identityId,email:'qa.'+identityId+'@example.test',password:baseline.registration_identity.password};},
    'I open the registration page':()=>{cy.visit('/register');},
    'I open the login page':()=>{cy.visit('/login');},
    'I fill "register.username", "register.email", and "register.password" with that identity':()=>{for(const key of ['username','email','password'])locator('register.'+key).type(identity[key],{log:false});},
    'I fill "login.email" and "login.password" with the baseline credentials':()=>{locator('login.email').type(identity.email,{log:false});locator('login.password').type(identity.password,{log:false});},
    'I fill "login.email" with the baseline email and "login.password" with an invalid password':()=>{locator('login.email').type(identity.email,{log:false});locator('login.password').type(baseline.invalid_login_password,{log:false});},
    'I activate "register.submit"':()=>{locator('register.submit').click();},
    'I activate "login.submit"':()=>{locator('login.submit').click();},
    'registration returns a user and a token':()=>{cy.wait('@registration',{log:false}).then(x=>{expect(x.response?.statusCode).eq(201);user(x.response?.body);});mark('registration-response-contract');},
    'login returns the baseline user and a token':()=>{cy.wait('@login',{log:false}).then(x=>{expect(x.response?.statusCode).eq(200);user(x.response?.body);});mark('baseline-login-response-contract');},
    'the browser has an authenticated session for that identity':session,
    'the browser has an authenticated session for the baseline user':session,
    '"account.identity" shows that identity\'s email on the protected settings page':()=>{locator('account.identity').should('have.text',identity.email);mark('protected-identity');},
    '"account.identity" shows the baseline email on the protected settings page':()=>{locator('account.identity').should('have.text',identity.email);mark('protected-identity');},
    '"login.error" displays "Email or password is invalid."':()=>{cy.wait('@login',{log:false}).then(x=>{expect(x.response?.statusCode).eq(422);expect(x.response?.body).deep.eq({errors:{'email or password':['is invalid']}});});locator('login.error').should('have.text','Email or password is invalid.');mark('rejected-login-response-and-ui');},
    'the browser still has no authentication state':()=>{noState();mark('rejection-no-browser-session');},
    'I navigate directly to the protected settings page':()=>{cy.visit('/settings');},
    'access is denied and the browser is redirected to the login page':()=>{cy.location('pathname').should('eq','/login');mark('protected-route-denied');},
    '"login.heading" is visible and "account.identity" is absent':()=>{locator('login.heading').should('be.visible');locator('account.identity').should('not.exist');noState();mark('protected-identity-absent-and-storage-empty');}
   };
   for(const text of scenario.steps){if(!steps[text])throw Error('Missing implementation for approved step: '+text);steps[text]();}
  });
 });
}
