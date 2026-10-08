import { describe, expect, it } from "vitest";
import { availableActions, canAssign } from "../request-actions";
import type { RequestStatus } from "../domain";

const req = (status: RequestStatus) => ({ status, assignee_id: "resp", requester_id: "emp" });
const labels = (status: RequestStatus, uid: string, admin = false, close = true) =>
  availableActions(req(status), uid, admin, close).map((a) => a.label);

describe("flujo de estados", () => {
  it("el solicitante solo puede cancelar mientras está pendiente o asignada", () => {
    expect(labels("pendiente", "emp")).toEqual(["Cancelar solicitud"]);
    expect(labels("asignada", "emp")).toEqual(["Cancelar solicitud"]);
    expect(labels("en_proceso", "emp")).toEqual([]);
  });
  it("el responsable inicia atención y resuelve", () => {
    expect(labels("asignada", "resp")).toEqual(["Iniciar atención"]);
    expect(labels("en_proceso", "resp")).toEqual(["Resolver"]);
  });
  it("tras resolver: el solicitante puede cerrar o reabrir", () => {
    expect(labels("resuelta", "emp").sort()).toEqual(["Cerrar", "Reabrir"]);
  });
  it("respeta allow_requester_close", () => {
    expect(labels("resuelta", "emp", false, false)).toEqual(["Reabrir"]);
  });
  it("estados finales no tienen acciones, ni siquiera para el administrador", () => {
    expect(labels("cerrada", "admin1", true)).toEqual([]);
    expect(labels("cancelada", "admin1", true)).toEqual([]);
  });
  it("un tercero no ve acciones", () => {
    expect(labels("en_proceso", "otro")).toEqual([]);
  });
  it("resolver exige comentario", () => {
    const a = availableActions(req("en_proceso"), "resp", false, true)[0];
    expect(a?.needsComment).toBe(true);
  });
  it("solo el administrador asigna y no en estados finales", () => {
    expect(canAssign({ status: "pendiente" }, true)).toBe(true);
    expect(canAssign({ status: "pendiente" }, false)).toBe(false);
    expect(canAssign({ status: "cerrada" }, true)).toBe(false);
  });
  it("el responsable asignado puede reabrir una solicitud resuelta pero no cerrarla", () => {
    expect(labels("resuelta", "resp")).toEqual(["Reabrir"]);
  });
  it("el administrador puede cancelar una solicitud en proceso y asignar en cualquier estado abierto", () => {
    expect(labels("en_proceso", "admin1", true)).toContain("Cancelar solicitud");
    expect(canAssign({ status: "en_proceso" }, true)).toBe(true);
    expect(canAssign({ status: "resuelta" }, true)).toBe(true);
    expect(canAssign({ status: "cancelada" }, true)).toBe(false);
  });
  it("reabrir pide un motivo y resolver exige descripción", () => {
    const reabrir = availableActions(req("resuelta"), "emp", false, true).find(
      (a) => a.label === "Reabrir",
    );
    expect(reabrir?.needsComment).toBe(true);
    expect(availableActions(req("en_proceso"), "resp", false, true)[0]?.label).toBe("Resolver");
  });
});
