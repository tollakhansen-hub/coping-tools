const { test, expect, devices } = require('@playwright/test');
const routes = ['/', '/body-wont-settle/', '/mind-wont-stop/', '/too-much-at-once/', '/feel-low-or-shut-down/', '/something-has-happened/', '/es/'];
const base = 'https://coping.tools';
test.describe('published mobile browser UX (read-only)', () => {
  for (const route of routes) {
    test(route + ' loads without horizontal overflow or clipped interactive controls', async ({ page }) => {
      const response = await page.goto(base + route, { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBe(200);
      await expect(page.locator('main h1')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const geometry = await page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        const overflow = document.documentElement.scrollWidth - width;
        const clipped = [...document.querySelectorAll('main a, main button, header a')]
          .filter(el => {
            if (!el.getClientRects().length) return false;
            const s = getComputedStyle(el);
            if (s.visibility === 'hidden' || s.display === 'none') return false;
            const r = el.getBoundingClientRect();
            return r.right > width + 3 || r.left < -3;
          }).map(el => el.textContent.trim().slice(0, 60));
        return { overflow, clipped };
      });
      expect(geometry.overflow, JSON.stringify(geometry)).toBeLessThanOrEqual(3);
      expect(geometry.clipped, JSON.stringify(geometry)).toEqual([]);
      await page.screenshot({ path: 'test-results/' + (test.info().project.name + '-' + (route.replaceAll('/', '-') || 'home') + '.png'), fullPage: true });
    });
  }
  test('English and Spanish navigation works', async ({ page }) => {
    await page.goto(base + '/');
    await expect(page.locator('a.route')).toHaveCount(5);
    await page.goto(base + '/es/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.locator('a.route')).toHaveCount(5);
    await page.getByRole('link', { name: 'English' }).first().click();
    await expect(page).toHaveURL(/^https:\/\/coping\.tools\//);
  });
  test('guide print button is available and calls window.print', async ({ page }) => {
    await page.goto(base + '/body-wont-settle/');
    const button = page.locator('[data-guide-print]');
    await expect(button).toBeVisible();
    await page.evaluate(() => { window.__printCalled = false; window.print = () => { window.__printCalled = true; }; });
    await button.click();
    expect(await page.evaluate(() => window.__printCalled)).toBe(true);
  });
  test('guide PDF download produces a PDF', async ({ page }) => {
    await page.goto(base + '/body-wont-settle/');
    const button = page.locator('[data-guide-save]');
    await expect(button).toBeVisible();
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
    await button.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    const file = await download.path();
    const fs = require('node:fs');
    expect(fs.readFileSync(file).subarray(0, 8).toString()).toMatch(/^%PDF-/);
  });
});
