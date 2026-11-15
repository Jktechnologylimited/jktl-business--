/** Bundle the real components with mocked support transport; never use live accounts. */
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const require=createRequire(import.meta.url),repo=fileURLToPath(new URL('..',import.meta.url));
const dir='/tmp/jktl-ask-ai-ui';mkdirSync(dir,{recursive:true});
const write=(name,body)=>writeFileSync(path.join(dir,name),body);
write('loader.cjs',`const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;};`);
write('store.ts',`export const useBusinessStore=(selector)=>selector(window.fixtureState);`);
write('link.tsx',`import React from 'react';export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>;}`);
write('reviews.ts',`export async function reviewHomeAction(){return {eligible:false};}export async function reviewPromptAction(){}`);
write('support.ts',`
const state=()=>window.fixtureTransport;
function record(kind){state().calls[kind]++;if(state().fail)throw Error('Mock unavailable');}
export async function createSupportCaseAction(input){record('create');const id=crypto.randomUUID();state().id=id;state().status=/human support/i.test(input.message)?'WAITING':'AI';state().messages=[{id:crypto.randomUUID(),sender:'user',body:input.message,guide_ids:[]},{id:crypto.randomUUID(),sender:'assistant',body:'Use the Website screen to save, preview and publish.',guide_ids:['first-website'],answer_mode:'ai'}];return{ok:true,id};}
export async function sendSupportMessageAction(id,text){record('send');state().messages.push({id:crypto.randomUUID(),sender:'user',body:text,guide_ids:[]});if(state().status==='AI')state().messages.push({id:crypto.randomUUID(),sender:'assistant',body:'Check the saved website and use the linked guide.',guide_ids:['first-website'],answer_mode:'ai'});return{ok:true};}
export async function supportCaseAction(id){record('read');return structuredClone({case:{id,status:state().status},messages:state().messages});}
export async function requestHumanAction(id){record('human');state().status='WAITING';return{ok:true};}
`);
write('entry.tsx',`
import React,{useState} from 'react';import{createRoot}from'react-dom/client';
import{SupportDock}from'@/components/support/support-dock';import{TeamOrganogram}from'@/components/admin/team-organogram';
window.fixtureState={mode:'live'};window.fixtureTransport={calls:{create:0,send:0,read:0,human:0},messages:[],status:'AI',fail:false};
function App(){const[identity,setIdentity]=useState(0),[mode,setMode]=useState('live');window.fixtureState.mode=mode;return <main style={{maxWidth:1100,margin:'auto',padding:20}}><h1>Business workspace fixture</h1><div className="mb-5 flex flex-wrap gap-3"><button onClick={()=>setIdentity(x=>x+1)}>Switch account</button><button onClick={()=>setMode(mode==='live'?'demo':'live')}>Switch mode</button></div><TeamOrganogram/><SupportDock key={identity+':'+mode}/></main>;}
createRoot(document.getElementById('root')).render(<App/>);
`);
const webpack=require('next/dist/compiled/webpack/webpack').webpack;
const compiler=webpack({mode:'production',target:'web',entry:path.join(dir,'entry.tsx'),output:{path:dir,filename:'app.js',chunkFilename:'[id].js',publicPath:'/'},
 resolve:{extensions:['.tsx','.ts','.jsx','.js'],modules:[path.join(repo,'node_modules'),'node_modules'],alias:{
  '@/lib/actions/support-actions$':path.join(dir,'support.ts'),'@/lib/actions/review-actions$':path.join(dir,'reviews.ts'),'@/lib/store$':path.join(dir,'store.ts'),'next/link$':path.join(dir,'link.tsx'),'@':path.join(repo,'src'),
  react:path.dirname(require.resolve('react/package.json')),'react-dom':path.dirname(require.resolve('react-dom/package.json')),
 }},module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:path.join(dir,'loader.cjs')}]},
 plugins:[new webpack.DefinePlugin({'process.env.NODE_ENV':JSON.stringify('production')})],optimization:{minimize:false},devtool:false,
});
await new Promise((resolve,reject)=>compiler.run((error,stats)=>{
 if(error)return reject(error);if(stats.hasErrors())return reject(Error(stats.toString({all:false,errors:true})));
 const modules=stats.toJson({all:false,modules:true}).modules||[];
 if(modules.some(m=>/src\/lib\/(?:support\/service|db\/|deepseek)/.test(m.name||'')))return reject(Error('Server adapter leaked into client fixture'));
 compiler.close(error=>error?reject(error):resolve());
}));
let css='';for(const folder of ['.next/static/css','.next/static/chunks'])try{for(const f of readdirSync(path.join(repo,folder)))if(f.endsWith('.css'))css+=readFileSync(path.join(repo,folder,f),'utf8');}catch{}
write('styles.css',css);write('index.html','<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
console.log('Built real lazy Ask AI and roles-only chart with mock transport at '+dir);
