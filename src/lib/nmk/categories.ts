// categories.ts: NMK category tree (Family > Group > Category > Sub Category) and the Midwich mapping.
// Source: "Categories Data Midwich Mapped.xlsx" (sheet 1 "Master Data", sheet 2 "Midwich Codes").
// Everything is keyed by Sub Category code (unique). Category codes are NOT unique (020504 and 0220305 repeat).
import { cellText, codeText, stripAE01 } from "./util";

export interface CategoryRow {
  familyCode: string;
  familyName: string;
  groupCode: string;
  groupName: string;
  categoryCode: string;
  categoryName: string;
  subCategoryCode: string; // without AE01_, e.g. "L30127" (unique key)
  midwichCode: string; // "04"
  midwichName: string; // "Technical Video"
  reviewNote: string; // the mapping review notes (49 rows to check while testing)
}

export interface MidwichFamily {
  code: string;
  name: string;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
    .trim();

/** Read sheet 1 (rows as arrays, header in row 1). Accepts the plain Categories Data file too (no Midwich columns). */
export function readCategoriesSheet(rows: unknown[][]) {
  const problems: string[] = [];
  const warnings: string[] = [];
  const head = (rows[0] ?? []).map((h) => norm(cellText(h)));
  const col = (...names: string[]) => {
    for (const n of names) {
      const i = head.indexOf(norm(n));
      if (i >= 0) return i;
    }
    return -1;
  };
  const I = {
    fc: col("Family Code"),
    fn: col("Family"),
    gc: col("Group Code"),
    gn: col("Group"),
    cc: col("Category Code"),
    cn: col("Category"),
    sc: col("SubCategory", "Sub Category", "Sub-category"),
    mc: col("Midwich Code", "Midwich Family Code"),
    mn: col("Midwich Description", "Midwich Family"),
    note: col("Review Note"),
  };
  const missing = Object.entries({
    "Family Code": I.fc,
    Family: I.fn,
    "Group Code": I.gc,
    Group: I.gn,
    "Category Code": I.cc,
    Category: I.cn,
    SubCategory: I.sc,
  })
    .filter(([, i]) => i < 0)
    .map(([n]) => n);
  if (missing.length)
    return {
      ok: false,
      problems: [`Missing columns: ${missing.join(", ")}`],
      warnings,
      rows: [] as CategoryRow[],
    };
  if (I.mc < 0)
    warnings.push(
      'No "Midwich Code" column: Midwich Family stays empty until a mapped file is imported.',
    );

  const out: CategoryRow[] = [];
  const seen = new Map<string, number>();
  for (let r = 1; r < rows.length; r++) {
    const v = rows[r] ?? [];
    const t = (i: number) => (i < 0 ? "" : cellText(v[i]));
    const sub = stripAE01(t(I.sc));
    if (!sub && !t(I.cc)) continue;
    if (!sub) {
      problems.push(`Row ${r + 1}: SubCategory is empty`);
      continue;
    }
    if (seen.has(sub.toUpperCase())) {
      problems.push(`Row ${r + 1}: SubCategory ${sub} repeats row ${seen.get(sub.toUpperCase())}`);
      continue;
    }
    seen.set(sub.toUpperCase(), r + 1);
    out.push({
      familyCode: codeText(v[I.fc], 2),
      familyName: t(I.fn),
      groupCode: codeText(v[I.gc]),
      groupName: t(I.gn),
      categoryCode: codeText(v[I.cc]),
      categoryName: t(I.cn),
      subCategoryCode: sub,
      midwichCode: I.mc < 0 ? "" : codeText(v[I.mc], 2),
      midwichName: t(I.mn),
      reviewNote: t(I.note),
    });
  }
  // Same code with two names usually means a typo in the file: warn, do not stop.
  for (const [code, name, label] of [
    ["familyCode", "familyName", "Family"],
    ["groupCode", "groupName", "Group"],
  ] as const) {
    const names = new Map<string, Set<string>>();
    for (const c of out) {
      const s = names.get(c[code]) ?? new Set();
      s.add(c[name]);
      names.set(c[code], s);
    }
    for (const [k, s] of names)
      if (s.size > 1)
        warnings.push(`${label} code ${k} has ${s.size} names: ${[...s].join(" / ")}`);
  }
  return { ok: problems.length === 0, problems, warnings, rows: out };
}

/** Read sheet 2 "Midwich Codes": Code, Description. */
export function readMidwichSheet(rows: unknown[][]): MidwichFamily[] {
  const head = (rows[0] ?? []).map((h) => norm(cellText(h)));
  const ic = head.indexOf("code"),
    id = head.indexOf("description");
  if (ic < 0 || id < 0) return [];
  return rows
    .slice(1)
    .map((v) => ({ code: codeText(v?.[ic], 2), name: cellText(v?.[id]) }))
    .filter((m) => m.code && m.name);
}

// ---------- cascading drop-downs for Step 4 (words shown, codes kept) ----------

const uniq = <T>(list: T[], key: (t: T) => string) => {
  const m = new Map<string, T>();
  for (const t of list) if (!m.has(key(t))) m.set(key(t), t);
  return [...m.values()];
};

export const familyOptions = (cats: CategoryRow[]) =>
  uniq(cats, (c) => c.familyCode)
    .map((c) => ({ value: c.familyCode, label: c.familyName }))
    .sort((a, b) => a.label.localeCompare(b.label));

export const groupOptions = (cats: CategoryRow[], familyCode: string) =>
  uniq(
    cats.filter((c) => c.familyCode === familyCode),
    (c) => c.groupCode,
  )
    .map((c) => ({ value: c.groupCode, label: c.groupName }))
    .sort((a, b) => a.label.localeCompare(b.label));

/** The value is the Sub Category code, because Category codes repeat. */
export const categoryOptions = (cats: CategoryRow[], familyCode: string, groupCode: string) =>
  cats
    .filter((c) => c.familyCode === familyCode && c.groupCode === groupCode)
    .map((c) => ({ value: c.subCategoryCode, label: c.categoryName, midwich: c.midwichName }))
    .sort((a, b) => a.label.localeCompare(b.label));

export function categoryBySub(
  cats: CategoryRow[] | Map<string, CategoryRow>,
  subCategoryCode: string,
): CategoryRow | null {
  const k = stripAE01(subCategoryCode).toUpperCase();
  if (cats instanceof Map) return cats.get(k) ?? null;
  return cats.find((c) => c.subCategoryCode.toUpperCase() === k) ?? null;
}

export const categoryMap = (cats: CategoryRow[]) =>
  new Map(cats.map((c) => [c.subCategoryCode.toUpperCase(), c]));

/**
 * Suggest a category for a NEW item from the brand's existing items with the longest shared code prefix
 * (TAV-DARWIN-NEW -> the Darwin items' category). The user always confirms. Needs at least 6 shared characters.
 */
export function suggestCategory(
  newCode: string,
  existing: { itemCode: string; subCategoryCode: string }[],
) {
  const a = newCode.toUpperCase();
  let best: { sub: string; len: number; like: string } | null = null;
  for (const e of existing) {
    if (!e.subCategoryCode) continue;
    const b = e.itemCode.toUpperCase();
    let n = 0;
    while (n < a.length && n < b.length && a[n] === b[n]) n++;
    if (n >= 6 && (!best || n > best.len))
      best = { sub: e.subCategoryCode, len: n, like: e.itemCode };
  }
  return best ? { subCategoryCode: best.sub, likeItem: best.like } : null;
}
