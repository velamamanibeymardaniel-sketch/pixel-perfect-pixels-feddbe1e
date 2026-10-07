import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Se comparan rutas sin ejecutar loaders ni renderizar (no requiere red).
const router = () => createRouter({ routeTree, context: { queryClient: new QueryClient() } });
const match = (path: string) => router().matchRoutes(path).at(-1)?.routeId;

describe("Rutas de la aplicación", () => {
  it.each([
    ["/", "/"],
    ["/login", "/login"],
    ["/reset-password", "/reset-password"],
    ["/dashboard", "/_app/dashboard"],
    ["/mis-solicitudes", "/_app/mis-solicitudes"],
    ["/solicitudes", "/_app/solicitudes/"],
    ["/solicitudes/nueva", "/_app/solicitudes/nueva"],
    ["/solicitudes/123", "/_app/solicitudes/$id"],
    ["/notificaciones", "/_app/notificaciones"],
    ["/perfil", "/_app/perfil"],
    ["/panel-responsable", "/_app/panel-responsable"],
    ["/reportes", "/_app/reportes"],
    ["/admin/usuarios", "/_app/admin/usuarios"],
    ["/admin/departamentos", "/_app/admin/departamentos"],
    ["/admin/tipos", "/_app/admin/tipos"],
    ["/admin/auditoria", "/_app/admin/auditoria"],
    ["/admin/configuracion", "/_app/admin/configuracion"],
  ])("%s resuelve a %s", (path, id) => {
    expect(match(path)).toBe(id);
  });

  it("una ruta inexistente cae en la raíz (404)", () => {
    expect(match("/no-existe")).toBe(rootRouteId);
  });

  it("las rutas privadas están bajo el layout protegido /_app", () => {
    const ids = router().matchRoutes("/admin/usuarios").map((m) => m.routeId);
    expect(ids).toContain("/_app");
  });
});
