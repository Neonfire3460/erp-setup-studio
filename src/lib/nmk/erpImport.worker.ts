// Web Worker: reads an ERP export (.xlsx with SheetJS, .csv with PapaParse) and runs readErpExport,
// so a 200,000-row file never blocks the page.
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { readErpExport } from "./erp";
import type { CategoryRow } from "./categories";

self.onmessage = async (
  ev: MessageEvent<{
    file: File;
    entityCode: string;
    categories: CategoryRow[];
    currencyByBrand: Record<string, string>;
  }>,
) => {
  const { file, entityCode, categories, currencyByBrand } = ev.data;
  try {
    let rows: unknown[][];
    if (/\.csv$/i.test(file.name)) {
      rows = Papa.parse<string[]>(await file.text(), {
        skipEmptyLines: true,
        dynamicTyping: false,
      }).data;
    } else {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array", dense: true });
      const name = wb.SheetNames[0];
      const ws = name ? wb.Sheets[name] : undefined;
      if (!ws) throw new Error("The workbook has no sheets");
      rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });
    }
    postMessage({ type: "parsed", rowCount: rows.length - 1 });
    const map = new Map(categories.map((c) => [c.subCategoryCode.toUpperCase(), c]));
    postMessage({
      type: "done",
      result: readErpExport(rows, { entityCode, categories: map, currencyByBrand }),
    });
  } catch (e) {
    postMessage({
      type: "error",
      message: e instanceof Error ? e.message : "Could not read the file",
    });
  }
};
