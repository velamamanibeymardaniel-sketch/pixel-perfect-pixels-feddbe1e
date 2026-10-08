import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PRIORITIES, PRIORITY_LABEL, errorMessage } from "@/lib/domain";
import { PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_app/admin/configuracion")({ component: SettingsPage });

const orgSchema = z.object({
  name: z.string().trim().min(2, "Ingrese el nombre").max(150),
  email: z.string().trim().email("Correo inválido").or(z.literal("")),
  phone: z.string().trim().max(40),
  address: z.string().trim().max(250),
  due_soon_hours: z.coerce.number().int().min(1).max(720),
  default_sla_hours: z.coerce.number().int().min(1).max(8760),
});

function SettingsPage() {
  const { org, refresh } = useAuth();
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    due_soon_hours: "24",
    default_sla_hours: "72",
    allow_requester_close: true,
  });
  const [sla, setSla] = useState<Record<string, string>>({});
  useEffect(() => {
    if (org)
      setF({
        name: org.name,
        email: org.email ?? "",
        phone: org.phone ?? "",
        address: org.address ?? "",
        due_soon_hours: String(org.due_soon_hours),
        default_sla_hours: String(org.default_sla_hours),
        allow_requester_close: org.allow_requester_close,
      });
  }, [org]);

  const prios = useQuery({
    queryKey: ["priority-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("priority_settings").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
  useEffect(() => {
    if (prios.data)
      setSla(Object.fromEntries(prios.data.map((p) => [p.priority, String(p.sla_hours)])));
  }, [prios.data]);

  const saveOrg = useMutation({
    mutationFn: async () => {
      const p = orgSchema.safeParse(f);
      if (!p.success) throw new Error(p.error.issues[0]?.message ?? "Datos inválidos");
      const { error } = await supabase
        .from("organizations")
        .update({
          name: p.data.name,
          email: p.data.email || null,
          phone: p.data.phone || null,
          address: p.data.address || null,
          due_soon_hours: p.data.due_soon_hours,
          default_sla_hours: p.data.default_sla_hours,
          allow_requester_close: f.allow_requester_close,
        })
        .eq("id", org!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuración guardada");
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const savePrio = useMutation({
    mutationFn: async () => {
      for (const p of PRIORITIES) {
        const n = Number(sla[p]);
        if (!Number.isInteger(n) || n < 1 || n > 8760)
          throw new Error(`Plazo inválido para prioridad ${PRIORITY_LABEL[p]}`);
      }
      for (const p of PRIORITIES) {
        const { error } = await supabase
          .from("priority_settings")
          .update({ sla_hours: Number(sla[p]) })
          .eq("organization_id", org!.id)
          .eq("priority", p);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Plazos por prioridad guardados");
      qc.invalidateQueries({ queryKey: ["priority-settings"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Configuración"
        description="Datos de la organización y plazos de atención."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organización</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveOrg.mutate();
            }}
          >
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Correo</Label>
                <Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Teléfono</Label>
                <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Dirección</Label>
              <Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Aviso de vencimiento (horas antes)</Label>
                <Input
                  inputMode="numeric"
                  value={f.due_soon_hours}
                  onChange={(e) => setF({ ...f, due_soon_hours: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Plazo por defecto (horas)</Label>
                <Input
                  inputMode="numeric"
                  value={f.default_sla_hours}
                  onChange={(e) => setF({ ...f, default_sla_hours: e.target.value })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={f.allow_requester_close}
                onCheckedChange={(v) => setF({ ...f, allow_requester_close: v })}
              />
              Permitir que el solicitante cierre sus solicitudes resueltas
            </label>
            <Button type="submit" disabled={saveOrg.isPending}>
              {saveOrg.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Guardar
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plazos por prioridad (horas)</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              savePrio.mutate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-4">
              {PRIORITIES.map((p) => (
                <div key={p} className="space-y-1">
                  <Label>{PRIORITY_LABEL[p]}</Label>
                  <Input
                    inputMode="numeric"
                    value={sla[p] ?? ""}
                    onChange={(e) => setSla({ ...sla, [p]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <Button type="submit" disabled={savePrio.isPending}>
              {savePrio.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Guardar plazos
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
