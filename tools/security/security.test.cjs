const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFile, readdir } = require('node:fs/promises');
const path = require('node:path');
const { Miniflare } = require('miniflare');
const root = path.resolve(__dirname, '../..');
const origin = 'https://coping.tools';
let mf;
let assetRequests = [];

before(async () => {
  mf = new Miniflare({
    modules: true,
    rootPath: root,
    modulesRoot: root,
    scriptPath: path.join(root, 'worker.js'),
    compatibilityDate: '2026-07-30',
    durableObjects: { INSTALL_STATS: { className: 'InstallStats', useSQLite: true } },
    bindings: { STATS_READ_TOKEN: 'local-test-token' },
    serviceBindings: {
      ASSETS: async request => {
        const url = new URL(request.url);
        assetRequests.push({ url: request.url, headers: new Headers(request.headers) });
        if (request.headers.has('If-None-Match')) return new Response(null, { status: 304 });
        const file = url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname;
        try {
          const data = await readFile(path.join(root, file));
          const type = file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : 'text/css';
          return new Response(data, { headers: { 'Content-Type': type, ETag: 'static-asset-tag', 'Cache-Control': 'public, max-age=0' } });
        } catch {
          return new Response(await readFile(path.join(root, '404.html')), { status: 404, headers: { 'Content-Type': 'text/html' } });
        }
      }
    }
  });
  await mf.ready;
});
after(async () => { await mf?.dispose(); });
const fetchSite = (route, init) => mf.dispatchFetch(origin + route, init);
const post = (body, headers = {}) => fetchSite('/api/install-event', {
  method: 'POST', body, duplex: 'half',
  headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }
});
const nonceOf = response => response.headers.get('Content-Security-Policy').match(/'nonce-([^']+)'/)?.[1];

for (const route of ['/', '/body-wont-settle/', '/mind-wont-stop/', '/too-much-at-once/', '/feel-low-or-shut-down/', '/something-has-happened/', '/not-sure/', '/about/', '/for-organisations/', '/how-tools-are-chosen/', '/privacy/']) {
  test(`enforced CSP and matching script nonces on ${route}`, async () => {
    const response = await fetchSite(route);
    assert.equal(response.status, 200);
    const csp = response.headers.get('Content-Security-Policy');
    assert.ok(csp.includes("default-src 'self'"));
    assert.ok(csp.includes("script-src-attr 'none'"));
    assert.ok(csp.includes("style-src-attr 'none'"));
    assert.ok(csp.includes("form-action 'none'"));
    assert.ok(!csp.includes('unsafe-inline') && !csp.includes('unsafe-eval'));
    assert.equal(response.headers.get('Content-Security-Policy-Report-Only'), null);
    assert.equal(response.headers.get('Strict-Transport-Security'), 'max-age=15552000');
    assert.equal(response.headers.get('Cache-Control'), 'private, no-cache');
    assert.equal(response.headers.get('ETag'), null);
    const nonce = nonceOf(response);
    assert.ok(nonce && Buffer.from(nonce, 'base64').length === 24);
    const html = await response.text();
    for (const script of html.matchAll(/<script\b[^>]*>/gi)) assert.ok(script[0].includes(`nonce="${nonce}"`));
    assert.ok(!/\sstyle\s*=/i.test(html));
    const css = html.match(/href="(\/assets\/styles\.css\?[^\"]+)"/)[1];
    assert.ok(css.endsWith('v=20261017-security'));
  });
}

test('nonces are different on separate responses', async () => {
  const a = await fetchSite('/'); const b = await fetchSite('/');
  assert.notEqual(nonceOf(a), nonceOf(b));
  await a.text(); await b.text();
});
test('HTML conditional requests get a complete new nonce/body pair', async () => {
  const response = await fetchSite('/about/', { headers: { 'If-None-Match': 'static-asset-tag', 'If-Modified-Since': 'Sat, 17 Oct 2026 00:00:00 GMT' } });
  assert.equal(response.status, 200);
  assert.ok(!assetRequests.at(-1).headers.has('If-None-Match'));
  assert.ok(!assetRequests.at(-1).headers.has('If-Modified-Since'));
  assert.ok((await response.text()).includes(`nonce="${nonceOf(response)}"`));
});
test('preview receives enforced CSP without production HSTS', async () => {
  const response = await mf.dispatchFetch('https://security-preview.example.workers.dev/');
  assert.ok(nonceOf(response));
  assert.equal(response.headers.get('Strict-Transport-Security'), null);
  await response.text();
});
test('HTTP redirects to HTTPS, preserving path and query', async () => {
  const response = await mf.dispatchFetch('http://coping.tools/about/?source=test', { redirect: 'manual' });
  assert.equal(response.status, 301);
  assert.equal(response.headers.get('Location'), origin + '/about/?source=test');
});
test('404 pages retain security headers and a nonce', async () => {
  const response = await fetchSite('/missing-page/');
  assert.equal(response.status, 404);
  assert.ok(nonceOf(response));
  assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
  await response.text();
});
test('service worker keeps same-origin fetch access', async () => {
  const response = await fetchSite('/sw.js');
  assert.ok(response.headers.get('Content-Security-Policy').includes("connect-src 'self'"));
  assert.equal(nonceOf(response), undefined);
  const sw = await response.text();
  assert.ok(sw.includes('coping-tools-v15'));
  assert.ok(sw.includes('/assets/styles.css?v=20261017-security'));
  assert.ok(sw.includes('if (request.method !== "GET") return null'));
});
test('event API rejects unsupported methods', async () => {
  const response = await fetchSite('/api/install-event');
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Allow'), 'POST');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
test('event API rejects foreign or missing Origin without CORS permission', async () => {
  for (const headers of [{ Origin: 'https://other.example' }, { Origin: '' }]) {
    const response = await post('{"event":"installed"}', headers);
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  }
});
test('event API rejects invalid content type', async () => {
  assert.equal((await post('{"event":"installed"}', { 'Content-Type': 'text/plain' })).status, 415);
});
test('event API rejects malformed JSON, unexpected keys and event values', async () => {
  for (const body of ['{', 'null', '[]', 'true', '{"event":"other"}', '{"event":"installed","extra":"x"}', '{"event":{"value":"installed"}}']) {
    assert.equal((await post(body)).status, 400, body);
  }
});
test('event API bounds streamed bodies even without Content-Length', async () => {
  const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('x'.repeat(257))); controller.close(); } });
  assert.equal((await post(body)).status, 413);
});
test('valid events update only a local aggregate counter', async () => {
  for (const event of ['pressed', 'accepted', 'installed']) assert.equal((await post(JSON.stringify({ event }))).status, 204);
  const response = await fetchSite('/api/install-stats', { headers: { Authorization: 'Bearer local-test-token' } });
  assert.deepEqual(await response.json(), { pressed: 1, accepted: 1, installed: 1 });
});
test('stats endpoint rejects missing or incorrect credentials', async () => {
  for (const headers of [{}, { Authorization: 'Bearer wrong' }]) {
    const response = await fetchSite('/api/install-stats', { headers });
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  }
});
