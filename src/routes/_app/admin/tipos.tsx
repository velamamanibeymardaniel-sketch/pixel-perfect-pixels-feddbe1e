import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useDepartments, useRequestTypes } from "@/lib/queries";
import { CatalogAdmin } from "@/components/catalog-admin";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_app/admin/tipos")({ component: TypesPage });

const schema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(100),
  description: z.string().trim().max(500),
  sla_hours: z.string().trim().regex(/^\d*$/, "El plazo debe ser un número entero de horas"),
});
const NONE = "none";

function TypesPage() {
  const { profile } = useAuth();
  const q = useRequestTypes();
  const deps = useDepartments();
  const depName = (id: string | null) => deps.data?.find((d) => d.id === id)?.name ?? "—";
  return (
    <CatalogAdmin
      title="Tipos de solicitud"
      description="Categorías, departamento por defecto y plazo (SLA) en horas."
      newLabel="Nuevo tipo"
      items={q.data}
      loading={q.isLoading}
      error={q.error}
      onRetry={() => q.refetch()}
      invalidate={["request-types"]}
      empty={{ name: "", description: "", sla_hours: "", default_department_id: NONE }}
      columns={[
        { header: "Departamento", cell: (r) => depName(r.default_department_id) },
        { header: "Plazo", cell: (r) => (r.sla_hours ? `${r.sla_hours} h` : "Según prioridad") },
      ]}
      renderForm={(v, set) => (
        <>
          <div className="space-y-1">
            <Label>Nombre</Label>
            <Input value={v["name"] ?? ""} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Descripción</Label>
            <Textarea
              rows={3}
              value={v["description"] ?? ""}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Departamento por defecto</Label>
              <Select
                value={v["default_department_id"] || NONE}
                onValueChange={(x) => set("default_department_id", x)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Ninguno</SelectItem>
                  {(deps.data ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Plazo (horas, opcional)</Label>
              <Input
                inputMode="numeric"
                value={v["sla_hours"] ?? ""}
                onChange={(e) => set("sla_hours", e.target.value)}
              />
            </div>
          </div>
        </>
      )}
      save={async (v, id) => {
        const p = schema.safeParse(v);
        if (!p.success) throw new Error(p.error.issues[0]?.message ?? "Datos inválidos");
        const sla = p.data.sla_hours ? Number(p.data.sla_hours) : null;
        if (sla !== null && (sla < 1 || sla > 8760))
          throw new Error("El plazo debe estar entre 1 y 8760 horas");
        const dep =
          v["default_department_id"] && v["default_department_id"] !== NONE
            ? v["default_department_id"]
            : null;
        const payload = {
          name: p.data.name,
          description: p.data.description || null,
          sla_hours: sla,
          default_department_id: dep,
        };
        const { error } = id
          ? await supabase.from("request_types").update(payload).eq("id", id)
          : await supabase
              .from("request_types")
              .insert({ ...payload, organization_id: profile!.organization_id });
        if (error) throw error;
      }}
      toggle={async (row) => {
        const { error } = await supabase
          .from("request_types")
          .update({ is_active: !row.is_active })
          .eq("id", row.id);
        if (error) throw error;
      }}
    />
  );
}
