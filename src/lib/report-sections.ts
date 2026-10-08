import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL } from "@/lib/domain";
import { fmtHours } from "@/lib/time";
import type { DashboardStats } from "@/lib/queries";
import type { ReportSection } from "@/lib/export";

export function buildSections(s: DashboardStats): ReportSection[] {
  return [
    {
      title: "Por estado",
      head: ["Estado", "Solicitudes"],
      rows: STATUSES.map((k) => [STATUS_LABEL[k], s.by_status[k] ?? 0]),
    },
    {
      title: "Por prioridad",
      head: ["Prioridad", "Solicitudes"],
      rows: PRIORITIES.map((k) => [PRIORITY_LABEL[k], s.by_priority[k] ?? 0]),
    },
    {
      title: "Por departamento",
      head: ["Departamento", "Solicitudes"],
      rows: s.by_department.map((d) => [d.name, d.value]),
    },
    {
      title: "Por tipo",
      head: ["Tipo", "Solicitudes"],
      rows: s.by_type.map((d) => [d.name, d.value]),
    },
    {
      title: "Por responsable",
      head: ["Responsable", "Total", "Abiertas", "Resueltas"],
      rows: s.by_assignee.map((a) => [a.name, a.value, a.open, a.resolved]),
    },
    {
      title: "Tiempos",
      head: ["Indicador", "Valor"],
      rows: [
        ["Vencidas (abiertas)", s.overdue],
        ["Próximas a vencer", s.due_soon],
        ["Tiempo medio de asignación", fmtHours(s.avg_response_hours)],
        ["Tiempo medio de atención", fmtHours(s.avg_attention_hours)],
        ["Tiempo medio de resolución", fmtHours(s.avg_resolution_hours)],
      ],
    },
  ];
}
