// The ERP types some brands in different cases ("Neat" and "NEAT"), so the brands table can hold both.
// The site shows one: the spelling with a logo, else the one that isn't all capitals, else the first A-Z.
// Everything else already matches brands without case (ilike), so either row's settings still apply.

type BrandLike = {
  brand_activity: string;
  logo_path?: string | null;
  has_logo?: boolean | null;
  entity_codes?: string[] | null;
  sub_activities?: string[] | null;
};

const score = (b: BrandLike) =>
  (b.logo_path || b.has_logo ? 4 : 0) +
  (b.brand_activity !== b.brand_activity.toUpperCase() ? 2 : 0) +
  ((b.entity_codes?.length ?? 0) > 0 ? 1 : 0);

/** The row to use when several rows are the same brand in different cases. */
export function pickBrand<T extends BrandLike>(rows: T[]): T | null {
  if (!rows.length) return null;
  return [...rows].sort(
    (a, b) => score(b) - score(a) || a.brand_activity.localeCompare(b.brand_activity),
  )[0]!;
}

const unionCi = (lists: (string[] | null | undefined)[]) => {
  const m = new Map<string, string>();
  for (const l of lists)
    for (const v of l ?? []) if (!m.has(v.toUpperCase())) m.set(v.toUpperCase(), v);
  return [...m.values()].sort();
};

/** One row per brand (case-insensitive), with entities and sub activities of every spelling. */
export function mergeBrandSpellings<T extends BrandLike>(rows: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const r of rows) {
    const k = r.brand_activity.trim().toUpperCase();
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const out: T[] = [];
  for (const g of groups.values()) {
    const best = pickBrand(g)!;
    if (g.length === 1) out.push(best);
    else
      out.push({
        ...best,
        ...("entity_codes" in best ? { entity_codes: unionCi(g.map((x) => x.entity_codes)) } : {}),
        ...("sub_activities" in best
          ? { sub_activities: unionCi(g.map((x) => x.sub_activities)) }
          : {}),
      });
  }
  return out.sort((a, b) => a.brand_activity.localeCompare(b.brand_activity));
}

/** "NEAT" -> "Neat" when the brands table already has that brand in another case. */
export function brandSpelling(known: string[]): (b: string) => string {
  const m = new Map<string, string>();
  for (const k of known) if (!m.has(k.toUpperCase())) m.set(k.toUpperCase(), k);
  return (b) => m.get(b.toUpperCase()) ?? b;
}
