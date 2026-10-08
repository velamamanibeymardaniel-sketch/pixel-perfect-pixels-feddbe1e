import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { STATUSES, allowedTransitions, type RequestStatus } from "../domain";

/**
 * Pruebas de contrato entre el frontend y las migraciones SQL (no requieren base de datos).
 * Garantizan que las reglas de negocio de la interfaz no se desalineen de las que aplica Supabase.
 */
const root = process.cwd();
const sql = (f: string) =>
  readFileSync(path.join(root, "drizzle/migrations", f), "utf8").replace(/\r\n/g, "\n");
const BASE = sql("0000_base_schema.sql");
const SCOPING = sql("0001_request_scoping_and_attachment_events.sql");
const HARDENING = sql("0003_security_hardening.sql");

function fnBody(source: string, name: string): string {
  const start = source.indexOf(`FUNCTION public.${name}(`);
  expect(start, `no se encontró la función ${name}`).toBeGreaterThan(-1);
  const open = source.indexOf("$$", start);
  const close = source.indexOf("$$", open + 2);
  return source.slice(start, close);
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(f)) acc.push(p);
  }
  return acc;
}

describe("transiciones: la interfaz coincide con change_request_status (SQL)", () => {
  const body = fnBody(BASE, "change_request_status");
  const block = body.slice(
    body.indexOf("IF NOT ((_old="),
    body.indexOf("THEN\n    RAISE EXCEPTION 'Transición"),
  );
  const sqlMap = new Map<RequestStatus, RequestStatus[]>();
  for (const m of block.matchAll(/_old='(\w+)' AND _new_status(?: IN \(([^)]*)\)|='(\w+)')/g)) {
    const to = (
      m[2] ? m[2].split(",").map((x) => x.trim().replace(/'/g, "")) : [m[3]!]
    ) as RequestStatus[];
    sqlMap.set(m[1] as RequestStatus, to);
  }

  it("el SQL define transiciones desde los cuatro estados no finales", () => {
    expect([...sqlMap.keys()].sort()).toEqual(["asignada", "en_proceso", "pendiente", "resuelta"]);
  });

  it.each(STATUSES)("estado %s", (from) => {
    const ts = allowedTransitions(
      { status: from, assignee_id: "a", requester_id: "r" },
      "admin",
      true,
      true,
    ).sort();
    const expected = (sqlMap.get(from) ?? []).slice().sort();
    expect(ts).toEqual(expected);
  });
});

describe("cada acción importante registra historial, notificación y auditoría", () => {
  it.each([
    ["create_request", BASE, ["request_status_history", "_notify(", "_audit("]],
    ["assign_request", BASE, ["request_status_history", "_notify(", "_audit("]],
    ["change_request_status", BASE, ["request_status_history", "_notify(", "_audit("]],
    ["change_request_priority", BASE, ["request_status_history", "_audit("]],
    ["add_request_comment", BASE, ["request_status_history", "_notify(", "_audit("]],
  ])("%s", (fn, source, needles) => {
    const body = fnBody(source, fn);
    for (const n of needles) expect(body).toContain(n);
  });

  it("subir un archivo registra historial y notifica (trigger)", () => {
    const body = fnBody(SCOPING, "on_attachment_added");
    expect(body).toContain("request_status_history");
    expect(body).toContain("_notify(");
  });

  it("existen avisos de vencimiento y de próximo vencimiento", () => {
    const body = fnBody(BASE, "refresh_due_alerts");
    expect(body).toContain("'vencida'");
    expect(body).toContain("'proxima_vencer'");
  });
});

describe("seguridad en la base de datos", () => {
  it("las funciones de negocio exigen permisos y aislan por organización", () => {
    expect(fnBody(BASE, "assign_request")).toContain("is_org_admin()");
    expect(fnBody(BASE, "change_request_priority")).toContain("is_org_admin()");
    expect(fnBody(BASE, "update_request_due") + HARDENING).toContain("is_org_admin()");
    expect(fnBody(BASE, "change_request_status")).toContain("can_access_request");
  });

  it("el responsable solo accede a las solicitudes asignadas (0001 reemplaza la política)", () => {
    const access = fnBody(SCOPING, "can_access_request");
    expect(access).not.toContain("'responsable'");
    expect(SCOPING).toContain('DROP POLICY IF EXISTS "role scoped read requests"');
    const policy = SCOPING.slice(SCOPING.indexOf('CREATE POLICY "role scoped read requests"'));
    expect(policy.slice(0, 400)).not.toContain("'responsable'");
  });

  it("todas las tablas tienen RLS activado", () => {
    const tables = [...BASE.matchAll(/CREATE TABLE public\.(\w+)/g)].map((m) => m[1]);
    expect(tables.length).toBeGreaterThanOrEqual(12);
    for (const t of tables)
      expect(BASE, `RLS en ${t}`).toContain(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY`);
  });

  it("los roles solo son modificables por el servidor (sin INSERT/UPDATE/DELETE para authenticated)", () => {
    expect(BASE).toContain("GRANT SELECT ON public.user_roles TO authenticated");
    expect(BASE).not.toMatch(
      /GRANT[^;]*(INSERT|UPDATE|DELETE)[^;]*ON public\.user_roles TO authenticated/,
    );
  });

  it("la auditoría solo es legible por administradores y no tiene escritura directa", () => {
    expect(BASE).toContain("GRANT SELECT ON public.audit_logs TO authenticated");
    expect(BASE).toMatch(/CREATE POLICY "admins read audit"[^;]*is_org_admin\(\)/);
  });

  it("un usuario no puede cambiar su organización, correo, departamento ni estado activo", () => {
    const guard = fnBody(BASE, "guard_profile_update");
    for (const col of ["organization_id", "is_active", "email", "department_id"])
      expect(guard).toContain(`NEW.${col}`);
  });

  it("el alta de usuarios toma la organización de app_metadata (0003)", () => {
    const body = fnBody(HARDENING, "handle_new_user");
    expect(body).toContain("raw_app_meta_data->>'organization_id'");
    expect(body).not.toContain("raw_user_meta_data->>'organization_id'");
  });

  it("los adjuntos exigen que la ruta empiece por el id de la solicitud y limitan los tipos MIME", () => {
    expect(HARDENING).toContain("split_part(storage_path, '/', 1) = request_id::text");
    expect(HARDENING).toContain("allowed_mime_types");
  });
});

describe("la service role key nunca llega al navegador", () => {
  const files = walk(path.join(root, "src"));

  it("solo se referencia en client.server.ts", () => {
    const offenders = files
      .filter((f) => !f.endsWith("client.server.ts") && !f.includes("__tests__"))
      .filter((f) => /SERVICE_ROLE/.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => path.relative(root, f))).toEqual([]);
  });

  it("client.server.ts solo se importa de forma dinámica dentro de funciones de servidor", () => {
    const importers = files
      .filter((f) => !f.endsWith("client.server.ts") && !f.includes("__tests__"))
      .filter((f) => /client\.server/.test(readFileSync(f, "utf8")));
    for (const f of importers) {
      const src = readFileSync(f, "utf8");
      expect(src, path.relative(root, f)).not.toMatch(/^import[^;]*client\.server/m);
      expect(path.relative(root, f)).toBe(path.join("src", "lib", "users.functions.ts"));
    }
  });

  it("las funciones administrativas validan el rol de administrador en el servidor", () => {
    const src = readFileSync(path.join(root, "src/lib/users.functions.ts"), "utf8");
    expect(src).toContain("requireSupabaseAuth");
    expect((src.match(/requireAdmin\(context as Ctx\)/g) ?? []).length).toBe(3);
  });

  it(".env.example no define la service role con prefijo VITE_", () => {
    const env = readFileSync(path.join(root, ".env.example"), "utf8");
    expect(env).not.toMatch(/VITE_[A-Z_]*SERVICE_ROLE/);
  });
});

describe("interfaz en español", () => {
  it("la página de error del servidor está en español", async () => {
    const { renderErrorPage } = await import("../error-page");
    const html = renderErrorPage();
    expect(html).toContain('lang="es"');
    expect(html).not.toMatch(/Something went wrong|This page didn't load|Try again|Go home/);
  });

  it("no quedan textos de desarrollo en el código", () => {
    const bad =
      /Your app will live here|Something went wrong on our end|Connect Supabase in Lovable/i;
    const offenders = walk(path.join(root, "src"))
      .filter((f) => !f.includes("__tests__") && !f.includes(path.join("integrations", "supabase")))
      .filter((f) => bad.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => path.relative(root, f))).toEqual([]);
  });
});
