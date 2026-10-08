import { z } from "zod";

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_FILES = 5;

export const newRequestSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "El título debe tener al menos 3 caracteres")
    .max(200, "Máximo 200 caracteres"),
  request_type_id: z.string().uuid("Seleccione un tipo de solicitud"),
  department_id: z.string().uuid("Seleccione un departamento"),
  priority: z.enum(["baja", "media", "alta", "critica"]),
  description: z
    .string()
    .trim()
    .min(5, "La descripción es demasiado corta")
    .max(5000, "Máximo 5000 caracteres"),
});
export type NewRequestInput = z.infer<typeof newRequestSchema>;

/** Extensiones permitidas para adjuntos (documentos, hojas de cálculo, imágenes y texto). */
export const ALLOWED_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "txt",
  "csv",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "zip",
] as const;

/** Tipos MIME permitidos; deben coincidir con `allowed_mime_types` del bucket (migración 0003). */
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/zip",
  "application/x-zip-compressed",
] as const;

export const ALLOWED_ACCEPT = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",");

export function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

/** Valida un archivo individual. Devuelve un mensaje de error o null si es válido. */
export function validateFile(f: Pick<File, "name" | "size" | "type">): string | null {
  if (f.size === 0) return `"${f.name}" está vacío`;
  if (f.size > MAX_FILE_BYTES) return `"${f.name}" supera el límite de 20 MB`;
  const ext = fileExtension(f.name);
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    return `"${f.name}" no es un tipo de archivo permitido (${ALLOWED_EXTENSIONS.join(", ")})`;
  }
  if (f.type && !(ALLOWED_MIME_TYPES as readonly string[]).includes(f.type)) {
    return `"${f.name}" tiene un formato no permitido`;
  }
  return null;
}

export function validateFiles(files: File[]): string | null {
  if (files.length > MAX_FILES) return `Máximo ${MAX_FILES} archivos por solicitud`;
  for (const f of files) {
    const err = validateFile(f);
    if (err) return err;
  }
  return null;
}

export function safeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(-120);
}
