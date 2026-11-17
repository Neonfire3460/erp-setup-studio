# NMK Unite: build spec (version 2)

Internal web app for NMK. It turns vendor pricelists into a fully filled ERP item upload, one sheet per company entity. Users never see the pricing maths or the final file: an admin reviews and approves every submission. There is no ERP connection yet (an SFTP link comes later, section 15).

## 1. How it works

```
Convert (vendor pricelist, AI)  ─┐
                                 ├─> submission (simple template rows, per entity) ─> processing ─> tickets? ─> admin review ─> approved ERP file (admin only)
Build (user fills a template)  ──┘
                                                                                                                     └─> Catalogue (all users: approved items, retail price, category names)
```

- **Convert:** the user uploads a vendor pricelist. The app finds the item codes, prices and descriptions, asks the user to pick the price when there are several, can suggest better descriptions with AI, and shows a review table. The user fills what is missing (Sub Activity), checks and approves. That creates a submission.
- **Build:** the user picks a brand, a currency and entities, downloads a template with one sheet per entity, fills it in Excel and uploads it. That creates a submission.
- **Processing** (backend, `processing.ts`): adds Supplier, Det. Description, Retail Price, Max Discount, the category codes and flags for each entity. If a calculation, exchange rate or supplier code is missing, it opens a **ticket** for the admins.
- **Admin review:** an admin checks the result and approves or rejects it. Approval produces the final ERP file, which only admins can download.
- **Catalogue:** every user can browse the approved items by entity and brand, with the retail price the system calculated and the category names.

Golden rules:

1. The AI only proposes sheet layouts and description wording. It never creates or changes item codes or prices. Every value is copied from cells by code.
2. Pricing rules, exchange rates, tickets, output rows, ERP data and the final files are admin only. Rates, overheads, margins and costs never reach a normal user's browser, in any API response. The only retail prices users see are those of APPROVED items, on the Catalogue page.
3. Use the attached code files as they are: `src/lib/sheetParser.ts`, `src/lib/convertRules.ts`, `src/lib/excelFiles.ts` (browser) and `supabase/functions/_shared/pricing.ts`, `supabase/functions/_shared/processing.ts` (backend only). Import and call them; never re-implement their logic.
4. Look and components follow `docs/DESIGN.md`.

## 2. Roles and menu

- Email and password login. Roles in `user_roles`: `admin`, `user`. The first account is admin; admins change roles in Admin > Users.
- `user` menu: **Catalogue**, **Convert**, **Build**, **My submissions**.
- `admin` menu adds: **Review queue** (badge: submissions in review), **Tickets** (badge: open tickets), and **Admin** with Pricing rules, Exchange rates, Brands and suppliers, Entities and currencies, ERP data, Settings, Users, Pricing self-test.

## 3. Database

Row level security on every table. "Admin only" means no access at all for `user`.

| Table | Columns | Access |
| --- | --- | --- |
| `entities` | `code` (pk text), `name`, `region` (`Middle East`, `South East Asia`), `currency` (selling currency), `sort_order`, `active` | read: signed in; write: admin |
| `currencies` | `code` (pk, ISO), `name`, `active`, `sort_order` | read: signed in; write: admin |
| `brands` | `brand_activity` (pk), `default_unit` (nullable), `active` | read: signed in; write: admin |
| `sub_activities` | `brand_activity`, `sub_activity`, `active`. Pk (`brand_activity`, `sub_activity`) | read: signed in; write: admin |
| `brand_suppliers` | `brand_activity`, `entity_code`, `supplier`. Pk (`brand_activity`, `entity_code`) | read: signed in; write: admin |
| `exchange_rates` | `from_currency`, `entity_code`, `rate` (1 unit of from_currency in the entity's currency), `updated_at`, `updated_by`. Pk (`from_currency`, `entity_code`). Same currency is always 1 and needs no row | admin only |
| `pricing_rules` | `id`, `brand_activity`, `sub_activity` (null = every sub activity of the brand), `entity_code`, `method` (default `calculate`; processing.ts also supports `same_as_entity` with `source_entity`, not offered in the UI for now), `source_entity`, `overhead_pct`, `margin_divisors` (numeric[]), `round_to` (default 1), `max_discount_pct` (nullable), `compare_with_msrp` (bool, default false), `active`, `updated_at`, `updated_by`. Unique (`brand_activity`, coalesce(`sub_activity`,''), `entity_code`) | admin only |
| `app_settings` | `key` (pk), `value` (json). Keys: `default_inactive` 0, `default_webactive` 0, `default_b2b` 0 (flags for items NOT in the ERP data), `retail_change_warn_pct` 20 | admin only |
| `erp_items` | `entity_code`, `item_code`, and every field of `ErpItem` in excelFiles.ts as snake_case columns (codes AND names of the categories, flags), `refreshed_at`. Pk (`entity_code`, `item_code`), index on upper(`item_code`) | admin only |
| `erp_imports` | `id`, `entity_code`, `file_name`, `row_count`, `imported_at`, `imported_by` | admin only |
| `submissions` | `id` (uuid), `user_id`, `source` (`build` or `convert`), `conversion_id` (nullable), `brand_activity`, `entities` (json: `[{entity_code, cost_currency}]`), `status` (section 6.5), `file_path`, `counts` (json), `created_at`, `submitted_at`, `reviewed_by`, `reviewed_at`, `review_comment`, `output_path` | owner: read, insert, delete while not approved; admin: all |
| `submission_rows` | `id`, `submission_id`, `entity_code`, `cost_currency`, `row_no`, `item_code`, `alternative_code`, `description`, `alternate_description`, `brand_activity`, `sub_activity`, `cost_price`, `measurement_unit`, `vendor_msrp` (nullable, set by Convert), `checks` (json) | owner and admin |
| `output_rows` | `id`, `submission_id`, `entity_code`, `row_no`, `values` (json, the 20 ERP columns), `names` (json, category names), `current_erp_retail`, `checks` (json) | admin only |
| `catalogue_items` | `entity_code`, `item_code`, `brand_activity`, `sub_activity`, `alternative_code`, `description`, `alternate_description`, `retail_price`, `currency` (entity currency), `family_name`, `group_name`, `category_name`, `sub_category_name`, `midwich_family_name`, `submission_id`, `approved_at`. Pk (`entity_code`, `item_code`). Filled on approval (section 9) | read: signed in; write: backend only |
| `tickets` | `id`, `submission_id`, `kind` (`pricing_rule`, `exchange_rate`, `supplier`), `brand_activity`, `sub_activity`, `entity_code`, `currency`, `row_count`, `note`, `status` (`open`, `resolved`), `created_at`, `resolved_at`, `resolved_by` | admin only |
| `conversions` | `id`, `user_id`, `brand_activity`, `files` (json: per pricelist `{path, currency, price_type, discount_pct, mapping}`), `ai_response` (json), `detected_rows` (json), `created_at` | owner and admin |
| `vendor_profiles` | `id`, `brand_activity`, `header_signature`, `mapping` (json), `times_used`, `created_by`, `last_used_at` | read and write: signed in |
| `mapping_corrections` | `id`, `brand_activity`, `headers` (json: header texts of the sheet), `field`, `ai_value`, `user_value`, `created_at` | insert: signed in; read: backend only |
| `description_examples` | `id`, `brand_activity`, `item_code`, `original`, `final`, `created_at` | insert: signed in; read: backend only |

Storage, both private: `pricelists` (uploaded files, path `{user_id}/{id}/{file_name}`; owner and admin), `erp-outputs` (final ERP files; admin only).

Database functions for signed-in users (security definer, they expose no prices):

- `list_brands()`: active brands with their active sub activities.
- `erp_check(codes text[])`: for each code, whether it exists in `erp_items` (any entity, compare upper case) and its ERP description.

## 4. Seed data

- **Entities** (code, name, region, currency, sort order): 001 `NMK 001` Middle East AED 1; 011 `NMK 011` Middle East AED 2; 007 `EDGE 007` Middle East QAR 3; 008 `NMK KSA 008` Middle East SAR 4; 012 `Singapore 012` South East Asia SGD 5; 013 `Malaysia 013` South East Asia MYR 6; 014 `Indonesia 014` South East Asia IDR 7.
- **Currencies**, all active in this order: AED, USD, EUR, SAR, QAR, GBP, SGD, MYR, IDR.
- **Exchange rates** (USD to entity): 001 3.675, 011 3.675, 007 3.65, 008 3.75. Nothing else: missing rates open tickets.
- **Brands and sub activities:** `Lightware / Lightware`, `Turtle AV / Turtle AV` (Turtle AV `default_unit` = `pc`). The ERP data import adds all the others.
- **Brand suppliers:** Lightware 001 `SUP101045`, 011 `SUP100611`, 007 `SUP000160`, 008 `SUP002398`. Turtle AV 001 `SUP101021`, 011 `SUP000077`, 007 `SUP000377`, 008 `SUP002419`.
- **Pricing rules:** Turtle AV, all sub activities, `calculate`, margin_divisors [0.50], round_to 1, max_discount_pct 25, overhead 001 10, 011 5, 007 15, 008 15.
- **App settings** as listed in `app_settings`.
- **Lightware** has no pricing rules on purpose: the Lightware test creates them through tickets, using NMK's formula (section 10.3).

## 5. Files

### 5.1 Input template (what users fill)

Built by `buildTemplateWorkbook()` and read by `readTemplateWorkbook()` in excelFiles.ts. Do not build it any other way.

- One sheet per chosen entity, named `{entity name} ({cost currency})`, for example `NMK 001 (AED)`, `NMK KSA 008 (USD)`.
- Row 1 headers, exactly: `Item Code | Alternative Code | Description | Alternate Description | Brand Activity | Sub Activity | Cost Price | Measurement Unit`.
- Item Code is text. Sub Activity has a dropdown of the brand's sub activities (hidden `Lists` sheet). A very hidden `_meta` sheet records brand, and for every sheet its entity and cost currency.
- `Cost Price` is NMK's buying price in that sheet's cost currency. `0` means price on request.
- Copy rules (applied by `checkTemplateRows()` and `convertRules.ts`): empty Alternative Code = Item Code; empty Alternate Description = Description (and the other way round). Empty Brand Activity = the chosen brand.
- File name: `{brand}_template_{yyyy-mm-dd}.xlsx`.

### 5.2 Final ERP file (admin only)

Built by `buildErpWorkbook()`: one sheet per entity named after the entity (for example `NMK 001`), headers exactly as `ERP_HEADERS` (the 20 columns of `ERP-Upload-Template.xlsx`). Item Code and the five category columns are text; Cost Price, Retail Price, Max Discount, Inactive, Webactive, B2B are numbers. File name: `ERP_{brand}_{yyyy-mm-dd}_{short submission id}.xlsx`. Admins can also download a single entity's sheet as its own file.

### 5.3 ERP data import (admin)

The ERP item export of one entity, for example the 001 export (about 200,000 rows, 23 columns, some header names repeat). Accept `.xlsx` and `.csv`:

- `.csv` (recommended for big files; in Excel "Save as CSV UTF-8"): parse with **PapaParse** in a Web Worker, every value as text.
- `.xlsx`: parse with **SheetJS** (`xlsx`, `dense: true`) in a Web Worker, rows as arrays. Never ExcelJS for this file: it runs out of memory.
- Pass the rows to `readErpData(rows, entityCode)`. It finds the columns by header name (Group, Family and Category appear twice: as a code and as "code - name"; it tells them apart). Show its `problems` (for example "421 rows repeat an item code", or that a column named "Table 4" was read as Sub Activity). Stop when `ok` is false.
- Replace that entity's rows atomically: insert into a staging table in batches of 1,000 with a progress bar, then one database function swaps them in a single transaction. A failed import leaves the old rows untouched.
- Then add missing `brands` and `sub_activities` from `subActivities`, and add `brand_suppliers` for this entity from `suppliers` only where the brand has none yet (never overwrite). Both come from active items only.
- Record an `erp_imports` row. The page shows per entity: rows, active rows, last import date and file.

What the ERP data gives each output row (done by `processSubmission`), matched on exact Item Code (trimmed, any case):

| ERP file column | From the export |
| --- | --- |
| Family Name, Group Name, Category Name, Sub Category Name, Midwich Family | the CODE versions (e.g. `02`, `0206`, `020602`, `L30130`, `06`) |
| Inactive | `Inactive` as is (0 = active in the ERP, 1 = inactive) |
| Webactive | `WEB` (1 = on the website, 0 = not) |
| B2B | the same as `WEB` |
| Measurement Unit | `MU`, when the template leaves it empty |

The NAME versions (`02 - Video`, `0206 - Controllers`, `020602 - Video Switchers`, `L30130 - Video Switchers`, `Other Accessories`) are kept in `output_rows.names` for the Catalogue. Items not in the ERP data get empty categories and the default flags from `app_settings` (0, 0, 0). For entities without their own ERP data, the 001 data is used.

## 6. Build

1. **Choices:** Brand (searchable dropdown from `list_brands()`), Vendor currency (active currencies), entities as cards grouped by region with "select all" per region. Each ticked entity has a small "Cost currency" dropdown that starts at the vendor currency and can be changed (Lightware: 001 is costed in AED, the others in USD).
2. **Download template** with those choices (section 5.1, no rows).
3. **Upload** the filled template. Read it in the browser with `readTemplateWorkbook()` (entities and currencies from the database; `defaultCurrency` = the chosen vendor currency, used only when `_meta` is missing). Show `problems` and stop if there are any. The brand comes from `_meta` when present and must match the chosen brand.
4. **Check** each sheet with `checkTemplateRows()`. Show a summary strip per entity (rows, errors, warnings) and a table per entity tab with a status column. Errors block submitting; "Download rows with problems" gives an Excel of the failing rows with a `Problem` column. Warnings do not block.
5. **Submit:** save the original file to `pricelists`, create the `submissions` row (status `submitted`) and the `submission_rows` (the checked rows, after the copy rules), then call `process-submission`. Show "Submitted. An admin will review it before it goes to the ERP."
6. **My submissions** (users see their own, admins see all): brand, entities, rows, created, status, and the review comment when rejected. A user can delete a submission that is not approved, and "Use again" pre-fills Build with the same brand and entities. Users never see retail prices, rules or the final file.

Statuses: `draft` (Convert not finished), `submitted`, `needs_pricing` (shown to users as "Waiting for pricing"), `in_review`, `approved`, `rejected`.

## 7. Processing (backend function `process-submission`)

Service role, callable by the owner (for their submission) and by admins. It must not return prices to the caller: it returns only the new status and counts.

1. Load the submission rows, the entities, the brand's active `pricing_rules`, `exchange_rates`, the brand's `brand_suppliers`, `brands.default_unit`, `app_settings`, and the `erp_items` rows for the submitted item codes (all entities).
2. Build the `ProcessContext` and call `processSubmission()` from processing.ts. The `erp` lookup returns the same entity's row when it exists, else the row of the first entity by `sort_order` that has the code (`sameEntity` false).
3. Replace the submission's `output_rows` with `outputs`.
4. For each item of `tickets`: if an open ticket with the same kind, brand, sub activity, entity and currency already exists for this submission, update its row_count; else insert one. Resolve this submission's open tickets that are no longer returned.
5. Set status to the returned `status` (`needs_pricing` or `in_review`) and save counts (rows per entity, errors, warnings, tickets).

## 8. Tickets (admin)

The Tickets page lists open tickets, newest first: kind, brand, sub activity, entity (and its currency), cost currency, rows affected, submission and user. Opening one shows its note, 5 sample rows (item code, description, cost) and a form:

- **pricing_rule:** Applies to: "this sub activity" or "all sub activities of {brand}". Overhead %, margin divisors (one or more, each between 0 and 1, shown as "÷ 0.75 ÷ 0.75"), round up to (1 = ROUNDUP 0, 10 = ROUNDUP -1, 100 = ROUNDUP -2, 1000 = ROUNDUP -3), max discount %, and the checkbox "Compare with vendor MSRP". A **Preview** button runs the calculation on the 5 sample rows without saving.
- **exchange_rate:** "1 {currency} = ? {entity currency}".
- **supplier:** the supplier code for this brand and entity.

**Save and calculate** (backend function `resolve-ticket`, admin only): saves the rule, rate or supplier (upsert), resolves every open ticket with the same kind and key in any submission, and re-runs `process-submission` for each affected submission. A submission with no open tickets goes to `in_review`.

## 9. Review queue and final output (admin)

- The queue lists submissions `in_review`: brand, user, entities, rows, warnings, submitted.
- The detail page has a summary strip and one tab per entity with the 20 ERP columns plus "ERP retail now" and "Change %" (from `current_erp_retail`) and a status column with the row checks. Filters: all, warnings, errors, price changes. Search box.
- Buttons: **Approve** (disabled while any row has an error), **Reject** (comment required, shown to the user), **Recalculate** (re-runs `process-submission`, for example after editing a pricing rule), **Download draft** (same file as below, marked DRAFT in the file name).
- **Approve:** build the ERP file in the admin's browser with `buildErpWorkbook()` from `output_rows`, upload it to `erp-outputs`, set `output_path`, `reviewed_by`, `reviewed_at`, status `approved`. Then a backend function upserts the submission's rows into `catalogue_items` (one row per entity and item code; a newer approval replaces an older one). An approved submission is locked.
- Approved submissions keep a **Download ERP file** button (all entities) and a button per entity.

### 9.1 Catalogue (all users)

- Entity picker (default 001) and Brand (searchable, required), from `catalogue_items`.
- Filters (dropdowns filled from the chosen brand's items): Sub Activity, Family, Group, Category, Sub Category, Midwich Family. A search box on Item Code, Alternative Code and Description.
- Table columns, in this order: Item Code, Alternative Code, Description, Alternate Description, Retail Price (with the entity currency in the header), Family, Group, Category, Sub Category, Midwich Family. The category columns show the NAMES (`02 - Video`, `0206 - Controllers` ...), never only the codes.
- Server-side filtering and paging (100 rows), sortable columns, a count ("413 items"), the last approval date, and **Download as Excel** of the filtered rows (same columns).
- No cost, rule or rate appears on this page.

## 10. Pricing

### 10.1 The calculation (inside processing.ts, uses pricing.ts)

- Cost Price = the user's Cost Price, in that entity's cost currency, 2 decimals.
- Rule = the active rule for (brand, sub activity, entity), else the brand-wide rule for that entity (sub activity null), else a ticket.
- `calculate`: retail = cost × exchange rate (cost currency to entity currency; 1 when the same) × (1 + overhead %), divided by each margin divisor in turn, rounded UP to a multiple of round_to (`safeRoundUp`).
- `same_as_entity`: retail = the retail price of the same item in the source entity of the same submission.
- Cost 0 (price on request) gives retail 0.
- Max Discount = rule max_discount_pct, else the ERP data value, else empty.
- When the rule has `compare_with_msrp` and Convert knew the vendor MSRP in the entity's own currency, a retail price different from that MSRP gets the warning "Retail price … is not the vendor MSRP …".

### 10.2 Pricing self-test (Admin)

A backend function runs these cases through `processSubmission()` with an in-memory context (it does not read the database rules) and shows pass or fail per line.

| # | Brand | Entity (selling) | Cost currency | Cost | Rule | Rate | Expected retail |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Lightware | 001 (AED) | AED | 2700 | calculate, overhead 0, ÷0.60, round 1 | 1 | 4500 |
| 2 | Lightware | 011 (AED) | AED | 2700 | calculate, overhead 0, ÷0.60, round 1 | 1 | 4500 |
| 3 | Lightware | 007 (QAR) | USD | 720 | calculate, 11, ÷0.60, round 100 | 3.65 | 4900 |
| 4 | Lightware | 008 (SAR) | USD | 720 | calculate, 5, ÷0.60, round 100 | 3.75 | 4800 |
| 5 | Lightware | 008 (SAR) | USD | 0 | as case 4 | 3.75 | 0 |
| 6 | Turtle AV | 001 (AED) | USD | 95.06 | calculate, 10, ÷0.50, round 1 | 3.675 | 769 |
| 7 | Turtle AV | 008 (SAR) | USD | 95.06 | calculate, 15, ÷0.50, round 1 | 3.75 | 820 |
| 8 | Brightsign | 008 (SAR) | USD | 650 | calculate, 11, ÷0.75 ÷0.75, round 1 | 3.75 | 4810 |
| 9 | DTEN | 014 (IDR) | EUR | 100 | calculate, 10, ÷0.60, round 1 | 18000 | 3300000 |

Cases 8 and 9 catch floating point errors: a plain `Math.ceil` gives 4811 and 3300001.

### 10.3 NMK's Lightware formula (entered through tickets in the test)

| Entity | Cost price | Cost currency | Overhead | Rate | Retail | Round up | Max discount |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 001 NMK 001 | 40% off the vendor MSRP (AED price list) | AED | 0% | 1.00 | landed ÷ 0.60 | to 1 (ROUNDUP 0); compare with vendor MSRP, should be equal | 25 |
| 011 NMK 011 | 40% off the vendor MSRP (AED price list) | AED | 0% | 1.00 | landed ÷ 0.60 | to 1; compare with vendor MSRP | 25 |
| 007 EDGE 007 | 40% off the vendor MSRP (USD price list) | USD | 11% | 3.65 | landed ÷ 0.60 | to 100 (ROUNDUP -2) | 25 |
| 008 NMK KSA 008 | 40% off the vendor MSRP (USD price list) | USD | 5% | 3.75 | landed ÷ 0.60 | to 100 (ROUNDUP -2) | 25 |

Landed cost = cost × rate × (1 + overhead).

## 11. Admin pages

- **Pricing rules:** table (brand, sub activity or "All", entity, overhead, divisors, round to, max discount, compare with MSRP, updated) with add, edit, deactivate, filter by brand.
- **Exchange rates:** a grid, one row per active currency and one column per entity, editable.
- **Brands and suppliers:** brand list with search; per brand: default unit, sub activities (add, rename, deactivate) and one supplier code per entity.
- **Entities and currencies:** simple editable tables.
- **ERP data:** per entity: upload (section 5.3), rows, last import.
- **Settings:** the `app_settings` values.
- **Users:** list, change role.
- **Pricing self-test:** section 10.2.

## 12. Convert

1. **Setup:** Brand, the pricelist file (.xlsx) and its currency (always chosen by the user), and the entities with their cost currency (same picker as Build). If a ticked entity has a cost currency different from the pricelist, ask for a second pricelist in that currency (optional; without it those costs stay empty and must be filled before approval).
2. **Read** each workbook in the browser with ExcelJS and `workbookToSheets()`. Save the files to `pricelists` and create the `conversions` row. Hidden sheets are listed as "hidden, skipped" with a checkbox to include them.
3. **Mapping** per visible sheet: a saved vendor profile when a header row in the first 60 rows matches a `header_signature` of this brand; otherwise `propose-mapping` (section 13.1) once per workbook; then `applyCodeRule()`; then `validateMapping()`; if it fails, `guessMapping()`.
4. **Confirm columns** (one tab per sheet): the first 15 rows as a grid; dropdowns for header row, Item Code, Alternative Code, Description, Alternate Description (long text), Unit, Notes, with a "Swap codes" button; for each code candidate "X of Y codes already in the ERP" (`erp_check`); live counts of items, exceptions and skipped rows (`extractSheet()`); "Not a price table, skip this sheet". When the user changes a column the AI proposed, save a `mapping_corrections` row.
5. **Pick the price:** list every detected price column with its header, the AI's kind and 3 sample values. One column: preselected. Several: the user must pick one. Then "This price is" **NMK cost price** or **List price (MSRP) less discount** with a discount % field (AI kind `vendor_msrp` preselects the second). Same step for the second pricelist.
6. **Extract:** `extractSheet()` per sheet, `resolveDuplicates()`, then `toTemplateRows()` with the price type and discount, and `combinePricelists()` for a second pricelist. Save `detected_rows` and the vendor profile per sheet.
7. **AI descriptions (optional):** ask "Let AI suggest clearer descriptions?" Yes runs `suggest-descriptions` (section 13.2) in batches of 40 with a progress bar. Show Original and Suggested side by side, with Accept all, accept or edit per row. Accepted texts replace **Description** only; Alternate Description keeps the vendor's full text. Save each accepted or edited one to `description_examples`.
8. **Review and complete:** one table: Item Code, Alternative Code, Description, Alternate Description, Sub Activity (required, dropdown, with "set for all selected rows"), Measurement Unit, a cost column per cost currency, status. Tabs for Exceptions (with reasons, from the parser and from `combinePricelists`) and Skipped rows. Inline editing. Checks: `checkTemplateRows()` per entity.
9. **Approve and submit:** the user confirms "I checked this data". The app creates the submission (`source` = `convert`): one sheet per ticked entity with the cost of its cost currency (and `vendor_msrp` from `msrps` of that currency), then the same steps as Build 5. **Download as Excel** gives the same data as a filled template (section 5.1) for editing and uploading in Build instead.

## 13. AI (built-in Lovable AI connector, backend functions)

Temperature 0, structured JSON output, 20 second timeout. Model names in constants `MAPPING_MODEL` (a top reasoning model) and `DESCRIPTION_MODEL` (a fast model). On error return `{ "error": "..." }` and let the user continue without AI.

### 13.1 `propose-mapping`

- **Input:** `brand_activity`, `buildSheetSample()` of each visible sheet (max 8), and the last 10 `mapping_corrections` of this brand plus the last 10 of any brand as "past corrections". Nothing else from the file.
- **Output:**

```json
{ "sheets": [{
  "sheet": "string", "is_price_table": true, "header_row": 5,
  "item_code": "B", "alt_code": "C",
  "item_code_candidates": [{ "col": "B", "header": "Part number", "why": "string" }],
  "description": "D", "det_description": null, "unit": null, "notes": "G",
  "price_columns": [{ "col": "E", "header": "MSRP USD Ex-work", "kind": "vendor_msrp", "currency": "USD" }],
  "currency": "USD", "confidence": "high", "warnings": ["string"]
}] }
```

- **System prompt (use as is):**

```text
You map vendor pricelist spreadsheets for an audio-visual distributor. For each sheet you get sample rows (with Excel row numbers and column letters), statistics per column, and past corrections made by users. Decide the LAYOUT only. Never invent, correct or return prices, item codes or descriptions.

For each sheet:
1. is_price_table: false for cover pages, terms, change logs, or sheets without item codes and prices.
2. header_row: the Excel row number of the first row with column titles. Sheets often repeat the header above each section; return the first one.
3. item_code and alt_code: the columns that identify a product: part number, item code, SKU, model, product name. They hold short code-like values (few or no spaces). If there are two, item_code is the one further LEFT and alt_code the other. If there is one, alt_code is null. List all candidates in item_code_candidates, best first, with a reason under 15 words.
4. description: descriptive text (sentences or long names with spaces). If there are two text columns, description is the shorter one and det_description the longer one; with one, det_description is null. A text column is never also item_code or alt_code.
5. unit and notes only when clearly present. A notes column often has no header and holds words like "New", "EOL", "Call sales".
6. price_columns: every column of money amounts. kind: vendor_msrp (MSRP, list, RRP), buying_price (distributor, dealer, net, cost, special price), suggested_resale (suggested reseller or distributor selling price), other. Margin, discount or percentage columns (headers with % or margin, values mostly below 1) are NOT price columns.
7. currency: ISO code stated in headers, notes or symbols, else null. If sections state different currencies, say so in warnings.
8. Follow the past corrections when the headers look alike.
9. confidence: high only when header row, item code and the price columns are unambiguous.
10. warnings: short and concrete, for example "Rows 33-38 have prices but no SKU".
```

- The browser turns each sheet into a `SheetMapping` (`price` = the column the user picks in step 5; before that the first `buying_price`, else the first price column), applies `applyCodeRule()` and validates it. Save the raw response in `conversions.ai_response`.

### 13.2 `suggest-descriptions`

- **Input:** `brand_activity`; up to 15 style examples: the last accepted `description_examples` of this brand, then ERP descriptions of this brand from `erp_items`; and up to 40 rows `{item_code, alternative_code, description, alternate_description}`.
- **Output:** `{ "items": [{ "item_code": "string", "description": "string" }] }`
- **System prompt (use as is):**

```text
You write item descriptions for the ERP of an audio-visual distributor. For each item write ONE Description that is clear, distinctive and concise.
- 25 to 60 characters, never more than 80.
- Start with what the product is, then the model or product name (alternative_code), then the key fact that tells it apart from similar items: size, channel count, resolution, length, colour, licence term.
- Use only facts found in the input. No marketing words, no prices, no trailing full stop.
- Two items must never get the same Description.
- Follow the style of the examples.
Return every item_code you received, exactly once, unchanged.
```

- Code checks before showing: every item_code returned once and unchanged, text not empty and at most 80 characters, unique in the file (a duplicate gets " - {alternative_code}" appended, and is flagged if still duplicate). A failed row keeps the original text with "AI suggestion not usable". Item codes, prices and other fields are never taken from the AI.

## 14. Acceptance numbers

Parser (`extractSheet()` then `resolveDuplicates()`) on the sample pricelists:

| File, sheet | Mapping | item | duplicate | exception | category | header |
| --- | --- | --- | --- | --- | --- | --- |
| Lightware USD Ex-work, `Category` | header 5, code B, alt code C, description D, price E, notes G | 415 | 38 | 11 | 93 | 64 |
| Lightware AED DDP, `Category` | same | 417 | 41 | 4 | 92 | 64 |
| Midwich SEA, `Pricebook for Midwich` | header 2, code B, description A, price C | 25 | 1 | 10 | 0 | 1 |
| Midwich SEA, `Orbit Pro Pricebook` | header 1, code F, description A, price H | 22 | 0 | 0 | 0 | 1 |

- 16 of the 415 Lightware USD items are price on request (cost 0). Using the AED file as second pricelist: 2 codes only in the USD file, 4 only in the AED file. With "List price less 40%": 91310115 costs USD 720.00 and AED 2700.00.
- `applyCodeRule()` keeps Midwich's code in column B (column A holds long product names).
- Build path: `Test-Lightware-template.xlsx` processed with the formula in 10.3 gives exactly `Expected-Lightware-final-output.xlsx` (4 sheets × 413 rows, all 20 columns). Against NMK's real Lightware ERP upload, 001, 007 and 008 are equal on every row from Supplier to Max Discount; 011 has the same retail prices, and its Cost Price is now in AED (2700 instead of 720 USD), as the formula says.
- Convert path with both Lightware pricelists, the same rules and "compare with vendor MSRP" on 001 and 011: the same cost and retail as the Build path on all 1,630 shared rows; 8 MSRP warnings (4 licence items with MSRPs below 1 AED, in 001 and 011).
- Flags and categories: for all 76 rows of NMK's Furman upload, the categories, unit, Inactive, Webactive and B2B produced from the 001 export are equal to the real file.
- ERP import of the 001 export: 201,332 items, "421 rows repeat an item code", "Table 4" read as Sub Activity, 155 active brands.

## 15. Later (out of scope now)

SFTP link to each entity's ERP: pull categories, Inactive, Webactive and B2B, and push approved files after admin approval. Scheduled ERP data refresh. PDF or CSV pricelists.
