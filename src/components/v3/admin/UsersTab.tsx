// Users: add people, give them roles (a person can have several), disable accounts.
import { useEffect, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
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
import { createUser, setUserActive, setUserRoles } from "@/lib/v3/admin.functions";

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
          self-approval" in Rules to stop one person doing both on the same ticket.
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
