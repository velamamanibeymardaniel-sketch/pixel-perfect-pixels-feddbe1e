import { describe, expect, it } from "vitest";
import { loginSchema, translateAuthError } from "../auth-schemas";
import { MAX_FILE_BYTES, newRequestSchema, safeFileName, validateFile, validateFiles } from "../request-schemas";
import { csvSafe, toCsv } from "../export";

const valid = { title: "Falla de impresora", request_type_id: "00000000-0000-0000-0002-000000000001", department_id: "00000000-0000-0000-0001-000000000001", priority: "media", description: "No imprime desde ayer" };

describe("validación de formularios", () => {
  it("login exige correo válido y contraseña", () => {
    expect(loginSchema.safeParse({ email: "", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "no-es-correo", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: " a@b.com ", password: "x" }).success).toBe(true);
  });
  it("traduce errores de autenticación", () => {
    expect(translateAuthError("Invalid login credentials")).toBe("Correo o contraseña incorrectos");
  });
  it("nueva solicitud: acepta datos válidos", () => {
    expect(newRequestSchema.safeParse(valid).success).toBe(true);
  });
  it("nueva solicitud: rechaza título corto, descripción corta, tipo vacío y prioridad inválida", () => {
    expect(newRequestSchema.safeParse({ ...valid, title: "ab" }).success).toBe(false);
    expect(newRequestSchema.safeParse({ ...valid, description: "hola" }).success).toBe(false);
    expect(newRequestSchema.safeParse({ ...valid, request_type_id: "" }).success).toBe(false);
    expect(newRequestSchema.safeParse({ ...valid, priority: "urgente" }).success).toBe(false);
  });
  it("archivos: límite de tamaño y cantidad", () => {
    const big = new File([new Uint8Array(1)], "grande.pdf");
    Object.defineProperty(big, "size", { value: MAX_FILE_BYTES + 1 });
    expect(validateFiles([big])).toMatch(/20 MB/);
    expect(validateFiles(Array.from({ length: 6 }, (_, i) => new File(["x"], `f${i}.txt`)))).toMatch(/Máximo/);
    expect(validateFiles([new File(["x"], "ok.txt")])).toBeNull();
  });
  it("normaliza nombres de archivo", () => {
    expect(safeFileName("Informe técnico (final).pdf")).toBe("Informe_tecnico_final_.pdf");
  });
  it("CSV escapa comillas", () => {
    expect(toCsv({ title: "t", head: ["a"], rows: [['di "hola"']] })).toBe('"a"\r\n"di ""hola"""');
  });
  it("CSV neutraliza fórmulas (=, +, -, @) para evitar inyección en Excel", () => {
    expect(csvSafe("=SUMA(A1:A2)")).toBe("'=SUMA(A1:A2)");
    expect(csvSafe("+591 70000000")).toBe("'+591 70000000");
    expect(csvSafe("@usuario")).toBe("'@usuario");
    expect(csvSafe("Texto normal")).toBe("Texto normal");
    expect(csvSafe(-5)).toBe("-5");
    expect(toCsv({ title: "t", head: ["a"], rows: [["=1+1"]] })).toBe('"a"\r\n"\'=1+1"');
  });
  it("archivos: rechaza vacíos, ejecutables y formatos no permitidos", () => {
    expect(validateFile({ name: "vacio.pdf", size: 0, type: "application/pdf" })).toMatch(/vacío/);
    expect(validateFile({ name: "virus.exe", size: 100, type: "application/x-msdownload" })).toMatch(/no es un tipo de archivo permitido/);
    expect(validateFile({ name: "script.sh", size: 100, type: "" })).toMatch(/no es un tipo/);
    expect(validateFile({ name: "falso.pdf", size: 100, type: "application/x-msdownload" })).toMatch(/formato no permitido/);
    expect(validateFile({ name: "sin-extension", size: 100, type: "" })).toMatch(/no es un tipo/);
  });
  it("archivos: acepta formatos permitidos sin distinguir mayúsculas", () => {
    expect(validateFile({ name: "Informe.PDF", size: 1024, type: "application/pdf" })).toBeNull();
    expect(validateFile({ name: "foto.JPG", size: 1024, type: "image/jpeg" })).toBeNull();
    expect(validateFile({ name: "datos.xlsx", size: 1024, type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })).toBeNull();
    expect(validateFile({ name: "nota.txt", size: 1, type: "" })).toBeNull();
  });
  it("traduce más errores de autenticación", () => {
    expect(translateAuthError("Email not confirmed")).toMatch(/confirmar/);
    expect(translateAuthError("User is banned")).toMatch(/desactivada/);
    expect(translateAuthError("Email rate limit exceeded")).toMatch(/Demasiados/);
    expect(translateAuthError("algo raro")).toMatch(/No se pudo iniciar sesión/);
  });
});
