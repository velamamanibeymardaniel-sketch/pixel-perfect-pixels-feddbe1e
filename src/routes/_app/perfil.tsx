import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_LABEL, errorMessage } from "@/lib/domain";
import { PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_app/perfil")({ component: ProfilePage });

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Ingrese su nombre").max(120),
  position: z.string().trim().max(120),
  phone: z.string().trim().max(40),
});
const pwdSchema = z.object({ password: z.string().min(8, "Mínimo 8 caracteres").max(72), confirm: z.string() }).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Las contraseñas no coinciden" });

function ProfilePage() {
  const { profile, role, org, userId, refresh } = useAuth();
  const dep = useQuery({
    queryKey: ["my-department", profile?.department_id],
    enabled: !!profile?.department_id,
    queryFn: async () => (await supabase.from("departments").select("name").eq("id", profile!.department_id!).maybeSingle()).data?.name ?? null,
  });
  const [form, setForm] = useState({ full_name: "", position: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [pwd, setPwd] = useState({ password: "", confirm: "" });
  const [pwdError, setPwdError] = useState<string | null>(null);
  useEffect(() => { if (profile) setForm({ full_name: profile.full_name, position: profile.position ?? "", phone: profile.phone ?? "" }); }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      const p = profileSchema.parse(form);
      const { error: e } = await supabase.from("profiles").update({ full_name: p.full_name, position: p.position || null, phone: p.phone || null }).eq("id", userId!);
      if (e) throw e;
    },
    onSuccess: () => { toast.success("Perfil actualizado"); setError(null); refresh(); },
    onError: (e) => setError(e instanceof z.ZodError ? (e.issues[0]?.message ?? "Datos inválidos") : errorMessage(e)),
  });
  const changePwd = useMutation({
    mutationFn: async () => {
      const p = pwdSchema.parse(pwd);
      const { error: e } = await supabase.auth.updateUser({ password: p.password });
      if (e) throw e;
    },
    onSuccess: () => { toast.success("Contraseña actualizada"); setPwd({ password: "", confirm: "" }); setPwdError(null); },
    onError: (e) => setPwdError(e instanceof z.ZodError ? (e.issues[0]?.message ?? "Datos inválidos") : "No se pudo cambiar la contraseña"),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Mi perfil" />
      <Card>
        <CardHeader><CardTitle className="text-base">Datos personales</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1"><Label>Correo</Label><Input value={profile?.email ?? ""} disabled /></div>
            <div className="space-y-1"><Label>Rol</Label><Input value={ROLE_LABEL[role]} disabled /></div>
            <div className="space-y-1"><Label>Departamento</Label><Input value={dep.data ?? "Sin departamento"} disabled /></div>
            <div className="space-y-1"><Label>Organización</Label><Input value={org?.name ?? ""} disabled /></div>
          </div>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="space-y-1"><Label htmlFor="fn">Nombre completo</Label><Input id="fn" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1"><Label htmlFor="pos">Cargo</Label><Input id="pos" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="ph">Teléfono</Label><Input id="ph" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <p className="text-xs text-muted-foreground">El correo, rol y departamento solo los puede modificar un administrador.</p>
            <Button type="submit" disabled={save.isPending}>{save.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Guardar cambios</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Cambiar contraseña</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); changePwd.mutate(); }}>
            {pwdError && <p role="alert" className="text-sm text-destructive">{pwdError}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1"><Label htmlFor="np">Nueva contraseña</Label><Input id="np" type="password" autoComplete="new-password" value={pwd.password} onChange={(e) => setPwd({ ...pwd, password: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="cp">Confirmar</Label><Input id="cp" type="password" autoComplete="new-password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} /></div>
            </div>
            <Button type="submit" variant="outline" disabled={changePwd.isPending}>{changePwd.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Actualizar contraseña</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
