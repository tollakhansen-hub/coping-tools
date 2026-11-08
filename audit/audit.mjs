import puppeteer from 'puppeteer-core';
import axe from 'axe-core';
import fs from 'node:fs/promises';
const routes=['/','/body-wont-settle/','/mind-wont-stop/','/too-much-at-once/','/feel-low-or-shut-down/','/something-has-happened/','/practical-support/','/not-sure/','/about/','/how-tools-are-chosen/','/for-organisations/','/privacy/','/update-history/'];
const widths=[320,360,375,430,768,1280];
const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
await fs.mkdir('audit-output/screenshots',{recursive:true});
const results=[];
try {
 for(const route of routes)for(const width of widths)for(const mode of ['light','dark']){
  const page=await browser.newPage();
  try {
   await page.setViewport({width,height:900,deviceScaleFactor:1});
   await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:mode},{name:'prefers-reduced-motion',value:'reduce'}]);
   const response=await page.goto('https://coping.tools'+route,{waitUntil:'domcontentloaded',timeout:30000});
   await page.evaluate(()=>document.fonts.ready);
   const metrics=await page.evaluate(()=>{
    const elements=[...document.querySelectorAll('h1,h2,h3,h4,p,li,a,button,summary,label')];
    const visible=elements.filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0});
    const samples=visible.map(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect(),font=parseFloat(s.fontSize),line=parseFloat(s.lineHeight);return {tag:e.tagName.toLowerCase(),text:(e.innerText||'').slice(0,90),fontSize:font,lineHeight:s.lineHeight,lineHeightRatio:Number.isFinite(line)?+(line/font).toFixed(2):null,letterSpacing:s.letterSpacing,wordSpacing:s.wordSpacing,color:s.color,background:s.backgroundColor,width:Math.round(r.width),right:Math.round(r.right)}});
    return {documentWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,samples};
   });
   await page.evaluate(axe.source);
   const accessibility=await page.evaluate(async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}));
   const name=(route.replace(/[^a-z0-9]/gi,'-')||'home')+'-'+width+'-'+mode;
   await page.screenshot({path:'audit-output/screenshots/'+name+'.png',fullPage:true});
   const findings=[];
   if(!response?.ok())findings.push({type:'http',severity:'error',detail:response?.status()??'no response'});
   if(metrics.documentWidth>width+2)findings.push({type:'horizontal-overflow',severity:'review',detail:metrics.documentWidth+'px document at '+width+'px viewport'});
   for(const s of metrics.samples){
    if(s.lineHeightRatio!==null&&s.lineHeightRatio<1.25&&['p','li'].includes(s.tag))findings.push({type:'tight-line-height',severity:'review',detail:s});
    if(s.fontSize<14&&['p','li'].includes(s.tag))findings.push({type:'small-type',severity:'review',detail:s});
    if(s.width>850&&s.tag==='p')findings.push({type:'wide-paragraph',severity:'review',detail:s});
   }
   results.push({route,width,mode,findings,accessibility:accessibility.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),metrics,screenshot:'screenshots/'+name+'.png'});
   console.log(route,width,mode,'findings',findings.length,'axe',accessibility.violations.length);
  }catch(error){results.push({route,width,mode,error:String(error)});console.error(route,width,mode,error)}
  finally{await page.close()}
 }
}finally{await browser.close()}
await fs.writeFile('audit-output/report.json',JSON.stringify(results,null,2));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const html='<html><head><meta charset="utf-8"><title>coping.tools visual audit</title><style>body{font:16px/1.5 system-ui;max-width:1100px;margin:auto;padding:2rem}article{border-bottom:1px solid #ccc;padding:1rem 0}img{max-width:280px}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body><h1>coping.tools visual audit</h1><p>Review findings are heuristics, not confirmed accessibility failures. Colour values are recorded; automated WCAG contrast is checked by axe.</p>'+results.map(r=>'<article><h2>'+escape(r.route)+' · '+r.width+'px · '+r.mode+'</h2><p>Heuristic findings: '+(r.findings?.length??0)+' · axe violations: '+(r.accessibility?.length??0)+'</p>'+(r.screenshot?'<a href="'+escape(r.screenshot)+'"><img src="'+escape(r.screenshot)+'" loading="lazy"></a>':'')+'<details><summary>Detailed findings</summary><pre>'+escape(JSON.stringify({error:r.error,findings:r.findings,accessibility:r.accessibility},null,2))+'</pre></details></article>').join('')+'</body></html>';
await fs.writeFile('audit-output/index.html',html);
console.log('Wrote audit-output/index.html and report.json');
