// Compare optimized repeating layers with the original ocean at identical coordinates.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto(process.env.TEST_URL||'http://127.0.0.1:4190/',{waitUntil:'networkidle'});
 await page.evaluate(()=>{document.querySelector('[data-learn-skip]')?.click();screenSagas(0);});
 await page.addStyleTag({content:'.world-map,.world-inspector{visibility:hidden!important}.world-sea,.world-sea:after{animation:none!important}'});
 const reference=await page.addStyleTag({content:`
 .ocean-reference .world-sea{background:#168ac8 url('/art/world/ocean.webp') center var(--sea-offset,0px)/480px 480px repeat}
 .ocean-reference .world-sea:before{display:none}
 .ocean-reference .world-sea:after{bottom:-24px;background-position:150px calc(var(--sea-offset,0px) + 80px);translate:none}
 `});
 for(const theme of ['light','dark']) for(const offset of [0,375,480,660,700,19375,210,0]){
  await page.evaluate(({theme,offset})=>{
   document.documentElement.dataset.theme=theme;
   const sea=document.querySelector('.world-sea');
   sea.style.setProperty('--sea-offset',`${-offset}px`);
   sea.style.setProperty('--sea-base-shift',`${-offset%480}px`);
   sea.style.setProperty('--sea-foam-shift',`${-offset%660}px`);
   document.body.classList.remove('ocean-reference');
  },{theme,offset});
  const optimized=await page.locator('.world-ocean-frame').screenshot();
  await page.evaluate(()=>document.body.classList.add('ocean-reference'));
  const original=await page.locator('.world-ocean-frame').screenshot();
  const difference=await page.evaluate(async ([a,b])=>{
   const pixels=async data=>{
    const image=await createImageBitmap(await (await fetch('data:image/png;base64,'+data)).blob());
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const context=canvas.getContext('2d');context.drawImage(image,0,0);image.close();
    return context.getImageData(0,0,canvas.width,canvas.height).data;
   };
   const x=await pixels(a),y=await pixels(b);let sum=0,large=0;
   for(let i=0;i<x.length;i+=4){let max=0;for(let c=0;c<3;c++){const d=Math.abs(x[i+c]-y[i+c]);sum+=d;max=Math.max(max,d);}if(max>20)large++;}
   return {mean:sum/(x.length/4*3),largeFraction:large/(x.length/4)};
  },[optimized.toString('base64'),original.toString('base64')]);
  // Composited texture tile edges can rasterize slightly differently from backgrounds.
  assert.ok(difference.mean<2.55 && difference.largeFraction<.05,`${theme} ocean at ${offset}px: ${JSON.stringify(difference)}`);

 }
 const cdp=await page.context().newCDPSession(page),paints={};
 for(const referenceMode of [true,false]){
  await page.evaluate(referenceMode=>{document.body.classList.toggle('ocean-reference',referenceMode);document.querySelector('.world-map').style.scrollSnapType='none';},referenceMode);
  let events=[];const collect=({value})=>events.push(...value);cdp.on('Tracing.dataCollected',collect);
  await cdp.send('Tracing.start',{categories:'devtools.timeline',transferMode:'ReportEvents'});
  await page.evaluate(async()=>{const chart=document.querySelector('.world-map');for(let i=0;i<60;i++){chart.scrollTop=1000+i*30;await new Promise(r=>requestAnimationFrame(r));}});
  const done=new Promise(r=>cdp.once('Tracing.tracingComplete',r));await cdp.send('Tracing.end');await done;
  cdp.off('Tracing.dataCollected',collect);
  paints[referenceMode?'reference':'optimized']=events.filter(e=>e.name==='Paint').length;
 }
 console.log('Ocean scroll Paint events (60 frames):',JSON.stringify(paints));
 assert.ok(paints.optimized<paints.reference,'Scrolling should require fewer paint events');
 await reference.evaluate(el=>el.remove());
 console.log('Ocean appearance preserved within rasterization tolerance for light/dark themes, tile boundaries, long and reverse scroll.');
}finally{await browser.close();}
