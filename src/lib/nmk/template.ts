/* eslint-disable @typescript-eslint/no-explicit-any -- ExcelJS is loaded at run time and passed in */
// template.ts: Option B. Builds the one-sheet Excel template and reads it back with row-level checks.
// Browser only. Pass the ExcelJS module in (import ExcelJS from 'exceljs').
//   Item Code | Alternative Code | Description | Alternative Description | Cost Price (USD) [| Cost Price 001 (AED) ...]
import { cellText, codeKey, isDemoCode, parseNumber } from "./util";
import type { Line } from "./types";

export const TEMPLATE_BASE = [
  "Item Code",
  "Alternative Code",
  "Description",
  "Alternative Description",
] as const;
export const stdCostHeader = (currency: string) => `Cost Price (${currency})`;
export const entityCostHeader = (entityCode: string, currency: string) =>
  `Cost Price ${entityCode} (${currency})`;
const META = "_meta";
const VERSION = "NMK-IR-TEMPLATE-1";

export interface TemplateSpec {
  brand: string;
  stdCurrency: string;
  ownCost: { entityCode: string; currency: string }[]; // entities marked "Different cost"
  prefill?: { itemCode: string; altCode?: string; description?: string; altDescription?: string }[];
}

export const templateFileName = (brand: string, d = new Date()) =>
  `${brand.replace(/[^\w-]+/g, "-")}_price_template_${d.toISOString().slice(0, 10)}.xlsx`;

export async function buildTemplate(ExcelJS: any, spec: TemplateSpec): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "NMK Unite";
  const ws = wb.addWorksheet("Items", { views: [{ state: "frozen", ySplit: 1 }] });
  const headers = [
    ...TEMPLATE_BASE,
    stdCostHeader(spec.stdCurrency),
    ...spec.ownCost.map((o) => entityCostHeader(o.entityCode, o.currency)),
  ];
  ws.columns = headers.map((h, i) => ({
    header: h,
    width: [20, 20, 50, 60][i] ?? 20,
    style: i < 2 ? { numFmt: "@" } : i >= 4 ? { numFmt: "#,##0.00" } : {},
  }));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.eachCell((c: any) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF13BBB3" } };
  });
  head.getCell(5).note =
    `Standard cost in ${spec.stdCurrency} for every ticked entity. Type 0 only for price on request.`;
  spec.ownCost.forEach((o, i) => {
    head.getCell(6 + i).note = `Cost for entity ${o.entityCode} only, in ${o.currency}.`;
  });
  for (const p of spec.prefill ?? []) {
    const row = ws.addRow([
      p.itemCode,
      p.altCode ?? null,
      p.description ?? null,
      p.altDescription ?? null,
    ]);
    row.getCell(1).numFmt = "@";
    row.getCell(2).numFmt = "@";
  }
  const meta = wb.addWorksheet(META, { state: "veryHidden" });
  meta.addRow(["version", VERSION]);
  meta.addRow(["brand", spec.brand]);
  meta.addRow(["stdCurrency", spec.stdCurrency]);
  for (const o of spec.ownCost) meta.addRow(["ownCost", o.entityCode, o.currency]);
  return wb.xlsx.writeBuffer();
}

export interface RowIssue {
  row: number;
  itemCode: string;
  level: "error" | "warning";
  message: string;
}

export interface ReadTemplateResult {
  ok: boolean; // false when there are file problems, errors, or a currency question
  problems: string[]; // file-level: wrong columns, wrong brand
  issues: RowIssue[];
  currencyQuestions: { header: string; expected: string; found: string }[]; // ask the user which currency is right
  lines: Line[];
  demoSkipped: string[];
}

/** expected = the Step 1 choices. The file must have the same cost columns. */
export async function readTemplate(
  ExcelJS: any,
  data: ArrayBuffer,
  expected: TemplateSpec,
): Promise<ReadTemplateResult> {
  const res: ReadTemplateResult = {
    ok: false,
    problems: [],
    issues: [],
    currencyQuestions: [],
    lines: [],
    demoSkipped: [],
  };
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(data);
  } catch {
    res.problems.push("This file could not be opened as an Excel (.xlsx) file.");
    return res;
  }
  const meta = wb.getWorksheet(META);
  if (meta) {
    const brand = cellText(meta.getRow(2).getCell(2).value);
    if (brand && brand.toUpperCase() !== expected.brand.toUpperCase())
      res.problems.push(`This template was made for ${brand}, not ${expected.brand}.`);
  }
  const ws = wb.worksheets.find(
    (w: any) => w.name !== META && w.state !== "veryHidden" && w.state !== "hidden",
  );
  if (!ws) {
    res.problems.push("The file has no visible sheet.");
    return res;
  }

  const headRow = ws.getRow(1);
  const heads: string[] = [];
  for (let c = 1; c <= Math.max(ws.columnCount, 4); c++)
    heads.push(cellText(headRow.getCell(c).value));
  const find = (h: string) => heads.findIndex((x) => x.toLowerCase() === h.toLowerCase());
  const iCode = find("Item Code"),
    iAlt = find("Alternative Code"),
    iDesc = find("Description"),
    iAltDesc = find("Alternative Description");
  if (iCode < 0)
    res.problems.push(
      'Column "Item Code" is missing or renamed. Please use the template as downloaded.',
    );
  if (iDesc < 0) res.problems.push('Column "Description" is missing or renamed.');

  // Cost columns: "Cost Price (USD)" and "Cost Price 001 (AED)". A changed currency is a question, not an error.
  const costCol = (entityCode: string | null, cur: string) => {
    const want = entityCode ? entityCostHeader(entityCode, cur) : stdCostHeader(cur);
    let i = find(want);
    if (i >= 0) return i;
    const re = entityCode
      ? new RegExp(`^Cost Price ${entityCode} \\((\\w{3})\\)$`, "i")
      : /^Cost Price \((\w{3})\)$/i;
    i = heads.findIndex((h) => re.test(h));
    if (i >= 0)
      res.currencyQuestions.push({
        header: heads[i]!,
        expected: cur,
        found: (heads[i]!.match(re)?.[1] ?? "").toUpperCase(),
      });
    else res.problems.push(`Column "${want}" is missing or renamed.`);
    return i;
  };
  const iStd = costCol(null, expected.stdCurrency);
  const iOwn = expected.ownCost.map((o) => ({
    entityCode: o.entityCode,
    col: costCol(o.entityCode, o.currency),
  }));
  if (res.problems.length) return res;

  const seen = new Map<string, number>();
  const cost = (v: unknown, row: number, code: string, label: string): number | null => {
    const t = cellText(v);
    if (!t) {
      res.issues.push({
        row,
        itemCode: code,
        level: "error",
        message: `${label} is empty. Type 0 only for price on request.`,
      });
      return null;
    }
    const n = parseNumber(v);
    if (n === null) {
      res.issues.push({
        row,
        itemCode: code,
        level: "error",
        message: `${label} is not a number: "${t}".`,
      });
      return null;
    }
    if (n < 0) {
      res.issues.push({ row, itemCode: code, level: "error", message: `${label} is below 0.` });
      return null;
    }
    return Math.round(n * 100) / 100;
  };

  ws.eachRow({ includeEmpty: false }, (r: any, rowNo: number) => {
    if (rowNo === 1) return;
    const val = (i: number) => (i < 0 ? "" : cellText(r.getCell(i + 1).value));
    const code = val(iCode);
    const anything = [iCode, iAlt, iDesc, iAltDesc, iStd, ...iOwn.map((o) => o.col)].some((i) =>
      val(i),
    );
    if (!anything) return;
    if (!code) {
      res.issues.push({
        row: rowNo,
        itemCode: "",
        level: "error",
        message: "Item Code is empty but the row has data.",
      });
      return;
    }
    if (isDemoCode(code)) {
      res.demoSkipped.push(code);
      return;
    }
    const k = codeKey(code);
    if (seen.has(k)) {
      res.issues.push({
        row: rowNo,
        itemCode: code,
        level: "error",
        message: `Item Code repeats row ${seen.get(k)}.`,
      });
      return;
    }
    seen.set(k, rowNo);
    const desc = val(iDesc);
    if (!desc)
      res.issues.push({
        row: rowNo,
        itemCode: code,
        level: "error",
        message: "Description is empty.",
      });
    const std = cost(r.getCell(iStd + 1).value, rowNo, code, stdCostHeader(expected.stdCurrency));
    const entityCosts: Record<string, number | null> = {};
    for (const o of iOwn)
      entityCosts[o.entityCode] = cost(
        r.getCell(o.col + 1).value,
        rowNo,
        code,
        `Cost for ${o.entityCode}`,
      );
    const poa = std === 0;
    if (poa)
      res.issues.push({
        row: rowNo,
        itemCode: code,
        level: "warning",
        message: "Cost 0 = price on request (retail will be 0).",
      });
    res.lines.push({
      lineNo: res.lines.length + 1,
      itemCode: code,
      altCode: val(iAlt) || code,
      description: desc,
      altDescription: val(iAltDesc) || desc,
      cost: std,
      entityCosts,
      priceOnRequest: poa,
      source: { sheet: ws.name, row: rowNo },
    });
  });
  if (!res.lines.length && !res.issues.length) res.problems.push("The sheet has no item rows.");
  res.ok =
    !res.problems.length &&
    !res.currencyQuestions.length &&
    !res.issues.some((i) => i.level === "error");
  return res;
}
