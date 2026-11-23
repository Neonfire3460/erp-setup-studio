// pdfOrder.ts: the item order of a brand's PDF pricelist (gap 22).
// 1) learnOrder: read once from the template PDF the admin uploads (text items from pdf.js).
// 2) placeItems: items in the learned order; new ones placed by best fit.
import { codeKey } from "./util";

/** One pdf.js text item, in the order the page draws them. y is from the bottom (pdf.js). */
export interface PdfTextItem {
  page: number;
  x: number;
  y: number;
  str: string;
  font?: string;
}

const looksLikeCode = (s: string) =>
  /^[A-Z0-9][A-Z0-9._/+-]{2,39}$/i.test(s) && /\d|-/.test(s) && !/^\d+([.,]\d+)*$/.test(s);

/**
 * Reads item codes top to bottom, page by page.
 * NMK's PDFs carry older text layers under the visible one (same positions, older descriptions and prices).
 * The visible layer is the one drawn last, so on each page only codes in the font of the last-drawn code are kept;
 * the rest is counted as hidden text. Codes in that column that the ERP does not know are reported, not dropped.
 */
export function learnOrder(items: PdfTextItem[], knownCodes: string[]) {
  const known = new Map(knownCodes.map((c) => [codeKey(c), c]));
  const all = items.map((t, n) => ({ ...t, str: t.str.trim(), n })).filter((t) => t.str);
  const hits = all.filter((t) => known.has(codeKey(t.str)));
  const pages = [...new Set(all.map((t) => t.page))];
  const visibleFont = new Map<number, string | undefined>();
  for (const p of pages) {
    const last = hits.filter((h) => h.page === p).at(-1);
    visibleFont.set(p, last?.font);
  }
  const onTop = (t: { page: number; font?: string | undefined }) =>
    !visibleFont.get(t.page) || t.font === visibleFont.get(t.page);
  const visible = hits.filter(onTop);
  const xs = visible.map((h) => Math.round(h.x));
  const count = (v: number) => xs.filter((x) => x === v).length;
  const colX = xs.length ? [...xs].sort((a, b) => count(b) - count(a))[0]! : null;
  const unknown =
    colX === null
      ? []
      : all.filter(
          (t) =>
            onTop(t) &&
            Math.abs(t.x - colX) <= 6 &&
            !known.has(codeKey(t.str)) &&
            looksLikeCode(t.str),
        );
  const rows = [
    ...visible.map((h) => ({ ...h, known: true })),
    ...unknown.map((u) => ({ ...u, known: false })),
  ].sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const order: string[] = [];
  const notInErp: string[] = [];
  const seen = new Set<string>();
  for (const h of rows) {
    const k = codeKey(h.str);
    if (seen.has(k)) continue;
    seen.add(k);
    order.push(h.known ? known.get(k)! : h.str);
    if (!h.known) notInErp.push(h.str);
  }
  return { order, notInErp, hiddenIgnored: hits.length - visible.length, pages: pages.length };
}

export interface PlaceInput {
  itemCode: string;
  subCategoryCode: string;
  categoryCode: string;
}
export type Placement = "template" | "best_fit" | "category_end" | "end";

const prefixLen = (a: string, b: string) => {
  let n = 0;
  const x = a.toUpperCase(),
    y = b.toUpperCase();
  while (n < x.length && n < y.length && x[n] === y[n]) n++;
  return n;
};

/**
 * Items in the learned order. A new item goes after the last item with the same Sub Category and the
 * longest shared code prefix (TAV-DARWIN8K-TX next to the Darwin items); else after the last item of its
 * Category; else at the end. Items not in the order and with no match keep A to Z among themselves.
 */
export function placeItems<T extends PlaceInput>(
  order: string[],
  items: T[],
): (T & { placedBy: Placement })[] {
  const idx = new Map(order.map((c, i) => [codeKey(c), i]));
  const inOrder = items
    .filter((i) => idx.has(codeKey(i.itemCode)))
    .sort((a, b) => idx.get(codeKey(a.itemCode))! - idx.get(codeKey(b.itemCode))!);
  const result: (T & { placedBy: Placement })[] = inOrder.map((i) => ({
    ...i,
    placedBy: "template" as Placement,
  }));
  const rest = items
    .filter((i) => !idx.has(codeKey(i.itemCode)))
    .sort((a, b) => a.itemCode.localeCompare(b.itemCode));
  const atEnd: (T & { placedBy: Placement })[] = [];
  for (const n of rest) {
    let best = -1,
      bestLen = -1,
      placedBy: Placement = "end";
    result.forEach((r, i) => {
      if (r.subCategoryCode && r.subCategoryCode === n.subCategoryCode) {
        const l = prefixLen(r.itemCode, n.itemCode);
        if (l >= bestLen) {
          bestLen = l;
          best = i;
          placedBy = "best_fit";
        }
      }
    });
    if (best < 0)
      result.forEach((r, i) => {
        if (r.categoryCode && r.categoryCode === n.categoryCode) {
          best = i;
          placedBy = "category_end";
        }
      });
    if (best < 0) {
      atEnd.push({ ...n, placedBy: "end" });
      continue;
    }
    // Keep earlier new items placed after the same anchor in front of this one.
    let at = best + 1;
    while (
      at < result.length &&
      result[at]!.placedBy !== "template" &&
      prefixLen(result[at]!.itemCode, n.itemCode) >= bestLen
    )
      at++;
    result.splice(at, 0, { ...n, placedBy });
  }
  return [...result, ...atEnd];
}
