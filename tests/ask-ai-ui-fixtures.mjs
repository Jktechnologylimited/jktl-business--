/** Bundle real components with mocked support transport. Run after the production
 * build finishes: this harness copies its generated CSS. Never use live accounts. */
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const require=createRequire(import.meta.url),repo=fileURLToPath(new URL('..',import.meta.url));
const dir='/tmp/jktl-ask-ai-ui';mkdirSync(dir,{recursive:true});
const write=(name,body)=>writeFileSync(path.join(dir,name),body);
write('loader.cjs',`const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;};`);
write('style.cjs',`module.exports=function(){};module.exports.pitch=function(remaining){return 'const m=require('+JSON.stringify('!!'+remaining)+');const css=m.default||m;const el=document.createElement("style");el.textContent=css.toString();document.head.appendChild(el);module.exports=css.locals||{};';};`);
write('store.ts',`import{getIndustry}from'@/lib/industry';export const useBusinessStore=(selector)=>selector(window.fixtureState);export const useCurrentIndustry=()=>getIndustry('salon');`);
write('navigation.ts',`export function usePathname(){return '/business'};export function useRouter(){return{push(){},replace(){}}};export function useSearchParams(){return new URLSearchParams(location.search)}`);
write('image.tsx',`import React from 'react';export default function Image({fill,priority,sizes,...props}){return <img {...props}/>}`);
write('link.tsx',`import React from 'react';export default function Link({href,prefetch,children,...props}){return <a href={href} {...props}>{children}</a>;}`);
write('reviews.ts',`export async function reviewHomeAction(){return {eligible:false,reviews:[]};}export async function reviewPromptAction(){}`);
write('support.ts',`
import {guideReply} from '@/lib/support/knowledge';
const state=()=>window.fixtureTransport;
async function wait(){if(state().defer)await new Promise(resolve=>{state().release=()=>{state().defer=false;resolve()}});}
function answer(text){return state().knowledgeReplies?guideReply(text,undefined,state().messages.map(message=>({sender:message.sender,body:message.body,guideIds:message.guide_ids}))):{reply:state().reply||'Use the Website screen to save, preview and publish.',guides:[{id:'first-website'}]};}
function record(kind){state().calls[kind]++;if(state().fail)throw Error('Mock unavailable');}
export async function supportHomeAction(){record('read');return{projects:[],cases:[]}}
export async function createSupportCaseAction(input){record('create');await wait();const id=crypto.randomUUID();state().id=id;state().status=/human support/i.test(input.message)?'WAITING':'AI';state().messages=[{id:crypto.randomUUID(),sender:'user',body:input.message,guide_ids:[]}];const a=answer(input.message);state().messages.push({id:crypto.randomUUID(),sender:'assistant',body:a.reply,guide_ids:a.guides.map(guide=>guide.id),answer_mode:state().knowledgeReplies?'guide':'ai'});return{ok:true,id};}
export async function sendSupportMessageAction(id,text){record('send');await wait();state().messages.push({id:crypto.randomUUID(),sender:'user',body:text,guide_ids:[]});if(state().status==='AI'){const a=answer(text);state().messages.push({id:crypto.randomUUID(),sender:'assistant',body:a.reply,guide_ids:a.guides.map(guide=>guide.id),answer_mode:state().knowledgeReplies?'guide':'ai'});}return{ok:true};}
export async function supportCaseAction(id){record('read');return structuredClone({case:{id,status:state().status},messages:state().messages});}
export async function requestHumanAction(id){record('human');state().status='WAITING';return{ok:true};}
`);
write('entry.tsx',`
import React,{useState} from 'react';import{createRoot}from'react-dom/client';
import{SupportDock}from'@/components/support/support-dock';import{HelpMenu}from'@/components/support/help-menu';import{AppShell}from'@/components/app/shell';import{CustomerSupport}from'@/components/support/customer-support';import{LanguageProvider}from'@/components/i18n/LanguageProvider';import{TeamOrganogram}from'@/components/admin/team-organogram';
window.fixtureState={mode:'live',data:{profile:{displayName:'Example Business',organizationId:'fixture-org'},user:{id:'fixture-user',name:'Example Member'}},online:true,syncing:false,logout:async()=>{}};window.fixtureTransport={calls:{create:0,send:0,read:0,human:0},messages:[],status:'AI',fail:false};
function App(){const[identity,setIdentity]=useState(0),[mode,setMode]=useState('live'),[shell,setShell]=useState(false),[helpView,setHelpView]=useState(false);window.fixtureState.mode=mode;return <LanguageProvider><div style={{padding:12}}><button onClick={()=>setIdentity(x=>x+1)}>Switch account</button><button onClick={()=>setMode(mode==='live'?'demo':'live')}>Switch mode</button><button onClick={()=>setShell(!shell)}>Business shell fixture</button><button onClick={()=>{setShell(true);setHelpView(true)}}>Business help fixture</button></div>{shell?<AppShell>{helpView?<CustomerSupport/>:<><h1>Example business dashboard</h1><p>Business tools and support.</p></>}</AppShell>:<main style={{maxWidth:1100,margin:'auto',padding:20}}><h1>Business workspace fixture</h1><HelpMenu compact/><TeamOrganogram/><SupportDock key={identity+':'+mode}/></main>}</LanguageProvider>;}
createRoot(document.getElementById('root')).render(<App/>);
`);
const webpack=require('next/dist/compiled/webpack/webpack').webpack;
const compiler=webpack({mode:'production',target:'web',entry:path.join(dir,'entry.tsx'),output:{path:dir,filename:'app.js',chunkFilename:'[id].js',publicPath:'/'},
 resolve:{extensions:['.tsx','.ts','.jsx','.js'],modules:[path.join(repo,'node_modules'),'node_modules'],alias:{
  '@/lib/actions/support-actions$':path.join(dir,'support.ts'),'@/lib/actions/review-actions$':path.join(dir,'reviews.ts'),'@/lib/store$':path.join(dir,'store.ts'),'next/navigation$':path.join(dir,'navigation.ts'),'next/image$':path.join(dir,'image.tsx'),'next/link$':path.join(dir,'link.tsx'),'@':path.join(repo,'src'),
  react:path.dirname(require.resolve('react/package.json')),'react-dom':path.dirname(require.resolve('react-dom/package.json')),
 }},module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:path.join(dir,'loader.cjs')},{test:/\.css$/,use:[path.join(dir,'style.cjs'),{loader:require.resolve('next/dist/build/webpack/loaders/css-loader/src/index.js'),options:{url:false,postcss:async()=>({postcss:require('postcss')}),esModule:false,modules:{getLocalIdent:require('next/dist/build/webpack/config/blocks/css/loaders/getCssModuleLocalIdent').getCssModuleLocalIdent}}}]}]},
 plugins:[{apply(compiler){compiler.hooks.compilation.tap('HelpFixtureCss',compilation=>{webpack.NormalModule.getCompilationHooks(compilation).loader.tap('HelpFixtureCss',context=>{context.currentTraceSpan=require('next/dist/trace').trace('help-fixture')})})}},new webpack.DefinePlugin({'process.env.NODE_ENV':JSON.stringify('production')})],optimization:{minimize:false},devtool:false,
});
await new Promise((resolve,reject)=>compiler.run((error,stats)=>{
 if(error)return reject(error);if(stats.hasErrors())return reject(Error(stats.toString({all:false,errors:true})));
 const modules=stats.toJson({all:false,modules:true}).modules||[];
 if(modules.some(m=>/src\/lib\/(?:support\/service|db\/|deepseek)/.test(m.name||'')))return reject(Error('Server adapter leaked into client fixture'));
 compiler.close(error=>error?reject(error):resolve());
}));
let css='';for(const folder of ['.next/static/css','.next/static/chunks'])try{for(const f of readdirSync(path.join(repo,folder)))if(f.endsWith('.css'))css+=readFileSync(path.join(repo,folder,f),'utf8');}catch{}
write('styles.css',css);write('index.html','<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
console.log('Built real lazy Ask AI and roles-only chart with mock transport at '+dir);
