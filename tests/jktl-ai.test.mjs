import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {load} from './fixtures/lifecycle-db.mjs';
import * as model from '../src/lib/support/model.ts';
const knowledge=load('src/lib/support/knowledge.ts',{'@/lib/knowledge/additions':load('src/lib/knowledge/additions.ts')});

test('organogram contains six roles and reporting lines without fetching or rendering people',async()=>{
 const chart=load('src/components/admin/team-organogram.tsx');
 const html=renderToStaticMarkup(createElement(chart.TeamOrganogram,{members:[{name:'Private Person',role:'support'}]}));
 for(const role of ['Founder','Executive Associate','Customer Success &amp; Support','Growth &amp; Gaming','Affiliate &amp; Partner Operations','Editorial &amp; Communications'])assert.ok(html.includes(role),role);
 assert.doesNotMatch(html,/John|Beke|Private Person|Active role accounts/i);
 let guards=0,reads=0;
 const page=load('src/app/admin/(command)/team/structure/page.tsx',{
  '@/lib/admin-page-guard':{guardAdminPage:async cap=>{assert.equal(cap,'view_team_structure');guards++;}},
  '@/components/admin/team-organogram':chart,'@/components/app/page-header':{PageHeader:()=>null},
  '@/lib/db/client':{getSql:()=>{reads++;throw Error('Chart must not read member identities');}},
 }).default;
 renderToStaticMarkup(await page());assert.equal(guards,1);assert.equal(reads,0);
});

test('retrieved help supplies real product links and rejects invented destinations',()=>{
 const guides=knowledge.relevantGuides('How do I publish my first free website?');
 assert.ok(guides.length && guides.length<=3);
 assert.equal(knowledge.safeGuideLinks('Open '+guides[0].route+'.',guides),true);
 assert.equal(knowledge.safeGuideLinks('Read /help/'+guides[0].id,guides),true);
 assert.equal(knowledge.safeGuideLinks('Go to https://evil.example/checkout',guides),false);
 assert.equal(knowledge.safeGuideLinks('Go to https://business.jktl.com.ng/admin/team',guides),false);
 assert.equal(knowledge.safeGuideLinks('Use /invented-account-tool',guides),false);
 for(const question of ['publish website','domain renewal','business email','invoice payments','partner commission','affiliate referral','custom project billing','app offline','platform paused quota']){
  const answer=knowledge.guideReply(question);
  assert.ok(answer.guides.length,question);
  assert.ok(answer.guides.every(g=>!g.id.startsWith('team-')),question);
 }
});

test('JKTL AI uses bounded existing support context and preserves safe fallback and human handoff',async()=>{
 let configured=true,response={reply:'Open the Website screen, save your changes, preview and publish.',needsHuman:false};
 let providerCalls=0,handoffs=0,payload=null,inserted=null;
 const query=async(sql,params=[])=>{
  if(sql.startsWith('SELECT subject,status'))return[{subject:'How do I publish my website?',status:'AI'}];
  if(sql.includes('SELECT sender,body')){assert.match(sql,/organization_id=\$2/);assert.deepEqual(params,['fixture-case','fixture-org']);return[{sender:'user',body:'How do I publish my website?'}];}
  if(sql.startsWith('INSERT INTO support_messages')){inserted={mode:params[2],reply:params[3],guides:JSON.parse(params[4])};return[{id:'fixture-message'}];}
  if(sql.includes('UPDATE support_cases')){handoffs++;return[];}
  throw Error('Unexpected query in isolated assistant fixture');
 };
 const service=load('src/lib/support/service.ts',{
  'server-only':{},'@/lib/custom/service':{query},'@/lib/custom/contracts':{PROJECT_CATEGORY_LABELS:{}},
  '@/lib/session':{requireSession:async()=>{throw Error('Not needed for internal answer fixture');}},
  '@/lib/admin-session':{requireAdminCapability:async()=>{throw Error('No administrative tools');}},
  '@/lib/deepseek':{isDeepSeekConfigured:()=>configured,chatComplete:async p=>{providerCalls++;payload=p;return{ok:true,content:JSON.stringify(response)};}},
  './knowledge':knowledge,'./model':model,
 });
 await service.answerCase('fixture-case','fixture-org','How do I publish my website?');
 assert.equal(inserted.mode,'ai');assert.equal(payload.maxTokens,650);assert.equal(payload.toolChoice,'none');assert.equal(payload.temperature,0);assert.ok(payload.messages.length<=7);
 assert.match(payload.messages[0].content,/JKTL AI/);assert.doesNotMatch(payload.messages[0].content,/team-domain-operations/);
 assert.ok(inserted.guides.length>0);assert.equal(handoffs,0);
 response={reply:'Use /invented-account-tool to publish.',needsHuman:false};
 await service.answerCase('fixture-case','fixture-org','How do I publish my website?');assert.equal(inserted.mode,'guide');assert.doesNotMatch(inserted.reply,/invented-account-tool/);
 response={reply:'I have refunded your payment.',needsHuman:false};
 await service.answerCase('fixture-case','fixture-org','How do I publish my website?');assert.equal(inserted.mode,'guide');
 response={reply:'A team member needs to review this question.',needsHuman:true};
 await service.answerCase('fixture-case','fixture-org','How do I publish my website?');assert.equal(handoffs,1);
 configured=false;const before=providerCalls;
 await service.answerCase('fixture-case','fixture-org','How do I publish my website?');assert.equal(providerCalls,before);assert.equal(inserted.mode,'guide');
 const handoffsBefore=handoffs;configured=true;
 for(const question of ['Hi','Thanks','Help me']){
  await service.answerCase('fixture-case','fixture-org',question);
  assert.equal(providerCalls,before);assert.equal(handoffs,handoffsBefore);assert.deepEqual(inserted.guides,[]);
 }
});


test('guide conversations greet, clarify and acknowledge without dumping unrelated instructions',()=>{
 for(const question of ['Hi','Hello!','Good morning','thanks','thank you','help me','okay']){
  const answer=knowledge.guideReply(question);
  assert.equal(answer.guides.length,0,question);assert.equal(answer.needsHuman,false,question);
  assert.ok(answer.reply.length<220);assert.doesNotMatch(answer.reply,/1\. |template|publish/i);
 }
 const missing=knowledge.guideReply('zxqvunsupportedtopic');assert.equal(missing.guides.length,0);assert.equal(missing.needsHuman,true);
 assert.doesNotMatch(missing.reply,/first website|select a template/i);
});
test('guide follow-ups retain the task, advance steps and allow topic changes',()=>{
 const question='How do I publish my first website?';
 const first=knowledge.guideReply(question),guide=first.guides[0];
 assert.equal(first.guides.length,1);assert.ok(first.reply.includes(guide.steps[0]));assert.ok(first.reply.includes(guide.steps[1]));
 const history=[{sender:'user',body:question},{sender:'assistant',body:first.reply,guideIds:[guide.id]}];
 const next=knowledge.guideReply('What next?',undefined,history);
 assert.equal(next.guides[0].id,guide.id);assert.ok(next.reply.includes(guide.steps[2]));assert.ok(!next.reply.includes(guide.steps[0]));
 const simpler=knowledge.guideReply('Explain that more simply',undefined,history);assert.equal(simpler.guides[0].id,guide.id);assert.ok(simpler.reply.length<first.reply.length);
 const changed='Where do I check domain renewals?';
 assert.deepEqual(knowledge.relevantGuides(changed,history).map(g=>g.id),knowledge.relevantGuides(changed).map(g=>g.id));
 // An approved guide pointer retains context when older explicit topic words fall out of the bounded history.
 const shortHistory=[{sender:'user',body:'Next'},{sender:'assistant',body:next.reply,guideIds:[guide.id]}];
 assert.equal(knowledge.guideReply('And then?',undefined,shortHistory).guides[0].id,guide.id);
});
