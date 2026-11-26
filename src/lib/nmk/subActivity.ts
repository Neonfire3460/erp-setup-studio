// subActivity.ts: recommends the Sub Activity ("Table 4") of a NEW item from the brand's own ERP items.
// Neat, for example, has "Neat" (hardware, mounts, cables) and "Neat Pulse" (Pulse, Care, Cover, licences,
// subscriptions). It learns which words in the code and description go with which Sub Activity (a small
// naive Bayes vote), and names the most similar existing item so the user can see why. The user confirms.
import { codeKey } from "./util";

export interface SubActivityExample {
  itemCode: string;
  description: string;
  subCategoryCode?: string;
  subActivity: string;
}
export interface SubActivitySuggestion {
  value: string;
  /** 0..1: how sure. Below 0.6 it is shown as a hint, not filled in. */
  confidence: number;
  /** The existing item it is most like, and the words that decided it. */
  like: string | null;
  words: string[];
}

const STOP = new Set(
  "a an and the for with of to in on by or from per incl including includes inc x w is are be as at".split(
    " ",
  ),
);

/** Words of a code and description: "PULSE-PLUS-BAR2-1" -> pulse, plus, bar2, bar; "3-year" -> year. */
export function tokens(itemCode: string, description: string): string[] {
  const out = new Set<string>();
  const add = (w: string) => {
    const t = w.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
    if (t.length < 2 || STOP.has(t) || /^\d+$/.test(t)) return;
    out.add(t);
    const stem = t.replace(/\d+$/, "");
    if (stem.length >= 3 && stem !== t) out.add(stem);
    if (t.endsWith("s") && t.length > 4) out.add(t.slice(0, -1));
  };
  for (const w of itemCode.split(/[-_ /.+]+/)) add(w);
  for (const w of description.split(/[^A-Za-z0-9]+/)) add(w);
  return [...out];
}

/** Sub Activity names as the ERP uses them, one spelling each (most used), ignoring rare ones. */
export function subActivityOptions(
  adminList: string[],
  examples: SubActivityExample[],
  minItems = 3,
) {
  const count = new Map<string, Map<string, number>>();
  for (const e of examples) {
    const v = e.subActivity.trim();
    if (!v) continue;
    const k = v.toUpperCase();
    const m = count.get(k) ?? new Map<string, number>();
    m.set(v, (m.get(v) ?? 0) + 1);
    count.set(k, m);
  }
  const out = new Map<string, string>();
  for (const a of adminList) if (a.trim()) out.set(a.trim().toUpperCase(), a.trim());
  for (const [k, m] of count) {
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    if (out.has(k) || total < minItems) continue;
    out.set(k, [...m].sort((a, b) => b[1] - a[1])[0]![0]);
  }
  return [...out.values()].sort((a, b) => a.localeCompare(b));
}

export interface SubActivityModel {
  classes: string[];
  docs: Map<string, number>;
  words: Map<string, Map<string, number>>; // class -> word -> items with that word
  vocab: number;
  items: { key: string; code: string; toks: Set<string>; cls: string }[];
}

/** Learns from the brand's ERP items. Sub Activities are matched to `options` case-insensitively. */
export function trainSubActivity(
  examples: SubActivityExample[],
  options: string[],
): SubActivityModel {
  const byUpper = new Map(options.map((o) => [o.toUpperCase(), o]));
  const docs = new Map<string, number>();
  const words = new Map<string, Map<string, number>>();
  const vocab = new Set<string>();
  const items: SubActivityModel["items"] = [];
  for (const e of examples) {
    const cls = byUpper.get(e.subActivity.trim().toUpperCase());
    if (!cls) continue;
    const toks = tokens(e.itemCode, e.description);
    docs.set(cls, (docs.get(cls) ?? 0) + 1);
    const m = words.get(cls) ?? new Map<string, number>();
    for (const t of toks) {
      m.set(t, (m.get(t) ?? 0) + 1);
      vocab.add(t);
    }
    words.set(cls, m);
    items.push({ key: codeKey(e.itemCode), code: e.itemCode, toks: new Set(toks), cls });
  }
  return { classes: [...docs.keys()], docs, words, vocab: vocab.size, items };
}

export function suggestSubActivity(
  model: SubActivityModel,
  itemCode: string,
  description: string,
): SubActivitySuggestion | null {
  if (!model.classes.length) return null;
  if (model.classes.length === 1)
    return { value: model.classes[0]!, confidence: 1, like: null, words: [] };
  const toks = tokens(itemCode, description);
  const total = [...model.docs.values()].reduce((a, b) => a + b, 0);
  const known = toks.filter((t) => model.classes.some((c) => model.words.get(c)?.has(t)));
  const scores = model.classes.map((c) => {
    const n = model.docs.get(c)!;
    const w = model.words.get(c)!;
    let s = Math.log(n / total);
    for (const t of known) s += Math.log(((w.get(t) ?? 0) + 0.5) / (n + 1));
    return { c, s };
  });
  scores.sort((a, b) => b.s - a.s);
  const max = scores[0]!.s;
  const sum = scores.reduce((a, x) => a + Math.exp(x.s - max), 0);
  let confidence = 1 / sum;
  const value = scores[0]!.c;
  // The most similar existing item of that Sub Activity (shared words, then shared code start).
  const mine = new Set(toks);
  let like: { code: string; score: number } | null = null;
  for (const it of model.items) {
    if (it.cls !== value) continue;
    let shared = 0;
    for (const t of it.toks) if (mine.has(t)) shared++;
    const a = itemCode.toUpperCase(),
      b = it.code.toUpperCase();
    let p = 0;
    while (p < a.length && p < b.length && a[p] === b[p]) p++;
    const score = shared + p / 10;
    if (!like || score > like.score) like = { code: it.code, score };
  }
  // Words that point most strongly to the winner.
  const lift = (t: string) => {
    const r = (c: string) => ((model.words.get(c)!.get(t) ?? 0) + 0.5) / (model.docs.get(c)! + 1);
    const others = model.classes.filter((c) => c !== value).map(r);
    return r(value) / Math.max(...others);
  };
  const strong = known
    .map((t) => ({ t, l: lift(t) }))
    .filter((x) => x.l > 2)
    .sort((a, b) => b.l - a.l)
    .slice(0, 3)
    .map((x) => x.t);
  if (!known.length) confidence = Math.min(confidence, 0.5);
  return {
    value,
    confidence: Math.round(confidence * 100) / 100,
    like: like && like.score >= 1 ? like.code : null,
    words: strong,
  };
}
