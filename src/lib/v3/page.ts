// page.ts: page titles and browser downloads.
export const headFor = (title: string, description: string) => ({
  meta: [
    { title: `${title} · NMK Unite` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} · NMK Unite` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ],
});

export function downloadBlob(blob: Blob, name: string) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
