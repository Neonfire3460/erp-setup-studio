import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type U = { user_id: string; email: string; full_name: string; roles: string[]; active: boolean; created_at: string };

export function UsersAdmin() {
  const [users, setUsers] = useState<U[]>([]);
  async function load() {
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) toast.error(error.message);
    else setUsers(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function setRole(id: string, role: "admin" | "user") {
    const { error } = await supabase.rpc("admin_set_roles", { _user_id: id, _roles: [role] });
    if (error) toast.error(error.message);
    else toast.success("Role updated");
    load();
  }

  return (
    <Table>
      <TableHeader>
        <TableRow><TableHead>Email</TableHead><TableHead>Created</TableHead><TableHead>Role</TableHead></TableRow>
      </TableHeader>
      <TableBody>
        {users.map((u) => (
          <TableRow key={u.user_id}>
            <TableCell>{u.email}</TableCell>
            <TableCell>{new Date(u.created_at).toLocaleDateString()}</TableCell>
            <TableCell>
              <Select value={u.roles.includes("admin") ? "admin" : "user"} onValueChange={(v) => setRole(u.user_id, v as "admin" | "user")}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">admin</SelectItem>
                  <SelectItem value="user">user</SelectItem>
                </SelectContent>
              </Select>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
