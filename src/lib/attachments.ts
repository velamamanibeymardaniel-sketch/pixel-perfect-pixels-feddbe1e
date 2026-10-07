import { supabase } from "@/integrations/supabase/client";
import { safeFileName, validateFile } from "@/lib/request-schemas";

/** Sube un archivo al bucket "attachments" (ruta: <request_id>/<uuid>-<nombre>) y registra la fila. */
export async function uploadAttachment(requestId: string, userId: string, file: File) {
  const invalid = validateFile(file);
  if (invalid) throw new Error(invalid);
  const path = `${requestId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error: upErr } = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type || undefined });
  if (upErr) throw upErr;
  const { error } = await supabase.from("attachments").insert({
    request_id: requestId,
    uploaded_by: userId,
    file_name: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
    storage_path: path,
  });
  if (error) {
    await supabase.storage.from("attachments").remove([path]);
    throw error;
  }
}

export async function downloadAttachment(path: string, fileName: string) {
  const { data, error } = await supabase.storage.from("attachments").createSignedUrl(path, 60, { download: fileName });
  if (error || !data) throw error ?? new Error("No se pudo generar el enlace de descarga");
  window.open(data.signedUrl, "_blank", "noopener");
}
