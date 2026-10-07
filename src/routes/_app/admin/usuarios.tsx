import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useDepartments } from "@/lib/queries";
import { ROLE_LABEL, errorMessage, primaryRole, type AppRole, type Profile } from "@/lib/domain";
import { createUser, updateUser, setUserPassword } from "@/lib/users.functions";
import { fmtDateTime } from "@/lib/time";
import { EmptyState, ErrorState, PageHeader, TableSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_app/admin/usuarios")({ component: UsersPage });

type UserRow = Profile & { role: AppRole };
const NONE = "none";

const userSchema = z.object({
  full_name: z.string().trim().min(2, "Ingrese el nombre").max(120),
  email: z.string().trim().email("Correo inválido").max(255),
  password: z.string().min(8, "Mínimo 8 caracteres").max(72).or(z.literal("")),
});

type FormState = { id?: string; full_name: string; email: string; password: string; role: AppRole; department_id: string; position: string; phone: string; is_active: boolean };
const empty: FormState = { full_name: "", email: "", password: "", role: "empleado", department_id: NONE, position: "", phone: "", is_active: true };

function UsersPage() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const deps = useDepartments();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: async (): Promise<UserRow[]> => {
      const [{ data: profiles, error: e1 }, { data: roles, error: e2 }] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return (profiles ?? []).map((p) => ({ ...p, role: primaryRole((roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role)) }));
    },
  });

  const save = useMutation({
    mutationFn: async (f: FormState) => {
      const base = userSchema.parse({ full_name: f.full_name, email: f.email, password: f.password });
      const common = { full_name: base.full_name, role: f.role, department_id: f.department_id === NONE ? null : f.department_id, position: f.position.trim() || null, phone: f.phone.trim() || null };
      if (f.id) {
        await updateUser({ data: { id: f.id, ...common, is_active: f.is_active } });
        if (base.password) await setUserPassword({ data: { id: f.id, password: base.password } });
      } else {
        if (!base.password) throw new Error("Ingrese una contraseña inicial de al menos 8 caracteres");
        await createUser({ data: { email: base.email, password: base.password, ...common } });
      }
    },
    onSuccess: () => { toast.success("Usuario guardado"); setForm(null); setError(null); qc.invalidateQueries({ queryKey: ["admin-users"] }); qc.invalidateQueries({ queryKey: ["assignees"] }); },
    onError: (e) => setError(e instanceof z.ZodError ? (e.issues[0]?.message ?? "Datos inválidos") : errorMessage(e)),
  });
  const toggle = useMutation({
    mutationFn: async (u: UserRow) => updateUser({ data: { id: u.id, full_name: u.full_name, role: u.role, department_id: u.department_id, position: u.position, phone: u.phone, is_active: !u.is_active } }),
    onSuccess: () => { toast.success("Estado del usuario actualizado"); qc.invalidateQueries({ queryKey: ["admin-users"] }); qc.invalidateQueries({ queryKey: ["assignees"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const depName = (id: string | null) => deps.data?.find((d) => d.id === id)?.name ?? "—";
  const term = search.trim().toLowerCase();
  const rows = (users.data ?? []).filter((u) => !term || u.full_name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
  const openEdit = (u: UserRow) => { setError(null); setForm({ id: u.id, full_name: u.full_name, email: u.email, password: "", role: u.role, department_id: u.department_id ?? NONE, position: u.position ?? "", phone: u.phone ?? "", is_active: u.is_active }); };

  return (
    <div>
      <PageHeader title="Usuarios" description="Cree cuentas, asigne roles y departamentos." actions={<Button onClick={() => { setError(null); setForm(empty); }}><Plus className="mr-2 size-4" />Nuevo usuario</Button>} />
      <div className="relative mb-4 max-w-sm"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar por nombre o correo…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      {users.isLoading ? <TableSkeleton /> : users.isError ? <ErrorState error={users.error} onRetry={() => users.refetch()} /> : !rows.length ? <EmptyState title="Sin usuarios" description="No hay usuarios que coincidan." /> : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Nombre</th><th>Correo</th><th>Rol</th><th>Departamento</th><th>Último acceso</th><th>Activo</th><th /></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="p-3 font-medium">{u.full_name}</td><td>{u.email}</td><td>{ROLE_LABEL[u.role]}</td><td>{depName(u.department_id)}</td><td className="whitespace-nowrap">{fmtDateTime(u.last_login_at)}</td>
                  <td><Switch checked={u.is_active} disabled={u.id === userId || toggle.isPending} onCheckedChange={() => toggle.mutate(u)} aria-label={`Activar o desactivar a ${u.full_name}`} /></td>
                  <td className="pr-3 text-right"><Button size="icon" variant="ghost" aria-label={`Editar a ${u.full_name}`} onClick={() => openEdit(u)}><Pencil className="size-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={!!form} onOpenChange={(o) => !o && !save.isPending && setForm(null)}>
        <DialogContent>
          {form && (
            <form onSubmit={(e) => { e.preventDefault(); setError(null); save.mutate(form); }} className="space-y-4">
              <DialogHeader><DialogTitle>{form.id ? "Editar usuario" : "Nuevo usuario"}</DialogTitle><DialogDescription>{form.id ? "Deje la contraseña vacía para no cambiarla." : "La cuenta se crea confirmada y lista para ingresar."}</DialogDescription></DialogHeader>
              {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
              <div className="space-y-1"><Label>Nombre completo</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="space-y-1"><Label>Correo</Label><Input type="email" value={form.email} disabled={!!form.id} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-1"><Label>{form.id ? "Nueva contraseña (opcional)" : "Contraseña inicial"}</Label><Input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1"><Label>Rol</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(ROLE_LABEL) as AppRole[]).map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label>Departamento</Label>
                  <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value={NONE}>Sin departamento</SelectItem>{(deps.data ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label>Cargo</Label><Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
                <div className="space-y-1"><Label>Teléfono</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              {form.id && <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_active} disabled={form.id === userId} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />Usuario activo</label>}
              <DialogFooter><Button type="button" variant="outline" onClick={() => setForm(null)} disabled={save.isPending}>Cancelar</Button><Button type="submit" disabled={save.isPending}>{save.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Guardar</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
