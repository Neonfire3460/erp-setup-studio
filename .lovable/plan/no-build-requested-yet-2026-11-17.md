# No build requested yet

Your message sets the working rules for NMK Unite but doesn't name a task, so nothing will be built or changed.

## Rules I'll follow from now on
- docs/SPEC.md and docs/DESIGN.md are followed exactly. If something conflicts or is unclear, I ask one short question first.
- The parser, convert rules, Excel helpers, pricing and processing files are used as they are and never edited.
- The AI only suggests sheet layouts and description wording. It never creates or changes item codes or prices.
- Pricing rules, exchange rates, tickets, output rows, ERP data and final ERP files stay admin only. Normal users see retail prices only for approved items, on the Catalogue.
- Excel files are handled in the browser, except the large ERP data import, which runs in a background worker.
- Only the requested work gets built. No landing page, marketing copy or dark mode.

## Needed before the next task
- convertRules.ts, excelFiles.ts and the shared pricing.ts and processing.ts aren't in the project yet. Please attach them with the task that needs them.

Send the next task (for example "Build Tool 1 (Convert)") and I'll plan it.
