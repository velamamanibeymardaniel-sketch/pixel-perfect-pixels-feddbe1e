import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, CheckCircle2, Clock, FileStack, Hourglass, Loader, Lock, UserCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useDashboardStats, useRequestList } from "@/lib/queries";
import { PRIORITIES, PRIORITY_LABEL, ROLE_LABEL, STATUSES, STATUS_LABEL } from "@/lib/domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState, ErrorState } from "@/components/states";
import { RequestMiniList } from "@/components/request-table";
import { fmtHours } from "@/lib/time";

export const Route = createFileRoute("/_app/dashboard")({ component: DashboardPage });

const statusColor = (s: string) => `var(--status-${s})`;

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: number | string; icon: React.ComponentType<{ className?: string }>; tone?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-semibold">{value}</p>
        </div>
        <Icon className="size-8 opacity-70" style={tone ? { color: tone } : undefined} />
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, children, empty }: { title: string; children: React.ReactNode; empty: boolean }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="h-64">
        {empty ? <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sin datos para mostrar</div> : <ResponsiveContainer width="100%" height="100%">{children as React.ReactElement}</ResponsiveContainer>}
      </CardContent>
    </Card>
  );
}

function DashboardPage() {
  const { profile, role, userId, org } = useAuth();
  const stats = useDashboardStats();
  const recent = useRequestList({ key: "recent", limit: 6, ...(role === "empleado" ? { requesterId: userId! } : role === "responsable" ? { assigneeId: userId! } : {}) });
  const nowIso = new Date().toISOString();
  const scope = role === "empleado" ? { requesterId: userId! } : role === "responsable" ? { assigneeId: userId! } : {};
  const overdue = useRequestList({ key: "overdue", openOnly: true, dueBefore: nowIso, limit: 5, order: { column: "due_at", ascending: true }, ...scope });
  const soonLimit = new Date(Date.now() + (org?.due_soon_hours ?? 24) * 36e5).toISOString();
  const soon = useRequestList({ key: "soon", openOnly: true, dueAfter: nowIso, dueBefore: soonLimit, limit: 5, order: { column: "due_at", ascending: true }, ...scope });

  const s = stats.data;
  const byStatus = s ? STATUSES.map((k) => ({ key: k, name: STATUS_LABEL[k], value: s.by_status[k] ?? 0 })).filter((x) => x.value > 0) : [];
  const byPriority = s ? PRIORITIES.map((k) => ({ key: k, name: PRIORITY_LABEL[k], value: s.by_priority[k] ?? 0 })) : [];

  return (
    <div>
      <PageHeader
        title={`Hola, ${profile?.full_name.split(" ")[0] ?? ""}`}
        description={role === "empleado" ? "Resumen de sus solicitudes." : role === "responsable" ? "Resumen de las solicitudes asignadas a usted." : `Vista general de la organización · ${ROLE_LABEL[role]}`}
        actions={<Button asChild><Link to="/solicitudes/nueva">Nueva solicitud</Link></Button>}
      />
      {stats.isError ? <ErrorState error={stats.error} onRetry={() => stats.refetch()} /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {!s ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />) : (
              <>
                <Kpi label="Total" value={s.total} icon={FileStack} />
                <Kpi label="Pendientes" value={s.by_status.pendiente ?? 0} icon={Hourglass} tone={statusColor("pendiente")} />
                <Kpi label="Asignadas" value={s.by_status.asignada ?? 0} icon={UserCheck} tone={statusColor("asignada")} />
                <Kpi label="En proceso" value={s.by_status.en_proceso ?? 0} icon={Loader} tone={statusColor("en_proceso")} />
                <Kpi label="Resueltas" value={s.by_status.resuelta ?? 0} icon={CheckCircle2} tone={statusColor("resuelta")} />
                <Kpi label="Cerradas" value={s.by_status.cerrada ?? 0} icon={Lock} tone={statusColor("cerrada")} />
                <Kpi label="Vencidas" value={s.overdue} icon={AlertTriangle} tone="var(--destructive)" />
                <Kpi label="Próximas a vencer" value={s.due_soon} icon={Clock} tone="var(--warning)" />
              </>
            )}
          </div>
          {s && (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Card><CardContent className="p-4 text-sm"><span className="text-muted-foreground">Tiempo medio de asignación: </span><b>{fmtHours(s.avg_response_hours)}</b></CardContent></Card>
              <Card><CardContent className="p-4 text-sm"><span className="text-muted-foreground">Tiempo medio de resolución: </span><b>{fmtHours(s.avg_resolution_hours)}</b></CardContent></Card>
              <Card><CardContent className="p-4 text-sm"><span className="text-muted-foreground">Tiempo medio de atención: </span><b>{fmtHours(s.avg_attention_hours)}</b></CardContent></Card>
            </div>
          )}
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <ChartCard title="Solicitudes por estado" empty={!s || byStatus.length === 0}>
              <PieChart><Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>{byStatus.map((d) => <Cell key={d.key} fill={statusColor(d.key)} />)}</Pie><Tooltip /><Legend /></PieChart>
            </ChartCard>
            <ChartCard title="Solicitudes por prioridad" empty={!s || s.total === 0}>
              <BarChart data={byPriority}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" name="Solicitudes" radius={[4, 4, 0, 0]}>{byPriority.map((d) => <Cell key={d.key} fill={`var(--prio-${d.key})`} />)}</Bar></BarChart>
            </ChartCard>
            <ChartCard title="Solicitudes por departamento" empty={!s || s.by_department.length === 0}>
              <BarChart data={s?.by_department ?? []} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={110} /><Tooltip /><Bar dataKey="value" name="Solicitudes" fill="var(--chart-1)" radius={[0, 4, 4, 0]} /></BarChart>
            </ChartCard>
            <ChartCard title="Solicitudes por tipo" empty={!s || s.by_type.length === 0}>
              <BarChart data={s?.by_type ?? []} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={130} /><Tooltip /><Bar dataKey="value" name="Solicitudes" fill="var(--chart-4)" radius={[0, 4, 4, 0]} /></BarChart>
            </ChartCard>
            <div className="lg:col-span-2">
              <ChartCard title="Evolución en el tiempo" empty={!s || s.timeline.length === 0}>
                <LineChart data={s?.timeline ?? []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Line type="monotone" dataKey="created" name="Creadas" stroke="var(--chart-1)" strokeWidth={2} /><Line type="monotone" dataKey="resolved" name="Resueltas" stroke="var(--chart-3)" strokeWidth={2} /></LineChart>
              </ChartCard>
            </div>
          </div>
        </>
      )}
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">Solicitudes recientes</CardTitle><Button asChild variant="ghost" size="sm"><Link to={role === "empleado" ? "/mis-solicitudes" : "/solicitudes"}>Ver todas</Link></Button></CardHeader>
          <CardContent>
            {recent.isLoading ? <Skeleton className="h-32" /> : recent.isError ? <ErrorState error={recent.error} onRetry={() => recent.refetch()} /> : recent.data?.length ? <RequestMiniList items={recent.data} /> : <EmptyState title="Aún no hay solicitudes" description="Cuando se registre una solicitud aparecerá aquí." />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Próximas a vencer</CardTitle></CardHeader>
          <CardContent>{soon.isLoading ? <Skeleton className="h-24" /> : soon.data?.length ? <RequestMiniList items={soon.data} /> : <EmptyState title="Sin solicitudes próximas a vencer" />}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base text-destructive">Vencidas</CardTitle></CardHeader>
          <CardContent>{overdue.isLoading ? <Skeleton className="h-24" /> : overdue.data?.length ? <RequestMiniList items={overdue.data} /> : <EmptyState title="No hay solicitudes vencidas" />}</CardContent>
        </Card>
      </div>
    </div>
  );
}
