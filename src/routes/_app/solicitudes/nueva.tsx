import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useDepartments, useRequestTypes } from "@/lib/queries";
import { PRIORITIES, PRIORITY_LABEL, errorMessage, type RequestPriority } from "@/lib/domain";
import { ALLOWED_ACCEPT, MAX_FILES, newRequestSchema, validateFiles } from "@/lib/request-schemas";
import { uploadAttachment } from "@/lib/attachments";
import { PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_app/solicitudes/nueva")({ component: NewRequestPage });

function NewRequestPage() {
  const { userId, profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const deps = useDepartments(true);
  const types = useRequestTypes(true);
  const [form, setForm] = useState({
    title: "",
    request_type_id: "",
    department_id: profile?.department_id ?? "",
    priority: "media" as RequestPriority,
    description: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("create_request", {
        _title: form.title,
        _description: form.description,
        _request_type_id: form.request_type_id,
        _department_id: form.department_id,
        _priority: form.priority,
      });
      if (error) throw error;
      const req = data as { id: string; code: string };
      const failed: string[] = [];
      for (const f of files) {
        try {
          await uploadAttachment(req.id, userId!, f);
        } catch {
          failed.push(f.name);
        }
      }
      return { req, failed };
    },
    onSuccess: ({ req, failed }) => {
      qc.invalidateQueries({ queryKey: ["requests"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["requests-mini"] });
      toast.success(`Solicitud ${req.code} registrada correctamente`);
      if (failed.length)
        toast.warning(
          `No se pudieron adjuntar: ${failed.join(", ")}. Puede volver a subirlos desde el detalle.`,
        );
      navigate({ to: "/solicitudes/$id", params: { id: req.id } });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  function onTypeChange(id: string) {
    const t = types.data?.find((x) => x.id === id);
    const defaultDep =
      t?.default_department_id && deps.data?.some((d) => d.id === t.default_department_id)
        ? t.default_department_id
        : null;
    setForm((f) => ({ ...f, request_type_id: id, department_id: defaultDep ?? f.department_id }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = newRequestSchema.safeParse(form);
    const fileErr = validateFiles(files);
    const errs: Record<string, string> = {};
    if (!parsed.success)
      for (const [k, v] of Object.entries(parsed.error.flatten().fieldErrors))
        errs[k] = v?.[0] ?? "Valor inválido";
    if (fileErr) errs["files"] = fileErr;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    create.mutate();
  }

  const err = (k: string) => errors[k] && <p className="text-xs text-destructive">{errors[k]}</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Nueva solicitud"
        description="Complete el formulario. Se asignará un código y el plazo según el tipo y la prioridad."
      />
      <Card>
        <CardContent className="p-6">
          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={form.title}
                maxLength={200}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                disabled={create.isPending}
              />
              {err("title")}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Tipo de solicitud</Label>
                <Select
                  value={form.request_type_id}
                  onValueChange={onTypeChange}
                  disabled={create.isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(types.data ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {err("request_type_id")}
              </div>
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Select
                  value={form.department_id}
                  onValueChange={(v) => setForm({ ...form, department_id: v })}
                  disabled={create.isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(deps.data ?? []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {err("department_id")}
              </div>
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm({ ...form, priority: v as RequestPriority })}
                  disabled={create.isPending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_LABEL[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Descripción</Label>
              <Textarea
                id="desc"
                rows={6}
                value={form.description}
                maxLength={5000}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                disabled={create.isPending}
              />
              <div className="flex justify-between">
                {err("description") ?? <span />}
                <span className="text-xs text-muted-foreground">
                  {form.description.length}/5000
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="files">Archivos adjuntos (opcional)</Label>
              <Input
                id="files"
                type="file"
                multiple
                accept={ALLOWED_ACCEPT}
                disabled={create.isPending}
                onChange={(e) => {
                  const added: File[] = Array.from(e.target.files ?? []);
                  setFiles((prev) => [
                    ...prev,
                    ...added.filter(
                      (a) => !prev.some((p) => p.name === a.name && p.size === a.size),
                    ),
                  ]);
                  e.target.value = "";
                }}
              />
              <p className="text-xs text-muted-foreground">
                Hasta {MAX_FILES} archivos de 20 MB cada uno (PDF, Office, imágenes, texto, ZIP).
              </p>
              {err("files")}
              <ul className="space-y-1">
                {files.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Paperclip className="size-4" />
                      {f.name}
                    </span>
                    <button
                      type="button"
                      aria-label={`Quitar ${f.name}`}
                      onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate({ to: "/mis-solicitudes" })}
                disabled={create.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                {create.isPending ? "Enviando…" : "Enviar solicitud"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
