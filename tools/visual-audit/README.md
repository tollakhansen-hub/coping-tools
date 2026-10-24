# coping.tools Playwright visual audit

Runs a live visual/technical QA pass against https://coping.tools.

## First-time Termux setup

```bash
cd ~/coping-tools
git pull
cd tools/visual-audit
bash setup-termux.sh
```

## Run

Quick phone check:

```bash
bash run.sh --quick
```

Normal audit: 360px phone, 412px phone, 1366px desktop, light + dark:

```bash
bash run.sh
```

Full audit: 320, 360, 412, 768 and 1366 widths, light + dark:

```bash
bash run.sh --full
```

To audit a preview instead of production, provide its URL first:

```bash
bash run.sh https://YOUR-PREVIEW-URL.example --full
```

Each run creates a timestamped folder under `reports/` with:

- `report.md` — readable summary
- `report.json` — detailed findings
- `screenshots/` — full-page PNGs for every page/viewport/theme combination

The crawler reads the live sitemap and also checks `/not-sure/`.

Checks include HTTP/navigation failures, horizontal overflow, clipped text, browser/request errors, serious WCAG findings via axe-core, tiny interactive targets in the JSON detail, the coping-page section-marker treatment, and interactive See more / See less behaviour (including that the control remains at the end of the visible text).

This tooling is excluded from Cloudflare static assets and is not part of the public website.

## Extended read-only audit (--full)

Running `bash run.sh --full` now also executes `deep-audit.mjs` and writes `deep-report.md` and `deep-report.json` beside the existing screenshot report. No additional npm packages are required.

Additional checks: mobile touch-context audit; axe-core WCAG 2.0/2.1/2.2 AA and best-practice issues of all severities; 14-step keyboard focus observations; per-route title/description/canonical/H1, noindex and duplicate metadata; same-page anchor checks; read-only HEAD checks for same-origin navigation links; HTTPS security headers; manifest and icon availability; service worker readiness; three offline routes (home, coping exercise, privacy).

Use `bash run.sh https://YOUR-PREVIEW.example --full` for a preview. The `--quick` and default modes remain lightweight. All tests use GET or HEAD; they never POST to the installation counter or modify production data. Offline browser storage is isolated to the disposable Chromium context.

Limitations: these tests do not prove WCAG compliance, installability on iOS/Android, screen-reader usability, cognitive clarity, or protection against attacks. Manually inspect screenshots, keyboard focus and zoom/reflow, use TalkBack, and test real installation and service-worker upgrades. HEAD failures may need verification when servers do not support HEAD. The keyboard focus-outline test is heuristic and may overreport.

CSP note: the visual and automated axe scan contexts bypass the production CSP only to inject axe-core (nonce CSP otherwise blocks test scripts). The separate PWA/offline browser context preserves the real CSP and records CSP console errors. A clean audit cannot certify CSP correctness on every route.

Keyboard-check refinement: the deep auditor now stops at the normal end of a keyboard Tab cycle or repeated focus target (up to 40 steps), rather than treating the document BODY after the last link as a broken focus target. It counts only invisible focused controls, heuristic missing outlines and BODY on the first Tab as possible issues. A human keyboard review is still required.
