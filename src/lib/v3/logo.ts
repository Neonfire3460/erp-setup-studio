// Logos for the PDF Pricelist. A logo can be a data URL (saved in Admin settings), a public file (/pdf/...),
// or a path in the brand-assets storage bucket. Every logo is redrawn as PNG so jsPDF can embed it.
import { supabase } from "@/integrations/supabase/client";
import type { PdfLogo } from "@/lib/nmk/pricelistPdf";

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export const defaultEntityLogo = (code: string) => `/pdf/entity-${code}.png`;
export const defaultBrandLogo = (brand: string) => `/pdf/brand-${slug(brand)}.png`;

function urlOf(path: string) {
  if (/^(data:|https?:|\/)/.test(path)) return path;
  return supabase.storage.from("brand-assets").getPublicUrl(path).data.publicUrl;
}

function load(src: string) {
  return new Promise<PdfLogo>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const g = c.getContext("2d");
      if (!g || !c.width) {
        reject(new Error("Empty image"));
        return;
      }
      g.drawImage(img, 0, 0);
      resolve({ dataUrl: c.toDataURL("image/png"), width: c.width, height: c.height });
    };
    img.onerror = () => reject(new Error(`Could not load ${src.slice(0, 60)}`));
    img.src = src;
  });
}

/** First logo that loads, or null. */
export async function loadLogo(...paths: (string | null | undefined)[]) {
  for (const p of paths) {
    if (!p) continue;
    try {
      return await load(urlOf(p));
    } catch {
      /* try the next one */
    }
  }
  return null;
}

/** A picked file -> data URL (max ~600 px wide, PNG), for saving in the database. */
export async function fileToLogo(file: File, maxW = 1100) {
  const raw = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
  const l = await load(raw);
  if (l.width <= maxW) return l;
  const img = await new Promise<HTMLImageElement>((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.src = l.dataUrl;
  });
  const c = document.createElement("canvas");
  c.width = maxW;
  c.height = Math.round((l.height * maxW) / l.width);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return { dataUrl: c.toDataURL("image/png"), width: c.width, height: c.height };
}
