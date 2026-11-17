import ExcelJS from "exceljs";
import { cellValue, toNumber } from "./sheetParser";
import { INPUT_HEADERS, ERP_HEADERS, text, codeKey, type InputRow, type ErpRow } from "./buildTypes";

export async function readInput(file: File) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.getWorksheet("Upload") ?? wb.worksheets[0];
  if (!ws) throw new Error("Workbook has no sheets");
  const actual = Array.from({ length: Math.max(ws.columnCount, INPUT_HEADERS.length) }, (_, i) => text(cellValue(ws.getRow(1).getCell(i + 1).value)));
  const wrong = INPUT_HEADERS.filter((h, i) => actual[i] !== h);
  if (wrong.length || actual.slice(INPUT_HEADERS.length).some(Boolean)) throw new Error(`Missing, renamed or out-of-order columns: ${wrong.join(", ") || "unexpected extra columns"}`);
  const rows: InputRow[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const values = INPUT_HEADERS.map((_, c) => cellValue(ws.getRow(r).getCell(c + 1).value));
    if (values.every(v => v === null)) continue;
    const row = Object.fromEntries(INPUT_HEADERS.map((h, i) => [h, values[i] ?? null])) as InputRow;
    row["Item Code"] = text(row["Item Code"]);
    for (const h of ["Vendor Price", "Local MSRP", "Max Discount"] as const) {
      const raw = row[h];
      row[h] = toNumber(raw) ?? raw;
    }
    rows.push(row);
  }
  if (!rows.length) throw new Error("No input rows found");
  const meta: Record<string, string> = {};
  wb.getWorksheet("_meta")?.eachRow(row => { meta[text(cellValue(row.getCell(1).value))] = text(cellValue(row.getCell(2).value)); });
  return { rows, meta };
}

export async function templateBlob(brand: string, currency: string, subs: string[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Upload");
  ws.addRow([...INPUT_HEADERS]);
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.columns.forEach(c => { c.width = 23; });
  ws.getColumn(1).numFmt = "@";
  const lists = wb.addWorksheet("Lists", { state: "hidden" });
  subs.forEach(s => lists.addRow([s]));
  for (let r = 2; r <= 10001; r++) {
    ws.getCell(r, 7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
    if (subs.length) ws.getCell(r, 7).dataValidation = { type: "list", allowBlank: false, formulae: [`Lists!$A$1:$A$${subs.length}`] };
  }
  const meta = wb.addWorksheet("_meta", { state: "veryHidden" });
  meta.addRows([["batch_id", ""], ["brand_activity", brand], ["vendor_currency", currency]]);
  return workbookBlob(wb);
}
export async function rowsBlob(headers: readonly string[], rows: Record<string, unknown>[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Upload");
  ws.addRow([...headers]);
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.columns.forEach(c => { c.width = 23; });
  const codeCol = headers.indexOf("Item Code");
  if (codeCol >= 0) ws.getColumn(codeCol + 1).numFmt = "@";
  const isErp = headers.length === ERP_HEADERS.length && headers.every((h, i) => h === ERP_HEADERS[i]);
  const textColumns = new Set(["Item Code", "Family Name", "Group Name", "Category Name", "Sub Category Name", "Midwich Family"]);
  const numberColumns = new Set(["Cost Price", "Retail Price", "Max Discount", "Inactive", "Webactive", "B2B"]);
  if (isErp) headers.forEach((h, i) => { if (textColumns.has(h)) ws.getColumn(i + 1).numFmt = "@"; });
  rows.forEach(r => ws.addRow(headers.map(h => {
    const value = r[h];
    if (value == null || value === "") return null;
    if (isErp && textColumns.has(h)) return String(value);
    if (isErp && numberColumns.has(h)) return toNumber(typeof value === "number" || typeof value === "string" ? value : String(value));
    return value;
  })));
  const costCol = headers.indexOf("Cost Price");
  if (costCol >= 0) ws.getColumn(costCol + 1).numFmt = "0.00";
  return workbookBlob(wb);
}
async function workbookBlob(wb: ExcelJS.Workbook) {
  const data = await wb.xlsx.writeBuffer();
  return new Blob([new Uint8Array(data)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
export const erpBlob = (rows: ErpRow[]) => rowsBlob(ERP_HEADERS, rows);
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function exportFilename(entity: string, brand: string, date = new Date().toISOString().slice(0, 10)) {
  return `${entity}_${brand.replace(/[\\/:*?"<>|]/g, "_")}_${date}.xlsx`;
}
export function compareDetected(rows: InputRow[], detected: unknown) {
  const flat: { itemCode?: string; vendorPrice?: number; kind?: string }[] = [];
  function visit(v: unknown) { if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v === "object") { const o = v as Record<string, unknown>; if ("itemCode" in o) flat.push(o); else Object.values(o).forEach(visit); } }
  visit(detected);
  const before = new Map(flat.filter(r => r.kind === "item").map(r => [codeKey(r.itemCode), r.vendorPrice]));
  const after = new Map(rows.map(r => [codeKey(r["Item Code"]), r["Vendor Price"]]));
  return `Compared with the detected data: ${[...after].filter(([c,p]) => before.has(c) && before.get(c) !== p).length} prices changed, ${[...after.keys()].filter(c => !before.has(c)).length} rows added, ${[...before.keys()].filter(c => !after.has(c)).length} rows removed.`;
}