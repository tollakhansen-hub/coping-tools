import { chromium } from 'playwright-core';
import axe from 'axe-core';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const baseURL = (args.find(a => a.startsWith('http://') || a.startsWith('https://')) || 'https://coping.tools').replace(/\/$/, '');
const quick = args.includes('--quick');
const full = args.includes('--full');
const schemes = ['light', 'dark'];
const viewports = quick
  ? [{ name: 'phone-412', width: 412, height: 915 }]
  : full
    ? [
        { name: 'phone-320', width: 320, height: 700 },
        { name: 'phone-360', width: 360, height: 800 },
        { name: 'phone-412', width: 412, height: 915 },
        { name: 'tablet-768', width: 768, height: 1024 },
        { name: 'desktop-1366', width: 1366, height: 768 },
      ]
    : [
        { name: 'phone-360', width: 360, height: 800 },
        { name: 'phone-412', width: 412, height: 915 },
        { name: 'desktop-1366', width: 1366, height: 768 },
      ];

function detectChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  for (const cmd of ['chromium-browser', 'chromium']) {
    try {
      return execFileSync('which', [cmd], { encoding: 'utf8' }).trim();
    } catch {}
  }
  throw new Error('Chromium not found. In Termux run: pkg install x11-repo chromium');
}

function slug(url) {
  const u = new URL(url);
  const p = u.pathname === '/' ? 'home' : u.pathname.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9]+/gi, '-');
  return p || 'home';
}

async function discoverUrls() {
  const urls = new Set([`${baseURL}/`]);
  try {
    const res = await fetch(`${baseURL}/sitemap.xml`, { redirect: 'follow' });
    if (res.ok) {
      const xml = await res.text();
      for (const m of xml.matchAll(/<loc>(.*?)<\/loc>/g)) {
        const url = m[1].trim();
        if (url.startsWith(baseURL)) urls.add(url);
      }
    }
  } catch {}
  urls.add(`${baseURL}/not-sure/`);
  return [...urls];
}

const runId = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.resolve('reports', runId);
const shotsDir = path.join(outDir, 'screenshots');
await mkdir(shotsDir, { recursive: true });

const executablePath = detectChromium();
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--jitless',
    '--hide-scrollbars',
  ],
});

const urls = await discoverUrls();
const results = [];

for (const url of urls) {
  for (const vp of viewports) {
    for (const scheme of schemes) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        colorScheme: scheme,
        deviceScaleFactor: 1,
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      const consoleErrors = [];
      const failedRequests = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('requestfailed', req => failedRequests.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText || 'failed'}`));

      let response = null;
      let navError = null;
      try {
        response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      } catch (e) {
        navError = e.message;
      }

      const shotName = `${slug(url)}__${vp.name}__${scheme}.png`;
      const shotPath = path.join(shotsDir, shotName);

      if (!navError) {
        await page.screenshot({ path: shotPath, fullPage: true });
        await page.addScriptTag({ content: axe.source });
      }

      const audit = navError ? null : await page.evaluate(async () => {
        const root = document.documentElement;
        const visible = el => {
          const s = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0 && r.width > 0 && r.height > 0;
        };
        const label = el => (el.innerText || el.getAttribute('aria-label') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 100);
        const overflowElements = [...document.querySelectorAll('h1,h2,h3,p,li,a,button,svg')]
          .filter(visible)
          .map(el => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.left < -1 || r.right > innerWidth + 1)
          .map(({ el, r }) => ({ label: label(el), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) }))
          .slice(0, 30);
        const clipped = [...document.querySelectorAll('h1,h2,h3,p,li,a,button')]
          .filter(visible)
          .filter(el => {
            const s = getComputedStyle(el);
            return (s.overflow === 'hidden' || s.textOverflow === 'ellipsis') && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
          })
          .map(el => ({ label: label(el), clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, clientHeight: el.clientHeight, scrollHeight: el.scrollHeight }))
          .slice(0, 30);
        const tinyTargets = [...document.querySelectorAll('a,button,input,select,summary')]
          .filter(visible)
          .map(el => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.width < 24 || r.height < 24)
          .map(({ el, r }) => ({ label: label(el), width: Math.round(r.width), height: Math.round(r.height) }))
          .slice(0, 30);
        const toolSections = [...document.querySelectorAll('.tool-page .tool-section')].map(section => {
          const marker = getComputedStyle(section, '::before');
          const h2 = section.querySelector('h2');
          const hs = h2 ? getComputedStyle(h2) : null;
          return {
            timing: h2?.innerText?.trim() || '',
            markerWidth: marker.width,
            markerHeight: marker.height,
            markerColor: marker.backgroundColor,
            paddingTop: getComputedStyle(section).paddingTop,
            timingFontSize: hs?.fontSize || null,
            timingTransform: hs?.textTransform || null,
          };
        });
        const body = getComputedStyle(document.body);
        const h1s = document.querySelectorAll('h1').length;
        const main = document.querySelector('main');
        const mainRect = main?.getBoundingClientRect();
        const axeResult = await axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
        });
        return {
          title: document.title,
          h1Count: h1s,
          bodyFontSize: body.fontSize,
          documentWidth: root.scrollWidth,
          viewportWidth: innerWidth,
          horizontalOverflow: root.scrollWidth > innerWidth + 1,
          overflowElements,
          clipped,
          tinyTargets,
          toolSections,
          mainTop: mainRect ? Math.round(mainRect.top) : null,
          axe: axeResult.violations.map(v => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            nodes: v.nodes.slice(0, 8).map(n => n.target.join(' ')),
          })),
        };
      });

      results.push({
        url,
        viewport: vp,
        scheme,
        status: response?.status() ?? null,
        navError,
        screenshot: path.relative(outDir, shotPath),
        consoleErrors,
        failedRequests,
        ...audit,
      });
      await context.close();
      process.stdout.write(`✓ ${url} ${vp.name} ${scheme}\n`);
    }
  }
}

await browser.close();

const severeAxe = results.flatMap(r => (r.axe || []).filter(v => ['critical', 'serious'].includes(v.impact)).map(v => ({ url: r.url, viewport: r.viewport.name, scheme: r.scheme, ...v })));
const overflow = results.filter(r => r.horizontalOverflow);
const navFailures = results.filter(r => r.navError || (r.status && r.status >= 400));
const consoleFailures = results.filter(r => r.consoleErrors?.length || r.failedRequests?.length);
const markerFailures = results.filter(r => r.toolSections?.length && r.toolSections.some(s => parseFloat(s.markerWidth) < 30 || parseFloat(s.markerHeight) < 2));

const summary = {
  baseURL,
  generatedAt: new Date().toISOString(),
  executablePath,
  pages: urls.length,
  combinations: results.length,
  navFailures: navFailures.length,
  horizontalOverflowCases: overflow.length,
  seriousAccessibilityCases: severeAxe.length,
  consoleOrRequestFailureCases: consoleFailures.length,
  sectionMarkerFailureCases: markerFailures.length,
};

await writeFile(path.join(outDir, 'report.json'), JSON.stringify({ summary, results }, null, 2));

const md = [];
md.push(`# coping.tools visual audit`);
md.push(``);
md.push(`Generated: ${summary.generatedAt}`);
md.push(`Base URL: ${baseURL}`);
md.push(`Chromium: \`${executablePath}\``);
md.push(`Pages: ${summary.pages} · viewport/theme checks: ${summary.combinations}`);
md.push(``);
md.push(`## Summary`);
md.push(`- Navigation/HTTP failures: **${summary.navFailures}**`);
md.push(`- Horizontal overflow cases: **${summary.horizontalOverflowCases}**`);
md.push(`- Serious/critical accessibility findings: **${summary.seriousAccessibilityCases}**`);
md.push(`- Console/request failure cases: **${summary.consoleOrRequestFailureCases}**`);
md.push(`- Missing/weak coping-section marker cases: **${summary.sectionMarkerFailureCases}**`);
md.push(``);

if (navFailures.length) {
  md.push(`## Navigation failures`);
  for (const r of navFailures) md.push(`- ${r.url} — ${r.viewport.name}/${r.scheme}: ${r.navError || `HTTP ${r.status}`}`);
  md.push(``);
}
if (overflow.length) {
  md.push(`## Horizontal overflow`);
  for (const r of overflow) {
    md.push(`- ${r.url} — ${r.viewport.name}/${r.scheme}: document ${r.documentWidth}px vs viewport ${r.viewportWidth}px`);
    for (const el of r.overflowElements || []) md.push(`  - ${el.label} (${el.left} → ${el.right})`);
  }
  md.push(``);
}
if (severeAxe.length) {
  md.push(`## Serious accessibility findings`);
  for (const v of severeAxe) md.push(`- ${v.url} — ${v.viewport}/${v.scheme}: **${v.id}** (${v.impact}) — ${v.help} — ${v.nodes.join(', ')}`);
  md.push(``);
}
if (markerFailures.length) {
  md.push(`## Coping-section marker problems`);
  for (const r of markerFailures) md.push(`- ${r.url} — ${r.viewport.name}/${r.scheme}`);
  md.push(``);
}
if (consoleFailures.length) {
  md.push(`## Browser console / request failures`);
  for (const r of consoleFailures) {
    md.push(`- ${r.url} — ${r.viewport.name}/${r.scheme}`);
    for (const e of r.consoleErrors || []) md.push(`  - console: ${e}`);
    for (const e of r.failedRequests || []) md.push(`  - request: ${e}`);
  }
  md.push(``);
}

md.push(`## Screenshots`);
md.push(`Full-page PNGs are in \`screenshots/\`, named by page, viewport and light/dark mode.`);
md.push(``);
md.push(`## Notes`);
md.push(`- This is a visual/technical QA pass, not a substitute for human design judgment.`);
md.push(`- Tap-target findings below 24px and text clipping are retained in \`report.json\` for deeper inspection.`);
md.push(`- Use \`--quick\` for one phone viewport or \`--full\` for five viewports.`);

await writeFile(path.join(outDir, 'report.md'), md.join('\n'));
console.log(`\nReport: ${path.join(outDir, 'report.md')}`);
console.log(`Screenshots: ${shotsDir}`);
console.log(JSON.stringify(summary, null, 2));
