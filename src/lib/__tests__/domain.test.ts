import { describe, expect, it } from "vitest";
import {
  STATUSES,
  allowedTransitions,
  errorMessage,
  primaryRole,
  type RequestStatus,
} from "../domain";

const req = (status: RequestStatus) => ({ status, assignee_id: "resp", requester_id: "emp" });

describe("roles", () => {
  it("el rol principal prioriza admin > responsable > empleado", () => {
    expect(primaryRole(["empleado", "responsable", "admin"])).toBe("admin");
    expect(primaryRole(["empleado", "responsable"])).toBe("responsable");
    expect(primaryRole(["empleado"])).toBe("empleado");
    expect(primaryRole([])).toBe("empleado");
  });
});

describe("transiciones de estado", () => {
  it("el administrador solo tiene transiciones válidas desde cada estado", () => {
    expect(allowedTransitions(req("pendiente"), "adm", true, true)).toEqual(["cancelada"]);
    expect(allowedTransitions(req("asignada"), "adm", true, true).sort()).toEqual([
      "cancelada",
      "en_proceso",
    ]);
    expect(allowedTransitions(req("en_proceso"), "adm", true, true).sort()).toEqual([
      "cancelada",
      "resuelta",
    ]);
    expect(allowedTransitions(req("resuelta"), "adm", true, true).sort()).toEqual([
      "cerrada",
      "en_proceso",
    ]);
    expect(allowedTransitions(req("cerrada"), "adm", true, true)).toEqual([]);
    expect(allowedTransitions(req("cancelada"), "adm", true, true)).toEqual([]);
  });

  it("nunca se puede saltar etapas (pendiente→resuelta, asignada→cerrada, etc.)", () => {
    for (const from of STATUSES) {
      const to = allowedTransitions(req(from), "adm", true, true);
      expect(to).not.toContain(from);
    }
    expect(allowedTransitions(req("pendiente"), "adm", true, true)).not.toContain("resuelta");
    expect(allowedTransitions(req("asignada"), "adm", true, true)).not.toContain("cerrada");
    expect(allowedTransitions(req("en_proceso"), "adm", true, true)).not.toContain("cerrada");
  });

  it("el responsable asignado no puede cerrar ni cancelar; solo atender y resolver", () => {
    expect(allowedTransitions(req("asignada"), "resp", false, true)).toEqual(["en_proceso"]);
    expect(allowedTransitions(req("en_proceso"), "resp", false, true)).toEqual(["resuelta"]);
    expect(allowedTransitions(req("resuelta"), "resp", false, true)).toEqual(["en_proceso"]); // reabrir
  });

  it("un responsable que no es el asignado no puede cambiar nada", () => {
    for (const s of STATUSES)
      expect(allowedTransitions(req(s), "otro-resp", false, true)).toEqual([]);
  });

  it("el solicitante puede reabrir una solicitud resuelta", () => {
    expect(allowedTransitions(req("resuelta"), "emp", false, true)).toContain("en_proceso");
    expect(allowedTransitions(req("resuelta"), "emp", false, false)).toEqual(["en_proceso"]);
  });
});

describe("mensajes de error para el usuario", () => {
  it("muestra tal cual los mensajes de las funciones SQL (P0001)", () => {
    expect(
      errorMessage({ code: "P0001", message: "Transición no permitida: Pendiente → Cerrada" }),
    ).toBe("Transición no permitida: Pendiente → Cerrada");
  });
  it("traduce errores de permisos (RLS)", () => {
    expect(
      errorMessage({
        code: "42501",
        message: 'new row violates row-level security policy for table "x"',
      }),
    ).toMatch(/permisos/);
  });
  it("traduce duplicados y claves foráneas", () => {
    expect(
      errorMessage({
        code: "23505",
        message: 'duplicate key value violates unique constraint "x"',
      }),
    ).toMatch(/Ya existe/);
    expect(errorMessage({ code: "23503", message: "violates foreign key" })).toMatch(/relacionado/);
  });
  it("traduce errores de red y de sesión", () => {
    expect(errorMessage(new TypeError("Failed to fetch"))).toMatch(/conexión/);
    expect(errorMessage(new Error("Unauthorized: No authorization header provided"))).toMatch(
      /sesión/,
    );
  });
  it("no filtra detalles técnicos", () => {
    const m = errorMessage(
      new Error("TypeError: Cannot read properties of undefined (reading 'id')"),
    );
    expect(m).toBe("Ha ocurrido un error inesperado. Inténtelo nuevamente.");
    expect(errorMessage(undefined)).toBe("Ha ocurrido un error inesperado. Inténtelo nuevamente.");
    expect(errorMessage({ message: 'relation "public.x" does not exist' })).not.toMatch(/relation/);
  });
  it("conserva los mensajes de validación en español", () => {
    expect(errorMessage(new Error("Ya existe un usuario con ese correo"))).toBe(
      "Ya existe un usuario con ese correo",
    );
    expect(errorMessage(new Error('"informe.exe" no es un tipo de archivo permitido'))).toMatch(
      /no es un tipo/,
    );
  });
  it("permite un texto alternativo", () => {
    expect(
      errorMessage(null, "Ha ocurrido un error al crear la solicitud. Inténtelo nuevamente."),
    ).toMatch(/crear la solicitud/);
  });
});
