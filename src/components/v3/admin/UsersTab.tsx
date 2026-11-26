// Users: add people, give them roles (a person can have several), disable accounts.
import { mergeBrandSpellings } from "@/lib/nmk/brands";
import { useEffect, useState } from "react";
import { Loader2, Search, Tags, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label11, errText, fmtDate } from "@/components/v3/ui";
import {
  createUser,
  listBrandAccess,
  setBrandAccess,
  setUserActive,
  setUserRoles,
} from "@/lib/v3/admin.functions";

const ROLES = [
  { role: "user", label: "User", hint: "sends tickets" },
  { role: "reviewer", label: "Reviewer", hint: "reviews, uploads, imports ERP data" },
  { role: "approver", label: "Approver", hint: "approves prices" },
  { role: "admin", label: "Admin", hint: "everything" },
] as const;
type Role = (typeof ROLES)[number]["role"];
type U = {
  user_id: string;
  email: string;
  full_name: string;
  roles: string[];
  active: boolean;
  created_at: string;
};

export function UsersTab({ isAdmin }: { isAdmin: boolean }) {
  const [users, setUsers] = useState<U[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [access, setAccess] = useState<{ ready: boolean; byUser: Map<string, string[]> }>({
    ready: false,
    byUser: new Map(),
  });
  const [allBrands, setAllBrands] = useState<string[]>([]);
  const [editing, setEditing] = useState<U | null>(null);
  const [form, setForm] = useState({
    email: "",
    fullName: "",
    password: "",
    roles: ["user"] as Role[],
  });

  async function load() {
    const r = await supabase.rpc("admin_list_users");
    if (r.error) toast.error(r.error.message);
    else setUsers(r.data as U[]);
    if (isAdmin) {
      const [a, b] = await Promise.all([
        listBrandAccess().catch(() => ({ ready: false, rows: [] })),
        supabase.rpc("list_brands_v3"),
      ]);
      const m = new Map<string, string[]>();
      for (const x of a.rows) m.set(x.user_id, [...(m.get(x.user_id) ?? []), x.brand_activity]);
      setAccess({ ready: a.ready, byUser: m });
      setAllBrands(
        mergeBrandSpellings((b.data ?? []) as { brand_activity: string }[])
          .map((x) => x.brand_activity)
          .sort(),
      );
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function run(id: string, f: () => Promise<unknown>, done: string) {
    setBusy(id);
    try {
      await f();
      toast.success(done);
      await load();
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(null);
    }
  }
  const toggle = (u: U, role: Role, on: boolean) => {
    const roles = (
      on ? [...new Set([...u.roles, role])] : u.roles.filter((r) => r !== role)
    ) as Role[];
    if (!roles.length) {
      toast.error("Keep at least one role");
      return;
    }
    void run(u.user_id, () => setUserRoles({ data: { userId: u.user_id, roles } }), "Roles saved");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Admins can do everything. A person can be a reviewer and an approver; turn on "Block
          self-approval" in Rules to stop one person doing both on the same ticket. A User only
          sees, prices and registers the brands you give them under Brands (so only their own
          costs); staff see every brand.
        </p>
        {isAdmin && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <UserPlus />
            Add user
          </Button>
        )}
      </div>
      <div className="overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            <tr>
              <th className="p-2">Name</th>
              <th className="p-2">Email</th>
              {ROLES.map((r) => (
                <th key={r.role} className="p-2 text-center" title={r.hint}>
                  {r.label}
                </th>
              ))}
              {isAdmin && <th className="p-2">Brands</th>}
              <th className="p-2">Active</th>
              <th className="p-2">Added</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id} className={u.active ? "border-t" : "border-t opacity-50"}>
                <td className="p-2 font-semibold">
                  {u.full_name || "(no name)"}
                  {busy === u.user_id && <Loader2 className="ml-2 inline size-3.5 animate-spin" />}
                </td>
                <td className="p-2">{u.email}</td>
                {ROLES.map((r) => (
                  <td key={r.role} className="p-2 text-center">
                    <Checkbox
                      disabled={!isAdmin || busy !== null}
                      checked={u.roles.includes(r.role)}
                      onCheckedChange={(v) => toggle(u, r.role, v === true)}
                    />
                  </td>
                ))}
                {isAdmin && (
                  <td className="p-2">
                    {u.roles.some((x) => x !== "user") ? (
                      <span className="text-xs text-muted-foreground">All brands (staff)</span>
                    ) : (
                      <button
                        type="button"
                        disabled={!access.ready}
                        onClick={() => setEditing(u)}
                        className="flex max-w-72 items-center gap-1.5 rounded-md border px-2 py-1 text-left text-xs hover:border-primary disabled:opacity-50"
                        title={
                          access.ready
                            ? "Choose this account's brands"
                            : "Apply the v5 migration first"
                        }
                      >
                        <Tags className="size-3.5 shrink-0 text-primary" />
                        <span className="truncate">
                          {(access.byUser.get(u.user_id) ?? []).length
                            ? (access.byUser.get(u.user_id) ?? []).join(", ")
                            : "No brands yet: pick"}
                        </span>
                      </button>
                    )}
                  </td>
                )}
                <td className="p-2">
                  <Switch
                    disabled={!isAdmin || busy !== null}
                    checked={u.active}
                    onCheckedChange={(v) =>
                      void run(
                        u.user_id,
                        () => setUserActive({ data: { userId: u.user_id, active: v } }),
                        v ? "Enabled" : "Disabled: they can't sign in",
                      )
                    }
                  />
                </td>
                <td className="whitespace-nowrap p-2 text-muted-foreground">
                  {fmtDate(u.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <BrandPicker
          user={editing}
          all={allBrands}
          initial={access.byUser.get(editing.user_id) ?? []}
          onClose={() => setEditing(null)}
          onSave={(brands) =>
            run(
              editing.user_id,
              async () => {
                await setBrandAccess({ data: { userId: editing.user_id, brands } });
                setEditing(null);
              },
              `${editing.full_name || editing.email}: ${brands.length} brand${brands.length === 1 ? "" : "s"}`,
            )
          }
        />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a user</DialogTitle>
            <DialogDescription>
              They sign in with this email and password. Tell them the password yourself.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label11>Full name</Label11>
              <Input
                className="mt-1"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div>
              <Label11>Email</Label11>
              <Input
                className="mt-1"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label11>Password (8+ characters)</Label11>
              <Input
                className="mt-1"
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div className="flex flex-wrap gap-4">
              {ROLES.map((r) => (
                <label key={r.role} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.roles.includes(r.role)}
                    onCheckedChange={(v) =>
                      setForm({
                        ...form,
                        roles:
                          v === true
                            ? [...form.roles, r.role]
                            : form.roles.filter((x) => x !== r.role),
                      })
                    }
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                busy !== null ||
                !form.email ||
                !form.fullName ||
                form.password.length < 8 ||
                !form.roles.length
              }
              onClick={() =>
                void run(
                  "new",
                  async () => {
                    await createUser({ data: form });
                    setOpen(false);
                    setForm({ email: "", fullName: "", password: "", roles: ["user"] });
                  },
                  "User added",
                )
              }
            >
              Add user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BrandPicker({
  user,
  all,
  initial,
  onClose,
  onSave,
}: {
  user: U;
  all: string[];
  initial: string[];
  onClose: () => void;
  onSave: (brands: string[]) => Promise<void>;
}) {
  const [picked, setPicked] = useState(new Set(initial.map((b) => b.toUpperCase())));
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const list = all.filter((b) => b.toLowerCase().includes(q.trim().toLowerCase()));
  const chosen = all.filter((b) => picked.has(b.toUpperCase()));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Brands for {user.full_name || user.email}</DialogTitle>
          <DialogDescription>
            They only see, price and register these brands, and only see costs for them.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search brands"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {chosen.length} picked
          {chosen.length
            ? `: ${chosen.slice(0, 6).join(", ")}${chosen.length > 6 ? "..." : ""}`
            : ""}
        </p>
        <div className="max-h-80 space-y-1 overflow-auto rounded-md border p-2">
          {list.map((b) => (
            <label
              key={b}
              className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted"
            >
              <Checkbox
                checked={picked.has(b.toUpperCase())}
                onCheckedChange={(v) =>
                  setPicked((p) => {
                    const n = new Set(p);
                    if (v === true) n.add(b.toUpperCase());
                    else n.delete(b.toUpperCase());
                    return n;
                  })
                }
              />
              {b}
            </label>
          ))}
          {!list.length && <p className="p-2 text-sm text-muted-foreground">No brand matches.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(chosen);
              } finally {
                setSaving(false);
              }
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
