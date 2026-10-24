// Read-only companion for --full. Never sends install-counter events.
import { chromium } from 'playwright-core';
import axe from 'axe-core';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [baseURL, outDir] = process.argv.slice(2);
if (!baseURL || !outDir) throw Error('Usage: node deep-audit.mjs BASE_URL REPORT_DIRECTORY');
const origin = new URL(baseURL).origin;
const visual = JSON.parse(await readFile(path.join(outDir, 'report.json'), 'utf8'));
const urls = [...new Set(visual.results.map(x => x.url))];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  headless: true, args: ['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--jitless']
});
const pages = [], uniqueLinks = new Set(), metadataIssues = [], headerWarnings = [];
const safe = async (callback, fallback) => {
  try { return await callback(); } catch (e) { return { ...fallback, error: String(e.message || e) }; }
};
function sameOriginLink(href, parent) {
  try {
    const u = new URL(href, parent);
    if (u.origin !== origin || !['https:','http:'].includes(u.protocol) || u.pathname.startsWith('/api/')) return null;
    u.hash = '';
    return u.href;
  } catch { return null; }
}
for (const url of urls) {
  const context = await browser.newContext({
    // Permit audit-only axe injection; offline smoke test below uses normal CSP.
    bypassCSP: true,
    viewport: {width:412,height:915}, isMobile:true, hasTouch:true,
    colorScheme:'light', reducedMotion:'reduce', serviceWorkers:'allow'
  });
  const page = await context.newPage();
  const item = {url, status:null, seo:null, axe:[], keyboard:null, headers:[], installUI:null, error:null};
  try {
    const response = await page.goto(url, {waitUntil:'load',timeout:20000});
    item.status = response?.status() ?? null;
    const h = response ? await response.allHeaders() : {};
    for (const key of ['content-security-policy','x-content-type-options','referrer-policy']) {
      if (!h[key]) item.headers.push('Missing '+key);
    }
    if (new URL(url).hostname === 'coping.tools' && !h['strict-transport-security']) {
      item.headers.push('Missing strict-transport-security');
    }
    item.headers.forEach(message => headerWarnings.push({url,message}));
    const info = await page.evaluate(() => {
      const install = document.querySelector('[data-install-app]');
      return {
        title:document.title.trim(),
        description:document.querySelector('meta[name="description"]')?.content?.trim() || '',
        canonical:document.querySelector('link[rel="canonical"]')?.href || '',
        robots:document.querySelector('meta[name="robots"]')?.content || '',
        h1:[...document.querySelectorAll('h1')].map(n=>n.textContent.trim()),
        anchors:[...document.querySelectorAll('a[href]')].map(n=>n.getAttribute('href')),
        installUI:install ? {
          exists:true, hidden:install.hidden || getComputedStyle(install).display==='none',
          placement:install.closest('header')?'header':install.closest('footer')?'footer':'other'
        } : {exists:false}
      };
    });
    item.installUI = info.installUI;
    item.seo = {title:info.title,description:info.description,canonical:info.canonical,robots:info.robots,h1:info.h1};
    if (!info.title) metadataIssues.push({url,message:'Missing title'});
    if (!info.description) metadataIssues.push({url,message:'Missing meta description'});
    if (!info.canonical) metadataIssues.push({url,message:'Missing canonical'});
    if (info.canonical && new URL(info.canonical).pathname !== new URL(url).pathname) {
      metadataIssues.push({url,message:'Canonical path differs: '+info.canonical});
    }
    if (info.h1.length !== 1) metadataIssues.push({url,message:'Expected one H1, found '+info.h1.length});
    if (new URL(url).pathname !== '/not-sure/' && /noindex/i.test(info.robots)) {
      metadataIssues.push({url,message:'Unexpected noindex'});
    }
    for (const href of info.anchors) {
      const resolved = sameOriginLink(href,url);
      if (resolved) uniqueLinks.add(resolved);
      if (href && href.startsWith('#') && href.length > 1) {
        const id = decodeURIComponent(href.slice(1));
        const exists = await page.evaluate(value =>
          Boolean(document.getElementById(value) || document.getElementsByName(value).length),id);
        if (!exists) metadataIssues.push({url,message:'Missing local anchor '+href});
      }
    }
    await page.addScriptTag({content:axe.source});
    const axeCheck = await safe(()=>page.evaluate(async()=>{
      const output=await window.axe.run(document,{runOnly:{type:'tag',values:[
        'wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice'
      ]}});
      return output.violations.map(v=>({
        id:v.id,impact:v.impact,help:v.help,nodes:v.nodes.slice(0,5).map(n=>n.target.join(' '))
      }));
    }),{violations:[]});
    item.axe = Array.isArray(axeCheck) ? axeCheck : [];
    if (axeCheck.error) item.axeError=axeCheck.error;
    item.keyboard = await safe(async()=>{
      const steps=[];
      const seen = new Set();
      let reachedBodyAfterLastLink = false;
      let bodyBeforeAnyLink = false;
      let cycleDetected = false;
      for(let i=0;i<40;i++){
        await page.keyboard.press('Tab');
        const focused = await page.evaluate(()=>{
          const e=document.activeElement,s=getComputedStyle(e),r=e.getBoundingClientRect();
          const focusables=[...document.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]')];
          return {
            index:focusables.indexOf(e),
            tag:e.tagName,
            label:(e.textContent||e.getAttribute('aria-label')||'').trim().slice(0,55),
            visible:r.width>0 && r.height>0 && s.visibility!=='hidden',
            outlineDetected:(s.outlineStyle!=='none' && parseFloat(s.outlineWidth)>0)||s.boxShadow!=='none'
          };
        });
        // Chromium can briefly focus the document body after the final link.
        // That is an ordinary end-of-cycle state, not a failed interactive target.
        if(focused.tag==='BODY'){
          if(steps.length) reachedBodyAfterLastLink=true;
          else bodyBeforeAnyLink=true;
          break;
        }
        const key=focused.tag+':'+focused.index;
        if(seen.has(key)){cycleDetected=true;break;}
        seen.add(key);
        steps.push(focused);
      }
      return {first:steps[0]||null,steps,
        reachedBodyAfterLastLink,bodyBeforeAnyLink,cycleDetected,
        invisible:steps.filter(x=>!x.visible).length,
        noOutlineHeuristic:steps.filter(x=>x.visible&&!x.outlineDetected).length};
    },{invisible:-1});
  } catch(e) { item.error=String(e.message||e); }
  finally {await context.close();}
  pages.push(item);
  console.log('Deep '+url+(item.error?' ERROR':' complete'));
}
for(const field of ['title','description']) {
  const seen=new Map();
  for(const p of pages) {
    const val=p.seo?.[field];
    if (!val) continue;
    if(seen.has(val)) metadataIssues.push({url:p.url,message:'Duplicate '+field+' with '+seen.get(val)});
    else seen.set(val,p.url);
  }
}
const links=[];
for(const url of [...uniqueLinks].sort()) {
  const result=await safe(async()=>{
    const r=await fetch(url,{method:'HEAD',redirect:'follow',signal:AbortSignal.timeout(12000)});
    return {ok:r.ok,status:r.status};
  },{ok:false});
  links.push({url,...result});
}
const brokenLinks=links.filter(x=>!x.ok);
const pwa={manifest:null,icons:[],serviceWorker:null,offline:[],browserErrors:[],error:null};
const context=await browser.newContext({
  viewport:{width:412,height:915},isMobile:true,hasTouch:true,serviceWorkers:'allow'
});
try {
  const page=await context.newPage();
  // This context does NOT bypass production CSP.
  page.on('console',message=>{if(message.type()==='error')pwa.browserErrors.push(message.text());});
  await page.goto(origin+'/',{waitUntil:'load',timeout:20000});
  pwa.manifest=await safe(async()=>{
    const href=await page.locator('link[rel="manifest"]').first().getAttribute('href');
    if(!href) return {ok:false,reason:'Missing manifest link',icons:[]};
    const r=await fetch(new URL(href,origin),{signal:AbortSignal.timeout(12000)});
    if(!r.ok) return {ok:false,status:r.status,icons:[]};
    const m=await r.json();
    return {ok:Boolean(m.name&&m.start_url&&m.display==='standalone'&&m.icons?.length),
      name:m.name,display:m.display,icons:m.icons||[]};
  },{ok:false,icons:[]});
  for(const icon of pwa.manifest.icons||[]) {
    const check=await safe(async()=>{
      const r=await fetch(new URL(icon.src,origin),{method:'HEAD',signal:AbortSignal.timeout(12000)});
      return {src:icon.src,ok:r.ok,status:r.status};
    },{src:icon.src,ok:false});
    pwa.icons.push(check);
  }
  pwa.serviceWorker=await safe(()=>page.evaluate(async()=>{
    if(!('serviceWorker' in navigator))return {ready:false};
    const registration=await Promise.race([
      navigator.serviceWorker.ready,
      new Promise(resolve=>setTimeout(()=>resolve(null),14000))
    ]);
    return {ready:!!registration,scope:registration?.scope||null,active:registration?.active?.state||null};
  }),{ready:false});
  if(pwa.serviceWorker.ready) {
    await page.reload({waitUntil:'load',timeout:18000});
    await context.setOffline(true);
    for(const route of ['/','/mind-wont-stop/','/privacy/']) {
      const result=await safe(async()=>{
        const r=await page.goto(origin+route,{waitUntil:'domcontentloaded',timeout:10000});
        const heading=await page.locator('h1').first().textContent();
        const correct=route==='/'?/Coping Tools/i.test(heading):
          route==='/mind-wont-stop/'?/mind won.t stop/i.test(heading):/Privacy/i.test(heading);
        return {route,loaded:!!r&&r.ok(),correctContent:correct};
      },{route,loaded:false,correctContent:false});
      pwa.offline.push(result);
    }
    await context.setOffline(false);
  }
} catch(e){pwa.error=String(e.message||e);}
finally{await context.close();await browser.close();}
const findings=pages.flatMap(p=>p.axe.map(x=>({url:p.url,...x})));
const summary={
  pages:pages.length,metadataProblems:metadataIssues.length,
  brokenInternalLinks:brokenLinks.length,accessibilityFindings:findings.length,
  seriousCriticalAccessibility:findings.filter(x=>['serious','critical'].includes(x.impact)).length,
  keyboardPotentialProblems:pages.filter(p=>p.keyboard&&(p.keyboard.invisible>0||p.keyboard.noOutlineHeuristic>0||p.keyboard.bodyBeforeAnyLink)).length,
  missingSecurityHeaders:headerWarnings.length,
  manifestAndIconsOk:!!pwa.manifest?.ok&&pwa.icons.every(x=>x.ok),
  serviceWorkerReady:!!pwa.serviceWorker?.ready,
  offlineRoutesPassed:pwa.offline.length===3&&pwa.offline.every(x=>x.loaded&&x.correctContent),
  browserErrors:pages.filter(x=>x.error||x.axeError).length,
  normalCspConsoleErrors:pwa.browserErrors.filter(x=>/content security policy|refused to (load|execute|connect)/i.test(x)).length
};
await writeFile(path.join(outDir,'deep-report.json'),JSON.stringify({
  summary,pages,metadataIssues,links,brokenLinks,headerWarnings,pwa
},null,2));
const lines=[
  '# coping.tools deep audit','',
  'Read-only audit of '+origin+'; no installation event or site mutations.','',
  '## Summary',
  ...Object.entries(summary).map(([k,v])=>'- '+k+': '+v),
  '',
  '## Metadata',
  ...metadataIssues.map(x=>'- '+x.url+': '+x.message),
  '',
  '## Broken same-origin links (HEAD)',
  ...brokenLinks.map(x=>'- '+x.url+': '+(x.status||x.error||'failed')),
  '',
  '## Automated accessibility findings (all severity levels)',
  ...findings.map(x=>'- '+x.url+': '+x.id+' ('+x.impact+') '+x.help+' — '+x.nodes.join(', ')),
  '',
  '## Security headers',
  ...headerWarnings.map(x=>'- '+x.url+': '+x.message),
  '',
  '## PWA',
  '- Manifest: '+JSON.stringify(pwa.manifest),
  '- Service worker: '+JSON.stringify(pwa.serviceWorker),
  '- Real-CSP console errors: '+JSON.stringify(pwa.browserErrors),
  ...pwa.offline.map(x=>'- '+JSON.stringify(x)),
  ...(pwa.error?['- Error: '+pwa.error]:[]),
  '',
  '## Human review still needed',
  '- Inspect full-page screenshots from visual audit, in this same directory.',
  '- Check TalkBack/screen reader, real keyboard focus, reflow at zoom, instructions and distress-sensitive language.',
  '- Test actual Android and iOS install prompts, post-install updates, and offline use on devices.',
  '- Axe WCAG 2.0/2.1/2.2 AA and best-practice tests only cover automated rules; no compliance certification.',
  '- Focus-outline observations are heuristics; end-of-tab-cycle BODY focus is excluded to avoid false positives.',
  '- HEAD-only links need manual confirmation if a server does not support HEAD.',
  '- Headers are informational and do not represent penetration testing.'
];
await writeFile(path.join(outDir,'deep-report.md'),lines.join('\n')+'\n');
console.log('\nDeep report: '+path.join(outDir,'deep-report.md'));
console.log(JSON.stringify(summary,null,2));
