import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAssignees, useDepartments, useRequestTypes, REQUEST_SELECT, type RequestListItem } from "@/lib/queries";
import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL } from "@/lib/domain";
import { fmtDate, dueInfo } from "@/lib/time";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { EmptyState, ErrorState, PageHeader, TableSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 15;
const ALL = "all";
type SortCol = "created_at" | "due_at" | "priority" | "status" | "code";

function FilterSelect({ value, onChange, placeholder, options }: { value: string; onChange: (v: string) => void; placeholder: string; options: { value: string; label: string }[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function RequestsListPage({ mine }: { mine: boolean }) {
  const { userId, role } = useAuth();
  const deps = useDepartments();
  const types = useRequestTypes();
  const assignees = useAssignees();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState(ALL);
  const [priority, setPriority] = useState(ALL);
  const [dep, setDep] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [assignee, setAssignee] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<{ col: SortCol; asc: boolean }>({ col: "created_at", asc: false });
  const [page, setPage] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(0), [debounced, status, priority, dep, type, assignee, from, to, sort, mine]);

  const q = useQuery({
    queryKey: ["requests", { mine, debounced, status, priority, dep, type, assignee, from, to, sort, page, userId }],
    enabled: !!userId,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      let query = supabase.from("requests").select(REQUEST_SELECT, { count: "exact" });
      if (mine) query = query.eq("requester_id", userId!);
      if (status !== ALL) query = query.eq("status", status as never);
      if (priority !== ALL) query = query.eq("priority", priority as never);
      if (dep !== ALL) query = query.eq("department_id", dep);
      if (type !== ALL) query = query.eq("request_type_id", type);
      if (assignee === "none") query = query.is("assignee_id", null);
      else if (assignee !== ALL) query = query.eq("assignee_id", assignee);
      if (from) query = query.gte("created_at", new Date(from + "T00:00:00").toISOString());
      if (to) query = query.lte("created_at", new Date(to + "T23:59:59").toISOString());
      if (debounced) {
        const term = debounced.replace(/[%,()"\\*:]/g, " ").trim();
        query = query.or(`title.ilike.%${term}%,code.ilike.%${term}%`);
      }
      query = query.order(sort.col, { ascending: sort.asc }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data ?? []) as unknown as RequestListItem[], count: count ?? 0 };
    },
  });

  const total = q.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = [status, priority, dep, type, assignee].some((v) => v !== ALL) || !!search || !!from || !!to;
  const clear = () => { setSearch(""); setStatus(ALL); setPriority(ALL); setDep(ALL); setType(ALL); setAssignee(ALL); setFrom(""); setTo(""); };
  const toggleSort = (col: SortCol) => setSort((s) => (s.col === col ? { col, asc: !s.asc } : { col, asc: false }));
  const SortHead = ({ col, children }: { col: SortCol; children: React.ReactNode }) => (
    <button type="button" onClick={() => toggleSort(col)} className="inline-flex items-center gap-1 font-semibold uppercase">
      {children}{sort.col === col && (sort.asc ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
    </button>
  );

  return (
    <div>
      <PageHeader
        title={mine ? "Mis solicitudes" : role === "responsable" ? "Solicitudes asignadas" : "Solicitudes"}
        description={mine ? "Solicitudes que usted registró." : "Consulte y gestione las solicitudes de su ámbito."}
        actions={<Button asChild><Link to="/solicitudes/nueva">Nueva solicitud</Link></Button>}
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por código o título…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar" />
        </div>
        <FilterSelect value={status} onChange={setStatus} placeholder="Todos los estados" options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
        <FilterSelect value={priority} onChange={setPriority} placeholder="Todas las prioridades" options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))} />
        <FilterSelect value={dep} onChange={setDep} placeholder="Todos los departamentos" options={(deps.data ?? []).map((d) => ({ value: d.id, label: d.name }))} />
        <FilterSelect value={type} onChange={setType} placeholder="Todos los tipos" options={(types.data ?? []).map((t) => ({ value: t.id, label: t.name }))} />
        {!mine && role === "admin" && (
          <FilterSelect value={assignee} onChange={setAssignee} placeholder="Todos los responsables" options={[{ value: "none", label: "Sin asignar" }, ...(assignees.data ?? []).map((a) => ({ value: a.id, label: a.full_name }))]} />
        )}
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Desde" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Hasta" />
      </div>
      {hasFilters && <Button variant="ghost" size="sm" className="mb-3" onClick={clear}><X className="mr-1 size-4" />Limpiar filtros</Button>}

      {q.isLoading ? <TableSkeleton /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.data && q.data.rows.length === 0 ? (
        <EmptyState title={hasFilters ? "Sin resultados" : "No hay solicitudes"} description={hasFilters ? "Pruebe cambiando o limpiando los filtros." : "Cree su primera solicitud para comenzar."} action={!hasFilters ? <Button asChild><Link to="/solicitudes/nueva">Nueva solicitud</Link></Button> : undefined} />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border lg:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3"><SortHead col="code">Código</SortHead></th><th>Título</th><th>Solicitante</th><th>Departamento</th><th>Tipo</th>
                  <th><SortHead col="priority">Prioridad</SortHead></th><th><SortHead col="status">Estado</SortHead></th><th>Responsable</th>
                  <th><SortHead col="created_at">Creada</SortHead></th><th><SortHead col="due_at">Vence</SortHead></th>
                </tr>
              </thead>
              <tbody>
                {q.data!.rows.map((r) => {
                  const due = dueInfo(r);
                  return (
                    <tr key={r.id} className="border-t hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs"><Link to="/solicitudes/$id" params={{ id: r.id }} className="text-primary hover:underline">{r.code}</Link></td>
                      <td className="max-w-[16rem] truncate pr-3" title={r.title}>{r.title}</td>
                      <td className="pr-3">{r.requester?.full_name ?? "—"}</td>
                      <td className="pr-3">{r.department?.name ?? "—"}</td>
                      <td className="pr-3">{r.type?.name ?? "—"}</td>
                      <td className="pr-3"><PriorityBadge priority={r.priority} /></td>
                      <td className="pr-3"><StatusBadge status={r.status} /></td>
                      <td className="pr-3">{r.assignee?.full_name ?? <span className="text-muted-foreground">Sin asignar</span>}</td>
                      <td className="pr-3 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                      <td className={cn("pr-3 whitespace-nowrap", due.state === "overdue" && "font-medium text-destructive")} title={due.label}>{fmtDate(r.due_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 lg:hidden">
            {q.data!.rows.map((r) => {
              const due = dueInfo(r);
              return (
                <Link key={r.id} to="/solicitudes/$id" params={{ id: r.id }} className="block rounded-lg border p-3">
                  <div className="flex items-center justify-between"><span className="font-mono text-xs text-muted-foreground">{r.code}</span><StatusBadge status={r.status} /></div>
                  <p className="mt-1 font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.department?.name} · {r.type?.name} · {r.requester?.full_name}</p>
                  <div className="mt-2 flex items-center justify-between text-xs"><PriorityBadge priority={r.priority} /><span className={cn(due.state === "overdue" && "text-destructive")}>{due.label}</span></div>
                </Link>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{total} solicitud{total === 1 ? "" : "es"}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Página anterior"><ChevronLeft className="size-4" /></Button>
              <span>Página {page + 1} de {pages}</span>
              <Button variant="outline" size="icon" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} aria-label="Página siguiente"><ChevronRight className="size-4" /></Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
