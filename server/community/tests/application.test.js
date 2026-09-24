import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { createApplication } from '../index.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
test('MySQL OAuth, access control, durable personal rankings and refresh recovery', { skip: !databaseUrl }, async (t) => {
  let clock=Date.now(), identity={id:101,login:'demo',type:'User'}, authChallenge, exchanges=0, failGithub=false;
  const origin='https://lavamilk.test';
  const commits=Array.from({length:22},(_,i)=>({sha:String(i),parents:[{}],repository:{full_name:'demo/repo',private:false},html_url:'https://github.com/demo/repo/commit/'+i,
    author:{login:'demo',type:'User'},commit:{message:'fix',author:{date:'2026-09-22T04:00:00Z',name:'demo'}}}));
  const response=data=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
  const transport=async (url,options={})=> {
    if(url.includes('/login/oauth/access_token')) {
      exchanges++;const params=new URLSearchParams(options.body);
      assert.equal(createHash('sha256').update(params.get('code_verifier')).digest('base64url'),authChallenge);
      return response({access_token:'never-persist-this-github-token'});
    }
    if(url==='https://api.github.com/user') return response(identity);
    if(failGithub) return new Response('{}',{status:429});
    if(url.includes('/users/demo/repos')) return response([{full_name:'demo/repo',owner:{login:'demo'},stargazers_count:1}]);
    if(url.endsWith('/users/demo')) return response({...identity,public_repos:1});
    if(url.includes('/search/commits')) return response({items:commits,total_count:22});
    if(url.includes('/search/issues')) return response({items:[],total_count:0});
    throw new Error('Unexpected upstream URL');
  };
  let app=await createApplication({databaseUrl,origin,clientId:'test-client',clientSecret:'test-secret'}, {fetch:transport,now:()=>clock});
  let server=createServer(app.handler);
  t.after(async () => { if (server.listening) await new Promise(r=>server.close(r)); await app.close(); });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  let base=`http://127.0.0.1:${server.address().port}`;
  const req=(path,opts={})=>fetch(base+'/api/pig-king/'+path,{redirect:'manual',...opts});
  const post=(cookie,data={},o=origin)=>({method:'POST',headers:{Cookie:cookie,Origin:o,'Content-Type':'application/json'},body:JSON.stringify(data)});
  assert.equal((await req('account-scan',post(''))).status,401);
  assert.equal((await req('scan',post(''))).status,404);
  let start=await req('auth/login'), authorize=new URL(start.headers.get('location'));
  assert.equal(authorize.hostname,'github.com');assert.equal(authorize.searchParams.get('scope'),'read:user');
  authChallenge=authorize.searchParams.get('code_challenge');
  const state=authorize.searchParams.get('state'), stateCookie=start.headers.getSetCookie()[0].split(';')[0];
  assert.match(start.headers.getSetCookie()[0],/HttpOnly.*SameSite=Lax.*Secure/);
  await req(`auth/callback?state=${state}&code=ok`);assert.equal(exchanges,0,'Missing state cookie must not exchange code');
  const callback=await req(`auth/callback?state=${state}&code=ok`,{headers:{Cookie:stateCookie}});
  const session=callback.headers.getSetCookie().find(v=>v.startsWith('pig_session=')).split(';')[0];
  await req(`auth/callback?state=${state}&code=ok`,{headers:{Cookie:stateCookie}});assert.equal(exchanges,1,'OAuth state is single use');
  assert.equal((await req('auth/session',{headers:{Cookie:session}})).status,200);
  assert.equal((await req('account-scan',post(session,{},'https://evil.example'))).status,403);
  assert.equal((await req('account-scan',post(session,{account:'victim'}))).status,400);
  let report;
  for(let n=0;n<6;n++){clock+=3000;const r=await req('account-scan',post(session));assert.equal(r.status,200);report=await r.json();}
  assert.equal(report.status,'done');assert.equal(report.report.kind,'User');assert.equal(report.report.eligible,22);
  assert.equal(report.report.ai.status,'unconfigured');
  assert.equal((await (await req('account-leaderboard')).json()).items[0].account,'demo');
  assert.equal((await (await req('account-scan',post(session))).json()).cached,true);
  // Service restart + passage of months must not remove SQL rankings.
  await new Promise(r=>server.close(r));await app.close();clock+=180*86400000;
  app=await createApplication({databaseUrl,origin,clientId:'test-client',clientSecret:'test-secret'},{fetch:transport,now:()=>clock});
  server=createServer(app.handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;
  {
    assert.equal((await (await req('account-leaderboard')).json()).items.length,1);
    assert.equal((await req('account-scan',post(session))).status,401,'Expired sessions cannot scan');
    async function login() {
      const s=await req('auth/login'),u=new URL(s.headers.get('location'));authChallenge=u.searchParams.get('code_challenge');
      return req('auth/callback?state='+u.searchParams.get('state')+'&code=ok',{headers:{Cookie:s.headers.getSetCookie()[0].split(';')[0]}});
    }
    identity={id:202,login:'an-org',type:'Organization'};
    assert.match((await login()).headers.get('location'),/oauthFailed/);
    assert.equal((await (await req('account-leaderboard')).json()).items.length,1);
    identity={id:101,login:'demo',type:'User'};
    const fresh=(await login()).headers.getSetCookie().find(v=>v.startsWith('pig_session=')).split(';')[0];
    failGithub=true;clock+=3000;
    assert.equal((await req('account-scan',post(fresh))).status,429);
    assert.equal((await (await req('account-leaderboard')).json()).items.length,1,'Failed refresh retains previous report');
    assert.equal((await req('auth/logout',post(fresh))).status,200);
    assert.equal((await req('account-scan',post(fresh))).status,401);
    assert(!JSON.stringify(await (await req('account-report/demo')).json()).includes('never-persist'));
  }
});
