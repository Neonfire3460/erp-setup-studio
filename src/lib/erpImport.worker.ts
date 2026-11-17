// Web Worker: parses the ERP data export (.xlsx with SheetJS, .csv with PapaParse) and runs readErpData.
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { readErpData } from "./excelFiles";

self.onmessage = async (ev: MessageEvent<{ file: File; entityCode: string }>) => {
  const { file, entityCode } = ev.data;
  try {
    let rows: unknown[][];
    if (/\.csv$/i.test(file.name)) {
      const text = await file.text();
      rows = Papa.parse<string[]>(text, { skipEmptyLines: true, dynamicTyping: false }).data;
    } else {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array", dense: true });
      const name = wb.SheetNames[0];
      const ws = name ? wb.Sheets[name] : undefined;
      if (!ws) throw new Error("The workbook has no sheets");
      rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });
    }
    postMessage({ type: "parsed", rowCount: rows.length - 1 });
    const result = readErpData(rows, entityCode);
    postMessage({ type: "done", result });
  } catch (e) {
    postMessage({ type: "error", message: e instanceof Error ? e.message : "Could not read the file" });
  }
};
