import { describe, expect, it } from "vitest";
import { canAccessPath, navForRole } from "../permissions";

describe("permisos de navegación", () => {
  it("el empleado no ve opciones administrativas", () => {
    const rutas = navForRole("empleado").map((i) => i.to);
    expect(rutas).toContain("/solicitudes/nueva");
    expect(rutas).toContain("/mis-solicitudes");
    expect(rutas).not.toContain("/admin/usuarios");
    expect(rutas).not.toContain("/admin/auditoria");
    expect(rutas).not.toContain("/solicitudes");
  });
  it("el responsable ve su panel y reportes pero no administración", () => {
    const rutas = navForRole("responsable").map((i) => i.to);
    expect(rutas).toContain("/panel-responsable");
    expect(rutas).toContain("/reportes");
    expect(rutas).not.toContain("/admin/usuarios");
  });
  it("el administrador ve todo", () => {
    const rutas = navForRole("admin").map((i) => i.to);
    for (const r of [
      "/admin/usuarios",
      "/admin/departamentos",
      "/admin/tipos",
      "/admin/auditoria",
      "/admin/configuracion",
      "/reportes",
    ])
      expect(rutas).toContain(r);
  });
  it("bloquea el acceso directo por URL", () => {
    expect(canAccessPath("empleado", "/admin/usuarios")).toBe(false);
    expect(canAccessPath("responsable", "/admin/auditoria")).toBe(false);
    expect(canAccessPath("empleado", "/reportes")).toBe(false);
    expect(canAccessPath("admin", "/admin/usuarios")).toBe(true);
  });
  it("permite abrir el detalle de una solicitud (lo valida RLS)", () => {
    expect(canAccessPath("empleado", "/solicitudes/abc-123")).toBe(true);
    expect(canAccessPath("empleado", "/solicitudes/nueva")).toBe(true);
  });
});
