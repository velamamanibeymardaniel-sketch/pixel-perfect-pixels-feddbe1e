import { Link } from "@tanstack/react-router";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { fmtDate, dueInfo } from "@/lib/time";
import type { RequestListItem } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** Lista compacta: tabla en pantallas grandes, tarjetas en móvil. */
export function RequestMiniList({ items }: { items: RequestListItem[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2 pr-3">Código</th>
              <th className="pr-3">Título</th>
              <th className="pr-3">Estado</th>
              <th className="pr-3">Prioridad</th>
              <th className="pr-3">Responsable</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="py-2 pr-3 font-mono text-xs">
                  <Link
                    to="/solicitudes/$id"
                    params={{ id: r.id }}
                    className="text-primary hover:underline"
                  >
                    {r.code}
                  </Link>
                </td>
                <td className="max-w-[18rem] truncate pr-3">{r.title}</td>
                <td className="pr-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="pr-3">
                  <PriorityBadge priority={r.priority} />
                </td>
                <td className="pr-3">
                  {r.assignee?.full_name ?? (
                    <span className="text-muted-foreground">Sin asignar</span>
                  )}
                </td>
                <td className="whitespace-nowrap">{fmtDate(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 md:hidden">
        {items.map((r) => {
          const due = dueInfo(r);
          return (
            <Link
              key={r.id}
              to="/solicitudes/$id"
              params={{ id: r.id }}
              className="block rounded-lg border p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-muted-foreground">{r.code}</span>
                <StatusBadge status={r.status} />
              </div>
              <p className="mt-1 font-medium">{r.title}</p>
              <div className="mt-2 flex items-center justify-between text-xs">
                <PriorityBadge priority={r.priority} />
                <span
                  className={cn(
                    due.state === "overdue" && "text-destructive",
                    due.state === "soon" && "text-warning-foreground",
                  )}
                >
                  {due.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
