# Print and save guide output

The five coping route pages offer a quiet toolbar opposite **All tools**. This file describes the intentionally narrow behavior.

- **Print** calls the native print dialog and separately sends a best-effort, anonymous **Print** action event to `/api/guide-event`. This records a button press, **not a completed print job**. The separate `assets/guide-actions.css` stylesheet preserves each route's title, introduction, exercises, stage progression, examples, cautions and urgent-help note. It suppresses navigation, site footer, cross-links, evidence/references and feedback in the printed document.
- **Save PDF** creates a file directly in the visitor's browser from the **current rendered route's DOM**. It doesn't retrieve a static PDF or send the guide's content off-device. After triggering a successful file download, the script separately sends a best-effort, anonymous **Save PDF** action event to `/api/guide-event`. The generated PDF is A4, text-selectable and intended for uncomplicated personal printing/saving. The PDF includes the guide's own title, intro, all stage content and urgent-help note, plus a small coping.tools route identifier; no cited sources or evidence panels.
- Printing via the browser's native dialog supports choosing A4 or Letter. Save PDF uses A4; page breaks may differ from browser-native printing.
- A timing/stage section is kept on one printed page whenever it fits. For unusually long sections, the browser may split the instructions, but the stage heading must stay with its opening instruction. The PDF generator estimates stage height and moves a whole stage to the next page if necessary; lengthy stages retain a heading-plus-first-content allowance.
- The English text generator uses built-in Helvetica/Helvetica-Bold and Windows-1252 punctuation. If guide text is later translated or needs other characters/scripts, replace it with an embedded Unicode font/PDF library before release; unsupported characters would otherwise be represented by question marks.
- Browser-native print generally preserves accessibility better than this minimal untagged PDF, so the live web route must always remain accessible and be the primary guide.
- The button markup is present but initially hidden, then revealed after the local script initializes. Visitors without JavaScript can still use browser-native Print/Save as PDF. The event payload contains only the route and action (`print` or `pdf`); the Worker validates these values, drops visitor request headers before forwarding, and stores only route/action/UTC-day aggregate counts in its Durable Object. Event delivery never blocks printing or downloads; counts may be incomplete if offline or network-blocked. No per-visitor identifiers, guide content, individual histories or behavioural profiles are stored by this counter. Unlike the old implementation, button-press events are now recorded. The private dashboard at `/private-stats/` requires the existing owner token and is excluded from the public offline cache and browser analytics beacon.

## Checks to repeat after changing a route

1. Confirm **Print** and **Save PDF** sit opposite **All tools** without clipping at 320px, 375px, 768px and desktop; verify keyboard focus, dark mode and forced colors.
2. On each of the five routes, compare text and order with the downloaded PDF and native print preview. In particular check caution notes, voluntary/stop wording, and urgent-help text. Ensure evidence sources/research, feedback, links and header/footer don't appear.
3. Print in A4 and US Letter (including grayscale), check page breaks and text legibility. PDF downloads are A4.
4. Test Chrome Android, Safari iOS and desktop, including app-installed/offline access. If save fails, native print dialog still offers Save as PDF.
5. When editing the guide-button JavaScript or print CSS, bump the service worker cache version and the changed asset's query version so PWA users don't keep stale controls.
6. Verify that print/PDF action payloads contain only a permitted route and action, unauthorized read endpoints stay blocked, and the private dashboard does not create visitor events or appear in the public analytics pageview count.

This document describes the implementation on the main branch; it does not by itself confirm production deployment or print layout on a real device.
