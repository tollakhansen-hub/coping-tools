# Print and save guide output

The five coping route pages offer a quiet toolbar opposite **All tools**. This file describes the intentionally narrow behavior.

- **Print** calls the native print dialog. The separate `assets/guide-actions.css` stylesheet preserves each route's title, introduction, exercises, stage progression, examples, cautions and urgent-help note. It suppresses navigation, site footer, cross-links, evidence/references and feedback in the printed document.
- **Save PDF** creates a file directly in the visitor's browser from the **current rendered route's DOM**. It doesn't retrieve a static PDF, call an API, send content off-device, set local storage or record a save event. The generated PDF is A4, text-selectable and intended for uncomplicated personal printing/saving. The PDF includes the guide's own title, intro, all stage content and urgent-help note, plus a small coping.tools route identifier; no cited sources or evidence panels.
- Printing via the browser's native dialog supports choosing A4 or Letter. Save PDF uses A4; page breaks may differ from browser-native printing.
- The English text generator uses built-in Helvetica/Helvetica-Bold and Windows-1252 punctuation. If guide text is later translated or needs other characters/scripts, replace it with an embedded Unicode font/PDF library before release; unsupported characters would otherwise be represented by question marks.
- Browser-native print generally preserves accessibility better than this minimal untagged PDF, so the live web route must always remain accessible and be the primary guide.
- The button markup is present but initially hidden, then revealed after the local script initializes. Visitors without JavaScript can still use browser-native Print/Save as PDF. No storage or behavioral profiling was added.

## Checks to repeat after changing a route

1. Confirm **Print** and **Save PDF** sit opposite **All tools** without clipping at 320px, 375px, 768px and desktop; verify keyboard focus, dark mode and forced colors.
2. On each of the five routes, compare text and order with the downloaded PDF and native print preview. In particular check caution notes, voluntary/stop wording, and urgent-help text. Ensure evidence sources/research, feedback, links and header/footer don't appear.
3. Print in A4 and US Letter (including grayscale), check page breaks and text legibility. PDF downloads are A4.
4. Test Chrome Android, Safari iOS and desktop, including app-installed/offline access. If save fails, native print dialog still offers Save as PDF.
5. When editing this feature, bump the service worker cache version and the JS/CSS asset query version so PWA users don't keep stale controls.

No site deployment is implied by this documentation; preview changes must be reviewed before publishing.
