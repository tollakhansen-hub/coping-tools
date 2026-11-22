const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const routes = [
  '/body-wont-settle/', '/mind-wont-stop/', '/too-much-at-once/',
  '/feel-low-or-shut-down/', '/something-has-happened/'
];
const base = 'https://coping.tools';
const output = path.resolve('test-results/print-pagination');

test.describe('read-only print pagination evidence (Chromium PDF, NOT Apple print output)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Playwright WebKit cannot generate Safari print PDFs');
  for (const route of routes) {
    test(route + ' generates inspectable A4 print pages', async ({ page }) => {
      const response = await page.goto(base + route, { waitUntil: 'networkidle' });
      expect(response?.status()).toBe(200);
      await page.evaluate(() => document.fonts.ready);
      await page.emulateMedia({ media: 'print' });
      const state = await page.evaluate(() => ({
        title: document.querySelector('main h1')?.innerText?.trim(),
        text: document.querySelector('main')?.innerText?.trim(),
        printHidden: [...document.querySelectorAll('main h1')].some(el => getComputedStyle(el).display === 'none')
      }));
      expect(state.title).toBeTruthy();
      expect(state.printHidden).toBe(false);
      fs.mkdirSync(output, { recursive: true });
      const slug = route.split('/').filter(Boolean).join('-');
      const pdf = path.join(output, slug + '-chromium-a4.pdf');
      await page.pdf({ path: pdf, format: 'A4', printBackground: true, preferCSSPageSize: true });
      const bytes = fs.readFileSync(pdf);
      expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
      const info = execFileSync('pdfinfo', [pdf], { encoding: 'utf8' });
      const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
      expect(pages).toBeGreaterThan(0);
      expect(pages).toBeLessThan(20);
      const extracted = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' });
      const normalized = s => s.replace(/\s+/g, ' ').trim().toLowerCase();
      expect(normalized(extracted)).toContain(normalized(state.title));
      const chunks = extracted.split('\f').filter(x => x.trim());
      const blankPages = chunks.flatMap((chunk, i) => chunk.trim().length < 20 ? [i + 1] : []);
      expect(blankPages).toEqual([]);
      const report = {
        route, engine: 'Chromium print-to-PDF (not iOS Safari)', format: 'A4',
        pageCount: pages, textCharacters: extracted.length, title: state.title,
        note: 'Review PDF pages visually for awkward headings, splits, and clipping. Actual Apple Safari pagination remains unverified.'
      };
      fs.writeFileSync(path.join(output, slug + '-report.json'), JSON.stringify(report, null, 2));
      console.log('PRINT PAGINATION ' + JSON.stringify(report));
    });
  }
});
