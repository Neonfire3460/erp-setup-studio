<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- v3 (Item Registration) is the current app. The plan and decisions live outside the repo (kit v3: site-flow plan, gap-decisions.md gaps 1-26); docs/v3/migration-v3.sql is the database change (applied as drizzle/migrations/0009_v3_item_registration.sql).
- Shared logic is plain TypeScript in src/lib/nmk/ (pricing, price check, template, ticket rows, ERP file, ERP import, categories, cross-check, PDF order and layout). It has no React or Supabase imports, so it runs in the browser, in workers and in server functions.
- Server functions live in src/lib/v3/*.functions.ts; server-only helpers in src/server/v3/*.server.ts, loaded with `await import()` inside handlers (src/server/** is import-protected from client code).
- Confidential: exchange rates, overheads, divisors, margins and ERP data never reach a normal user's browser, except per-item cost, retail and max discount of a brand's ERP items (price check, ERP Items page), which Suraj asked brand managers to see (26 Nov 2026). Ticket rows (ir_ticket_rows), fx_rates, pricing_rules, app_settings and erp_items are staff-only under RLS; users get price-check results from server functions only.
- Roles: admin, reviewer, approver, user (several per person). Admin implies every role. Roles change through admin_set_roles(), which keeps at least one admin.
- Ticket status changes go through the ir_transition()/ir_approve() RPCs from server functions; drafts are written by the owner under RLS.
- ERP import parses in a Web Worker (src/lib/nmk/erpImport.worker.ts), inserts batches into erp_items under a new erp_imports id, then merge_erp_import() replaces only the brands in the file. Every ERP lookup reads erp_items_active.
- Emails go through the Resend REST API with the RESEND_API_KEY secret, logged in email_log; test mode sends everything to email_test_address. An email failure never blocks a ticket.
- The PDF Pricelist is built in the browser with jsPDF + jspdf-autotable (import jsPDF from "jspdf/dist/jspdf.es.min.js", the Worker build can't resolve "jspdf"). Default logos are in public/pdf/.
- Generate Excel files in the browser and prepare blobs before a download click to preserve browser user activation.
- Implement the design guide's theme in src/styles.css using Tailwind v4 @theme inline, and load remote fonts through the root head; legacy index.css/tailwind.config.ts are not used by this project.
- Never commit ERP exports, vendor pricelists or other confidential data to the repo.
- Tickets have a kind: registration (IR-) or status_change (ST-, Active/Inactive, reviewer only, no approver). needed_by is required (earliest today + 3, src/lib/nmk/dates.ts); admin queues group by week. Pending/approved item_status_changes overlay the ERP state on the ERP Items page.
- AI (Lovable gateway via src/server/v3/ai.server.ts callTool) only maps columns, suggests new-item details and descriptions; never codes or prices. What people keep is saved in ai_description_examples and fed back per brand.
