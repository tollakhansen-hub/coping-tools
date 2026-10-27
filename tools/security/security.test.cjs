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

for (const route of ['/', '/body-wont-settle/', '/mind-wont-stop/', '/too-much-at-once/', '/feel-low-or-shut-down/', '/something-has-happened/', '/not-sure/', '/about/', '/for-organisations/', '/how-tools-are-chosen/', '/privacy/', '/update-history/']) {
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
    assert.ok(css.includes('v=20261027-support-options'));
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
  assert.match(sw, /const CACHE = "coping-tools-v\d+"/);
  assert.ok(sw.includes('/assets/styles.css?v=20261027-support-options'));
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


// New private-statistics and guide-action checks (October 2026).
const postJson = (route, body, extraHeaders = {}) => fetchSite(route, {
  method: 'POST',
  body: typeof body === 'string' ? body : JSON.stringify(body),
  headers: { Origin: origin, 'Content-Type': 'application/json', ...extraHeaders }
});
const ownerSignIn = () => postJson('/api/owner-stats/login', { token: 'local-test-token' });
const signedCookie = async () => {
  const reply = await ownerSignIn();
  assert.equal(reply.status, 204);
  const setCookie = reply.headers.get('Set-Cookie');
  assert.ok(setCookie);
  assert.match(setCookie, /__Secure-coping-owner=/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Strict/);
  assert.match(setCookie, /Path=\/api\/owner-stats/);
  assert.match(setCookie, /Max-Age=2592000/);
  return setCookie.split(';')[0];
};
const ownerTotals = async cookie => {
  const response = await fetchSite('/api/owner-stats', { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  return response.json();
};

test('404 fallback matches current international support wording', async () => {
  const response = await fetchSite('/this-page-is-missing/');
  assert.equal(response.status, 404);
  const html = await response.text();
  assert.ok(html.includes('Need support? If possible, reach out to someone you trust or a health professional.'));
  assert.ok(html.includes('In immediate danger or a medical emergency?'));
  assert.ok(html.includes('Contact local emergency services.'));
  assert.ok(!html.includes('Seek the closest medical help.'));
  assert.ok(html.includes('/assets/styles.css?v=20261027-support-options'));
});

test('private dashboard is noindex, uncacheable, and blocks analytics beacon', async () => {
  for (const route of ['/private-stats/', '/private-stats', '/private-stats/index.html']) {
    const response = await fetchSite(route);
    assert.equal(response.status, 200, route);
    const csp = response.headers.get('Content-Security-Policy');
    assert.ok(csp.includes("default-src 'none'"));
    assert.ok(csp.includes("script-src 'self'"));
    assert.ok(csp.includes("connect-src 'self'"));
    assert.ok(!csp.includes('static.cloudflareinsights.com'));
    assert.ok(!csp.includes('cloudflareinsights.com'));
    assert.ok(!csp.includes("'unsafe-inline'"));
    assert.equal(nonceOf(response), undefined);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store, no-transform');
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow, noarchive');
    assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
    const html = await response.text();
    assert.ok(html.includes('id="owner-form"'));
    assert.ok(html.includes('id="owner-guides"'));
    assert.ok(!html.includes('data-feedback-vote'));
    assert.ok(!html.includes('data-guide-print'));
  }
  const publicResponse = await fetchSite('/');
  assert.ok(publicResponse.headers.get('Content-Security-Policy').includes('static.cloudflareinsights.com'));
  await publicResponse.text();
});

test('private stats reject unauthenticated requests and bad sign-in attempts', async () => {
  for (const headers of [{}, { Cookie: '__Secure-coping-owner=bad' }, { Authorization: 'Bearer local-test-token' }]) {
    const response = await fetchSite('/api/owner-stats', { headers });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  }
  assert.equal((await fetchSite('/api/owner-stats/login')).status, 405);
  assert.equal((await postJson('/api/owner-stats/login', { token: 'wrong' })).status, 401);
  assert.equal((await postJson('/api/owner-stats/login', { token: 'local-test-token' }, { Origin: 'https://elsewhere.example' })).status, 403);
  assert.equal((await postJson('/api/owner-stats/login', { token: 'local-test-token', extra: 'x' })).status, 401);
  assert.equal((await postJson('/api/owner-stats/login', { token: 'local-test-token' }, { 'Content-Type': 'text/plain' })).status, 415);
  const response = await fetchSite('/api/owner-stats/login', {
    method: 'POST', body: '{', headers: { Origin: origin, 'Content-Type': 'application/json' }
  });
  assert.equal(response.status, 400);
});

test('owner cookie allows private aggregate reads but does not create visitor events', async () => {
  const cookie = await signedCookie();
  const first = await ownerTotals(cookie);
  assert.ok(first.feedback && first.guides && first.installs);
  for (const page of ['/body-wont-settle/', '/mind-wont-stop/', '/too-much-at-once/', '/feel-low-or-shut-down/', '/something-has-happened/']) {
    assert.ok(first.guides.byPage[page]);
    assert.ok(first.feedback.byPage[page]);
    for (const key of ['print', 'pdf']) assert.ok(Number.isInteger(first.guides.byPage[page][key]));
    for (const key of ['yes', 'no']) assert.ok(Number.isInteger(first.feedback.byPage[page][key]));
  }
  await fetchSite('/private-stats/').then(r => r.text());
  await fetchSite('/private-stats/').then(r => r.text());
  const second = await ownerTotals(cookie);
  assert.deepEqual(second, first, 'dashboard visits and reads must not affect visitor counters');

  assert.equal((await fetchSite('/api/owner-stats', { method: 'POST', headers: { Cookie: cookie } })).status, 405);
  assert.equal((await postJson('/api/owner-stats/logout', {} , { Origin: 'https://elsewhere.example' })).status, 403);
  const logout = await postJson('/api/owner-stats/logout', {});
  assert.equal(logout.status, 204);
  assert.ok(logout.headers.get('Set-Cookie').includes('Max-Age=0'));
  assert.equal((await fetchSite('/api/owner-stats')).status, 401);
});

test('guide-action API validates page, action, method, origin and payload size', async () => {
  assert.equal((await fetchSite('/api/guide-event')).status, 405);
  assert.equal((await postJson('/api/guide-event', { page: '/body-wont-settle/', action: 'print' }, { Origin: 'https://elsewhere.example' })).status, 403);
  assert.equal((await postJson('/api/guide-event', { page: '/body-wont-settle/', action: 'pdf' }, { 'Content-Type': 'text/plain' })).status, 415);
  for (const body of ['{', 'null', '[]', JSON.stringify({ page: '/body-wont-settle/', action: 'print', id: 'user-123' }), JSON.stringify({ page: '/about/', action: 'print' }), JSON.stringify({ page: '/body-wont-settle/', action: 'view' })]) {
    assert.equal((await postJson('/api/guide-event', body)).status, 400, body);
  }
  assert.equal((await postJson('/api/guide-event', 'x'.repeat(257))).status, 413);
});

test('print, PDF and usefulness totals are aggregated by route without user details', async () => {
  const cookie = await signedCookie();
  const baseline = await ownerTotals(cookie);
  const page = '/body-wont-settle/';
  assert.equal((await postJson('/api/guide-event', { page, action: 'print' })).status, 204);
  assert.equal((await postJson('/api/guide-event', { page, action: 'pdf' })).status, 204);
  assert.equal((await postJson('/api/tool-feedback', { page, answer: 'yes' })).status, 204);
  assert.equal((await postJson('/api/tool-feedback', { page, answer: 'no' })).status, 204);
  assert.equal((await postJson('/api/tool-feedback', { page, answer: 'yes', visitor: 'x' })).status, 400);
  const totals = await ownerTotals(cookie);
  assert.equal(totals.guides.byPage[page].print, baseline.guides.byPage[page].print + 1);
  assert.equal(totals.guides.byPage[page].pdf, baseline.guides.byPage[page].pdf + 1);
  assert.equal(totals.feedback.byPage[page].yes, baseline.feedback.byPage[page].yes + 1);
  assert.equal(totals.feedback.byPage[page].no, baseline.feedback.byPage[page].no + 1);
  assert.ok(totals.guides.last30Days.every(row => Object.keys(row).sort().join(',') === 'action,count,day,page'));
  assert.ok(totals.feedback.last30Days.every(row => Object.keys(row).sort().join(',') === 'answer,count,day,page'));
  const serialized = JSON.stringify(totals);
  for (const forbidden of ['user-123', 'visitor', 'ipAddress', 'userAgent', 'email', 'token']) {
    assert.ok(!serialized.includes('"' + forbidden + '"'));
  }
  // Legacy authenticated report still works for existing users.
  const legacy = await fetchSite('/api/tool-feedback-stats', { headers: { Authorization: 'Bearer local-test-token' } });
  assert.equal(legacy.status, 200);
  assert.equal((await legacy.json()).byPage[page].yes, totals.feedback.byPage[page].yes);
});
