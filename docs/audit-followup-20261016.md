# coping.tools — audit follow-up, 16 October 2026

## Prepared changes (feature branch, not production)

- Trial a complete Content Security Policy using `Content-Security-Policy-Report-Only`. The existing enforced `object-src`, `base-uri`, and `frame-ancestors` policy remains in place. A tighter enforced policy needs browser testing because Cloudflare Web Analytics and challenge scripts must continue to work.
- Add canonical-host security response headers for the Worker-managed API and HTML responses. Keep HSTS at the existing one-day trial duration rather than increasing it without redirect verification.
- Restrict `GET /api/install-stats` to requests with `Authorization: Bearer <token>` against a Cloudflare Worker secret named `STATS_READ_TOKEN`. With no secret configured, it returns 404. The event-counting POST remains unchanged. The aggregate numbers remain stored in the same Durable Object.
- Make the service worker's initial caching fault-tolerant so a missing asset does not invalidate the entire installation. Retain all public content routes for offline use; keep only fonts and stylesheet URLs currently needed for the English site in the precache. Non-Latin font files remain on the server and can still be fetched online.
- Improve legibility of small section labels and research notes, small-screen spacing, forced-colors support, and focus/tap-target styling.
- Add an existing 512-pixel square brand icon for Open Graph and Twitter summaries on indexable pages. This is a conservative preview asset, not a new landscape social card.
- Update the privacy description of Cloudflare Web Analytics and owner-only aggregate totals; clarify editorial responsibility in the For organisations page.
- Refresh relevant sitemap modification dates and extend the Playwright audit to click and collapse the inline evidence links.

## Before releasing this branch

1. In Cloudflare, open Workers & Pages → **coping-tools** → Settings → Variables and Secrets. Add **STATS_READ_TOKEN** as an encrypted Worker secret, with a long unique random value. Do not put it in Git or client JavaScript. An existing read-only workflow for install statistics must be updated to send `Authorization: Bearer ...` before publication; otherwise it will stop receiving counts. No secret is required for recording install events.
2. Deploy a preview (not production), inspect the HTML response headers, and check whether the report-only CSP flags inline JSON-LD, Web Analytics, Cloudflare challenge scripts, or other required resources. Do not enforce the new CSP until violations have been reviewed. Cloudflare's own guidance recommends reporting/testing before enforcing.
3. Run `tools/visual-audit/run.sh --full` against the preview, checking 320, 360, 412, 768, and 1366 pixel widths in light/dark mode. Review screenshots as well as axe, overflow, and evidence expansion results. Check keyboard Tab/Enter/Space, focus after expanding, 200% text zoom, and 400% zoom on a phone-sized display.
4. Check the Worker redirect on `http://coping.tools/` and `http://coping.tools/body-wont-settle/`: they should redirect to HTTPS. If this does not happen before reaching the Worker, use Cloudflare's **Always Use HTTPS** setting or an appropriate redirect rule; do not assume a missing `_redirects` file indicates the site has no redirect.
5. For Cloudflare challenge false positives, inspect **Security → Events** for challenge action, matching rule ID, country/network and browser. Narrow any adjustment to the identified legitimate traffic and rule. **Do not globally bypass bot protection or Cloudflare WAF.** This needs Cloudflare account access and cannot be safely fixed by editing the website files alone.
6. Test `GET /api/install-stats` without credentials (404) and with the configured secret (200 + aggregate counts), `POST /api/install-event` with same-origin constraints, and successful page loads both online and offline. Verify anonymous visitors cannot access aggregate totals.
7. If the brand's square preview icon crops awkwardly in a specific sharing app, design/test a future dedicated 1200×630 preview. Do not block this security/maintenance update on that optional artwork.

## Not silently changed

The five core coping exercises, their evidence claims, all supporting references and review dates, non-diagnostic tone, urgent-help boundary, absence of accounts/ads, and the existing one-day HSTS posture were left intact. No Cloudflare account security rules were changed from this branch. Deployment is intentionally a separate approval.
