import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Loader2, MessageSquare, Paperclip, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { REQUEST_SELECT, useAssignees, type RequestListItem } from "@/lib/queries";
import { PRIORITIES, PRIORITY_LABEL, errorMessage, type RequestPriority } from "@/lib/domain";
import { availableActions, canAssign, type StatusAction } from "@/lib/request-actions";
import { downloadAttachment, uploadAttachment } from "@/lib/attachments";
import { ALLOWED_ACCEPT } from "@/lib/request-schemas";
import { dueInfo, fmtDateTime, fmtDate } from "@/lib/time";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/solicitudes/$id")({ component: RequestDetailPage });

type Hist = {
  id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  comment: string | null;
  created_at: string;
  actor: { full_name: string } | null;
};
type Comment = {
  id: string;
  body: string;
  is_action: boolean;
  created_at: string;
  author: { full_name: string } | null;
};
type Attach = {
  id: string;
  file_name: string;
  size_bytes: number;
  storage_path: string;
  created_at: string;
  uploader: { full_name: string } | null;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}
const fmtSize = (b: number) =>
  b < 1024
    ? `${b} B`
    : b < 1048576
      ? `${(b / 1024).toFixed(1)} KB`
      : `${(b / 1048576).toFixed(1)} MB`;

function RequestDetailPage() {
  const { id } = Route.useParams();
  const { userId, isAdmin, role, org } = useAuth();
  const qc = useQueryClient();
  const assignees = useAssignees();
  const [pending, setPending] = useState<StatusAction | null>(null);
  const [comment, setComment] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTo, setAssignTo] = useState("");
  const [assignNote, setAssignNote] = useState("");
  const [newComment, setNewComment] = useState("");
  const [isActionLog, setIsActionLog] = useState(false);

  const refresh = () => {
    for (const k of [
      "request",
      "history",
      "comments",
      "attachments",
      "requests",
      "dashboard-stats",
      "requests-mini",
    ])
      qc.invalidateQueries({ queryKey: [k] });
  };

  const req = useQuery({
    queryKey: ["request", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select(REQUEST_SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as RequestListItem | null;
    },
  });
  const history = useQuery({
    queryKey: ["history", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_status_history")
        .select("*, actor:profiles!request_status_history_actor_id_fkey(full_name)")
        .eq("request_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Hist[];
    },
  });
  const comments = useQuery({
    queryKey: ["comments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_comments")
        .select("*, author:profiles!request_comments_author_id_fkey(full_name)")
        .eq("request_id", id)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Comment[];
    },
  });
  const files = useQuery({
    queryKey: ["attachments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attachments")
        .select("*, uploader:profiles!attachments_uploaded_by_fkey(full_name)")
        .eq("request_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Attach[];
    },
  });

  const changeStatus = useMutation({
    mutationFn: async (a: StatusAction) => {
      const { error } = await supabase.rpc("change_request_status", {
        _request_id: id,
        _new_status: a.to,
        ...(comment.trim() ? { _comment: comment.trim() } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estado actualizado");
      setPending(null);
      setComment("");
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const assign = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("assign_request", {
        _request_id: id,
        _assignee_id: assignTo,
        ...(assignNote.trim() ? { _comment: assignNote.trim() } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Responsable asignado");
      setAssignOpen(false);
      setAssignTo("");
      setAssignNote("");
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const priority = useMutation({
    mutationFn: async (p: RequestPriority) => {
      const { error } = await supabase.rpc("change_request_priority", {
        _request_id: id,
        _priority: p,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prioridad actualizada");
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const addComment = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("add_request_comment", {
        _request_id: id,
        _body: newComment,
        _is_action: isActionLog,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewComment("");
      setIsActionLog(false);
      toast.success("Comentario agregado");
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const upload = useMutation({
    mutationFn: async (f: File) => {
      await uploadAttachment(id, userId!, f);
    },
    onSuccess: () => {
      toast.success("Archivo adjuntado");
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (req.isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  if (req.isError) return <ErrorState error={req.error} onRetry={() => req.refetch()} />;
  const r = req.data;
  if (!r)
    return (
      <EmptyState
        title="Solicitud no encontrada"
        description="No existe o no tiene acceso a ella."
        action={
          <Button asChild>
            <Link to="/dashboard">Volver</Link>
          </Button>
        }
      />
    );

  const actions = availableActions(r, userId!, isAdmin, org?.allow_requester_close ?? true);
  const due = dueInfo(r, org?.due_soon_hours ?? 24);
  const finished = r.status === "cerrada" || r.status === "cancelada";
  const isAssignee = r.assignee_id === userId;
  const canComment = isAdmin || isAssignee || r.requester_id === userId;
  const canAddFile = (isAdmin || isAssignee || r.requester_id === userId) && !finished;
  const canLogAction = (isAdmin || isAssignee) && !finished;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-3">
          <Link to={role === "empleado" ? "/mis-solicitudes" : "/solicitudes"}>
            <ArrowLeft className="mr-1 size-4" />
            Volver
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-sm text-muted-foreground">{r.code}</p>
            <h1 className="text-2xl font-semibold">{r.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={r.status} />
              <PriorityBadge priority={r.priority} />
              <span
                className={cn("text-sm", due.state === "overdue" && "font-medium text-destructive")}
              >
                {due.label}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canAssign(r, isAdmin) && (
              <Button variant="outline" onClick={() => setAssignOpen(true)}>
                {r.assignee_id ? "Reasignar" : "Asignar"}
              </Button>
            )}
            {actions.map((a) => (
              <Button
                key={a.to + a.label}
                variant={a.destructive ? "destructive" : "default"}
                onClick={() => {
                  setComment("");
                  setPending(a);
                }}
              >
                {a.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Información general</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 whitespace-pre-wrap text-sm">{r.description}</p>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Field label="Solicitante">{r.requester?.full_name ?? "—"}</Field>
                <Field label="Responsable">{r.assignee?.full_name ?? "Sin asignar"}</Field>
                <Field label="Departamento">{r.department?.name ?? "—"}</Field>
                <Field label="Tipo">{r.type?.name ?? "—"}</Field>
                <Field label="Prioridad">
                  {isAdmin && !finished ? (
                    <Select
                      value={r.priority}
                      onValueChange={(v) => priority.mutate(v as RequestPriority)}
                    >
                      <SelectTrigger className="h-8 w-40">
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
                  ) : (
                    PRIORITY_LABEL[r.priority]
                  )}
                </Field>
                <Field label="Fecha de creación">{fmtDateTime(r.created_at)}</Field>
                <Field label="Fecha límite">{fmtDateTime(r.due_at)}</Field>
                <Field label="Fecha de resolución">{fmtDateTime(r.resolved_at)}</Field>
                <Field label="Fecha de cierre">{fmtDateTime(r.closed_at)}</Field>
              </dl>
              {r.resolution_notes && (
                <div className="mt-4 rounded-md bg-muted p-3 text-sm">
                  <b>Resolución:</b> {r.resolution_notes}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="size-4" />
                Comentarios
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {comments.isLoading ? (
                <Skeleton className="h-16" />
              ) : comments.data?.length ? (
                comments.data.map((c) => (
                  <div key={c.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {c.author?.full_name ?? "Usuario"}
                        {c.is_action && (
                          <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-accent-foreground">
                            Acción
                          </span>
                        )}
                      </span>
                      <span>{fmtDateTime(c.created_at)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Aún no hay comentarios.</p>
              )}
              {canComment && (!finished || isAdmin) && (
                <div className="space-y-2 border-t pt-4">
                  <Textarea
                    rows={3}
                    placeholder="Escriba un comentario…"
                    value={newComment}
                    maxLength={4000}
                    onChange={(e) => setNewComment(e.target.value)}
                    disabled={addComment.isPending}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {canLogAction ? (
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={isActionLog}
                          onChange={(e) => setIsActionLog(e.target.checked)}
                        />
                        Registrar como acción realizada
                      </label>
                    ) : (
                      <span />
                    )}
                    <Button
                      size="sm"
                      disabled={!newComment.trim() || addComment.isPending}
                      onClick={() => addComment.mutate()}
                    >
                      {addComment.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                      Comentar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Paperclip className="size-4" />
                Archivos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {files.isLoading ? (
                <Skeleton className="h-12" />
              ) : files.data?.length ? (
                files.data.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{f.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtSize(f.size_bytes)} · {f.uploader?.full_name ?? "—"} ·{" "}
                        {fmtDate(f.created_at)}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Descargar ${f.file_name}`}
                      onClick={() =>
                        downloadAttachment(f.storage_path, f.file_name).catch((e) =>
                          toast.error(errorMessage(e)),
                        )
                      }
                    >
                      <Download className="size-4" />
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Sin archivos adjuntos.</p>
              )}
              {canAddFile && (
                <div>
                  <Label
                    htmlFor="upl"
                    className="mb-1 flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <Upload className="size-3" />
                    {upload.isPending ? "Subiendo…" : "Adjuntar archivo (máx. 20 MB)"}
                  </Label>
                  <Input
                    id="upl"
                    type="file"
                    accept={ALLOWED_ACCEPT}
                    disabled={upload.isPending}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) upload.mutate(f);
                      e.target.value = "";
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historial</CardTitle>
            </CardHeader>
            <CardContent>
              {history.isLoading ? (
                <Skeleton className="h-24" />
              ) : history.isError ? (
                <ErrorState error={history.error} />
              ) : (
                <ol className="relative ml-2 space-y-4 border-l pl-5">
                  {history.data?.map((h) => (
                    <li key={h.id} className="relative">
                      <span className="absolute -left-[1.6rem] top-1.5 size-2.5 rounded-full bg-primary ring-4 ring-background" />
                      <p className="text-sm font-medium">{h.action}</p>
                      {h.comment && <p className="text-xs text-muted-foreground">{h.comment}</p>}
                      <p className="text-xs text-muted-foreground">
                        {h.actor?.full_name ?? "Sistema"} · {fmtDateTime(h.created_at)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={!!pending}
        onOpenChange={(o) => !o && !changeStatus.isPending && setPending(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending?.label}</DialogTitle>
            <DialogDescription>
              {pending?.to === "cancelada"
                ? "Esta acción no se puede deshacer."
                : `La solicitud ${r.code} cambiará de estado y se notificará a los involucrados.`}
            </DialogDescription>
          </DialogHeader>
          {(pending?.needsComment || pending?.to === "resuelta") && (
            <div className="space-y-2">
              <Label htmlFor="cm">
                {pending?.to === "resuelta"
                  ? "Descripción de la resolución (obligatoria)"
                  : "Motivo (opcional)"}
              </Label>
              <Textarea
                id="cm"
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPending(null)}
              disabled={changeStatus.isPending}
            >
              Volver
            </Button>
            <Button
              variant={pending?.destructive ? "destructive" : "default"}
              disabled={
                changeStatus.isPending || (pending?.to === "resuelta" && comment.trim().length < 3)
              }
              onClick={() => pending && changeStatus.mutate(pending)}
            >
              {changeStatus.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{r.assignee_id ? "Reasignar solicitud" : "Asignar solicitud"}</DialogTitle>
            <DialogDescription>Seleccione al responsable de atender {r.code}.</DialogDescription>
          </DialogHeader>
          <Select value={assignTo} onValueChange={setAssignTo}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccione un responsable…" />
            </SelectTrigger>
            <SelectContent>
              {(assignees.data ?? [])
                .filter((a) => a.id !== r.assignee_id)
                .map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.full_name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Textarea
            rows={3}
            placeholder="Nota (opcional)"
            value={assignNote}
            onChange={(e) => setAssignNote(e.target.value)}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignOpen(false)}
              disabled={assign.isPending}
            >
              Cancelar
            </Button>
            <Button disabled={!assignTo || assign.isPending} onClick={() => assign.mutate()}>
              {assign.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Asignar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
