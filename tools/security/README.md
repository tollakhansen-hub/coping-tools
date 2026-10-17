# Worker security regression checks

Run with Node 22 or newer on a platform supported by workerd:

```sh
cd tools/security
npm ci
npm test
npm audit
```

The 24 checks execute the real Worker in Miniflare/workerd, including its
HTMLRewriter and SQLite Durable Object. ASSETS is a local filesystem fixture;
no requests or counter writes go to the live site. Local test authentication
uses a dummy token that is not a deployment credential.

The test runtime is pinned and its undici and sharp transitive dependencies
are overridden to patched versions. These dependencies and the tests are
excluded from uploaded assets by the root `.assetsignore`.

These are HTTP/runtime regression checks, not a browser penetration test.
Cloudflare's injected challenge scripts, analytics, browser installation,
and offline behavior still need a deployed preview check before promotion.
