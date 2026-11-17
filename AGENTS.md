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
- docs/SPEC.md (version 2) is the source of truth; build only the sections each prompt asks for.
- Vendored files are used unchanged apart from a `// @ts-nocheck` first line where strict TS rejects them: src/lib/sheetParser.ts, src/lib/excelFiles.ts, src/server/shared/pricing.ts, src/server/shared/processing.ts. The spec's supabase/functions/_shared/ path is replaced by src/server/shared/ because this project uses server functions, not edge functions.
- src/server/** is import-protected from client code; load it with `await import()` inside createServerFn handlers in src/lib/*.functions.ts.
- Exchange rates, pricing rules, app_settings, ERP data, output rows and tickets are admin-only via RLS; signed-in users get brand and ERP info only via list_brands() and erp_check() (no prices).
- The first auth user becomes admin via the on_auth_user_created_role trigger; roles change via admin_set_role(), which refuses to remove the last admin.
- ERP data import parses in a Web Worker (SheetJS/PapaParse + readErpData), stages per batch, then finishErpImport verifies admin and calls service-only swap_erp_items() so one entity is replaced in one transaction (service role avoids the user statement timeout).
- Pricing self-test cases live server-side in src/server/selfTestCases.server.ts and run through processSubmission with an in-memory context; only label and pass/fail return to the browser.
- Generate Excel files in the browser and prepare blobs before a download click to preserve browser user activation.
- Implement the design guide's theme in src/styles.css using Tailwind v4 @theme inline, and load remote fonts through the root head; legacy index.css/tailwind.config.ts are not used by this project.
- Keep reusable workflow visuals in src/components.
