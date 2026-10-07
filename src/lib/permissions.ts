import type { AppRole } from "./domain";

export type NavItem = { to: string; label: string; icon: string; roles: AppRole[]; group: "principal" | "admin" };

export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: "layout-dashboard", roles: ["empleado", "responsable", "admin"], group: "principal" },
  { to: "/solicitudes", label: "Solicitudes", icon: "inbox", roles: ["responsable", "admin"], group: "principal" },
  { to: "/mis-solicitudes", label: "Mis solicitudes", icon: "file-text", roles: ["empleado", "responsable", "admin"], group: "principal" },
  { to: "/solicitudes/nueva", label: "Nueva solicitud", icon: "plus-circle", roles: ["empleado", "responsable", "admin"], group: "principal" },
  { to: "/panel-responsable", label: "Panel del responsable", icon: "user-check", roles: ["responsable", "admin"], group: "principal" },
  { to: "/notificaciones", label: "Notificaciones", icon: "bell", roles: ["empleado", "responsable", "admin"], group: "principal" },
  { to: "/perfil", label: "Perfil", icon: "user", roles: ["empleado", "responsable", "admin"], group: "principal" },
  { to: "/admin/usuarios", label: "Usuarios", icon: "users", roles: ["admin"], group: "admin" },
  { to: "/admin/departamentos", label: "Departamentos", icon: "building", roles: ["admin"], group: "admin" },
  { to: "/admin/tipos", label: "Tipos de solicitud", icon: "tags", roles: ["admin"], group: "admin" },
  { to: "/admin/configuracion", label: "Configuración", icon: "settings", roles: ["admin"], group: "admin" },
  { to: "/reportes", label: "Reportes", icon: "bar-chart", roles: ["responsable", "admin"], group: "admin" },
  { to: "/admin/auditoria", label: "Auditoría", icon: "shield", roles: ["admin"], group: "admin" },
];

export function navForRole(role: AppRole): NavItem[] {
  return NAV_ITEMS.filter((i) => i.roles.includes(role));
}

/** Rutas de /admin/* solo para administradores. */
export function canAccessPath(role: AppRole, path: string): boolean {
  const item = [...NAV_ITEMS].sort((a, b) => b.to.length - a.to.length).find((i) => path === i.to || path.startsWith(i.to + "/"));
  if (!item) return true;
  if (path.startsWith("/solicitudes/") && path !== "/solicitudes/nueva") return true; // detalle: lo valida RLS
  return item.roles.includes(role);
}
