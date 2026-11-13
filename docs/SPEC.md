# NMK Pricelist to ERP: build spec

Internal web app. Brand managers upload vendor pricelists (Excel, any layout). The app produces one fully filled Excel file per company entity in the ERP upload template. There is NO connection to the ERP: files are downloaded (SFTP comes later, out of scope).

Two tools share one file format, the **input template**:

- **Tool 1, Convert:** vendor pricelist -> AI proposes column mapping -> user confirms -> review table -> download Excel in the input template. The user edits it in Excel and adds Sub Activity.
- **Tool 2, Build:** user re-uploads the edited input template (or one filled by hand) -> picks entities -> backend prices each row per entity and adds ERP fields -> review -> download one ERP Excel per entity.

Golden rules:

1. The AI only proposes the layout of a sheet. It never returns prices, item codes or descriptions. Every value is copied from the cells by `src/lib/sheetParser.ts`.
2. Pricing rules (discounts, exchange rates, overheads, margins) are confidential. They are readable by admins only and are used only inside backend functions. They must never be sent to the browser of a normal user.
3. Use the two attached code files verbatim. Do not rewrite their logic.
4. Plain, clean UI with the default component library. No landing page, no animations, no extra features.

## 1. Roles and access

- Email and password login. No public sign-up page content beyond login and sign-up.
- Roles in a separate `user_roles` table: `admin`, `user`. The first account created becomes admin. Admins can change roles.
- `user`: Tool 1, Tool 2, own history.
- `admin`: everything, plus the Admin area and everyone's history.

## 2. Database

Row level security on every table.

| Table | Columns | Access |
| --- | --- | --- |
| `entities` | `code` (pk, text), `name`, `region`, `currency`, `sort_order` | read: signed in; write: admin |
| `brands` | `brand_activity` (pk), `supplier` (text for the ERP Supplier column), `default_unit` (nullable) | read: signed in; write: admin |
| `pricing_rules` | `id`, `brand_activity`, `sub_activity`, `vendor_currency`, `cost_method` (`discount_from_msrp` or `net_price`), `discount_pct`, `margin_divisors` (numeric array), `max_discount_pct` (nullable), `is_test` (bool), `active` (bool), `updated_at`, `updated_by`. Unique on (`brand_activity`, `sub_activity`, `vendor_currency`) | **admin only**, read and write |
| `pricing_rule_entities` | `rule_id`, `entity_code`, `ex_rate`, `overhead_pct`. Pk (`rule_id`, `entity_code`). No row means the rule is not available for that entity | **admin only** |
| `erp_items` | `item_code` (pk, stored trimmed and upper case), `family_name`, `group_name`, `category_name`, `sub_category_name`, `midwich_family`, `measurement_unit`, `inactive`, `webactive`, `b2b` (all text), `refreshed_at` | read: signed in; write: admin |
| `vendor_profiles` | `id`, `brand_activity`, `header_signature`, `mapping` (json), `created_by`, `last_used_at` | read and write: signed in |
| `uploads` | `id` (uuid, this is the batch id), `tool` (`convert` or `build`), `user_id`, `brand_activity`, `vendor_currency`, `file_name`, `file_path`, `mapping` (json), `ai_response` (json), `counts` (json), `detected_rows` (json), `created_at` | owner and admin |
| `exports` | `id`, `upload_id`, `user_id`, `entity_code`, `row_count`, `rows` (json, the final ERP rows), `created_at` | owner and admin |
| `export_audit` | `export_id`, `rule_snapshot` (json: the rules and rates used) | **admin only** |

Storage bucket `pricelists` (private): original uploaded files, path `{user_id}/{upload_id}/{file_name}`.

Two database functions, callable by any signed-in user, that expose NO numbers:

- `list_activities()` returns, for active rules: `brand_activity`, `sub_activity`, `vendor_currency`, `cost_method`, `entity_codes` (array). Security definer.
- `count_erp_matches(codes text[])` returns how many of the given codes exist in `erp_items` (compare trimmed, upper case).

## 3. Seed data

Entities:

| code | name | region | currency |
| --- | --- | --- | --- |
| 001 | NMK 001 | Middle East | AED |
| 011 | NMK 011 | Middle East | AED |
| 007 | EDGE Qatar 007 | Middle East | QAR |
| 008 | Saudi 008 | Middle East | SAR |
| 012 | Singapore 012 | South East Asia | SGD |
| 013 | Malaysia 013 | South East Asia | MYR |
| 014 | Indonesia 014 | South East Asia | IDR |

Pricing rules. Format per entity is `ex_rate / overhead_pct`. A dash means no row for that entity.

| brand_activity | sub_activity | currency | cost_method | discount_pct | 001 | 011 | 007 | 008 | margin_divisors | is_test |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Brightsign | Brightsign | USD | discount_from_msrp | 35 | 3.675 / 10 | 3.675 / 5 | 3.65 / 18 | 3.75 / 11 | 0.75, 0.75 | false |
| Brightsign | Brightsign Service | USD | discount_from_msrp | 35 | 3.675 / 0 | 3.675 / 0 | 3.65 / 0 | 3.75 / 0 | 0.75, 0.75 | false |
| LDA | LDA | EUR | discount_from_msrp | 50 | - | - | - | 4.5 / 18 | 0.50 | false |
| LDA | LDA License | EUR | discount_from_msrp | 50 | - | - | - | 4.5 / 0 | 0.50 | false |
| 7thSense | 7th Sense | USD | net_price | 0 | 3.675 / 8 | 3.675 / 5 | 3.65 / 10 | 3.75 / 10 | 0.60 | false |
| 7thSense | 7th Sense Warranty | USD | net_price | 0 | 3.675 / 0 | 3.675 / 0 | 3.65 / 0 | 3.75 / 0 | 0.60 | false |
| 7thSense | Medialon | USD | discount_from_msrp | 40 | 3.675 / 8 | 3.675 / 5 | 3.65 / 10 | 3.75 / 10 | 0.60 | false |
| Ampetronic | Ampetronic | GBP | net_price | 0 | 5.1 / 16 | 5.1 / 11 | 5.1 / 16 | 5.2 / 16 | 0.50 | false |
| Ampetronic | Listen | GBP | net_price | 0 | 5.1 / 16 | 5.1 / 11 | 5.1 / 16 | 5.2 / 16 | 0.50 | false |
| Ampetronic | Auri | GBP | net_price | 0 | 5.1 / 16 | 5.1 / 11 | 5.1 / 16 | 5.2 / 16 | 0.50 | false |
| Lightware | Lightware | AED | discount_from_msrp | 40 | 1 / 10 | 1 / 5 | - | - | 0.60 | true |
| Lightware | Lightware | USD | discount_from_msrp | 40 | - | - | 3.65 / 18 | 3.75 / 11 | 0.60 | true |

One more test rule for South East Asia: `DTEN / DTEN / USD / net_price / 0`, margin_divisors `0.70`, is_test true, entities `012: 1.35 / 10`, `013: 4.70 / 10`, `014: 16000 / 10`.

Brands: one row per brand_activity above, `supplier` = `TO SET`, `default_unit` empty. Rows marked `is_test` show a "TEST" badge in the admin screen.

## 4. File formats

### 4.1 Input template (written by Tool 1, read by Tool 2)

Sheet `Upload`, headers in row 1, exactly these and in this order:

`Item Code | Alternative Code | Description | Alternate Description | Det. Description | Brand Activity | Sub Activity | Vendor Price | Max Discount | Measurement Unit | Vendor Group | Vendor Note | Source`

- `Item Code` cells are text format, so leading zeros survive.
- `Vendor Price` is the price exactly as in the vendor pricelist, in the vendor's currency. Whether it is a vendor MSRP or a net buying price is decided by the pricing rule, not by the user.
- `Brand Activity` is the same on every row (one brand per file).
- `Sub Activity` is required. In files written by Tool 1 it is empty, highlighted yellow, with a dropdown fed from a hidden `Lists` sheet (the sub activities of that brand from `list_activities()`).
- `Max Discount` is optional, 0 to 100.
- `Vendor Group`, `Vendor Note`, `Source` are information only. Tool 2 ignores them.
- A very hidden sheet `_meta` holds `batch_id`, `brand_activity`, `vendor_currency`.

A "Download blank template" button gives the same workbook with no rows, for users who skip Tool 1.

### 4.2 ERP upload file (final output of Tool 2)

One workbook per entity, one sheet, headers in row 1 exactly as in the attached `ERP-Upload-Template.xlsx`:

`Supplier | Item Code | Alternative Code | Description | Alternate Description | Det. Description | Brand Activity | Sub Activity | Cost Price | Retail Price | Max Discount | Family Name | Group Name | Category Name | Sub Category Name | Midwich Family | Measurement Unit | Inactive | Webactive | B2B`

File name: `{entity_code}_{brand_activity}_{yyyy-mm-dd}.xlsx`.

| Column | Source |
| --- | --- |
| Supplier | `brands.supplier` |
| Item Code to Det. Description, Brand Activity, Sub Activity | input template |
| Cost Price | calculated: NMK buying price in the VENDOR currency, 2 decimals |
| Retail Price | calculated per entity, in the entity currency, whole number |
| Max Discount | input template, else `pricing_rules.max_discount_pct`, else empty |
| Family Name, Group Name, Category Name, Sub Category Name, Midwich Family, Inactive, Webactive, B2B | `erp_items` by item code. Empty if the item is not in `erp_items` |
| Measurement Unit | input template, else `erp_items.measurement_unit`, else `brands.default_unit` |

## 5. Tool 1: Convert

1. **Upload form:** file (.xlsx), Brand Activity (dropdown from `list_activities()`), Vendor Currency (dropdown, required, always chosen by the user, never trusted from the file).
2. **Read** the workbook in the browser with ExcelJS and `workbookToSheets()`. Save the original file to storage and create the `uploads` row. Hidden sheets are listed as "hidden, skipped" with a checkbox to include them.
3. **Mapping** for each visible sheet, in this order:
   - a. Saved profile: look in the first 60 rows for a row whose normalised cells (lower case, trimmed, joined with `|`) equal a `vendor_profiles.header_signature` of this brand. If found, use its mapping with that row as `headerRow`.
   - b. Otherwise call the backend function `propose-mapping` once for the whole workbook (section 6).
   - c. Run `validateMapping()` on every proposed mapping. If it fails, or the AI call fails, use `guessMapping()`. If that fails too, start with an empty mapping.
4. **Confirm mapping screen**, one tab per sheet: first 15 rows of the sheet as a grid; dropdowns for header row, Item Code, Price, Description, Det. Description, Alternative Code, Unit, Notes, prefilled from step 3; the AI's confidence and warnings; for each item code candidate the text "X of Y codes already exist in the ERP" from `count_erp_matches`; a live count of items, exceptions and skipped rows that updates when a dropdown changes (`extractSheet()`); a toggle "Not a price table, skip this sheet". Button "Confirm" is disabled while `validateMapping()` reports problems.
5. On confirm: `extractSheet()` per sheet, then `resolveDuplicates()` across sheets. Save `mapping`, `counts` and `detected_rows` on the upload. Save or update the vendor profile per sheet.
6. **Review screen:**
   - Summary strip per sheet: items, section titles, duplicates, skipped, exceptions, and all warnings.
   - Table of rows with kind `item` and `exception`: Status, Item Code, Description, Det. Description, Vendor Price, Vendor Group, Vendor Note, Sheet, Row. Exceptions are amber with the reason. Filter by sheet and status, search box.
   - Toggle "Show skipped rows" lists `category`, `header`, `note`, `duplicate` rows with their reason. `blank` rows are only counted.
7. **Download Excel:** workbook per section 4.1 with all `item` rows in `Upload`, plus sheet `Check` (exception rows with reason, sheet and row) and sheet `Skipped` (skipped rows with reason). Then show: "Edit this file in Excel, fill Sub Activity, then upload it in Build."

## 6. AI mapping (backend function `propose-mapping`)

- Uses the built-in Lovable AI connector. Model name in ONE constant `MAPPING_MODEL`; start with a top reasoning model from the available list. Temperature 0. Structured JSON output (tool calling or JSON schema).
- Called at most once per workbook, and not at all when saved profiles cover every sheet.
- **Input:** `brand_activity`, `preferred_price_kind` (`vendor_msrp` if all the brand's rules are `discount_from_msrp`, `buying_price` if all are `net_price`, else null), and `buildSheetSample()` of each visible sheet (max 8 sheets). Nothing else from the file is sent.
- **Output schema:**

```json
{
  "sheets": [{
    "sheet": "string",
    "is_price_table": true,
    "header_row": 5,
    "item_code": "B",
    "item_code_candidates": [{ "col": "B", "header": "Part number", "why": "string" }],
    "alt_code": null,
    "description": "C",
    "det_description": "D",
    "unit": null,
    "notes": "G",
    "price_columns": [{ "col": "E", "header": "MSRP USD Ex-work", "kind": "vendor_msrp", "currency": "USD" }],
    "recommended_price": "E",
    "currency": "USD",
    "confidence": "high",
    "warnings": ["string"]
  }]
}
```

`kind` is one of `vendor_msrp`, `buying_price`, `suggested_resale`, `other`. `confidence` is `high`, `medium` or `low`. Columns are Excel letters, `header_row` is the Excel row number.

- **System prompt (use as is):**

```text
You map vendor pricelist spreadsheets for an audio-visual distributor. For each sheet you receive sample rows (with Excel row numbers and column letters) and statistics per column. Decide the LAYOUT only. Never invent, correct or return prices, item codes or descriptions.

For each sheet:
1. is_price_table: false for cover pages, terms, change logs, or sheets without item codes and prices.
2. header_row: the Excel row number of the first row that holds column titles. Sheets often repeat the header above each section; return the first one. Title or note rows above it are not headers.
3. item_code: the column with the vendor's orderable code (SKU, part number, model). If several columns look like codes, list them all in item_code_candidates, best first, each with a reason under 15 words. Prefer the column that is filled on every item row and has unique values.
4. description: the short product name. det_description: the longer text. With only one text column, use description and leave det_description null.
5. alt_code, unit, notes: only when clearly present. A notes column often has no header and holds words such as "New", "Limited availability", "Call sales".
6. price_columns: every column that holds money amounts. kind: vendor_msrp (MSRP, list, RRP), buying_price (distributor, dealer, net, cost, special price to the distributor), suggested_resale (suggested reseller or distributor selling price), other. Columns of margins, discounts or percentages (headers with % or margin, or values mostly below 1) are NOT price columns.
7. recommended_price: the column matching preferred_price_kind. If preferred_price_kind is null or no column matches, return null and explain in warnings.
8. currency: ISO code stated in headers, notes or symbols, else null. If sections state different currencies, say so in warnings.
9. confidence: high only when the header row, item code and price column are unambiguous.
10. warnings: short and concrete, for example "Rows 33-38 have prices but no SKU".
```

- The function returns the model's JSON unchanged plus the model name. The browser converts each sheet to a `SheetMapping` (`price` = `recommended_price`, or the first price column) and validates it (section 5 step 3c). The raw response is saved in `uploads.ai_response`.
- On error or timeout (20 seconds) return `{ "error": "..." }`. The browser then falls back to `guessMapping()` and shows "AI unavailable, columns guessed from header names. Please check."

## 7. Tool 2: Build

1. **Upload form:** the input template file; Vendor Currency (prefilled from `_meta` when present); entity checkboxes grouped by region with "select all" per region. Only entities returned by `list_activities()` for this brand and currency can be ticked; the others are greyed with "no pricing rule".
2. **Read and check in the browser:** sheet `Upload` (else the first sheet). Headers must match section 4.1 exactly; if not, stop and name the missing or renamed columns. Parse `Vendor Price` and `Max Discount` with `toNumber()`.
3. If `_meta.batch_id` matches an `uploads` row with `detected_rows`, show one line: "Compared with the detected data: N prices changed, N rows added, N rows removed."
4. Call backend function `build-erp-rows` with brand_activity, vendor_currency, entity_codes and the rows. It runs with the service role and, for every entity and row:
   - finds the active rule for (brand_activity, sub_activity, vendor_currency) and its `pricing_rule_entities` row;
   - runs `calculatePrice()` from `pricing.ts`;
   - fills the ERP columns per section 4.2;
   - returns the 20 ERP columns, `price_basis` ("MSRP less discount" or "Net price") and a list of checks. It never returns rates, overheads, discounts or divisors.
5. **Checks.** Errors: Item Code empty; same Item Code twice in the file; Vendor Price not greater than 0; more than one Brand Activity in the file, or an unknown one; Sub Activity empty or without an active pricing rule for this currency; Max Discount outside 0 to 100; brand supplier missing or `TO SET`. Warnings: item not found in `erp_items` (ERP columns left empty); Measurement Unit empty; Description empty.
6. **Review screen:** one tab per entity with the 20 columns, `price_basis` and a status column; counts of OK, warning and error rows. Download is blocked while errors exist. Button "Download rows with problems" gives an Excel of the failing input rows plus a `Problem` column. Button "Exclude N error rows and continue" is allowed.
7. **Download:** one ERP Excel per entity (section 4.2), a button per entity. On download, save an `exports` row and an `export_audit` row.

## 8. Pricing

All maths lives in `pricing.ts` (`calculatePrice`). Summary:

- buying price = `net_price`: Vendor Price. `discount_from_msrp`: Vendor Price x (1 - discount_pct / 100).
- landed cost = buying price x ex_rate x (1 + overhead_pct / 100).
- retail price = landed cost divided by each margin divisor in turn, then rounded UP to a whole number with `safeRoundUp`.
- Cost Price in the output = buying price, vendor currency, 2 decimals.

### Pricing test cases (must pass)

| Rule | Vendor Price | Entity | Cost Price | Retail Price |
| --- | --- | --- | --- | --- |
| Brightsign / Brightsign / USD | 1000 | 001 | 650.00 | 4672 |
| Brightsign / Brightsign / USD | 1000 | 011 | 650.00 | 4459 |
| Brightsign / Brightsign / USD | 1000 | 007 | 650.00 | 4977 |
| Brightsign / Brightsign / USD | 1000 | 008 | 650.00 | 4810 |
| Ampetronic / Ampetronic / GBP | 200 | 001 | 200.00 | 2367 |
| Lightware / Lightware / AED | 4500 | 001 | 2700.00 | 4950 |
| Lightware / Lightware / AED | 4500 | 011 | 2700.00 | 4725 |
| Lightware / Lightware / USD | 1200 | 007 | 720.00 | 5169 |
| Lightware / Lightware / USD | 1200 | 008 | 720.00 | 4995 |
| DTEN / DTEN / USD | 6246 | 012 | 6246.00 | 13251 |
| DTEN / DTEN / USD | 6246 | 013 | 6246.00 | 46132 |
| DTEN / DTEN / USD | 6246 | 014 | 6246.00 | 157042286 |

Brightsign at 008 is the important one: a plain `Math.ceil` gives 4811, which is wrong.

## 9. Admin area

- **Entities, Brands:** simple editable tables.
- **Pricing rules:** table with one row per rule and a rate and overhead pair per entity, add, edit, deactivate. "TEST" badge for `is_test`.
- **ERP master data:** upload an Excel export with the headers `Item Code, Family Name, Group Name, Category Name, Sub Category Name, Midwich Family, Measurement Unit, Inactive, Webactive, B2B`. It replaces all rows of `erp_items`. Show row count and last refresh date.
- **Pricing self-test:** a button that runs the section 8 test cases through `build-erp-rows` and shows pass or fail per line.
- **History:** all uploads and exports, with download of the original file and of the exported rows.

## 10. Parser acceptance numbers

With `extractSheet()` then `resolveDuplicates()`, the real sample files must give exactly:

| File, sheet | Mapping | item | duplicate | exception | category | header |
| --- | --- | --- | --- | --- | --- | --- |
| Lightware USD Ex-work, `Category` | header 5, code B, price E, description C, det D, notes G | 410 | 28 | 26 | 93 | 64 |
| Lightware AED DDP, `Category` | same | 413 | 31 | 18 | 92 | 64 |
| Midwich SEA, `Pricebook for Midwich` | header 2, code B, price C, description A | 25 | 1 | 10 | 0 | 1 |
| Midwich SEA, `Orbit Pro Pricebook` | header 1, code F, price H, description A | 22 | 0 | 0 | 0 | 1 |

The Lightware AED sheet must also raise the warning that the price header differs between sections ("MSRP AED DDP" and "MSRP USD Ex-work"). Both Lightware files have two hidden sheets that must be skipped.

## 11. Out of scope for now

SFTP delivery, scheduled ERP master data import, second-person approval, price change warnings against the current ERP cost, PDF or CSV pricelists.
