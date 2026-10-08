import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { REQUEST_SELECT, type RequestListItem } from "@/lib/queries";
import { dueInfo, fmtDate } from "@/lib/time";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { EmptyState, ErrorState, PageHeader, TableSkeleton } from "@/components/states";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_app/panel-responsable")({ component: ResponsablePanel });

function List({ items }: { items: RequestListItem[] }) {
  if (!items.length)
    return <EmptyState title="Nada por aquí" description="No hay solicitudes en esta categoría." />;
  return (
    <div className="space-y-2">
      {items.map((r) => {
        const due = dueInfo(r);
        return (
          <Link
            key={r.id}
            to="/solicitudes/$id"
            params={{ id: r.id }}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 hover:bg-muted/40"
          >
            <div className="min-w-0">
              <p className="font-mono text-xs text-muted-foreground">{r.code}</p>
              <p className="truncate font-medium">{r.title}</p>
              <p className="text-xs text-muted-foreground">
                Solicitante: {r.requester?.full_name} · Creada {fmtDate(r.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <PriorityBadge priority={r.priority} />
              <StatusBadge status={r.status} />
              <span
                className={
                  due.state === "overdue"
                    ? "text-xs font-medium text-destructive"
                    : "text-xs text-muted-foreground"
                }
              >
                {due.label}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function ResponsablePanel() {
  const { userId, org } = useAuth();
  const q = useQuery({
    queryKey: ["panel-responsable", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select(REQUEST_SELECT)
        .eq("assignee_id", userId!)
        .order("due_at", { ascending: true })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as RequestListItem[];
    },
  });
  const all = q.data ?? [];
  const now = Date.now();
  const soonMs = (org?.due_soon_hours ?? 24) * 36e5;
  const open = all.filter((r) => ["pendiente", "asignada", "en_proceso"].includes(r.status));
  const groups = [
    { key: "asignadas", label: "Asignadas", items: all.filter((r) => r.status === "asignada") },
    { key: "proceso", label: "En proceso", items: all.filter((r) => r.status === "en_proceso") },
    { key: "pendientes", label: "Pendientes", items: all.filter((r) => r.status === "pendiente") },
    {
      key: "proximas",
      label: "Próximas a vencer",
      items: open.filter((r) => {
        const d = new Date(r.due_at).getTime();
        return d >= now && d < now + soonMs;
      }),
    },
    {
      key: "vencidas",
      label: "Vencidas",
      items: open.filter((r) => new Date(r.due_at).getTime() < now),
    },
    { key: "resueltas", label: "Resueltas", items: all.filter((r) => r.status === "resuelta") },
  ];

  return (
    <div>
      <PageHeader
        title="Panel del responsable"
        description="Gestione las solicitudes que tiene asignadas."
      />
      {q.isLoading ? (
        <TableSkeleton />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <Tabs defaultValue="asignadas">
          <TabsList className="mb-4 h-auto flex-wrap">
            {groups.map((g) => (
              <TabsTrigger key={g.key} value={g.key}>
                {g.label} ({g.items.length})
              </TabsTrigger>
            ))}
          </TabsList>
          {groups.map((g) => (
            <TabsContent key={g.key} value={g.key}>
              <Card>
                <CardContent className="p-4">
                  <List items={g.items} />
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
