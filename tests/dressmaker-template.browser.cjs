// Local preview tests only. No customer site, enquiry, email or deployment is created.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const origin=process.env.MAIN_TEST_ORIGIN||'http://127.0.0.1:3021',out='/tmp/jktl-dressmaker-browser';fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 for(const [width,reduced]of [[1440,false],[390,false],[320,true]]){
  const p=await browser.newPage({viewport:{width,height:1000},reducedMotion:reduced?'reduce':'no-preference'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  const res=await p.goto(origin+'/template-canvas/dressmaker-atelier');if(res.status()!==200)throw Error('Preview route '+res.status());
  await p.getByRole('heading',{level:1,name:/Made to be/}).waitFor();if(await p.locator('h1').count()!==1)throw Error('Duplicate H1');
  const signin=p.getByRole('link',{name:'Sign in to JKTL Business'});if(!await signin.isVisible())throw Error('Sign-in icon hidden');if(await signin.getAttribute('href')!=='https://business.jktl.com.ng/login?template=dressmaker-atelier')throw Error('Template context missing');
  await p.waitForFunction(()=>Array.from(document.images).filter(i=>i.getBoundingClientRect().top<innerHeight).every(i=>i.complete&&i.naturalWidth>0));
  if(width<700){await p.getByRole('button',{name:'Open menu'}).click();await p.getByRole('navigation',{name:'Mobile atelier navigation'}).getByRole('link',{name:'Collection',exact:true}).click();if(await p.getByRole('navigation',{name:'Mobile atelier navigation'}).count())throw Error('Mobile menu did not close');}
  await p.getByRole('button',{name:'View The Ivory Story'}).click();const d=p.getByRole('dialog',{name:'Collection details'});await d.waitFor();await p.keyboard.press('Escape');await d.waitFor({state:'hidden'});
  if(!await p.getByRole('button',{name:'View The Ivory Story'}).evaluate(e=>e===document.activeElement))throw Error('Collection focus lost');
  await p.getByRole('button',{name:'View The Silver Hour'}).click();await d.getByRole('link',{name:'Discuss this look'}).click();await d.waitFor({state:'hidden'});
  await p.getByLabel('Your name').fill('Preview Visitor');await p.getByLabel('Email address',{exact:true}).fill('preview@example.test');await p.getByLabel('Tell us about your occasion').fill('A preview only; do not send.');await p.locator('form').getByRole('button',{name:'Request a consultation'}).click();await p.getByRole('status').filter({hasText:'This is a template preview'}).waitFor();
  for(const im of await p.locator('img').all()){await im.scrollIntoViewIfNeeded();await im.evaluate(i=>i.loading='eager')};await p.waitForFunction(()=>Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0));
  if(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Horizontal overflow '+width);
  await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:path.join(out,'dressmaker-'+width+'.png'),fullPage:true});if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({width,reduced,navigation:true,dialog:true,previewEnquiry:true,photos:true}));await p.close();
 }
 const p=await browser.newPage({viewport:{width:1000,height:676}});await p.goto(origin+'/template-canvas/dressmaker-atelier');await p.getByRole('link',{name:'Élan Atelier',exact:true}).first().waitFor();await p.waitForFunction(()=>document.images[0]?.complete&&document.images[0]?.naturalWidth>0);await p.evaluate(()=>document.fonts.ready);const target=path.resolve(__dirname,'../public/template-previews/dressmaker-atelier.jpg');await p.screenshot({path:target,type:'jpeg',quality:78,clip:{x:0,y:0,width:1000,height:676}});fs.copyFileSync(target,path.resolve(__dirname,'../../jktl-main/public/template-previews/dressmaker-atelier.jpg'));
 // The public wrapper remains freely accessible; choosing preserves the template.
 await p.goto(origin+'/templates/dressmaker-atelier');if(!(await p.content()).includes('dressmaker-atelier'))throw Error('Wrapper missing template');console.log('Screenshots: '+out+'; generated catalogue thumbnail in both repositories.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
