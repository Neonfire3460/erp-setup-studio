import { it, expect } from "vitest";
import ExcelJS from "exceljs";
import { readInput, templateBlob, erpBlob, compareDetected } from "./buildExcel";
import { INPUT_HEADERS, ERP_HEADERS, type InputRow, type ErpRow } from "./buildTypes";
async function readBlob(blob: Blob) {
  const bytes = await new Promise<ArrayBuffer>((resolve, reject) => { const r = new FileReader(); r.onload = () => { if (r.result instanceof ArrayBuffer) resolve(r.result); else reject(new Error("Not binary")); }; r.onerror = reject; r.readAsArrayBuffer(blob); });
  const w = new ExcelJS.Workbook(); await w.xlsx.load(bytes); return w;
}
it("blank template preserves exact headers, text codes, hidden dropdown list and very hidden metadata", async () => {
  const w = await readBlob(await templateBlob("Brightsign", "USD", ["Brightsign", "Brightsign Service"]));
  const ws = w.getWorksheet("Upload");
  expect(ws?.getRow(1).values).toEqual([undefined, ...INPUT_HEADERS]); expect(ws?.getColumn(1).numFmt).toBe("@");
  expect(w.getWorksheet("Lists")?.state).toBe("hidden"); expect(w.getWorksheet("Lists")?.getCell("A2").value).toBe("Brightsign Service");
  expect(ws?.getCell("G2").dataValidation.formulae).toEqual(["Lists!$A$1:$A$2"]);
  expect(w.getWorksheet("_meta")?.state).toBe("veryHidden"); expect(w.getWorksheet("_meta")?.getCell("B3").value).toBe("USD");
});
it("browser parsing preserves leading zeros and uses toNumber for prices and Max Discount", async () => {
  const w = new ExcelJS.Workbook(); const ws = w.addWorksheet("Upload"); ws.addRow([...INPUT_HEADERS]);
  ws.addRow(["00012",null,"Player",null,null,"Brightsign","Brightsign","USD 1,000", "AED 4,500", "25", "EA"]);
  const b = new Uint8Array(await w.xlsx.writeBuffer());
  const parsed = await readInput({ arrayBuffer: async () => b.buffer } as File);
  expect(parsed.rows[0]?.["Item Code"]).toBe("00012"); expect(parsed.rows[0]?.["Vendor Price"]).toBe(1000); expect(parsed.rows[0]?.["Local MSRP"]).toBe(4500); expect(parsed.rows[0]?.["Max Discount"]).toBe(25);
});
it("rejects renamed or reordered input headers", async () => {
  const w = new ExcelJS.Workbook(); w.addWorksheet("Upload").addRow(["SKU", ...INPUT_HEADERS.slice(1)]);
  const b = new Uint8Array(await w.xlsx.writeBuffer());
  await expect(readInput({ arrayBuffer: async () => b.buffer } as File)).rejects.toThrow("Item Code");
});
it("exports exactly 20 ERP headers and 2 decimal Cost Price", async () => {
  const row = Object.fromEntries(ERP_HEADERS.map(h => [h, ""])) as ErpRow; row["Item Code"] = "00012"; row["Cost Price"] = 650; row["Retail Price"] = 4810;
  const w = await readBlob(await erpBlob([row])); const ws = w.worksheets[0];
  expect(ws?.getRow(1).values).toEqual([undefined,...ERP_HEADERS]); expect(ws?.getCell("B2").value).toBe("00012"); expect(ws?.getCell("I2").numFmt).toBe("0.00");
});
it("counts changed, added and removed detected rows", () => {
  const rows = [{ "Item Code": "A", "Vendor Price": 200 }, { "Item Code": "C", "Vendor Price": 300 }] as InputRow[];
  expect(compareDetected(rows,[{ rows: [{ kind:"item",itemCode:"A",vendorPrice:100 }, { kind:"item",itemCode:"B",vendorPrice:100 }] }])).toContain("1 prices changed, 1 rows added, 1 rows removed");
});
it("requires Local MSRP in the header immediately after Vendor Price", async () => {
  expect(INPUT_HEADERS[8]).toBe("Local MSRP");
  const w = new ExcelJS.Workbook(); w.addWorksheet("Upload").addRow(INPUT_HEADERS.filter(h => h !== "Local MSRP"));
  const b = new Uint8Array(await w.xlsx.writeBuffer());
  await expect(readInput({ arrayBuffer: async () => b.buffer } as File)).rejects.toThrow("Local MSRP");
});
it("writes ERP category codes as text and monetary values and flags as numbers", async () => {
  const row = Object.fromEntries(ERP_HEADERS.map(h => [h, ""])) as ErpRow;
  row["Item Code"] = "00012";
  for (const h of ["Family Name", "Group Name", "Category Name", "Sub Category Name", "Midwich Family"] as const) row[h] = "01";
  for (const h of ["Cost Price", "Retail Price", "Max Discount", "Inactive", "Webactive", "B2B"] as const) row[h] = h === "Inactive" ? "0" : "25";
  const ws = (await readBlob(await erpBlob([row]))).worksheets[0];
  for (const h of ["Item Code", "Family Name", "Group Name", "Category Name", "Sub Category Name", "Midwich Family"]) {
    const cell = ws?.getCell(2, ERP_HEADERS.indexOf(h as typeof ERP_HEADERS[number]) + 1);
    expect(cell?.type).toBe(ExcelJS.ValueType.String); expect(cell?.numFmt).toBe("@"); expect(cell?.value).toBe(h === "Item Code" ? "00012" : "01");
  }
  for (const h of ["Cost Price", "Retail Price", "Max Discount", "Inactive", "Webactive", "B2B"]) {
    const cell = ws?.getCell(2, ERP_HEADERS.indexOf(h as typeof ERP_HEADERS[number]) + 1);
    expect(cell?.type).toBe(ExcelJS.ValueType.Number); expect(cell?.value).toBe(h === "Inactive" ? 0 : 25);
  }
});