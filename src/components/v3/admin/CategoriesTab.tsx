// Categories: import "Categories Data Midwich Mapped.xlsx" (sheet 1 Master Data, sheet 2 Midwich Codes),
// then fix the Midwich family of single rows. Everything is keyed by Sub Category code.
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { UploadArea } from "@/components/UploadArea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, Label11, errText } from "@/components/v3/ui";
import {
  readCategoriesSheet,
  readMidwichSheet,
  type CategoryRow,
  type MidwichFamily,
} from "@/lib/nmk/categories";
import { ListEditor, looseDb } from "./ListEditor";

type Parsed = {
  rows: CategoryRow[];
  midwich: MidwichFamily[];
  problems: string[];
  warnings: string[];
};

export function CategoriesTab() {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [busy, setBusy] = useState(false);
  const [mw, setMw] = useState<MidwichFamily[]>([]);
  const [onlyReview, setOnlyReview] = useState(false);
  const [v, setV] = useState(0);
  useEffect(() => {
    void looseDb
      .from("midwich_families")
      .select("code,name")
      .order("code")
      .then((r: { data: MidwichFamily[] | null }) => setMw(r.data ?? []));
  }, [v]);

  async function read(f: File) {
    setFile(f);
    setParsed(null);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      const sheet = (i: number) => {
        const n = wb.SheetNames[i];
        return n
          ? (XLSX.utils.sheet_to_json(wb.Sheets[n]!, {
              header: 1,
              defval: "",
              raw: false,
            }) as unknown[][])
          : [];
      };
      const c = readCategoriesSheet(sheet(0));
      setParsed({
        rows: c.rows,
        midwich: readMidwichSheet(sheet(1)),
        problems: c.problems,
        warnings: c.warnings,
      });
    } catch (e) {
      toast.error(errText(e));
    }
  }

  async function save() {
    if (!parsed) return;
    setBusy(true);
    try {
      if (parsed.midwich.length) {
        const r = await looseDb.from("midwich_families").upsert(
          parsed.midwich.map((m) => ({ code: m.code, name: m.name })),
          { onConflict: "code" },
        );
        if (r.error) throw new Error(r.error.message);
      }
      const rows = parsed.rows.map((c) => ({
        sub_category_code: c.subCategoryCode,
        family_code: c.familyCode,
        family_name: c.familyName,
        group_code: c.groupCode,
        group_name: c.groupName,
        category_code: c.categoryCode,
        category_name: c.categoryName,
        midwich_code: c.midwichCode,
        review_note: c.reviewNote,
        active: true,
      }));
      for (let i = 0; i < rows.length; i += 500) {
        const r = await looseDb
          .from("categories")
          .upsert(rows.slice(i, i + 500), { onConflict: "sub_category_code" });
        if (r.error) throw new Error(r.error.message);
      }
      toast.success(
        `Saved ${rows.length} categories and ${parsed.midwich.length} Midwich families`,
      );
      setParsed(null);
      setFile(null);
      setV((x) => x + 1);
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <Label11>Import the categories file</Label11>
        <p className="text-sm text-muted-foreground">
          Sheet 1 is the category tree (Family, Group, Category, SubCategory, Midwich Code). Sheet 2
          is the Midwich Codes list. Existing Sub Category codes are updated, new ones added, none
          deleted.
        </p>
        <UploadArea
          file={file}
          onFile={(f) => void read(f)}
          accept=".xlsx"
          hint="Categories Data Midwich Mapped.xlsx"
          label="Drop the categories file here or browse"
          onRemove={() => {
            setFile(null);
            setParsed(null);
          }}
        />
        {parsed && (
          <div className="space-y-2 text-sm">
            <p>
              <b>{parsed.rows.length}</b> categories and <b>{parsed.midwich.length}</b> Midwich
              families found. {parsed.rows.filter((r) => r.reviewNote).length} rows have a review
              note.
            </p>
            {parsed.problems.map((p) => (
              <p key={p} className="text-destructive">
                {p}
              </p>
            ))}
            {parsed.warnings.slice(0, 10).map((w) => (
              <p key={w} className="text-warning">
                {w}
              </p>
            ))}
            <Button
              disabled={busy || !parsed.rows.length || parsed.problems.length > 0}
              onClick={save}
            >
              {busy && <Loader2 className="animate-spin" />}Save categories
            </Button>
          </div>
        )}
      </Card>
      <Card className="space-y-2">
        <div className="flex items-center justify-between">
          <Label11>Categories</Label11>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={onlyReview} onCheckedChange={setOnlyReview} />
            Only rows with a review note
          </label>
        </div>
        <ListEditor
          key={`${v}-${onlyReview}`}
          table="categories"
          pk={["sub_category_code"]}
          order="sub_category_code"
          searchable
          canDelete={false}
          canAdd={false}
          note="Change the Midwich family of a row here. Words show in the wizard; the ERP file gets the codes."
          cols={[
            {
              key: "sub_category_code",
              label: "Sub Category",
              lockOnEdit: true,
              required: true,
              width: "110px",
            },
            { key: "family_name", label: "Family", width: "140px" },
            { key: "group_name", label: "Group", width: "160px" },
            { key: "category_name", label: "Category", width: "180px" },
            {
              key: "midwich_code",
              label: "Midwich",
              type: "select",
              options: mw.map((m) => ({ value: m.code, label: `${m.code} ${m.name}` })),
              width: "170px",
            },
            { key: "review_note", label: "Review note", width: "200px" },
            { key: "active", label: "Active", type: "bool" },
          ]}
          filterRows={onlyReview ? (r) => !!String(r["review_note"] ?? "").trim() : undefined}
        />
      </Card>
    </div>
  );
}
