import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useDepartments } from "@/lib/queries";
import { CatalogAdmin } from "@/components/catalog-admin";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_app/admin/departamentos")({ component: DepartmentsPage });

const schema = z.object({ name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(100), description: z.string().trim().max(500) });

function DepartmentsPage() {
  const { profile } = useAuth();
  const q = useDepartments();
  return (
    <CatalogAdmin
      title="Departamentos" description="Áreas de la organización que reciben solicitudes." newLabel="Nuevo departamento"
      items={q.data} loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} columns={[]} empty={{ name: "", description: "" }} invalidate={["departments"]}
      renderForm={(v, set) => (<>
        <div className="space-y-1"><Label>Nombre</Label><Input value={v["name"] ?? ""} onChange={(e) => set("name", e.target.value)} /></div>
        <div className="space-y-1"><Label>Descripción</Label><Textarea rows={3} value={v["description"] ?? ""} onChange={(e) => set("description", e.target.value)} /></div>
      </>)}
      save={async (v, id) => {
        const p = schema.safeParse(v);
        if (!p.success) throw new Error(p.error.issues[0]?.message ?? "Datos inválidos");
        const payload = { name: p.data.name, description: p.data.description || null };
        const { error } = id ? await supabase.from("departments").update(payload).eq("id", id) : await supabase.from("departments").insert({ ...payload, organization_id: profile!.organization_id });
        if (error) throw error;
      }}
      toggle={async (row) => { const { error } = await supabase.from("departments").update({ is_active: !row.is_active }).eq("id", row.id); if (error) throw error; }}
    />
  );
}
