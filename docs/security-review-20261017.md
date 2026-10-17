# coping.tools security hardening and review — 17 October 2026

Status: prepared on a review branch; not verified on a Cloudflare preview or
published to production. Baseline: 5f680aa5b7ec0471c8a93f2d179024ab9e417a4a.

## Implementation

- Replace the report-only resource policy with enforced CSP on HTTPS
  responses, including previews. Keep the required same-origin, Cloudflare
  Analytics and challenge sources. Block inline event handlers, inline styles,
  eval, plugins, framing, base-URL changes and form submissions.
- Use a fresh random 192-bit script nonce on each HTML response. HTMLRewriter
  adds the matching nonce to the trusted static HTML's script elements.
  Cloudflare documents support for propagating a header nonce to injected
  JavaScript Detections scripts. This still requires live edge validation.
- Move four inline footer styles into equivalent CSS classes, update CSS
  references and bump the offline cache version to v15.
- Strip HTML conditional validators before ASSETS, remove static HTML ETags
  after rewriting, and mark transformed HTML `private, no-cache`. This avoids
  combining an old cached body with a new nonce. Service-worker caching remains
  allowed, but end-to-end offline/browser validation remains pending.
- Set HSTS to 15,552,000 seconds (180 days) only on coping.tools. Do not add
  includeSubDomains or preload. This does not establish subdomain TLS safety.

## Verified code and local runtime findings

1. **Install-event input controls — verified.** The API accepts only POST with
   exactly matching Origin, JSON content type, at most 256 streamed bytes and
   one of pressed/accepted/installed. Unexpected keys are rejected. Queries
   use SQL parameter binding. Only aggregate event names are forwarded to the
   Durable Object; visitor headers are not forwarded by this code.
2. **Statistics access — verified in code/local tests.** Reads require
   STATS_READ_TOKEN and are hidden with 404 otherwise; responses use no-store.
   Whether a production token is configured was not checked, and no secret
   value was requested or inspected.
3. **Counter integrity/abuse — moderate, verified design limitation.** Origin
   is a browser request control, not authentication. Non-browser callers can
   forge it. No application rate limit or event deduplication is present in
   the reviewed Worker. Counts can be inflated and traffic can consume Worker
   and Durable Object resources. Treat counts as approximate. Review an
   account-side endpoint rate limit and quotas before choosing thresholds;
   no rate-limit binding or Cloudflare rule was created in this change.
4. **Production dependencies — verified repository inventory.** The deployed
   code has no npm runtime dependency manifest; cloudflare:workers is a platform
   import. Fonts are self-hosted. Cloudflare can inject its own scripts, so
   the deployed response is not proven equivalent to repository HTML alone.
5. **Development dependencies — checked.** Existing visual-audit dependencies
   remain pinned and now have an integrity lockfile. npm audit reported zero
   known vulnerabilities for that lockfile. The new security-test tooling has
   a lockfile and patched transitive overrides; npm audit reported zero known
   vulnerabilities. An audit result is not proof that packages are safe.
6. **Source exposure — limited check.** No tracked credential/config filename
   candidates or common GitHub-token/AWS-key/private-key patterns were found.
   This was a current-tree pattern check, not a full history or secret audit.
7. **Asset isolation — verified configuration.** .assetsignore excludes
   repository metadata, tools, docs, Worker source and Wrangler configuration.
   Actual uploaded assets and deployment settings were not inspected.

## Deployment and account access evidence

- wrangler.jsonc identifies a Worker named coping-tools with ASSETS,
  run_worker_first=true, and a SQLite InstallStats Durable Object. Security
  headers must therefore be set in the Worker, not solely in _headers.
- No .github workflow files exist in the reviewed tree. No GitHub commit-status
  checks were returned for the baseline commit. These facts do not establish
  whether Cloudflare Git Builds, deploy hooks or other automation are enabled.
- The GitHub rulesets endpoint returned an empty array. The legacy branch
  protection endpoint returned 403, Resource not accessible by integration.
  Branch protection therefore remains **not checked**, not proven absent.
- Cloudflare dashboard redirected to sign-in. Cloudflare MFA, account members,
  token scopes, recovery controls, build integration, preview isolation, WAF
  rules, TLS settings and rollback history remain **not checked**.
- No account permissions, credentials, security rules or deployment bindings
  were changed. No database rows were read from production.

## Validation

24 local workerd/Miniflare regression checks cover all 11 routes, matching and
unique CSP nonces, preview CSP, production-only HSTS, HTTP redirects,
conditional HTML requests, 404 headers, service-worker policy access, malformed
and oversized API bodies, aggregate event writes and unauthorized stats reads.
All local counter writes use an ephemeral test Durable Object.

The fixture serves repository files through a mocked ASSETS binding. It does
not emulate Cloudflare's edge challenge injection or browser enforcement.
The test runtime uses compatibility date 2026-07-30 (the installed runtime's
supported date); production configuration remains unchanged at 2026-09-29.

Before publishing: verify an isolated deployed preview's console and network
requests, fonts, stage styling, evidence disclosure, installation, offline
reload and actual analytics/challenge behavior. Then publish and verify live
CSP, HSTS, redirects and error/API response headers. Review authenticated
account settings separately. Formal ASVS compliance is not established.

## Reference documentation

- https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/
- https://developers.cloudflare.com/fundamentals/reference/policies-compliances/content-security-policies/
- https://developers.cloudflare.com/workers/static-assets/headers/
- https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/
