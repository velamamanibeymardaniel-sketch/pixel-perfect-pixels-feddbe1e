import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fmtDateTime } from "@/lib/time";
import { EmptyState, ErrorState, PageHeader, TableSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_app/admin/auditoria")({ component: AuditPage });

const PAGE = 25;
const ALL = "all";
const ENTITIES = ["solicitud", "usuario", "sesion", "departments", "request_types", "organizations", "priority_settings"];
const ENTITY_LABEL: Record<string, string> = { solicitud: "Solicitud", usuario: "Usuario", sesion: "Sesión", departments: "Departamento", request_types: "Tipo de solicitud", organizations: "Organización", priority_settings: "Prioridad" };

type Log = { id: string; action: string; entity: string; entity_id: string | null; details: Record<string, unknown>; created_at: string; actor: { full_name: string } | null };

function summarize(d: Record<string, unknown>): string {
  if (!d || !Object.keys(d).length) return "—";
  if ("antes" in d && "despues" in d) return "Registro modificado";
  return Object.entries(d).filter(([, v]) => typeof v !== "object").map(([k, v]) => `${k}: ${String(v)}`).join(" · ") || "Ver detalle";
}

function AuditPage() {
  const [entity, setEntity] = useState(ALL);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => setPage(0), [entity, search, from, to]);

  const q = useQuery({
    queryKey: ["audit", entity, search, from, to, page],
    placeholderData: (p) => p,
    queryFn: async () => {
      let query = supabase.from("audit_logs").select("*, actor:profiles!audit_logs_actor_id_fkey(full_name)", { count: "exact" }).order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
      if (entity !== ALL) query = query.eq("entity", entity);
      if (search.trim()) query = query.ilike("action", `%${search.trim().replace(/[%,]/g, "")}%`);
      if (from) query = query.gte("created_at", new Date(from + "T00:00:00").toISOString());
      if (to) query = query.lte("created_at", new Date(to + "T23:59:59").toISOString());
      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data ?? []) as unknown as Log[], count: count ?? 0 };
    },
  });
  const pages = Math.max(1, Math.ceil((q.data?.count ?? 0) / PAGE));

  return (
    <div>
      <PageHeader title="Auditoría" description="Registro de acciones realizadas en la plataforma." />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar acción…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <Select value={entity} onValueChange={setEntity}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Todas las entidades</SelectItem>{ENTITIES.map((e) => <SelectItem key={e} value={e}>{ENTITY_LABEL[e]}</SelectItem>)}</SelectContent></Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Desde" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Hasta" />
      </div>
      {q.isLoading ? <TableSkeleton /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.rows.length ? <EmptyState title="Sin registros" description="No hay eventos que coincidan con los filtros." /> : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Detalle</th></tr></thead>
              <tbody>
                {q.data.rows.map((l) => (
                  <tr key={l.id} className="cursor-pointer border-t align-top hover:bg-muted/30" onClick={() => setOpen(open === l.id ? null : l.id)}>
                    <td className="whitespace-nowrap p-3">{fmtDateTime(l.created_at)}</td>
                    <td>{l.actor?.full_name ?? "Sistema"}</td>
                    <td className="capitalize">{l.action.replace(/_/g, " ")}</td>
                    <td>{ENTITY_LABEL[l.entity] ?? l.entity}</td>
                    <td className="max-w-md pr-3">{open === l.id ? <pre className="whitespace-pre-wrap break-words text-xs">{JSON.stringify(l.details, null, 2)}</pre> : <span className="line-clamp-2 text-muted-foreground">{summarize(l.details)}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{q.data.count} registros</span>
            <div className="flex items-center gap-2"><Button variant="outline" size="icon" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Página anterior"><ChevronLeft className="size-4" /></Button><span>Página {page + 1} de {pages}</span><Button variant="outline" size="icon" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} aria-label="Página siguiente"><ChevronRight className="size-4" /></Button></div>
          </div>
        </>
      )}
    </div>
  );
}
