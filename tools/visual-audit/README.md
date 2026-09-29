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

Each run creates a timestamped folder under `reports/` with:

- `report.md` — readable summary
- `report.json` — detailed findings
- `screenshots/` — full-page PNGs for every page/viewport/theme combination

The crawler reads the live sitemap and also checks `/not-sure/`.

Checks include HTTP/navigation failures, horizontal overflow, clipped text, browser/request errors, serious WCAG findings via axe-core, tiny interactive targets in the JSON detail, and the coping-page section-marker treatment.

This tooling is excluded from Cloudflare static assets and is not part of the public website.
