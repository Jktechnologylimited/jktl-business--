import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import ts from 'typescript';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import {PGlite} from '@electric-sql/pglite';
import * as gameRequest from '../src/lib/security/game-request.ts';
import {parseGame, newGame} from '../src/lib/tycoon.ts';

function load(file, dependencies) {
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url),'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  new Function('require','module','exports',code)(name=>{
    if (!(name in dependencies)) throw Error('Unmocked dependency: '+name);
    return dependencies[name];
  },module,module.exports);
  return module.exports;
}
const json = (body,options) => Response.json(body,options);
const origin='https://business.jktl.com.ng';
const req=(body,headers={})=>new Request(origin+'/api/tycoon',{method:'PUT',headers:{host:'business.jktl.com.ng',origin,'content-type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)});

test('game body reader bounds streamed UTF-8 bytes, rejects scalar/null and malformed JSON', async()=>{
  for (const body of ['null','[]','false','{broken']) await assert.rejects(gameRequest.readGameDocument(req(body)),e=>e.status===400);
  await assert.rejects(gameRequest.readGameDocument(req('{}',{'content-type':'text/plain'})),e=>e.status===415);
  await assert.rejects(gameRequest.readGameDocument(req(JSON.stringify({x:'😊'.repeat(4000)}))),e=>e.status===413);
  let cancelled=false;
  const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(12001));},cancel(){cancelled=true;}});
  await assert.rejects(gameRequest.readGameDocument(new Request(origin,{method:'PUT',body:stream,duplex:'half',headers:{'content-type':'application/json'}})),e=>e.status===413);
  assert.equal(cancelled,true);
  assert.deepEqual(await gameRequest.readGameDocument(req({document:newGame(),revision:0})),{document:newGame(),revision:0});
});
test('game write rejects cross-origin, missing/malformed Origin, protocol downgrade and hostile hosts',()=>{
  assert.equal(gameRequest.sameOriginGameWrite(req({})),true);
  for(const value of ['https://evil.example','null','http://business.jktl.com.ng','https://business.jktl.com.ng.evil.example'])
    assert.equal(gameRequest.sameOriginGameWrite(req({}, {origin:value})),false);
  assert.equal(gameRequest.sameOriginGameWrite(req({}, {host:'evil.example'})),false);
  const missing=req({});missing.headers.delete('origin');assert.equal(gameRequest.sameOriginGameWrite(missing),false);
  const previous=process.env.NODE_ENV;process.env.NODE_ENV='production';
  try {
    assert.equal(gameRequest.sameOriginGameWrite(new Request('http://internal-proxy:3000/api/tycoon',{headers:{host:'business.jktl.com.ng',origin}})),true);
    assert.equal(gameRequest.sameOriginGameWrite(req({}, {origin:'http://business.jktl.com.ng'})),false);
  } finally {if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;}
});
test('game API rate limits fail closed, reports outages honestly and never writes another account',async()=>{
  let writes=0, blocked=false, outage=false;
  class AuthRateLimitError extends Error{}
  const route=load('../src/app/api/tycoon/route.ts',{
    'next/server':{NextResponse:{json}},'@/lib/session':{getSession:async()=>({userId:'player-a'})},
    '@/lib/db/client':{getSql:()=>async(parts,...args)=>{writes++;assert.ok(args.includes('player-a'));assert.ok(!args.includes('player-b'));return[{revision:1}];}},
    '@/lib/tycoon':{parseGame},'@/lib/security/game-request':gameRequest,
    '@/lib/security/auth-rate-limit':{AuthRateLimitError,authRateLimit:async()=>{if(outage)throw Error('DB unavailable');if(blocked)throw new AuthRateLimitError();}},
  });
  assert.equal((await route.PUT(req({document:newGame(),revision:0,userId:'player-b'}))).status,200);
  blocked=true;
  const limited=await route.PUT(req({document:newGame(),revision:1}));
  assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'60');assert.equal(writes,1);
  assert.equal((await route.GET()).status,429);
  outage=true;assert.equal((await route.PUT(req({document:newGame(),revision:1}))).status,503);
  assert.equal(writes,1);
});

// Optional real PostgreSQL exercises independent connections and row locking.
// Normal CI uses the existing PGlite dependency; never touches a remote DB.
async function database() {
  const url=process.env.JKTL_SECURITY_TEST_DATABASE_URL;
  if (!url) { const db=new PGlite();return{query:(q,p)=>db.query(q,p),exec:q=>db.exec(q),close:()=>db.close()}; }
  const u=new URL(url);
  if (!['127.0.0.1','localhost'].includes(u.hostname)||!u.pathname.endsWith('_test')) throw Error('Security tests require a disposable local _test database');
  const schema='audit_'+randomUUID().replaceAll('-','');
  const admin=new pg.Pool({connectionString:url});await admin.query('CREATE SCHEMA '+schema);
  const pool=new pg.Pool({connectionString:url,options:'-c search_path='+schema});
  return{query:(q,p)=>pool.query(q,p),exec:q=>pool.query(q),close:async()=>{await pool.end();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();}};
}
test('Business credential changes are atomic, single-use, revoke sessions and retain user isolation',async()=>{
  const db=await database();
  try {
    await db.exec(`CREATE TABLE users(id uuid PRIMARY KEY,email text,password_hash text);
      CREATE TABLE organization_members(user_id uuid,organization_id uuid,active boolean,created_at timestamptz DEFAULT now());
      CREATE TABLE sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,organization_id uuid,expires_at timestamptz);
      CREATE TABLE password_reset_tokens(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,token_hash text UNIQUE,used_at timestamptz,expires_at timestamptz);
      CREATE TABLE domain_rate_limits(bucket text PRIMARY KEY,hits integer NOT NULL,expires_at timestamptz NOT NULL);`);
    const sql=async(parts,...values)=>(await db.query(parts.reduce((s,p,i)=>s+p+(i<values.length?'$'+(i+1):''),''),values)).rows;
    sql.query=async(q,p)=>(await db.query(q,p)).rows;
    const store=load('../src/lib/domains/store.ts',{'./model':{}});
    const limits=load('../src/lib/security/auth-rate-limit.ts',{'server-only':{},'node:crypto':await import('node:crypto'),'@/lib/db/client':{getSql:()=>sql},'@/lib/domains/store':store});
    const attempts=await Promise.allSettled(Array.from({length:3},()=>limits.authRateLimit('sensitive-account@example.test','login',2,600)));
    assert.equal(attempts.filter(r=>r.status==='fulfilled').length,2);
    assert.ok(attempts.find(r=>r.status==='rejected').reason instanceof limits.AuthRateLimitError);
    const buckets=(await db.query('SELECT bucket FROM domain_rate_limits')).rows;
    assert.ok(!JSON.stringify(buckets).includes('sensitive-account@example.test'));
    const auth=load('../src/lib/db/auth.ts',{'bcryptjs':{default:bcrypt},'node:crypto':await import('node:crypto'),'./client':{getSql:()=>sql},'@/lib/security/auth-rate-limit':{authRateLimit:async()=>{}}});
    const a=randomUUID(),b=randomUUID(),org=randomUUID();
    const hash=await bcrypt.hash('old-local-password',4);
    for(const id of [a,b]){
      await db.query('INSERT INTO users VALUES($1,$2,$3)',[id,id+'@example.test',hash]);
      await db.query('INSERT INTO organization_members VALUES($1,$2,true)',[id,org]);
      await db.query("INSERT INTO sessions(user_id,organization_id,expires_at) VALUES($1,$2,now()+interval '1 day')",[id,org]);
    }
    const aSession=(await db.query('SELECT id FROM sessions WHERE user_id=$1',[a])).rows[0].id;
    assert.equal((await auth.validateSession(aSession)).userId,a);
    await db.query('UPDATE organization_members SET active=false WHERE user_id=$1',[a]);
    assert.equal(await auth.validateSession(aSession),null);
    assert.equal(await auth.verifyLogin(a+'@example.test','old-local-password'),null);
    await db.query('UPDATE organization_members SET active=true WHERE user_id=$1',[a]);
    assert.equal(await auth.validateSession("' OR 1=1--"),null);
    assert.equal(await auth.consumePasswordResetToken("' OR 1=1--",'valid-password'),false);
    const token=await auth.createPasswordResetToken(a);
    await db.exec(`CREATE FUNCTION audit_reject_password() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'local test failure'; END $$;
      CREATE TRIGGER audit_password_failure BEFORE UPDATE OF password_hash ON users FOR EACH ROW EXECUTE FUNCTION audit_reject_password();`);
    try { await assert.rejects(auth.consumePasswordResetToken(token,'new-password-one')); }
    finally { await db.exec('DROP TRIGGER audit_password_failure ON users; DROP FUNCTION audit_reject_password();'); }
    // The same token is still usable because failure rolled back consumption.
    // A second, older reset link must also be invalidated after success.
    const other=await auth.createPasswordResetToken(a);
    const outcomes=await Promise.all([auth.consumePasswordResetToken(token,'new-password-one'),auth.consumePasswordResetToken(token,'new-password-two')]);
    assert.equal(outcomes.filter(Boolean).length,1);
    assert.equal(await auth.consumePasswordResetToken(other,'new-password-three'),false);
    assert.equal(await auth.validateSession(aSession),null);
    assert.equal((await db.query('SELECT * FROM sessions WHERE user_id=$1',[b])).rows.length,1);
    assert.equal((await db.query('SELECT password_hash FROM users WHERE id=$1',[b])).rows[0].password_hash,hash);
    const password=(await bcrypt.compare('new-password-one',(await db.query('SELECT password_hash FROM users WHERE id=$1',[a])).rows[0].password_hash))?'new-password-one':'new-password-two';
    assert.equal(await auth.changePassword(a,'wrong-password','valid-new-password'),false);
    await db.query("INSERT INTO sessions(user_id,organization_id,expires_at) VALUES($1,$2,now()+interval '1 day')",[a,org]);
    assert.equal(await auth.changePassword(a,password,'valid-new-password'),true);
    assert.equal((await db.query('SELECT * FROM sessions WHERE user_id=$1',[a])).rows.length,0);
    assert.equal(auth.validNewPassword('a'.repeat(73)),false);
    assert.equal(auth.validNewPassword('😊'.repeat(19)),false);
    assert.equal(auth.validNewPassword('a'.repeat(72)),true);
  } finally {await db.close();}
});

test('Business recovery uses configured account origin, never request Host',async()=>{
  let message, limits=0;
  const previous=process.env.NEXT_PUBLIC_APP_URL;process.env.NEXT_PUBLIC_APP_URL=origin;
  const actions=load('../src/lib/actions/auth-actions.ts',{
    '@/lib/distribution/referrals':{},'next/headers':{headers:async()=>new Headers({host:'hostile.example','x-real-ip':'203.0.113.8'})},
    '@/lib/db/auth':{findUserByEmail:async()=>({id:'a',email:'a@example.test',name:'A'}),createPasswordResetToken:async()=> 'local-test-token'},
    '@/lib/db/organizations':{},'@/lib/session':{},'@/lib/email':{sendPasswordResetEmail:async m=>{message=m;}},
    '@/lib/security/auth-rate-limit':{authRateLimit:async()=>{limits++;}},
  });
  try{
    assert.equal((await actions.requestPasswordResetAction('a@example.test')).ok,true);
    assert.equal(new URL(message.resetUrl).origin,origin);assert.equal(limits,2);
    assert.equal((await actions.requestPasswordResetAction('not-an-email')).ok,true);
  }finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_APP_URL;else process.env.NEXT_PUBLIC_APP_URL=previous;}
});
