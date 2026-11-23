# ERP Setup Studio

This is an internal tool. The full specification is in docs/SPEC.md. Follow it exactly.

Rules:
- Do not change the logic in src/lib/sheetParser.ts or the pricing module. Import and call them.
- The AI only proposes the sheet layout. It never returns or edits prices, item codes or descriptions.
- pricing_rules, pricing_rule_entities and export_audit are admin-only. Rates, overheads, discounts and margins must never reach a normal user's browser, in any API response.
- Plain UI with the default components. No landing page, marketing copy, animations, dark mode toggle or features that are not in the spec.
- Build only what the current prompt asks for. Do not refactor unrelated code.
- Read and write Excel files with ExcelJS in the browser.

Build the foundation of the app described in the attached SPEC.md.
First:
- Save SPEC.md as docs/SPEC.md.
- Save sheetParser.ts as src/lib/sheetParser.ts, unchanged.
- Save pricing.ts unchanged where backend functions can import it. It must not be bundled into browser code.
- Keep ERP-Upload-Template.xlsx in the project as the reference for the output headers.
Then build ONLY these parts of the spec:
- Section 1: login, roles, first account becomes admin.
- Section 2: all tables, row level security, the storage bucket, and the two database functions list_activities and count_erp_matches.
- Section 3: all seed data.
- Section 9: the Admin area, except History. Include the "Pricing self-test" button. For now it calls a small backend function that runs the section 8 test cases through calculatePrice and returns only pass or fail per line.
- App shell with a left menu: Convert, Build, History, Admin (admin only). Convert, Build and History are empty placeholder pages for now.
Do not build Tool 1 or Tool 2 yet. When finished, tell me in a short list what you created and anything in the spec you could not do.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a679d584-cf45-4485-ba83-da4303a61964).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
