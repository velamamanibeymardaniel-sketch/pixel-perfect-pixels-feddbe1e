import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type RequestStatus = Database["public"]["Enums"]["request_status"];
export type RequestPriority = Database["public"]["Enums"]["request_priority"];
export type RequestRow = Database["public"]["Tables"]["requests"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Department = Database["public"]["Tables"]["departments"]["Row"];
export type RequestType = Database["public"]["Tables"]["request_types"]["Row"];
export type Organization = Database["public"]["Tables"]["organizations"]["Row"];

export const STATUSES: RequestStatus[] = [
  "pendiente",
  "asignada",
  "en_proceso",
  "resuelta",
  "cerrada",
  "cancelada",
];
export const OPEN_STATUSES: RequestStatus[] = ["pendiente", "asignada", "en_proceso"];

export const STATUS_LABEL: Record<RequestStatus, string> = {
  pendiente: "Pendiente",
  asignada: "Asignada",
  en_proceso: "En proceso",
  resuelta: "Resuelta",
  cerrada: "Cerrada",
  cancelada: "Cancelada",
};

export const PRIORITIES: RequestPriority[] = ["baja", "media", "alta", "critica"];
export const PRIORITY_LABEL: Record<RequestPriority, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  critica: "Crítica",
};

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrador",
  responsable: "Responsable",
  empleado: "Empleado",
};

export function primaryRole(roles: AppRole[]): AppRole {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("responsable")) return "responsable";
  return "empleado";
}

/** Status transitions allowed by the database rules, per actor. */
export function allowedTransitions(
  req: Pick<RequestRow, "status" | "assignee_id" | "requester_id">,
  userId: string,
  isAdmin: boolean,
  allowRequesterClose: boolean,
): RequestStatus[] {
  const s = req.status;
  const base: Record<RequestStatus, RequestStatus[]> = {
    pendiente: ["cancelada"],
    asignada: ["en_proceso", "cancelada"],
    en_proceso: ["resuelta", "cancelada"],
    resuelta: ["cerrada", "en_proceso"],
    cerrada: [],
    cancelada: [],
  };
  return base[s].filter((to) => {
    if (isAdmin) return true;
    const isAssignee = req.assignee_id === userId;
    const isRequester = req.requester_id === userId;
    if ((to === "en_proceso" || to === "resuelta") && s !== "resuelta" && isAssignee) return true;
    if (to === "cerrada" && isRequester && allowRequesterClose) return true;
    if (to === "en_proceso" && s === "resuelta" && (isRequester || isAssignee)) return true;
    if (to === "cancelada" && isRequester && (s === "pendiente" || s === "asignada")) return true;
    return false;
  });
}

const TECHNICAL = /(fetch|network|jwt|token|unauthorized|supabase|postgres|postgrest|violates|relation |column |syntax|undefined|null value|typeerror|referenceerror|econn|timeout|internal server|status code|cannot read|is not a function)/i;

/**
 * Convierte cualquier error en un mensaje comprensible para el usuario.
 * - Las excepciones que lanzan las funciones SQL (código P0001) ya están redactadas en español y se muestran tal cual.
 * - Los errores técnicos (RLS, restricciones, red, sesión) se traducen a un texto genérico.
 */
export function errorMessage(e: unknown, fallback = "Ha ocurrido un error inesperado. Inténtelo nuevamente."): string {
  if (!e || typeof e !== "object") return fallback;
  const { code, message, statusCode } = e as { code?: unknown; message?: unknown; statusCode?: unknown };
  const msg = typeof message === "string" ? message.trim() : "";
  if (code === "P0001" && msg) return msg;
  if (code === "42501" || /row-level security|permission denied/i.test(msg)) return "No tiene permisos para realizar esta acción.";
  if (code === "23505" || /duplicate key/i.test(msg)) return "Ya existe un registro con esos datos.";
  if (code === "23503") return "No se puede completar la operación porque el registro está relacionado con otros datos.";
  if (code === "23514" || code === "22001" || code === "22P02") return "Alguno de los datos ingresados no es válido.";
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) return "No hay conexión con el servidor. Revise su conexión a internet.";
  if (/jwt|token|not authenticated|unauthorized/i.test(msg) || statusCode === 401) return "Su sesión expiró. Inicie sesión nuevamente.";
  if (/payload too large|exceeded the maximum allowed size/i.test(msg)) return "El archivo supera el tamaño máximo permitido.";
  if (/mime type|not supported/i.test(msg)) return "El tipo de archivo no está permitido.";
  if (!msg || TECHNICAL.test(msg)) return fallback;
  return msg;
}
