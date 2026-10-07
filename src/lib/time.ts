import { format, formatDistanceStrict, differenceInHours, isTomorrow } from "date-fns";
import { es } from "date-fns/locale";
import type { RequestRow } from "./domain";
import { OPEN_STATUSES } from "./domain";

export function fmtDateTime(d?: string | null) {
  if (!d) return "—";
  return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: es });
}
export function fmtDate(d?: string | null) {
  if (!d) return "—";
  return format(new Date(d), "dd/MM/yyyy", { locale: es });
}
export function ago(d: string) {
  return formatDistanceStrict(new Date(d), new Date(), { locale: es, addSuffix: true });
}

export type DueState = "ok" | "soon" | "overdue" | "done";

export function dueInfo(
  r: Pick<RequestRow, "status" | "due_at" | "resolved_at">,
  dueSoonHours = 24,
): { state: DueState; label: string } {
  const due = new Date(r.due_at);
  const now = new Date();
  if (!OPEN_STATUSES.includes(r.status)) {
    if (r.resolved_at) {
      const late = new Date(r.resolved_at) > due;
      return { state: "done", label: late ? "Resuelta fuera de plazo" : "Resuelta a tiempo" };
    }
    return { state: "done", label: "Finalizada" };
  }
  if (due < now) {
    return {
      state: "overdue",
      label: `Vencida hace ${formatDistanceStrict(due, now, { locale: es })}`,
    };
  }
  const hours = differenceInHours(due, now);
  const label = isTomorrow(due)
    ? `Vence mañana ${format(due, "HH:mm")}`
    : `Vence en ${formatDistanceStrict(now, due, { locale: es })}`;
  return { state: hours < dueSoonHours ? "soon" : "ok", label };
}

export function hoursBetween(a?: string | null, b?: string | null) {
  if (!a || !b) return null;
  return (new Date(b).getTime() - new Date(a).getTime()) / 36e5;
}

export function fmtHours(h: number | null | undefined) {
  if (h === null || h === undefined || Number.isNaN(h)) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} días`;
}
