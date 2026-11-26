// Groups a brand's item codes into product families ("Neat Board 50": the device, its mounts, cables and Pulse
// plans together), instead of the ERP's category tree. It reads the item code first (the model named earliest
// in the code wins, so PULSE-PLUS-BAR2-PAD10-1 is a Bar 2 plan), then sorts each item into a role:
// product, accessory, cable/power or subscription. Brands without a family list group by the code's model stem.

export type ItemRole = "product" | "accessory" | "cable" | "subscription";
export const ROLE_ORDER: ItemRole[] = ["product", "accessory", "cable", "subscription"];
export const ROLE_LABEL: Record<ItemRole, string> = {
  product: "Products",
  accessory: "Accessories",
  cable: "Cables and power",
  subscription: "Subscriptions and support",
};

type Family = [RegExp, string];

// Longer names first where they start at the same place (BOARD50 before BOARD).
const FAMILIES: Record<string, Family[]> = {
  NEAT: [
    [/BOARD-?75/, "Neat Board 75"],
    [/BOARD-?50/, "Neat Board 50"],
    [/BOARD-?32|NB32/, "Neat Board 32"],
    [/BOARD-?PRO/, "Neat Board Pro"],
    [/BOARD/, "Neat Board"],
    [/BAR-?3/, "Neat Bar 3"],
    [/BAR-?2B|BAR-?2-?BE/, "Neat Bar 2 BYOD"],
    [/BAR-?2/, "Neat Bar 2"],
    [/BAR-?PRO/, "Neat Bar Pro"],
    [/BAR-?BYOD/, "Neat Bar BYOD"],
    [/BAR/, "Neat Bar"],
    [/PAD-?PRO|NPP|PAD10/, "Neat Pad Pro"],
    [/PAD-?3/, "Neat Pad 3"],
    [/PAD-?2|NP2/, "Neat Pad 2"],
    [/PAD/, "Neat Pad"],
    [/CENTER/, "Neat Center"],
    [/FRAME/, "Neat Frame"],
    [/-EA-|ENTERPRISE/, "Neat Enterprise Agreement"],
  ],
  "TURTLE AV": [
    [/CHAZY/, "Chazy 4K AV over IP (Dante AV-A)"],
    [/DARWIN-?4K/, "Darwin 4K AV over IP"],
    [/DARWIN/, "Darwin HD AV over IP"],
    [/MINEOLA|PHOENIX/, "Mineola and Phoenix Dante audio bridges"],
    [/BB(HDMI|USBC)|BOARDROOM/, "Boardroom Buddy"],
    [/USBEXT/, "USB extender kits"],
    [/XLRWP|BTWP/, "Dante wall plates"],
    [/D2[A-Z]/, "Dante adapters"],
    [/DPA\d/, "Dante amplifiers"],
    [/MX\d\dVW/, "Video wall matrix"],
    [/DDB|JEF|DOWNTOWN/, "Dante bridges, preamps and decoders"],
  ],
};

const SUBSCRIPTION =
  /PULSE|EXTEND\d|CARE|COVER|-EA-|SEL\d|SUBSCRIPTION|LICEN[CS]E|WARRANTY|SUPPORT|-SUB-|SAAS/;
const CABLE = /PWR|CBL(?!-LOCK)|CABLE|USBC-\d+M|RJ\d+M|POE|INJ|-\d+P$|PSU|POWER/;
const ACCESSORY =
  /MOUNT|MNT|STAND|TBLST|TBLCL|TBL-|BRACK|VESA|RACK|STYLUS|PRIV|LOCK|ADAPT|(^|-)KIT|-K$|BLT|CLAMP|COVER-|SHELF|CASE|BAG|MARKER|WHEEL|HEX/;

/** product / accessory / cable / subscription, from the code, then the Sub Activity and description. */
export function itemRole(i: {
  itemCode: string;
  description?: string;
  subActivity?: string;
}): ItemRole {
  const c = i.itemCode.toUpperCase();
  const d = (i.description ?? "").toLowerCase();
  if (
    SUBSCRIPTION.test(c) ||
    /pulse|licen|software|subscription/i.test(i.subActivity ?? "") ||
    /\b(subscription|licen[cs]e|support for \d|years? of support)\b/.test(d)
  )
    return "subscription";
  if (/LOCK/.test(c)) return "accessory";
  if (CABLE.test(c)) return "cable";
  if (ACCESSORY.test(c)) return "accessory";
  if (/BUNDLE|NYU/.test(c)) return "product";
  if (/^(power|usb|hdmi|ethernet)?\s*cable\b|power supply|poe injector/.test(d)) return "cable";
  if (/\b(mount|stand|bracket|clamp|cover|stylus|rack)\b/.test(d.slice(0, 60))) return "accessory";
  return "product";
}

/** The code without demo / old prefixes and the brand's own prefix (TAV-, NEAT). */
const cleanCode = (code: string) =>
  code
    .toUpperCase()
    .replace(/^(OLD-)?(DEMO-)?(MAN-)?/, "")
    .replace(/^TAV-/, "")
    .replace(/^NEAT-?(?=[A-Z])/, "");

/** Product family name of one item, e.g. "Neat Board 50". Null when nothing fits. */
export function productFamily(brand: string, itemCode: string): string | null {
  const code = cleanCode(itemCode);
  const fams = FAMILIES[brand.trim().toUpperCase()];
  if (fams) {
    let best: { at: number; len: number; name: string } | null = null;
    for (const [re, name] of fams) {
      const m = re.exec(code);
      if (!m) continue;
      if (!best || m.index < best.at || (m.index === best.at && m[0].length > best.len))
        best = { at: m.index, len: m[0].length, name };
    }
    return best?.name ?? null;
  }
  // Other brands: the code's model stem (UCX-10-W -> UCX, MX-44 -> MX).
  const stem = /^[A-Z]+/.exec(code.replace(/^[^A-Z]+/, ""))?.[0] ?? "";
  return stem.length >= 2 ? stem : null;
}

export interface Grouped<T> {
  key: string;
  name: string;
  items: T[];
  counts: Record<ItemRole, number>;
}

/**
 * Groups items by product family. Families with one item join "Other <role>" groups, so the list doesn't
 * fill with one-line groups. Items in a group are sorted product, accessory, cable, subscription, then code.
 */
export function groupItems<
  T extends { itemCode: string; description?: string; subActivity?: string },
>(brand: string, items: T[]): Grouped<T & { role: ItemRole }>[] {
  const m = new Map<string, (T & { role: ItemRole })[]>();
  const withRole = items.map((i) => ({ ...i, role: itemRole(i) }));
  const fam = new Map<string, number>();
  const famOf = withRole.map((i) => productFamily(brand, i.itemCode));
  famOf.forEach((f) => f && fam.set(f, (fam.get(f) ?? 0) + 1));
  withRole.forEach((i, n) => {
    const f = famOf[n];
    const name = f && fam.get(f)! > 1 ? f : `Other ${ROLE_LABEL[i.role].toLowerCase()}`;
    m.set(name, [...(m.get(name) ?? []), i]);
  });
  return [...m.entries()]
    .map(([name, list]) => {
      const counts = { product: 0, accessory: 0, cable: 0, subscription: 0 };
      list.forEach((i) => counts[i.role]++);
      return {
        key: name,
        name,
        counts,
        items: list.sort(
          (a, b) =>
            ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) ||
            a.itemCode.localeCompare(b.itemCode),
        ),
      };
    })
    .sort(
      (a, b) =>
        Number(a.name.startsWith("Other ")) - Number(b.name.startsWith("Other ")) ||
        a.name.localeCompare(b.name),
    );
}
