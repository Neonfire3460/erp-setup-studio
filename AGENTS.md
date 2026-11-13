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
- docs/SPEC.md is the source of truth; build only the sections each prompt asks for.
- src/lib/sheetParser.ts and src/server/pricing.server.ts are vendored verbatim from the spec; never change their logic (sheetParser only has a `// @ts-nocheck` header because the project's strict TS flags reject it).
- Pricing maths lives only in src/server/pricing.server.ts; load it with `await import()` inside server-function handlers so it never enters the browser bundle (src/server/** is import-protected from client code).
- Server functions live in src/lib/*.functions.ts (src/server/** cannot be imported by client code).
- pricing_rules, pricing_rule_entities and export_audit are admin-only via RLS; normal users get rule info only through list_activities() (no numbers).
- The first auth user becomes admin via the on_auth_user_created_role trigger; roles change via admin_set_role(), which refuses to remove the last admin.
- reference/ERP-Upload-Template.xlsx is the reference for ERP output headers.
- Build preview, export and pricing self-test share buildRows.server.ts; only whitelisted ERP columns and checks cross the server boundary, while audited exports are repriced and saved atomically.
- ERP replacement stages each upload under its own admin-owned batch and swaps through a transaction-scoped database function; partial staging never changes the master.
- Generate Excel files in the browser and prepare blobs before a download click to preserve browser user activation.
