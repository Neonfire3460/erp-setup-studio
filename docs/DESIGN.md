# NMK Unite design guide

Save this as docs/DESIGN.md. It sets the look only. Functionality, data and logic follow docs/SPEC.md and must not change because of this file. The look follows the official NMK logo and the nmkelectronics.com style: white surfaces, charcoal text, NMK blue for actions, the navy-to-cyan wave gradient used sparingly.

## Brand

- App name: **NMK Unite**. Browser tab title: "NMK Unite".
- Logo files in `public/brand/`: `nmk-logo.png` (with "A Midwich Group Company"), `nmk-logo-compact.png` (no tagline), `nmk-mark.png` (wave only, also the favicon).
- Never redraw, recolour, stretch or add effects to the logo. Keep clear space around it of at least half its height. Only place it on white or very light backgrounds.
- Sidebar header: `nmk-logo-compact.png` at 30px high, then a 1px vertical divider and the word "Unite" (18px, weight 600, primary blue). Collapsed sidebar: `nmk-mark.png` at 28px.
- Login page: two columns. Left: a panel with `bg-nmk-gradient`, white heading "NMK Unite" and one line "Vendor pricelists to ERP uploads". Right: white, `nmk-logo.png` at 48px high above the sign-in card. Under 1024px the left panel is hidden.
- A 3px `bg-nmk-gradient` strip runs across the very top of the app. This and the login panel are the only gradients.

## Colour and type

Tokens live in `src/index.css` (from `theme.css`). Use the Tailwind token classes (`bg-primary`, `text-muted-foreground`, `border-border`, `bg-sidebar`), never hard-coded hex colours. Add `success`, `success-soft`, `warning`, `warning-soft`, `brand-navy` and `brand-cyan` to `tailwind.config.ts` colours as `hsl(var(--name))`.

| Role | Token | Hex |
|---|---|---|
| Page background | background | #F5F7FA |
| Text (logo charcoal) | foreground | #141E23 |
| Primary actions, links, active step (logo blue) | primary | #4654FD |
| Logo navy | brand-navy | #0E2579 |
| Logo cyan | brand-cyan | #05C3BC |
| OK / ready | success | #049690 |
| Warning | warning | #D97B09 |
| Error | destructive | #DC2626 |

- Font: Plus Jakarta Sans. Page title 26px/700 in Title Case ("Build ERP Upload"), section title 16px/600, body 14px, table 13px.
- Small labels, table headers and region headings are UPPERCASE, 11 to 12px, weight 600, letter spacing 0.06em, muted (like the category labels on nmkelectronics.com).
- Numbers in tables and summaries use tabular figures (already on `body`) and are right-aligned.
- Radius 10px for cards, 8px for inputs, buttons are fully rounded pills (like "Request a Demo" on the website), badges fully rounded.
- Light mode only.

## Layout

- App shell: white sidebar 248px wide with a right border (logo block, then menu: Convert, Build, History, then an "ADMIN" label and Admin for admins; user name, role and Sign out at the bottom). Active item: `bg-sidebar-accent`, primary text, 3px primary bar on the left. Icons from lucide-react: FileSpreadsheet (Convert), Boxes (Build), History (History), Settings (Admin).
- Main area: max width 1280px, padding 32px, page title with a one-line muted description under it, primary action on the right of the title row.
- On screens under 1024px the sidebar becomes a sheet opened from a top bar that shows the compact logo.

## Components

**Stepper** (Convert: Upload, Map Columns, Review, Download; Build: Upload, Entities, Review, Download). A row of numbered circles joined by a line. Done: success circle with a check. Current: primary circle with a soft blue ring, bold label. Next: grey outline circle, muted label. It sits under the page title and the user can click back to done steps.

**Upload area.** Dashed 2px border, 10px radius, cloud-upload icon, "Drop your Excel file here or browse", accepted types in muted text. On drag over: primary border and `bg-accent`. After choosing a file, show a file chip (name, size, sheet count, remove button).

**Summary strip.** A row of small stat cards above every review table: Items, Duplicates, Exceptions, Price on request, Warnings, Errors. Big number 22px/700, label uppercase 11px muted. The card turns soft warning or soft red when its count is above 0 and the count is clickable to filter the table.

**Status badges** (rounded full, 12px/600, soft background, coloured text and dot):
- Ready: success-soft / success
- Warning: warning-soft / warning
- Error: red soft / destructive
- Price on request: accent / primary
- Duplicate, Category, Skipped: muted / muted-foreground

**Review tables.** White card, sticky header in `bg-muted` with uppercase muted labels, 44px rows, hover `bg-muted/50`. Item code in weight 600. Prices right-aligned with the currency code in the header ("Cost USD"). Row problems show as a badge plus a tooltip with the message. Pill filter tabs above the table (All, Items, Warnings, Errors) and a search box. Paginate at 100 rows.

**Entity cards** (Build). Grouped under "MIDDLE EAST" and "SOUTH EAST ASIA" labels. Each card: entity code in a soft blue chip ("007"), entity name, currency in muted text, checkbox in the corner. Selected: primary 2px border and `bg-accent`. Disabled (currency does not fit): 50% opacity with a tooltip saying why.

**Per-entity results.** Underlined tabs, one per selected entity, each with its row count and a dot for warnings or errors. Each tab has its own Download button. A main "Download All" button sits at the top right; it is disabled with a reason when any entity has errors.

**Buttons.** Pill shaped. Primary filled blue for the one main action per screen, outline for secondary, ghost for table actions. Download buttons use the Download icon.

**Empty states.** Centred icon in a soft blue circle, one sentence, one button.

**Admin.** Same shell. Pricing rules is a table with an edit sheet that slides in from the right. Confidential fields (rates, overheads, discounts, divisors) carry a small lock icon and an "Admin only" label. The Pricing self-test shows pass lines with a green check and fail lines in red.

**Toasts.** Bottom right, success for downloads and saves, destructive for failures.

## Do not

- No landing page, hero sections, marketing copy, illustrations, animations beyond the default shadcn transitions, or dark mode toggle.
- No gradients other than the top strip and the login panel. Never put the logo on the gradient or on a dark background.
- Do not show rates, overheads, discounts or margins anywhere outside Admin.
