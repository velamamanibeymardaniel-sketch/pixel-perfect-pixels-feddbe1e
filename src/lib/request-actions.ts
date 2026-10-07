import type { RequestStatus, RequestRow } from "./domain";
import { allowedTransitions } from "./domain";

export type StatusAction = { to: RequestStatus; label: string; needsComment: boolean; destructive?: boolean };

/** Etiqueta del botón según la transición. */
export function actionFor(from: RequestStatus, to: RequestStatus): StatusAction {
  if (to === "en_proceso") return { to, label: from === "resuelta" ? "Reabrir" : "Iniciar atención", needsComment: from === "resuelta" };
  if (to === "resuelta") return { to, label: "Resolver", needsComment: true };
  if (to === "cerrada") return { to, label: "Cerrar", needsComment: false };
  return { to: "cancelada", label: "Cancelar solicitud", needsComment: false, destructive: true };
}

export function availableActions(
  req: Pick<RequestRow, "status" | "assignee_id" | "requester_id">,
  userId: string,
  isAdmin: boolean,
  allowRequesterClose: boolean,
): StatusAction[] {
  return allowedTransitions(req, userId, isAdmin, allowRequesterClose).map((to) => actionFor(req.status, to));
}

/** Solo los administradores asignan; no se puede asignar una solicitud finalizada. */
export function canAssign(req: Pick<RequestRow, "status">, isAdmin: boolean): boolean {
  return isAdmin && req.status !== "cerrada" && req.status !== "cancelada";
}
